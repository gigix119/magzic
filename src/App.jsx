import { Component } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
import { WorkspaceProvider } from './context/WorkspaceContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Towary from './pages/Towary'
import Magazyny from './pages/Magazyny'
import Kontrahenci from './pages/Kontrahenci'
import Faktury from './pages/Faktury'
import Pakiety from './pages/Pakiety'
import Alerty from './pages/Alerty'

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
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/towary" element={<Towary />} />
                  <Route path="/magazyny" element={<Magazyny />} />
                  <Route path="/kontrahenci" element={<Kontrahenci />} />
                  <Route path="/faktury" element={<Faktury />} />
                  <Route path="/pakiety" element={<Pakiety />} />
                  <Route path="/alerty" element={<Alerty />} />
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
