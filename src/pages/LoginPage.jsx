import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, AlertCircle, Loader2 } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { authAPI } from '@/services/api'
import toast from 'react-hot-toast'
import MFASetupStep from '@/components/auth/MFASetupStep'
import TFAChallengeStep from '@/components/auth/TFAChallengeStep'
import MFARecoveryCodesDisplay from '@/components/auth/MFARecoveryCodesDisplay'
import RecoveryCodeLoginForm from '@/components/auth/RecoveryCodeLoginForm'
import LocalLoginForm from '@/components/auth/LocalLoginForm'
import LoginPageWrapper from '@/components/auth/LoginPageWrapper'

const LOGO_SECTION = (
  <div className="flex items-center gap-3 justify-center mb-6 sm:mb-8">
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-danger-600 flex items-center justify-center shadow-glow-red">
      <Zap size={18} className="text-white" fill="white" />
    </div>
    <div>
      <div className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">TM Alert</div>
      <div className="text-[10px] sm:text-xs text-slate-500 tracking-widest uppercase">Emergency Notification System</div>
    </div>
  </div>
)

const FOOTER_TEXT = (
  <p className="text-center text-xs text-slate-600 mt-6">
    Powered by HeartCentrix • Emergency Notification Platform
  </p>
)

export default function LoginPage() {
  const { login, verifyMFA, verifyMFAWithRecoveryCode, mfaState, mfaChallengeToken, mfaQRCodeURI, mfaSecret, clearMFAState, isAuthenticated, recoveryCodes } = useAuthStore()
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lockoutExpiry, setLockoutExpiry] = useState(() => {
    const saved = localStorage.getItem('login_lockout_expiry')
    return saved ? parseInt(saved) : null
  })
  const [countdown, setCountdown] = useState(null)
  const [showRecoveryCodeForm, setShowRecoveryCodeForm] = useState(false)
  const [showRecoveryCodesDisplay, setShowRecoveryCodesDisplay] = useState(false)
  const [pendingRecoveryCodes, setPendingRecoveryCodes] = useState(null)
  const [authProviders, setAuthProviders] = useState({ local_enabled: true })
  const { register, handleSubmit, formState: { errors } } = useForm()
  
  // 2026 STANDARD: Track failed login attempts for additional client-side protection
  const [failedAttempts, setFailedAttempts] = useState(0)
  const MAX_FAILED_ATTEMPTS = 5  // Hard limit before requiring cooldown

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Fetch enabled auth providers on mount
  useEffect(() => {
    authAPI.getProviders()
      .then(({ data }) => setAuthProviders(data))
      .catch(() => setAuthProviders({ local_enabled: true }))  // Fallback to local
  }, [])

  // Clear MFA state on unmount
  useEffect(() => {
    return () => {
      clearMFAState()
    }
  }, [])

  // Persist lockoutExpiry to localStorage
  useEffect(() => {
    if (lockoutExpiry) {
      localStorage.setItem('login_lockout_expiry', lockoutExpiry.toString())
    } else {
      localStorage.removeItem('login_lockout_expiry')
    }
  }, [lockoutExpiry])

  // Countdown timer
  useEffect(() => {
    if (!lockoutExpiry) {
      setCountdown(null)
      return
    }

    const updateCountdown = () => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((lockoutExpiry - now) / 1000))

      if (remaining <= 0) {
        setLockoutExpiry(null)
        setCountdown(null)
        return
      }

      setCountdown(remaining)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [lockoutExpiry])

  const formatCountdown = (seconds) => {
    if (!seconds) return null
    if (seconds < 60) {
      return `${seconds}s`
    }
    if (seconds < 3600) {
      const mins = Math.floor(seconds / 60)
      const secs = seconds % 60
      return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
    }
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  // Shared error handler for login submissions
  const handleLoginError = (err, isLockout = false) => {
    const detail = err.response?.data?.detail || err.message || 'Invalid credentials'
    let message = detail
    let retryAfterSeconds = err.response?.headers?.['retry-after'] || err.response?.headers?.['Retry-After']

    if (typeof detail === 'object') {
      if (detail.message) message = detail.message
      if (detail.remaining_attempts !== undefined) {
        message = `${detail.message}. ${detail.remaining_attempts} attempts remaining.`
      }
      if (detail.retry_after_seconds !== undefined) {
        retryAfterSeconds = detail.retry_after_seconds
      }
    }

    // 2026 STANDARD: Track failed attempts for additional brute force protection
    setFailedAttempts(prev => prev + 1)

    if (retryAfterSeconds) {
      const seconds = parseInt(retryAfterSeconds)
      setLockoutExpiry(Date.now() + (seconds * 1000))
      toast.error(`${message}. Try again in ${formatCountdown(seconds)}.`)
    } else {
      toast.error(message)
    }
  }

  const onSubmit = async ({ email, password }) => {
    // 2026 STANDARD: Hard client-side limit to prevent brute force
    if (lockoutExpiry && Date.now() < lockoutExpiry) return
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      toast.error('Too many failed attempts. Please try again later.')
      setLockoutExpiry(Date.now() + 300000) // 5 minute cooldown
      return
    }
    
    setLoading(true)
    try {
      const result = await login(email, password)
      if (result?.status === 'mfa_required') return
      if (result?.recovery_codes?.length > 0) {
        setPendingRecoveryCodes(result.recovery_codes)
        setShowRecoveryCodesDisplay(true)
        return
      }
      toast.success('Welcome back')
      setLockoutExpiry(null)
      setFailedAttempts(0) // Reset on success
      navigate('/dashboard')
    } catch (err) {
      handleLoginError(err)
    } finally {
      setLoading(false)
    }
  }

  const handleMFAVerify = async (code) => {
    setLoading(true)
    try {
      const result = await verifyMFA(code)

      // If this was first-time MFA setup, backend returns recovery codes once.
      // Show them before navigating — user must acknowledge before proceeding.
      if (result?.recovery_codes && result.recovery_codes.length > 0) {
        setPendingRecoveryCodes(result.recovery_codes)
        setShowRecoveryCodesDisplay(true)
        return  // Don't navigate yet — wait for user to dismiss recovery codes modal
      }

      toast.success('Authentication successful')
      setLockoutExpiry(null)
      setFailedAttempts(0) // Reset on success
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.detail || err.message
      // Provide specific error messages based on the error type
      let errorMessage = 'Invalid code. Please try again.'

      if (message?.includes('locked')) {
        errorMessage = 'Account locked due to too many failed attempts. Please try again later.'
      } else if (message?.includes('expired')) {
        errorMessage = 'Session expired. Please try logging in again.'
      } else if (message?.includes('recovery')) {
        errorMessage = 'Invalid recovery code'
      } else if (message) {
        // Use the message from server (includes "Invalid credentials or MFA code")
        errorMessage = message
      }

      // Don't show toast for invalid codes - let the inline error display handle it
      // This keeps the user on the MFA page without additional notifications
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleRecoveryCodeVerify = async (code) => {
    setLoading(true)
    try {
      await verifyMFAWithRecoveryCode(code, mfaChallengeToken)
      toast.success('Recovery code verified. Welcome back!')
      setLockoutExpiry(null)
      setFailedAttempts(0) // Reset on success
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.detail || err.message
      // Provide specific error messages based on the error type
      let errorMessage = 'Invalid recovery code. Please try again.'

      if (message?.includes('locked')) {
        errorMessage = 'Account locked due to too many failed attempts. Please try again later.'
      } else if (message?.includes('expired')) {
        errorMessage = 'Session expired. Please try logging in again.'
      } else if (message?.includes('used')) {
        errorMessage = 'This recovery code has already been used'
      } else if (message) {
        errorMessage = message
      }

      // Don't show toast for invalid codes - let the inline error display handle it
      throw new Error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelMFA = () => {
    // Clear MFA state and return to login form (not showing toast)
    clearMFAState()
    setShowRecoveryCodeForm(false)
  }

  const handleRecoveryCodesDismiss = () => {
    const { updateUser } = useAuthStore.getState()
    updateUser({})
    useAuthStore.setState({ isAuthenticated: true })
    setShowRecoveryCodesDisplay(false)
    setPendingRecoveryCodes(null)
    toast.success('Recovery codes saved. Continue to dashboard.')
    navigate('/dashboard')
  }

  // Helper to render MFA/auth wrapper with consistent styling
  const renderAuthWrapper = (children) => (
    <LoginPageWrapper logoSection={LOGO_SECTION} footerText={FOOTER_TEXT}>
      <div className="card p-8">{children}</div>
    </LoginPageWrapper>
  )

  // Render MFA setup step
  if (mfaState === 'setup_required' && mfaQRCodeURI) {
    return renderAuthWrapper(
      <MFASetupStep
        qrCodeURI={mfaQRCodeURI}
        secret={mfaSecret || ''}
        onVerify={handleMFAVerify}
        onCancel={handleCancelMFA}
      />
    )
  }

  // Render MFA challenge step
  if (mfaState === 'challenge_required') {
    if (showRecoveryCodeForm) {
      return renderAuthWrapper(
        <RecoveryCodeLoginForm
          onVerify={handleRecoveryCodeVerify}
          onBackToMFA={() => setShowRecoveryCodeForm(false)}
        />
      )
    }
    return renderAuthWrapper(
      <TFAChallengeStep
        onVerify={handleMFAVerify}
        onCancel={handleCancelMFA}
        onUseRecoveryCode={() => setShowRecoveryCodeForm(true)}
      />
    )
  }

  // Render recovery codes display
  if (showRecoveryCodesDisplay && pendingRecoveryCodes) {
    return renderAuthWrapper(
      <MFARecoveryCodesDisplay
        codes={pendingRecoveryCodes}
        onDismiss={handleRecoveryCodesDismiss}
      />
    )
  }

  // Render Microsoft-only login (redirect immediately)
  if (authProviders.entra_enabled && !authProviders.local_enabled && !authProviders.ldap_enabled) {
    const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'
    window.location.href = `${baseUrl}/api/v1/auth/entra/login`
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <Loader2 className="animate-spin h-8 w-8 text-primary-400" />
      </div>
    )
  }

  // Render LDAP-only login (redirect to company login page)
  if (authProviders.ldap_enabled && !authProviders.local_enabled && !authProviders.entra_enabled) {
    navigate('/company-login', { replace: true })
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-900">
        <Loader2 className="animate-spin h-8 w-8 text-primary-400" />
      </div>
    )
  }

  // Render local-only login
  if (authProviders.local_enabled && !authProviders.entra_enabled && !authProviders.ldap_enabled) {
    return (
      <LoginPageWrapper logoSection={LOGO_SECTION} footerText={FOOTER_TEXT}>
        <h1 className="font-display font-semibold text-xl text-white mb-1">Sign in</h1>
        <p className="text-slate-500 text-sm mb-6">Access the Taylor Morrison alert platform</p>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <LocalLoginForm
            register={register}
            errors={errors}
            showPass={showPass}
            setShowPass={setShowPass}
            loading={loading}
            countdown={countdown}
            formatCountdown={formatCountdown}
            onForgotPassword={() => {}}
          />
        </form>
      </LoginPageWrapper>
    )
  }

  // Render combined login (multiple providers enabled)
  return (
    <LoginPageWrapper logoSection={LOGO_SECTION} footerText={FOOTER_TEXT}>
      <h1 className="font-display font-semibold text-xl text-white mb-1">Sign in</h1>
      <p className="text-slate-500 text-sm mb-6">Access the Taylor Morrison alert platform</p>

      {/* SSO Buttons Section */}
      <div className="space-y-3 mb-6">
        {authProviders.entra_enabled && (
          <button
            type="button"
            onClick={() => {
              const baseUrl = import.meta.env.VITE_API_URL?.replace('/api/v1', '') || 'http://localhost:8000'
              window.location.href = `${baseUrl}/api/v1/auth/entra/login`
            }}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors text-white"
          >
            <svg className="w-5 h-5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
              <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
            </svg>
            Sign in with Microsoft
          </button>
        )}

        {authProviders.ldap_enabled && (
          <button
            type="button"
            onClick={() => navigate('/company-login')}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Sign in with Company Account
          </button>
        )}
      </div>

      {authProviders.local_enabled && (authProviders.entra_enabled || authProviders.ldap_enabled) && (
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-600" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-surface-900 text-slate-500">or sign in with email</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {authProviders.local_enabled && (
          <LocalLoginForm
            register={register}
            errors={errors}
            showPass={showPass}
            setShowPass={setShowPass}
            loading={loading}
            countdown={countdown}
            formatCountdown={formatCountdown}
            onForgotPassword
          />
        )}
      </form>
    </LoginPageWrapper>
  )
}
