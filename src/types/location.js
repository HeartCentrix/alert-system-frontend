/**
 * Location Autocomplete TypeScript Types
 * 
 * Type definitions for the location autocomplete system.
 * Used with JSDoc for type safety in JavaScript files.
 */

/**
 * @typedef {Object} LocationAddress
 * @property {string} name - Location name (e.g., "Empire State Building")
 * @property {string} road - Street/road name
 * @property {string} city - City name
 * @property {string} state - State/province
 * @property {string} postcode - Postal/ZIP code
 * @property {string} country - Country name
 * @property {string} country_code - ISO country code (2 letters)
 */

/**
 * @typedef {Object} LocationResult
 * @property {string} place_id - Unique location identifier
 * @property {string} display_name - Full display name
 * @property {string} display_place - Primary display text (first part)
 * @property {string} display_address - Secondary display text (remaining parts)
 * @property {number} lat - Latitude coordinate
 * @property {number} lon - Longitude coordinate
 * @property {LocationAddress} address - Structured address components
 * @property {string} type - Location type (e.g., "building", "city")
 * @property {number} importance - Relevance score (0-1)
 */

/**
 * @typedef {Object} LocationAutocompleteResponse
 * @property {LocationResult[]} results - Array of location results
 * @property {boolean} cached - Whether result was from cache
 * @property {"redis"|"memory"|"api"} cache_source - Source of the result
 * @property {number} query_time_ms - Query execution time in milliseconds
 */

/**
 * @typedef {Object} LocationHealthResponse
 * @property {string} service - Service name ("photon")
 * @property {boolean} configured - Whether provider is configured
 * @property {boolean} redis_connected - Redis connection status
 * @property {number} cache_keys - Number of cached queries
 * @property {boolean} celery_available - Celery worker availability
 */

/**
 * @typedef {Object} LocationAutocompleteOptions
 * @property {number} [debounceMs=450] - Debounce delay in milliseconds
 * @property {number} [minLength=3] - Minimum characters before searching
 * @property {number} [limit=10] - Maximum results to fetch (1-20)
 * @property {string} [countrycodes] - Comma-separated country codes (e.g., "us,ca")
 * @property {string} [viewbox] - Bounding box for biasing (x1,y1,x2,y2)
 * @property {boolean} [bounded=false] - Restrict results to viewbox
 * @property {number} [minRequestInterval=800] - Minimum ms between API calls
 * @property {number} [maxCacheSize=20] - Maximum localStorage cache entries
 * @property {number} [cacheTTL=600000] - localStorage cache TTL in ms (10 min)
 */

/**
 * @typedef {Object} LocationAutocompleteState
 * @property {string} query - Current search query
 * @property {LocationResult[]} results - Current search results
 * @property {boolean} loading - Whether a search is in progress
 * @property {string|null} error - Error message if any
 * @property {LocationResult|null} selected - Currently selected location
 * @property {boolean} hasSelection - Whether a location is selected
 * @property {boolean} hasResults - Whether there are search results
 */

/**
 * @typedef {Object} LocationAutocompleteHandlers
 * @property {(query: string) => void} setQuery - Set search query
 * @property {(location: LocationResult) => void} select - Select a location
 * @property {() => void} clear - Clear all state
 * @property {() => void} invalidateSelection - Clear selection but keep query
 */

/**
 * @typedef {Object} LocationAutocompleteReturn
 * @property {LocationAutocompleteState} state - Current state
 * @property {LocationAutocompleteHandlers} handlers - State modifiers
 * @property {string} query - Current query (shorthand)
 * @property {LocationResult[]} results - Current results (shorthand)
 * @property {boolean} loading - Loading state (shorthand)
 * @property {string|null} error - Error state (shorthand)
 * @property {LocationResult|null} selected - Selected location (shorthand)
 */

/**
 * @typedef {Object} CachedQuery
 * @property {LocationResult[]} results - Cached results
 * @property {number} timestamp - Cache timestamp
 * @property {string} query - Original query
 */

export {};
