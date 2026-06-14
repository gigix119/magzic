import { Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import ProtectedRoute from './components/ProtectedRoute'
import OwnerRoute from './components/OwnerRoute'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Towary from './pages/Towary'
import Magazyny from './pages/Magazyny'
import Kontrahenci from './pages/Kontrahenci'
import Faktury from './pages/Faktury'
import Pakiety from './pages/Pakiety'
import Alerty from './pages/Alerty'
import Zlecenia from './pages/Zlecenia'
import ZlecenieDetail from './pages/ZlecenieDetail'
import Ustawienia from './pages/Ustawienia'
import Regulamin from './pages/Regulamin'
import PolitykaPrywatnosci from './pages/PolitykaPrywatnosci'
import BusinessOnboarding from './components/BusinessOnboarding'
import BackendLayout from './pages/backend/BackendLayout'
import BackendIndex from './pages/backend/BackendIndex'
import BackendUsers from './pages/backend/BackendUsers'
import BackendUserDetail from './pages/backend/BackendUserDetail'
import BackendActivity from './pages/backend/BackendActivity'
import BackendPermissions from './pages/backend/BackendPermissions'
import BackendAudit from './pages/backend/BackendAudit'
import BackendErrors from './pages/backend/BackendErrors'
import BackendModel from './pages/backend/BackendModel'
import BackendInventoryReconciliation from './pages/backend/BackendInventoryReconciliation'

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', color: '#dc2626' }}>
          <h2>Błąd aplikacji</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{String(this.state.error)}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App() {
  return (
    <ErrorBoundary>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <BrowserRouter>
              <BusinessOnboarding />
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/regulamin" element={<Regulamin />} />
                <Route path="/polityka-prywatnosci" element={<PolitykaPrywatnosci />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/towary" element={<Towary />} />
                  <Route path="/magazyny" element={<Magazyny />} />
                  <Route path="/kontrahenci" element={<Kontrahenci />} />
                  <Route path="/faktury" element={<Faktury />} />
                  <Route path="/pakiety" element={<Pakiety />} />
                  <Route path="/alerty" element={<Alerty />} />
                  <Route path="/zlecenia" element={<Zlecenia />} />
                  <Route path="/zlecenia/:id" element={<ZlecenieDetail />} />
                  <Route path="/ustawienia" element={<Ustawienia />} />
                  {/* Backend — only for owner role */}
                  <Route path="/backend" element={<OwnerRoute><BackendLayout /></OwnerRoute>}>
                    <Route index element={<BackendIndex />} />
                    <Route path="users" element={<BackendUsers />} />
                    <Route path="users/:id" element={<BackendUserDetail />} />
                    <Route path="activity" element={<BackendActivity />} />
                    <Route path="permissions" element={<BackendPermissions />} />
                    <Route path="audit" element={<BackendAudit />} />
                    <Route path="errors" element={<BackendErrors />} />
                    <Route path="model" element={<BackendModel />} />
                    <Route path="reconciliation" element={<BackendInventoryReconciliation />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </WorkspaceProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
    </ErrorBoundary>
  )
}
