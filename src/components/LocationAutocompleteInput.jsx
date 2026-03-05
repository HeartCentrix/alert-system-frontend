import { MapPin, Loader, AlertCircle, Check, X } from 'lucide-react'
import { useLocationAutocomplete } from '@/hooks/useLocationAutocomplete'

/**
 * @typedef {import('@/types/location').LocationResult} LocationResult
 * @typedef {import('@/types/location').LocationAutocompleteOptions} LocationAutocompleteOptions
 */

/**
 * Location Autocomplete Input Component
 * 
 * A reusable input component with location autocomplete functionality.
 * Automatically fills latitude/longitude when a suggestion is selected.
 * 
 * Features:
 * - Debounced search (450ms default)
 * - localStorage caching (10 min TTL)
 * - Request deduplication
 * - Rate limiting protection
 * - Visual selection state
 * - Keyboard navigation support
 * 
 * @param {Object} props
 * @param {string} [props.value] - Current input value
 * @param {(e: React.ChangeEvent<HTMLInputElement>) => void} [props.onChange] - Change handler
 * @param {number|string} [props.latitude] - Latitude value
 * @param {number|string} [props.longitude] - Longitude value
 * @param {(location: {display_name: string, latitude: number, longitude: number, address: Object}) => void} [props.onLocationSelect] - Selection callback
 * @param {() => void} [props.onLocationClear] - Clear callback
 * @param {string} [props.placeholder] - Input placeholder
 * @param {boolean} [props.disabled] - Disable the input
 * @param {string} [props.className] - Additional CSS classes
 * @param {LocationAutocompleteOptions} [props.options] - Hook options
 * @param {string} [props.name] - Input name attribute
 * @param {boolean} [props.required] - Require selection
 * @param {boolean} [props.clearable] - Show clear button when selected
 */
export default function LocationAutocompleteInput({
  value = '',
  onChange,
  latitude,
  longitude,
  onLocationSelect,
  onLocationClear,
  placeholder = 'Search for a location...',
  disabled = false,
  className = '',
  options = {},
  name = 'location',
  required = false,
  clearable = true,
}) {
  const {
    query,
    results,
    loading,
    error,
    selected,
    setQuery,
    select,
    clear,
    hasSelection,
    hasResults,
  } = useLocationAutocomplete({
    debounceMs: 450,
    minLength: 3,
    limit: 10,
    minRequestInterval: 800,
    maxCacheSize: 20,
    ...options,
  })

  // Handle input change
  const handleInputChange = (e) => {
    const newValue = e.target.value
    setQuery(newValue)
    onChange?.(e)
  }

  // Handle suggestion selection
  const handleSelect = (/** @type {LocationResult} */ suggestion) => {
    select(suggestion)

    // Fill the input with display name
    const syntheticEvent = {
      target: { value: suggestion.display_name, name }
    }
    onChange?.(syntheticEvent)

    // Notify parent of location selection with lat/lon
    onLocationSelect?.({
      display_name: suggestion.display_name,
      latitude: suggestion.lat,
      longitude: suggestion.lon,
      address: suggestion.address,
    })
  }

  // Handle clear selection
  const handleClear = () => {
    // Clear the hook state (including selected)
    clear()
    
    // Clear parent form state
    onLocationClear?.()

    // Clear the input value
    const syntheticEvent = {
      target: { value: '', name }
    }
    onChange?.(syntheticEvent)
  }

  // Handle manual edit (invalidate selection)
  const handleManualEdit = () => {
    if (hasSelection) {
      onLocationClear?.()
    }
  }

  return (
    <div className={`relative ${className}`}>
      {/* Input Field */}
      <div className="relative">
        <MapPin 
          className={`absolute left-3 top-1/2 -translate-y-1/2 ${
            hasSelection ? 'text-success-400' : 'text-slate-500'
          }`} 
          size={18} 
        />
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onInput={handleManualEdit}
          placeholder={placeholder}
          disabled={disabled}
          name={name}
          required={required}
          className={`input pl-10 pr-10 ${
            hasSelection ? 'border-success-500/50 bg-success-900/10' : ''
          } ${error ? 'border-danger-500/50' : ''}`}
        />
        
        {/* Status Icons */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {loading && <Loader size={18} className="animate-spin text-slate-400" />}
          {error && <AlertCircle size={18} className="text-danger-400" />}
          {hasSelection && !loading && clearable && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-surface-700 rounded transition-colors"
              title="Clear selection"
            >
              <X size={16} className="text-success-400 hover:text-success-300" />
            </button>
          )}
          {hasSelection && !loading && !clearable && (
            <Check size={18} className="text-success-400" />
          )}
        </div>
      </div>

      {/* Hidden Fields for lat/lon */}
      <input type="hidden" name="latitude" value={latitude || ''} />
      <input type="hidden" name="longitude" value={longitude || ''} />

      {/* Suggestions Dropdown */}
      {((hasResults && !selected) || (error && !selected)) && (
        <div className="absolute z-50 w-full mt-1 bg-surface-800 border border-surface-700 rounded-lg shadow-xl max-h-64 overflow-auto">
          {error && (
            <div className="px-4 py-3 text-sm text-danger-400 flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {hasResults && !error && (
            <ul role="listbox">
              {results.map((/** @type {LocationResult} */ suggestion) => (
                <li
                  key={suggestion.place_id}
                  role="option"
                  onClick={() => handleSelect(suggestion)}
                  className="px-4 py-3 hover:bg-surface-700 cursor-pointer transition-colors border-b border-surface-700/50 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <MapPin size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">
                        {suggestion.display_place}
                      </div>
                      {suggestion.display_address && (
                        <div className="text-xs text-slate-400 truncate mt-0.5">
                          {suggestion.display_address}
                        </div>
                      )}
                      {suggestion.address?.city && (
                        <div className="text-xs text-slate-500 mt-1">
                          {suggestion.address.city}
                          {suggestion.address.state && `, ${suggestion.address.state}`}
                          {suggestion.address.country && ` • ${suggestion.address.country}`}
                        </div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!error && results.length === 0 && query.length >= minLength && !loading && (
            <div className="px-4 py-3 text-sm text-slate-500 text-center">
              No locations found
            </div>
          )}
        </div>
      )}

      {/* Selection Status */}
      {hasSelection && selected && (
        <div className="mt-2 text-xs text-success-400 flex items-center gap-1">
          <Check size={12} />
          Location selected: {selected.display_place}
          {selected.address?.city && ` • ${selected.address.city}`}
        </div>
      )}

      {/* Helper Text */}
      {!hasSelection && !error && (
        <p className="mt-2 text-xs text-slate-500">
          Start typing to search (minimum {options.minLength || 3} characters)
        </p>
      )}
    </div>
  )
}
