import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff, Zap, AlertCircle } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [lockoutExpiry, setLockoutExpiry] = useState(() => {
    // Restore expiry timestamp from localStorage on mount
    const saved = localStorage.getItem('login_lockout_expiry')
    return saved ? parseInt(saved) : null
  })
  const [countdown, setCountdown] = useState(null)
  const { register, handleSubmit, formState: { errors } } = useForm()

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthenticated, navigate])

  // Persist lockoutExpiry to localStorage
  useEffect(() => {
    if (lockoutExpiry) {
      localStorage.setItem('login_lockout_expiry', lockoutExpiry.toString())
    } else {
      localStorage.removeItem('login_lockout_expiry')
    }
  }, [lockoutExpiry])

  // Countdown timer - calculates remaining time from expiry timestamp
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

  // Format countdown display: seconds if < 60, minutes if >= 60, hours if >= 3600
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
    // Hours
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const onSubmit = async ({ email, password }) => {
    if (lockoutExpiry && Date.now() < lockoutExpiry) return // Block requests during cooldown
    setLoading(true)
    try {
      console.log('[Login] Attempting login for:', email)
      await login(email, password)
      console.log('[Login] Login successful')
      toast.success('Welcome back')
      setLockoutExpiry(null)
      setCountdown(null)
      navigate('/dashboard')
    } catch (err) {
      // Extract error message and retry-after header
      const message = err.response?.data?.detail || err.message || 'Invalid credentials'
      const retryAfterSeconds = err.response?.headers?.['retry-after']

      if (retryAfterSeconds) {
        const seconds = parseInt(retryAfterSeconds)
        // Store expiry timestamp so countdown continues correctly across navigation
        setLockoutExpiry(Date.now() + (seconds * 1000))
        toast.error(`${message}. Try again in ${formatCountdown(seconds)}.`)
      } else {
        toast.error(message)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)' }}>

      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-danger-600 flex items-center justify-center shadow-glow-red">
            <Zap size={22} className="text-white" fill="white" />
          </div>
          <div>
            <div className="font-display font-bold text-2xl text-white tracking-tight">TM Alert</div>
            <div className="text-xs text-slate-500 tracking-widest uppercase">Emergency Notification System</div>
          </div>
        </div>

        <div className="card p-8">
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

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                Forgot password?
              </Link>
            </div>

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
