import { useEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from '@/store/authStore'
import { locationAudienceAPI } from '@/services/api'

import AppLayout from '@/components/layout/AppLayout'
import LoginPage from '@/pages/LoginPage'
import CompanyLoginPage from '@/pages/CompanyLoginPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import DashboardPage from '@/pages/DashboardPage'
import NewNotificationPage from '@/pages/NewNotificationPage'
import { NotificationsListPage, NotificationDetailPage, SafetyRespondPage, RespondedSuccessPage } from '@/pages/NotificationsPage'
import PeoplePage from '@/pages/PeoplePage'
import { GroupsPage, LocationsPage, TemplatesPage, IncidentsPage } from '@/pages/OtherPages'
import LocationMembersPage from '@/pages/LocationMembersPage'
import IncomingPage from '@/pages/IncomingPage'
import SettingsPage from '@/pages/SettingsPage'
import AuthCallbackPage from '@/pages/AuthCallbackPage'
import PrivacyPolicy from '@/pages/PrivacyPolicy'
import TermsAndConditions from '@/pages/TermsAndConditions'

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
  const { init, isAuthenticated, isLoading } = useAuthStore()
  const watchIdRef = useRef(null)
  const geofenceUpdateIntervalRef = useRef(null)

  useEffect(() => {
    init()
  }, [init])

  useEffect(() => {
    // Auth state change tracking removed for security
  }, [isAuthenticated, isLoading])

  // ─── GEOFENCE TRACKING ──────────────────────────────────────────────────────
  // Automatically track user location and update geofence assignments
  useEffect(() => {
    // Clear any existing watchers/intervals when auth state changes
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (geofenceUpdateIntervalRef.current) {
      clearInterval(geofenceUpdateIntervalRef.current)
      geofenceUpdateIntervalRef.current = null
    }

    // Only track location when authenticated
    if (!isAuthenticated || isLoading) {
      return
    }

    // Check if browser supports geolocation
    if (!navigator.geolocation) {
      console.debug('Geolocation not supported by this browser')
      return
    }

    // Request initial location and update geofence
    const updateGeofence = (position) => {
      const { latitude, longitude } = position.coords

      // PRIVACY: Round coordinates to 3 decimal places, which is ~111 m at
      // the equator and narrows (~cos(latitude)) at higher latitudes — for
      // reference Phoenix ~94 m, Toronto ~83 m, London ~70 m. Sufficient
      // precision for city-level geofencing; coarse enough that we are not
      // shipping individual addresses to the server.
      // TODO(F-M4): add a user-facing privacy toggle so employees can
      // opt out of geofence collection entirely, and skip this heartbeat
      // when the toggle is off.
      const roundedLat = Math.round(latitude * 1000) / 1000
      const roundedLon = Math.round(longitude * 1000) / 1000

      // Silent update - don't await, don't show errors to user
      locationAudienceAPI.updateGeofence(roundedLat, roundedLon)
        .catch(err => {
          // Silently ignore - might be rate limited or network issue
          // Don't log error details to avoid leaking info
          console.debug('Geofence update skipped')
        })
    }

    const handleError = (error) => {
      // Log but don't bother user - they might have denied permission
      // Don't log error details to avoid fingerprinting
      console.debug('Geolocation unavailable')
    }

    // Get initial location
    navigator.geolocation.getCurrentPosition(updateGeofence, handleError, {
      enableHighAccuracy: false,
      timeout: 10000,
      maximumAge: 60000 // Accept cached position up to 1 minute old
    })

    // Watch for location changes (passive, low-power mode)
    watchIdRef.current = navigator.geolocation.watchPosition(
      updateGeofence,
      handleError,
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000 // Update at most once per minute
      }
    )

    // Fallback: Periodic check every 5 minutes (in case watchPosition doesn't fire)
    geofenceUpdateIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(updateGeofence, handleError, {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000 // Accept cached position up to 5 minutes old
      })
    }, 5 * 60 * 1000) // 5 minutes

    // Cleanup on unmount or auth change
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      if (geofenceUpdateIntervalRef.current) {
        clearInterval(geofenceUpdateIntervalRef.current)
        geofenceUpdateIntervalRef.current = null
      }
    }
  }, [isAuthenticated, isLoading])
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/company-login" element={<CompanyLoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Public routes for safety response (from email/SMS links) */}
        <Route path="/notifications/:id/respond" element={<SafetyRespondPage />} />
        <Route path="/responded" element={<RespondedSuccessPage />} />
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
          <Route path="locations/:locationId/members" element={<LocationMembersPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="incoming" element={<IncomingPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsAndConditions />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
