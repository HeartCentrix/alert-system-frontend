import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, MapPin, Users, FileText, AlertTriangle, CheckCircle, UserPlus, X, Search } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { groupsAPI, locationsAPI, templatesAPI, incidentsAPI, usersAPI } from '@/services/api'
import { cn, timeAgo, severityColor } from '@/utils/helpers'
import toast from 'react-hot-toast'
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

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

// Modal for adding members to a group
function GroupMembersModal({ group, onClose, onSaved }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const [loading, setLoading] = useState(false)

  const { user: currentUser } = useAuthStore()
  const isManagerOrAbove = ['manager', 'admin', 'super_admin'].includes(currentUser?.role)
  const isAdminOrAbove = ['admin', 'super_admin'].includes(currentUser?.role)

  // Fetch all users for selection (managers and above can see all users)
  const { data: usersData } = useQuery({
    queryKey: ['users-all', search],
    queryFn: () => usersAPI.list({ search, page: 1, page_size: 100 }).then(r => r.data.items),
    enabled: isManagerOrAbove,
    staleTime: 2 * 60 * 1000,
  })

  const users = usersData || []

  // Fetch group details to see current members
  const { data: groupDetails } = useQuery({
    queryKey: ['group', group.id],
    queryFn: () => groupsAPI.get(group.id).then(r => r.data),
  })

  const currentMemberIds = groupDetails?.members?.map(m => m.id) || []
  const isMemberOfGroup = currentMemberIds.includes(currentUser?.id)

  // Filter out users who are already members
  const availableUsers = users.filter(u => !currentMemberIds.includes(u.id))

  const toggleUser = (user) => {
    setSelectedUsers(prev =>
      prev.find(u => u.id === user.id)
        ? prev.filter(u => u.id !== user.id)
        : [...prev, user]
    )
  }

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) {
      toast.error('Please select at least one user')
      return
    }

    setLoading(true)
    try {
      await groupsAPI.addMembers(group.id, selectedUsers.map(u => u.id))
      toast.success(`Added ${selectedUsers.length} member${selectedUsers.length > 1 ? 's' : ''} to group`)
      onSaved()
      onClose()
    } catch (err) {
      toast.error('Error adding members')
    } finally {
      setLoading(false)
    }
  }

  // Can manage members if: admin+, OR (manager+ AND member of this group)
  const canManageMembers = isManagerOrAbove && (isAdminOrAbove || isMemberOfGroup)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="card w-full max-w-2xl animate-fade-in max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
          <div>
            <h2 className="font-display font-semibold text-white">Manage Members</h2>
            <p className="text-slate-500 text-sm mt-1">{group.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          {/* Current Members */}
          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">
              Current Members ({currentMemberIds.length})
            </h3>
            {groupDetails?.members?.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {groupDetails.members.map(member => (
                  <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 border border-surface-700/50">
                    <div className="w-8 h-8 rounded-full bg-primary-600/20 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary-400">
                        {getInitials(`${member.first_name} ${member.last_name}`)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                    </div>
                    <span className="text-xs text-slate-500 capitalize">{member.role}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No members yet</p>
            )}
          </div>

          {/* Add New Members */}
          {canManageMembers && (
            <div className="border-t border-surface-700/40 pt-4">
              <h3 className="text-sm font-medium text-slate-300 mb-3">Add Members</h3>

              {/* Search */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  className="input pl-10"
                  placeholder="Search by name, email, or department..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Available Users */}
              <div className="max-h-64 overflow-y-auto space-y-2">
                {availableUsers.length > 0 ? (
                  availableUsers.map(user => {
                    const isSelected = selectedUsers.find(u => u.id === user.id)
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggleUser(user)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'bg-primary-600/20 border-primary-600/50'
                            : 'bg-surface-800/50 border-surface-700/50 hover:border-surface-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                          isSelected ? 'bg-primary-600 border-primary-600' : 'border-slate-600'
                        }`}>
                          {isSelected && <CheckCircle size={12} className="text-white" />}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-surface-700 flex items-center justify-center">
                          <span className="text-xs font-medium text-slate-300">
                            {getInitials(`${user.first_name} ${user.last_name}`)}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-sm font-medium text-slate-200 truncate">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{user.email}</p>
                        </div>
                        <span className="text-xs text-slate-500 capitalize">{user.role}</span>
                      </button>
                    )
                  })
                ) : (
                  <p className="text-sm text-slate-500 text-center py-4">
                    {search ? 'No users found' : 'All users are already members'}
                  </p>
                )}
              </div>

              {/* Selected Count */}
              {selectedUsers.length > 0 && (
                <div className="mt-4 p-3 rounded-lg bg-primary-600/10 border border-primary-600/30">
                  <p className="text-sm text-primary-300">
                    {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-surface-700/40 flex gap-3">
          {canManageMembers ? (
            <>
              <button
                onClick={handleAddMembers}
                disabled={loading || selectedUsers.length === 0}
                className="btn-primary flex-1 justify-center"
              >
                {loading ? 'Adding...' : `Add ${selectedUsers.length > 0 ? selectedUsers.length : ''} Member${selectedUsers.length > 1 ? 's' : ''}`}
              </button>
              <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            </>
          ) : (
            <button type="button" onClick={onClose} className="btn-primary flex-1 justify-center">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper function for getting initials
function getInitials(name) {
  if (!name) return '??'
  const parts = name.split(' ').filter(Boolean)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export function GroupsPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [membersModal, setMembersModal] = useState(null)
  const { user: currentUser } = useAuthStore()
  const isManagerOrAbove = ['manager', 'admin', 'super_admin'].includes(currentUser?.role)
  const isAdminOrAbove = ['admin', 'super_admin'].includes(currentUser?.role)

  // Fetch all groups list - called every time user navigates to Groups page
  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsAPI.list().then(r => r.data),
    refetchOnMount: 'always',
    staleTime: 0,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => groupsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['groups']); toast.success('Group deleted') },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to delete group')
    },
  })
  
  // Check if user can manage members for a specific group
  // Manager: can only manage groups they are a member of
  // Admin/Super Admin: can manage all groups
  const canManageGroupMembers = (group) => {
    if (!isManagerOrAbove) return false
    if (isAdminOrAbove) return true
    return true // Manager sees only their groups in the list
  }
  
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
              {['Name', 'People', 'Added On', 'Type', ...(isManagerOrAbove ? ['Actions'] : [])].map(h => (
                <th key={h} className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={isManagerOrAbove ? 5 : 4} className="text-center py-10 text-slate-500">Loading...</td></tr>}
            {!isLoading && groups.length === 0 && <tr><td colSpan={isManagerOrAbove ? 5 : 4} className="text-center py-10 text-slate-500 text-sm">No groups yet</td></tr>}
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
                {isManagerOrAbove && (
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      {canManageGroupMembers(g) && (
                        <button
                          onClick={() => setMembersModal(g)}
                          className="p-1.5 text-slate-500 hover:text-primary-400"
                          title="Manage Members"
                        >
                          <UserPlus size={14} />
                        </button>
                      )}
                      <button onClick={() => setModal(g)} className="p-1.5 text-slate-500 hover:text-slate-300"><Edit2 size={14} /></button>
                      <button onClick={() => confirm('Delete group?') && deleteMutation.mutate(g.id)} className="p-1.5 text-slate-500 hover:text-danger-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <GroupModal group={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => qc.invalidateQueries(['groups'])} />}
      {membersModal && (
        <GroupMembersModal
          group={membersModal}
          onClose={() => setMembersModal(null)}
          onSaved={() => qc.invalidateQueries(['groups'])}
        />
      )}
    </div>
  )
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────

function LocationModal({ location, onClose, onSaved }) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm({
    defaultValues: location || { country: 'USA', geofence_radius_miles: 1.0 }
  })
  const [loading, setLoading] = useState(false)

  // Watch location name and coordinates for autocomplete
  const locationName = watch('name')
  const latitude = watch('latitude')
  const longitude = watch('longitude')

  // Custom validation for location name
  const validateLocationName = (value) => {
    if (!value || !value.trim()) {
      return 'Location name is required'
    }
    if (value.trim().length < 3) {
      return 'Location name must be at least 3 characters'
    }
    return true
  }

  // Register validation for name field
  useEffect(() => {
    register('name', {
      required: 'Location name is required',
      validate: validateLocationName,
    })
  }, [register])

  // Handle location selection from autocomplete
  const handleLocationSelect = ({ display_name, latitude, longitude, address }) => {
    // Fill in the address fields from the selected location
    setValue('address', display_name, { shouldValidate: true })
    setValue('latitude', latitude, { shouldValidate: true })
    setValue('longitude', longitude, { shouldValidate: true })
    if (address?.city) setValue('city', address.city, { shouldValidate: true })
    if (address?.state) setValue('state', address.state, { shouldValidate: true })
    if (address?.postcode) setValue('zip_code', address.postcode, { shouldValidate: true })
    if (address?.country) setValue('country', address.country, { shouldValidate: true })
  }

  // Handle manual edit (clear lat/lon)
  const handleLocationClear = () => {
    setValue('latitude', null)
    setValue('longitude', null)
    setValue('address', '')
    setValue('city', '')
    setValue('state', '')
    setValue('zip_code', '')
  }

  // Custom validation to ensure coordinates are filled
  const validateCoordinates = () => {
    const lat = watch('latitude')
    const lon = watch('longitude')
    if (!lat || !lon) {
      return 'Please select a location from the suggestions'
    }
    return true
  }

  const onSubmit = async (data) => {
    // Validate coordinates before submit
    const coordValidation = validateCoordinates()
    if (coordValidation !== true) {
      toast.error(coordValidation)
      return
    }

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
            <LocationAutocompleteInput
              value={locationName || ''}
              onChange={(e) => setValue('name', e.target.value)}
              latitude={watch('latitude')}
              longitude={watch('longitude')}
              onLocationSelect={handleLocationSelect}
              onLocationClear={handleLocationClear}
              placeholder="Search for a location (e.g., New Delhi, India)"
              clearable
              required
              options={{
                // Removed countrycodes restriction to allow global search
                // Add countrycodes: 'us' if you want to restrict to US only
                limit: 10,
                debounceMs: 450, // Optimized debounce
                minRequestInterval: 800, // Rate limiting: 800ms between API calls
                maxCacheSize: 20, // localStorage cache size
                cacheTTL: 600000, // 10 minutes cache TTL
              }}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                <AlertCircle size={11} /> {errors.name.message}
              </p>
            )}
            {!errors.name && (
              <p className="text-xs text-slate-500 mt-1">
                Start typing to search. Select a location to auto-fill coordinates.
              </p>
            )}
          </div>
          <div>
            <label className="label">Street Address</label>
            <input {...register('address')} className="input" placeholder="Auto-filled when you select a location" />
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
              <input 
                {...register('latitude', { valueAsNumber: true })} 
                type="number" 
                step="any" 
                className="input font-mono text-sm" 
                placeholder="33.4484"
                readOnly
              />
              <p className="text-xs text-slate-500 mt-1">Auto-filled from selection</p>
            </div>
            <div>
              <label className="label">Longitude</label>
              <input 
                {...register('longitude', { valueAsNumber: true })} 
                type="number" 
                step="any" 
                className="input font-mono text-sm" 
                placeholder="-112.074"
                readOnly
              />
              <p className="text-xs text-slate-500 mt-1">Auto-filled from selection</p>
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
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsAPI.list().then(r => r.data),
    refetchInterval: 30000,
  })
  const deleteMutation = useMutation({
    mutationFn: (id) => locationsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['locations']); toast.success('Location deleted') },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to delete location')
    },
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
                <button
                  onClick={() => navigate(`/locations/${loc.id}/members`)}
                  className="p-1.5 text-slate-500 hover:text-primary-400 hover:bg-surface-700 rounded"
                  title="Manage members"
                >
                  <UserPlus size={14} />
                </button>
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

  const deleteMutation = useMutation({
    mutationFn: (id) => templatesAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(['templates']); toast.success('Template deleted') },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to delete template')
    },
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
                <button onClick={() => { if (confirm('Delete?')) deleteMutation.mutate(t.id) }} className="p-1.5 text-slate-500 hover:text-danger-400"><Trash2 size={13} /></button>
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
