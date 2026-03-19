import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { MessageSquare, Phone, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '@/services/api'
import { timeAgo, channelIcon, channelLabel, cn } from '@/utils/helpers'
import { useIsDocumentVisible } from '@/hooks/useVisibility'

const PAGE_SIZE = 10

export default function IncomingPage() {
  const isVisible = useIsDocumentVisible()
  const [page, setPage] = useState(1)

  const { data: allMessages = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['incoming-messages'],
    queryFn: () => api.get('/webhooks/incoming-messages?limit=500').then(r => r.data),
    refetchInterval: isVisible ? 10_000 : false,
    refetchOnWindowFocus: true,
  })

  const handleExportCSV = async () => {
    if (!allMessages || allMessages.length === 0) {
      toast.error('No messages to export')
      return
    }

    try {
      // Fetch all messages for export (in case there are more than loaded)
      const messages = allMessages

      const headers = ['ID', 'Notification ID', 'From Number', 'User Name', 'Channel', 'Body', 'Received At', 'Processed']
      const rows = messages.map(msg => [
        msg.id,
        msg.notification_id || '',
        msg.from_number || '',
        msg.user_name || '',
        msg.channel || '',
        `"${(msg.body || '').replace(/"/g, '""')}"`,
        msg.received_at || '',
        msg.is_processed ? 'Yes' : 'No'
      ])

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `incoming-messages-${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  // Group all messages
  const allGrouped = allMessages.reduce((acc, m) => {
    const key = m.notification_id ? `notif-${m.notification_id}` : 'unlinked'
    if (!acc[key]) acc[key] = { label: m.notification_id ? `Notification #${m.notification_id}` : 'Unlinked Messages', items: [] }
    acc[key].items.push(m)
    return acc
  }, {})

  // Flatten grouped messages for pagination
  const flatMessages = Object.entries(allGrouped).flatMap(([key, group]) => 
    group.items.map(msg => ({ ...msg, groupKey: key, groupLabel: group.label }))
  )

  // Paginate messages
  const totalPages = Math.ceil(flatMessages.length / PAGE_SIZE) || 1
  const currentPage = Math.min(page, totalPages)
  const paginatedMessages = flatMessages.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Re-group paginated messages for display
  const grouped = paginatedMessages.reduce((acc, m) => {
    const key = m.groupKey
    if (!acc[key]) acc[key] = { label: m.groupLabel, items: [] }
    acc[key].items.push(m)
    return acc
  }, {})

  const handlePageChange = (newPage) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)))
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Incoming Messages</h1>
          <p className="text-slate-500 text-sm">Employee SMS replies and safety check-ins</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            disabled={!allMessages || allMessages.length === 0}
            className="btn-ghost"
            title="Export messages to CSV"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            onClick={() => { refetch(); setPage(1); }}
            disabled={isFetching}
            className="btn-ghost"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-16 text-slate-500">Loading messages...</div>
      )}

      {!isLoading && allMessages.length === 0 && (
        <div className="card p-16 text-center">
          <MessageSquare size={32} className="text-slate-600 mx-auto mb-3" />
          <div className="text-slate-400 font-medium">No incoming messages yet</div>
          <div className="text-sm text-slate-500 mt-1">Employee replies will appear here when they respond to notifications</div>
        </div>
      )}

      {!isLoading && allMessages.length > 0 && (
        <>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="card px-5 py-3 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, flatMessages.length)} of {flatMessages.length} messages
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
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
                        currentPage === p
                          ? 'bg-surface-700 text-white'
                          : 'text-slate-500 hover:text-slate-300 hover:bg-surface-800'
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="btn-ghost py-1.5 px-3 text-xs disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <span className="hidden xs:inline">Next</span> <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Legend */}
      {allMessages.length > 0 && (
        <div className="flex items-center gap-6 text-xs text-slate-500 pt-2">
          <span>Responses: <span className="text-white font-medium">{allMessages.filter(m => m.is_processed).length}</span> processed</span>
          <span>Unprocessed: <span className="text-warning-400 font-medium">{allMessages.filter(m => !m.is_processed).length}</span></span>
          <span>Auto-refreshes every 10 seconds</span>
        </div>
      )}
    </div>
  )
}
