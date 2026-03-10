import { useState } from 'react'
import { Shield, Download, Copy, Check, AlertTriangle } from 'lucide-react'

/**
 * MFARecoveryCodesDisplay - Shows recovery codes after MFA setup
 * 
 * Security features:
 * - Shows codes only once (parent should not show again after dismissal)
 * - Allows copy to clipboard
 * - Allows download as text file
 * - Requires user acknowledgement before dismissal
 * 
 * @param {string[]} codes - Array of plaintext recovery codes
 * @param {Function} onDismiss - Callback when user acknowledges and dismisses
 */
export default function MFARecoveryCodesDisplay({ codes, onDismiss }) {
  const [copied, setCopied] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)

  // Format codes for display (grouped in pairs for readability)
  const formatCode = (code) => {
    // Split 12-char code into groups of 4: "ABCD1234EFGH" → "ABCD-1234-EFGH"
    return code.match(/.{1,4}/g)?.join('-') || code
  }

  const handleCopy = async () => {
    const codesText = codes.join('\n')
    try {
      await navigator.clipboard.writeText(codesText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy codes:', err)
    }
  }

  const handleDownload = () => {
    const content = `TM Alert - MFA Recovery Codes
Generated: ${new Date().toISOString()}

IMPORTANT: Store these codes in a secure location.
Each code can only be used once.
These codes will not be shown again.

${codes.map(c => formatCode(c)).join('\n')}

---
Keep these codes safe. They provide backup access to your account if you lose your authenticator device.
`
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tm-alert-recovery-codes-${Date.now()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="animate-fade-in">
      {/* Warning Banner */}
      <div className="bg-danger-900/30 border border-danger-700/50 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertTriangle className="text-danger-400 flex-shrink-0 mt-0.5" size={20} />
          <div>
            <h3 className="font-semibold text-danger-300 text-sm mb-1">
              Store These Codes Securely
            </h3>
            <ul className="text-xs text-danger-200/80 space-y-1">
              <li>• These codes will NOT be shown again</li>
              <li>• Each code can only be used ONCE</li>
              <li>• Store in a password manager or safe location</li>
              <li>• Use these codes if you lose your authenticator device</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Recovery Codes Grid */}
      <div className="bg-slate-800/50 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Shield size={18} className="text-primary-400" />
            Your Recovery Codes
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              title="Copy all codes"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1"
              title="Download codes"
            >
              <Download size={14} />
              Download
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {codes.map((code, index) => (
            <div
              key={index}
              className="bg-slate-900/80 rounded-lg px-4 py-3 font-mono text-sm text-center tracking-wider text-emerald-400 border border-slate-700 hover:border-emerald-600/50 transition-colors"
            >
              {formatCode(code)}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 mt-4 text-center">
          {codes.length} recovery codes • Store them safely
        </p>
      </div>

      {/* Acknowledgement Checkbox */}
      <div className="mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-1 w-4 h-4 rounded border-slate-600 text-primary-600 focus:ring-primary-500 focus:ring-offset-slate-800"
          />
          <span className="text-sm text-slate-300">
            I have saved these recovery codes in a secure location. I understand they will not be shown again.
          </span>
        </label>
      </div>

      {/* Continue Button */}
      <button
        onClick={onDismiss}
        disabled={!acknowledged}
        className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue to Dashboard
      </button>
    </div>
  )
}
