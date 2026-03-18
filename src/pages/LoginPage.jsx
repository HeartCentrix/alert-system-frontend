import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Zap, AlertCircle, Key } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import { authAPI } from '@/services/api'
import toast from 'react-hot-toast'
import MFASetupStep from '@/components/auth/MFASetupStep'
import TFAChallengeStep from '@/components/auth/TFAChallengeStep'
import MFARecoveryCodesDisplay from '@/components/auth/MFARecoveryCodesDisplay'
import RecoveryCodeLoginForm from '@/components/auth/RecoveryCodeLoginForm'

export default function LoginPage() {
  const { login, ldapLogin, verifyMFA, verifyMFAWithRecoveryCode, mfaState, mfaChallengeToken, mfaQRCodeURI, mfaSecret, clearMFAState, isAuthenticated, recoveryCodes } = useAuthStore()
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
  const [ldapUsername, setLdapUsername] = useState('')
  const [ldapPassword, setLdapPassword] = useState('')
  const [showLDAPForm, setShowLDAPForm] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

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

  const onSubmit = async ({ email, password }) => {
    if (lockoutExpiry && Date.now() < lockoutExpiry) return
    setLoading(true)
    try {
      const result = await login(email, password)

      // Check if MFA is required - check the result directly, not store state
      // Zustand state updates are async, so we check the response
      if (result?.status === 'mfa_required') {
        return  // Don't show toast or navigate - MFA screen will render
      }

      // Check if recovery codes were generated (first-time MFA setup)
      if (result?.recovery_codes && result.recovery_codes.length > 0) {
        setPendingRecoveryCodes(result.recovery_codes)
        setShowRecoveryCodesDisplay(true)
        return
      }

      // Normal login success
      toast.success('Welcome back')
      setLockoutExpiry(null)
      setCountdown(null)
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Invalid credentials'
      const retryAfterSeconds = err.response?.headers?.['retry-after'] || err.response?.headers?.['Retry-After']

      if (retryAfterSeconds) {
        const seconds = parseInt(retryAfterSeconds)
        setLockoutExpiry(Date.now() + (seconds * 1000))
        toast.error(`${message}. Try again in ${formatCountdown(seconds)}.`)
      } else {
        // Don't show error for MFA flows
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleLDAPSubmit = async (e) => {
    e.preventDefault()
    if (lockoutExpiry && Date.now() < lockoutExpiry) return
    setLoading(true)
    try {
      await ldapLogin(ldapUsername, ldapPassword)
      toast.success('Welcome back')
      setLockoutExpiry(null)
      setCountdown(null)
      navigate('/dashboard')
    } catch (err) {
      const message = err.response?.data?.detail || err.message || 'Invalid credentials'
      toast.error(message)
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
    // Now mark user as authenticated after they've seen recovery codes
    const { updateUser } = useAuthStore.getState()
    updateUser({})  // Trigger isAuthenticated state update
    useAuthStore.setState({ isAuthenticated: true })
    
    setShowRecoveryCodesDisplay(false)
    setPendingRecoveryCodes(null)
    toast.success('Recovery codes saved. Continue to dashboard.')
    navigate('/dashboard')
  }

  // Render MFA setup step
  if (mfaState === 'setup_required' && mfaQRCodeURI) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="w-full max-w-md animate-fade-in">
          <div className="card p-8">
            <MFASetupStep
              qrCodeURI={mfaQRCodeURI}
              secret={mfaSecret || ''}
              onVerify={handleMFAVerify}
              onCancel={handleCancelMFA}
            />
          </div>
        </div>
      </div>
    )
  }

  // Render MFA challenge step
  if (mfaState === 'challenge_required') {
    if (showRecoveryCodeForm) {
      // Show recovery code entry form
      return (
        <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4"
          style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          <div className="w-full max-w-md animate-fade-in">
            <div className="card p-8">
              <RecoveryCodeLoginForm
                onVerify={handleRecoveryCodeVerify}
                onBackToMFA={() => setShowRecoveryCodeForm(false)}
              />
            </div>
          </div>
        </div>
      )
    }

    // Show regular MFA challenge with option to use recovery code
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="w-full max-w-md animate-fade-in">
          <div className="card p-8">
            <TFAChallengeStep
              onVerify={handleMFAVerify}
              onCancel={handleCancelMFA}
              onUseRecoveryCode={() => setShowRecoveryCodeForm(true)}
            />
          </div>
        </div>
      </div>
    )
  }

  // Render recovery codes display (after first-time MFA setup)
  if (showRecoveryCodesDisplay && pendingRecoveryCodes) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="w-full max-w-md animate-fade-in">
          <div className="card p-8">
            <MFARecoveryCodesDisplay
              codes={pendingRecoveryCodes}
              onDismiss={handleRecoveryCodesDismiss}
            />
          </div>
        </div>
      </div>
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

  // Render LDAP-only login
  if (authProviders.ldap_enabled && !authProviders.local_enabled && !authProviders.entra_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 justify-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-danger-600 flex items-center justify-center shadow-glow-red">
              <Zap size={18} className="text-white" fill="white" />
            </div>
            <div>
              <div className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">TM Alert</div>
              <div className="text-[10px] sm:text-xs text-slate-500 tracking-widest uppercase">Emergency Notification System</div>
            </div>
          </div>
          <div className="card p-6 sm:p-8">
            <h1 className="font-display font-semibold text-xl text-white mb-1">Sign in</h1>
            <p className="text-slate-500 text-sm mb-6">Access with your company account</p>
            <form onSubmit={handleLDAPSubmit} className="space-y-4">
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter your AD username"
                  value={ldapUsername}
                  onChange={(e) => setLdapUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Enter your AD password"
                    value={ldapPassword}
                    onChange={(e) => setLdapPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Render local-only login
  if (authProviders.local_enabled && !authProviders.entra_enabled && !authProviders.ldap_enabled) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 sm:p-6"
        style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center gap-3 justify-center mb-6 sm:mb-8">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-danger-600 flex items-center justify-center shadow-glow-red">
              <Zap size={18} className="text-white" fill="white" />
            </div>
            <div>
              <div className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">TM Alert</div>
              <div className="text-[10px] sm:text-xs text-slate-500 tracking-widest uppercase">Emergency Notification System</div>
            </div>
          </div>
          <div className="card p-6 sm:p-8">
            <h1 className="font-display font-semibold text-xl text-white mb-1">Sign in</h1>
            <p className="text-slate-500 text-sm mb-6">Access the Taylor Morrison alert platform</p>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  placeholder="you@taylomorrison.com"
                  className="input"
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.password.message}
                  </p>
                )}
              </div>
              {authProviders.local_enabled && (
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              )}
              <button
                type="submit"
                disabled={loading || countdown !== null}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {countdown !== null ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Try again in {formatCountdown(countdown)}
                  </span>
                ) : loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>
          </div>
          <p className="text-center text-xs text-slate-600 mt-6">
            Powered by HeartCentrix • Emergency Notification Platform
          </p>
        </div>
      </div>
    )
  }

  // Render combined login (multiple providers enabled)
  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 sm:p-6"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 justify-center mb-6 sm:mb-8">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-danger-600 flex items-center justify-center shadow-glow-red">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <div>
            <div className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">TM Alert</div>
            <div className="text-[10px] sm:text-xs text-slate-500 tracking-widest uppercase">Emergency Notification System</div>
          </div>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="font-display font-semibold text-xl text-white mb-1">Sign in</h1>
          <p className="text-slate-500 text-sm mb-6">Access the Taylor Morrison alert platform</p>

          {/* SSO Buttons Section */}
          <div className="space-y-3 mb-6">
            {/* Microsoft Button */}
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

            {/* LDAP Toggle Button */}
            {authProviders.ldap_enabled && (
              <button
                type="button"
                onClick={() => setShowLDAPForm(!showLDAPForm)}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-surface-600 rounded-lg hover:bg-surface-700 transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {showLDAPForm ? 'Hide Company Login' : 'Sign in with Company Account'}
              </button>
            )}
          </div>

          {/* Divider - only if local is enabled */}
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
          {/* LDAP Form (collapsible) */}
          {authProviders.ldap_enabled && showLDAPForm && (
            <div className="space-y-4 mb-6">
              <div>
                <label className="label">Username</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Enter your AD username"
                  value={ldapUsername}
                  onChange={(e) => setLdapUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    className="input pr-10"
                    placeholder="Enter your AD password"
                    value={ldapPassword}
                    onChange={(e) => setLdapPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <button type="button" onClick={handleLDAPSubmit} className="btn-primary w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          )}

          {/* Local Login Form */}
          {authProviders.local_enabled && (
            <>
              <div>
                <label className="label">Email Address</label>
                <input
                  {...register('email', { required: 'Email is required' })}
                  type="email"
                  placeholder="you@taylomorrison.com"
                  className="input"
                  autoComplete="email"
                />
                {errors.email && (
                  <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    className="input pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.password.message}
                  </p>
                )}
              </div>

              {authProviders.local_enabled && (
                <div className="flex justify-end">
                  <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || countdown !== null}
                className="btn-primary w-full justify-center py-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {countdown !== null ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Try again in {formatCountdown(countdown)}
                  </span>
                ) : loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </>
          )}
          </form>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Powered by HeartCentrix • Emergency Notification Platform
        </p>
      </div>
    </div>
  )
}
