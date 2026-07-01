import { useMemo, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { clsx } from "clsx";
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Stat,
  Field,
  Spinner,
  Empty,
} from "../components/ui";
import { FOCUS_ORDER, FOCUS_LABELS, formatMinutes, frenchDate, todayISO } from "../lib/format";
import { DEMO } from "../lib/api";
import { useSessions, useSessionMutations, usePieces } from "../lib/queries";
import type { FocusArea, PracticeSession } from "../types";

const TENSION_LEVELS = [1, 2, 3, 4, 5];

function tensionColor(level: number): string {
  if (level <= 2) return "var(--color-good)";
  if (level === 3) return "var(--color-warn)";
  return "var(--color-bad)";
}

export default function Journal() {
  const { data: sessions, isLoading } = useSessions();
  const { data: pieces } = usePieces();
  const { create, update, remove } = useSessionMutations();

  const [editingId, setEditingId] = useState<number | null>(null);
  const [date, setDate] = useState(todayISO());
  const [duration, setDuration] = useState("30");
  const [focusAreas, setFocusAreas] = useState<FocusArea[]>([]);
  const [piecesWorked, setPiecesWorked] = useState<string[]>([]);
  const [tension, setTension] = useState(3);
  const [mood, setMood] = useState("");
  const [notes, setNotes] = useState("");

  const sorted = useMemo(
    () =>
      [...(sessions ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.id - a.id)),
    [sessions]
  );

  const week = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    cutoff.setHours(0, 0, 0, 0);
    const recent = (sessions ?? []).filter((s) => new Date(s.date) >= cutoff);
    return {
      count: recent.length,
      minutes: recent.reduce((acc, s) => acc + (s.duration_min || 0), 0),
    };
  }, [sessions]);

  function toggleFocus(f: FocusArea) {
    setFocusAreas((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function togglePiece(title: string) {
    setPiecesWorked((prev) => (prev.includes(title) ? prev.filter((x) => x !== title) : [...prev, title]));
  }

  function reset() {
    setEditingId(null);
    setDate(todayISO());
    setDuration("30");
    setFocusAreas([]);
    setPiecesWorked([]);
    setTension(3);
    setMood("");
    setNotes("");
  }

  function startEdit(s: PracticeSession) {
    setEditingId(s.id);
    setDate(s.date);
    setDuration(String(s.duration_min));
    setFocusAreas(s.focus_areas);
    setPiecesWorked(s.pieces_worked);
    setTension(s.tension_level ?? 3);
    setMood(s.mood);
    setNotes(s.notes);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dur = Math.round(Number(duration));
    if (!date || !dur || dur <= 0) return;
    const payload: Partial<PracticeSession> = {
      date,
      duration_min: dur,
      focus_areas: focusAreas,
      pieces_worked: piecesWorked,
      tension_level: tension,
      mood: mood.trim(),
      notes: notes.trim(),
    };
    if (editingId != null) {
      update.mutate({ id: editingId, b: payload }, { onSuccess: reset });
    } else {
      create.mutate(payload);
      reset();
    }
  }

  const pieceTitles = useMemo(
    () => (pieces ?? []).map((p) => p.title).filter(Boolean),
    [pieces]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Journal de pratique"
        subtitle="Note chaque session, même courte. La régularité compte plus que la durée — chaque jour consigné est une victoire."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Sessions cette semaine" value={week.count} hint="7 derniers jours" />
        <Stat
          label="Temps cette semaine"
          value={week.minutes > 0 ? formatMinutes(week.minutes) : "0 min"}
          hint="7 derniers jours"
        />
        <Stat
          label="Total consigné"
          value={sorted.length}
          hint={sorted.length ? "sessions au total" : "à toi de commencer"}
        />
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-text mb-1">
          {editingId != null ? "Modifier la session" : "Nouvelle session"}
        </h2>
        <p className="text-sm text-muted mb-4">
          Quelques secondes pour garder le fil de ta progression.
        </p>
        {DEMO && (
          <div className="mb-4 rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-xs text-muted">
            Mode démo en lecture seule — l'enregistrement n'est pas persisté.
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Date">
              <input
                type="date"
                className="input"
                value={date}
                max={todayISO()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Durée (minutes)">
              <input
                type="number"
                min={1}
                step={1}
                className="input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="30"
                required
              />
            </Field>
          </div>

          <Field label="Axes de travail">
            <div className="flex flex-wrap gap-2">
              {FOCUS_ORDER.map((f) => {
                const active = focusAreas.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFocus(f)}
                    aria-pressed={active}
                    className={clsx(
                      "rounded-full px-3 py-1 text-sm border transition-colors",
                      active
                        ? "bg-primary-deep/40 border-primary text-text"
                        : "bg-surface-2 border-border text-muted hover:text-text"
                    )}
                  >
                    {FOCUS_LABELS[f]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Pièces travaillées">
            {pieceTitles.length === 0 ? (
              <p className="text-sm text-faint">Aucune pièce enregistrée pour l'instant.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {pieceTitles.map((title) => {
                  const active = piecesWorked.includes(title);
                  return (
                    <button
                      key={title}
                      type="button"
                      onClick={() => togglePiece(title)}
                      aria-pressed={active}
                      className={clsx(
                        "rounded-full px-3 py-1 text-sm border transition-colors",
                        active
                          ? "bg-accent/20 border-accent text-text"
                          : "bg-surface-2 border-border text-muted hover:text-text"
                      )}
                    >
                      {title}
                    </button>
                  );
                })}
              </div>
            )}
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Tension">
              <div className="flex items-center gap-2">
                {TENSION_LEVELS.map((lvl) => {
                  const active = tension === lvl;
                  return (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setTension(lvl)}
                      aria-pressed={active}
                      className={clsx(
                        "h-9 w-9 rounded-full text-sm font-medium border transition-colors",
                        active ? "text-text" : "bg-surface-2 border-border text-muted hover:text-text"
                      )}
                      style={
                        active
                          ? {
                              borderColor: tensionColor(lvl),
                              backgroundColor: "color-mix(in srgb, " + tensionColor(lvl) + " 22%, transparent)",
                            }
                          : undefined
                      }
                    >
                      {lvl}
                    </button>
                  );
                })}
                <span className="text-xs text-faint ml-1">1 = détendu · 5 = très tendu</span>
              </div>
            </Field>
            <Field label="Humeur">
              <input
                type="text"
                className="input"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="Motivé, fatigué, fier…"
              />
            </Field>
          </div>

          <Field label="Notes">
            <textarea
              className="input min-h-[80px] resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ce qui a marché, ce qui coince, l'idée à reprendre demain…"
            />
          </Field>

          <div className="flex justify-end gap-2">
            {editingId != null && (
              <Button type="button" variant="ghost" onClick={reset}>
                <X size={14} /> Annuler
              </Button>
            )}
            <Button type="submit" disabled={create.isPending || update.isPending}>
              {editingId != null
                ? update.isPending
                  ? "Mise à jour…"
                  : "Mettre à jour"
                : create.isPending
                  ? "Enregistrement…"
                  : "Enregistrer la session"}
            </Button>
          </div>
        </form>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-text mb-3">Sessions récentes</h2>
        {isLoading ? (
          <Spinner />
        ) : sorted.length === 0 ? (
          <Empty>
            Aucune session pour l'instant. Même 10 minutes comptent — consigne ta première séance et lance ta série.
          </Empty>
        ) : (
          <div className="space-y-3">
            {sorted.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-semibold text-text">{frenchDate(s.date)}</span>
                      <span className="text-sm text-muted">{formatMinutes(s.duration_min)}</span>
                      {s.tension_level != null && (
                        <span className="text-sm text-muted">
                          Tension{" "}
                          <span style={{ color: tensionColor(s.tension_level) }} className="font-medium">
                            {s.tension_level}/5
                          </span>
                        </span>
                      )}
                      {s.mood && <span className="text-sm text-accent">{s.mood}</span>}
                    </div>

                    {s.focus_areas.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.focus_areas.map((f) => (
                          <Badge key={f} color="var(--color-primary)">
                            {FOCUS_LABELS[f]}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {s.pieces_worked.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {s.pieces_worked.map((t) => (
                          <Badge key={t} color="var(--color-accent)">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {s.notes && <p className="text-sm text-muted mt-2 whitespace-pre-wrap">{s.notes}</p>}
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" aria-label="Modifier la session" onClick={() => startEdit(s)}>
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      aria-label="Supprimer la session"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(s.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
