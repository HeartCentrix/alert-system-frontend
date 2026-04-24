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
let _csrfToken = null

function getCsrfToken() {
  if (_csrfToken) return _csrfToken
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/)
  return match ? decodeURIComponent(match[1]) : null
}

const CSRF_METHODS = new Set(['post', 'put', 'patch', 'delete'])

// ── Mutex ────────────────────────────────────────────────────────────────────
let refreshPromise = null

// ── Request interceptor ──────────────────────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = _getAuthStore?.()?.accessToken ?? null
  if (token) config.headers.Authorization = `Bearer ${token}`

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
  const authPaths = ['/auth/login', '/auth/forgot-password', '/auth/reset-password', '/auth/me', '/auth/refresh']
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
  const refreshToken = _getAuthStore?.()?.refreshToken || sessionStorage.getItem('refresh_token') || null

  const { data } = await axios.post(
    `${API_BASE}/auth/refresh`,
    refreshToken ? { refresh_token: refreshToken } : {},
    { withCredentials: true }
  )

  _getAuthStore?.()?.setAccessToken?.(data.access_token)
  if (data.refresh_token) {
    sessionStorage.setItem('refresh_token', data.refresh_token)
    _getAuthStore?.()?.setRefreshToken?.(data.refresh_token)
  }

  return { access_token: data.access_token, refresh_token: data.refresh_token }
}

async function retryWithNewToken(original, tokens) {
  const retryConfig = {
    ...original,
    headers: { ...original.headers, Authorization: `Bearer ${tokens.access_token}` },
  }
  return api.request(retryConfig)
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

    // Handle CSRF errors
    if (err.response?.status === 403 && err.response?.data?.detail?.includes('CSRF')) {
      window.location.reload()
      throw err
    }

    // Skip token refresh for auth endpoints
    const isAuthEndpoint =
      original?.url?.includes('/auth/login') ||
      original?.url?.includes('/auth/forgot-password') ||
      original?.url?.includes('/auth/reset-password') ||
      original?.url?.includes('/auth/me') ||
      original?.url?.includes('/auth/refresh')

    if (isAuthEndpoint) throw err

    // Handle 401 or 403 "Not authenticated"
    const isAuthFailure =
      err.response?.status === 401 ||
      (err.response?.status === 403 && err.response?.data?.detail === 'Not authenticated')

    if (!isAuthFailure || original?._retry === true) {
      throw err
    }

    original._retry = true

    // Wait for any existing refresh request
    if (refreshPromise) {
      try {
        const tokens = await refreshPromise
        if (tokens) {
          original.headers.Authorization = `Bearer ${tokens.access_token}`
          return api(original)
        }
      } catch {
        // Fall through to reject
      }
      throw err
    }

    // Start token refresh
    refreshPromise = refreshAccessToken()

    try {
      const tokens = await refreshPromise
      if (tokens) {
        const retryConfig = {
          ...original,
          headers: {
            ...original.headers,
            Authorization: `Bearer ${tokens.access_token}`
          }
        }
        return api.request(retryConfig)
      }
    } catch (refreshErr) {
      throw refreshErr
    }

    throw err
  }
)

// Refresh access token using refresh token
async function refreshAccessToken() {
  try {
    const refreshToken = _getAuthStore?.()?.refreshToken || sessionStorage.getItem(SESSION_KEYS.REFRESH_TOKEN) || null

    const { data } = await axios.post(
      `${API_BASE}/auth/refresh`,
      refreshToken ? { refresh_token: refreshToken } : {},
      { withCredentials: true }
    )

    // 2026 STANDARD: Save with expiry time
    const expiresIn = data.expires_in || 3600
    _getAuthStore?.()?.setAccessToken?.(data.access_token)
    if (data.refresh_token) {
      sessionStorage.setItem(SESSION_KEYS.REFRESH_TOKEN, data.refresh_token)
      _getAuthStore?.()?.setRefreshToken?.(data.refresh_token)
    }
    // Store token expiry
    const expiryTime = Date.now() + (expiresIn * 1000)
    sessionStorage.setItem(SESSION_KEYS.TOKEN_EXPIRY, expiryTime.toString())

    return { access_token: data.access_token, refresh_token: data.refresh_token }
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
  refresh: (refreshToken) => api.post('/auth/refresh',
    refreshToken ? { refresh_token: refreshToken } : {},
    { withCredentials: true }
  ),
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
  completeMFAReset: (code) => api.post('/auth/mfa/reset/complete', { code }),
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
