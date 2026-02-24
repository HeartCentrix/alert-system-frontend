import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, MapPin, Users, FileText, AlertTriangle, CheckCircle } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { groupsAPI, locationsAPI, templatesAPI, incidentsAPI } from '@/services/api'
import { cn, timeAgo, severityColor } from '@/utils/helpers'
import toast from 'react-hot-toast'

// ─── GROUPS ───────────────────────────────────────────────────────────────────

function GroupModal({ group, onClose, onSaved }) {
  const { register, handleSubmit } = useForm({ defaultValues: group || { type: 'static' } })
  const [loading, setLoading] = useState(false)
  const onSubmit = async (data) => {
    setLoading(true)
    try {
      group ? await groupsAPI.update(group.id, data) : await groupsAPI.create(data)
      toast.success(group ? 'Group updated' : 'Group created')
      onSaved(); onClose()
    } catch (err) { toast.error('Error saving group') }
    finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md animate-fade-in">
        <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
          <h2 className="font-display font-semibold text-white">{group ? 'Edit Group' : 'New Group'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="label">Group Name *</label>
            <input {...register('name', { required: true })} className="input" placeholder="e.g. Phoenix Site A" />
          </div>
          <div>
            <label className="label">Description</label>
            <input {...register('description')} className="input" />
          </div>
          <div>
            <label className="label">Type</label>
            <select {...register('type')} className="select">
              <option value="static">Static (manually managed)</option>
              <option value="dynamic">Dynamic (auto-filtered)</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : group ? 'Save' : 'Create Group'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function GroupsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsAPI.list().then(r => r.data),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => groupsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['groups']); toast.success('Group deleted') },
  })
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Groups ({groups.length})</h1>
          <p className="text-slate-500 text-sm">Organize employees for targeted notifications</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary"><Plus size={14} /> New Group</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/60">
              {['Name', 'People', 'Added On', 'Type', 'Actions'].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="text-center py-10 text-slate-500">Loading...</td></tr>}
            {!isLoading && groups.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-slate-500 text-sm">No groups yet</td></tr>}
            {groups.map(g => (
              <tr key={g.id} className="table-row">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center">
                      <Users size={14} className="text-slate-400" />
                    </div>
                    <div className="font-medium text-slate-200">{g.name}</div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <span className="font-bold text-white">{g.member_count}</span>
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-500">{timeAgo(g.created_at)}</td>
                <td className="px-5 py-3.5">
                  <span className={g.type === 'dynamic' ? 'badge-blue' : 'badge-gray'}>
                    {g.type === 'dynamic' ? '⟳ Dynamic' : 'Static'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2">
                    <button onClick={() => setModal(g)} className="p-1.5 text-slate-500 hover:text-slate-300"><Edit2 size={14} /></button>
                    <button onClick={() => confirm('Delete group?') && deleteMutation.mutate(g.id)} className="p-1.5 text-slate-500 hover:text-danger-400"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <GroupModal group={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => qc.invalidateQueries(['groups'])} />}
    </div>
  )
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────

function LocationModal({ location, onClose, onSaved }) {
  const { register, handleSubmit } = useForm({ defaultValues: location || { country: 'USA', geofence_radius_miles: 1.0 } })
  const [loading, setLoading] = useState(false)
  const onSubmit = async (data) => {
    setLoading(true)
    try {
      location ? await locationsAPI.update(location.id, data) : await locationsAPI.create(data)
      toast.success(location ? 'Location updated' : 'Location created')
      onSaved(); onClose()
    } catch { toast.error('Error saving location') }
    finally { setLoading(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg animate-fade-in">
        <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
          <h2 className="font-display font-semibold text-white">{location ? 'Edit Location' : 'New Location'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="label">Location Name *</label>
            <input {...register('name', { required: true })} className="input" placeholder="e.g. Phoenix HQ" />
          </div>
          <div>
            <label className="label">Street Address</label>
            <input {...register('address')} className="input" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">City</label>
              <input {...register('city')} className="input" />
            </div>
            <div>
              <label className="label">State</label>
              <input {...register('state')} className="input" placeholder="AZ" />
            </div>
            <div>
              <label className="label">ZIP</label>
              <input {...register('zip_code')} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Latitude</label>
              <input {...register('latitude', { valueAsNumber: true })} type="number" step="any" className="input" placeholder="33.4484" />
            </div>
            <div>
              <label className="label">Longitude</label>
              <input {...register('longitude', { valueAsNumber: true })} type="number" step="any" className="input" placeholder="-112.074" />
            </div>
          </div>
          <div>
            <label className="label">Geofence Radius (miles)</label>
            <input {...register('geofence_radius_miles', { valueAsNumber: true })} type="number" step="0.1" className="input w-32" />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : location ? 'Save' : 'Create Location'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function LocationsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsAPI.list().then(r => r.data),
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => locationsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['locations']); toast.success('Location deleted') },
  })
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Locations ({locations.length})</h1>
          <p className="text-slate-500 text-sm">Taylor Morrison sites and job locations</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary"><Plus size={14} /> Add Location</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <div className="text-slate-500 text-sm col-span-3 py-8 text-center">Loading...</div>}
        {!isLoading && locations.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500 text-sm">No locations yet. Add your first site.</div>
        )}
        {locations.map(loc => (
          <div key={loc.id} className="card-hover p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-primary-600/20 flex items-center justify-center">
                <MapPin size={16} className="text-primary-400" />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setModal(loc)} className="p-1.5 text-slate-500 hover:text-slate-300"><Edit2 size={13} /></button>
                <button onClick={() => confirm('Delete?') && deleteMutation.mutate(loc.id)} className="p-1.5 text-slate-500 hover:text-danger-400"><Trash2 size={13} /></button>
              </div>
            </div>
            <h3 className="font-semibold text-slate-200 mb-0.5">{loc.name}</h3>
            <p className="text-xs text-slate-500">{[loc.address, loc.city, loc.state].filter(Boolean).join(', ')}</p>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-400"><span className="font-bold text-white">{loc.user_count}</span> people</span>
              {loc.latitude && (
                <a
                  href={`https://maps.google.com/?q=${loc.latitude},${loc.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary-400 hover:underline"
                >
                  View on Map →
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      {modal && <LocationModal location={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => qc.invalidateQueries(['locations'])} />}
    </div>
  )
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesAPI.list().then(r => r.data),
  })

  function TemplateModal({ template, onClose }) {
    const { register, handleSubmit } = useForm({ defaultValues: template || { channels: ['sms', 'email'] } })
    const [loading, setLoading] = useState(false)
    const onSubmit = async (data) => {
      setLoading(true)
      try {
        template ? await templatesAPI.update(template.id, data) : await templatesAPI.create(data)
        toast.success('Template saved')
        qc.invalidateQueries(['templates']); onClose()
      } catch { toast.error('Error') }
      finally { setLoading(false) }
    }
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card w-full max-w-lg animate-fade-in">
          <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">{template ? 'Edit Template' : 'New Template'}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div><label className="label">Template Name *</label><input {...register('name', { required: true })} className="input" /></div>
            <div>
              <label className="label">Category</label>
              <select {...register('category')} className="select">
                <option value="">— Select —</option>
                {['weather', 'security', 'it', 'facility', 'health', 'evacuation', 'custom'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div><label className="label">Email Subject (optional)</label><input {...register('subject')} className="input" /></div>
            <div>
              <label className="label">Message Body *</label>
              <textarea {...register('body', { required: true })} rows={5} className="input resize-none" placeholder="Alert message..." />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving...' : 'Save Template'}</button>
              <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Templates ({templates.length})</h1>
          <p className="text-slate-500 text-sm">Pre-written messages for rapid response</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary"><Plus size={14} /> New Template</button>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {!isLoading && templates.length === 0 && (
          <div className="col-span-3 text-center py-12 text-slate-500 text-sm">No templates yet.</div>
        )}
        {templates.map(t => (
          <div key={t.id} className="card-hover p-5">
            <div className="flex items-start justify-between mb-2">
              <span className="badge-blue text-xs">{t.category || 'general'}</span>
              <div className="flex gap-1">
                <button onClick={() => setModal(t)} className="p-1.5 text-slate-500 hover:text-slate-300"><Edit2 size={13} /></button>
                <button onClick={() => confirm('Delete?') && templatesAPI.delete(t.id).then(() => { qc.invalidateQueries(['templates']); toast.success('Deleted') })} className="p-1.5 text-slate-500 hover:text-danger-400"><Trash2 size={13} /></button>
              </div>
            </div>
            <h3 className="font-semibold text-slate-200 text-sm mb-1">{t.name}</h3>
            <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed">{t.body}</p>
          </div>
        ))}
      </div>
      {modal && <TemplateModal template={modal === 'create' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}

// ─── INCIDENTS ────────────────────────────────────────────────────────────────

export function IncidentsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const { data: incidents = [], isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsAPI.list().then(r => r.data),
    refetchInterval: 30000,
  })

  function IncidentModal({ incident, onClose }) {
    const { register, handleSubmit } = useForm({ defaultValues: incident || { severity: 'medium' } })
    const [loading, setLoading] = useState(false)
    const onSubmit = async (data) => {
      setLoading(true)
      try {
        incident ? await incidentsAPI.update(incident.id, data) : await incidentsAPI.create(data)
        toast.success(incident ? 'Incident updated' : 'Incident created')
        qc.invalidateQueries(['incidents']); onClose()
      } catch { toast.error('Error') }
      finally { setLoading(false) }
    }
    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="card w-full max-w-md animate-fade-in">
          <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">{incident ? 'Update Incident' : 'New Incident'}</h2>
            <button onClick={onClose} className="text-slate-500 text-xl">×</button>
          </div>
          <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
            <div><label className="label">Title *</label><input {...register('title', { required: true })} className="input" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Type</label>
                <select {...register('type')} className="select">
                  <option value="">— Select —</option>
                  {['weather', 'security', 'it', 'facility', 'health', 'evacuation', 'custom'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Severity</label>
                <select {...register('severity')} className="select">
                  {['high', 'medium', 'low', 'info'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            {incident && (
              <div>
                <label className="label">Status</label>
                <select {...register('status')} className="select">
                  {['active', 'monitoring', 'resolved'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div><label className="label">Description</label><textarea {...register('description')} rows={3} className="input resize-none" /></div>
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">{loading ? 'Saving...' : incident ? 'Update' : 'Create Incident'}</button>
              <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const active = incidents.filter(i => i.status === 'active')
  const resolved = incidents.filter(i => i.status === 'resolved')

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Incidents</h1>
          <p className="text-slate-500 text-sm">{active.length} active · {resolved.length} resolved</p>
        </div>
        <button onClick={() => setModal('create')} className="btn-danger"><Plus size={14} /> New Incident</button>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="text-center py-10 text-slate-500">Loading...</div>}
        {!isLoading && incidents.length === 0 && (
          <div className="card p-12 text-center">
            <CheckCircle size={32} className="text-success-500 mx-auto mb-3" />
            <div className="text-slate-400 font-medium">No incidents</div>
            <div className="text-sm text-slate-500">All clear</div>
          </div>
        )}
        {incidents.map(inc => (
          <div key={inc.id} className={cn(
            'card p-5 flex items-start gap-4 transition-all cursor-pointer hover:border-surface-500',
            inc.status === 'active' && 'border-danger-600/40'
          )} onClick={() => setModal(inc)}>
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
              inc.severity === 'high' ? 'bg-danger-600/20' :
              inc.severity === 'medium' ? 'bg-warning-600/20' : 'bg-surface-700'
            )}>
              <AlertTriangle size={18} className={
                inc.severity === 'high' ? 'text-danger-400' :
                inc.severity === 'medium' ? 'text-warning-400' : 'text-slate-400'
              } />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={severityColor(inc.severity)}>{inc.severity}</span>
                <span className={inc.status === 'active' ? 'badge-red' : 'badge-green'}>{inc.status}</span>
                {inc.type && <span className="badge-gray">{inc.type}</span>}
              </div>
              <h3 className="font-semibold text-slate-200">{inc.title}</h3>
              {inc.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{inc.description}</p>}
            </div>
            <div className="text-xs text-slate-500 shrink-0">{timeAgo(inc.created_at)}</div>
          </div>
        ))}
      </div>
      {modal && <IncidentModal incident={modal === 'create' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
