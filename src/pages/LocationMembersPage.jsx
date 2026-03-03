import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useParams } from 'react-router-dom'
import {
  Users, UserPlus, X, MapPin, Calendar, Clock, AlertCircle,
  CheckCircle, UserCheck, Filter, Search, Loader, Trash2, Info, RefreshCw
} from 'lucide-react'
import { locationAudienceAPI, usersAPI, locationsAPI, authAPI } from '@/services/api'
import toast from 'react-hot-toast'
import LocationAudienceMap from '@/components/LocationAudienceMap'

// Assignment type badge colors
const assignmentTypeColors = {
  manual: 'badge-blue',
  geofence: 'badge-green',
}

// Status badge colors
const statusColors = {
  active: 'badge-success',
  inactive: 'badge-gray',
}

/**
 * Modal to assign a user to a location
 */
function AssignUserModal({ locationId, locationName, onClose, onAssigned }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: {
      user_id: '',
      notes: '',
      expires_at: '',
    }
  })
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Fetch users for dropdown
  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ['users', 'active'],
    queryFn: () => usersAPI.list({ status: 'active' }).then(r => r.data).catch(err => {
      console.error('Failed to load users:', err)
      return []
    }),
    retry: 1,
  })

  // Filter users by search
  const filteredUsers = users.filter(user => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.department?.toLowerCase().includes(query)
    )
  })

  const assignMutation = useMutation({
    mutationFn: (data) => locationAudienceAPI.assignUser({
      ...data,
      user_id: parseInt(data.user_id),
      location_id: locationId,
    }),
    onSuccess: () => {
      toast.success('User assigned to location successfully')
      onAssigned()
      onClose()
    },
    onError: (err) => {
      const message = err.response?.data?.detail || 'Failed to assign user'
      toast.error(message)
    },
  })

  const onSubmit = (data) => {
    if (!data.user_id) {
      toast.error('Please select a user')
      return
    }
    assignMutation.mutate(data)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl animate-fade-in">
        <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-white">Assign User to Location</h2>
            <p className="text-sm text-slate-500 mt-1">{locationName}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>

        {usersError && (
          <div className="p-4 bg-danger-900/20 border border-danger-500/30 rounded-lg m-5">
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="text-danger-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-danger-300 font-medium">Failed to load users</p>
                <p className="text-xs text-danger-400 mt-1">
                  Please make sure you're logged in and have permission to view users.
                </p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {/* User Search */}
          <div>
            <label className="label">Select User *</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, email, or department..."
                className="input pl-10"
                disabled={usersLoading}
              />
            </div>

            {/* User Dropdown */}
            {searchQuery && (
              <div className="mt-2 max-h-60 overflow-y-auto border border-surface-700 rounded-lg bg-surface-800">
                {filteredUsers.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500 text-center">
                    No users found
                  </div>
                ) : (
                  <ul>
                    {filteredUsers.map(user => (
                      <li
                        key={user.id}
                        onClick={() => {
                          setValue('user_id', user.id.toString())
                          setSearchQuery('')
                        }}
                        className="px-4 py-3 hover:bg-surface-700 cursor-pointer transition-colors border-b border-surface-700/50 last:border-0"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center">
                            <Users size={16} className="text-primary-400" />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-white">{user.full_name}</div>
                            <div className="text-xs text-slate-500">{user.email}</div>
                            {user.department && (
                              <div className="text-xs text-slate-600 mt-0.5">{user.department}</div>
                            )}
                          </div>
                          {watch('user_id') === user.id.toString() && (
                            <CheckCircle size={18} className="text-success-400" />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Selected User Display */}
            {watch('user_id') && !searchQuery && (
              <div className="mt-2 p-3 bg-success-900/20 border border-success-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-success-400">
                  <CheckCircle size={16} />
                  <span className="text-sm">
                    User selected: {users.find(u => u.id.toString() === watch('user_id'))?.full_name}
                  </span>
                </div>
              </div>
            )}

            {errors.user_id && (
              <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                <AlertCircle size={11} /> {errors.user_id.message}
              </p>
            )}
            <p className="text-xs text-slate-500 mt-1">
              Search and select a user to assign to this location
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes (optional)</label>
            <textarea
              {...register('notes')}
              rows={2}
              className="input resize-none"
              placeholder="Reason for assignment, role at location, etc."
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="label">Expiration (optional)</label>
            <input
              {...register('expires_at')}
              type="datetime-local"
              className="input"
            />
            <p className="text-xs text-slate-500 mt-1">
              Assignment will automatically expire at this time
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !watch('user_id')}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? 'Assigning...' : 'Assign User'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

/**
 * Modal to view location member details
 */
function MemberDetailsModal({ member, onClose, onRemove }) {
  if (!member) return null

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-md animate-fade-in">
        <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
          <h2 className="font-display font-semibold text-white">Member Details</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-600/20 flex items-center justify-center">
              <Users size={24} className="text-primary-400" />
            </div>
            <div>
              <div className="font-semibold text-white">{member.user_name}</div>
              <div className="text-sm text-slate-500">{member.user_email}</div>
            </div>
          </div>

          {/* Assignment Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Assignment Type</span>
              <span className={assignmentTypeColors[member.assignment_type] || 'badge-gray'}>
                {member.assignment_type === 'manual' ? '📋 Manual' : '📍 Geofence'}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">Status</span>
              <span className={statusColors[member.status] || 'badge-gray'}>
                {member.status === 'active' ? '✓ Active' : '○ Inactive'}
              </span>
            </div>

            {member.assigned_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Assigned Date</span>
                <span className="text-sm text-white flex items-center gap-1">
                  <Calendar size={14} />
                  {new Date(member.assigned_at).toLocaleDateString()}
                </span>
              </div>
            )}

            {member.expires_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Expires</span>
                <span className="text-sm text-white flex items-center gap-1">
                  <Clock size={14} />
                  {new Date(member.expires_at).toLocaleDateString()}
                </span>
              </div>
            )}

            {member.distance_from_center_miles && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Distance from Center</span>
                <span className="text-sm text-white">
                  {member.distance_from_center_miles.toFixed(2)} miles
                </span>
              </div>
            )}

            {member.assigned_by_name && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">Assigned By</span>
                <span className="text-sm text-white flex items-center gap-1">
                  <UserCheck size={14} />
                  {member.assigned_by_name}
                </span>
              </div>
            )}

            {member.notes && (
              <div>
                <span className="text-sm text-slate-500">Notes</span>
                <p className="text-sm text-white mt-1 p-2 bg-surface-800 rounded">
                  {member.notes}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          {member.status === 'active' && member.assignment_type === 'manual' && (
            <div className="pt-4 border-t border-surface-700">
              <button
                onClick={() => {
                  onRemove(member)
                  onClose()
                }}
                className="btn-danger w-full justify-center"
              >
                <Trash2 size={16} />
                Remove from Location
              </button>
            </div>
          )}

          {member.assignment_type === 'geofence' && (
            <div className="pt-4 border-t border-surface-700">
              <div className="p-3 bg-info-900/20 border border-info-500/30 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-info-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-info-300">
                    This user was automatically assigned based on their geolocation.
                    To remove them, you can use the Remove button, or they will be
                    automatically removed when they move outside the geofence.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Location Members Management Page
 */
export default function LocationMembersPage() {
  const { locationId } = useParams()
  const qc = useQueryClient()
  const [assignModal, setAssignModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState(null)
  const [removeConfirm, setRemoveConfirm] = useState(null)
  const [statusFilter, setStatusFilter] = useState('active')
  const [typeFilter, setTypeFilter] = useState('all')
  const [checkingLocation, setCheckingLocation] = useState(false)

  // Validate locationId
  if (!locationId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-slate-500">
          <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg">No location selected</p>
          <p className="text-sm mt-1">Please select a location from the Locations page</p>
        </div>
      </div>
    )
  }

  // Fetch location members
  const { data: membersData, isLoading, refetch } = useQuery({
    queryKey: ['location-members', locationId, statusFilter, typeFilter],
    queryFn: () => {
      const params = {
        page: 1,
        page_size: 100,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(typeFilter !== 'all' && { assignment_type: typeFilter }),
      }
      return locationAudienceAPI.getLocationMembers(locationId, params).then(r => r.data).catch(err => {
        console.error('Failed to load members:', err)
        return { total: 0, items: [] }
      })
    },
  })

  // Fetch location details
  const { data: location } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsAPI.list().then(r => r.data.find(l => l.id === locationId)),
    enabled: !!locationId,
  })

  // Remove user mutation
  const removeMutation = useMutation({
    mutationFn: ({ userId, reason }) =>
      locationAudienceAPI.removeUser(userId, locationId, reason),
    onSuccess: () => {
      toast.success('User removed from location')
      refetch()
      setRemoveConfirm(null)
    },
    onError: (err) => {
      const message = err.response?.data?.detail || 'Failed to remove user'
      toast.error(message)
    },
  })

  const handleRemove = (member) => {
    if (window.confirm(`Remove ${member.user_name} from this location?`)) {
      removeMutation.mutate({ userId: member.user_id, reason: 'Manual removal' })
    }
  }

  // Manual geofence check - trigger user location update
  const handleCheckMyLocation = async () => {
    setCheckingLocation(true)
    try {
      // Get user's current location from browser
      if (!navigator.geolocation) {
        toast.error('Geolocation is not supported by your browser')
        return
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        })
      })

      const { latitude, longitude } = position.coords

      // Call API to update geofence
      await locationAudienceAPI.updateGeofence(latitude, longitude)

      toast.success(`Location updated! Checking geofences...`)
      
      // Refresh the members list after a short delay (allow Celery to process)
      setTimeout(() => {
        refetch()
      }, 2000)

    } catch (err) {
      console.error('Geofence check failed:', err)
      if (err.code === 1) {
        toast.error('Location permission denied. Please enable location access.')
      } else if (err.code === 2) {
        toast.error('Unable to retrieve your location. Please try again.')
      } else {
        const message = err.response?.data?.detail || 'Failed to update location'
        toast.error(message)
      }
    } finally {
      setCheckingLocation(false)
    }
  }

  const members = membersData?.items || []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 hover:bg-surface-800 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-400" />
            </button>
            <h1 className="font-display font-bold text-2xl text-white">
              {location?.name || 'Location Members'}
            </h1>
          </div>
          <p className="text-slate-500 text-sm mt-1">
            Manage user assignments for this location
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCheckMyLocation}
            disabled={checkingLocation}
            className="btn-outline flex items-center gap-2"
            title="Trigger geofence check with your current location"
          >
            <RefreshCw size={18} className={checkingLocation ? 'animate-spin' : ''} />
            Check My Location
          </button>
          <button
            onClick={() => setAssignModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus size={18} />
            Assign User
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-600/20 flex items-center justify-center">
              <Users size={20} className="text-primary-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{membersData?.total || 0}</div>
              <div className="text-xs text-slate-500">Total Members</div>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
              <UserCheck size={20} className="text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {members.filter(m => m.assignment_type === 'manual').length}
              </div>
              <div className="text-xs text-slate-500">Manual</div>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-600/20 flex items-center justify-center">
              <MapPin size={20} className="text-green-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {members.filter(m => m.assignment_type === 'geofence').length}
              </div>
              <div className="text-xs text-slate-500">Geofence</div>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-success-600/20 flex items-center justify-center">
              <CheckCircle size={20} className="text-success-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {members.filter(m => m.status === 'active').length}
              </div>
              <div className="text-xs text-slate-500">Active</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-500" />
            <span className="text-sm text-slate-500">Filters:</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select text-sm py-1.5"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="select text-sm py-1.5"
            >
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="geofence">Geofence</option>
            </select>
          </div>
        </div>
      </div>

      {/* Members List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-surface-900/50">
              <tr className="border-b border-surface-700/60">
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  User
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Assignment Type
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Assigned Date
                </th>
                <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Distance
                </th>
                <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-700/60">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-center py-10">
                    <div className="flex items-center justify-center gap-2 text-slate-500">
                      <Loader size={18} className="animate-spin" />
                      Loading members...
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && members.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-500">
                    <Users size={48} className="mx-auto mb-3 opacity-50" />
                    <p>No members found for this location</p>
                    <p className="text-xs mt-1">
                      {statusFilter !== 'all' || typeFilter !== 'all'
                        ? 'Try adjusting your filters'
                        : 'Assign users manually or they will be added automatically via geofence'}
                    </p>
                  </td>
                </tr>
              )}

              {members.map((member) => (
                <tr key={member.id} className="table-row hover:bg-surface-900/30">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary-600/20 flex items-center justify-center">
                        <Users size={18} className="text-primary-400" />
                      </div>
                      <div>
                        <div className="font-medium text-white">{member.user_name}</div>
                        <div className="text-xs text-slate-500">{member.user_email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={assignmentTypeColors[member.assignment_type] || 'badge-gray'}>
                      {member.assignment_type === 'manual' ? '📋 Manual' : '📍 Geofence'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={statusColors[member.status] || 'badge-gray'}>
                      {member.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400">
                    {member.assigned_at ? new Date(member.assigned_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-400">
                    {member.distance_from_center_miles
                      ? `${member.distance_from_center_miles.toFixed(2)} mi`
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedMember(member)}
                        className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-surface-700 rounded"
                        title="View details"
                      >
                        <Info size={16} />
                      </button>
                      {member.status === 'active' && member.assignment_type === 'manual' && (
                        <button
                          onClick={() => handleRemove(member)}
                          className="p-1.5 text-slate-500 hover:text-danger-400 hover:bg-surface-700 rounded"
                          title="Remove"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Map View */}
      {location && (
        <div className="card p-4">
          <h3 className="font-semibold text-white mb-3">Location Map</h3>
          <div className="h-96 rounded-lg overflow-hidden">
            <LocationAudienceMap
              height={384}
              showGeofences={true}
              showUsers={false}
            />
          </div>
        </div>
      )}

      {/* Modals */}
      {assignModal && (
        <AssignUserModal
          locationId={locationId}
          locationName={location?.name}
          onClose={() => setAssignModal(false)}
          onAssigned={() => {
            refetch()
            setAssignModal(false)
          }}
        />
      )}

      {selectedMember && (
        <MemberDetailsModal
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onRemove={(member) => handleRemove(member)}
        />
      )}
    </div>
  )
}
