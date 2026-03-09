import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Phone, RefreshCw } from 'lucide-react'
import api from '@/services/api'
import { timeAgo, channelIcon, channelLabel, cn } from '@/utils/helpers'

export default function IncomingPage() {
  const { data: messages = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['incoming-messages'],
    queryFn: () => api.get('/webhooks/incoming-messages?limit=100').then(r => r.data),
    refetchInterval: 10_000,
  })

  const grouped = messages.reduce((acc, m) => {
    const key = m.notification_id ? `notif-${m.notification_id}` : 'unlinked'
    if (!acc[key]) acc[key] = { label: m.notification_id ? `Notification #${m.notification_id}` : 'Unlinked Messages', items: [] }
    acc[key].items.push(m)
    return acc
  }, {})

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Incoming Messages</h1>
          <p className="text-slate-500 text-sm">Employee SMS replies and safety check-ins</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="btn-ghost"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-slate-500">Loading messages...</div>
      )}

      {!isLoading && messages.length === 0 && (
        <div className="card p-16 text-center">
          <MessageSquare size={32} className="text-slate-600 mx-auto mb-3" />
          <div className="text-slate-400 font-medium">No incoming messages yet</div>
          <div className="text-sm text-slate-500 mt-1">Employee replies will appear here when they respond to notifications</div>
        </div>
      )}

      {Object.entries(grouped).map(([key, group]) => (
        <div key={key} className="card overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-700/40 bg-surface-800/30">
            <h3 className="text-sm font-semibold text-slate-300">{group.label}</h3>
            <p className="text-xs text-slate-500">{group.items.length} message{group.items.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-surface-700/30">
            {group.items.map(msg => (
              <div key={msg.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-surface-800/40 transition-colors">
                {/* Channel icon */}
                <div className="w-9 h-9 rounded-full bg-surface-700 flex items-center justify-center text-lg shrink-0">
                  {channelIcon(msg.channel)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium text-slate-200">
                      {msg.user_name || msg.from_number}
                    </span>
                    {msg.user_name && (
                      <span className="text-xs text-slate-500 font-mono">{msg.from_number}</span>
                    )}
                    <span className="text-xs text-slate-600 ml-auto">{timeAgo(msg.received_at)}</span>
                  </div>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    {msg.body || <span className="italic text-slate-600">No body</span>}
                  </p>
                </div>

                {/* Status */}
                <div className="shrink-0">
                  <span className={msg.is_processed ? 'badge-green' : 'badge-gray'}>
                    {msg.is_processed ? 'Processed' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Legend */}
      {messages.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-slate-500 pt-2">
          <span>Responses: <span className="text-white font-medium">{messages.filter(m => m.is_processed).length}</span> processed</span>
          <span>Unprocessed: <span className="text-warning-400 font-medium">{messages.filter(m => !m.is_processed).length}</span></span>
          <span>Auto-refreshes every 10 seconds</span>
        </div>
      )}
    </div>
  )
}
