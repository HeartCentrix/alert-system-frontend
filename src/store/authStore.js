import { create } from 'zustand'
import { authAPI, usersAPI } from '@/services/api'

// Session tokens live in HttpOnly cookies now (security review F-C2); the
// frontend no longer persists them, so the saveX / getX helpers below are
// intentional no-ops kept only so older call sites don't have to be
// rewritten. Any residual value in sessionStorage from a pre-F-C2 build
// is also cleared on the first init() call.
const saveRefreshToken = () => {}
const getRefreshToken = () => null
const clearRefreshToken = () => {
  sessionStorage.removeItem('refresh_token')
  sessionStorage.removeItem('tm_refresh_token')
}
const saveAccessToken = () => {}
const getAccessToken = () => null
const clearAccessToken = () => {
  sessionStorage.removeItem('access_token')
  sessionStorage.removeItem('access_token_expiry')
  sessionStorage.removeItem('tm_access_token')
  sessionStorage.removeItem('tm_token_expiry')
}

const clearAllSessionData = () => {
  clearAccessToken()
  clearRefreshToken()
  sessionStorage.removeItem('user')
}

// Expiry is tracked server-side via the access-token cookie's Max-Age; the
// frontend just reacts to 401s. Always return false so legacy callers keep
// trying the current session, at which point the response interceptor
// refreshes or bounces to /login as appropriate.
const isAccessTokenExpired = () => false

// Helper: Initialize authentication with token refresh logic.
// The HttpOnly access/refresh cookies are opaque to JavaScript, so we can't
// decide from the client whether to try /auth/me — we just try and let the
// response interceptor drive refresh or logout based on the server answer.
async function initializeAuth(_set) {
  // Clear any lingering sessionStorage from pre-F-C2 builds.
  clearAllSessionData()

  try {
    const { data } = await authAPI.me()
    return {
      user: data,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false,
    }
  } catch (_err) {
    return {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false,
    }
  }
}

// Helper: Handle token refresh flow
async function handleTokenRefresh(set) {
  try {
    const refreshTokenFromStorage = getRefreshToken()

    const { data: refreshData } = await authAPI.refresh(refreshTokenFromStorage)

    if (refreshData?.access_token) {
      // Save new tokens to sessionStorage
      if (refreshData.refresh_token) {
        saveRefreshToken(refreshData.refresh_token)
      }
      const expiresIn = refreshData.expires_in || 3600
      saveAccessToken(refreshData.access_token, expiresIn)

      // IMPORTANT: Update Zustand store BEFORE calling /auth/me
      // This ensures the request interceptor uses the NEW token
      set({
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || refreshTokenFromStorage
      })

      // Fetch user data with NEW token
      const { data: userData } = await authAPI.me()

      return {
        accessToken: refreshData.access_token,
        refreshToken: refreshData.refresh_token || refreshTokenFromStorage,
        user: userData,
        isAuthenticated: true,
        isLoading: false,
        isInitializing: false
      }
    }
  } catch (refreshError) {
    // Refresh failed - clear session
    clearAllSessionData()
  }
  return null
}

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  accessToken: null,
  refreshToken: null,
  isInitializing: false,      // Prevent duplicate init calls
  // MFA state
  mfaState: null,
  mfaChallengeToken: null,
  mfaQRCodeURI: null,
  mfaSecret: null,
  // Heartbeat interval ID
  heartbeatIntervalId: null,

  init: async () => {
    // Prevent duplicate initialization
    if (get().isInitializing) return
    set({ isInitializing: true })

    try {
      // Initialize authentication (handles token validation and refresh)
      const authResult = await initializeAuth(set)
      set(authResult)

      // Start heartbeat if user is authenticated
      if (authResult.isAuthenticated) {
        get().startHeartbeat()
      }
    } catch (error) {
      // Authentication failed - clear all session data
      clearAllSessionData()
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isInitializing: false,
        accessToken: null,
        refreshToken: null,
        mfaState: null
      })
    }
  },

  startHeartbeat: () => {
    // Clear any existing interval
    const existingId = get().heartbeatIntervalId
    if (existingId) {
      clearInterval(existingId)
    }

    // Send initial heartbeat
    usersAPI.heartbeat().catch(() => {}) // Ignore errors on initial heartbeat

    // Set up interval to send heartbeat every 30 seconds
    const intervalId = setInterval(() => {
      usersAPI.heartbeat().catch(() => {
        // If heartbeat fails (e.g., 401), stop the interval
        get().stopHeartbeat()
      })
    }, 30000) // 30 seconds

    set({ heartbeatIntervalId: intervalId })
  },

  stopHeartbeat: () => {
    const intervalId = get().heartbeatIntervalId
    if (intervalId) {
      clearInterval(intervalId)
      set({ heartbeatIntervalId: null })
    }
  },

  setAccessToken: (token) => {
    set({ accessToken: token })
  },

  setRefreshToken: (token) => {
    set({ refreshToken: token })
  },

  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)

    if (data.status === 'mfa_required') {
      if (!data.mfa_configured) {
        set({
          mfaState: 'setup_required',
          mfaChallengeToken: data.challenge_token,
          mfaQRCodeURI: data.qr_code_uri,
          mfaSecret: data.secret,
        })
      } else {
        set({
          mfaState: 'challenge_required',
          mfaChallengeToken: data.challenge_token,
          mfaSecret: null,
        })
      }
      return data
    }

    if (!data?.user) throw new Error('No user data received from server')

    // Tokens land as HttpOnly cookies (security review F-C2); no client
    // persistence needed. Just hold user info in memory for the UI.
    set({
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })

    // Start heartbeat after successful login
    get().startHeartbeat()

    return data
  },

  setTokensFromSSO: async (accessToken, refreshToken) => {
    // Decode JWT to get expiry time from exp claim
    let expiresIn = 3600 // Default 1 hour
    try {
      const payload = JSON.parse(atob(accessToken.split('.')[1]))
      if (payload.exp) {
        // exp is Unix timestamp in seconds, convert to milliseconds from now
        const expiryTimestamp = payload.exp * 1000
        const now = Date.now()
        expiresIn = Math.floor((expiryTimestamp - now) / 1000)
        // Ensure positive value
        if (expiresIn < 0) expiresIn = 0
      }
    } catch (e) {
      console.warn('Could not decode JWT exp claim, using default expiresIn=3600')
    }

    // Store tokens with proper expiry
    saveAccessToken(accessToken, expiresIn)
    saveRefreshToken(refreshToken)
    
    // IMPORTANT: Set isInitializing: false to prevent race conditions
    // React Strict Mode may trigger duplicate init() calls
    set({ 
      accessToken, 
      refreshToken,
      isInitializing: false
    })

    // Fetch user profile using the new token
    try {
      const { data } = await authAPI.me()
      set({
        user: data,
        isAuthenticated: true,
        isLoading: false,
      })
      // Start heartbeat after successful SSO login
      get().startHeartbeat()
    } catch (err) {
      // Token invalid — clear everything
      clearAccessToken()
      clearRefreshToken()
      set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      throw err
    }
  },

  // Called by AuthCallbackPage after SSO. The backend has set an HttpOnly
  // refresh cookie; exchange it for an access token via /auth/refresh rather
  // than reading tokens from the URL (security review F-C3 / B-C2).
  completeSSOFromCookie: async () => {
    try {
      const { data } = await authAPI.refresh()
      saveAccessToken(data.access_token, data.expires_in)
      if (data.refresh_token) saveRefreshToken(data.refresh_token)
      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token || get().refreshToken,
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      })
      get().startHeartbeat()
      return data
    } catch (err) {
      clearAccessToken()
      clearRefreshToken()
      set({ user: null, isAuthenticated: false, accessToken: null, refreshToken: null })
      throw err
    }
  },

  ldapLogin: async (username, password) => {
    const { data } = await authAPI.ldapLogin(username, password)
    
    // Decode JWT to get expiry time from exp claim
    let expiresIn = 3600 // Default 1 hour
    try {
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      if (payload.exp) {
        const expiryTimestamp = payload.exp * 1000
        const now = Date.now()
        expiresIn = Math.floor((expiryTimestamp - now) / 1000)
        if (expiresIn < 0) expiresIn = 0
      }
    } catch (e) {
      console.warn('Could not decode JWT exp claim, using default expiresIn=3600')
    }
    
    saveAccessToken(data.access_token, expiresIn)
    if (data.refresh_token) saveRefreshToken(data.refresh_token)
    set({
      user: data.user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
      isLoading: false,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })
    // Start heartbeat after successful LDAP login
    get().startHeartbeat()
    return data
  },

  verifyMFA: async (code) => {
    const { mfaChallengeToken } = get()
    if (!mfaChallengeToken) throw new Error('No MFA challenge token available')

    const { data } = await authAPI.verifyMFA(mfaChallengeToken, code)

    // Decode JWT to get expiry time from exp claim
    let expiresIn = 3600 // Default 1 hour
    try {
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      if (payload.exp) {
        const expiryTimestamp = payload.exp * 1000
        const now = Date.now()
        expiresIn = Math.floor((expiryTimestamp - now) / 1000)
        if (expiresIn < 0) expiresIn = 0
      }
    } catch (e) {
      console.warn('Could not decode JWT exp claim, using default expiresIn=3600')
    }

    if (data?.recovery_codes && data.recovery_codes.length > 0) {
      saveRefreshToken(data.refresh_token)
      saveAccessToken(data.access_token, expiresIn)
      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        isAuthenticated: false,   // Keep false until recovery codes dismissed
        mfaState: null,
        mfaChallengeToken: null,
        mfaQRCodeURI: null,
      })
    } else {
      saveRefreshToken(data.refresh_token)
      saveAccessToken(data.access_token, expiresIn)
      set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        user: data.user,
        isAuthenticated: true,
        mfaState: null,
        mfaChallengeToken: null,
        mfaQRCodeURI: null,
      })
      // Start heartbeat after successful MFA verification
      get().startHeartbeat()
    }
    return data
  },

  verifyMFAWithRecoveryCode: async (recoveryCode, challengeToken) => {
    const token = challengeToken || get().mfaChallengeToken
    if (!token) throw new Error('No challenge token available')

    const { data } = await authAPI.verifyMFAWithRecoveryCode(token, recoveryCode)

    // Decode JWT to get expiry time from exp claim
    let expiresIn = 3600 // Default 1 hour
    try {
      const payload = JSON.parse(atob(data.access_token.split('.')[1]))
      if (payload.exp) {
        const expiryTimestamp = payload.exp * 1000
        const now = Date.now()
        expiresIn = Math.floor((expiryTimestamp - now) / 1000)
        if (expiresIn < 0) expiresIn = 0
      }
    } catch (e) {
      console.warn('Could not decode JWT exp claim, using default expiresIn=3600')
    }

    saveRefreshToken(data.refresh_token)
    saveAccessToken(data.access_token, expiresIn)
    set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
      isAuthenticated: true,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
    })
    return data
  },

  clearMFAState: () => {
    set({ mfaState: null, mfaChallengeToken: null, mfaQRCodeURI: null, mfaSecret: null })
  },

  logout: async () => {
    try { 
      // Notify backend to invalidate session
      await authAPI.logout() 
    } catch {}
    
    // Stop heartbeat first
    get().stopHeartbeat()
    
    // Clear ALL session data
    clearAllSessionData()
    
    // Clear store state
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })
  },

  clearSession: () => {
    // Stop heartbeat first
    get().stopHeartbeat()
    
    // Clear ALL session data
    clearAllSessionData()
    
    // Clear store state
    set({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })
  },

  updateUser: (updatedUser) => {
    set({ user: updatedUser })
  },
}))

// Register store accessor into api.js to break the circular import.
// This runs once when authStore.js is first imported, after both modules
// have fully initialised. api.js receives a getter that returns the live
// Zustand state — it never holds a stale reference.
import { setAuthStoreAccessor } from '@/services/api'
setAuthStoreAccessor(() => useAuthStore.getState())

export default useAuthStore
