import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const { completeSSOFromCookie } = useAuthStore()
  const [error, setError] = useState(null)

  useEffect(() => {
    // Tokens are no longer passed in the URL. The backend set an HttpOnly
    // refresh cookie before redirecting here; exchange it for an access
    // token via /auth/refresh (security review finding F-C3 / B-C2).
    completeSSOFromCookie()
      .then(() => {
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        setError('Failed to complete sign-in. Please try again.')
        setTimeout(() => navigate('/login', { replace: true }), 3000)
      })
  }, [navigate, completeSSOFromCookie])

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-900">
      <div className="text-center">
        {error ? (
          <div className="text-danger-400">{error}</div>
        ) : (
          <>
            <Loader2 className="animate-spin h-8 w-8 text-primary-400 mx-auto mb-4" />
            <p className="text-slate-400">Completing sign-in...</p>
          </>
        )}
      </div>
    </div>
  )
}
