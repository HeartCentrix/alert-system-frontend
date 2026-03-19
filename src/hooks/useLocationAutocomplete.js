import { useState, useEffect, useCallback, useRef } from 'react'
import { locationAutocompleteAPI } from '@/services/api'

/**
 * @typedef {import('@/types/location').LocationResult} LocationResult
 * @typedef {import('@/types/location').LocationAutocompleteOptions} LocationAutocompleteOptions
 * @typedef {import('@/types/location').LocationAutocompleteReturn} LocationAutocompleteReturn
 */

// localStorage entry name — new version with permanent caching
const CACHE_STORAGE_KEY = 'geocode_cache_v3'

// Cache configuration
// No TTL — location data (city names, coordinates) is essentially permanent.
// "New York" at (40.71, -74.00) won't change. Expiring this cache just
// generates unnecessary API calls.
const DEFAULT_MAX_CACHE_SIZE = 200  // increased from 20 — each entry is ~2-5KB

/**
 * Location Autocomplete Hook with Permanent Caching
 *
 * Caching (3 layers): React state → localStorage → Backend Redis
 * Rate-limiting: 550ms debounce, 1000ms min interval, AbortController
 */
export function useLocationAutocomplete(options = {}) {
  const {
    debounceMs = 550,
    minLength = 3,
    limit = 10,
    countrycodes,
    viewbox,
    bounded = false,
    minRequestInterval = 1000,
    maxCacheSize = DEFAULT_MAX_CACHE_SIZE,
  } = options

  const [query, setQuery] = useState('')
  const [results, setResults] = useState(/** @type {LocationResult[]} */ ([]))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(/** @type {string|null} */ (null))
  const [selected, setSelected] = useState(/** @type {LocationResult|null} */ (null))

  // Refs for request management
  const debounceTimerRef = useRef(null)
  const abortControllerRef = useRef(null)
  const lastRequestTimeRef = useRef(0)
  const justSelectedRef = useRef(false)
  const pendingRequestRef = useRef(null)

  // In-memory cache (L0 — fastest, per-session)
  const memoryCacheRef = useRef(new Map())

  // ── localStorage permanent cache (L1) ──────────────────────────────

  // Load cache from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CACHE_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // No TTL check — all entries are valid permanently
        Object.entries(parsed).forEach(([key, value]) => {
          if (value && typeof value === 'object' && Array.isArray(value.results)) {
            memoryCacheRef.current.set(key, value)
          }
        })
      }
    } catch (e) {
      // Corrupted cache — clear and start fresh
      console.warn('Location cache corrupt, clearing:', e)
      try { localStorage.removeItem(CACHE_STORAGE_KEY) } catch (_) {}
    }
  }, [])

  // Persist cache to localStorage (throttled to avoid I/O spam)
  const persistCacheRef = useRef(null)
  
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
        if (e.name === 'QuotaExceededError') {
          evictOldestCacheEntry()
          // Retry persist after eviction
          try {
            const cacheObj = {}
            memoryCacheRef.current.forEach((value, key) => {
              cacheObj[key] = value
            })
            localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cacheObj))
          } catch (_) {
            console.warn('Location cache persist failed after eviction')
          }
        }
      }
      persistCacheRef.current = null
    }, 2000)
  }, [])

  // Evict oldest cache entry when storage is full
  const evictOldestCacheEntry = useCallback(() => {
    const entries = Array.from(memoryCacheRef.current.entries())
      .sort((a, b) => (a[1].cachedAt || 0) - (b[1].cachedAt || 0))
    const toDelete = entries.slice(0, Math.floor(entries.length / 2))
    toDelete.forEach(([key]) => memoryCacheRef.current.delete(key))
  }, [])

  // ── Cache entry generation ────────────────────────────────────────

  const getCacheKey = useCallback((q) => {
    const normalized = q.trim().toLowerCase().replace(/\s+/g, ' ')
    const parts = [normalized]
    if (countrycodes) parts.push(countrycodes)
    if (viewbox) parts.push(viewbox)
    return parts.join('|')
  }, [countrycodes, viewbox])

  // ── Cache read (no TTL check) ──────────────────────────────────────

  const getFromCache = useCallback((cacheKey) => {
    const cached = memoryCacheRef.current.get(cacheKey)
    if (cached && Array.isArray(cached.results)) {
      return cached.results
    }
    return null
  }, [])

  // ── Cache write (permanent, with eviction by size) ─────────────────

  const setCache = useCallback((cacheKey, results) => {
    const entry = {
      results,
      cachedAt: Date.now(),  // for eviction ordering only, NOT expiry
    }

    // Enforce max cache size (evict oldest by cachedAt)
    if (memoryCacheRef.current.size >= maxCacheSize) {
      let oldestKey = null
      let oldestTime = Infinity
      memoryCacheRef.current.forEach((val, key) => {
        const t = val.cachedAt || 0
        if (t < oldestTime) {
          oldestTime = t
          oldestKey = key
        }
      })
      if (oldestKey) {
        memoryCacheRef.current.delete(oldestKey)
      }
    }

    memoryCacheRef.current.set(cacheKey, entry)
    persistCache()
  }, [maxCacheSize, persistCache])

  // ── Handlers ───────────────────────────────────────────────────────

  const clear = useCallback(() => {
    setQuery('')
    setResults([])
    setSelected(null)
    setError(null)
    setLoading(false)
  }, [])

  const select = useCallback((location) => {
    setSelected(location)
    setResults([])
    setQuery(location?.display_name || '')
    justSelectedRef.current = true
  }, [])

  const invalidateSelection = useCallback(() => {
    if (selected) {
      setSelected(null)
    }
  }, [selected])

  // ── Fetch with rate limiting ───────────────────────────────────────

  // Handle fetch errors and set appropriate error message
  const handleFetchError = useCallback((err) => {
    if (err.name === 'AbortError' || err.name === 'CanceledError') {
      return
    }

    console.error('Location autocomplete error:', err)

    const errorMessages = {
      429: 'Too many requests. Please wait a moment.',
      503: 'Location service temporarily unavailable.',
    }

    const status = err.response?.status
    const message = errorMessages[status] || err.response?.data?.detail || 'Failed to fetch location suggestions.'
    
    setError(message)
    setResults([])
  }, [])

  const fetchResults = useCallback(async (searchQuery) => {
    const cacheKey = getCacheKey(searchQuery)

    // Check cache first (instant, no network)
    const cached = getFromCache(cacheKey)
    if (cached) {
      setResults(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Deduplicate pending requests
    if (pendingRequestRef.current) {
      try {
        const pendingResults = await pendingRequestRef.current
        if (pendingResults) {
          setResults(pendingResults)
          setError(null)
        }
      } catch (_) {}
      return
    }

    // Rate limiting
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTimeRef.current
    if (timeSinceLastRequest < minRequestInterval) {
      await new Promise(resolve => setTimeout(resolve, minRequestInterval - timeSinceLastRequest))
    }

    lastRequestTimeRef.current = Date.now()
    setLoading(true)
    setError(null)

    // Cancel in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    abortControllerRef.current = new AbortController()

    try {
      const { data } = await locationAutocompleteAPI.search(searchQuery, {
        limit,
        countrycodes,
        viewbox,
        bounded,
      })

      const fetchedResults = data.results || []
      setCache(cacheKey, fetchedResults)
      setResults(fetchedResults)
      setError(null)
    } catch (err) {
      handleFetchError(err)
    } finally {
      setLoading(false)
      pendingRequestRef.current = null
    }
  }, [getCacheKey, getFromCache, setCache, handleFetchError, limit, countrycodes, viewbox, bounded, minRequestInterval])

  // ── Debounced query watcher ────────────────────────────────────────

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!query || query.trim().length < minLength) {
      setResults([])
      setLoading(false)
      return
    }

    if (justSelectedRef.current) {
      justSelectedRef.current = false
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchResults(query.trim())
    }, debounceMs)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [query, minLength, debounceMs, fetchResults])

  // ── Cleanup on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (persistCacheRef.current) clearTimeout(persistCacheRef.current)
    }
  }, [])

  return {
    query,
    results,
    loading,
    error,
    selected,
    hasSelection: !!selected,
    hasResults: results.length > 0,
    isEmpty: !query && results.length === 0,

    setQuery,
    select,
    clear,
    invalidateSelection,
  }
}

export default useLocationAutocomplete
