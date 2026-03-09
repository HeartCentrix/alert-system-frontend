import { create } from 'zustand'
import { authAPI } from '@/services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  init: async () => {
    const token = localStorage.getItem('access_token')
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
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, isAuthenticated: false, isLoading: false })
      } else {
        // Network error or server error - keep tokens and try again later
        set({ isLoading: false })
      }
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)
    if (!data?.access_token) {
      throw new Error('No token received from server')
    }
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user, isAuthenticated: true, isLoading: false })
    return data
  },

  logout: async () => {
    const refresh_token = localStorage.getItem('refresh_token')
    try { await authAPI.logout(refresh_token) } catch {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },

  updateUser: (updatedUser) => {
    set({ user: updatedUser })
  },
}))

export default useAuthStore
