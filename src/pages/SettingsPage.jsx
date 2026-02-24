import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { User, Lock, Bell, Shield, CheckCircle } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { authAPI } from '@/services/api'
import { cn } from '@/utils/helpers'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'password', label: 'Password', icon: Lock },
    { id: 'notifications', label: 'Preferences', icon: Bell },
  ]

  return (
    <div className="max-w-2xl animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl text-white">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your account preferences</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 p-1 bg-surface-900 rounded-lg border border-surface-700/60 w-fit">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                tab === t.id
                  ? 'bg-surface-700 text-white'
                  : 'text-slate-500 hover:text-slate-300'
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'profile' && <ProfileTab user={user} />}
      {tab === 'password' && <PasswordTab />}
      {tab === 'notifications' && <PreferencesTab user={user} />}
    </div>
  )
}

function ProfileTab({ user }) {
  return (
    <div className="card p-6 space-y-5">
      <h2 className="font-display font-semibold text-white">Profile Information</h2>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-primary-700 flex items-center justify-center text-2xl font-bold text-white">
          {user?.full_name?.charAt(0) || '?'}
        </div>
        <div>
          <div className="font-semibold text-slate-200 text-lg">{user?.full_name}</div>
          <div className="text-sm text-slate-500">{user?.email}</div>
          <span className={cn(
            'badge mt-1',
            user?.role === 'super_admin' ? 'badge-red' :
            user?.role === 'admin' ? 'badge-orange' :
            user?.role === 'manager' ? 'badge-blue' : 'badge-gray'
          )}>
            {user?.role?.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pt-2">
        {[
          { label: 'First Name', value: user?.first_name },
          { label: 'Last Name', value: user?.last_name },
          { label: 'Email', value: user?.email },
          { label: 'Phone', value: user?.phone || '—' },
          { label: 'Department', value: user?.department || '—' },
          { label: 'Title', value: user?.title || '—' },
          { label: 'Employee ID', value: user?.employee_id || '—' },
        ].map(f => (
          <div key={f.label}>
            <label className="label">{f.label}</label>
            <div className="text-sm text-slate-200 bg-surface-800 rounded-lg px-3 py-2 border border-surface-700">
              {f.value}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-500 pt-2">
        To update your profile information, contact your system administrator.
      </p>
    </div>
  )
}

function PasswordTab() {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (data) => {
    if (data.new_password !== data.confirm_password) {
      toast.error('New passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authAPI.changePassword(data.current_password, data.new_password)
      toast.success('Password changed successfully')
      setSuccess(true)
      reset()
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-6">
      <h2 className="font-display font-semibold text-white mb-5">Change Password</h2>

      {success && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-success-600/15 border border-success-600/30 mb-5">
          <CheckCircle size={16} className="text-success-400" />
          <span className="text-sm text-success-300">Password changed successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-sm">
        <div>
          <label className="label">Current Password</label>
          <input
            {...register('current_password', { required: 'Required' })}
            type="password"
            className="input"
            autoComplete="current-password"
          />
          {errors.current_password && (
            <p className="text-xs text-danger-400 mt-1">{errors.current_password.message}</p>
          )}
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            {...register('new_password', {
              required: 'Required',
              minLength: { value: 8, message: 'At least 8 characters' }
            })}
            type="password"
            className="input"
            autoComplete="new-password"
          />
          {errors.new_password && (
            <p className="text-xs text-danger-400 mt-1">{errors.new_password.message}</p>
          )}
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            {...register('confirm_password', { required: 'Required' })}
            type="password"
            className="input"
            autoComplete="new-password"
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-surface-700/40">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Password Requirements</h3>
        <ul className="space-y-1 text-xs text-slate-500">
          <li>• Minimum 8 characters</li>
          <li>• Mix of uppercase and lowercase letters recommended</li>
          <li>• Include numbers and special characters for stronger security</li>
        </ul>
      </div>
    </div>
  )
}

function PreferencesTab({ user }) {
  const channels = user?.preferred_channels || ['sms', 'email']

  const allChannels = [
    { value: 'sms', label: 'SMS', icon: '💬', desc: 'Text message to your phone' },
    { value: 'email', label: 'Email', icon: '📧', desc: 'Email to your inbox' },
    { value: 'voice', label: 'Voice Call', icon: '📞', desc: 'Automated phone call' },
    { value: 'whatsapp', label: 'WhatsApp', icon: '💚', desc: 'WhatsApp message' },
  ]

  return (
    <div className="card p-6">
      <h2 className="font-display font-semibold text-white mb-1">Notification Preferences</h2>
      <p className="text-slate-500 text-sm mb-5">
        Your preferred channels for receiving emergency alerts
      </p>

      <div className="space-y-3">
        {allChannels.map(ch => {
          const active = channels.includes(ch.value)
          return (
            <div
              key={ch.value}
              className={cn(
                'flex items-center gap-4 p-4 rounded-xl border-2 transition-all',
                active
                  ? 'border-primary-500/60 bg-primary-600/10'
                  : 'border-surface-700 bg-surface-800/40 opacity-60'
              )}
            >
              <span className="text-xl">{ch.icon}</span>
              <div className="flex-1">
                <div className="text-sm font-medium text-slate-200">{ch.label}</div>
                <div className="text-xs text-slate-500">{ch.desc}</div>
              </div>
              <span className={active ? 'badge-green' : 'badge-gray'}>
                {active ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-slate-500 mt-4">
        To change your notification preferences, contact your administrator.
      </p>
    </div>
  )
}
