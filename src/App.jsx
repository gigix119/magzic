import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import { AuthProvider } from './context/AuthContext'
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

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
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
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
