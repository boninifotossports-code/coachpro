import Sidebar from './Sidebar'

export default function AppLayout({ title, actions, children }) {
  return (
    <div className="flex h-screen bg-chalk-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-chalk-200 bg-white px-6 py-4 pl-16 md:pl-6">
          <h1 className="font-display text-2xl font-semibold text-pitch-950">{title}</h1>
          <div className="flex items-center gap-3">{actions}</div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">{children}</main>
      </div>
    </div>
  )
}
