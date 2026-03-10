import { create } from 'zustand'
import { authAPI } from '@/services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  // MFA state
  mfaState: null, // null | 'setup_required' | 'challenge_required'
  mfaChallengeToken: null,
  mfaQRCodeURI: null,
  mfaSecret: null,  // Raw TOTP secret for manual entry

  init: async () => {
    const token = sessionStorage.getItem('access_token')
    if (!token) {
      set({ isLoading: false })
      return
    }
    try {
      const { data } = await authAPI.me()
      set({ user: data, isAuthenticated: true, isLoading: false })
    } catch (error) {
      console.error('Auth init failed:', error?.response?.status, error?.response?.data)
      // Only clear tokens on 401 (invalid token), not on network errors
      if (error?.response?.status === 401) {
        sessionStorage.removeItem('access_token')
        sessionStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false, isLoading: false, mfaState: null })
      } else {
        // Network error or server error - keep tokens and try again later
        set({ isLoading: false })
      }
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)
    
    console.log('[AuthStore] Login response:', data)
    console.log('[AuthStore] Response status:', data?.status)
    console.log('[AuthStore] Response mfa_configured:', data?.mfa_configured)
    
    // Check response type based on status field
    if (data.status === 'mfa_required') {
      console.log('[AuthStore] MFA required flow')
      // MFA is required - store state and let UI handle it
      if (!data.mfa_configured) {
        console.log('[AuthStore] Setting up MFA setup state')
        // User needs to set up MFA first
        set({
          mfaState: 'setup_required',
          mfaChallengeToken: data.challenge_token,
          mfaQRCodeURI: data.qr_code_uri,
          mfaSecret: data.secret,  // Store secret for manual entry
        })
      } else {
        console.log('[AuthStore] Setting up MFA challenge state')
        // User has MFA configured - just needs to enter code
        set({
          mfaState: 'challenge_required',
          mfaChallengeToken: data.challenge_token,
          mfaSecret: null,
        })
      }
      return data
    }
    
    // Normal login success
    console.log('[AuthStore] Normal login success')
    if (!data?.access_token) {
      throw new Error('No token received from server')
    }
    sessionStorage.setItem('access_token', data.access_token)
    sessionStorage.setItem('refresh_token', data.refresh_token)
    set({
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
    if (!mfaChallengeToken) {
      throw new Error('No MFA challenge token available')
    }

    const { data } = await authAPI.verifyMFA(mfaChallengeToken, code)

    // Success - store tokens in sessionStorage
    sessionStorage.setItem('access_token', data.access_token)
    sessionStorage.setItem('refresh_token', data.refresh_token)
    set({
      user: data.user,
      isAuthenticated: true,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
    })
    return data
  },

  verifyMFAWithRecoveryCode: async (recoveryCode, challengeToken) => {
    const token = challengeToken || get().mfaChallengeToken
    if (!token) {
      throw new Error('No challenge token available')
    }

    const { data } = await authAPI.verifyMFAWithRecoveryCode(token, recoveryCode)

    // Success - store tokens in sessionStorage
    sessionStorage.setItem('access_token', data.access_token)
    sessionStorage.setItem('refresh_token', data.refresh_token)
    set({
      user: data.user,
      isAuthenticated: true,
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
    })
    return data
  },

  clearMFAState: () => {
    set({
      mfaState: null,
      mfaChallengeToken: null,
      mfaQRCodeURI: null,
      mfaSecret: null,
    })
  },

  logout: async () => {
    const refresh_token = sessionStorage.getItem('refresh_token')
    try { await authAPI.logout(refresh_token) } catch {}
    sessionStorage.removeItem('access_token')
    sessionStorage.removeItem('refresh_token')
    set({
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

export default useAuthStore
