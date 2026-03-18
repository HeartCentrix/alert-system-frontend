import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setTokensFromSSO } = useAuthStore()
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (accessToken && refreshToken) {
      // Store tokens and redirect to dashboard
      setTokensFromSSO(accessToken, refreshToken)
        .then(() => {
          navigate('/dashboard', { replace: true })
        })
        .catch((err) => {
          console.error('SSO callback error:', err)
          setError('Failed to complete sign-in. Please try again.')
          setTimeout(() => navigate('/login', { replace: true }), 3000)
        })
    } else {
      setError('Missing authentication tokens. Redirecting to login...')
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    }
  }, [location, navigate, setTokensFromSSO])

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
