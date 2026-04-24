import { create } from 'zustand'
import { authAPI, usersAPI } from '@/services/api'

// Simple session storage (no prefixes, no complex tracking)
const saveRefreshToken = (token) => {
  if (token) {
    sessionStorage.setItem('refresh_token', token)
  }
}

const getRefreshToken = () => {
  return sessionStorage.getItem('refresh_token')
}

const clearRefreshToken = () => {
  sessionStorage.removeItem('refresh_token')
}

const saveAccessToken = (token, expiresIn = 3600) => {
  if (token) {
    sessionStorage.setItem('access_token', token)
    // Store expiry timestamp for token refresh
    const expiryTime = Date.now() + (expiresIn * 1000)
    sessionStorage.setItem('access_token_expiry', expiryTime.toString())
  }
}

const getAccessToken = () => {
  return sessionStorage.getItem('access_token')
}

const clearAccessToken = () => {
  sessionStorage.removeItem('access_token')
  sessionStorage.removeItem('access_token_expiry')
}

// Clear all session data
const clearAllSessionData = () => {
  clearAccessToken()
  clearRefreshToken()
  sessionStorage.removeItem('user')
}

// Check if access token is expired
const isAccessTokenExpired = () => {
  const expiry = sessionStorage.getItem('access_token_expiry')
  if (!expiry) return true
  
  const expiryTime = parseInt(expiry, 10)
  const now = Date.now()
  
  // Consider token expired if within 30 seconds of expiry (buffer time)
  return now >= (expiryTime - 30000)
}

// Helper: Initialize authentication with token refresh logic
async function initializeAuth(set) {
  const persistedToken = getAccessToken()
  const isExpired = isAccessTokenExpired()

  // Check if token exists AND is not expired
  if (!persistedToken || isExpired) {
    // No token or token expired - clear session and require login
    clearAllSessionData()
    return {
      accessToken: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
      isInitializing: false
    }
  }

  try {
    // Try to fetch user with current token
    const { data } = await authAPI.me()
    return {
      accessToken: persistedToken,
      user: data,
      isAuthenticated: true,
      isLoading: false,
      isInitializing: false
    }
  } catch (error) {
    // Handle 401/403 with token refresh
    if (error?.response?.status === 401 || error?.response?.status === 403) {
      const refreshResult = await handleTokenRefresh(set)
      if (refreshResult) {
        return refreshResult
      }
    }
    // Auth failed and refresh didn't work - clear session
    clearAllSessionData()
    throw error
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

    if (!data?.access_token) throw new Error('No token received from server')

    // 2026 STANDARD: Save tokens with expiry time from backend
    const expiresIn = data.expires_in || 3600 // Default 1 hour
    saveAccessToken(data.access_token, expiresIn)
    saveRefreshToken(data.refresh_token)
    set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
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
    // Store tokens
    saveAccessToken(accessToken)
    saveRefreshToken(refreshToken)
    set({ accessToken, refreshToken })

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
    saveAccessToken(data.access_token)
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

    if (data?.recovery_codes && data.recovery_codes.length > 0) {
      saveRefreshToken(data.refresh_token)
      saveAccessToken(data.access_token)
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
      saveAccessToken(data.access_token)
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

    saveRefreshToken(data.refresh_token)
    saveAccessToken(data.access_token)
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
