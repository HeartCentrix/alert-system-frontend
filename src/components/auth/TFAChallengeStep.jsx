import { useState, useEffect } from 'react'
import { Shield, AlertCircle, CheckCircle2, Smartphone, X } from 'lucide-react'

/**
 * TFAChallengeStep - Displays OTP entry for users who already have 2FA configured
 *
 * @param {Function} onVerify - Callback when user submits OTP code
 * @param {Function} onCancel - Callback when user cancels the flow (back to login)
 * @param {Function} onUseRecoveryCode - Callback to switch to recovery code login
 */
export default function TFAChallengeStep({ onVerify, onCancel, onUseRecoveryCode }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [totpExpiry, setTotpExpiry] = useState(30)

  // TOTP codes refresh every 30 seconds - show countdown to help users
  useEffect(() => {
    // Calculate initial remaining time
    const updateExpiry = () => {
      const remaining = 30 - (Math.floor(Date.now() / 1000) % 30)
      setTotpExpiry(remaining)
    }

    updateExpiry()
    const interval = setInterval(() => {
      updateExpiry()
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Validate code format
      if (!/^\d{6}$/.test(code)) {
        throw new Error('Code must be 6 digits')
      }

      await onVerify(code)
      // Success is handled by parent
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header with Close Button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center">
            <Smartphone size={24} className="text-white" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-xl text-white">
              Two-Factor Authentication
            </h2>
            <p className="text-slate-400 text-sm">
              Enter the code from your authenticator app
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-700"
          title="Cancel login"
        >
          <X size={20} />
        </button>
      </div>

      {/* OTP Entry */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Authentication Code</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            className="input text-center tracking-widest text-lg"
            autoFocus
          />
          {error && (
            <p className="mt-2 text-xs text-danger-400 flex items-center gap-1 justify-center">
              <AlertCircle size={12} /> {error}
            </p>
          )}
          {/* TOTP expiry countdown */}
          <div className={`mt-2 text-xs flex items-center justify-center gap-1 ${
            totpExpiry <= 5 ? 'text-amber-400' : 'text-slate-500'
          }`}>
            {totpExpiry <= 5 && (
              <span className="animate-pulse">⏱️</span>
            )}
            <span>
              {totpExpiry <= 5 
                ? `Code expires in ${totpExpiry}s - enter quickly!` 
                : `New code in ${totpExpiry}s`}
            </span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onUseRecoveryCode}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Use recovery code
          </button>
          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Verifying...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} />
                Sign In
              </span>
            )}
          </button>
        </div>
      </form>

      {/* Help */}
      <div className="mt-6 space-y-3">
        <div className="p-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-400">
            <strong className="text-slate-300">Using an authenticator app?</strong>
            <br />
            Open your authenticator app and enter the 6-digit code for TM Alert.
          </p>
        </div>

        <div className="p-3 bg-slate-800/50 rounded-lg">
          <p className="text-xs text-slate-400">
            <strong className="text-slate-300">Code not working?</strong>
            <br />
            Make sure your device's time is synchronized. Authenticator apps
            require accurate time to generate valid codes.
          </p>
        </div>
      </div>
    </div>
  )
}
