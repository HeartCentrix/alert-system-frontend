import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts'
import {
  Users, MapPin, AlertTriangle, Bell, TrendingUp,
  ArrowRight, CheckCircle2, Clock, XCircle, Shield
} from 'lucide-react'
import { dashboardAPI } from '@/services/api'
import LocationMap from '@/components/LocationMap'
import { timeAgo, severityColor, statusColor, formatDate } from '@/utils/helpers'
import { cn } from '@/utils/helpers'
import { useIsDocumentVisible } from '@/hooks/useVisibility'

const StatCard = ({ icon: Icon, label, value, sub, color = 'blue', onClick }) => (
  <div
    onClick={onClick}
    className={cn('stat-card', onClick && 'cursor-pointer hover:border-surface-500 transition-colors')}
  >
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</span>
      <div className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center',
        color === 'red' && 'bg-danger-600/20 text-danger-400',
        color === 'blue' && 'bg-primary-600/20 text-primary-400',
        color === 'green' && 'bg-success-600/20 text-success-400',
        color === 'orange' && 'bg-warning-600/20 text-warning-400',
      )}>
        <Icon size={16} />
      </div>
    </div>
    <div className="font-display font-bold text-3xl text-white">{value ?? '—'}</div>
    {sub && <div className="text-xs text-slate-500">{sub}</div>}
  </div>
)

const SeverityBlock = ({ label, count, color }) => (
  <div className={cn(
    'flex-1 rounded-xl p-4 border',
    color === 'red' && 'bg-danger-600/10 border-danger-600/30',
    color === 'orange' && 'bg-warning-600/10 border-warning-600/30',
    color === 'green' && 'bg-success-600/10 border-success-600/30',
  )}>
    <div className={cn(
      'font-display font-bold text-2xl',
      color === 'red' && 'text-danger-400',
      color === 'orange' && 'text-warning-400',
      color === 'green' && 'text-success-400',
    )}>{count} Threats</div>
    <div className="text-xs text-slate-500 mt-0.5">{label} Severity</div>
  </div>
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const isVisible = useIsDocumentVisible()

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardAPI.stats().then(r => r.data),
    refetchInterval: isVisible ? 10000 : false, // Refresh every 10s for real-time online status
  })

  const { data: mapData } = useQuery({
    queryKey: ['map-data'],
    queryFn: () => dashboardAPI.mapData().then(r => r.data),
    refetchInterval: isVisible ? 30000 : false, // Map data changes less frequently
  })

  const { data: activity } = useQuery({
    queryKey: ['activity'],
    queryFn: () => dashboardAPI.activity(7).then(r => r.data),
    refetchInterval: isVisible ? 60000 : false, // Activity stats change slowly
  })

  const chartData = activity?.map(d => ({
    date: new Date(d.date).toLocaleDateString('en', { weekday: 'short' }),
    notifications: d.count
  })) || []

  const recent = stats?.recent_notifications || []
  const incidents = stats?.recent_incidents || []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Taylor Morrison Emergency Operations</p>
        </div>
        <button
          onClick={() => navigate('/notifications/new')}
          className="btn-primary gap-2 w-full sm:w-auto justify-center"
        >
          <Bell size={15} />
          <span className="hidden xs:inline">+ New Notification</span>
          <span className="xs:hidden">New Alert</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users} label="Online Users" color="blue"
          value={stats?.online_users ?? 0}
          sub={`Registered Users : ${stats?.total_users ?? 0}`}
          onClick={() => navigate('/people')}
        />
        <StatCard
          icon={MapPin} label="Locations" color="green"
          value={stats?.total_locations ?? 0}
          sub="Active sites"
          onClick={() => navigate('/locations')}
        />
        <StatCard
          icon={AlertTriangle} label="Active Incidents" color="red"
          value={stats?.active_incidents ?? 0}
          sub="Requiring attention"
          onClick={() => navigate('/incidents?status=active')}
        />
        <StatCard
          icon={Bell} label="Sent Today" color="orange"
          value={stats?.notifications_today ?? 0}
          sub={`${stats?.notifications_this_week ?? 0} this week`}
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Audience map + activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Audience location card */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display font-semibold text-white">Audience Location</h2>
                <p className="text-xs text-slate-500">Quick view of your organization</p>
              </div>
              <button onClick={() => navigate('/locations')} className="btn-ghost text-xs py-1.5 px-3">
                View All <ArrowRight size={12} />
              </button>
            </div>

            {/* Leaflet Map */}
            {mapData?.locations?.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-slate-500 text-sm rounded-lg bg-surface-800/30">
                No locations configured yet
              </div>
            ) : (
              <LocationMap locations={mapData?.locations || []} height={280} onLocationClick={(id) => navigate(`/locations/${id}/members`)} />
            )}

            {/* Summary row */}
            <div className="mt-4 pt-4 border-t border-surface-700/40 flex flex-wrap gap-4 sm:gap-6">
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Total Groups</div>
                <div className="font-display font-bold text-xl text-white">{stats?.total_groups ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Total Addresses</div>
                <div className="font-display font-bold text-xl text-white">{stats?.total_locations ?? 0}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 uppercase tracking-wider">Registered Users</div>
                <div className="font-display font-bold text-xl text-white">{stats?.total_users ?? 0}</div>
              </div>
            </div>
          </div>

          {/* Activity chart */}
          <div className="card p-5">
            <h2 className="font-display font-semibold text-white mb-4">Notification Activity (7 days)</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#94a3b8' }}
                    itemStyle={{ color: '#60a5fa' }}
                  />
                  <Area type="monotone" dataKey="notifications" stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-slate-500 text-sm">
                No activity data yet
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent notifications + incidents */}
        <div className="space-y-6">
          {/* Active incidents */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-white">Active Incidents</h2>
              <button onClick={() => navigate('/incidents?status=active')} className="text-xs text-primary-400 hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {incidents.length === 0 && (
                <div className="text-center py-6">
                  <Shield size={24} className="text-success-500 mx-auto mb-2" />
                  <div className="text-xs text-slate-500">No active incidents</div>
                </div>
              )}
              {incidents.slice(0, 4).map(inc => (
                <div
                  key={inc.id}
                  onClick={() => navigate('/incidents?status=active')}
                  className="p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 cursor-pointer transition-colors border border-surface-700/30"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={severityColor(inc.severity)}>{inc.severity}</span>
                    <span className="text-xs text-slate-500">{timeAgo(inc.created_at)}</span>
                  </div>
                  <div className="text-sm text-slate-200 font-medium leading-snug">{inc.title}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent notifications */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display font-semibold text-white">Recent Notifications</h2>
              <button onClick={() => navigate('/notifications')} className="text-xs text-primary-400 hover:underline">
                View all
              </button>
            </div>
            <div className="space-y-2">
              {recent.length === 0 && (
                <div className="text-center py-6 text-slate-500 text-xs">No notifications yet</div>
              )}
              {recent.slice(0, 5).map(n => (
                <div
                  key={n.id}
                  onClick={() => navigate(`/notifications/${n.id}`)}
                  className="p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={statusColor(n.status)}>{n.status}</span>
                    <span className="text-xs text-slate-600">{timeAgo(n.created_at)}</span>
                  </div>
                  <div className="text-xs text-slate-300 font-medium truncate">{n.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {n.total_recipients} recipients · {n.sent_count} sent
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
