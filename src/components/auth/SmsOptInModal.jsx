import { useState } from 'react'
import { Check } from 'lucide-react'
import ModalPortal from '@/components/ui/ModalPortal'
import { authAPI } from '@/services/api'

// Mirrors the backend's normalize_mobile_to_e164 (app/schemas.py): Twilio
// needs E.164, so a number is valid when it's 10 digits (assumed US, +1
// added server-side), 11 digits starting with 1, or starts with an explicit
// +country code (8-15 digits).
export function isValidMobileNumber(raw) {
  const stripped = (raw || '').trim()
  const digits = (stripped.match(/\d/g) || []).join('')
  if (/[^\d\s()+\-]/.test(stripped)) return false
  if (stripped.startsWith('+')) return digits.length >= 8 && digits.length <= 15
  if (digits.length === 10) return true
  return digits.length === 11 && digits.startsWith('1')
}

// SMS text-alert opt-in popup. Opens when the user enables the SMS channel
// in Settings → Preferences. Accepting stores consent + phone on the user
// (sms_opt_in / sms_opt_in_at) and enables the SMS channel; Cancel just
// closes without recording anything.
export default function SmsOptInModal({ user, onComplete, onCancel }) {
  const [phone, setPhone] = useState(user?.phone || '')
  const [consent, setConsent] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const [consentError, setConsentError] = useState('')
  const [apiError, setApiError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSignUp = async () => {
    let ok = true
    if (!isValidMobileNumber(phone)) {
      setPhoneError('Enter a valid mobile number. Include the country code (e.g. +1 555 123 4567) for non-US numbers.')
      ok = false
    } else {
      setPhoneError('')
    }
    if (!consent) {
      setConsentError('Please check the box to give consent.')
      ok = false
    } else {
      setConsentError('')
    }
    if (!ok) return

    setSubmitting(true)
    setApiError('')
    try {
      const { data: updatedUser } = await authAPI.smsOptIn({ accepted: true, phone, consent: true })
      setSuccess(true)
      setTimeout(() => onComplete(updatedUser), 2500)
    } catch (err) {
      setApiError(err.response?.data?.detail || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <ModalPortal>
      <div className="modal-overlay">
        <div className="w-full max-w-lg mx-4">
          {/* Brand */}
          <div className="text-center mb-5">
            <div className="text-xs font-bold uppercase tracking-[0.32em] text-slate-200">
              Taylor&nbsp;Morrison
            </div>
            <div className="w-12 h-0.5 bg-primary-500 mx-auto mt-2.5" />
          </div>

          <div className="bg-slate-800 rounded-xl max-h-[85vh] overflow-y-auto p-6 sm:p-7">
            {!success ? (
              <div>
                <h1 className="font-display font-semibold text-xl text-white mb-1.5">
                  Sign up for text alerts
                </h1>
                <p className="text-slate-400 text-sm mb-5">
                  Receive system alerts and important company notifications by text message.
                </p>

                <label className="label" htmlFor="sms-opt-in-phone">
                  Mobile Phone Number <span className="text-primary-400">*</span>
                </label>
                <input
                  type="tel"
                  id="sms-opt-in-phone"
                  name="phone"
                  className="input"
                  placeholder="+1 (555) 123-4567"
                  autoComplete="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(e.target.value)
                    if (isValidMobileNumber(e.target.value)) setPhoneError('')
                  }}
                  aria-describedby="sms-opt-in-phone-err"
                  autoFocus
                />
                {phoneError && (
                  <p id="sms-opt-in-phone-err" className="mt-1.5 text-xs text-danger-400">{phoneError}</p>
                )}

                <div className="flex items-start gap-3 mt-4 p-3.5 bg-surface-900/60 border border-surface-700/60 rounded-lg">
                  <input
                    type="checkbox"
                    id="sms-opt-in-consent"
                    checked={consent}
                    onChange={(e) => {
                      setConsent(e.target.checked)
                      if (e.target.checked) setConsentError('')
                    }}
                    className="w-[18px] h-[18px] mt-0.5 shrink-0 accent-primary-600 cursor-pointer"
                  />
                  <label htmlFor="sms-opt-in-consent" className="text-[13px] text-slate-300 cursor-pointer">
                    Yes, I would like to receive automated text messages from Taylor Morrison, including
                    system alerts, service notifications, and important company updates at the mobile number
                    provided. I understand consent is not a condition of any service.
                  </label>
                </div>
                {consentError && (
                  <p className="mt-1.5 text-xs text-danger-400">{consentError}</p>
                )}

                <div className="mt-4 mb-5 text-xs text-slate-400 leading-relaxed space-y-2">
                  <p>
                    <strong className="text-slate-200">Message Frequency:</strong> Message frequency varies.
                    You may receive up to 10 messages per month.
                  </p>
                  <p>
                    <strong className="text-slate-200">Standard Rates:</strong> Message and data rates may
                    apply depending on your mobile phone service plan.
                  </p>
                  <p>
                    <strong className="text-slate-200">Help &amp; Stop:</strong> Reply HELP for help or STOP
                    to cancel at any time. By providing your phone number and checking the box above, you
                    agree to receive text messages from Taylor Morrison. Consent is not required as a
                    condition of any purchase or service.
                  </p>
                  <p>
                    <a
                      href="https://www.taylormorrison.com/terms"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 underline hover:text-primary-300"
                    >
                      Terms of Service
                    </a>
                    {' '}&nbsp;|&nbsp;{' '}
                    <a
                      href="https://www.taylormorrison.com/privacy"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-400 underline hover:text-primary-300"
                    >
                      Privacy Policy
                    </a>
                  </p>
                </div>

                {apiError && (
                  <p className="mb-3 text-xs text-danger-400">{apiError}</p>
                )}

                <button
                  type="button"
                  onClick={handleSignUp}
                  disabled={submitting}
                  className="btn-primary w-full justify-center py-3 text-[15px] font-bold"
                >
                  {submitting ? 'Signing you up...' : 'Yes, sign me up!'}
                </button>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={submitting}
                  className="btn-ghost w-full justify-center mt-2 text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="text-center py-2" role="status" aria-live="polite">
                <div className="w-11 h-11 rounded-full bg-primary-600 text-white flex items-center justify-center mx-auto mb-3">
                  <Check size={22} />
                </div>
                <h2 className="font-display font-semibold text-lg text-white mb-1.5">
                  You&apos;re signed up
                </h2>
                <p className="text-sm text-slate-400">
                  We&apos;ll text a confirmation to your number shortly. Reply STOP anytime to opt out.
                </p>
              </div>
            )}
          </div>

          <div className="text-center text-[11px] text-slate-500 mt-4">
            © 2026 Taylor Morrison, Inc. All rights reserved.
          </div>
        </div>
      </div>
    </ModalPortal>
  )
}
