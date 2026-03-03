import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'
import { MapPin, Users, AlertCircle, Loader, Plus, X } from 'lucide-react'
import { locationsAPI } from '@/services/api'

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom icons
const createLocationIcon = (count) => L.divIcon({
  className: '',
  html: `
    <div style="
      background: #2563eb;
      border: 3px solid #60a5fa;
      border-radius: 50% 50% 50% 0;
      width: 36px;
      height: 36px;
      transform: rotate(-45deg);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
    ">
      <span style="
        transform: rotate(45deg);
        color: white;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
      ">${count > 99 ? '99+' : count}</span>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -38],
})

const createUserIcon = () => L.divIcon({
  className: '',
  html: `
    <div style="
      background: #10b981;
      border: 2px solid white;
      border-radius: 50%;
      width: 20px;
      height: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    ">
    </div>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

// Auto-fit map bounds
function FitBounds({ locations }) {
  const map = useMap()
  useEffect(() => {
    if (!locations?.length) return
    const valid = locations.filter(l => l.latitude && l.longitude)
    if (!valid.length) return
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 12)
    } else {
      const bounds = L.latLngBounds(valid.map(l => [l.latitude, l.longitude]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    }
  }, [locations, map])
  return null
}

// Map click handler for creating new location
function MapClickHandler({ onMapClick, isCreating }) {
  const map = useMap()
  
  useEffect(() => {
    if (!isCreating) return
    
    const handleClick = (e) => {
      onMapClick({
        latitude: e.latlng.lat,
        longitude: e.latlng.lng
      })
    }
    
    map.on('click', handleClick)
    map.getContainer().style.cursor = 'crosshair'
    
    return () => {
      map.off('click', handleClick)
      map.getContainer().style.cursor = ''
    }
  }, [map, onMapClick, isCreating])
  
  return null
}

/**
 * Location Audience Map Component
 * 
 * Features:
 * - Display all locations with markers
 * - Show geofence radius circles
 * - Display user count per location
 * - Click to create new location (admin mode)
 * - Filter by location status
 * - Real-time member count
 * 
 * @param {Object} props
 * @param {boolean} [props.adminMode=false] - Enable admin features (create, edit)
 * @param {function} [props.onLocationSelect] - Callback when location is selected
 * @param {function} [props.onMapCreateClick] - Callback when map is clicked in create mode
 * @param {boolean} [props.isCreating] - Whether in location creation mode
 * @param {boolean} [props.showGeofences=true] - Show geofence radius circles
 * @param {boolean} [props.showUsers=false] - Show individual user markers
 * @param {string} [props.statusFilter] - Filter locations by status
 * @param {number} [props.height=500] - Map height in pixels
 */
export default function LocationAudienceMap({
  adminMode = false,
  onLocationSelect,
  onMapCreateClick,
  isCreating = false,
  showGeofences = true,
  showUsers = false,
  statusFilter = 'active',
  height = 500,
}) {
  const [locations, setLocations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedLocationId, setSelectedLocationId] = useState(null)

  // Load locations
  const loadLocations = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await locationsAPI.list()
      const locationsWithMembers = response.data.map(loc => ({
        ...loc,
        // In production, fetch actual member count from location-audience API
        memberCount: loc.user_count || 0,
      }))
      setLocations(locationsWithMembers)
    } catch (err) {
      console.error('Failed to load locations:', err)
      setError('Failed to load locations')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLocations()
  }, [loadLocations])

  // Filter locations
  const filteredLocations = locations.filter(loc => {
    if (statusFilter === 'active' && !loc.is_active) return false
    if (statusFilter === 'inactive' && loc.is_active) return false
    return true
  })

  // Handle location selection
  const handleLocationClick = (location) => {
    setSelectedLocationId(location.id)
    onLocationSelect?.(location)
  }

  // Handle map click for creation
  const handleMapClick = (coords) => {
    onMapCreateClick?.(coords)
  }

  // Convert miles to meters for Leaflet Circle
  const milesToMeters = (miles) => miles * 1609.34

  return (
    <div className="relative w-full h-full" style={{ height }}>
      {/* Loading State */}
      {loading && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-surface-800/90 backdrop-blur-sm px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <Loader size={18} className="animate-spin text-blue-400" />
          <span className="text-sm text-slate-300">Loading locations...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-danger-900/90 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <AlertCircle size={18} className="text-danger-400" />
          <span className="text-sm text-white">{error}</span>
        </div>
      )}

      {/* Create Mode Indicator */}
      {isCreating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-success-900/90 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg flex items-center gap-2">
          <Plus size={18} className="text-success-400" />
          <span className="text-sm text-white">Click on the map to set location</span>
          <button
            onClick={() => onMapCreateClick?.(null)}
            className="ml-2 p-1 hover:bg-success-800 rounded"
          >
            <X size={16} className="text-success-400" />
          </button>
        </div>
      )}

      {/* Stats Overlay */}
      <div className="absolute top-4 right-4 z-[1000] bg-surface-800/90 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-blue-400" />
            <span className="text-slate-300">
              {filteredLocations.length} Location{filteredLocations.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-green-400" />
            <span className="text-slate-300">
              {filteredLocations.reduce((sum, loc) => sum + (loc.memberCount || 0), 0)} Members
            </span>
          </div>
        </div>
      </div>

      {/* Map */}
      <MapContainer
        center={[39.5, -98.35]} // Default: USA center
        zoom={4}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
        attributionControl={false}
        preferCanvas={true} // Better performance for many markers
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        
        <FitBounds locations={filteredLocations} />
        <MapClickHandler onMapClick={handleMapClick} isCreating={isCreating} />

        {/* Locations with geofences */}
        {filteredLocations.map(location => {
          if (!location.latitude || !location.longitude) return null
          
          const isSelected = selectedLocationId === location.id
          const radiusMeters = milesToMeters(location.geofence_radius_miles || 0)
          
          return (
            <g key={location.id}>
              {/* Geofence Circle */}
              {showGeofences && (
                <Circle
                  center={[location.latitude, location.longitude]}
                  radius={radiusMeters}
                  pathOptions={{
                    color: isSelected ? '#10b981' : '#3b82f6',
                    fillColor: isSelected ? '#10b981' : '#3b82f6',
                    fillOpacity: 0.15,
                    weight: isSelected ? 3 : 2,
                    dashArray: location.is_active ? undefined : '5, 5',
                  }}
                >
                  <Popup>
                    <div className="p-2 min-w-[200px]">
                      <div className="font-semibold text-slate-900 mb-1">
                        {location.name}
                      </div>
                      <div className="text-sm text-slate-600 space-y-1">
                        <div>Radius: {location.geofence_radius_miles} miles</div>
                        <div>Members: {location.memberCount || 0}</div>
                        <div className={`text-xs ${location.is_active ? 'text-success-600' : 'text-slate-500'}`}>
                          {location.is_active ? 'Active' : 'Inactive'}
                        </div>
                      </div>
                      {onLocationSelect && (
                        <button
                          onClick={() => handleLocationClick(location)}
                          className="mt-2 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </Popup>
                </Circle>
              )}

              {/* Location Marker */}
              <Marker
                position={[location.latitude, location.longitude]}
                icon={createLocationIcon(location.memberCount || 0)}
                eventHandlers={{
                  click: () => handleLocationClick(location),
                }}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <div className="font-semibold text-slate-900 mb-1">
                      {location.name}
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>
                        {location.city && location.state 
                          ? `${location.city}, ${location.state}`
                          : location.address}
                      </div>
                      <div>Radius: {location.geofence_radius_miles} miles</div>
                      <div>Members: {location.memberCount || 0}</div>
                      <div className={`text-xs ${location.is_active ? 'text-success-600' : 'text-slate-500'}`}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    {onLocationSelect && (
                      <button
                        onClick={() => handleLocationClick(location)}
                        className="mt-2 w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </Popup>
              </Marker>
            </g>
          )
        })}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-surface-800/90 backdrop-blur-sm px-4 py-3 rounded-lg shadow-lg">
        <div className="text-xs text-slate-400 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500/20" />
            <span>Active Geofence</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full border-2 border-blue-500 bg-blue-500/20" style={{ borderStyle: 'dashed' }} />
            <span>Inactive Location</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500 border border-white" />
            <span>User (when enabled)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
