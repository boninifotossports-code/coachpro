import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, accessStatus, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-chalk-50">
        <p className="font-display text-lg text-chalk-600">Carregando CoachPro…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (accessStatus === 'expired') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-chalk-50 px-6 text-center">
        <h1 className="font-display text-2xl font-semibold">Acesso expirado</h1>
        <p className="max-w-sm text-chalk-600">
          Seu acesso ao CoachPro venceu. Fale com o administrador do clube para renovar por mais
          um ano.
        </p>
      </div>
    )
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/clube" replace />
  }

  return children
}
