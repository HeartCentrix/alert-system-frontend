import { create } from 'zustand'
import { authAPI, usersAPI } from '@/services/api'

// Helper functions for sessionStorage (survives page reload, cleared on tab close)
// This is required for cross-origin deployments (Vercel + Railway) where cookies don't work
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

// Also persist access token to sessionStorage so it survives page refresh
const saveAccessToken = (token) => {
  if (token) {
    sessionStorage.setItem('access_token', token)
  }
}

const getAccessToken = () => {
  return sessionStorage.getItem('access_token')
}

const clearAccessToken = () => {
  sessionStorage.removeItem('access_token')
}

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  accessToken: null,          // ← in memory only
  refreshToken: null,         // ← in memory + sessionStorage (for cross-origin Vercel + Railway)
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
      // First, try to get user info using persisted access token
      const persistedToken = getAccessToken()
      if (persistedToken) {
        set({ accessToken: persistedToken })
      }
      
      const { data } = await authAPI.me()
      set({ user: data, isAuthenticated: true, isLoading: false, isInitializing: false })
      // Start heartbeat if user is authenticated
      get().startHeartbeat()
    } catch (error) {
      // If /me fails (likely 401/403 due to missing access token after refresh),
      // try to refresh the access token using the refresh token
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        try {
          // Get refresh token from sessionStorage (survives page reload for cross-origin)
          const refreshTokenFromStorage = getRefreshToken()

          // Attempt silent refresh using refresh token (body or cookie)
          const { data: refreshData } = await authAPI.refresh(refreshTokenFromStorage)

          // If refresh succeeds, store the new tokens and fetch user info
          if (refreshData?.access_token) {
            // Save new refresh token to sessionStorage if rotated
            if (refreshData.refresh_token) {
              saveRefreshToken(refreshData.refresh_token)
            }
            // Save access token to sessionStorage
            saveAccessToken(refreshData.access_token)
            set({
              accessToken: refreshData.access_token,
              refreshToken: refreshData.refresh_token || refreshTokenFromStorage,
            })
            const { data: userData } = await authAPI.me()
            set({ user: userData, isAuthenticated: true, isLoading: false, isInitializing: false })
            // Start heartbeat if user is authenticated
            get().startHeartbeat()
            return
          }
        } catch (refreshError) {
          // Refresh failed - session truly expired, clear everything
          clearRefreshToken()
          clearAccessToken()
        }
      }

      // Either not a 401/403 error, or refresh also failed - clear session
      clearRefreshToken()
      clearAccessToken()
      set({ user: null, isAuthenticated: false, isLoading: false, isInitializing: false, accessToken: null, refreshToken: null, mfaState: null })
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
        console.warn('Heartbeat failed, stopping interval')
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

    // Store access token in memory and sessionStorage, refresh token in memory + sessionStorage
    saveAccessToken(data.access_token)
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
    try { await authAPI.logout() } catch {}
    // Stop heartbeat before clearing session
    get().stopHeartbeat()
    clearRefreshToken()
    clearAccessToken()
    set({
      accessToken: null,
      user: null,
      isAuthenticated: false,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })
  },

  clearSession: () => {
    // Stop heartbeat before clearing session
    get().stopHeartbeat()
    clearRefreshToken()
    clearAccessToken()
    set({
      accessToken: null,
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
