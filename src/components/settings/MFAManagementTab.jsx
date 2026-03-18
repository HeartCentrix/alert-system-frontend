import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Shield, Key, RefreshCw, AlertTriangle, CheckCircle, XCircle, Smartphone, Lock } from 'lucide-react'
import { authAPI } from '@/services/api'
import toast from 'react-hot-toast'
import { cn } from '@/utils/helpers'
import { getPrimaryErrorMessage, getUserFacingErrorMessages } from '@/utils/errorHandler'
import ModalPortal from '@/components/ui/ModalPortal'

/**
 * MFAManagementTab - Complete MFA lifecycle management component
 *
 * Features:
 * - View MFA status
 * - Enable MFA (with reauthentication)
 * - Disable MFA (with reauthentication + MFA verification)
 * - Reset/Replace MFA (with reauthentication)
 * - Regenerate recovery codes
 * - View recovery codes
 *
 * Security:
 * - All sensitive operations require password reauthentication
 * - Policy-based UI (privileged users cannot disable MFA)
 */
export default function MFAManagementTab({ authProviders }) {
  const queryClient = useQueryClient()
  const [mfaStatus, setMfaStatus] = useState(null)

  // Fetch MFA status
  const { data: statusData, isLoading, refetch } = useQuery({
    queryKey: ['mfa-status'],
    queryFn: async () => {
      const { data } = await authAPI.getMFAStatus()
      setMfaStatus(data)
      return data
    },
    staleTime: 30 * 1000, // 30 seconds
  })

  const handleStatusChange = () => {
    refetch()
    queryClient.invalidateQueries(['mfa-status'])
  }

  if (isLoading) {
    return (
      <div className="card p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/3"></div>
          <div className="h-4 bg-slate-700 rounded w-2/3"></div>
          <div className="h-20 bg-slate-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* MFA Status Card */}
      <MFAStatusCard status={statusData} onRefresh={handleStatusChange} />

      {/* Action Cards based on status */}
      {statusData && (
        <>
          {!statusData.mfa_enabled ? (
            <MFAEnableCard
              mfaConfigured={statusData.mfa_configured}
              onEnableComplete={handleStatusChange}
            />
          ) : (
            <>
              <RecoveryCodesCard
                hasCodes={statusData.has_recovery_codes}
                codesCount={statusData.recovery_codes_count}
                mfaStatus={statusData}
              />
              {statusData.can_disable ? (
                <MFADisableCard onDisableComplete={handleStatusChange} />
              ) : (
                <MFARequiredNotice />
              )}
              <MFAResetCard onResetComplete={handleStatusChange} />
            </>
          )}
        </>
      )}

      {/* Authentication Providers Section */}
      {authProviders && (
        <div className="card p-6">
          <h3 className="font-display font-semibold text-white mb-4 flex items-center gap-2">
            <Lock size={18} />
            Authentication Providers
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Email / Password</span>
              <span className={`text-xs px-2 py-1 rounded ${authProviders?.local_enabled ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                {authProviders?.local_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Microsoft Entra ID (SSO)</span>
              <span className={`text-xs px-2 py-1 rounded ${authProviders?.entra_enabled ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                {authProviders?.entra_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Active Directory (LDAP)</span>
              <span className={`text-xs px-2 py-1 rounded ${authProviders?.ldap_enabled ? 'bg-green-900/30 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                {authProviders?.ldap_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-2">
              Authentication providers are configured by your system administrator via environment variables.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * MFAStatusCard - Displays current MFA status
 */
function MFAStatusCard({ status, onRefresh }) {
  if (!status) return null

  const isPrivileged = status.mfa_required && !status.can_disable

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            status.mfa_enabled ? 'bg-success-600/20' : 'bg-slate-700'
          )}>
            {status.mfa_enabled ? (
              <CheckCircle size={24} className="text-success-400" />
            ) : (
              <XCircle size={24} className="text-slate-400" />
            )}
          </div>
          <div>
            <h2 className="font-display font-semibold text-white text-lg">
              Multi-Factor Authentication
            </h2>
            <p className="text-sm text-slate-400">
              {status.mfa_enabled
                ? 'MFA is enabled and protecting your account'
                : 'MFA is not enabled - your account is less secure'}
            </p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 text-slate-400 hover:text-white transition-colors"
          title="Refresh status"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Status Badges */}
      <div className="flex flex-wrap gap-2 pt-4 border-t border-slate-700/50">
        <StatusBadge
          label="MFA Enabled"
          active={status.mfa_enabled}
          icon={Shield}
        />
        <StatusBadge
          label="MFA Required"
          active={status.mfa_required}
          icon={Lock}
        />
        <StatusBadge
          label="Recovery Codes"
          active={status.has_recovery_codes}
          icon={Key}
          count={status.recovery_codes_count}
        />
        {isPrivileged && (
          <span className="badge badge-orange">
            <Lock size={12} className="mr-1" />
            MFA Enforced for Your Role
          </span>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ label, active, icon: Icon, count }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
      active
        ? 'bg-success-600/10 border-success-600/30 text-success-300'
        : 'bg-slate-700/50 border-slate-600/50 text-slate-400'
    )}>
      <Icon size={12} />
      {label}
      {count !== undefined && (
        <span className="ml-1 text-[10px] opacity-75">({count})</span>
      )}
    </span>
  )
}

/**
 * MFAEnableCard - Allows users to enable MFA
 */
function MFAEnableCard({ mfaConfigured, onEnableComplete }) {
  const [showEnrollModal, setShowEnrollModal] = useState(false)

  return (
    <>
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
            <Smartphone size={24} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-white mb-1">
              Enable MFA
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Add an extra layer of security to your account by enabling multi-factor authentication.
              You'll need a code from your phone in addition to your password when logging in.
            </p>
            <button
              onClick={() => setShowEnrollModal(true)}
              className="btn-primary"
            >
              <Shield size={16} className="mr-2" />
              Enable MFA
            </button>
          </div>
        </div>
      </div>

      {showEnrollModal && (
        <MFAEnrollmentModal
          onClose={() => setShowEnrollModal(false)}
          onEnrollmentComplete={onEnableComplete}
        />
      )}
    </>
  )
}

/**
 * MFAEnrollmentModal - Step-by-step MFA enrollment with reauthentication
 */
function MFAEnrollmentModal({ onClose, onEnrollmentComplete }) {
  const [step, setStep] = useState('reauth') // reauth, setup, verify, success
  const [password, setPassword] = useState('')
  const [qrCodeUri, setQrCodeUri] = useState('')
  const [secret, setSecret] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartEnrollment = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await authAPI.startMFAEnrollment(password)
      setQrCodeUri(data.qr_code_uri)
      setSecret(data.manual_entry_key)
      setStep('setup')
    } catch (err) {
      // Normalize error to prevent rendering raw objects
      setError(getPrimaryErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (code) => {
    setError('')
    setLoading(true)

    try {
      const { data } = await authAPI.completeMFAEnrollment(code)
      setRecoveryCodes(data.recovery_codes)
      setStep('success')
      // Don't call onEnrollmentComplete yet - wait for user to dismiss recovery codes
      toast.success('MFA enabled successfully!')
    } catch (err) {
      // Normalize error to prevent rendering raw objects
      setError(getPrimaryErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDismissRecoveryCodes = () => {
    onEnrollmentComplete()
    onClose()
  }

  return (
    <ModalPortal>
      <div className="modal-overlay">
        <div className="bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          {step === 'reauth' && (
            <form onSubmit={handleStartEnrollment} className="p-6">
              <h3 className="font-display font-semibold text-xl text-white mb-2">
                Enable MFA
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                For security, please confirm your password before enabling MFA.
              </p>
              <div className="mb-4">
                <label className="label">Current Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                placeholder="Enter your password"
                autoFocus
              />
              {error && (
                <p className="mt-2 text-xs text-danger-400">{error}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !password}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 'setup' && (
          <MFASetupStep
            qrCodeURI={qrCodeUri}
            secret={secret}
            onVerify={handleVerifyCode}
            onCancel={onClose}
            error={error}
            loading={loading}
          />
        )}

        {step === 'verify' && (
          <div className="p-6">
            <p className="text-white">Verifying...</p>
          </div>
        )}

        {step === 'success' && (
          <RecoveryCodesDisplay
            codes={recoveryCodes}
            onClose={handleDismissRecoveryCodes}
          />
        )}
      </div>
    </div>
    </ModalPortal>
  )
}

/**
 * MFADisableCard - Allows eligible users to disable MFA
 */
function MFADisableCard({ onDisableComplete }) {
  const [showDisableModal, setShowDisableModal] = useState(false)

  return (
    <>
      <div className="card p-6 border border-danger-900/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-danger-600/20 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={24} className="text-danger-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-white mb-1">
              Disable MFA
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Disabling MFA will make your account less secure. We recommend keeping MFA enabled
              to protect your account from unauthorized access.
            </p>
            <button
              onClick={() => setShowDisableModal(true)}
              className="btn-outline border-danger-700 text-danger-400 hover:bg-danger-900/20"
            >
              <AlertTriangle size={16} className="mr-2" />
              Disable MFA
            </button>
          </div>
        </div>
      </div>

      {showDisableModal && (
        <MFADisableModal
          onClose={() => setShowDisableModal(false)}
          onDisableComplete={onDisableComplete}
        />
      )}
    </>
  )
}

/**
 * MFADisableModal - Secure MFA disable with reauthentication and MFA verification
 */
function MFADisableModal({ onClose, onDisableComplete }) {
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  const handleDisable = async (e) => {
    e.preventDefault()
    setError('')

    if (!confirmed) {
      setError('Please confirm that you want to disable MFA')
      return
    }

    setLoading(true)

    try {
      await authAPI.disableMFAWithReauth(password, mfaCode)
      toast.success('MFA disabled. Your account is now less secure.')
      onDisableComplete()
      onClose()
    } catch (err) {
      // Normalize error to prevent rendering raw objects
      setError(getPrimaryErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay">
        <div className="bg-slate-800 rounded-xl max-w-md w-full">
          <form onSubmit={handleDisable} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-danger-600/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-danger-400" />
              </div>
              <h3 className="font-display font-semibold text-lg text-white">
                Disable MFA
              </h3>
            </div>

            <div className="bg-danger-900/20 border border-danger-800/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-danger-300">
                <strong>Warning:</strong> Disabling MFA will remove the extra layer of security
                from your account. Anyone with your password will be able to access your account.
              </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
              />
            </div>
            <div>
              <label className="label">MFA Code or Recovery Code</label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.toUpperCase())}
                className="input"
                placeholder="6-digit code or recovery code"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 rounded border-slate-600"
              />
              <span>I understand that disabling MFA makes my account less secure</span>
            </label>
          </div>

          {error && (
            <p className="mt-4 text-sm text-danger-400 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !confirmed || !password || !mfaCode}
              className="btn-danger flex-1 justify-center disabled:opacity-50"
            >
              {loading ? 'Disabling...' : 'Disable MFA'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  )
}

/**
 * MFAResetCard - Allows users to reset/replace MFA
 */
function MFAResetCard({ onResetComplete }) {
  const [showResetModal, setShowResetModal] = useState(false)

  return (
    <>
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
            <RefreshCw size={24} className="text-primary-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-white mb-1">
              Reset / Replace MFA
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              Use this if you got a new phone, lost your authenticator, or want to rotate your MFA secret.
              This will invalidate your current MFA and recovery codes.
            </p>
            <button
              onClick={() => setShowResetModal(true)}
              className="btn-outline"
            >
              <RefreshCw size={16} className="mr-2" />
              Reset MFA
            </button>
          </div>
        </div>
      </div>

      {showResetModal && (
        <MFAResetModal
          onClose={() => setShowResetModal(false)}
          onResetComplete={onResetComplete}
        />
      )}
    </>
  )
}

/**
 * MFAResetModal - Secure MFA reset flow
 */
function MFAResetModal({ onClose, onResetComplete }) {
  const [step, setStep] = useState('reauth') // reauth, setup, verify, success
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [qrCodeUri, setQrCodeUri] = useState('')
  const [secret, setSecret] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleStartReset = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { data } = await authAPI.startMFAReset(password, mfaCode)
      setQrCodeUri(data.qr_code_uri)
      setSecret(data.manual_entry_key)
      setStep('setup')
    } catch (err) {
      // Normalize error to prevent rendering raw objects
      setError(getPrimaryErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async (code) => {
    setError('')
    setLoading(true)

    try {
      const { data } = await authAPI.completeMFAReset(code)
      setRecoveryCodes(data.recovery_codes)
      setStep('success')
      // Don't call onResetComplete yet - wait for user to dismiss recovery codes
      toast.success('MFA reset successfully!')
    } catch (err) {
      // Normalize error to prevent rendering raw objects
      setError(getPrimaryErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDismissRecoveryCodes = () => {
    onResetComplete()
    onClose()
  }

  if (step === 'reauth') {
    return (
      <ModalPortal>
        <div className="modal-overlay">
          <div className="bg-slate-800 rounded-xl max-w-md w-full">
            <form onSubmit={handleStartReset} className="p-6">
              <h3 className="font-display font-semibold text-xl text-white mb-2">
                Reset MFA
              </h3>
              <p className="text-slate-400 text-sm mb-4">
                Enter your password and current MFA code (or a recovery code) to start the reset process.
              </p>
              <div className="space-y-4">
              <div>
                <label className="label">Current Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Enter your password"
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Current MFA Code or Recovery Code</label>
                <input
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.toUpperCase())}
                  className="input"
                  placeholder="6-digit code or recovery code"
                />
              </div>
            </div>
            {error && (
              <p className="mt-4 text-sm text-danger-400">{error}</p>
            )}
            <div className="flex gap-3 mt-6">
              <button type="button" onClick={onClose} className="btn-secondary flex-1">
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !password || !mfaCode}
                className="btn-primary flex-1 justify-center disabled:opacity-50"
              >
                {loading ? 'Starting...' : 'Continue'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
    )
  }

  if (step === 'setup') {
    return (
      <ModalPortal>
        <div className="modal-overlay">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full">
            <MFASetupStep
              qrCodeURI={qrCodeUri}
            secret={secret}
            onVerify={handleVerifyCode}
            onCancel={onClose}
            error={error}
            loading={loading}
          />
        </div>
      </div>
    </ModalPortal>
    )
  }

  if (step === 'success') {
    return (
      <ModalPortal>
        <div className="modal-overlay">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full">
            <RecoveryCodesDisplay
              codes={recoveryCodes}
              onClose={handleDismissRecoveryCodes}
            />
          </div>
        </div>
      </ModalPortal>
    )
  }

  return null
}

/**
 * RecoveryCodesCard - Shows recovery codes status
 */
function RecoveryCodesCard({ hasCodes, codesCount, mfaStatus }) {
  const [showRegenerate, setShowRegenerate] = useState(false)

  return (
    <>
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
              <Key size={24} className="text-primary-400" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-white mb-1">
                Recovery Codes
              </h3>
              <p className="text-sm text-slate-400">
                {hasCodes
                  ? `You have ${codesCount} unused recovery code${codesCount !== 1 ? 's' : ''}. `
                  : 'You don\'t have any recovery codes. '}
                Recovery codes can be used to access your account if you lose your authenticator device.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowRegenerate(true)}
            className="btn-secondary flex-shrink-0 ml-4 whitespace-nowrap"
          >
            <RefreshCw size={16} className="inline mr-2" />
            Regenerate
          </button>
        </div>
      </div>

      {showRegenerate && (
        <RecoveryCodesRegenerateModal
          onClose={() => setShowRegenerate(false)}
          onRegenerateComplete={() => {
            setShowRegenerate(false)
          }}
          mfaStatus={mfaStatus}
        />
      )}
    </>
  )
}

/**
 * MFARequiredNotice - Shows for privileged users who cannot disable MFA
 */
function MFARequiredNotice() {
  return (
    <div className="card p-6 border border-primary-900/30">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary-600/20 flex items-center justify-center flex-shrink-0">
          <Lock size={24} className="text-primary-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-display font-semibold text-white mb-1">
            MFA Required for Your Role
          </h3>
          <p className="text-sm text-slate-400 mb-4">
            As an administrator or manager, MFA is mandatory for your account.
            You cannot disable MFA, but you can reset it if needed using the option above.
          </p>
          <span className="badge badge-blue">
            <Lock size={12} className="mr-1" />
            Security Policy Enforced
          </span>
        </div>
      </div>
    </div>
  )
}

// Reuse existing MFA components
function MFASetupStep({ qrCodeURI, secret, onVerify, onCancel, error, loading }) {
  const [code, setCode] = useState('')
  const [showManualEntry, setShowManualEntry] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    await onVerify(code)
  }

  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeURI)}`

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h3 className="font-display font-semibold text-xl text-white mb-4">
        Scan QR Code
      </h3>

      <div className="bg-slate-900/50 rounded-lg p-4 mb-4">
        <img src={qrCodeImageUrl} alt="MFA QR Code" className="w-48 h-48 mx-auto rounded-lg bg-white p-2" />
      </div>

      <div className="mb-4">
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
          <p className="mt-2 text-xs text-danger-400">{error}</p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="btn-primary flex-1 justify-center disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </div>
    </form>
  )
}

function RecoveryCodesDisplay({ codes, onClose }) {
  const [acknowledged, setAcknowledged] = useState(false)

  return (
    <div className="p-6">
      <h3 className="font-display font-semibold text-xl text-white mb-2">
        Your Recovery Codes
      </h3>
      <p className="text-slate-400 text-sm mb-4">
        Store these codes in a secure location. They will NOT be shown again.
        Each code can only be used once.
      </p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {codes.map((code, idx) => (
          <div
            key={idx}
            className="bg-slate-900 px-3 py-2 rounded font-mono text-sm text-center"
          >
            {code}
          </div>
        ))}
      </div>

      <label className="flex items-start gap-2 text-sm text-slate-300 mb-4">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 rounded border-slate-600"
        />
        <span>I have saved these recovery codes in a secure location</span>
      </label>

      <button
        onClick={onClose}
        disabled={!acknowledged}
        className="btn-primary w-full justify-center disabled:opacity-50"
      >
        Done
      </button>
    </div>
  )
}

function RecoveryCodesRegenerateModal({ onClose, onRegenerateComplete, mfaStatus }) {
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [codes, setCodes] = useState(null)
  const [oldCodesInvalidated, setOldCodesInvalidated] = useState(0)

  const handleRegenerate = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const params = {
        current_password: password,
        method: 'totp',
        mfa_code: mfaCode,
      }

      const { data } = await authAPI.regenerateRecoveryCodes(params)
      setCodes(data.recovery_codes)
      setOldCodesInvalidated(data.old_codes_invalidated)
      toast.success('Recovery codes regenerated!')
    } catch (err) {
      // Normalize error to prevent rendering raw objects
      setError(getPrimaryErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDismissRegeneratedCodes = () => {
    onRegenerateComplete()
    onClose()
  }

  if (codes) {
    return (
      <ModalPortal>
        <div className="modal-overlay">
          <div className="bg-slate-800 rounded-xl max-w-lg w-full p-6">
            <div className="mb-4 p-3 bg-success-900/20 border border-success-800/50 rounded-lg">
              <p className="text-sm text-success-300">
                <strong>Success!</strong> {oldCodesInvalidated} old code{oldCodesInvalidated !== 1 ? 's' : ''} invalidated.
                Store these new codes securely.
              </p>
            </div>
            <RecoveryCodesDisplay codes={codes} onClose={handleDismissRegeneratedCodes} />
          </div>
        </div>
      </ModalPortal>
    )
  }

  return (
    <ModalPortal>
      <div className="modal-overlay">
        <div className="bg-slate-800 rounded-xl max-w-md w-full">
          <form onSubmit={handleRegenerate} className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary-600/20 flex items-center justify-center">
                <RefreshCw size={20} className="text-primary-400" />
              </div>
              <h3 className="font-display font-semibold text-lg text-white">
                Regenerate Recovery Codes
              </h3>
            </div>

            <div className="bg-slate-700/50 border border-slate-600/50 rounded-lg p-4 mb-4">
              <p className="text-sm text-slate-300">
                For security, you must verify your identity before regenerating recovery codes.
                Your old codes will be invalidated immediately.
              </p>
            </div>

            <div className="space-y-4">
            <div>
              <label className="label">Current Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                autoFocus
              />
            </div>

            <div>
              <label className="label">Authenticator Code</label>
              <input
                type="text"
                value={mfaCode}
                onChange={(e) => {
                  // Only allow digits, max 6 characters
                  const digitsOnly = e.target.value.replace(/\D/g, '')
                  setMfaCode(digitsOnly.slice(0, 6))
                }}
                className="input"
                placeholder="6-digit code"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                autoComplete="one-time-code"
              />
              <p className="mt-1 text-xs text-slate-400">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          </div>

          {error && (
            <p className="mt-4 text-sm text-danger-400 flex items-center gap-2">
              <AlertTriangle size={14} /> {error}
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password || mfaCode.length !== 6}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {loading ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </ModalPortal>
  )
}
