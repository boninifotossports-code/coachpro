import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import logo from '../assets/logo-coachpro.png'

export default function Login() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError('E-mail ou senha inválidos.')
      return
    }
    navigate('/clube')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-pitch-950 px-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 shadow-xl">
        <img src={logo} alt="CoachPro" className="mx-auto mb-8 h-16 w-auto" />

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-chalk-600">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-chalk-200 px-3 py-2 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-chalk-600">Senha</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-chalk-200 px-3 py-2 outline-none focus:border-signal focus:ring-2 focus:ring-signal/30"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 rounded-md bg-signal py-2.5 font-display text-lg font-semibold tracking-wide text-pitch-950 transition hover:bg-signal-dark disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-chalk-400">Desenvolvido por AB Labs</p>
      </div>
    </div>
  )
}
