import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Upload, Edit2, Trash2, UserCheck, UserX, ChevronLeft, ChevronRight, Eye, EyeOff } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { usersAPI } from '@/services/api'
import { getInitials, cn } from '@/utils/helpers'
import toast from 'react-hot-toast'

const ROLES = ['viewer', 'manager', 'admin', 'super_admin']

// Generate a secure temporary password
function generateTempPassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
  const length = 16
  let password = ''
  // Ensure at least one of each type
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]
  password += '0123456789'[Math.floor(Math.random() * 10)]
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)]
  }
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('')
}

function UserModal({ user, onClose, onSaved }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: user || { role: 'viewer', preferred_channels: ['sms', 'email'] }
  })
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState(null)

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      if (user?.id) {
        await usersAPI.update(user.id, data)
        toast.success('User updated')
        onSaved()
        onClose()
      } else {
        // Generate secure password if not provided
        const password = data.password || generateTempPassword()
        await usersAPI.create({ ...data, password })
        
        // Show generated password if it was auto-generated
        if (!data.password) {
          setGeneratedPassword(password)
          // Don't close modal - let user copy the password first
          toast.success('User created! Copy the password below')
        } else {
          toast.success('User created')
          onSaved()
          onClose()
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
          <h2 className="font-display font-semibold text-white">{user ? 'Edit Person' : 'Add Person'}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">First Name *</label>
              <input {...register('first_name', { required: true })} className="input" />
            </div>
            <div>
              <label className="label">Last Name *</label>
              <input {...register('last_name', { required: true })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Email *</label>
            <input {...register('email', { required: true })} type="email" className="input" />
          </div>
          {!user && (
            <div>
              <label className="label">
                Password {generatedPassword ? '(auto-generated - copy this!)' : '(optional — auto-generated if blank)'}
              </label>
              <div className="flex gap-2">
                <input
                  {...register('password', !generatedPassword && { minLength: { value: 8, message: 'Min 8 characters' } })}
                  type={showPassword ? 'text' : 'password'}
                  className="input flex-1"
                  placeholder="Min 8 characters"
                  disabled={!!generatedPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn-ghost px-3"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {generatedPassword && (
                <div className="mt-2 p-3 bg-warning-900/30 border border-warning-700 rounded">
                  <p className="text-warning-300 text-sm font-semibold mb-1">
                    ⚠️ Copy this password now - it won't be shown again!
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-warning-200 text-lg font-mono flex-1 bg-warning-900/50 px-3 py-2 rounded">{generatedPassword}</code>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedPassword)
                        toast.success('Password copied to clipboard')
                      }}
                      className="btn-primary text-sm whitespace-nowrap"
                    >
                      Copy
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onSaved()
                      onClose()
                    }}
                    className="mt-3 text-sm text-slate-400 hover:text-slate-200"
                  >
                    Close & Continue →
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Phone (SMS/Voice)</label>
              <input {...register('phone')} className="input" placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label className="label">WhatsApp</label>
              <input {...register('whatsapp_number')} className="input" placeholder="+1 555 000 0000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Department</label>
              <input {...register('department')} className="input" />
            </div>
            <div>
              <label className="label">Title</label>
              <input {...register('title')} className="input" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Employee ID</label>
              <input {...register('employee_id')} className="input" />
            </div>
            <div>
              <label className="label">Role</label>
              <select {...register('role')} className="select">
                {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : user ? 'Save Changes' : 'Create Person'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PeoplePage() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'create' | user object
  const fileRef = useRef()
  const [importing, setImporting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['users', page, search],
    queryFn: () => usersAPI.list({ page, page_size: 20, search: search || undefined }).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => usersAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['users']); toast.success('User deleted') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Error'),
  })

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImporting(true)
    try {
      const { data: result } = await usersAPI.importCSV(file)
      toast.success(`Import complete: ${result.created} created, ${result.updated} updated, ${result.failed} failed`)
      if (result.errors?.length) console.warn('Import errors:', result.errors)
      qc.invalidateQueries(['users'])
    } catch (err) {
      toast.error('Import failed')
    } finally {
      setImporting(false)
      e.target.value = ''
    }
  }

  const users = data?.items || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total / 20)

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">People</h1>
          <p className="text-slate-500 text-sm">{total} employees in the system</p>
        </div>
        <div className="flex gap-2">
          <input type="file" ref={fileRef} accept=".csv" onChange={handleImport} className="hidden" />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="btn-outline"
          >
            <Upload size={14} /> {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <button onClick={() => setModal('create')} className="btn-primary">
            <Plus size={14} /> Add Person
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-72">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="input pl-9"
          placeholder="Search name, email, department..."
        />
      </div>

      {/* CSV download template */}
      <div className="text-xs text-slate-500">
        CSV format: <code className="font-mono bg-surface-800 px-1.5 py-0.5 rounded">first_name, last_name, email, phone, department, title, employee_id, role</code>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/60">
              {['Person', 'Contact', 'Department', 'Role', 'Status', ''].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3 first:px-5">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td></tr>
            )}
            {!isLoading && users.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">No people found</td></tr>
            )}
            {users.map(u => (
              <tr key={u.id} className="table-row">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary-700/50 flex items-center justify-center text-xs font-bold text-primary-300 shrink-0">
                      {getInitials(u.full_name)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-slate-200">{u.full_name}</div>
                      <div className="text-xs text-slate-500">{u.employee_id && `#${u.employee_id}`}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5">
                  <div className="text-xs text-slate-400">{u.email}</div>
                  {u.phone && <div className="text-xs text-slate-500 font-mono">{u.phone}</div>}
                </td>
                <td className="px-5 py-3.5 text-sm text-slate-400">{u.department || '—'}</td>
                <td className="px-5 py-3.5">
                  <span className={cn(
                    'badge',
                    u.role === 'super_admin' ? 'badge-red' :
                    u.role === 'admin' ? 'badge-orange' :
                    u.role === 'manager' ? 'badge-blue' : 'badge-gray'
                  )}>{u.role?.replace('_', ' ')}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={u.is_active ? 'badge-green' : 'badge-red'}>
                    {u.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setModal(u)}
                      className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${u.full_name}?`)) deleteMutation.mutate(u.id)
                      }}
                      className="p-1.5 text-slate-500 hover:text-danger-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-surface-700/40 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => p - 1)} disabled={page === 1} className="btn-ghost py-1 px-2">
                <ChevronLeft size={14} />
              </button>
              <span className="text-sm text-slate-400 px-2">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= totalPages} className="btn-ghost py-1 px-2">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          user={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => qc.invalidateQueries(['users'])}
        />
      )}
    </div>
  )
}
