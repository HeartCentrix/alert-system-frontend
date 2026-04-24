import { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { api } from '@/services/api'

export default function SafetyRespondPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const token = searchParams.get('token')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [notification, setNotification] = useState(null)

  useEffect(() => {
    // Verify token and fetch notification details
    const verifyToken = async () => {
      try {
        const response = await api.get(`/notifications/${id}`)
        setNotification(response.data)
        setLoading(false)
      } catch (err) {
        setError('Invalid or expired link')
        setLoading(false)
      }
    }

    if (token) {
      verifyToken()
    } else {
      setError('Missing response token')
      setLoading(false)
    }
  }, [id, token])

  const handleResponse = async (responseType) => {
    setSubmitting(true)
    setError(null)

    try {
      // Detect channel from URL or default to email
      // Email links: /notifications/:id/respond?token=xxx&channel=email
      // SMS links: /notifications/:id/respond?token=xxx&channel=sms
      const urlChannel = searchParams.get('channel') || 'email'

      // Call backend notifications respond endpoint with token.
      // The check-in token is sent in a header (not query param) so it
      // doesn't land in access logs / Referer (security review F-H3).
      await api.post(`/notifications/${id}/respond`, {
        response_type: responseType,
        message: ''
      }, {
        headers: token ? { 'X-Checkin-Token': token } : undefined,
        params: { channel: urlChannel },
      })

      // Success - redirect to success page
      window.location.href = '/responded'
    } catch (err) {
      setError('Failed to record response. Please try again.')
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Loading...</h2>
          <p className="text-gray-600">Verifying your response link</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Link Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login')}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Safety Check-In</h1>
          <p className="text-gray-600">
            {notification?.title || 'Emergency Notification'}
          </p>
        </div>

        {submitting ? (
          <div className="text-center py-8">
            <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Recording your response...</p>
          </div>
        ) : (
          <div className="space-y-4">
            <button
              onClick={() => handleResponse('safe')}
              disabled={submitting}
              className="w-full bg-green-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-6 h-6" />
              I'm Safe
            </button>

            <button
              onClick={() => handleResponse('need_help')}
              disabled={submitting}
              className="w-full bg-red-600 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <AlertCircle className="w-6 h-6" />
              I Need Help
            </button>

            <p className="text-center text-sm text-gray-500 mt-6">
              Your response will be recorded immediately
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
