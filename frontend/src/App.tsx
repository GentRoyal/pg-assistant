import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './context/AuthContext'
import { homePathForRole } from './lib/auth'
import { AdminLayout } from './components/admin/AdminLayout'
import { ChatPage } from './pages/ChatPage'
import { LoginPage } from './pages/LoginPage'
import { SignUpPage } from './pages/SignUpPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminDocumentsPage } from './pages/admin/AdminDocumentsPage'
import { AdminReportsPage } from './pages/admin/AdminReportsPage'

function Protected({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAuth()
  if (!isAuthenticated || !role) return <Navigate to="/login" replace />
  return children
}

function StudentOnly({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  if (role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function AdminOnly({ children }: { children: ReactNode }) {
  const { role } = useAuth()
  if (role !== 'admin') return <Navigate to="/" replace />
  return children
}

function RoleHome() {
  const { role } = useAuth()
  if (!role) return <Navigate to="/login" replace />
  return <Navigate to={homePathForRole(role)} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      <Route
        path="/"
        element={
          <Protected>
            <StudentOnly>
              <ChatPage />
            </StudentOnly>
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <StudentOnly>
              <SettingsPage />
            </StudentOnly>
          </Protected>
        }
      />

      <Route
        path="/admin"
        element={
          <Protected>
            <AdminOnly>
              <AdminLayout />
            </AdminOnly>
          </Protected>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="documents" element={<AdminDocumentsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
      </Route>

      <Route path="/home" element={<RoleHome />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
