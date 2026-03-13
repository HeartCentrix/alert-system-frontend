import { useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import useAuthStore from '@/store/authStore'
import toast from 'react-hot-toast'

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1024)

  useEffect(() => {
    const handleResize = () => {
      setSidebarCollapsed(window.innerWidth < 1024)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

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
        onCollapse={setSidebarCollapsed}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 bg-surface-900/80 border-b border-surface-700/60 backdrop-blur-sm flex items-center px-4 sm:px-6 gap-2 sm:gap-4 shrink-0">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="lg:hidden text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <div className="text-sm text-slate-400 font-medium hidden sm:block">Taylor Morrison</div>
          <div className="w-px h-4 bg-surface-600 hidden sm:block" />
          <div className="text-sm text-slate-300 truncate max-w-[150px] sm:max-w-none">{user?.full_name}</div>
          <button
            onClick={handleLogout}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors ml-2 shrink-0"
          >
            <span className="hidden sm:inline">Logout</span>
            <span className="sm:hidden">
              <LogOut size={14} />
            </span>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
