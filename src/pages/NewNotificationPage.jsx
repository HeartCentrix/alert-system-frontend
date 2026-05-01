import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, ChevronLeft, Send, Bell, Users, Radio, MessageSquare, AlertTriangle, Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { notificationsAPI, groupsAPI, usersAPI, templatesAPI, incidentsAPI } from '@/services/api'
import { INCIDENT_TYPES, CHANNELS, cn } from '@/utils/helpers'
import toast from 'react-hot-toast'

const STEPS = ['Incident', 'Message', 'Recipients', 'Channels', 'Review & Send']

function StepIndicator({ current, steps }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center flex-1">
          <div className="flex flex-col items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              i < current && 'step-done',
              i === current && 'step-active',
              i > current && 'step-todo',
            )}>
              {i < current ? <Check size={14} /> : i + 1}
            </div>
            <div className={cn(
              'text-[10px] mt-1 font-medium whitespace-nowrap',
              i === current ? 'text-slate-200' : 'text-slate-600'
            )}>{step}</div>
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              'flex-1 h-px mx-2 mb-4 transition-all',
              i < current ? 'bg-success-600/40' : 'bg-surface-700'
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// Step 1: Select incident type
function Step1({ form }) {
  const type = form.watch('incident_type')
  const incidentId = form.watch('incident_id')
  const qc = useQueryClient()
  // Inline-create form state. Hidden by default; opens when the user
  // clicks "+ Create new incident". Notifications and incidents are
  // separate entities — this lets the user create the incident inline
  // and auto-link it to the notification being built.
  const [showCreateIncident, setShowCreateIncident] = useState(false)
  const [createIncidentTitle, setCreateIncidentTitle] = useState('')
  const [createIncidentSeverity, setCreateIncidentSeverity] = useState('medium')
  const [createIncidentDescription, setCreateIncidentDescription] = useState('')
  const [creatingIncident, setCreatingIncident] = useState(false)

  // List incidents that are still in an "open" state — both 'active' and
  // 'monitoring' are ongoing; only 'resolved' and 'cancelled' are
  // terminal. Previously this filtered server-side to status='active'
  // only, hiding 'monitoring' incidents from the link-to-existing
  // dropdown even though they are equally valid notification subjects.
  const { data: incidents } = useQuery({
    queryKey: ['incidents-open'],
    queryFn: () => incidentsAPI.list().then(r =>
      (r.data || []).filter(i => i.status === 'active' || i.status === 'monitoring')
    ),
  })

  const handleCreateIncident = async () => {
    if (!createIncidentTitle.trim()) {
      toast.error('Incident title is required')
      return
    }
    setCreatingIncident(true)
    try {
      const { data: newIncident } = await incidentsAPI.create({
        title: createIncidentTitle.trim(),
        type: type || null,                       // pre-fills from the selected type card
        severity: createIncidentSeverity,
        description: createIncidentDescription.trim() || null,
      })
      // Refresh the dropdown's incident list and auto-select the new one
      // so the notification will be linked to it on submit.
      await qc.invalidateQueries({ queryKey: ['incidents-open'] })
      form.setValue('incident_id', String(newIncident.id))
      toast.success('Incident created and linked to this notification')
      setShowCreateIncident(false)
      setCreateIncidentTitle('')
      setCreateIncidentDescription('')
      setCreateIncidentSeverity('medium')
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Failed to create incident'
      toast.error(typeof msg === 'string' ? msg : 'Failed to create incident')
    } finally {
      setCreatingIncident(false)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-1">What type of event is this?</h2>
        <p className="text-slate-500 text-sm">Select the incident type or link to an existing incident</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {INCIDENT_TYPES.map(it => (
          <button
            key={it.value}
            type="button"
            onClick={() => form.setValue('incident_type', it.value)}
            className={cn(
              'p-4 rounded-xl border-2 text-left transition-all duration-150',
              type === it.value
                ? 'border-primary-500 bg-primary-600/15'
                : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
            )}
          >
            <div className="text-2xl mb-2">{it.icon}</div>
            <div className="text-sm font-medium text-slate-200">{it.label}</div>
          </button>
        ))}
      </div>

      <div>
        <label className="label">Link to Incident (optional)</label>
        <select
          {...form.register('incident_id')}
          className="select"
          disabled={showCreateIncident}
        >
          <option value="">— Send without linking to an incident —</option>
          {(incidents || []).map(inc => (
            <option key={inc.id} value={inc.id}>
              [{inc.severity?.toUpperCase()}] {inc.title}
            </option>
          ))}
        </select>
        {!showCreateIncident && incidentId && (
          <p className="text-xs text-success-400 mt-1">
            ✓ This notification will be linked to the selected incident.
          </p>
        )}
        {!showCreateIncident && (
          <button
            type="button"
            onClick={() => setShowCreateIncident(true)}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-primary-500/40 bg-primary-600/5 hover:bg-primary-600/10 hover:border-primary-500/70 text-sm font-medium text-primary-300 transition-colors"
          >
            <Plus size={16} /> Create a new incident and link it to this notification
          </button>
        )}
      </div>

      {showCreateIncident && (
        <div className="rounded-xl border border-primary-500/40 bg-primary-600/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">New Incident</h3>
            <button
              type="button"
              onClick={() => setShowCreateIncident(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
          </div>
          <div>
            <label className="label">Incident Title *</label>
            <input
              type="text"
              value={createIncidentTitle}
              onChange={(e) => setCreateIncidentTitle(e.target.value)}
              className="input"
              placeholder="e.g. HQ Network Outage"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Severity</label>
              <select
                value={createIncidentSeverity}
                onChange={(e) => setCreateIncidentSeverity(e.target.value)}
                className="select"
              >
                <option value="info">Info</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="label">Type</label>
              <input
                type="text"
                value={type || ''}
                readOnly
                className="input opacity-70"
                placeholder="Pick a type card above"
              />
            </div>
          </div>
          <div>
            <label className="label">Description (optional)</label>
            <textarea
              rows={2}
              value={createIncidentDescription}
              onChange={(e) => setCreateIncidentDescription(e.target.value)}
              className="input resize-none"
              placeholder="Brief context for this incident"
            />
          </div>
          <button
            type="button"
            onClick={handleCreateIncident}
            disabled={creatingIncident || !createIncidentTitle.trim()}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {creatingIncident ? 'Creating…' : 'Create incident & link'}
          </button>
        </div>
      )}

      <div>
        <label className="label">Notification Title *</label>
        <input
          {...form.register('title', { required: 'Title is required' })}
          className="input"
          placeholder="e.g. Severe Weather Warning — Phoenix Sites"
        />
        <p className="text-xs text-slate-500 mt-1">
          This is the notification's own title — what recipients see in
          the email subject / SMS preview. Different from the incident
          title above.
        </p>
      </div>
    </div>
  )
}

// Step 2: Write message
function Step2({ form }) {
  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesAPI.list().then(r => r.data),
  })
  const [selectedTemplate, setSelectedTemplate] = useState(null)

  const applyTemplate = (t) => {
    if (selectedTemplate === t.id) {
      // Deselect: clear the template and reset fields
      setSelectedTemplate(null)
      form.setValue('message', '')
      form.setValue('subject', '')
      toast.success('Template cleared - compose your custom message')
    } else {
      // Select new template
      setSelectedTemplate(t.id)
      form.setValue('message', t.body)
      if (t.subject) form.setValue('subject', t.subject)
      toast.success(`Template "${t.name}" applied`)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-1">Compose your message</h2>
        <p className="text-slate-500 text-sm">This message will be sent across all selected channels</p>
      </div>

      {templates?.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="label mb-0">Use a template</label>
            {selectedTemplate && (
              <button
                type="button"
                onClick={() => applyTemplate({ id: selectedTemplate })}
                className="text-xs text-danger-400 hover:text-danger-300 transition-colors flex items-center gap-1"
                title="Clear selected template"
              >
                <span>✕</span> Clear template
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {templates.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all text-sm',
                  selectedTemplate === t.id
                    ? 'border-primary-500 bg-primary-600/15 text-slate-200'
                    : 'border-surface-600 bg-surface-800/50 text-slate-400 hover:border-surface-500'
                )}
              >
                <div className="font-medium text-slate-300">{t.name}</div>
                <div className="text-xs text-slate-500 truncate mt-0.5">{t.body.slice(0, 60)}...</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="label">Email Subject (optional)</label>
        <input
          {...form.register('subject')}
          className="input"
          placeholder="Auto-uses title if blank"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="label mb-0">Message *</label>
          <span className="text-xs text-slate-500">
            {form.watch('message')?.length || 0} chars
            {form.watch('message')?.length > 160 && <span className="text-warning-400 ml-1">(multiple SMS)</span>}
          </span>
        </div>
        <textarea
          {...form.register('message', { required: 'Message is required' })}
          rows={6}
          className="input resize-none"
          placeholder={`Emergency notification message...\n\nReply 1 if you are SAFE\nReply 2 if you NEED HELP`}
        />
        <p className="text-xs text-slate-500 mt-1.5">
          Tip: For SMS, include reply instructions — "Reply 1 if Safe, Reply 2 if you Need Help"
        </p>
      </div>
    </div>
  )
}

// Step 3: Select recipients
function Step3({ form }) {
  const { data: groups } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsAPI.list().then(r => r.data),
  })
  const [searchQ, setSearchQ] = useState('')
  const { data: users } = useQuery({
    queryKey: ['users-search', searchQ],
    queryFn: () => usersAPI.list({ search: searchQ, page_size: 10 }).then(r => r.data),
  })

  const targetAll = form.watch('target_all')
  const selectedGroups = form.watch('target_group_ids') || []
  const selectedUsers = form.watch('target_user_ids') || []

  const toggleGroup = (id) => {
    const curr = form.getValues('target_group_ids') || []
    form.setValue('target_group_ids', curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])
  }

  const toggleUser = (id) => {
    const curr = form.getValues('target_user_ids') || []
    form.setValue('target_user_ids', curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id])
  }

  const total = targetAll ? 'Everyone' : `${selectedGroups.length} groups + ${selectedUsers.length} individuals`

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-1">Who receives this notification?</h2>
        <p className="text-slate-500 text-sm">Select your target audience</p>
      </div>

      {/* Target all */}
      <button
        type="button"
        onClick={() => form.setValue('target_all', !targetAll)}
        className={cn(
          'w-full p-4 rounded-xl border-2 text-left transition-all flex items-center gap-4',
          targetAll
            ? 'border-danger-500 bg-danger-600/10'
            : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
        )}
      >
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center',
          targetAll ? 'bg-danger-600' : 'bg-surface-700'
        )}>
          <Users size={18} className={targetAll ? 'text-white' : 'text-slate-400'} />
        </div>
        <div>
          <div className="font-semibold text-slate-200">Send to Everyone</div>
          <div className="text-xs text-slate-500">All active employees in the system</div>
        </div>
        {targetAll && <Check size={18} className="ml-auto text-danger-400" />}
      </button>

      {!targetAll && (
        <>
          {/* Groups */}
          <div>
            <label className="label">Select Groups</label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {groups?.map(g => (
                <label
                  key={g.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                    selectedGroups.includes(g.id)
                      ? 'border-primary-500/60 bg-primary-600/10'
                      : 'border-surface-700 bg-surface-800/40 hover:border-surface-500'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(g.id)}
                    onChange={() => toggleGroup(g.id)}
                    className="accent-primary-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-200">{g.name}</div>
                    <div className="text-xs text-slate-500">{g.member_count} members · {g.type}</div>
                  </div>
                </label>
              ))}
              {!groups?.length && <div className="text-sm text-slate-500 text-center py-3">No groups created yet</div>}
            </div>
          </div>

          {/* Individual search */}
          <div>
            <label className="label">Add Individuals</label>
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              className="input mb-2"
              placeholder="Search by name, email, or department..."
            />
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {users?.items?.map(u => (
                <label
                  key={u.id}
                  className={cn(
                    'flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all',
                    selectedUsers.includes(u.id)
                      ? 'bg-primary-600/15 border border-primary-500/40'
                      : 'hover:bg-surface-800'
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="accent-primary-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-200">{u.full_name}</div>
                    <div className="text-xs text-slate-500">{u.department} · {u.email}</div>
                  </div>
                  {u.phone && <span className="text-xs text-slate-600">{u.phone}</span>}
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      <div className="p-3 rounded-lg bg-surface-800/50 border border-surface-700/40">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Selected Recipients</div>
        <div className="text-sm font-medium text-slate-200">{total}</div>
      </div>
    </div>
  )
}

// Step 4: Select channels
function Step4({ form }) {
  const selected = form.watch('channels') || []

  const toggle = (ch) => {
    const curr = form.getValues('channels') || []
    form.setValue('channels', curr.includes(ch) ? curr.filter(x => x !== ch) : [...curr, ch])
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-1">How should we reach them?</h2>
        <p className="text-slate-500 text-sm">Select all channels you want to use simultaneously</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {CHANNELS.map(ch => {
          const active = selected.includes(ch.value)
          return (
            <button
              key={ch.value}
              type="button"
              onClick={() => toggle(ch.value)}
              className={cn(
                'p-4 rounded-xl border-2 text-left transition-all',
                active
                  ? 'border-primary-500 bg-primary-600/15'
                  : 'border-surface-700 bg-surface-800/50 hover:border-surface-500'
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{ch.icon}</span>
                <div>
                  <div className="text-sm font-semibold text-slate-200">{ch.label}</div>
                  <div className="text-xs text-slate-500">{ch.desc}</div>
                </div>
                {active && <Check size={16} className="ml-auto text-primary-400" />}
              </div>
            </button>
          )
        })}
      </div>

      {/* Slack/Teams webhook */}
      {selected.includes('slack') && (
        <div>
          <label className="label">Slack Webhook URL <span className="text-danger-400">*</span></label>
          <input {...form.register('slack_webhook_url', { required: 'Slack webhook URL is required' })} className="input font-mono text-xs" placeholder="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX" />
          <p className="text-xs text-slate-500 mt-1">Create an Incoming Webhook in your Slack workspace</p>
        </div>
      )}
      {selected.includes('teams') && (
        <div>
          <label className="label">Teams Webhook URL <span className="text-danger-400">*</span></label>
          <input {...form.register('teams_webhook_url', { required: 'Teams webhook URL is required' })} className="input font-mono text-xs" placeholder="https://outlook.office.com/webhook/..." />
          <p className="text-xs text-slate-500 mt-1">Create an Incoming Webhook in your Teams channel</p>
        </div>
      )}

      {/* Response required */}
      <div className="p-4 rounded-xl border border-surface-700 bg-surface-800/30">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            {...form.register('response_required')}
            className="accent-primary-500 w-4 h-4"
          />
          <div>
            <div className="text-sm font-medium text-slate-200">Require safety check-in response</div>
            <div className="text-xs text-slate-500">Employees must reply Safe or Need Help</div>
          </div>
        </label>
        {form.watch('response_required') && (
          <div className="mt-3 pl-7">
            <label className="label">Response deadline (minutes)</label>
            <input
              {...form.register('response_deadline_minutes', { valueAsNumber: true })}
              type="number"
              className="input w-32"
              placeholder="30"
              min={5}
            />
          </div>
        )}
      </div>

      {/* Schedule with Timezone */}
      <div className="space-y-2">
        <label className="label">Schedule (optional — blank = send immediately)</label>
        <div className="flex gap-3 items-center">
          <input
            {...form.register('scheduled_at')}
            type="datetime-local"
            className="input flex-1"
          />
          <select
            {...form.register('scheduled_timezone')}
            className="select w-64"
            defaultValue="UTC"
          >
            <option value="">Select timezone...</option>
            <option value="UTC">UTC (Coordinated Universal Time)</option>
            <option value="America/New_York">Eastern Time (US & Canada)</option>
            <option value="America/Chicago">Central Time (US & Canada)</option>
            <option value="America/Denver">Mountain Time (US & Canada)</option>
            <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
            <option value="America/Anchorage">Alaska</option>
            <option value="Pacific/Honolulu">Hawaii</option>
            <option value="Europe/London">London (GMT/BST)</option>
            <option value="Europe/Paris">Paris (CET)</option>
            <option value="Europe/Berlin">Berlin (CET)</option>
            <option value="Asia/Kolkata">India (IST)</option>
            <option value="Asia/Shanghai">China (CST)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
            <option value="Asia/Singapore">Singapore (SGT)</option>
            <option value="Australia/Sydney">Sydney (AEDT)</option>
            <option value="Pacific/Auckland">Auckland (NZDT)</option>
          </select>
        </div>
        <p className="text-xs text-slate-500">
          The notification will fire at the selected local time in the chosen timezone.
          Times are stored as UTC in the database.
        </p>
      </div>
    </div>
  )
}

// Step 5: Review
function Step5({ form }) {
  const v = form.watch()
  const type = INCIDENT_TYPES.find(t => t.value === v.incident_type)
  const channels = CHANNELS.filter(c => (v.channels || []).includes(c.value))

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display font-semibold text-white text-lg mb-1">Review & Send</h2>
        <p className="text-slate-500 text-sm">Confirm everything looks correct before sending</p>
      </div>

      <div className="space-y-3">
        <ReviewRow label="Incident Type" value={`${type?.icon} ${type?.label || 'Not specified'}`} />
        <ReviewRow label="Title" value={v.title} />
        <ReviewRow label="Message" value={v.message} multiline />
        <ReviewRow
          label="Recipients"
          value={v.target_all ? '📢 All employees' : `${(v.target_group_ids || []).length} groups + ${(v.target_user_ids || []).length} individuals`}
        />
        <ReviewRow
          label="Channels"
          value={channels.map(c => `${c.icon} ${c.label}`).join('  ·  ') || 'None selected'}
        />
        {v.response_required && (
          <ReviewRow label="Response Required" value={`Yes — ${v.response_deadline_minutes || 30} min deadline`} />
        )}
        {v.scheduled_at && (
          <ReviewRow 
            label="Scheduled For" 
            value={`${new Date(v.scheduled_at).toLocaleString()} ${v.scheduled_timezone ? `(${v.scheduled_timezone})` : '(UTC)'}`} 
          />
        )}
      </div>

      <div className="p-4 rounded-xl bg-warning-600/10 border border-warning-600/30">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-warning-400 mt-0.5 shrink-0" />
          <div className="text-sm text-warning-300">
            {v.scheduled_at
              ? 'This notification will be sent at the scheduled time.'
              : 'This notification will be sent immediately to all selected recipients across all selected channels.'}
          </div>
        </div>
      </div>
    </div>
  )
}

const ReviewRow = ({ label, value, multiline }) => (
  <div className="flex gap-4 p-3 rounded-lg bg-surface-800/40">
    <div className="text-xs text-slate-500 uppercase tracking-wider w-28 shrink-0 pt-0.5">{label}</div>
    <div className={cn('text-sm text-slate-200 font-medium', multiline && 'whitespace-pre-wrap')}>{value || '—'}</div>
  </div>
)

export default function NewNotificationPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [sending, setSending] = useState(false)
  const form = useForm({
    defaultValues: {
      incident_type: '',
      incident_id: '',
      title: '',
      message: '',
      subject: '',
      channels: ['sms', 'email'],
      target_all: false,
      target_group_ids: [],
      target_user_ids: [],
      response_required: false,
      response_deadline_minutes: 30,
      scheduled_at: '',
      scheduled_timezone: 'UTC',
      slack_webhook_url: '',
      teams_webhook_url: '',
    }
  })

  // Subscribe to all fields that gate the Next button so React re-renders on every change
  const watched = form.watch([
    'incident_type', 'incident_id', 'title', 'message',
    'target_all', 'target_group_ids', 'target_user_ids',
    'channels', 'slack_webhook_url', 'teams_webhook_url',
  ])

  const canProceed = () => {
    const v = form.getValues()
    // Step 0: title is required + at least one of (incident type selected OR existing incident linked)
    if (step === 0) return (!!v.incident_type || !!v.incident_id) && !!v.title
    if (step === 1) return !!v.message
    if (step === 2) return v.target_all || (v.target_group_ids?.length > 0) || (v.target_user_ids?.length > 0)
    if (step === 3) {
      if (v.channels?.length === 0) return false
      // Validate webhook URLs if Slack/Teams channels are selected
      if (v.channels.includes('slack') && !v.slack_webhook_url) return false
      if (v.channels.includes('teams') && !v.teams_webhook_url) return false
      return true
    }
    return true
  }

  const handleNext = async () => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      await handleSend()
    }
  }

  const handleSend = async () => {
    setSending(true)
    try {
      const v = form.getValues()
      const payload = {
        title: v.title,
        message: v.message,
        subject: v.subject || undefined,
        channels: v.channels,
        target_all: v.target_all,
        target_group_ids: v.target_group_ids || [],
        target_user_ids: v.target_user_ids || [],
        response_required: v.response_required,
        response_deadline_minutes: v.response_required ? v.response_deadline_minutes : undefined,
        scheduled_at: v.scheduled_at || undefined,
        scheduled_timezone: v.scheduled_timezone || undefined,
        slack_webhook_url: v.slack_webhook_url || undefined,
        teams_webhook_url: v.teams_webhook_url || undefined,
        incident_type: v.incident_type || undefined,
        incident_id: v.incident_id ? parseInt(v.incident_id) : undefined,
      }
      const { data } = await notificationsAPI.create(payload)
      toast.success(v.scheduled_at ? 'Notification scheduled!' : 'Notification sent!')
      navigate(`/notifications/${data.id}`)
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Failed to send notification')
      toast.error(errorMessage || 'Failed to send notification')
    } finally {
      setSending(false)
    }
  }

  const stepProps = { form }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="btn-ghost py-1.5 px-3 text-xs shrink-0">
          <span className="hidden sm:inline">← Back</span>
          <span className="sm:hidden">←</span>
        </button>
        <h1 className="font-display font-bold text-xl text-white truncate">New Notification</h1>
      </div>

      <div className="card p-4 sm:p-8">
        <StepIndicator current={step} steps={STEPS} />

        <div className="min-h-64">
          {step === 0 && <Step1 {...stepProps} />}
          {step === 1 && <Step2 {...stepProps} />}
          {step === 2 && <Step3 {...stepProps} />}
          {step === 3 && <Step4 {...stepProps} />}
          {step === 4 && <Step5 {...stepProps} />}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-6 sm:mt-8 pt-6 border-t border-surface-700/40">
          <button
            type="button"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="btn-ghost disabled:opacity-30 w-full sm:w-auto"
          >
            <ChevronLeft size={16} /> Previous
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-500">{step + 1} of {STEPS.length}</span>
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed() || sending}
            className={cn(
              'w-full sm:w-auto justify-center',
              step === STEPS.length - 1 ? 'btn-danger' : 'btn-primary'
            )}
          >
            {sending ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Sending...
              </>
            ) : step === STEPS.length - 1 ? (
              <><Send size={15} /> Send Now</>
            ) : (
              <>Next <ChevronRight size={16} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
