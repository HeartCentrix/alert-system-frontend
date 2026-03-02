import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Zap, AlertCircle, Mail, ArrowLeft } from 'lucide-react'
import { authAPI } from '@/services/api'
import toast from 'react-hot-toast'

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm()

  const onSubmit = async ({ email }) => {
    setLoading(true)
    try {
      await authAPI.forgotPassword(email)
      setSubmitted(true)
      toast.success('Password reset email sent!')
    } catch (err) {
      console.error('Forgot password error:', err.response?.data)
      toast.error(err.response?.data?.detail || 'Failed to send reset email')
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
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200 transition-colors mb-4">
              <ArrowLeft size={16} />
              Back to Sign In
            </Link>
            <h1 className="font-display font-semibold text-xl text-white mb-1">Forgot Password</h1>
            <p className="text-slate-500 text-sm">
              {submitted 
                ? 'Check your email for reset instructions' 
                : 'Enter your email and we will send you a reset link'}
            </p>
          </div>

          {!submitted ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input
                    {...register('email', { 
                      required: 'Email is required',
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email address'
                      }
                    })}
                    type="email"
                    placeholder="you@taylomorrison.com"
                    className="input pl-10"
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="mt-1 text-xs text-danger-400 flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.email.message}
                  </p>
                )}
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
                    Sending...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Mail size={18} />
                    Send Reset Link
                  </span>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-primary-600/20 flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-primary-400" />
              </div>
              <h2 className="font-display font-semibold text-lg text-white mb-2">Check Your Email</h2>
              <p className="text-slate-400 text-sm mb-6">
                We've sent a password reset link to your email address.
                The link will expire in 1 hour.
              </p>
              <p className="text-slate-500 text-xs">
                Didn't receive the email? Check your spam folder or try again.
              </p>
              <button
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm text-primary-400 hover:text-primary-300 transition-colors"
              >
                Try another email
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Powered by HeartCentrix • Emergency Notification Platform
        </p>
      </div>
    </div>
  )
}
