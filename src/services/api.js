import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// ── Auth store accessor (breaks circular dependency) ──────────────────────
let _getAuthStore = null
export function setAuthStoreAccessor(fn) {
  _getAuthStore = fn
}

// 2026 STANDARD: Session key constants (must match authStore.js)
const SESSION_KEYS = {
  ACCESS_TOKEN: 'tm_access_token',
  REFRESH_TOKEN: 'tm_refresh_token',
  SESSION_ID: 'tm_session_id',
  TOKEN_EXPIRY: 'tm_token_expiry',
}

function clearAuthData() {
  // 2026 STANDARD: Clear ALL session data
  Object.values(SESSION_KEYS).forEach(key => {
    sessionStorage.removeItem(key)
  })
}

// ── Anti-forgery helper ─────────────────────────────────────────────────────
// The CSRF token is cached in-module after the backend emits it via the
// X-CSRF-Token response header (see the response interceptor below). We do
// NOT read it from document.cookie — that path required the cookie to be
// JS-readable (HttpOnly=false), and a cookie a single XSS can read is a
// cookie a single XSS can steal (security review F-H1). With the header
// contract, the cookie can stay HttpOnly.
let _csrfToken = null

/**
 * Get CSRF token from cookie with security validation
 * 2026 STANDARD: Validate token format to prevent XSS via cookie injection
 */
function getCsrfToken() {
  return _csrfToken
}

const CSRF_METHODS = new Set(['post', 'put', 'patch', 'delete'])

// ── Mutex ────────────────────────────────────────────────────────────────────
let refreshPromise = null

// ── Request interceptor ──────────────────────────────────────────────────────
// The access token is now an HttpOnly cookie (security review F-C2); the
// browser attaches it automatically on same-origin / withCredentials
// requests. JavaScript has no reason to forge an Authorization: Bearer
// header from in-memory state — doing so is what previously required the
// token to live in sessionStorage and created the XSS = ATO risk.
api.interceptors.request.use((config) => {
  if (CSRF_METHODS.has(config.method?.toLowerCase())) {
    const csrfToken = getCsrfToken()
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken
  }
  return config
})

// ── Response interceptor helpers ─────────────────────────────────────────────

function isCsrfError(err) {
  return err.response?.status === 403 && err.response?.data?.detail?.includes('CSRF')
}

function isAuthEndpointUrl(url) {
  // Endpoints whose 401/403 means "the credential you supplied is wrong"
  // — NOT "your session expired, try refreshing". A failed refresh on
  // these paths makes no sense (the user is logged in; they just typed a
  // wrong password / OTP in a form body) and triggers a CSRF 403 cascade
  // that ends up redirecting the user to /login, masking the real error.
  //
  // Includes:
  //   - login bootstrap (/auth/login, /auth/me, /auth/refresh, etc.)
  //   - MFA verification (login challenge + recovery-code login)
  //   - In-session MFA management (enroll/disable/reset/regenerate-codes)
  //   - In-session password change
  // All of these accept credentials in the request body; a 401 from any
  // of them is a "your input is wrong" signal, never a "session expired".
  const authPaths = [
    '/auth/login',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/me',
    '/auth/refresh',
    '/auth/mfa/verify-login',
    '/auth/mfa/recovery-code/verify',
    '/auth/ldap/login',
    '/auth/mfa/enroll/start',
    '/auth/mfa/enroll/complete',
    '/auth/mfa/disable',
    '/auth/mfa/reset/start',
    '/auth/mfa/reset/complete',
    '/auth/mfa/recovery-codes/regenerate',
    '/auth/change-password',
  ]
  return authPaths.some(path => url?.includes(path))
}

function isAuthFailureStatus(err) {
  return (
    err.response?.status === 401 ||
    (err.response?.status === 403 && err.response?.data?.detail === 'Not authenticated')
  )
}

function handleExpiredSession() {
  const currentPath = globalThis.location.pathname
  const isPublicPage =
    currentPath === '/login' ||
    currentPath === '/forgot-password' ||
    currentPath === '/reset-password' ||
    currentPath.startsWith('/notifications/') ||
    currentPath === '/responded'

  _getAuthStore?.()?.clearSession?.()
  if (!isPublicPage) {
    globalThis.location.href = '/#/login'
  }
}

async function executeTokenRefresh() {
  // Refresh token is an HttpOnly cookie — withCredentials sends it, there
  // is nothing to pass in the body (security review B-H1 / F-C2).
  // /auth/refresh is a state-changing POST so the CSRF middleware
  // requires X-CSRF-Token header in addition to the csrf_token cookie.
  // We bypass the configured `api` instance here (so a refresh failure
  // doesn't recurse through the response interceptor), so the request
  // interceptor doesn't run — set X-CSRF-Token explicitly.
  const headers = {}
  if (_csrfToken) headers['X-CSRF-Token'] = _csrfToken
  const { data } = await axios.post(
    `${API_BASE}/auth/refresh`,
    {},
    { withCredentials: true, headers }
  )
  return { access_token: data?.access_token, refresh_token: data?.refresh_token }
}

async function retryWithNewToken(original, _tokens) {
  // Cookies were rotated by /auth/refresh; simply replay the original
  // request and the browser will attach the new access_token cookie.
  return api.request({ ...original })
}

// ── Response interceptor ─────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    const csrfHeader = res.headers?.['x-csrf-token']
    if (csrfHeader) _csrfToken = csrfHeader
    return res
  },
  async (err) => {
    const original = err.config

    // Skip token refresh for auth-completion endpoints. Their 401/403
    // means the supplied credential is wrong, not that the session
    // expired — refreshing makes no sense and produces a CSRF 403
    // cascade that wipes the real error from the UI.
    if (isAuthEndpointUrl(original?.url)) throw err

    // Handle CSRF errors on non-auth endpoints. Drop the cached token so
    // the next response (which will carry a fresh X-CSRF-Token via the
    // CSRF middleware) seeds a new one. Don't reload — that wipes any
    // in-flight error toast and confuses the user.
    if (err.response?.status === 403 && err.response?.data?.detail?.includes('CSRF')) {
      _csrfToken = null
      throw err
    }

    // Handle 401 or 403 "Not authenticated"
    const isAuthFailure =
      err.response?.status === 401 ||
      (err.response?.status === 403 && err.response?.data?.detail === 'Not authenticated')

    if (!isAuthFailure || original?._retry === true) {
      throw err
    }

    original._retry = true

    // Wait for any existing refresh request — once it resolves, the new
    // access_token cookie is already set on the browser, so replaying the
    // original request succeeds without touching any header.
    if (refreshPromise) {
      try {
        await refreshPromise
        return api(original)
      } catch {
        // Fall through to reject
      }
      throw err
    }

    // Start token refresh
    refreshPromise = refreshAccessToken()

    try {
      await refreshPromise
      return api.request({ ...original })
    } catch (refreshErr) {
      throw refreshErr
    }
  }
)

// Refresh access token using refresh token.
// Both tokens are HttpOnly cookies now (security review F-C2) so the
// browser handles them via withCredentials — there is nothing for this
// function to persist. We still return the response body in case any
// caller wants the expires_in hint, but session state lives in cookies.
async function refreshAccessToken() {
  try {
    // See executeTokenRefresh for why X-CSRF-Token is set explicitly.
    const headers = {}
    if (_csrfToken) headers['X-CSRF-Token'] = _csrfToken
    const { data } = await axios.post(
      `${API_BASE}/auth/refresh`,
      {},
      { withCredentials: true, headers }
    )
    return { access_token: data?.access_token, refresh_token: data?.refresh_token }
  } catch (refreshErr) {
    // Refresh failed — session fully expired
    const currentPath = window.location.pathname
    const isPublicPage =
      currentPath === '/login' ||
      currentPath === '/forgot-password' ||
      currentPath === '/reset-password' ||
      currentPath.startsWith('/notifications/') ||
      currentPath === '/responded'

    if (!isPublicPage) {
      _getAuthStore?.()?.clearSession?.()
      window.location.href = '/#/login'
    } else {
      _getAuthStore?.()?.clearSession?.()
    }
    throw refreshErr
  } finally {
    refreshPromise = null
  }
}

// ─── AUTH ────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  ldapLogin: (username, password) => api.post('/auth/ldap/login', { username, password }),
  logout: () => api.post('/auth/logout', {}),
  refresh: () => api.post('/auth/refresh', {}, { withCredentials: true }),
  me: () => api.get('/auth/me'),
  getProviders: () => api.get('/auth/providers'),
  updateProfile: (data) => api.put('/auth/me', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
  changePassword: (current, next) => api.post('/auth/change-password', { current_password: current, new_password: next }),
  verifyMFA: (challenge_token, code) => api.post('/auth/mfa/verify-login', { challenge_token, code }),
  verifyMFAWithRecoveryCode: (challenge_token, recovery_code) => api.post('/auth/mfa/recovery-code/verify', { challenge_token, recovery_code }),
  getMFAStatus: () => api.get('/auth/mfa/status'),
  initiateMFA: () => api.post('/auth/mfa/initiate'),
  confirmMFA: (code) => api.post('/auth/mfa/confirm', { code }),
  disableMFA: (code) => api.post('/auth/mfa/disable', { code }),
  startMFAEnrollment: (current_password) => api.post('/auth/mfa/enroll/start', { current_password }),
  completeMFAEnrollment: (code) => api.post('/auth/mfa/enroll/complete', { code }),
  disableMFAWithReauth: (current_password, mfa_code) => api.post('/auth/mfa/disable', { current_password, mfa_code }),
  startMFAReset: (current_password, mfa_code) => api.post('/auth/mfa/reset/start', { current_password, mfa_code }),
  completeMFAReset: (code, reset_token) => api.post('/auth/mfa/reset/complete', { code, reset_token }),
  getRecoveryCodesStatus: () => api.get('/auth/mfa/recovery-codes/status'),
  regenerateRecoveryCodes: (params) => api.post('/auth/mfa/recovery-codes/regenerate', params),
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
export const dashboardAPI = {
  stats: () => api.get('/dashboard/stats'),
  mapData: () => api.get('/dashboard/map-data'),
  activity: (days = 7) => api.get(`/dashboard/notification-activity?days=${days}`),
}

// ─── USERS ────────────────────────────────────────────────────────────────────
export const usersAPI = {
  list: (params) => api.get('/users', { params }),
  get: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  bulkDelete: (user_ids) => api.post('/users/bulk-delete', user_ids),
  importCSV: (file) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/users/import/csv', form, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  departments: () => api.get('/users/meta/departments'),
  heartbeat: () => api.post('/users/heartbeat'),
}

// ─── GROUPS ───────────────────────────────────────────────────────────────────
export const groupsAPI = {
  list: (params) => api.get('/groups', { params }),
  get: (id) => api.get(`/groups/${id}`),
  create: (data) => api.post('/groups', data),
  update: (id, data) => api.put(`/groups/${id}`, data),
  delete: (id) => api.delete(`/groups/${id}`),
  addMembers: (id, user_ids) => api.post(`/groups/${id}/members`, { user_ids }),
  removeMember: (groupId, userId) => api.delete(`/groups/${groupId}/members/${userId}`),
  preview: (data) => api.post('/groups/preview', data),
  getFilterOptions: () => api.get('/groups/filters/options'),
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────
export const locationsAPI = {
  list: () => api.get('/locations'),
  create: (data) => api.post('/locations', data),
  update: (id, data) => api.put(`/locations/${id}`, data),
  delete: (id) => api.delete(`/locations/${id}`),
}

// ─── LOCATION AUTOCOMPLETE ────────────────────────────────────────────────────
export const locationAutocompleteAPI = {
  /**
   * Search for locations using Photon autocomplete
   * @param {string} query - Search query (min 3 characters)
   * @param {object} options - Optional parameters
   * @param {number} options.limit - Number of results (1-20, default 10)
   * @param {string} options.countrycodes - Comma-separated country codes (e.g., 'us,ca')
   * @param {string} options.viewbox - Bounding box for biasing: 'x1,y1,x2,y2'
   * @param {boolean} options.bounded - Restrict results to viewbox
   */
  search: (query, options = {}) => {
    const params = new URLSearchParams({ q: query })
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.countrycodes) params.append('countrycodes', options.countrycodes)
    if (options.viewbox) params.append('viewbox', options.viewbox)
    if (options.bounded) params.append('bounded', '1')
    return api.get(`/location/autocomplete?${params.toString()}`)
  },
  health: () => api.get('/location/health'),
}

// ─── LOCATION AUDIENCE MANAGEMENT ─────────────────────────────────────────────
export const locationAudienceAPI = {
  /**
   * Manually assign a user to a location
   * @param {object} data - Assignment data
   * @param {number} data.user_id - User ID
   * @param {number} data.location_id - Location ID
   * @param {string} [data.notes] - Optional notes
   * @param {string} [data.expires_at] - Optional expiration
   */
  assignUser: (data) => api.post('/location-audience/assign', data),

  /**
   * Remove a user from a location
   * @param {number} userId - User ID
   * @param {number} locationId - Location ID
   * @param {string} [reason] - Removal reason
   */
  removeUser: (userId, locationId, reason = null) =>
    api.post('/location-audience/remove', { reason }, {
      params: { user_id: userId, location_id: locationId }
    }),

  /**
   * Update user's geofence location
   * @param {number} latitude - User's latitude
   * @param {number} longitude - User's longitude
   */
  updateGeofence: (latitude, longitude) =>
    api.post('/location-audience/geofence/update', { latitude, longitude }),

  /**
   * Get all members of a location
   * @param {number} locationId - Location ID
   * @param {object} params - Query parameters
   * @param {number} [params.page] - Page number
   * @param {number} [params.page_size] - Items per page
   * @param {string} [params.status] - Filter by status (active/inactive)
   * @param {string} [params.assignment_type] - Filter by type (manual/geofence)
   */
  getLocationMembers: (locationId, params = {}) =>
    api.get(`/location-audience/location/${locationId}/members`, { params }),

  /**
   * Get all locations for a user
   * @param {number} userId - User ID
   * @param {boolean} [includeInactive] - Include inactive assignments
   */
  getUserLocations: (userId, includeInactive = false) =>
    api.get(`/location-audience/user/${userId}/locations`, {
      params: { include_inactive: includeInactive }
    }),

  /**
   * Get location membership history
   * @param {number} locationId - Location ID
   * @param {object} params - Query parameters
   * @param {number} [params.page] - Page number
   * @param {number} [params.page_size] - Items per page
   * @param {string} [params.action] - Filter by action type
   */
  getLocationHistory: (locationId, params = {}) =>
    api.get(`/location-audience/location/${locationId}/history`, { params }),

  /**
   * Get location audience statistics
   */
  getStats: () => api.get('/location-audience/stats'),
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────
export const templatesAPI = {
  list: (params) => api.get('/templates', { params }),
  create: (data) => api.post('/templates', data),
  update: (id, data) => api.put(`/templates/${id}`, data),
  delete: (id) => api.delete(`/templates/${id}`),
  categories: () => api.get('/templates/categories'),
}

// ─── INCIDENTS ────────────────────────────────────────────────────────────────
export const incidentsAPI = {
  list: (params) => api.get('/incidents', { params }),
  get: (id) => api.get(`/incidents/${id}`),
  create: (data) => api.post('/incidents', data),
  update: (id, data) => api.put(`/incidents/${id}`, data),
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  list: (params) => api.get('/notifications', { params }),
  get: (id) => api.get(`/notifications/${id}`),
  create: (data) => api.post('/notifications', data),
  send: (id) => api.post(`/notifications/${id}/send`),
  cancel: (id) => api.post(`/notifications/${id}/cancel`),
  delivery: (id, params) => api.get(`/notifications/${id}/delivery`, { params }),
  responses: (id) => api.get(`/notifications/${id}/responses`),
  respond: (id, data, token) => {
    // Send the checkin token in a header rather than as a query parameter
    // — query params land in access logs, Referer, and browser history
    // (security review F-H3). The backend reads X-Checkin-Token.
    return api.post(`/notifications/${id}/respond`, data, {
      headers: token ? { 'X-Checkin-Token': token } : undefined,
    })
  },
}

export default api
