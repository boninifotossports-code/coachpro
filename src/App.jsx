import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ClubInfo from './pages/ClubInfo'
import Squad from './pages/Squad'
import AdminUsers from './pages/AdminUsers'
import Exercises from './pages/Exercises'
import WeeklySchedule from './pages/WeeklySchedule'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/clube"
        element={
          <ProtectedRoute>
            <ClubInfo />
          </ProtectedRoute>
        }
      />

      <Route
        path="/elenco"
        element={
          <ProtectedRoute>
            <Squad />
          </ProtectedRoute>
        }
      />

      <Route
        path="/treinos"
        element={
          <ProtectedRoute>
            <WeeklySchedule />
          </ProtectedRoute>
        }
      />

      <Route
        path="/exercicios"
        element={
          <ProtectedRoute>
            <Exercises />
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute adminOnly>
            <AdminUsers />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<Navigate to="/clube" replace />} />
      <Route path="*" element={<Navigate to="/clube" replace />} />
    </Routes>
  )
}
