import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import AppLayout from '../components/AppLayout'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'coach', label: 'Treinador' },
  { value: 'assistant', label: 'Assistente' },
  { value: 'staff', label: 'Equipe' },
]

function accessBadge(profile) {
  if (profile.role === 'admin') {
    return { text: 'Administrador · sem expiração', className: 'bg-signal/15 text-signal-dark' }
  }
  if (!profile.access_expires_at) {
    return { text: 'Sem data de expiração', className: 'bg-chalk-100 text-chalk-600' }
  }
  const expires = new Date(profile.access_expires_at)
  const daysLeft = Math.ceil((expires - new Date()) / (1000 * 60 * 60 * 24))
  if (daysLeft < 0) {
    return { text: `Expirado em ${expires.toLocaleDateString('pt-BR')}`, className: 'bg-red-100 text-red-700' }
  }
  if (daysLeft <= 30) {
    return {
      text: `Expira em ${daysLeft} dia(s) · ${expires.toLocaleDateString('pt-BR')}`,
      className: 'bg-amber-100 text-amber-700',
    }
  }
  return {
    text: `Válido até ${expires.toLocaleDateString('pt-BR')}`,
    className: 'bg-chalk-100 text-chalk-600',
  }
}

export default function AdminUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name')
    if (!error) setUsers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [])

  async function renewAccess(userId) {
    setSavingId(userId)
    const nextExpiry = new Date()
    nextExpiry.setFullYear(nextExpiry.getFullYear() + 1)
    const { error } = await supabase
      .from('profiles')
      .update({ access_expires_at: nextExpiry.toISOString() })
      .eq('id', userId)
    if (!error) await loadUsers()
    setSavingId(null)
  }

  async function changeRole(userId, role) {
    setSavingId(userId)
    const payload = { role }
    // Admin não tem data de expiração; ao rebaixar de admin, define 1 ano a partir de agora.
    if (role === 'admin') {
      payload.access_expires_at = null
    } else {
      const nextExpiry = new Date()
      nextExpiry.setFullYear(nextExpiry.getFullYear() + 1)
      payload.access_expires_at = nextExpiry.toISOString()
    }
    const { error } = await supabase.from('profiles').update(payload).eq('id', userId)
    if (!error) await loadUsers()
    setSavingId(null)
  }

  return (
    <AppLayout title="Usuários">
      <div className="mb-6 rounded-lg border border-chalk-200 bg-white p-4 text-sm text-chalk-600">
        Novos usuários são criados no painel do Supabase (Authentication → Invite user) e recebem
        acesso automático por <strong>1 ano</strong>. Somente um administrador pode renovar esse
        prazo ou alterar o papel de alguém aqui.
      </div>

      <div className="overflow-x-auto rounded-lg border border-chalk-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-chalk-50 text-chalk-600">
            <tr>
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Papel</th>
              <th className="px-4 py-3 font-medium">Acesso</th>
              <th className="px-4 py-3 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="px-4 py-6 text-chalk-400" colSpan={4}>
                  Carregando…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-chalk-400" colSpan={4}>
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
            {users.map((u) => {
              const badge = accessBadge(u)
              return (
                <tr key={u.id} className="border-t border-chalk-100">
                  <td className="px-4 py-3 font-medium text-pitch-950">{u.full_name}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      disabled={savingId === u.id}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="rounded-md border border-chalk-200 px-2 py-1"
                    >
                      {ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                      {badge.text}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => renewAccess(u.id)}
                        disabled={savingId === u.id}
                        className="rounded-md bg-signal px-3 py-1.5 text-xs font-semibold text-pitch-950 hover:bg-signal-dark disabled:opacity-60"
                      >
                        {savingId === u.id ? 'Renovando…' : 'Renovar por 1 ano'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}
