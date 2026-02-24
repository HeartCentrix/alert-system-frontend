import { clsx } from 'clsx'
import { formatDistanceToNow, format } from 'date-fns'

export const cn = (...args) => clsx(args)

export const timeAgo = (date) => {
  if (!date) return '—'
  try { return formatDistanceToNow(new Date(date), { addSuffix: true }) } catch { return '—' }
}

export const formatDate = (date, fmt = 'MMM d, yyyy h:mm a') => {
  if (!date) return '—'
  try { return format(new Date(date), fmt) } catch { return '—' }
}

export const statusColor = (status) => ({
  sent: 'badge-green', sending: 'badge-blue', draft: 'badge-gray',
  scheduled: 'badge-blue', failed: 'badge-red', partially_sent: 'badge-orange',
  cancelled: 'badge-gray',
}[status] || 'badge-gray')

export const severityColor = (severity) => ({
  high: 'severity-high', medium: 'severity-medium',
  low: 'severity-low', info: 'severity-info',
}[severity] || 'badge-gray')

export const channelIcon = (channel) => ({
  sms: '💬', email: '📧', voice: '📞', whatsapp: '💚', slack: '🔷', teams: '🟦'
}[channel] || '📡')

export const channelLabel = (channel) => ({
  sms: 'SMS', email: 'Email', voice: 'Voice', whatsapp: 'WhatsApp', slack: 'Slack', teams: 'Teams'
}[channel] || channel)

export const responseColor = (type) => ({
  safe: 'badge-green', need_help: 'badge-red', acknowledged: 'badge-blue', custom: 'badge-gray'
}[type] || 'badge-gray')

export const getInitials = (name = '') => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

export const INCIDENT_TYPES = [
  { value: 'weather', label: 'Severe Weather', icon: '🌪️' },
  { value: 'security', label: 'Security Threat', icon: '🔒' },
  { value: 'it', label: 'IT Outage', icon: '💻' },
  { value: 'facility', label: 'Facility Issue', icon: '🏗️' },
  { value: 'health', label: 'Health Emergency', icon: '🏥' },
  { value: 'evacuation', label: 'Evacuation', icon: '🚨' },
  { value: 'custom', label: 'Custom', icon: '📢' },
]

export const CHANNELS = [
  { value: 'sms', label: 'SMS', icon: '💬', desc: 'Text message to mobile' },
  { value: 'email', label: 'Email', icon: '📧', desc: 'Email to inbox' },
  { value: 'voice', label: 'Voice Call', icon: '📞', desc: 'Automated phone call' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💚', desc: 'WhatsApp message' },
  { value: 'slack', label: 'Slack', icon: '🔷', desc: 'Post to Slack channel' },
  { value: 'teams', label: 'Teams', icon: '🟦', desc: 'Post to Teams channel' },
]
