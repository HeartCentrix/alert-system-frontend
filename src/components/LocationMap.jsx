import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix default marker icons broken by webpack/vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// Custom blue pin icon
// Sanitize count to prevent XSS - only allow safe numeric values
const createIcon = (count) => {
  // Ensure count is a safe non-negative integer
  const safeCount = typeof count === 'number' && Number.isFinite(count) && count >= 0
    ? Math.floor(count)
    : 0
  const displayCount = safeCount > 99 ? '99+' : String(safeCount)
  
  return L.divIcon({
    className: '',
    html: `
      <div style="
        background: #1d4ed8;
        border: 2px solid #60a5fa;
        border-radius: 50% 50% 50% 0;
        width: 32px;
        height: 32px;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 10px;
          font-weight: 700;
          line-height: 1;
        ">${displayCount}</span>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -34],
  })
}

// Auto-fit map bounds to markers
function FitBounds({ locations }) {
  const map = useMap()
  useEffect(() => {
    if (!locations?.length) return
    const valid = locations.filter(l => l.latitude && l.longitude)
    if (!valid.length) return
    if (valid.length === 1) {
      map.setView([valid[0].latitude, valid[0].longitude], 10)
    } else {
      const bounds = L.latLngBounds(valid.map(l => [l.latitude, l.longitude]))
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [locations, map])
  return null
}

export default function LocationMap({ locations = [], height = 320, onLocationClick }) {
  const validLocations = locations.filter(l => l.latitude && l.longitude)

  // Default center: USA
  const defaultCenter = [39.5, -98.35]
  const defaultZoom = 4

  return (
    <div style={{ height, borderRadius: '0.5rem', overflow: 'hidden' }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FitBounds locations={validLocations} />
        {validLocations.map(loc => (
          <Marker
            key={loc.id}
            position={[loc.latitude, loc.longitude]}
            icon={createIcon(loc.user_count || 0)}
            eventHandlers={onLocationClick ? {
              click: () => onLocationClick(loc.id),
            } : {}}
          >
            <Popup>
              <div style={{
                background: '#1e293b',
                color: '#f1f5f9',
                padding: '8px 12px',
                borderRadius: '8px',
                minWidth: '160px',
                fontSize: '13px'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{loc.name}</div>
                <div style={{ color: '#94a3b8', fontSize: 12 }}>{loc.city}, {loc.state}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 12 }}>
                  <span
                    style={{ color: '#60a5fa', fontWeight: 600, cursor: onLocationClick ? 'pointer' : 'default' }}
                    onClick={(e) => { if (onLocationClick) { e.stopPropagation(); onLocationClick(loc.id) } }}
                  >
                    {loc.user_count || 0} people →
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}
