import { useState } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Bell, Calendar, Inbox, AlertTriangle,
  Users, Group, MapPin, FileText, Settings, LogOut,
  ChevronLeft, ChevronRight, Zap
} from 'lucide-react'
import { cn, getInitials } from '@/utils/helpers'
import toast from 'react-hot-toast'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import useAuthStore from '@/store/authStore'

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/dashboard' },
  { label: 'COMMUNICATION', header: true },
  {
    label: 'Incoming Messages', icon: Inbox, to: '/incoming',
    customActive: (pathname, search) => pathname === '/incoming',
  },
  {
    label: 'Notifications', icon: Bell, to: '/notifications',
    customActive: (pathname, search) =>
      pathname.startsWith('/notifications') && !new URLSearchParams(search).has('status'),
  },
  {
    label: 'Scheduled', icon: Calendar, to: '/notifications?status=scheduled',
    customActive: (pathname, search) =>
      pathname === '/notifications' && new URLSearchParams(search).get('status') === 'scheduled',
  },
  { label: 'INCIDENTS', header: true },
  {
    label: 'Active Incidents', icon: AlertTriangle, to: '/incidents?status=active',
    customActive: (pathname, search) =>
      pathname === '/incidents' && new URLSearchParams(search).get('status') === 'active',
  },
  { label: 'SETTINGS', header: true },
  { label: 'People', icon: Users, to: '/people' },
  { label: 'Groups', icon: Group, to: '/groups' },
  { label: 'Locations', icon: MapPin, to: '/locations' },
  { label: 'Templates', icon: FileText, to: '/templates' },
  { label: 'My Account', icon: Settings, to: '/settings' },
]

// Render navigation item
function NavItem({ item, sidebarOpen, location }) {
  const Icon = item.icon
  
  if (item.header) {
    return sidebarOpen ? (
      <div className="px-2 pt-4 pb-1 text-[10px] font-semibold tracking-widest text-slate-600 uppercase">
        {item.label}
      </div>
    ) : <div className="my-2 border-t border-surface-700/40" />
  }
  
  const isActive = item.customActive
    ? item.customActive(location.pathname, location.search)
    : false
  
  return (
    <NavLink
      to={item.to}
      className={() => cn(
        'nav-item',
        isActive && 'active',
        !sidebarOpen && 'justify-center'
      )}
    >
      <Icon size={16} className="shrink-0" />
      {sidebarOpen && <span>{item.label}</span>}
    </NavLink>
  )
}

// User profile section for expanded sidebar
function UserProfileExpanded({ user, onLogout, onNavigateSettings }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            onClick={onNavigateSettings}
            className="w-full flex items-center gap-3 rounded-lg p-2 hover:bg-surface-800 transition-colors text-left cursor-pointer"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onNavigateSettings()
              }
            }}
            aria-label="Open account settings"
          >
            <div className="w-8 h-8 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {getInitials(user?.full_name || user?.email || 'U')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-200 truncate">{user?.full_name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.role?.replaceAll('_', ' ')}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onLogout()
              }}
              className="text-slate-500 hover:text-danger-400 hover:bg-danger-900/20 p-1.5 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
              type="button"
            >
              <LogOut size={15} />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-surface-800 border-surface-700 text-slate-200">
          <div className="text-center">
            <div className="font-medium">{user?.full_name}</div>
            <div className="text-xs text-slate-400">{user?.role?.replaceAll('_', ' ')}</div>
            <div className="text-xs text-slate-500 mt-1">Click to view profile</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// User profile section for collapsed sidebar
function UserProfileCollapsed({ user, onLogout }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onLogout}
            className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-surface-800 text-slate-400 hover:text-danger-400 transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={18} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-surface-800 border-surface-700 text-slate-200">
          <div className="text-center">
            <div className="font-medium">{user?.full_name}</div>
            <div className="text-xs text-slate-400">{user?.role?.replaceAll('_', ' ')}</div>
            <div className="text-xs text-slate-500 mt-1">Click to logout</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Sidebar toggle button component
function SidebarToggleButton({ sidebarOpen, onToggle }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onToggle}
            className={cn(
              'absolute -right-11 top-0 z-20 flex items-center justify-center shrink-0',
              'w-11 h-11 min-w-[44px] min-h-[44px]',
              'rounded-lg',
              'bg-surface-900 border border-surface-700/60',
              'text-slate-400 hover:text-slate-200 hover:bg-surface-800',
              'active:bg-surface-700 active:text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-900',
              'transition-all duration-200 ease-in-out',
              'shadow-lg'
            )}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? <ChevronLeft size={20} strokeWidth={2} /> : <ChevronRight size={20} strokeWidth={2} />}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="bg-surface-800 border-surface-700 text-slate-200">
          {sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default function Sidebar({ collapsed: controlledCollapsed, onCollapse }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [internalCollapsed, setInternalCollapsed] = useState(false)

  const isControlled = controlledCollapsed !== undefined
  const sidebarOpen = isControlled ? !controlledCollapsed : !internalCollapsed
  const setSidebarOpen = isControlled
    ? (open) => onCollapse?.(!open)
    : setInternalCollapsed

  const handleLogout = async () => {
    await logout()
    toast.success('Logged out')
    navigate('/login')
  }

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className="relative h-full shrink-0">
      {/* Mobile overlay backdrop */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-surface-950/60 backdrop-blur-sm z-40"
          onClick={toggleSidebar}
        />
      )}

      {/* Toggle Button - Outside sidebar at top-right (desktop and mobile) */}
      <SidebarToggleButton sidebarOpen={sidebarOpen} onToggle={toggleSidebar} />

      {/* Sidebar */}
      <aside className={cn(
        'flex flex-col h-full bg-surface-900 border-r border-surface-700/60 transition-all duration-300 relative z-50',
        sidebarOpen ? 'w-60' : 'w-16',
        // Mobile: fixed overlay positioning
        'lg:relative lg:translate-x-0',
        !sidebarOpen && 'lg:w-16',
        'fixed left-0 top-0 lg:static'
      )}>
        {/* Logo */}
        {sidebarOpen ? (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center px-4 h-14 border-b border-surface-700/60 shrink-0 hover:bg-surface-800/50 transition-colors w-full text-left"
            title="Go to Dashboard"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-danger-600 flex items-center justify-center shrink-0 shadow-glow-red">
                <Zap size={16} className="text-white" fill="white" />
              </div>
              <span className="font-display font-700 text-white text-lg tracking-tight whitespace-nowrap">
                TM Alert
              </span>
            </div>
          </button>
        ) : (
          <button
            onClick={() => navigate('/dashboard')}
            className="flex flex-col items-center justify-center py-3 border-b border-surface-700/60 shrink-0 hover:bg-surface-800/50 transition-colors w-full"
            title="Go to Dashboard"
          >
            <div className="w-11 h-11 rounded-lg bg-danger-600 flex items-center justify-center shrink-0 shadow-glow-red">
              <Zap size={20} className="text-white" fill="white" />
            </div>
          </button>
        )}

      {/* New Notification CTA */}
      <div className={cn('p-3', !sidebarOpen && 'px-2')}>
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
      <nav className={cn(
        'flex-1 overflow-y-auto px-3 space-y-0.5',
        !sidebarOpen && 'px-2'
      )}>
        {NAV.map((item, i) => (
          <NavItem key={i} item={item} sidebarOpen={sidebarOpen} location={location} />
        ))}
      </nav>

      {/* User profile - sticks to bottom */}
      <div className="mt-auto p-3 border-t border-surface-700/60">
        {sidebarOpen ? (
          <UserProfileExpanded 
            user={user} 
            onLogout={handleLogout}
            onNavigateSettings={() => navigate('/settings')}
          />
        ) : (
          <UserProfileCollapsed user={user} onLogout={handleLogout} />
        )}
      </div>
    </aside>
    </div>
  )
}
