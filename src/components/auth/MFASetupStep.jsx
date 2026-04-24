import { useState } from 'react'
import { Shield, AlertCircle, CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'

/**
 * MFASetupStep - Displays QR code and OTP entry for first-time MFA setup
 * 
 * @param {string} qrCodeURI - The OTPAuth URI for QR code generation
 * @param {string} secret - The raw TOTP secret for manual entry
 * @param {Function} onVerify - Callback when user submits OTP code
 * @param {Function} onCancel - Callback when user cancels the flow
 */
export default function MFASetupStep({ qrCodeURI, secret, onVerify, onCancel }) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)

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
      // Success is handled by parent - they'll redirect or update state
    } catch (err) {
      setError(err.message || 'Invalid code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // QR code is rendered locally. Previously the OTPAuth URI (which embeds the
  // raw base32 TOTP secret) was sent to api.qrserver.com as a GET query
  // parameter — a public service that could log or MITM the secret, giving a
  // permanent MFA bypass. Security review finding F-C1.

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center mx-auto mb-3">
          <Shield size={24} className="text-white" />
        </div>
        <h2 className="font-display font-semibold text-xl text-white mb-1">
          Setup Multi-Factor Authentication
        </h2>
        <p className="text-slate-400 text-sm">
          Scan the QR code with your authenticator app
        </p>
      </div>

      {/* QR Code */}
      <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
        <div className="flex justify-center mb-4">
          <div className="w-48 h-48 rounded-lg bg-white p-2 flex items-center justify-center">
            <QRCodeSVG
              value={qrCodeURI}
              size={176}
              level="M"
              aria-label="MFA QR Code"
            />
          </div>
        </div>
        
        <div className="text-center text-sm text-slate-400 mb-4">
          <p className="mb-2">Supported apps:</p>
          <div className="flex justify-center gap-4 text-xs">
            <span>Google Authenticator</span>
            <span>•</span>
            <span>Authy</span>
            <span>•</span>
            <span>Microsoft Authenticator</span>
          </div>
        </div>

        {/* Manual Entry Toggle */}
        <button
          type="button"
          onClick={() => setShowManualEntry(!showManualEntry)}
          className="w-full text-xs text-primary-400 hover:text-primary-300 transition-colors"
        >
          {showManualEntry ? 'Hide manual entry' : "Can't scan the QR code?"}
        </button>

        {/* Manual Entry */}
        {showManualEntry && (
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-2">Enter this key manually:</p>
            <code className="block text-sm font-mono text-white bg-slate-800 px-3 py-2 rounded break-all">
              {secret}
            </code>
          </div>
        )}
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
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="btn-secondary flex-1"
            disabled={loading}
          >
            Cancel
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
                Verify & Continue
              </span>
            )}
          </button>
        </div>
      </form>

      {/* Info */}
      <div className="mt-6 p-4 bg-primary-900/20 border border-primary-800/30 rounded-lg">
        <p className="text-xs text-primary-300">
          <strong className="font-semibold">Why MFA?</strong> Multi-factor authentication 
          adds an extra layer of security to your account by requiring a code from your 
          phone in addition to your password.
        </p>
      </div>
    </div>
  )
}
