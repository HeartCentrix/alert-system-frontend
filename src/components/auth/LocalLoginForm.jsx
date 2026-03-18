import { Link } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff } from 'lucide-react'

export default function LocalLoginForm({
  register,
  errors,
  showPass,
  setShowPass,
  loading,
  countdown,
  formatCountdown,
  onForgotPassword
}) {
  return (
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

      {onForgotPassword && (
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
  )
}
