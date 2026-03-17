import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, AlertCircle, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import { authAPI } from '@/services/api'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [validating, setValidating] = useState(true)
  const [token, setToken] = useState(null)

  // Get reset parameter from URL ONCE on mount — avoid React Router searchParams dependency
  useEffect(() => {
    // Use window.location directly - it's immediately available
    const urlParams = new URLSearchParams(window.location.search)
    const foundToken = urlParams.get('token')
    
    console.log('ResetPasswordPage: URL =', window.location.href)
    console.log('ResetPasswordPage: Token =', foundToken ? `${foundToken.substring(0, 20)}...` : null)
    
    if (foundToken) {
      setToken(foundToken)
      setValidating(false)
    } else {
      console.error('ResetPasswordPage: NO TOKEN FOUND - redirecting to login')
      toast.error('Invalid or missing reset token')
      navigate('/login', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array - run ONLY once on mount

  const { register, handleSubmit, formState: { errors }, watch } = useForm()

  const onSubmit = async ({ new_password }) => {
    if (!token) return

    setLoading(true)
    try {
      await authAPI.resetPassword(token, new_password)
      toast.success('Password reset successfully! Please sign in.')
      navigate('/login')
    } catch (error) {
      const errorMessage = error.response?.data?.detail ||
                          (typeof error.response?.data?.detail === 'object'
                            ? error.response.data.detail.message
                            : 'Failed to reset password. Token may be expired.')
      toast.error(errorMessage || 'Failed to reset password. Token may be expired.')
    } finally {
      setLoading(false)
    }
  }

  if (validating) {
    return (
      <div className="min-h-screen bg-surface-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <div className="text-slate-500 text-sm">Validating...</div>
        </div>
      </div>
    )
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
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4">
              <ArrowLeft size={16} />
              Back to Sign In
            </Link>
            <h1 className="font-display font-semibold text-xl text-white mb-1">Reset Password</h1>
            <p className="text-slate-500 text-sm">Enter your new password below</p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="label">New Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  {...register('new_password', {
                    required: 'Password is required',
                    minLength: {
                      value: 8,
                      message: 'Password must be at least 8 characters'
                    },
                    pattern: {
                      value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                      message: 'Password must contain uppercase, lowercase, and number'
                    }
                  })}
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.new_password && (
                <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.new_password.message}
                </p>
              )}
            </div>

            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  {...register('confirm_password', {
                    required: 'Please confirm your password',
                    validate: value => value === watch('new_password') || 'Passwords do not match'
                  })}
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="input pl-10 pr-10"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.confirm_password.message}
                </p>
              )}
            </div>

            <div className="bg-surface-800/50 rounded-lg p-3 text-xs text-slate-400">
              <p className="font-medium text-slate-300 mb-1">Password requirements:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>At least 8 characters long</li>
                <li>Contains uppercase and lowercase letters</li>
                <li>Contains at least one number</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Resetting...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Lock size={18} />
                  Reset Password
                </span>
              )}
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
