import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import useAuthStore from '@/store/authStore'
import toast from 'react-hot-toast'
import LDAPLoginForm from '@/components/auth/LDAPLoginForm'

// Shared background styles (same as LoginPage)
const PAGE_BACKGROUND = {
  backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(30,64,175,0.15) 0%, transparent 70%)'
}

const GRID_OVERLAY = {
  backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
  opacity: 0.03,
  pointerEvents: 'none'
}

const LOGO_SECTION = (
  <div className="flex items-center gap-3 justify-center mb-6 sm:mb-8">
    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-danger-600 flex items-center justify-center shadow-glow-red">
      <Zap size={18} className="text-white" fill="white" />
    </div>
    <div>
      <div className="font-display font-bold text-xl sm:text-2xl text-white tracking-tight">TM Alert</div>
      <div className="text-[10px] sm:text-xs text-slate-500 tracking-widest uppercase">Emergency Notification System</div>
    </div>
  </div>
)

const FOOTER_TEXT = (
  <p className="text-center text-xs text-slate-600 mt-6">
    Powered by HeartCentrix • Emergency Notification Platform
  </p>
)

export default function CompanyLoginPage() {
  const { ldapLogin } = useAuthStore()
  const navigate = useNavigate()
  const [ldapUsername, setLdapUsername] = useState('')
  const [ldapPassword, setLdapPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleLDAPSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await ldapLogin(ldapUsername, ldapPassword)
      toast.success('Welcome back')
      navigate('/dashboard')
    } catch (err) {
      const detail = err.response?.data?.detail || err.message || 'Invalid credentials'
      let message = detail

      if (typeof detail === 'object' && detail.message) {
        message = detail.message
      }

      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center p-4 sm:p-6" style={PAGE_BACKGROUND}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={GRID_OVERLAY} />
      <div className="w-full max-w-md animate-fade-in">
        {LOGO_SECTION}
        <div className="card p-6 sm:p-8">
          <h1 className="font-display font-semibold text-xl text-white mb-1">Company Login</h1>
          <p className="text-slate-500 text-sm mb-6">Sign in with your company credentials</p>
          <LDAPLoginForm
            username={ldapUsername}
            setUsername={setLdapUsername}
            password={ldapPassword}
            setPassword={setLdapPassword}
            onSubmit={handleLDAPSubmit}
            loading={loading}
            showPassword={showPassword}
            setShowPassword={setShowPassword}
          />
          <div className="mt-6">
            <Link to="/login" className="text-sm text-primary-400 hover:text-primary-300 transition-colors block text-center">
              ← Back to login options
            </Link>
          </div>
        </div>
        {FOOTER_TEXT}
      </div>
    </div>
  )
}
