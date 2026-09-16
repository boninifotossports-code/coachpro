import { useEffect, useMemo, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import AppLayout from '../components/AppLayout'

const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

const emptySlotForm = { day_of_week: 1, start_time: '16:00', end_time: '18:00', location: '' }
const emptySessionForm = { title: '', objective: '' }

export default function WeeklySchedule() {
  const { profile } = useAuth()
  const isEditor = profile?.role === 'admin' || profile?.role === 'coach'

  const [teams, setTeams] = useState([])
  const [teamId, setTeamId] = useState(null)
  const [club, setClub] = useState(null)

  const [slots, setSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showSlotForm, setShowSlotForm] = useState(false)
  const [slotForm, setSlotForm] = useState(emptySlotForm)

  const [builderSlot, setBuilderSlot] = useState(null) // slot sendo montado
  const [sessionForm, setSessionForm] = useState(emptySessionForm)
  const [sessionExercises, setSessionExercises] = useState([]) // [{id, exercise_id, name, duration_minutes, notes}]
  const [exerciseOptions, setExerciseOptions] = useState([])
  const [pickExerciseId, setPickExerciseId] = useState('')
  const [savingSession, setSavingSession] = useState(false)

  const currentTeam = teams.find((t) => t.id === teamId)

  async function loadTeams() {
    const { data } = await supabase.from('teams').select('*').order('season', { ascending: false })
    setTeams(data || [])
    if (data && data.length && !teamId) setTeamId(data[0].id)
  }

  async function loadClub() {
    const { data: profileData } = await supabase.from('profiles').select('club_id').eq('id', profile.id).single()
    if (profileData?.club_id) {
      const { data } = await supabase.from('clubs').select('*').eq('id', profileData.club_id).single()
      setClub(data || null)
    }
  }

  async function loadExerciseOptions() {
    const { data } = await supabase.from('exercises').select('id, name, duration_minutes').order('name')
    setExerciseOptions(data || [])
  }

  async function loadSlots(id) {
    setLoading(true)
    const { data, error } = await supabase
      .from('weekly_schedule_slots')
      .select('*, training_sessions(id, title, objective)')
      .eq('team_id', id)
      .order('day_of_week')
      .order('start_time')
    if (error) setError(error.message)
    setSlots(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTeams()
    loadClub()
    loadExerciseOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (teamId) loadSlots(teamId)
  }, [teamId])

  const slotsByDay = useMemo(() => {
    const map = Array.from({ length: 7 }, () => [])
    slots.forEach((s) => map[s.day_of_week].push(s))
    return map
  }, [slots])

  async function createSlot(e) {
    e.preventDefault()
    setError('')
    const { error } = await supabase.from('weekly_schedule_slots').insert({ ...slotForm, team_id: teamId })
    if (error) {
      setError(error.message)
      return
    }
    setShowSlotForm(false)
    setSlotForm(emptySlotForm)
    loadSlots(teamId)
  }

  async function removeSlot(id) {
    if (!confirm('Remover este horário do quadro semanal?')) return
    const { error } = await supabase.from('weekly_schedule_slots').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    loadSlots(teamId)
  }

  function openBuilder(slot) {
    setBuilderSlot(slot)
    setSessionForm({
      title: slot.training_sessions?.title || '',
      objective: slot.training_sessions?.objective || '',
    })
    setPickExerciseId('')
    if (slot.training_session_id) {
      loadSessionExercises(slot.training_session_id)
    } else {
      setSessionExercises([])
    }
  }

  async function loadSessionExercises(sessionId) {
    const { data } = await supabase
      .from('training_session_exercises')
      .select('*, exercises(name)')
      .eq('session_id', sessionId)
      .order('sort_order')
    setSessionExercises(
      (data || []).map((row) => ({
        rowId: row.id,
        exercise_id: row.exercise_id,
        name: row.exercises?.name || '(exercício removido)',
        duration_minutes: row.duration_minutes ?? '',
        notes: row.notes ?? '',
      }))
    )
  }

  function addExerciseToBuilder() {
    if (!pickExerciseId) return
    const chosen = exerciseOptions.find((ex) => ex.id === pickExerciseId)
    if (!chosen) return
    setSessionExercises((list) => [
      ...list,
      {
        rowId: `new-${Date.now()}`,
        exercise_id: chosen.id,
        name: chosen.name,
        duration_minutes: chosen.duration_minutes ?? '',
        notes: '',
      },
    ])
    setPickExerciseId('')
  }

  function moveExercise(index, direction) {
    setSessionExercises((list) => {
      const next = [...list]
      const target = index + direction
      if (target < 0 || target >= next.length) return list
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateExerciseField(index, field, value) {
    setSessionExercises((list) => list.map((row, i) => (i === index ? { ...row, [field]: value } : row)))
  }

  function removeExerciseFromBuilder(index) {
    setSessionExercises((list) => list.filter((_, i) => i !== index))
  }

  async function saveSession() {
    setSavingSession(true)
    setError('')
    try {
      let sessionId = builderSlot.training_session_id

      if (sessionId) {
        const { error } = await supabase.from('training_sessions').update(sessionForm).eq('id', sessionId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('training_sessions')
          .insert({ ...sessionForm, team_id: teamId, created_by: profile.id })
          .select()
          .single()
        if (error) throw error
        sessionId = data.id
        const { error: slotError } = await supabase
          .from('weekly_schedule_slots')
          .update({ training_session_id: sessionId })
          .eq('id', builderSlot.id)
        if (slotError) throw slotError
      }

      // Substitui a lista de exercícios da sessão (mais simples e evita duplicidade)
      const { error: delError } = await supabase
        .from('training_session_exercises')
        .delete()
        .eq('session_id', sessionId)
      if (delError) throw delError

      if (sessionExercises.length > 0) {
        const rows = sessionExercises.map((ex, index) => ({
          session_id: sessionId,
          exercise_id: ex.exercise_id,
          sort_order: index,
          duration_minutes: ex.duration_minutes ? Number(ex.duration_minutes) : null,
          notes: ex.notes || null,
        }))
        const { error: insError } = await supabase.from('training_session_exercises').insert(rows)
        if (insError) throw insError
      }

      setBuilderSlot(null)
      loadSlots(teamId)
    } catch (err) {
      setError(err.message)
    } finally {
      setSavingSession(false)
    }
  }

  function timeLabel(t) {
    return t ? t.slice(0, 5) : '—'
  }

  async function exportPdf() {
    // Garante que temos os exercícios de cada sessão vinculada antes de montar o PDF
    const sessionIds = slots.map((s) => s.training_session_id).filter(Boolean)
    let exercisesBySession = {}
    if (sessionIds.length > 0) {
      const { data } = await supabase
        .from('training_session_exercises')
        .select('*, exercises(name)')
        .in('session_id', sessionIds)
        .order('sort_order')
      exercisesBySession = (data || []).reduce((acc, row) => {
        acc[row.session_id] = acc[row.session_id] || []
        acc[row.session_id].push(row)
        return acc
      }, {})
    }

    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16)
    doc.text(club?.name || 'Clube', 14, 18)
    doc.setFontSize(11)
    doc.setTextColor(90)
    if (currentTeam) {
      doc.text(
        `${currentTeam.category} · ${currentTeam.modality === 'futebol' ? 'Futebol' : 'Futsal'} · Temporada ${currentTeam.season}`,
        14,
        25
      )
    }
    doc.setTextColor(20)
    doc.setFontSize(14)
    doc.text('Quadro Semanal de Treinos', 14, 36)

    const body = []
    DAYS.forEach((dayName, dayIndex) => {
      const daySlots = slotsByDay[dayIndex]
      if (daySlots.length === 0) return
      daySlots.forEach((slot) => {
        body.push([
          dayName,
          `${timeLabel(slot.start_time)} – ${timeLabel(slot.end_time)}`,
          slot.location || '—',
          slot.training_sessions?.title || 'Treino não montado',
        ])
      })
    })

    autoTable(doc, {
      startY: 42,
      head: [['Dia', 'Horário', 'Local', 'Treino']],
      body,
      headStyles: { fillColor: [20, 23, 26] },
      styles: { fontSize: 9 },
    })

    let y = doc.lastAutoTable.finalY + 10

    slots
      .filter((s) => s.training_session_id)
      .forEach((slot) => {
        const exList = exercisesBySession[slot.training_session_id] || []
        if (y > 260) {
          doc.addPage()
          y = 20
        }
        doc.setFontSize(12)
        doc.setTextColor(20)
        doc.text(
          `${DAYS[slot.day_of_week]} ${timeLabel(slot.start_time)} — ${slot.training_sessions?.title || 'Treino'}`,
          14,
          y
        )
        y += 4
        if (slot.training_sessions?.objective) {
          doc.setFontSize(9)
          doc.setTextColor(90)
          doc.text(`Objetivo: ${slot.training_sessions.objective}`, 14, y + 4)
          y += 4
        }

        const exBody = exList.map((row, i) => [
          i + 1,
          row.exercises?.name || '(exercício removido)',
          row.duration_minutes ? `${row.duration_minutes} min` : '—',
          row.notes || '—',
        ])

        if (exBody.length > 0) {
          autoTable(doc, {
            startY: y + 6,
            head: [['#', 'Exercício', 'Duração', 'Observações']],
            body: exBody,
            styles: { fontSize: 8 },
            headStyles: { fillColor: [46, 191, 67] },
            margin: { left: 14, right: 14 },
          })
          y = doc.lastAutoTable.finalY + 10
        } else {
          y += 12
        }
      })

    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(140)
      doc.text('CoachPro · Desenvolvido por AB Labs', 14, 290)
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 30, 290)
    }

    doc.save(`quadro-semanal-${currentTeam?.category || 'clube'}.pdf`)
  }

  return (
    <AppLayout
      title="Quadro Semanal"
      actions={
        <div className="flex gap-2">
          <button
            onClick={exportPdf}
            className="rounded-md border border-chalk-200 bg-white px-4 py-2 font-display text-sm font-semibold text-pitch-950 hover:bg-chalk-50"
          >
            Exportar PDF
          </button>
          {isEditor && teamId && (
            <button
              onClick={() => setShowSlotForm((s) => !s)}
              className="rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold text-pitch-950 hover:bg-signal-dark"
            >
              + Horário
            </button>
          )}
        </div>
      }
    >
      {error && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {teams.length > 1 && (
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

      {teams.length === 0 && (
        <p className="text-chalk-400">
          Cadastre um quadro em <strong>Clube</strong> antes de montar o quadro semanal de treinos.
        </p>
      )}

      {showSlotForm && (
        <form onSubmit={createSlot} className="mb-6 grid gap-3 rounded-lg border border-chalk-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={slotForm.day_of_week}
            onChange={(e) => setSlotForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
            className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
          >
            {DAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={slotForm.start_time}
            onChange={(e) => setSlotForm((f) => ({ ...f, start_time: e.target.value }))}
            className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
          />
          <input
            type="time"
            value={slotForm.end_time}
            onChange={(e) => setSlotForm((f) => ({ ...f, end_time: e.target.value }))}
            className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
          />
          <input
            placeholder="Local (ex: Campo 1)"
            value={slotForm.location}
            onChange={(e) => setSlotForm((f) => ({ ...f, location: e.target.value }))}
            className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-pitch-950">Salvar</button>
            <button
              type="button"
              onClick={() => setShowSlotForm(false)}
              className="rounded-md border border-chalk-200 px-4 py-2 text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-chalk-400">Carregando…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {DAYS.map((dayName, dayIndex) => (
            <div key={dayName} className="rounded-lg border border-chalk-200 bg-white p-4">
              <h3 className="mb-3 font-display text-base font-semibold text-pitch-950">{dayName}</h3>
              {slotsByDay[dayIndex].length === 0 && (
                <p className="text-sm text-chalk-400">Sem treino programado.</p>
              )}
              <div className="space-y-3">
                {slotsByDay[dayIndex].map((slot) => (
                  <div key={slot.id} className="rounded-md border border-chalk-100 p-3">
                    <div className="mb-1 flex items-center justify-between text-sm font-medium text-pitch-950">
                      <span>
                        {timeLabel(slot.start_time)} – {timeLabel(slot.end_time)}
                      </span>
                      {isEditor && (
                        <button onClick={() => removeSlot(slot.id)} className="text-xs text-red-500 hover:underline">
                          remover
                        </button>
                      )}
                    </div>
                    {slot.location && <p className="mb-1 text-xs text-chalk-600">{slot.location}</p>}
                    <p className="mb-2 text-sm text-chalk-600">
                      {slot.training_sessions?.title || (
                        <span className="italic text-chalk-400">Treino não montado</span>
                      )}
                    </p>
                    {isEditor && (
                      <button
                        onClick={() => openBuilder(slot)}
                        className="text-xs font-medium text-signal-dark hover:underline"
                      >
                        {slot.training_session_id ? 'Editar treino' : 'Montar treino'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {builderSlot && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-pitch-950">
                Montar treino · {DAYS[builderSlot.day_of_week]} {timeLabel(builderSlot.start_time)}
              </h2>
              <button onClick={() => setBuilderSlot(null)} className="text-chalk-400 hover:text-chalk-600">
                ✕
              </button>
            </div>

            <div className="mb-4 grid gap-3">
              <input
                placeholder="Título do treino (ex: Finalização e transição)"
                value={sessionForm.title}
                onChange={(e) => setSessionForm((f) => ({ ...f, title: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
              />
              <input
                placeholder="Objetivo geral do treino"
                value={sessionForm.objective}
                onChange={(e) => setSessionForm((f) => ({ ...f, objective: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
              />
            </div>

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-chalk-400">
              Exercícios do treino
            </p>
            <div className="mb-3 flex gap-2">
              <select
                value={pickExerciseId}
                onChange={(e) => setPickExerciseId(e.target.value)}
                className="flex-1 rounded-md border border-chalk-200 px-3 py-2 text-sm"
              >
                <option value="">Escolher exercício do banco…</option>
                {exerciseOptions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={addExerciseToBuilder}
                className="rounded-md bg-pitch-950 px-3 text-sm text-white"
              >
                Adicionar
              </button>
            </div>

            {exerciseOptions.length === 0 && (
              <p className="mb-3 text-xs text-chalk-400">
                Nenhum exercício cadastrado ainda. Vá em <strong>Exercícios</strong> pra criar o banco de
                atividades primeiro.
              </p>
            )}

            <div className="space-y-2">
              {sessionExercises.map((ex, index) => (
                <div key={ex.rowId} className="flex items-center gap-2 rounded-md border border-chalk-100 p-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => moveExercise(index, -1)}
                      disabled={index === 0}
                      className="text-chalk-400 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      onClick={() => moveExercise(index, 1)}
                      disabled={index === sessionExercises.length - 1}
                      className="text-chalk-400 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-pitch-950">{ex.name}</p>
                  </div>
                  <input
                    type="number"
                    placeholder="min"
                    value={ex.duration_minutes}
                    onChange={(e) => updateExerciseField(index, 'duration_minutes', e.target.value)}
                    className="w-16 rounded-md border border-chalk-200 px-2 py-1 text-sm"
                  />
                  <input
                    placeholder="Observação"
                    value={ex.notes}
                    onChange={(e) => updateExerciseField(index, 'notes', e.target.value)}
                    className="w-40 rounded-md border border-chalk-200 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeExerciseFromBuilder(index)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    remover
                  </button>
                </div>
              ))}
              {sessionExercises.length === 0 && (
                <p className="text-sm text-chalk-400">Nenhum exercício adicionado ainda.</p>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={saveSession}
                disabled={savingSession}
                className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-pitch-950 disabled:opacity-60"
              >
                {savingSession ? 'Salvando…' : 'Salvar treino'}
              </button>
              <button
                onClick={() => setBuilderSlot(null)}
                className="rounded-md border border-chalk-200 px-4 py-2 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}
