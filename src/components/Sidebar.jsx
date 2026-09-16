import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import logo from '../assets/logo-coachpro-white.png'

const BASE_NAV_ITEMS = [
  { to: '/clube', label: 'Clube', icon: '🛡️' },
  { to: '/elenco', label: 'Elenco', icon: '👥' },
  { to: '/sumula', label: 'Súmula', icon: '📋', disabled: true },
  { to: '/treinos', label: 'Treinos', icon: '📅' },
  { to: '/exercicios', label: 'Exercícios', icon: '⚽' },
  { to: '/presenca', label: 'Presença', icon: '✅', disabled: true },
]

export default function Sidebar() {
  const [open, setOpen] = useState(false)
  const { profile, signOut } = useAuth()

  const NAV_ITEMS =
    profile?.role === 'admin'
      ? [...BASE_NAV_ITEMS, { to: '/usuarios', label: 'Usuários', icon: '🔑' }]
      : BASE_NAV_ITEMS

  return (
    <>
      {/* botão mobile */}
      <button
        onClick={() => setOpen(true)}
        className="fixed left-3 top-3 z-30 flex h-10 w-10 items-center justify-center rounded-md bg-pitch-950 text-white shadow md:hidden"
        aria-label="Abrir menu"
      >
        ☰
      </button>

      {/* overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={`fixed z-40 flex h-full w-64 flex-col justify-between bg-pitch-950 py-6 transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="mb-8 flex items-center gap-2 px-6">
            <img src={logo} alt="CoachPro" className="h-9 w-auto" />
          </div>

          <nav className="flex flex-col gap-1 px-3">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.disabled ? '#' : item.to}
                onClick={(e) => {
                  if (item.disabled) e.preventDefault()
                  setOpen(false)
                }}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2.5 font-display text-base tracking-wide transition-colors ${
                    item.disabled
                      ? 'cursor-not-allowed text-chalk-600/60'
                      : isActive
                      ? 'bg-signal/15 text-signal'
                      : 'text-chalk-200 hover:bg-white/5'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
                {item.disabled && <span className="ml-auto text-[10px] text-chalk-600">em breve</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="px-6 text-chalk-400">
          <p className="truncate text-sm">{profile?.full_name || 'Usuário'}</p>
          <p className="mb-3 truncate text-xs capitalize text-chalk-600">{profile?.role}</p>
          <button
            onClick={signOut}
            className="text-sm font-medium text-signal hover:text-signal-light"
          >
            Sair
          </button>
          <p className="mt-6 text-[11px] leading-snug text-chalk-600">
            Desenvolvido por <span className="font-semibold text-chalk-400">AB Labs</span>
          </p>
        </div>
      </aside>
    </>
  )
}
