import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// Fix default marker icons broken by webpack/vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const createIcon = (count) => {
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
    popupAnchor: [0, -42],
  })
}

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

function LocationMarker({ loc, onLocationClick }) {
  const markerRef = useRef(null)
  const closeTimer = useRef(null)

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      markerRef.current?.closePopup()
    }, 150)
  }

  useEffect(() => () => cancelClose(), [])

  return (
    <Marker
      ref={markerRef}
      position={[loc.latitude, loc.longitude]}
      icon={createIcon(loc.user_count || 0)}
      eventHandlers={{
        mouseover() {
          cancelClose()
          markerRef.current?.openPopup()
        },
        mouseout() {
          scheduleClose()
        },
        click() {
          if (onLocationClick) onLocationClick(loc.id)
        },
      }}
    >
      <Popup
        closeButton={false}
        autoPan={false}
        eventHandlers={{
          mouseover() { cancelClose() },
          mouseout()  { scheduleClose() },
        }}
      >
        <div style={{
          background: '#1e293b',
          color: '#f1f5f9',
          padding: '10px 14px',
          borderRadius: '8px',
          minWidth: '180px',
          fontSize: '13px',
          lineHeight: '1.5',
        }}>
          {/* Location Name */}
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: '#f1f5f9' }}>
            {loc.name}
          </div>

          {/* Members */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b', fontSize: 12 }}>Members</span>
            <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 600 }}>
              {loc.user_count ?? 0}
            </span>
          </div>
        </div>
      </Popup>
    </Marker>
  )
}

export default function LocationMap({ locations = [], height = 320, onLocationClick }) {
  const validLocations = locations.filter(l => l.latitude && l.longitude)

  const defaultCenter = [39.5, -98.35]
  const defaultZoom = 4

  return (
    <div style={{
      height,
      borderRadius: '0.5rem',
      overflow: 'visible',
      position: 'relative',
      zIndex: 0,
    }}>
      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        style={{
          height: '100%',
          width: '100%',
          background: '#0f172a',
          borderRadius: '0.5rem',
        }}
        zoomControl={true}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        />
        <FitBounds locations={validLocations} />
        {validLocations.map(loc => (
          <LocationMarker
            key={loc.id}
            loc={loc}
            onLocationClick={onLocationClick}
          />
        ))}
      </MapContainer>
    </div>
  )
}
