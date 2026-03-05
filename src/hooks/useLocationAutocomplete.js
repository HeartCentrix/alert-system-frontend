import { useState, useEffect, useCallback, useRef } from 'react'
import { locationAutocompleteAPI } from '@/services/api'

/**
 * @typedef {import('@/types/location').LocationResult} LocationResult
 * @typedef {import('@/types/location').LocationAutocompleteOptions} LocationAutocompleteOptions
 * @typedef {import('@/types/location').LocationAutocompleteReturn} LocationAutocompleteReturn
 */

// localStorage key for cache
const CACHE_STORAGE_KEY = 'locationiq_cache_v2'

// Cache configuration
const DEFAULT_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
const DEFAULT_MAX_CACHE_SIZE = 20

/**
 * Location Autocomplete Hook with Aggressive Caching
 * 
 * Features:
 * - Debounced search (450ms default)
 * - localStorage caching (10 min TTL, 20 entries max)
 * - Request deduplication (prevents duplicate in-flight requests)
 * - Rate limiting (800ms minimum between API calls)
 * - AbortController for canceling in-flight requests
 * - Minimum 3 characters before searching
 * 
 * @param {LocationAutocompleteOptions} options - Configuration options
 * @returns {LocationAutocompleteReturn} Autocomplete state and handlers
 */
export function useLocationAutocomplete(options = {}) {
  const {
    debounceMs = 450,
    minLength = 3,
    limit = 10,
    countrycodes,
    viewbox,
    bounded = false,
    minRequestInterval = 800,
    maxCacheSize = 20,
    cacheTTL = DEFAULT_CACHE_TTL,
  } = options

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(/** @type {LocationResult[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(/** @type {string|null} */ (null))
  const [selected, setSelected] = useState(/** @type {LocationResult|null} */ (null))

  // Refs for request management
  const debounceTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))
  const abortControllerRef = useRef(/** @type {AbortController|null} */ (null))
  const lastRequestTimeRef = useRef(0)
  const justSelectedRef = useRef(false)
  const pendingRequestRef = useRef(/** @type {Promise<any>|null} */ (null))
  
  // In-memory cache for session (faster than localStorage)
  const memoryCacheRef = useRef(/** @type {Map<string, {results: LocationResult[], timestamp: number}>} */ (new Map()))

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        const now = Date.now()
        
        // Load valid cache entries into memory
        Object.entries(parsed).forEach(([key, value]) => {
          const { timestamp } = /** @type {{results: LocationResult[], timestamp: number}} */ (value)
          if (now - timestamp < cacheTTL) {
            memoryCacheRef.current.set(key, /** @type {{results: LocationResult[], timestamp: number}} */ (value))
          }
        })
      }
    } catch (e) {
      console.warn('Failed to load location cache:', e)
    }
  }, [cacheTTL])

  // Persist cache to localStorage (throttled)
  const persistCacheRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))
  const persistCache = useCallback(() => {
    if (persistCacheRef.current) return
    
    persistCacheRef.current = setTimeout(() => {
      try {
        const cacheObj = {}
        memoryCacheRef.current.forEach((value, key) => {
          cacheObj[key] = value
        })
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObj))
      } catch (e) {
        // localStorage might be full or disabled
        if (e.name === 'QuotaExceededError') {
          // Clear oldest entries if full
          const entries = Array.from(memoryCacheRef.current.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp)
          const toDelete = entries.slice(0, Math.floor(maxCacheSize / 2))
          toDelete.forEach(([key]) => memoryCacheRef.current.delete(key))
          // Try again
          try {
            const cacheObj = {}
            memoryCacheRef.current.forEach((value, key) => {
              cacheObj[key] = value
            })
            localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObj))
          } catch (e2) {
            console.warn('Location cache persist failed after cleanup:', e2)
          }
        } else {
          console.warn('Failed to persist location cache:', e)
        }
      }
      persistCacheRef.current = null
    }, 3000)
  }, [maxCacheSize])

  // Generate cache key (normalized)
  const getCacheKey = useCallback((q) => {
    const normalized = q.trim().toLowerCase().replace(/\s+/g, ' ')
    const parts = [normalized]
    if (countrycodes) parts.push(countrycodes)
    if (viewbox) parts.push(viewbox)
    return parts.join('|')
  }, [countrycodes, viewbox])

  // Get from cache
  const getFromCache = useCallback((cacheKey) => {
    const cached = memoryCacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.results
    }
    if (cached) {
      memoryCacheRef.current.delete(cacheKey)
    }
    return null
  }, [cacheTTL])

  // Set cache
  const setCache = useCallback((cacheKey, results) => {
    const entry = {
      results,
      timestamp: Date.now(),
    }
    
    // Enforce max cache size
    if (memoryCacheRef.current.size >= maxCacheSize) {
      const entries = Array.from(memoryCacheRef.current.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)
      const oldestKey = entries[0]?.[0]
      if (oldestKey) {
        memoryCacheRef.current.delete(oldestKey)
      }
    }
    
    memoryCacheRef.current.set(cacheKey, entry)
    persistCache()
  }, [maxCacheSize, persistCache])

  // Clear suggestions and reset state
  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setSelected(null)
    setError(null)
    setLoading(false)
  }, [])

  // Handle selection
  const select = useCallback((location) => {
    setSelected(location)
    setResults([])
    setQuery(location?.display_name || '')
    justSelectedRef.current = true
  }, [])

  // Invalidate selection (call when user edits after selecting)
  const invalidateSelection = useCallback(() => {
    if (selected) {
      setSelected(null)
    }
  }, [selected])

  // Fetch results with rate limiting and deduplication
  const fetchResults = useCallback(async (searchQuery) => {
    const cacheKey = getCacheKey(searchQuery)
    
    // Check memory cache first
    const cached = getFromCache(cacheKey)
    if (cached) {
      setResults(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Check if there's a pending request for this query
    if (pendingRequestRef.current) {
      try {
        const pendingResults = await pendingRequestRef.current
        if (pendingResults) {
          setResults(pendingResults)
          setError(null)
        }
      } catch (e) {
        // Ignore pending request errors
      }
      return
    }

    // Rate limiting: enforce minimum time between requests
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTimeRef.current
    if (timeSinceLastRequest < minRequestInterval) {
      const delay = minRequestInterval - timeSinceLastRequest
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    lastRequestTimeRef.current = Date.now()
    setLoading(true)
    setError(null)

    // Cancel any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    
    // Create new abort controller
    abortControllerRef.current = new AbortController()

    try {
      const { data } = await locationAutocompleteAPI.search(searchQuery, {
        limit,
        countrycodes,
        viewbox,
        bounded,
      })

      const fetchedResults = data.results || []
      
      // Cache the results
      if (fetchedResults.length > 0) {
        setCache(cacheKey, fetchedResults)
      }
      
      setResults(fetchedResults)
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError') {
        return
      }

      console.error('Location autocomplete error:', err)
      
      if (err.response?.status === 429) {
        setError('Too many requests. Please wait a moment.')
      } else if (err.response?.status === 503) {
        setError('Location service temporarily unavailable.')
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || 'Invalid search query.')
      } else {
        setError('Failed to fetch location suggestions.')
      }
      
      setResults([])
    } finally {
      setLoading(false)
      pendingRequestRef.current = null
    }
  }, [getCacheKey, getFromCache, setCache, limit, countrycodes, viewbox, bounded, minRequestInterval])

  // Handle query changes with debouncing
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Clear suggestions if query is too short
    if (!query || query.trim().length < minLength) {
      setResults([])
      setLoading(false)
      return
    }

    // Skip fetching if user just made a selection
    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }

    // Debounce the search
    debounceTimerRef.current = setTimeout(() => {
      fetchResults(query.trim())
    }, debounceMs)

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, minLength, debounceMs, fetchResults])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (persistCacheRef.current) {
        clearTimeout(persistCacheRef.current)
      }
    }
  }, [])

  return {
    // State
    query,
    results,
    loading,
    error,
    selected,
    hasSelection: !!selected,
    hasResults: results.length > 0,
    isEmpty: !query && results.length === 0,
    
    // Handlers
    setQuery,
    select,
    clear,
    invalidateSelection,
  }
}

export default useLocationAutocomplete
