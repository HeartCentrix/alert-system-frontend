import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Bell, Send, XCircle, ChevronRight, Users, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { notificationsAPI } from '@/services/api'
import { timeAgo, statusColor, channelIcon, channelLabel, responseColor, cn } from '@/utils/helpers'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

export function NotificationsListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  // Derive the active filter directly from the URL — this is the single source
  // of truth. Using useState would only capture the initial value on mount and
  // would NOT update when the sidebar navigates to a different query string
  // (same route = no remount = useState initializer never re-runs).
  const status = searchParams.get('status') || ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', status],
    queryFn: () => notificationsAPI.list({ status: status || undefined }).then(r => r.data),
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchIntervalInBackground: true, // Refetch even when tab is not focused
    staleTime: 0, // Data is always considered stale
  })

  const statuses = ['', 'sent', 'sending', 'scheduled', 'draft', 'failed', 'partially_sent']

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Notifications</h1>
          <p className="text-slate-500 text-sm">All sent and scheduled notifications</p>
        </div>
        <button onClick={() => navigate('/notifications/new')} className="btn-primary">
          <Bell size={14} /> + New Notification
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-surface-900 rounded-lg border border-surface-700/60 w-fit">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => s ? setSearchParams({ status: s }) : setSearchParams({})}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              status === s ? 'bg-surface-700 text-white' : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/60">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Notification</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Channels</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Recipients</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Sent</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td></tr>
            )}
            {!isLoading && !data?.length && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No notifications found</td></tr>
            )}
            {data?.map(n => (
              <tr
                key={n.id}
                className="table-row cursor-pointer"
                onClick={() => navigate(`/notifications/${n.id}`)}
              >
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-200 text-sm">{n.title}</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">{n.message?.slice(0, 80)}...</div>
                </td>
                <td className="px-3 py-3.5">
                  <span className={statusColor(n.status)}>{n.status}</span>
                </td>
                <td className="px-3 py-3.5">
                  <div className="flex gap-1">
                    {n.channels?.map(ch => (
                      <span key={ch} title={channelLabel(ch)} className="text-sm">{channelIcon(ch)}</span>
                    ))}
                  </div>
                </td>
                <td className="px-3 py-3.5 text-sm">
                  <div className="text-slate-300">{n.total_recipients} total</div>
                  <div className="text-xs text-slate-500">{n.sent_count} sent · {n.failed_count} failed</div>
                </td>
                <td className="px-3 py-3.5 text-xs text-slate-500">{timeAgo(n.sent_at || n.created_at)}</td>
                <td className="px-3 py-3.5">
                  <ChevronRight size={14} className="text-slate-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function NotificationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: notification, refetch } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsAPI.get(id).then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  const { data: delivery } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => notificationsAPI.delivery(id).then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  const { data: responses } = useQuery({
    queryKey: ['responses', id],
    queryFn: () => notificationsAPI.responses(id).then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    staleTime: 0,
  })

  const handleCancel = async () => {
    try {
      await notificationsAPI.cancel(id)
      toast.success('Notification cancelled')
      refetch()
    } catch (err) {
      toast.error('Cannot cancel this notification')
    }
  }

  if (!notification) return <div className="text-slate-500 p-8">Loading...</div>

  const stats = notification.delivery_stats || {}
  const respStats = notification.response_stats || {}

  const pieData = [
    { name: 'Safe', value: respStats.safe || 0, color: '#22c55e' },
    { name: 'Need Help', value: respStats.need_help || 0, color: '#ef4444' },
    { name: 'No Response', value: (notification.total_recipients || 0) - (respStats.total || 0), color: '#475569' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/notifications')} className="btn-ghost py-1.5 px-3 text-xs">← Back</button>
        <h1 className="font-display font-bold text-xl text-white flex-1">{notification.title}</h1>
        <span className={statusColor(notification.status)}>{notification.status}</span>
        {['draft', 'scheduled'].includes(notification.status) && (
          <button onClick={handleCancel} className="btn-ghost text-danger-400 hover:text-danger-300 py-1.5 px-3 text-xs">
            <XCircle size={14} /> Cancel
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Left: message + delivery */}
        <div className="col-span-2 space-y-5">
          {/* Message */}
          <div className="card p-5">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Message</h3>
            <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{notification.message}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              {notification.channels?.map(ch => (
                <span key={ch} className="badge-gray">{channelIcon(ch)} {channelLabel(ch)}</span>
              ))}
            </div>
          </div>

          {/* Delivery log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-700/40">
              <h3 className="text-sm font-semibold text-white">Delivery Log</h3>
              <p className="text-xs text-slate-500">{delivery?.length || 0} entries</p>
            </div>
            <div className="max-h-72 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-surface-900">
                  <tr className="border-b border-surface-700/40">
                    <th className="text-left text-xs font-medium text-slate-500 px-4 py-2">Person</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">Channel</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">Status</th>
                    <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">To</th>
                  </tr>
                </thead>
                <tbody>
                  {delivery?.map(log => (
                    <tr key={log.id} className="table-row text-sm">
                      <td className="px-4 py-2 text-slate-300">{log.user_name || '—'}</td>
                      <td className="px-3 py-2">{channelIcon(log.channel)} {channelLabel(log.channel)}</td>
                      <td className="px-3 py-2">
                        <span className={cn(
                          'badge',
                          log.status === 'delivered' ? 'badge-green' :
                          log.status === 'sent' ? 'badge-blue' :
                          log.status === 'failed' ? 'badge-red' : 'badge-gray'
                        )}>{log.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono">{log.to_address}</td>
                    </tr>
                  ))}
                  {!delivery?.length && (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-500 text-sm">No delivery logs yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right: stats */}
        <div className="space-y-4">
          {/* Delivery stats */}
          <div className="card p-5">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Delivery Stats</h3>
            <div className="space-y-2">
              {[
                { label: 'Total', val: notification.total_recipients, color: 'text-slate-300' },
                { label: 'Sent', val: notification.sent_count, color: 'text-primary-400' },
                { label: 'Delivered', val: notification.delivered_count, color: 'text-success-400' },
                { label: 'Failed', val: notification.failed_count, color: 'text-danger-400' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{s.label}</span>
                  <span className={cn('font-bold', s.color)}>{s.val ?? 0}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Response stats */}
          {notification.response_required && (
            <div className="card p-5">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Safety Check-in</h3>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={60} dataKey="value">
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#94a3b8' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-4 text-slate-500 text-xs">Awaiting responses...</div>
              )}
              <div className="space-y-1 mt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-success-500" />Safe</span>
                  <span className="font-bold text-success-400">{respStats.safe || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-danger-500" />Need Help</span>
                  <span className="font-bold text-danger-400">{respStats.need_help || 0}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-slate-500" />No Response</span>
                  <span className="font-bold text-slate-400">{(notification.total_recipients || 0) - (respStats.total || 0)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Response list */}
          {responses?.length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Responses ({responses.length})</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {responses.map(r => (
                  <div key={r.id} className="flex items-center gap-2 text-sm">
                    <span className={responseColor(r.response_type)}>{r.response_type.replace('_', ' ')}</span>
                    <span className="text-slate-400 truncate">{r.user_name}</span>
                    <span className="text-xs text-slate-600 ml-auto">{timeAgo(r.responded_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
