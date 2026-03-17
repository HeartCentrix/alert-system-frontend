import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom'
import { Bell, Send, XCircle, ChevronRight, ChevronLeft, Users, CheckCircle2, AlertCircle, Clock, Shield, AlertTriangle } from 'lucide-react'
import { notificationsAPI } from '@/services/api'
import { timeAgo, statusColor, channelIcon, channelLabel, responseColor, cn } from '@/utils/helpers'
import toast from 'react-hot-toast'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useIsDocumentVisible } from '@/hooks/useVisibility'
import { useForm } from 'react-hook-form'

const PAGE_SIZE = 20

// Helper function to mask PII data
function maskPII(address) {
  if (!address) return '—'
  
  // Check if it's an email (contains @)
  if (address.includes('@')) {
    const [local, domain] = address.split('@')
    if (local.length <= 2) {
      return `${local[0]}**@${domain}`
    }
    return `${local[0]}${'*'.repeat(Math.min(local.length - 1, 3))}${local.slice(-1)}@${domain}`
  }
  
  // Phone number - show last 4 digits
  const digits = address.replace(/\D/g, '')
  if (digits.length >= 4) {
    return `***-***-${digits.slice(-4)}`
  }
  return '***-***-****'
}

export function NotificationsListPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const isVisible = useIsDocumentVisible()
  // Derive the active filter directly from the URL — this is the single source
  // of truth. Using useState would only capture the initial value on mount and
  // would NOT update when the sidebar navigates to a different query string
  // (same route = no remount = useState initializer never re-runs).
  const status = searchParams.get('status') || ''
  const page = parseInt(searchParams.get('page') || '1')

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', status, page],
    queryFn: () => notificationsAPI.list({
      status: status || undefined,
      page,
      page_size: PAGE_SIZE
    }).then(r => r.data),
    refetchInterval: isVisible ? 15000 : false,
  })

  const statuses = ['', 'sent', 'sending', 'scheduled', 'draft', 'failed', 'partially_sent']
  // Handle both array response and paginated response { items, total }
  const notifications = Array.isArray(data) ? data : (data?.items || [])
  const total = Array.isArray(data) ? data.length : (data?.total || 0)
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams)
    if (newPage > 1) {
      params.set('page', newPage.toString())
    } else {
      params.delete('page')
    }
    setSearchParams(params)
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Notifications</h1>
          <p className="text-slate-500 text-sm">
            {total > 0
              ? `${total} notification${total !== 1 ? 's' : ''}`
              : 'All sent and scheduled notifications'}
          </p>
        </div>
        <button onClick={() => navigate('/notifications/new')} className="btn-primary w-full sm:w-auto justify-center">
          <Bell size={14} /> <span className="hidden xs:inline">+ New Notification</span><span className="xs:hidden">New Alert</span>
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-surface-900 rounded-lg border border-surface-700/60 w-fit max-w-full overflow-x-auto">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => {
              const params = new URLSearchParams()
              if (s) params.set('status', s)
              setSearchParams(params)
            }}
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
        <div className="table-responsive">
          <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-surface-700/60">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Notification</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Channels</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Recipients</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Created</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td></tr>
            )}
            {!isLoading && notifications.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No notifications found</td></tr>
            )}
            {notifications.map(n => (
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
                <td className="px-3 py-3.5 text-xs text-slate-500">
                  {timeAgo(n.created_at)}
                </td>
                <td className="px-3 py-3.5">
                  <ChevronRight size={14} className="text-slate-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-5 py-3 border-t border-surface-700/40 flex flex-col sm:flex-row items-center gap-3 sm:gap-0 justify-between">
            <div className="text-xs text-slate-500 text-center sm:text-left">
              Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} results
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <button
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
                className="btn-ghost py-1.5 px-3 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={14} /> <span className="hidden xs:inline">Previous</span>
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={cn(
                      'w-8 h-8 rounded-md text-xs font-medium transition-all',
                      page === p
                        ? 'bg-surface-700 text-white'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800'
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
                className="btn-ghost py-1.5 px-3 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <span className="hidden xs:inline">Next</span> <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function NotificationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isVisible = useIsDocumentVisible()

  const { data: notification, refetch } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsAPI.get(id).then(r => r.data),
    refetchInterval: isVisible ? 5000 : false,
  })

  const { data: delivery } = useQuery({
    queryKey: ['delivery', id],
    queryFn: () => notificationsAPI.delivery(id).then(r => r.data),
    refetchInterval: isVisible ? 5000 : false,
  })

  const { data: responses } = useQuery({
    queryKey: ['responses', id],
    queryFn: () => notificationsAPI.responses(id).then(r => r.data),
    refetchInterval: isVisible ? 5000 : false,
  })

  const handleCancel = async () => {
    try {
      await notificationsAPI.cancel(id)
      toast.success('Notification cancelled')
      refetch()
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Cannot cancel this notification')
      toast.error(errorMessage || 'Cannot cancel this notification')
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <button onClick={() => navigate('/notifications')} className="btn-ghost py-1.5 px-3 text-xs shrink-0">
          <span className="hidden sm:inline">← Back</span><span className="sm:hidden">←</span>
        </button>
        <h1 className="font-display font-bold text-xl text-white flex-1 truncate">{notification.title}</h1>
        <span className={statusColor(notification.status)}>{notification.status}</span>
        {['draft', 'scheduled'].includes(notification.status) && (
          <button onClick={handleCancel} className="btn-ghost text-danger-400 hover:text-danger-300 py-1.5 px-3 text-xs shrink-0">
            <XCircle size={14} /> <span className="hidden sm:inline">Cancel</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: message + delivery */}
        <div className="lg:col-span-2 space-y-5">
          {/* Message */}
          <div className="card p-5">
            <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Message</h3>
            <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">{notification.message}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              {notification.channels?.map(ch => (
                <span key={ch} className="badge-gray">{channelIcon(ch)} {channelLabel(ch)}</span>
              ))}
            </div>
            {notification.status === 'scheduled' && notification.scheduled_at && (
              <div className="mt-4 p-3 bg-warning-900/20 border border-warning-700/50 rounded-lg">
                <div className="flex items-center gap-2 text-warning-400">
                  <Clock size={14} />
                  <span className="text-xs font-semibold uppercase tracking-wider">Scheduled For</span>
                </div>
                <div className="mt-1 text-sm text-warning-200">
                  {new Date(notification.scheduled_at).toLocaleString()} 
                  {notification.scheduled_timezone && (
                    <span className="text-warning-400 ml-1">({notification.scheduled_timezone})</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Delivery log */}
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-700/40">
              <h3 className="text-sm font-semibold text-white">Delivery Log</h3>
              <p className="text-xs text-slate-500">{delivery?.length || 0} entries</p>
            </div>
            <div className="max-h-72 overflow-auto">
              <table className="w-full min-w-[500px]">
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
                      <td className="px-4 py-2 text-slate-300 whitespace-nowrap">{log.user_name || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{channelIcon(log.channel)} {channelLabel(log.channel)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={cn(
                          'badge',
                          log.status === 'delivered' ? 'badge-green' :
                          log.status === 'sent' ? 'badge-blue' :
                          log.status === 'failed' ? 'badge-red' : 'badge-gray'
                        )}>{log.status}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-500 font-mono whitespace-nowrap">{maskPII(log.to_address)}</td>
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
                    <span className={responseColor(r.response_type)}>{r.response_type.replaceAll('_', ' ')}</span>
                    <span className="text-slate-400 truncate">{r.user_name}</span>
                    <span className="text-xs text-slate-600 ml-auto">{timeAgo(r.responded_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recipient response status table */}
          {notification.response_required && delivery && (
            <div className="card p-5">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Recipient Response Status</h3>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-surface-900">
                    <tr className="border-b border-surface-700/40">
                      <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">Person</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">Contact</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">Response</th>
                      <th className="text-left text-xs font-medium text-slate-500 px-3 py-2">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Build a map of user responses
                      const userResponses = {}
                      responses?.forEach(r => {
                        const key = r.user_id || r.user_email
                        console.log('Response:', r)
                        if (!userResponses[key] || new Date(r.responded_at) > new Date(userResponses[key].responded_at)) {
                          userResponses[key] = r
                        }
                      })

                      // Group delivery logs by user
                      const userDeliveries = {}
                      delivery.forEach(log => {
                        const key = log.user_id || log.user_email
                        console.log('Delivery:', log)
                        if (!userDeliveries[key]) {
                          userDeliveries[key] = { name: log.user_name, email: log.user_email, logs: [] }
                        }
                        userDeliveries[key].logs.push(log)
                      })
                      
                      console.log('userResponses:', userResponses)
                      console.log('userDeliveries:', userDeliveries)
                      
                      return Object.entries(userDeliveries).map(([key, userData]) => {
                        const response = userResponses[key]
                        const hasResponded = !!response
                        return (
                          <tr key={key} className={cn(
                            "border-b border-surface-800/40",
                            !hasResponded && "bg-danger-900/10"
                          )}>
                            <td className="px-3 py-2 text-sm text-slate-300">{userData.name || '—'}</td>
                            <td className="px-3 py-2 text-xs text-slate-500 font-mono">
                              {userData.logs[0]?.to_address || userData.email || '—'}
                            </td>
                            <td className="px-3 py-2">
                              {hasResponded ? (
                                <span className={cn(
                                  'badge text-xs',
                                  response.response_type === 'safe' ? 'badge-green' :
                                  response.response_type === 'need_help' ? 'badge-red' : 'badge-gray'
                                )}>
                                  {response.response_type.replaceAll('_', ' ')}
                                </span>
                              ) : (
                                <span className="badge badge-red text-xs">No Response</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {hasResponded ? timeAgo(response.responded_at) : '—'}
                            </td>
                          </tr>
                        )
                      })
                    })()}
                  </tbody>
                </table>
              </div>
              {!delivery?.length && (
                <div className="text-center py-4 text-slate-500 text-sm">No delivery logs yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── SAFETY RESPONSE PAGE (from email/SMS link) ───────────────────────────────

export function SafetyRespondPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit } = useForm({
    defaultValues: { response_type: 'safe' }
  })

  const { data: notification, isLoading, refetch } = useQuery({
    queryKey: ['notification', id],
    queryFn: () => notificationsAPI.get(id).then(r => r.data),
    enabled: !!id && !!token,
  })

  const [tokenValid, setTokenValid] = useState(false)
  const [tokenError, setTokenError] = useState('')

  useEffect(() => {
    if (!token) {
      setTokenError('Missing response token. Please click the link from your notification.')
      return
    }

    if (token && token.length > 20) {
      setTokenValid(true)
    } else {
      setTokenError('Invalid or expired token. Please request a new notification.')
    }
  }, [token])

  const submitMutation = useMutation({
    mutationFn: (data) => {
      return notificationsAPI.respond(id, data, token)
    },
    onSuccess: () => {
      toast.success('✓ Your safety response has been recorded!')
      // Refresh notification data to show updated status
      refetch()
      // Redirect to a success page after short delay
      setTimeout(() => {
        navigate('/responded', { state: { notificationTitle: notification?.title } })
      }, 1500)
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || 'Failed to submit response'
      
      if (errorMessage.includes('already submitted')) {
        toast.error('You have already submitted your response.')
        // Redirect to success page since they already responded
        setTimeout(() => {
          navigate('/responded', { state: { notificationTitle: notification?.title } })
        }, 2000)
      } else {
        toast.error(errorMessage)
      }
    },
  })

  const onSubmit = (data) => {
    setLoading(true)
    submitMutation.mutate(data, {
      onSettled: () => setLoading(false)
    })
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading notification...</p>
        </div>
      </div>
    )
  }

  if (!tokenValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="max-w-md w-full card p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-danger-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-white mb-2">Invalid or Expired Link</h1>
          <p className="text-slate-400 mb-6">{tokenError}</p>
          <button onClick={() => navigate('/')} className="btn-primary w-full">
            Go to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-900 to-surface-800 p-4">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-500/20 mb-4">
            <Shield className="w-8 h-8 text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Safety Check-In Required</h1>
          <p className="text-slate-400">
            Please confirm your safety status for: <span className="text-white font-medium">{notification?.title}</span>
          </p>
        </div>

        {/* Response Form */}
        <div className="card p-6">
          {notification?.message && (
            <div className="mb-6 p-4 bg-surface-800 rounded-lg border border-surface-700">
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{notification.message}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-3">
                What is your current status?
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className={cn(
                  "relative flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:border-success-500/50",
                  "has-[:checked]:border-success-500 has-[:checked]:bg-success-500/10"
                )}>
                  <input
                    type="radio"
                    value="safe"
                    {...register('response_type')}
                    className="sr-only"
                    defaultChecked
                  />
                  <div className="text-center">
                    <CheckCircle2 className="w-8 h-8 text-success-500 mx-auto mb-2" />
                    <div className="text-sm font-medium text-success-400">I'm Safe</div>
                    <div className="text-xs text-slate-500 mt-1">Everything is OK</div>
                  </div>
                </label>

                <label className={cn(
                  "relative flex items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all",
                  "hover:border-danger-500/50",
                  "has-[:checked]:border-danger-500 has-[:checked]:bg-danger-500/10"
                )}>
                  <input
                    type="radio"
                    value="need_help"
                    {...register('response_type')}
                    className="sr-only"
                  />
                  <div className="text-center">
                    <AlertCircle className="w-8 h-8 text-danger-500 mx-auto mb-2" />
                    <div className="text-sm font-medium text-danger-400">Need Help</div>
                    <div className="text-xs text-slate-500 mt-1">Require assistance</div>
                  </div>
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || submitMutation.isLoading}
              className="w-full btn-primary py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Submitting...' : 'Submit Response'}
            </button>

            <p className="text-xs text-slate-500 text-center">
              Your response will be recorded and visible to administrators
            </p>
          </form>
        </div>

        {/* Footer info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            Having trouble? Contact your administrator or try refreshing the page.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── SUCCESS PAGE (after responding) ────────────────────────────────────────

export function RespondedSuccessPage() {
  const location = useLocation()
  const notificationTitle = location.state?.notificationTitle

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-surface-900 to-surface-800 p-4">
      <div className="max-w-md w-full text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success-500/20 mb-6">
          <CheckCircle2 className="w-12 h-12 text-success-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Response Recorded!</h1>
        <p className="text-slate-400 mb-2">
          {notificationTitle 
            ? `Your safety check-in for "${notificationTitle}" has been submitted.`
            : 'Your safety response has been successfully recorded.'}
        </p>
        <p className="text-slate-500 text-sm mt-6">
          You can close this window or return to the dashboard.
        </p>
      </div>
    </div>
  )
}
