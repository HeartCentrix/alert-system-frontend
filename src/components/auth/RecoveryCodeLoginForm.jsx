import { useState } from 'react'
import { Key, AlertCircle, HelpCircle } from 'lucide-react'

/**
 * RecoveryCodeLoginForm - Form for entering a recovery code during login
 *
 * @param {Function} onVerify - Callback when user submits recovery code
 * @param {Function} onBackToMFA - Callback to go back to regular MFA
 */
export default function RecoveryCodeLoginForm({ onVerify, onBackToMFA }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // Normalize code: remove spaces/dashes, uppercase
      const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase()

      if (normalizedCode.length < 10) {
        throw new Error('Recovery code is too short')
      }

      await onVerify(normalizedCode)
    } catch (err) {
      setError(err.message || 'Invalid recovery code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
          <Key size={24} className="text-white" />
        </div>
        <h2 className="font-display font-semibold text-xl text-white mb-1">
          Use Recovery Code
        </h2>
        <p className="text-slate-400 text-sm">
          Enter one of your saved recovery codes
        </p>
      </div>

      {/* Info Box */}
      <div className="bg-primary-900/20 border border-primary-800/30 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <HelpCircle className="text-primary-400 flex-shrink-0 mt-0.5" size={16} />
          <div className="text-xs text-primary-200">
            <p className="mb-2 font-semibold">Where to find your recovery codes:</p>
            <ul className="text-primary-300/80 space-y-1">
              <li>• Saved in your password manager</li>
              <li>• Downloaded as a text file</li>
              <li>• Printed and stored safely</li>
              <li>• Copied to a secure note</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recovery Code Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Recovery Code</label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD-1234-EFGH"
            className="input text-center tracking-wider font-mono uppercase"
            autoFocus
          />
          <p className="mt-2 text-xs text-slate-500">
            Enter the code exactly as shown (dashes are optional)
          </p>
          {error && (
            <p className="mt-2 text-xs text-danger-400 flex items-center gap-1 justify-center">
              <AlertCircle size={12} /> {error}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onBackToMFA}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Back to 2FA
          </button>
          <button
            type="submit"
            disabled={loading || code.length < 10}
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
              'Use Recovery Code'
            )}
          </button>
        </div>
      </form>

      {/* Security Notice */}
      <div className="mt-6 p-3 bg-slate-800/30 rounded-lg">
        <p className="text-xs text-slate-500 text-center">
          Each recovery code can only be used once. After using a code, it will be permanently invalidated.
        </p>
      </div>
    </div>
  )
}
