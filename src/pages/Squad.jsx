import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import AppLayout from '../components/AppLayout'

const POSITIONS = {
  futebol: ['Goleiro', 'Zagueiro', 'Defesa Lateral Direito', 'Defesa Lateral Esquerdo', 'Volante', 'Meio-campista', 'Atacante', 'Centroavante'],
  futsal: ['Goleiro', 'Fixo', 'Ala Direita', 'Ala Esquerda', 'Pivô', 'Universal'],
}

const emptyPlayer = {
  jersey_number: '',
  full_name: '',
  nickname: '',
  birth_date: '',
  nationality: 'Brasileira',
  position: '',
  other_positions: '',
  phone: '',
}

function calcAge(birthDate) {
  if (!birthDate) return '—'
  const b = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - b.getFullYear()
  const m = today.getMonth() - b.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--
  return age
}

export default function Squad() {
  const { profile } = useAuth()
  const isEditor = profile?.role === 'admin' || profile?.role === 'coach'

  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState(null)
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyPlayer)

  const currentTeam = teams.find((t) => t.id === teamId)
  const positionOptions = POSITIONS[currentTeam?.modality] || POSITIONS.futebol

  async function loadTeams() {
    const { data } = await supabase.from('teams').select('*').order('season', { ascending: false })
    setTeams(data || [])
    if (data && data.length && !teamId) setTeamId(data[0].id)
  }

  async function loadPlayers(id) {
    setLoading(true)
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', id)
      .order('jersey_number', { ascending: true, nullsFirst: false })
    setPlayers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (teamId) loadPlayers(teamId)
  }, [teamId])

  function startEdit(p) {
    setEditingId(p.id)
    setForm({
      jersey_number: p.jersey_number ?? '',
      full_name: p.full_name,
      nickname: p.nickname ?? '',
      birth_date: p.birth_date ?? '',
      nationality: p.nationality ?? 'Brasileira',
      position: p.position ?? '',
      other_positions: p.other_positions ?? '',
      phone: p.phone ?? '',
    })
    setShowForm(true)
  }

  function startNew() {
    setEditingId(null)
    setForm(emptyPlayer)
    setShowForm(true)
  }

  async function savePlayer(e) {
    e.preventDefault()
    const payload = {
      ...form,
      jersey_number: form.jersey_number ? Number(form.jersey_number) : null,
      team_id: teamId,
    }

    if (editingId) {
      await supabase.from('players').update(payload).eq('id', editingId)
    } else {
      await supabase.from('players').insert(payload)
    }

    setShowForm(false)
    setEditingId(null)
    setForm(emptyPlayer)
    loadPlayers(teamId)
  }

  async function removePlayer(id) {
    if (!confirm('Remover este atleta do elenco?')) return
    await supabase.from('players').delete().eq('id', id)
    loadPlayers(teamId)
  }

  return (
    <AppLayout
      title="Elenco"
      actions={
        isEditor &&
        teamId && (
          <button
            onClick={startNew}
            className="rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold tracking-wide text-pitch-950 hover:bg-signal-dark"
          >
            + Atleta
          </button>
        )
      }
    >
      {teams.length > 0 && (
        <select
          value={teamId || ''}
          onChange={(e) => setTeamId(e.target.value)}
          className="mb-6 rounded-md border border-chalk-200 bg-white px-3 py-2 font-display text-base"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.category} · {t.modality === 'futebol' ? 'Futebol' : 'Futsal'} · {t.season}
            </option>
          ))}
        </select>
      )}

      {showForm && (
        <PlayerForm
          form={form}
          setForm={setForm}
          positionOptions={positionOptions}
          onSubmit={savePlayer}
          onCancel={() => setShowForm(false)}
          editing={!!editingId}
        />
      )}

      <div className="overflow-x-auto rounded-lg border border-chalk-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-chalk-100 text-chalk-600">
            <tr>
              <th className="px-4 py-3">Nº</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Apelido</th>
              <th className="px-4 py-3">Nascimento</th>
              <th className="px-4 py-3">Idade</th>
              <th className="px-4 py-3">Posição</th>
              <th className="px-4 py-3">Outras posições</th>
              <th className="px-4 py-3">Celular</th>
              {isEditor && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-chalk-400">
                  Carregando…
                </td>
              </tr>
            ) : players.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-chalk-400">
                  Nenhum atleta cadastrado neste quadro.
                </td>
              </tr>
            ) : (
              players.map((p) => (
                <tr key={p.id} className="border-t border-chalk-100 hover:bg-chalk-50">
                  <td className="px-4 py-2.5 font-medium">{p.jersey_number ?? '—'}</td>
                  <td className="px-4 py-2.5">{p.full_name}</td>
                  <td className="px-4 py-2.5">{p.nickname}</td>
                  <td className="px-4 py-2.5">{p.birth_date ? new Date(p.birth_date).toLocaleDateString('pt-BR') : '—'}</td>
                  <td className="px-4 py-2.5">{calcAge(p.birth_date)}</td>
                  <td className="px-4 py-2.5">{p.position}</td>
                  <td className="px-4 py-2.5 text-chalk-600">{p.other_positions}</td>
                  <td className="px-4 py-2.5 text-chalk-600">{p.phone}</td>
                  {isEditor && (
                    <td className="px-4 py-2.5 text-right">
                      <button onClick={() => startEdit(p)} className="mr-3 text-xs text-signal-dark hover:underline">
                        editar
                      </button>
                      <button onClick={() => removePlayer(p.id)} className="text-xs text-red-500 hover:underline">
                        remover
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  )
}

function PlayerForm({ form, setForm, positionOptions, onSubmit, onCancel, editing }) {
  return (
    <form onSubmit={onSubmit} className="mb-6 grid gap-3 rounded-lg border border-chalk-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
      <input
        type="number"
        placeholder="Nº"
        value={form.jersey_number}
        onChange={(e) => setForm((f) => ({ ...f, jersey_number: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <input
        required
        placeholder="Nome completo"
        value={form.full_name}
        onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm lg:col-span-2"
      />
      <input
        placeholder="Apelido"
        value={form.nickname}
        onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <input
        type="date"
        value={form.birth_date}
        onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <input
        placeholder="Nacionalidade"
        value={form.nationality}
        onChange={(e) => setForm((f) => ({ ...f, nationality: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <select
        value={form.position}
        onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      >
        <option value="">Posição…</option>
        {positionOptions.map((pos) => (
          <option key={pos} value={pos}>
            {pos}
          </option>
        ))}
      </select>
      <input
        placeholder="Outras posições"
        value={form.other_positions}
        onChange={(e) => setForm((f) => ({ ...f, other_positions: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <input
        placeholder="Celular"
        value={form.phone}
        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <div className="flex gap-2 lg:col-span-4">
        <button className="rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold text-pitch-950">
          {editing ? 'Salvar alterações' : 'Adicionar atleta'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-chalk-200 px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}
