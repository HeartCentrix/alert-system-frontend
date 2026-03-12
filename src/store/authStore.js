import { create } from 'zustand'
import { authAPI } from '@/services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  accessToken: null,          // ← in memory only, never sessionStorage
  isInitializing: false,      // Prevent duplicate init calls
  // MFA state
  mfaState: null,
  mfaChallengeToken: null,
  mfaQRCodeURI: null,
  mfaSecret: null,

  init: async () => {
    // Prevent duplicate initialization
    if (get().isInitializing) return
    set({ isInitializing: true })

    try {
      const { data } = await authAPI.me()
      set({ user: data, isAuthenticated: true, isLoading: false, isInitializing: false })
    } catch (error) {
      set({ user: null, isAuthenticated: false, isLoading: false, isInitializing: false, accessToken: null, mfaState: null })
    }
  },

  setAccessToken: (token) => {
    set({ accessToken: token })
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

    // Store access token in memory only
    set({
      accessToken: data.access_token,
      user: data.user,
      isAuthenticated: true,
      isLoading: false,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })
    return data
  },

  verifyMFA: async (code) => {
    const { mfaChallengeToken } = get()
    if (!mfaChallengeToken) throw new Error('No MFA challenge token available')

    const { data } = await authAPI.verifyMFA(mfaChallengeToken, code)

    if (data?.recovery_codes && data.recovery_codes.length > 0) {
      set({
        accessToken: data.access_token,
        user: data.user,
        isAuthenticated: false,   // Keep false until recovery codes dismissed
        mfaState: null,
        mfaChallengeToken: null,
        mfaQRCodeURI: null,
      })
    } else {
      set({
        accessToken: data.access_token,
        user: data.user,
        isAuthenticated: true,
        mfaState: null,
        mfaChallengeToken: null,
        mfaQRCodeURI: null,
      })
    }
    return data
  },

  verifyMFAWithRecoveryCode: async (recoveryCode, challengeToken) => {
    const token = challengeToken || get().mfaChallengeToken
    if (!token) throw new Error('No challenge token available')

    const { data } = await authAPI.verifyMFAWithRecoveryCode(token, recoveryCode)

    set({
      accessToken: data.access_token,
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
