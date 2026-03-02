import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import useAuthStore from '@/store/authStore'
import toast from 'react-hot-toast'

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onCollapseChange={setSidebarCollapsed}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-surface-900/80 border-b border-surface-700/60 backdrop-blur-sm flex items-center px-6 gap-4 shrink-0">
          <div className="flex-1" />
          <div className="text-sm text-slate-400 font-medium">Taylor Morrison</div>
          <div className="w-px h-4 bg-surface-600" />
          <div className="text-sm text-slate-300">{user?.full_name}</div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-2"
          >
            Logout
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
