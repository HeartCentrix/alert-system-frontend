import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bell, Calendar, Inbox, AlertTriangle,
  Users, Group, MapPin, FileText, Settings, LogOut,
  Menu, X, ChevronDown, Zap, MessageSquare
} from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { cn, getInitials } from '@/utils/helpers'
import toast from 'react-hot-toast'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'COMMUNICATION', header: true },
  { label: 'Incoming Messages', icon: Inbox, to: '/incoming' },
  {
    label: 'Notifications', icon: Bell, to: '/notifications',
    // Active on /notifications, /notifications/new, /notifications/:id
    // but NOT when the scheduled filter query param is present
    customActive: (pathname, search) =>
      pathname.startsWith('/notifications') && search !== '?status=scheduled',
  },
  {
    label: 'Scheduled', icon: Calendar, to: '/notifications?status=scheduled',
    // Active only when on /notifications with the scheduled query param
    customActive: (pathname, search) =>
      pathname === '/notifications' && search === '?status=scheduled',
  },
  { label: 'INCIDENTS', header: true },
  { label: 'Active Incidents', icon: AlertTriangle, to: '/incidents' },
  { label: 'SETTINGS', header: true },
  { label: 'People', icon: Users, to: '/people' },
  { label: 'Groups', icon: Group, to: '/groups' },
  { label: 'Locations', icon: MapPin, to: '/locations' },
  { label: 'Templates', icon: FileText, to: '/templates' },
  { label: 'My Account', icon: Settings, to: '/settings' },
]

export default function AppLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface-950">
      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col bg-surface-900 border-r border-surface-700/60 transition-all duration-300 shrink-0',
        sidebarOpen ? 'w-60' : 'w-16'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-3 h-14 border-b border-surface-700/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-danger-600 flex items-center justify-center shrink-0 shadow-glow-red">
              <Zap size={16} className="text-white" fill="white" />
            </div>
            {sidebarOpen && (
              <span className="font-display font-700 text-white text-lg tracking-tight whitespace-nowrap">
                TM Alert
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-slate-500 hover:text-slate-300 transition-colors shrink-0"
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>

        {/* New Notification CTA */}
        <div className="p-3">
          <button
            onClick={() => navigate('/notifications/new')}
            className={cn(
              'w-full flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white rounded-lg',
              'font-medium text-sm transition-all duration-150 active:scale-[0.98] shadow-sm',
              sidebarOpen ? 'px-3 py-2.5' : 'justify-center p-2.5'
            )}
          >
            <Bell size={15} />
            {sidebarOpen && <span>+ New Notification</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {NAV.map((item, i) => {
            if (item.header) {
              return sidebarOpen ? (
                <div key={i} className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-slate-600 uppercase">
                  {item.label}
                </div>
              ) : <div key={i} className="my-2 border-t border-surface-700/40" />
            }
            const Icon = item.icon
            // Items with customActive bypass NavLink's path-only matching.
            // IMPORTANT: className must be a FUNCTION, not a string — when NavLink
            // receives a string it auto-appends "active" based on pathname-only
            // matching (ignoring query strings), which causes both Notifications
            // and Scheduled to highlight simultaneously.
            if (item.customActive) {
              const active = item.customActive(location.pathname, location.search)
              return (
                <NavLink
                  key={i}
                  to={item.to}
                  className={() => cn('nav-item', active && 'active')}
                >
                  <Icon size={16} className="shrink-0" />
                  {sidebarOpen && <span>{item.label}</span>}
                </NavLink>
              )
            }
            return (
              <NavLink
                key={i}
                to={item.to}
                className={({ isActive }) => cn(
                  'nav-item',
                  isActive && 'active'
                )}
              >
                <Icon size={16} className="shrink-0" />
                {sidebarOpen && <span>{item.label}</span>}
              </NavLink>
            )
          })}
        </nav>

        {/* User profile */}
        <div className="p-3 border-t border-surface-700/60">
          <div className={cn(
            'flex items-center gap-3 rounded-lg p-2 hover:bg-surface-800 cursor-pointer transition-colors',
            !sidebarOpen && 'justify-center'
          )}>
            <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {getInitials(user?.full_name || user?.email || 'U')}
            </div>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">{user?.full_name}</div>
                <div className="text-xs text-slate-500 truncate">{user?.role?.replace('_', ' ')}</div>
              </div>
            )}
            {sidebarOpen && (
              <button onClick={handleLogout} className="text-slate-500 hover:text-danger-400 transition-colors">
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

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
