import { NavLink, Outlet } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CalendarCheck,
  Gauge,
  LayoutDashboard,
  Library,
  Link as LinkIcon,
  MessageCircle,
  Music2,
  NotebookPen,
  Piano,
  Settings,
  Target,
  Video,
} from "lucide-react";
import { clsx } from "clsx";
import { DEMO } from "../lib/api";

const NAV = [
  { to: "/", label: "Tableau de bord", icon: LayoutDashboard, end: true },
  { to: "/repertoire", label: "Répertoire", icon: Library },
  { to: "/journal", label: "Journal", icon: NotebookPen },
  { to: "/gammes", label: "Gammes & arpèges", icon: Music2 },
  { to: "/tempo", label: "Tempo par passage", icon: Gauge },
  { to: "/lecture", label: "Lecture", icon: BookOpen },
  { to: "/jalons", label: "Jalons & jauges", icon: Target },
  { to: "/seance", label: "Séance du jour", icon: CalendarCheck },
  { to: "/polyrythmie", label: "Polyrythmie", icon: Activity },
  { to: "/piano", label: "Piano (MIDI)", icon: Piano },
  { to: "/ressources", label: "Ressources", icon: LinkIcon },
  { to: "/coach", label: "Coach IA", icon: MessageCircle },
  { to: "/videos", label: "Vidéos", icon: Video },
  { to: "/reglages", label: "Réglages", icon: Settings },
];

export default function Layout() {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[250px_1fr]">
      {/* Sidebar */}
      <aside className="md:h-screen md:sticky md:top-0 border-b md:border-b-0 md:border-r border-border bg-surface/60 backdrop-blur">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary-deep grid place-items-center text-white font-bold">P</div>
          <div>
            <div className="font-bold leading-tight">PianoCoach</div>
            <div className="text-xs text-muted">Suivi & coaching</div>
          </div>
        </div>
        <nav className="px-3 pb-4 flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive ? "bg-primary-deep/20 text-text font-medium" : "text-muted hover:bg-surface-2 hover:text-text"
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              <span className="md:inline">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="min-w-0">
        {DEMO && (
          <div className="bg-accent/15 text-accent text-sm px-5 py-2 text-center border-b border-accent/20">
            Démo statique — données d'exemple, en lecture seule. Le coach IA et l'analyse vidéo nécessitent le backend
            local (voir le README).
          </div>
        )}
        <div className="p-5 md:p-8 max-w-6xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
