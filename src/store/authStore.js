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
    } catch {
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await authAPI.login(email, password)
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    set({ user: data.user, isAuthenticated: true })
    return data
  },

  logout: async () => {
    const refresh_token = localStorage.getItem('refresh_token')
    try { await authAPI.logout(refresh_token) } catch {}
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    set({ user: null, isAuthenticated: false })
  },
}))

export default useAuthStore
