import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Flame, Info, Target, TrendingUp } from "lucide-react";
import { Card, PageHeader, ProgressBar, Spinner, Stat } from "../components/ui";
import { useDashboard } from "../lib/queries";
import { CHART_COLORS, FOCUS_LABELS, TRACKS, formatMinutes, frenchDate, shortDate } from "../lib/format";
import type { FocusArea, Projection } from "../types";

const AXIS = { stroke: "#5b6678", tick: { fill: "#8b97ac", fontSize: 12 } };
const TOOLTIP = {
  contentStyle: { background: "#1a2234", border: "1px solid #283246", borderRadius: 8, color: "#e8ebf2" },
  labelStyle: { color: "#8b97ac" },
};

export default function Dashboard() {
  const { data, isLoading } = useDashboard();
  if (isLoading || !data) return <Spinner label="Chargement du tableau de bord…" />;

  const { streak, totals, projections, daily_minutes, focus_distribution, readiness, repertoire_counts, milestone_progress } =
    data;

  const focusData = focus_distribution.map((f) => ({
    name: FOCUS_LABELS[f.focus as FocusArea] ?? f.focus,
    value: f.minutes,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tableau de bord"
        subtitle="Ta progression d'un coup d'œil — pratique, régularité et chemin vers tes pièces cibles."
      />

      {/* Streak hero */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className="h-14 w-14 rounded-2xl grid place-items-center"
            style={{ backgroundColor: streak.current_streak > 0 ? "color-mix(in srgb, var(--color-accent) 20%, transparent)" : "var(--color-surface-2)" }}
          >
            <Flame size={28} className={streak.current_streak > 0 ? "text-accent" : "text-faint"} />
          </div>
          <div>
            <div className="text-2xl font-bold">
              {streak.current_streak} jour{streak.current_streak > 1 ? "s" : ""} d'affilée
            </div>
            <div className="text-sm text-muted">
              {streak.practiced_today
                ? "Joué aujourd'hui — continue comme ça 🎹"
                : streak.current_streak > 0
                  ? "La série tient. Une petite session aujourd'hui ?"
                  : "Nouvelle série dès ta prochaine séance — pas de pression."}
              {streak.longest_streak > 0 && ` · Record : ${streak.longest_streak} j`}
            </div>
          </div>
        </div>
        <Link to="/seance" className="btn btn-primary">
          <TrendingUp size={16} /> Séance du jour
        </Link>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Cette semaine" value={`${totals.week_hours} h`} hint={formatMinutes(totals.week_min)} />
        <Stat label="Ce mois" value={`${totals.month_hours} h`} hint={formatMinutes(totals.month_min)} />
        <Stat label="Total cumulé" value={formatMinutes(totals.total_min)} />
        <Stat
          label="Jalons franchis"
          value={`${milestone_progress.done}/${milestone_progress.total}`}
          hint={`${repertoire_counts.in_progress} pièce(s) en cours`}
        />
      </div>

      {/* Projections */}
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Target size={18} className="text-accent" /> Temps estimé avant les pièces cibles
        </h2>
        <div className="grid md:grid-cols-2 gap-4">
          {projections.map((p) => (
            <ProjectionCard key={p.target_title} p={p} />
          ))}
        </div>
      </div>

      {/* Constancy heatmap */}
      <Card>
        <h3 className="font-semibold mb-1">Régularité (12 dernières semaines)</h3>
        <p className="text-sm text-muted mb-4">Ta vraie marge de progrès. Chaque case = un jour pratiqué.</p>
        <ConstancyHeatmap days={daily_minutes} />
      </Card>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <h3 className="font-semibold mb-3">Pratique quotidienne</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={daily_minutes.slice(-42)}>
                <defs>
                  <linearGradient id="pgrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#818cf8" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" {...AXIS} tickFormatter={shortDate} minTickGap={28} />
                <YAxis {...AXIS} width={32} />
                <Tooltip {...TOOLTIP} labelFormatter={(d) => frenchDate(String(d))} formatter={(v) => [`${v} min`, "Pratique"]} />
                <Area type="monotone" dataKey="minutes" stroke="#818cf8" fill="url(#pgrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold mb-3">Répartition du travail</h3>
          {focusData.length === 0 ? (
            <p className="text-sm text-muted py-12 text-center">Logue des séances pour voir la répartition.</p>
          ) : (
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={focusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {focusData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip {...TOOLTIP} formatter={(v) => formatMinutes(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Readiness summary */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Préparation aux pièces cibles</h3>
          <Link to="/jalons" className="text-sm text-primary hover:underline">
            Détail & jalons →
          </Link>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {readiness.map((r) => (
            <div key={r.target_title}>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-medium truncate pr-2">{r.target_title}</span>
                <span className="text-sm font-bold" style={{ color: TRACKS[r.track].color }}>
                  {r.readiness_pct}%
                </span>
              </div>
              <ProgressBar value={r.readiness_pct} color={TRACKS[r.track].color} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ProjectionCard({ p }: { p: Projection }) {
  const [open, setOpen] = useState(false);
  const color = TRACKS[p.track].color;
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide" style={{ color }}>
            {TRACKS[p.track].label}
          </div>
          <div className="font-semibold truncate">{p.target_title}</div>
        </div>
      </div>
      <div className="flex items-end gap-2 mt-3">
        <span className="text-3xl font-bold">{p.months_remaining}</span>
        <span className="text-muted mb-1">mois estimés</span>
      </div>
      <div className="text-sm text-muted mt-1">
        Fourchette {Math.round(p.weeks_low)}–{Math.round(p.weeks_high)} sem.
        {p.eta_date && ` · cible ≈ ${frenchDate(p.eta_date)}`}
      </div>
      <div className="text-xs text-muted mt-2">
        {p.rungs.length} palier(s) restant(s) · {Math.round(p.remaining_hours)} h de travail à {p.weekly_hours} h/sem.
      </div>
      <button onClick={() => setOpen((o) => !o)} className="mt-3 text-xs text-primary flex items-center gap-1 hover:underline">
        <Info size={13} /> {open ? "Masquer" : "Comment c'est calculé"}
      </button>
      {open && (
        <div className="mt-2 text-xs text-muted space-y-2 border-t border-border pt-2">
          <ul className="list-disc list-inside space-y-0.5">
            {p.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          <div className="space-y-1">
            {p.rungs.map((r) => (
              <div key={r.title} className="flex justify-between gap-2">
                <span className="truncate">{r.title}</span>
                <span className="shrink-0">{Math.round(r.remaining_hours)} h</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

function ConstancyHeatmap({ days }: { days: { date: string; minutes: number }[] }) {
  // Render as columns of weeks (7 rows). Intensity by minutes.
  const cells = days.slice(-84);
  const weeks: { date: string; minutes: number }[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const color = (m: number) => {
    if (m <= 0) return "var(--color-surface-2)";
    const op = Math.min(1, 0.25 + m / 120);
    return `color-mix(in srgb, var(--color-primary) ${Math.round(op * 100)}%, transparent)`;
  };

  return (
    <div className="flex gap-1 overflow-x-auto pb-1">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-col gap-1">
          {week.map((d) => (
            <div
              key={d.date}
              title={`${frenchDate(d.date)} · ${d.minutes} min`}
              className="h-3.5 w-3.5 rounded-sm"
              style={{ backgroundColor: color(d.minutes) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
