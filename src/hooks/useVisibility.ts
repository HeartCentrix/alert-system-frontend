import { useEffect, useState } from 'react'

/**
 * Returns true if the document is visible (tab is active)
 * Updates automatically when tab visibility changes
 */
export function useIsDocumentVisible() {
  const [isVisible, setIsVisible] = useState(!document.hidden)

  useEffect(() => {
    const handleVisibilityChange = () => setIsVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return isVisible
}
