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
    const errorParam = params.get('error')

    // Check for error from backend (e.g., mfa_required_on_idp)
    if (errorParam === 'mfa_required_on_idp') {
      setError('mfa_required')
      return
    }

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

  if (error === 'mfa_required') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <div className="max-w-md w-full bg-surface-800 rounded-lg p-8 text-center shadow-xl border border-danger-900">
          <div className="text-danger-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">MFA Required for Access</h1>
          <p className="text-slate-300 mb-6 leading-relaxed">
            Your role requires Multi-Factor Authentication to be enabled on your <strong>Microsoft account</strong> before you can access TM Alert.
          </p>
          <div className="bg-surface-900 rounded-lg p-4 mb-6 text-left">
            <p className="text-slate-400 text-sm mb-2">To fix this:</p>
            <ol className="text-slate-300 text-sm space-y-2 list-decimal list-inside">
              <li>Contact your IT administrator</li>
              <li>Ask them to enable MFA on your Microsoft Entra account</li>
              <li>Once enabled, try signing in again</li>
            </ol>
          </div>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    )
  }

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
