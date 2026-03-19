import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowLeft } from 'lucide-react'

export default function RespondedSuccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const notificationTitle = location.state?.notificationTitle || 'the notification'

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <CheckCircle className="w-20 h-20 text-green-600 mx-auto mb-6" />
        
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Response Recorded
        </h1>
        
        <p className="text-gray-600 mb-8">
          Your safety check-in for <strong>"{notificationTitle}"</strong> has been submitted successfully.
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8">
          <p className="text-green-800 text-sm">
            ✅ Your response has been saved and the emergency team has been notified.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center gap-2 mx-auto"
        >
          <ArrowLeft className="w-5 h-5" />
          Back to Dashboard
        </button>

        <p className="text-gray-500 text-sm mt-6">
          Thank you for responding promptly to the safety notification.
        </p>
      </div>
    </div>
  )
}
