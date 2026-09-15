import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import AppLayout from '../components/AppLayout'

const emptyTeamForm = {
  category: '',
  modality: 'futebol',
  season: new Date().getFullYear(),
  match_duration: '',
  player_count_format: '',
}

export default function ClubInfo() {
  const { profile } = useAuth()
  const isEditor = profile?.role === 'admin' || profile?.role === 'coach'

  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState(null)
  const [competitions, setCompetitions] = useState([])
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)

  const [showTeamForm, setShowTeamForm] = useState(false)
  const [teamForm, setTeamForm] = useState(emptyTeamForm)

  const [newCompetition, setNewCompetition] = useState({ competition_name: '', objective: '' })
  const [newStaff, setNewStaff] = useState({ role_title: '', full_name: '', phone: '', email: '' })

  async function loadTeams() {
    const { data } = await supabase
      .from('teams')
      .select('*')
      .order('season', { ascending: false })
    setTeams(data || [])
    if (data && data.length && !teamId) setTeamId(data[0].id)
    setLoading(false)
  }

  async function loadTeamDetails(id) {
    const [{ data: comps }, { data: st }] = await Promise.all([
      supabase.from('team_competitions').select('*').eq('team_id', id).order('sort_order'),
      supabase.from('club_staff').select('*').eq('team_id', id).order('sort_order'),
    ])
    setCompetitions(comps || [])
    setStaff(st || [])
  }

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (teamId) loadTeamDetails(teamId)
  }, [teamId])

  const currentTeam = teams.find((t) => t.id === teamId)

  async function createTeam(e) {
    e.preventDefault()
    const { data: profileData } = await supabase
      .from('profiles')
      .select('club_id')
      .eq('id', profile.id)
      .single()

    const { data, error } = await supabase
      .from('teams')
      .insert({ ...teamForm, club_id: profileData.club_id })
      .select()
      .single()

    if (!error) {
      setShowTeamForm(false)
      setTeamForm(emptyTeamForm)
      await loadTeams()
      setTeamId(data.id)
    }
  }

  async function addCompetition(e) {
    e.preventDefault()
    if (!newCompetition.competition_name) return
    await supabase.from('team_competitions').insert({ ...newCompetition, team_id: teamId })
    setNewCompetition({ competition_name: '', objective: '' })
    loadTeamDetails(teamId)
  }

  async function removeCompetition(id) {
    await supabase.from('team_competitions').delete().eq('id', id)
    loadTeamDetails(teamId)
  }

  async function addStaff(e) {
    e.preventDefault()
    if (!newStaff.full_name || !newStaff.role_title) return
    await supabase.from('club_staff').insert({ ...newStaff, team_id: teamId })
    setNewStaff({ role_title: '', full_name: '', phone: '', email: '' })
    loadTeamDetails(teamId)
  }

  async function removeStaff(id) {
    await supabase.from('club_staff').delete().eq('id', id)
    loadTeamDetails(teamId)
  }

  return (
    <AppLayout
      title="Clube"
      actions={
        isEditor && (
          <button
            onClick={() => setShowTeamForm((s) => !s)}
            className="rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold tracking-wide text-pitch-950 hover:bg-signal-dark"
          >
            + Novo quadro
          </button>
        )
      }
    >
      {loading ? (
        <p className="text-chalk-400">Carregando…</p>
      ) : teams.length === 0 ? (
        <EmptyState onCreate={() => setShowTeamForm(true)} isEditor={isEditor} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <select
              value={teamId || ''}
              onChange={(e) => setTeamId(e.target.value)}
              className="rounded-md border border-chalk-200 bg-white px-3 py-2 font-display text-base"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.category} · {t.modality === 'futebol' ? 'Futebol' : 'Futsal'} · {t.season}
                </option>
              ))}
            </select>
          </div>

          {showTeamForm && (
            <TeamForm form={teamForm} setForm={setTeamForm} onSubmit={createTeam} onCancel={() => setShowTeamForm(false)} />
          )}

          {currentTeam && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card title="Quadro do Clube">
                <InfoRow label="Escalão" value={currentTeam.category} />
                <InfoRow label="Modalidade" value={currentTeam.modality === 'futebol' ? 'Futebol' : 'Futsal'} />
                <InfoRow label="Temporada" value={currentTeam.season} />
                <InfoRow label="Duração do jogo" value={currentTeam.match_duration || '—'} />
                <InfoRow label="Formato" value={currentTeam.player_count_format || '—'} />
              </Card>

              <Card title="Competições a disputar">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {competitions.map((c) => (
                      <tr key={c.id} className="border-b border-chalk-100 last:border-0">
                        <td className="py-2">{c.competition_name}</td>
                        <td className="py-2 text-chalk-600">{c.objective}</td>
                        {isEditor && (
                          <td className="py-2 text-right">
                            <button onClick={() => removeCompetition(c.id)} className="text-xs text-red-500 hover:underline">
                              remover
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {competitions.length === 0 && (
                      <tr>
                        <td className="py-2 text-chalk-400" colSpan={3}>
                          Nenhuma competição cadastrada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {isEditor && (
                  <form onSubmit={addCompetition} className="mt-3 flex gap-2">
                    <input
                      placeholder="Competição"
                      value={newCompetition.competition_name}
                      onChange={(e) => setNewCompetition((f) => ({ ...f, competition_name: e.target.value }))}
                      className="flex-1 rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Objetivo"
                      value={newCompetition.objective}
                      onChange={(e) => setNewCompetition((f) => ({ ...f, objective: e.target.value }))}
                      className="w-32 rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
                    />
                    <button className="rounded-md bg-pitch-950 px-3 text-sm text-white">+</button>
                  </form>
                )}
              </Card>

              <Card title="Responsáveis do Clube" className="lg:col-span-2">
                <table className="w-full text-left text-sm">
                  <tbody>
                    {staff.map((s) => (
                      <tr key={s.id} className="border-b border-chalk-100 last:border-0">
                        <td className="py-2 font-medium text-chalk-600">{s.role_title}</td>
                        <td className="py-2">{s.full_name}</td>
                        <td className="py-2 text-chalk-600">{s.phone}</td>
                        <td className="py-2 text-chalk-600">{s.email}</td>
                        {isEditor && (
                          <td className="py-2 text-right">
                            <button onClick={() => removeStaff(s.id)} className="text-xs text-red-500 hover:underline">
                              remover
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {staff.length === 0 && (
                      <tr>
                        <td className="py-2 text-chalk-400" colSpan={5}>
                          Nenhum responsável cadastrado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {isEditor && (
                  <form onSubmit={addStaff} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <input
                      placeholder="Cargo (ex: Presidente)"
                      value={newStaff.role_title}
                      onChange={(e) => setNewStaff((f) => ({ ...f, role_title: e.target.value }))}
                      className="rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Nome"
                      value={newStaff.full_name}
                      onChange={(e) => setNewStaff((f) => ({ ...f, full_name: e.target.value }))}
                      className="rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
                    />
                    <input
                      placeholder="Telefone"
                      value={newStaff.phone}
                      onChange={(e) => setNewStaff((f) => ({ ...f, phone: e.target.value }))}
                      className="rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        placeholder="E-mail"
                        value={newStaff.email}
                        onChange={(e) => setNewStaff((f) => ({ ...f, email: e.target.value }))}
                        className="flex-1 rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
                      />
                      <button className="rounded-md bg-pitch-950 px-3 text-sm text-white">+</button>
                    </div>
                  </form>
                )}
              </Card>
            </div>
          )}
        </>
      )}
    </AppLayout>
  )
}

function Card({ title, children, className = '' }) {
  return (
    <div className={`rounded-lg border border-chalk-200 bg-white p-5 ${className}`}>
      <h2 className="mb-3 font-display text-lg font-semibold text-pitch-950">{title}</h2>
      {children}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between border-b border-chalk-100 py-2 text-sm last:border-0">
      <span className="text-chalk-600">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function TeamForm({ form, setForm, onSubmit, onCancel }) {
  return (
    <form onSubmit={onSubmit} className="mb-6 grid gap-3 rounded-lg border border-chalk-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3">
      <input
        required
        placeholder="Escalão (ex: Sub 10)"
        value={form.category}
        onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <select
        value={form.modality}
        onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      >
        <option value="futebol">Futebol</option>
        <option value="futsal">Futsal</option>
      </select>
      <input
        required
        type="number"
        placeholder="Temporada"
        value={form.season}
        onChange={(e) => setForm((f) => ({ ...f, season: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <input
        placeholder="Duração do jogo (ex: 30'+30')"
        value={form.match_duration}
        onChange={(e) => setForm((f) => ({ ...f, match_duration: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <input
        placeholder="Formato (ex: Futebol 9)"
        value={form.player_count_format}
        onChange={(e) => setForm((f) => ({ ...f, player_count_format: e.target.value }))}
        className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
      />
      <div className="flex gap-2">
        <button className="rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold text-pitch-950">
          Salvar
        </button>
        <button type="button" onClick={onCancel} className="rounded-md border border-chalk-200 px-4 py-2 text-sm">
          Cancelar
        </button>
      </div>
    </form>
  )
}

function EmptyState({ onCreate, isEditor }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-chalk-200 bg-white py-16 text-center">
      <p className="font-display text-xl text-pitch-950">Nenhum quadro cadastrado ainda</p>
      <p className="max-w-sm text-sm text-chalk-600">
        Cadastre o primeiro escalão do clube (categoria, modalidade e temporada) para começar.
      </p>
      {isEditor && (
        <button onClick={onCreate} className="mt-2 rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold text-pitch-950">
          Criar primeiro quadro
        </button>
      )}
    </div>
  )
}
