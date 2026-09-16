import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import AppLayout from '../components/AppLayout'

const emptyExercise = {
  name: '',
  objective: '',
  description: '',
  materials: '',
  duration_minutes: '',
  modality: 'ambos',
}

export default function Exercises() {
  const { profile } = useAuth()
  const isEditor = profile?.role === 'admin' || profile?.role === 'coach'

  const [folders, setFolders] = useState([])
  const [selectedFolder, setSelectedFolder] = useState(null) // null = "Todas"
  const [exercises, setExercises] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [newFolderName, setNewFolderName] = useState('')
  const [showExerciseForm, setShowExerciseForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyExercise)

  async function loadFolders() {
    const { data, error } = await supabase.from('exercise_folders').select('*').order('name')
    if (error) setError(error.message)
    setFolders(data || [])
  }

  async function loadExercises() {
    setLoading(true)
    let query = supabase.from('exercises').select('*').order('name')
    if (selectedFolder) query = query.eq('folder_id', selectedFolder)
    const { data, error } = await query
    if (error) setError(error.message)
    setExercises(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadFolders()
  }, [])

  useEffect(() => {
    loadExercises()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolder])

  async function createFolder(e) {
    e.preventDefault()
    if (!newFolderName.trim()) return
    setError('')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('club_id')
      .eq('id', profile.id)
      .single()
    if (profileError || !profileData?.club_id) {
      setError('Seu usuário ainda não está vinculado a um clube.')
      return
    }
    const { error } = await supabase
      .from('exercise_folders')
      .insert({ name: newFolderName.trim(), club_id: profileData.club_id })
    if (error) {
      setError(error.message)
      return
    }
    setNewFolderName('')
    loadFolders()
  }

  async function removeFolder(id) {
    if (!confirm('Remover esta pasta? Os exercícios dentro dela ficam sem pasta, mas não são apagados.')) return
    const { error } = await supabase.from('exercise_folders').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    if (selectedFolder === id) setSelectedFolder(null)
    loadFolders()
    loadExercises()
  }

  function startNew() {
    setEditingId(null)
    setForm({ ...emptyExercise })
    setShowExerciseForm(true)
  }

  function startEdit(ex) {
    setEditingId(ex.id)
    setForm({
      name: ex.name,
      objective: ex.objective ?? '',
      description: ex.description ?? '',
      materials: ex.materials ?? '',
      duration_minutes: ex.duration_minutes ?? '',
      modality: ex.modality ?? 'ambos',
    })
    setShowExerciseForm(true)
  }

  async function saveExercise(e) {
    e.preventDefault()
    setError('')

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('club_id')
      .eq('id', profile.id)
      .single()
    if (profileError || !profileData?.club_id) {
      setError('Seu usuário ainda não está vinculado a um clube.')
      return
    }

    const payload = {
      ...form,
      duration_minutes: form.duration_minutes ? Number(form.duration_minutes) : null,
      club_id: profileData.club_id,
      folder_id: selectedFolder,
    }

    const { error } = editingId
      ? await supabase.from('exercises').update(payload).eq('id', editingId)
      : await supabase.from('exercises').insert(payload)

    if (error) {
      setError(error.message)
      return
    }

    setShowExerciseForm(false)
    setEditingId(null)
    setForm({ ...emptyExercise })
    loadExercises()
  }

  async function removeExercise(id) {
    if (!confirm('Remover este exercício do banco de atividades?')) return
    const { error } = await supabase.from('exercises').delete().eq('id', id)
    if (error) {
      setError(error.message)
      return
    }
    loadExercises()
  }

  return (
    <AppLayout
      title="Banco de Exercícios"
      actions={
        isEditor && (
          <button
            onClick={startNew}
            className="rounded-md bg-signal px-4 py-2 font-display text-sm font-semibold tracking-wide text-pitch-950 hover:bg-signal-dark"
          >
            + Exercício
          </button>
        )
      }
    >
      {error && (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <div className="rounded-lg border border-chalk-200 bg-white p-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-chalk-400">
            Pastas
          </p>
          <button
            onClick={() => setSelectedFolder(null)}
            className={`mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm ${
              selectedFolder === null ? 'bg-signal/15 font-medium text-pitch-950' : 'hover:bg-chalk-50'
            }`}
          >
            Todos os exercícios
          </button>
          {folders.map((f) => (
            <div key={f.id} className="group flex items-center">
              <button
                onClick={() => setSelectedFolder(f.id)}
                className={`w-full flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm ${
                  selectedFolder === f.id ? 'bg-signal/15 font-medium text-pitch-950' : 'hover:bg-chalk-50'
                }`}
              >
                {f.name}
              </button>
              {isEditor && (
                <button
                  onClick={() => removeFolder(f.id)}
                  className="hidden px-1 text-xs text-red-400 hover:underline group-hover:inline"
                  title="Remover pasta"
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {isEditor && (
            <form onSubmit={createFolder} className="mt-3 flex gap-1">
              <input
                placeholder="Nova pasta"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full min-w-0 rounded-md border border-chalk-200 px-2 py-1.5 text-sm"
              />
              <button className="shrink-0 rounded-md bg-pitch-950 px-2.5 text-sm text-white">+</button>
            </form>
          )}
        </div>

        <div>
          {showExerciseForm && (
            <form
              onSubmit={saveExercise}
              className="mb-6 grid gap-3 rounded-lg border border-chalk-200 bg-white p-5 sm:grid-cols-2"
            >
              <input
                required
                placeholder="Nome do exercício"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="Objetivo (ex: finalização, posse de bola)"
                value={form.objective}
                onChange={(e) => setForm((f) => ({ ...f, objective: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <textarea
                placeholder="Descrição / como executar"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={4}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm sm:col-span-2"
              />
              <input
                placeholder="Materiais (ex: 8 cones, 4 coletes)"
                value={form.materials}
                onChange={(e) => setForm((f) => ({ ...f, materials: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                placeholder="Duração (min)"
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
              />
              <select
                value={form.modality}
                onChange={(e) => setForm((f) => ({ ...f, modality: e.target.value }))}
                className="rounded-md border border-chalk-200 px-3 py-2 text-sm"
              >
                <option value="ambos">Futebol e Futsal</option>
                <option value="futebol">Só Futebol</option>
                <option value="futsal">Só Futsal</option>
              </select>
              {selectedFolder === null && (
                <p className="text-xs text-chalk-400 sm:col-span-2">
                  Este exercício será salvo sem pasta. Selecione uma pasta à esquerda antes de
                  criar se quiser organizá-lo automaticamente.
                </p>
              )}
              <div className="flex gap-2 sm:col-span-2">
                <button className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-pitch-950">
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => setShowExerciseForm(false)}
                  className="rounded-md border border-chalk-200 px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {loading && <p className="text-chalk-400">Carregando…</p>}
            {!loading && exercises.length === 0 && (
              <p className="text-chalk-400">Nenhum exercício encontrado nesta pasta.</p>
            )}
            {exercises.map((ex) => (
              <div key={ex.id} className="flex flex-col rounded-lg border border-chalk-200 bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="font-display text-base font-semibold text-pitch-950">{ex.name}</h3>
                  {ex.duration_minutes && (
                    <span className="shrink-0 rounded-full bg-chalk-100 px-2 py-0.5 text-xs text-chalk-600">
                      {ex.duration_minutes} min
                    </span>
                  )}
                </div>
                {ex.objective && <p className="mb-1 text-sm text-chalk-600">{ex.objective}</p>}
                {ex.description && <p className="mb-2 line-clamp-3 text-sm text-chalk-600">{ex.description}</p>}
                {ex.materials && (
                  <p className="mb-2 text-xs text-chalk-400">Materiais: {ex.materials}</p>
                )}
                {isEditor && (
                  <div className="mt-auto flex gap-3 pt-2 text-xs">
                    <button onClick={() => startEdit(ex)} className="text-signal-dark hover:underline">
                      editar
                    </button>
                    <button onClick={() => removeExercise(ex.id)} className="text-red-500 hover:underline">
                      remover
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
