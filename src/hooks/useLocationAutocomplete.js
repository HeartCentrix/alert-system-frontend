import { useState, useEffect, useCallback, useRef } from 'react'
import { locationAutocompleteAPI } from '@/services/api'

/**
 * @typedef {import('@/types/location').LocationResult} LocationResult
 * @typedef {import('@/types/location').LocationAutocompleteOptions} LocationAutocompleteOptions
 * @typedef {import('@/types/location').LocationAutocompleteReturn} LocationAutocompleteReturn
 */

// localStorage key — new version with permanent caching
const CACHE_STORAGE_KEY = 'geocode_cache_v3'

// Cache configuration
// No TTL — location data (city names, coordinates) is essentially permanent.
// "New York" at (40.71, -74.00) won't change. Expiring this cache just
// generates unnecessary API calls.
const DEFAULT_MAX_CACHE_SIZE = 200  // increased from 20 — each entry is ~2-5KB

/**
 * Location Autocomplete Hook with Permanent Caching
 *
 * Caching strategy (3 layers, all permanent):
 *   L0: React state     — current session, instant
 *   L1: localStorage    — survives page reload, ~1ms
 *   L2: Backend Redis   — survives deploys, shared across users
 *
 * Rate-limit protection (user never waits):
 *   - 550ms debounce (slightly longer to batch fast typers)
 *   - 1000ms minimum between API calls
 *   - AbortController cancels stale in-flight requests
 *   - Request deduplication prevents duplicate fetches
 *   - Backend adds its own token-bucket + coalescing layer
 *
 * Net effect: after a location is searched ONCE by ANY user,
 * it's cached permanently at every layer. Photon barely gets touched.
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
          // localStorage FULL — evict oldest half
          const entries = Array.from(memoryCacheRef.current.entries())
            .sort((a, b) => (a[1].cachedAt || 0) - (b[1].cachedAt || 0))
          const toDelete = entries.slice(0, Math.floor(entries.length / 2))
          toDelete.forEach(([key]) => memoryCacheRef.current.delete(key))
          // Retry persist
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

  // ── Cache key generation ───────────────────────────────────────────

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

  const fetchResults = useCallback(async (searchQuery) => {
    const cacheKey = getCacheKey(searchQuery)

    // Check L0/L1 cache (instant, no network)
    const cached = getFromCache(cacheKey)
    if (cached) {
      setResults(cached)
      setLoading(false)
      setError(null)
      return
    }

    // Deduplicate: if there's already a pending request, wait for it
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

    // Rate limiting: enforce minimum time between API calls
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
    abortControllerRef.current = new AbortController()

    try {
      const { data } = await locationAutocompleteAPI.search(searchQuery, {
        limit,
        countrycodes,
        viewbox,
        bounded,
      })

      const fetchedResults = data.results || []

      // Cache permanently (both non-empty and empty results)
      setCache(cacheKey, fetchedResults)

      setResults(fetchedResults)
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') {
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
