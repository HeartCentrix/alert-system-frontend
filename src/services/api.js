import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
})

// Mutex for token refresh - prevents concurrent refresh requests
let isRefreshing = false
let refreshSubscribers = []

// Subscribe to refresh event (queue callbacks)
function subscribeTokenRefresh(cb) {
  refreshSubscribers.push(cb)
}

// Execute all queued callbacks with new token
function onRefreshed(access_token, refresh_token) {
  refreshSubscribers.forEach(cb => cb(access_token, refresh_token))
  refreshSubscribers = []
}

// Handle refresh failure - clear all queued callbacks
function onRefreshFailed() {
  refreshSubscribers.forEach(cb => cb(null, null))
  refreshSubscribers = []
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
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true
      
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((access_token, refresh_token) => {
            if (access_token) {
              original.headers.Authorization = `Bearer ${access_token}`
              resolve(api(original))
            } else {
              // Refresh failed - logout
              localStorage.clear()
              window.location.href = '/#/login'
              resolve(Promise.reject(err))
            }
          })
        })
      }
      
      // Start refresh process
      isRefreshing = true
      const refreshToken = localStorage.getItem('refresh_token')
      
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refresh_token: refreshToken })
          const { access_token, refresh_token } = data
          
          // Store new tokens
          localStorage.setItem('access_token', access_token)
          localStorage.setItem('refresh_token', refresh_token)
          
          // Notify all queued requests
          onRefreshed(access_token, refresh_token)
          isRefreshing = false
          
          // Retry original request
          original.headers.Authorization = `Bearer ${access_token}`
          return api(original)
        } catch (refreshErr) {
          // Refresh failed - logout
          onRefreshFailed()
          isRefreshing = false
          localStorage.clear()
          window.location.href = '/#/login'
          return Promise.reject(refreshErr)
        }
      } else {
        // No refresh token - logout immediately
        onRefreshFailed()
        isRefreshing = false
        localStorage.clear()
        window.location.href = '/#/login'
        return Promise.reject(err)
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
