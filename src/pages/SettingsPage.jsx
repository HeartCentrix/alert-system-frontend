import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { User, Lock, Bell, Shield, CheckCircle, Edit2 } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { authAPI, locationsAPI } from '@/services/api'
import { cn } from '@/utils/helpers'
import toast from 'react-hot-toast'
import MFAManagementTab from '@/components/settings/MFAManagementTab'
import { getPrimaryErrorMessage } from '@/utils/errorHandler'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState('profile')

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
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
      {tab === 'security' && <MFAManagementTab />}
      {tab === 'password' && <PasswordTab />}
      {tab === 'notifications' && <PreferencesTab user={user} />}
    </div>
  )
}

function ProfileTab({ user }) {
  const qc = useQueryClient()
  const { updateUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      department: user?.department || '',
      title: user?.title || '',
      location_id: user?.location_id || '',
      preferred_channels: user?.preferred_channels || ['sms', 'email'],
    }
  })

  // Reset form when user prop changes (prevents stale values on re-mount)
  useEffect(() => {
    reset({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      phone: user?.phone || '',
      department: user?.department || '',
      title: user?.title || '',
      location_id: user?.location_id || '',
      preferred_channels: user?.preferred_channels || ['sms', 'email'],
    })
  }, [user, reset])

  // Validation rules for profile fields
  const profileValidation = {
    first_name: {
      required: 'First name is required',
      minLength: { value: 1, message: 'First name cannot be empty' },
      maxLength: { value: 50, message: 'First name must be less than 50 characters' },
      pattern: {
        value: /^[a-zA-Z\u00C0-\u017F\s'-]+$/,
        message: 'First name can only contain letters, spaces, hyphens, and apostrophes'
      }
    },
    last_name: {
      required: 'Last name is required',
      minLength: { value: 1, message: 'Last name cannot be empty' },
      maxLength: { value: 50, message: 'Last name must be less than 50 characters' },
      pattern: {
        value: /^[a-zA-Z\u00C0-\u017F\s'-]+$/,
        message: 'Last name can only contain letters, spaces, hyphens, and apostrophes'
      }
    },
    phone: {
      pattern: {
        value: /^[\d\s()+\-]*$/,
        message: 'Please enter a valid phone number format'
      },
      maxLength: { value: 20, message: 'Phone number must be less than 20 characters' }
    },
    department: {
      maxLength: { value: 100, message: 'Department must be less than 100 characters' }
    },
    title: {
      maxLength: { value: 100, message: 'Title must be less than 100 characters' }
    }
  }

  // Fetch locations for the dropdown
  const { data: locationsData } = useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const response = await locationsAPI.list()
      return response.data || []
    },
    staleTime: 5 * 60 * 1000,
  })
  const locations = Array.isArray(locationsData) ? locationsData : []

  // Clean form data by converting empty strings to undefined
  const cleanUserData = (data) => {
    const cleaned = { ...data }
    const optionalFields = ['phone', 'department', 'title']
    optionalFields.forEach(field => {
      if (cleaned[field] === '' || cleaned[field] === null || cleaned[field] === undefined) {
        delete cleaned[field]
      }
    })
    if (cleaned.location_id === '' || cleaned.location_id === null || cleaned.location_id === undefined) {
      delete cleaned.location_id
    }
    return cleaned
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      const cleanedData = cleanUserData(data)
      const { data: updatedUser } = await authAPI.updateProfile(cleanedData)
      updateUser(updatedUser)
      qc.setQueryData(['auth', 'me'], updatedUser)
      toast.success('Profile updated successfully')
      setIsEditing(false)
    } catch (error) {
      // Normalize error to prevent rendering raw objects
      const errorMessage = getPrimaryErrorMessage(error)
      toast.error(errorMessage || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    setValue('first_name', user?.first_name || '')
    setValue('last_name', user?.last_name || '')
    setValue('phone', user?.phone || '')
    setValue('department', user?.department || '')
    setValue('title', user?.title || '')
    setValue('location_id', user?.location_id || '')
    setValue('preferred_channels', user?.preferred_channels || ['sms', 'email'])
    setIsEditing(false)
  }

  const toggleChannel = (channel) => {
    const current = watch('preferred_channels')
    const updated = current.includes(channel)
      ? current.filter(c => c !== channel)
      : [...current, channel]
    if (updated.length === 0) {
      toast.error('At least one notification channel is required')
      return
    }
    setValue('preferred_channels', updated)
  }

  if (isEditing) {
    return (
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-white">Edit Profile</h2>
          <button onClick={handleCancel} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">First Name</label>
            <input 
              {...register('first_name', profileValidation.first_name)} 
              className="input" 
              maxLength={50}
            />
            {errors.first_name && (
              <p className="text-xs text-danger-400 mt-1">{errors.first_name.message}</p>
            )}
          </div>
          <div>
            <label className="label">Last Name</label>
            <input 
              {...register('last_name', profileValidation.last_name)} 
              className="input"
              maxLength={50}
            />
            {errors.last_name && (
              <p className="text-xs text-danger-400 mt-1">{errors.last_name.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Phone</label>
            <input 
              {...register('phone', profileValidation.phone)} 
              className="input" 
              placeholder="+1 555 000 0000"
              maxLength={20}
            />
            {errors.phone && (
              <p className="text-xs text-danger-400 mt-1">{errors.phone.message}</p>
            )}
          </div>
          <div>
            <label className="label">Department</label>
            <input 
              {...register('department', profileValidation.department)} 
              className="input"
              maxLength={100}
            />
            {errors.department && (
              <p className="text-xs text-danger-400 mt-1">{errors.department.message}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Title</label>
            <input 
              {...register('title', profileValidation.title)} 
              className="input"
              maxLength={100}
            />
            {errors.title && (
              <p className="text-xs text-danger-400 mt-1">{errors.title.message}</p>
            )}
          </div>
          <div>
            <label className="label">Location</label>
            <select {...register('location_id')} className="select">
              <option value="">None</option>
              {locations.map(loc => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="label mb-2">Notification Preferences</label>
          <div className="flex gap-2">
            {['sms', 'email', 'voice'].map(channel => {
              const isActive = watch('preferred_channels')?.includes(channel)
              return (
                <button
                  key={channel}
                  type="button"
                  onClick={() => toggleChannel(channel)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all border',
                    isActive
                      ? 'bg-primary-600 border-primary-500 text-white'
                      : 'bg-surface-800 border-surface-700 text-slate-400 hover:text-slate-200'
                  )}
                >
                  {channel.charAt(0).toUpperCase() + channel.slice(1)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={loading}
            className="btn-primary flex-1 justify-center"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={handleCancel} className="btn-outline">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-white">Profile Information</h2>
        <button
          onClick={() => setIsEditing(true)}
          className="p-2 text-slate-500 hover:text-slate-300 transition-colors"
          title="Edit profile"
        >
          <Edit2 size={16} />
        </button>
      </div>

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
            {user?.role?.replaceAll('_', ' ')}
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
        Click the edit icon to update your profile information. Note: Email and Employee ID cannot be changed.
      </p>
    </div>
  )
}

function PasswordTab() {
  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      await authAPI.changePassword(data.current_password, data.new_password)
      toast.success('Password changed successfully')
      setSuccess(true)
      reset()
      setTimeout(() => setSuccess(false), 4000)
    } catch (error) {
      // Normalize error to prevent rendering raw objects
      const errorMessage = getPrimaryErrorMessage(error)
      toast.error(errorMessage || 'Failed to change password')
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
            {...register('current_password', { 
              required: 'Current password is required',
              minLength: { value: 1, message: 'Password cannot be empty' }
            })}
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
              required: 'New password is required',
              minLength: { value: 8, message: 'At least 8 characters' },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\;'`~]).{8,}$/,
                message: 'Must contain uppercase, lowercase, number, and special character'
              }
            })}
            type="password"
            className="input"
            autoComplete="new-password"
            maxLength={128}
          />
          {errors.new_password && (
            <p className="text-xs text-danger-400 mt-1">{errors.new_password.message}</p>
          )}
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            {...register('confirm_password', {
              required: 'Please confirm your password',
              validate: value => value === watch('new_password') || 'Passwords do not match'
            })}
            type="password"
            className="input"
            autoComplete="new-password"
            maxLength={128}
          />
          {errors.confirm_password && (
            <p className="text-xs text-danger-400 mt-1">{errors.confirm_password.message}</p>
          )}
        </div>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Changing...' : 'Change Password'}
        </button>
      </form>

      <div className="mt-6 pt-5 border-t border-surface-700/40">
        <h3 className="text-sm font-medium text-slate-300 mb-2">Password Requirements</h3>
        <ul className="space-y-1 text-xs text-slate-500">
          <li>• Minimum 8 characters</li>
          <li>• Mix of uppercase and lowercase letters</li>
          <li>• At least one number</li>
          <li>• At least one special character</li>
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
        To change your notification preferences, please go to my profile page.
      </p>
    </div>
  )
}
