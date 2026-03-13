import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, MapPin, Users, FileText, AlertTriangle, CheckCircle, UserPlus, X, Search, AlertCircle, ChevronRight, ChevronLeft } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { groupsAPI, locationsAPI, templatesAPI, incidentsAPI, usersAPI } from '@/services/api'
import { cn, timeAgo, severityColor } from '@/utils/helpers'
import toast from 'react-hot-toast'
import LocationAutocompleteInput from '@/components/LocationAutocompleteInput'
import { useNavigate, useSearchParams } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import { useIsDocumentVisible } from '@/hooks/useVisibility'
import ModalPortal from '@/components/ui/ModalPortal'

// ─── GROUPS ───────────────────────────────────────────────────────────────────

function GroupModal({ group, onClose, onSaved }) {
  const { register, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: group || { type: 'static', dynamic_filter: {} }
  })
  const [loading, setLoading] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState(null)
  const [filterOptions, setFilterOptions] = useState({ departments: [], titles: [], roles: [] })

  const queryClient = useQueryClient()

  const type = watch('type')
  const dynamicFilter = watch('dynamic_filter')

  // Fetch filter options for dynamic groups
  const { data: optionsData } = useQuery({
    queryKey: ['group-filter-options'],
    queryFn: () => groupsAPI.getFilterOptions().then(r => r.data),
    enabled: type === 'dynamic',
    staleTime: 0, // Always refetch to get latest departments/titles
    refetchOnWindowFocus: 'always',
  })

  // Reset form when group prop changes (prevents stale values on re-mount)
  useEffect(() => {
    reset(group || { type: 'static', dynamic_filter: {} })
    setPreviewData(null)
  }, [group, reset])

  // Update filter options when data is fetched
  useEffect(() => {
    if (optionsData) {
      setFilterOptions(optionsData)
    }
  }, [optionsData])

  // Preview dynamic group members
  const handlePreview = async () => {
    const filter = dynamicFilter || {}
    // Check if at least one filter has a real value (not empty string, null, or undefined)
    const hasValidFilter = (
      (filter.department && filter.department.trim() !== '') ||
      (filter.title && filter.title.trim() !== '') ||
      (filter.role && filter.role.trim() !== '')
    )

    if (!hasValidFilter) {
      toast.error('Please select at least one filter criteria')
      return
    }

    setPreviewLoading(true)
    try {
      const response = await groupsAPI.preview({
        name: watch('name') || 'Preview',
        type: 'dynamic',
        dynamic_filter: filter
      })
      setPreviewData(response.data)
      toast.success(`Found ${response.data.member_count} matching users`)
    } catch (error) {
      const errorMessage = error.response?.data?.detail ||
                          (typeof error.response?.data?.detail === 'object'
                            ? error.response.data.detail.message
                            : 'Error previewing group')
      toast.error(errorMessage || 'Error previewing group')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Set dynamic filter value - use null for empty values instead of empty string
  const updateDynamicFilter = (field, value) => {
    const current = dynamicFilter || {}
    const updated = { ...current }
    
    // Only set the field if value is truthy and not empty string
    if (value && value.trim() !== '') {
      updated[field] = value
    } else {
      // Remove the field entirely instead of setting to empty string
      delete updated[field]
    }
    
    setValue('dynamic_filter', updated)
    setPreviewData(null) // Clear preview when filter changes
  }

  const onSubmit = async (data) => {
    setLoading(true)
    try {
      // For dynamic groups, ensure dynamic_filter is included
      if (data.type === 'dynamic' && !data.dynamic_filter) {
        data.dynamic_filter = {}
      }
      group ? await groupsAPI.update(group.id, data) : await groupsAPI.create(data)
      // Invalidate and refetch filter options to refresh the cached data
      await queryClient.invalidateQueries({ queryKey: ['group-filter-options'], refetchType: 'all' })
      toast.success(group ? 'Group updated' : 'Group created')
      onSaved(); onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Error saving group')
    }
    finally { setLoading(false) }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay">
        <div className="card w-full max-w-lg animate-fade-in">
          <div className="p-5 border-b border-surface-700/40 flex items-center justify-between">
            <h2 className="font-display font-semibold text-white">{group ? 'Edit Group' : 'New Group'}</h2>
            <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">×</button>
          </div>
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="label">Group Name *</label>
            <input {...register('name', { required: true })} className="input" placeholder="e.g. IT Department" />
          </div>
          <div>
            <label className="label">Description</label>
            <input {...register('description')} className="input" placeholder="Optional description" />
          </div>
          <div>
            <label className="label">Type</label>
            <select {...register('type')} className="select">
              <option value="static">Static (manually managed)</option>
              <option value="dynamic">Dynamic (auto-filtered)</option>
            </select>
          </div>

          {/* Dynamic Group Filters */}
          {type === 'dynamic' && (
            <div className="p-4 bg-surface-800/50 rounded-lg space-y-3">
              <h3 className="text-sm font-semibold text-white">Filter Criteria</h3>
              <p className="text-xs text-slate-400">Users matching these criteria will be automatically included</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Department</label>
                  <input
                    list="group-dept-options"
                    className="input text-sm"
                    placeholder="Select or type department"
                    value={dynamicFilter?.department || ''}
                    onChange={(e) => updateDynamicFilter('department', e.target.value)}
                  />
                  <datalist id="group-dept-options">
                    {filterOptions.departments.map(dept => (
                      <option key={dept} value={dept} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label text-xs">Title</label>
                  <input
                    list="group-title-options"
                    className="input text-sm"
                    placeholder="Select or type title"
                    value={dynamicFilter?.title || ''}
                    onChange={(e) => updateDynamicFilter('title', e.target.value)}
                  />
                  <datalist id="group-title-options">
                    {filterOptions.titles.map(title => (
                      <option key={title} value={title} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="label text-xs">Role</label>
                  <select
                    className="select text-sm"
                    value={dynamicFilter?.role || ''}
                    onChange={(e) => updateDynamicFilter('role', e.target.value)}
                  >
                    <option value="">Select role</option>
                    {filterOptions.roles.map(role => (
                      <option key={role} value={role}>{role.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                type="button" 
                onClick={handlePreview}
                disabled={previewLoading}
                className="w-full btn-outline text-sm py-2"
              >
                {previewLoading ? 'Loading...' : 'Preview Members'}
              </button>

              {/* Preview Results */}
              {previewData && (
                <div className="mt-3 p-3 bg-surface-900/50 rounded border border-surface-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-emerald-400">
                      {previewData.member_count} Matching Users
                    </span>
                  </div>
                  {previewData.member_count > 0 ? (
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {previewData.members.slice(0, 10).map(member => (
                        <div key={member.id} className="text-xs text-slate-300 flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="truncate">{member.full_name}</span>
                          <span className="text-slate-500">({member.email})</span>
                        </div>
                      ))}
                      {previewData.member_count > 10 && (
                        <div className="text-xs text-slate-500 pt-1">
                          +{previewData.member_count - 10} more...
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">No users match the selected criteria</div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 justify-center">
              {loading ? 'Saving...' : group ? 'Save' : 'Create Group'}
            </button>
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
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
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Error adding members')
      toast.error(errorMessage || 'Error adding members')
    } finally {
      setLoading(false)
    }
  }

  // Can manage members if: admin+, OR (manager+ AND member of this group)
  const canManageMembers = isManagerOrAbove && (isAdminOrAbove || isMemberOfGroup)

  return (
    <ModalPortal>
      <div className="modal-overlay">
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
    </ModalPortal>
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
  const { data: groupsData, isLoading } = useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsAPI.list().then(r => r.data),
    refetchOnMount: 'always',
    staleTime: 0,
  })
  const groups = groupsData || []

  const deleteMutation = useMutation({
    mutationFn: (id) => groupsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['groups'] }); toast.success('Group deleted') },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Failed to delete group')
      toast.error(errorMessage || 'Failed to delete group')
    },
  })

  const isDeleting = (id) => deleteMutation.isPending && deleteMutation.variables === id
  
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
                  <div className="space-y-1">
                    <span className={g.type === 'dynamic' ? 'badge-blue' : 'badge-gray'}>
                      {g.type === 'dynamic' ? '⟳ Dynamic' : 'Static'}
                    </span>
                    {g.type === 'dynamic' && g.dynamic_filter && (
                      <div className="text-xs text-slate-400">
                        {g.dynamic_filter.department && (
                          <span className="inline-block bg-surface-700 px-1.5 py-0.5 rounded mr-1">{g.dynamic_filter.department}</span>
                        )}
                        {g.dynamic_filter.title && (
                          <span className="inline-block bg-surface-700 px-1.5 py-0.5 rounded mr-1">{g.dynamic_filter.title}</span>
                        )}
                        {g.dynamic_filter.role && (
                          <span className="inline-block bg-surface-700 px-1.5 py-0.5 rounded mr-1">{g.dynamic_filter.role.replace('_', ' ')}</span>
                        )}
                      </div>
                    )}
                  </div>
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
                      <button
                        onClick={() => setModal(g)}
                        className="p-1.5 text-slate-500 hover:text-slate-300"
                        disabled={isDeleting(g.id)}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => confirm('Delete group?') && deleteMutation.mutate(g.id)}
                        disabled={isDeleting(g.id)}
                        className={cn(
                          "p-1.5 transition-colors",
                          isDeleting(g.id)
                            ? "text-slate-700 cursor-not-allowed"
                            : "text-slate-500 hover:text-danger-400"
                        )}
                      >
                        {isDeleting(g.id) ? (
                          <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <GroupModal group={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['groups'] })} />}
      {membersModal && (
        <GroupMembersModal
          group={membersModal}
          onClose={() => setMembersModal(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ['groups'] })}
        />
      )}
    </div>
  )
}

// ─── LOCATIONS ────────────────────────────────────────────────────────────────

function LocationModal({ location, onClose, onSaved }) {
  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm({
    defaultValues: location || { country: 'USA', geofence_radius_miles: 1.0 }
  })
  const [loading, setLoading] = useState(false)

  // Reset form when location prop changes (prevents stale values on re-mount)
  useEffect(() => {
    reset(location || { country: 'USA', geofence_radius_miles: 1.0 })
  }, [location, reset])

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
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Error saving location')
      toast.error(errorMessage || 'Error saving location')
    }
    finally { setLoading(false) }
  }
  
  return (
    <ModalPortal>
      <div className="modal-overlay">
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
    </ModalPortal>
  )
}

export function LocationsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [modal, setModal] = useState(null)
  const isVisible = useIsDocumentVisible()
  const { data: locationsData, isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsAPI.list().then(r => r.data),
    refetchInterval: isVisible ? 30000 : false,
  })
  const locations = locationsData || []
  const deleteMutation = useMutation({
    mutationFn: (id) => locationsAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['locations'] }); toast.success('Location deleted') },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Failed to delete location')
      toast.error(errorMessage || 'Failed to delete location')
    },
  })

  const isDeleting = (id) => deleteMutation.isPending && deleteMutation.variables === id
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
                  disabled={isDeleting(loc.id)}
                >
                  <UserPlus size={14} />
                </button>
                <button
                  onClick={() => setModal(loc)}
                  className="p-1.5 text-slate-500 hover:text-slate-300"
                  disabled={isDeleting(loc.id)}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => confirm('Delete?') && deleteMutation.mutate(loc.id)}
                  disabled={isDeleting(loc.id)}
                  className={cn(
                    "p-1.5 transition-colors",
                    isDeleting(loc.id)
                      ? "text-slate-700 cursor-not-allowed"
                      : "text-slate-500 hover:text-danger-400"
                  )}
                >
                  {isDeleting(loc.id) ? (
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
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
      {modal && <LocationModal location={modal === 'create' ? null : modal} onClose={() => setModal(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['locations'] })} />}
    </div>
  )
}

// ─── TEMPLATES ────────────────────────────────────────────────────────────────

export function TemplatesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesAPI.list().then(r => r.data),
  })
  const templates = templatesData || []

  const deleteMutation = useMutation({
    mutationFn: (id) => templatesAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['templates'] }); toast.success('Template deleted') },
    onError: (error) => {
      const errorMessage = error.response?.data?.detail || 
                          (typeof error.response?.data?.detail === 'object' 
                            ? error.response.data.detail.message 
                            : 'Failed to delete template')
      toast.error(errorMessage || 'Failed to delete template')
    },
  })

  const isDeleting = (id) => deleteMutation.isPending && deleteMutation.variables === id

  function TemplateModal({ template, onClose }) {
    const { register, handleSubmit, reset } = useForm({ defaultValues: template || { channels: ['sms', 'email'] } })
    const [loading, setLoading] = useState(false)

    // Reset form when template prop changes (prevents stale values on re-mount)
    useEffect(() => {
      reset(template || { channels: ['sms', 'email'] })
    }, [template, reset])
    const onSubmit = async (data) => {
      setLoading(true)
      try {
        template ? await templatesAPI.update(template.id, data) : await templatesAPI.create(data)
        toast.success('Template saved')
        qc.invalidateQueries({ queryKey: ['templates'] }); onClose()
      } catch (error) {
        const errorMessage = error.response?.data?.detail || 
                            (typeof error.response?.data?.detail === 'object' 
                              ? error.response.data.detail.message 
                              : 'Error saving template')
        toast.error(errorMessage || 'Error saving template')
      }
      finally { setLoading(false) }
    }
    return (
      <ModalPortal>
        <div className="modal-overlay">
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
    </ModalPortal>
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
                <button
                  onClick={() => setModal(t)}
                  className="p-1.5 text-slate-500 hover:text-slate-300"
                  disabled={isDeleting(t.id)}
                >
                  <Edit2 size={13} />
                </button>
                <button
                  onClick={() => { if (confirm(`Delete template "${t.name}"? This action cannot be undone.`)) deleteMutation.mutate(t.id) }}
                  disabled={isDeleting(t.id)}
                  className={cn(
                    "p-1.5 transition-colors",
                    isDeleting(t.id)
                      ? "text-slate-700 cursor-not-allowed"
                      : "text-slate-500 hover:text-danger-400"
                  )}
                >
                  {isDeleting(t.id) ? (
                    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <Trash2 size={13} />
                  )}
                </button>
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || 'all')
  const isVisible = useIsDocumentVisible()
  const { data: incidentsData, isLoading } = useQuery({
    queryKey: ['incidents'],
    queryFn: () => incidentsAPI.list().then(r => r.data),
    refetchInterval: isVisible ? 30000 : false,
  })
  const incidents = incidentsData || []

  // Filter incidents based on selected tab
  const filteredIncidents = statusFilter === 'all' 
    ? incidents 
    : incidents.filter(i => i.status === statusFilter)

  // Count by status
  const counts = {
    all: incidents.length,
    active: incidents.filter(i => i.status === 'active').length,
    monitoring: incidents.filter(i => i.status === 'monitoring').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
    cancelled: incidents.filter(i => i.status === 'cancelled').length,
  }

  // Sync status filter with URL params
  useEffect(() => {
    const params = new URLSearchParams(searchParams)
    if (statusFilter === 'all') {
      params.delete('status')
    } else {
      params.set('status', statusFilter)
    }
    setSearchParams(params, { replace: true })
  }, [statusFilter])

  function IncidentModal({ incident, onClose }) {
    const { register, handleSubmit, reset } = useForm({ defaultValues: incident || { severity: 'medium' } })
    const [loading, setLoading] = useState(false)

    // Reset form when incident prop changes (prevents stale values on re-mount)
    useEffect(() => {
      reset(incident || { severity: 'medium' })
    }, [incident, reset])
    const onSubmit = async (data) => {
      setLoading(true)
      try {
        incident ? await incidentsAPI.update(incident.id, data) : await incidentsAPI.create(data)
        toast.success(incident ? 'Incident updated' : 'Incident created')
        qc.invalidateQueries({ queryKey: ['incidents'] }); onClose()
      } catch (error) {
        const errorMessage = error.response?.data?.detail || 
                            (typeof error.response?.data?.detail === 'object' 
                              ? error.response.data.detail.message 
                              : 'Error saving incident')
        toast.error(errorMessage || 'Error saving incident')
      }
      finally { setLoading(false) }
    }
    return (
      <ModalPortal>
        <div className="modal-overlay">
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
                  {['active', 'monitoring', 'resolved', 'cancelled'].map(s => <option key={s} value={s}>{s}</option>)}
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
    </ModalPortal>
    )
  }

  const statusTabs = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'monitoring', label: 'Monitoring' },
    { key: 'resolved', label: 'Resolved' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-white">Incidents</h1>
          <p className="text-slate-500 text-sm">
            {counts.active} active · {counts.monitoring} monitoring · {counts.resolved} resolved · {counts.cancelled} cancelled
          </p>
        </div>
        <button onClick={() => setModal('create')} className="btn-primary">
          <AlertTriangle size={14} /> + New Incident
        </button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-1 p-1 bg-surface-900 rounded-lg border border-surface-700/60 w-fit">
        {statusTabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
              statusFilter === tab.key
                ? 'bg-surface-700 text-white'
                : 'text-slate-500 hover:text-slate-300'
            )}
          >
            {tab.label} ({counts[tab.key]})
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-surface-700/60">
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-5 py-3">Incident</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Status</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Severity</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Type</th>
              <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-3 py-3">Created</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">Loading...</td></tr>
            )}
            {!isLoading && filteredIncidents.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                {statusFilter === 'all' ? 'No incidents' : `No ${statusFilter} incidents`}
              </td></tr>
            )}
            {filteredIncidents.map(inc => (
              <tr
                key={inc.id}
                className={cn(
                  'table-row cursor-pointer',
                  inc.status === 'active' && 'hover:bg-danger-900/10'
                )}
                onClick={() => setModal(inc)}
              >
                <td className="px-5 py-3.5">
                  <div className="font-medium text-slate-200 text-sm">{inc.title}</div>
                  <div className="text-xs text-slate-500 truncate max-w-xs mt-0.5">
                    {inc.description?.slice(0, 80) || 'No description'}
                  </div>
                </td>
                <td className="px-3 py-3.5">
                  <span className={cn(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    inc.status === 'active' ? 'bg-danger-500/20 text-danger-400' :
                    inc.status === 'monitoring' ? 'bg-warning-500/20 text-warning-400' :
                    inc.status === 'resolved' ? 'bg-success-500/20 text-success-400' :
                    'bg-slate-500/20 text-slate-400'
                  )}>{inc.status}</span>
                </td>
                <td className="px-3 py-3.5">
                  <span className={severityColor(inc.severity)}>{inc.severity}</span>
                </td>
                <td className="px-3 py-3.5 text-sm text-slate-400">
                  {inc.type || '—'}
                </td>
                <td className="px-3 py-3.5 text-xs text-slate-500">{timeAgo(inc.created_at)}</td>
                <td className="px-3 py-3.5">
                  <ChevronRight size={14} className="text-slate-600" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {modal && <IncidentModal incident={modal === 'create' ? null : modal} onClose={() => setModal(null)} />}
    </div>
  )
}
