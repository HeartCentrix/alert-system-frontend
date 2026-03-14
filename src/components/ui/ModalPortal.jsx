import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function ModalPortal({ children }) {
  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  return createPortal(children, document.body)
}
