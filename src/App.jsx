import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'

import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import NewNotificationPage from '@/pages/NewNotificationPage'
import { NotificationsListPage, NotificationDetailPage } from '@/pages/NotificationsPage'
import PeoplePage from '@/pages/PeoplePage'
import { GroupsPage, LocationsPage, TemplatesPage, IncidentsPage } from '@/pages/OtherPages'
import IncomingPage from '@/pages/IncomingPage'
import SettingsPage from '@/pages/SettingsPage'

function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return (
    <div className="min-h-screen bg-surface-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    </div>
  )
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  const { init } = useAuthStore()

  useEffect(() => {
    init()
  }, [])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="notifications" element={<NotificationsListPage />} />
          <Route path="notifications/new" element={<NewNotificationPage />} />
          <Route path="notifications/:id" element={<NotificationDetailPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="people" element={<PeoplePage />} />
          <Route path="groups" element={<GroupsPage />} />
          <Route path="locations" element={<LocationsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="incoming" element={<IncomingPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
