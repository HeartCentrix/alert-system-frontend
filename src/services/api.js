import axios from 'axios'

// Get API URL from environment variable, fallback to local for development
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Mutex for token refresh - prevents concurrent refresh requests
// Store the refresh promise to queue concurrent requests
let refreshPromise = null

// Clear only auth-related items from localStorage (not all origin data)
function clearAuthData() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('refresh_token')
  localStorage.removeItem('user')
}

// Attach token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 - refresh token or logout
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config

    // Skip refresh logic for auth endpoints (login, forgot-password, reset-password)
    // These endpoints return 401 for invalid credentials, not expired tokens
    const isAuthEndpoint =
      original.url?.includes('/auth/login') ||
      original.url?.includes('/auth/forgot-password') ||
      original.url?.includes('/auth/reset-password')

    if (isAuthEndpoint) {
      return Promise.reject(err)
    }

    if (err.response?.status === 401 && !original._retry) {
      original._retry = true

      // If refresh is in progress, wait for it to complete
      if (refreshPromise) {
        try {
          const tokens = await refreshPromise
          if (tokens) {
            original.headers.Authorization = `Bearer ${tokens.access_token}`
            return api(original)
          }
        } catch {
          // Refresh failed - will redirect to login
        }
        return Promise.reject(err)
      }

      // Start refresh process - create a promise that all concurrent requests can await
      refreshPromise = (async () => {
        const refreshToken = localStorage.getItem('refresh_token')

        if (!refreshToken) {
          throw new Error('No refresh token')
        }

        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
          const { access_token, refresh_token } = data

          // Store new tokens
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)

          return { access_token, refresh_token }
        } catch (refreshErr) {
          // Refresh failed - clear auth data and redirect
          clearAuthData()
          window.location.href = '/#/login'
          throw refreshErr
        } finally {
          // Reset refresh promise so future requests can refresh again
          refreshPromise = null
        }
      })()

      try {
        const tokens = await refreshPromise
        if (tokens) {
          original.headers.Authorization = `Bearer ${tokens.access_token}`
          return api(original)
        }
      } catch (refreshErr) {
        return Promise.reject(refreshErr)
      }
    }
    return Promise.reject(err)
  }
)

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  logout: (refresh_token) => api.post('/auth/logout', { refresh_token }),
  me: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/me', data),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, new_password) => api.post('/auth/reset-password', { token, new_password }),
  changePassword: (current, next) => api.post('/auth/change-password', { current_password: current, new_password: next }),
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
   * Search for locations using LocationIQ autocomplete
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
  respond: (id, data) => api.post(`/notifications/${id}/respond`, data),
}

export default api
