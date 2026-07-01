import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Heart, Pencil, Plus, Target, Trash2 } from "lucide-react";
import { Badge, Button, Field, Modal, PageHeader, ProgressBar, Spinner } from "../components/ui";
import { usePieceMutations, usePieces } from "../lib/queries";
import { STATUS, TRACKS, frenchDate } from "../lib/format";
import type { Piece, PieceStatus, Track } from "../types";

const TRACK_ORDER: Track[] = ["chopin", "beethoven", "common", "neoclassical"];
const STATUS_OPTIONS: PieceStatus[] = ["planned", "in_progress", "learned", "target"];

export default function Repertoire() {
  const { data: pieces, isLoading } = usePieces();
  const { reorder } = usePieceMutations();
  const [editing, setEditing] = useState<Piece | "new" | null>(null);

  if (isLoading || !pieces) return <Spinner label="Chargement du répertoire…" />;

  const byTrack = (t: Track) =>
    pieces.filter((p) => p.track === t).sort((a, b) => a.order_index - b.order_index);

  function onReorder(track: Track, orderedIds: number[]) {
    // Rebuild the full global order: keep track groups in TRACK_ORDER, swap in
    // the dragged track's new internal order.
    const ids: number[] = [];
    for (const t of TRACK_ORDER) {
      if (t === track) ids.push(...orderedIds);
      else ids.push(...byTrack(t).map((p) => p.id));
    }
    reorder.mutate(ids);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Répertoire & objectifs"
        subtitle="Tes deux voies vers les pièces cibles, le socle commun et le néoclassique. Glisse pour réordonner les paliers."
        right={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} /> Ajouter une pièce
          </Button>
        }
      />

      {TRACK_ORDER.map((track) => {
        const list = byTrack(track);
        if (list.length === 0) return null;
        return <TrackLadder key={track} track={track} pieces={list} onEdit={setEditing} onReorder={onReorder} />;
      })}

      {editing && <PieceModal piece={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function TrackLadder({
  track,
  pieces,
  onEdit,
  onReorder,
}: {
  track: Track;
  pieces: Piece[];
  onEdit: (p: Piece) => void;
  onReorder: (track: Track, ids: number[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const meta = TRACKS[track];

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = pieces.map((p) => p.id);
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    onReorder(track, arrayMove(ids, from, to));
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: meta.color }} />
        <h2 className="text-lg font-semibold">{meta.label}</h2>
        <span className="text-sm text-muted">· {pieces.length} pièce(s)</span>
      </div>

      <div className="relative pl-4">
        {/* ladder spine */}
        <div className="absolute left-[7px] top-2 bottom-2 w-0.5" style={{ backgroundColor: meta.color, opacity: 0.3 }} />
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={pieces.map((p) => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {pieces.map((p) => (
                <SortablePiece key={p.id} piece={p} accent={meta.color} onEdit={onEdit} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </section>
  );
}

function SortablePiece({ piece, accent, onEdit }: { piece: Piece; accent: string; onEdit: (p: Piece) => void }) {
  const { update, remove } = usePieceMutations();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: piece.id });
  const isTarget = piece.status === "target";
  const st = STATUS[piece.status];

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="relative"
    >
      {/* rung marker */}
      <div
        className="absolute -left-[13px] top-5 h-3 w-3 rounded-full border-2"
        style={{ borderColor: accent, backgroundColor: isTarget ? accent : "var(--color-bg)" }}
      />
      <div className="card p-4" style={isTarget ? { boxShadow: `inset 0 0 0 1px ${accent}` } : undefined}>
        <div className="flex items-start gap-3">
          <button {...attributes} {...listeners} className="text-faint hover:text-muted cursor-grab pt-1" aria-label="Réordonner">
            <GripVertical size={16} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isTarget && <Target size={15} className="text-accent shrink-0" />}
              <span className="font-medium">{piece.title}</span>
              <Badge color={st.color}>{st.label}</Badge>
              {piece.difficulty != null && <span className="text-xs text-faint">diff. {piece.difficulty}/10</span>}
            </div>
            <div className="text-sm text-muted">{piece.composer}</div>

            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1">
                <ProgressBar value={piece.progress_pct} color={accent} />
              </div>
              <span className="text-xs text-muted w-9 text-right">{piece.progress_pct}%</span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {piece.target_tempo != null && (
                <span>
                  Tempo : <span className="text-text">{piece.current_clean_tempo ?? "—"}</span> /{" "}
                  {piece.target_tempo} BPM
                </span>
              )}
              {piece.date_started && <span>Débutée {frenchDate(piece.date_started)}</span>}
            </div>
            {piece.notes && <p className="mt-2 text-xs text-muted italic">{piece.notes}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <select
              value={piece.status}
              onChange={(e) => update.mutate({ id: piece.id, b: { status: e.target.value as PieceStatus } })}
              className="input !py-1 !px-2 text-xs"
              aria-label="Statut"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
            <div className="flex gap-1">
              <button
                onClick={() => update.mutate({ id: piece.id, b: { loved: !piece.loved } })}
                className="btn btn-ghost !p-1.5"
                style={piece.loved ? { color: "var(--color-accent)" } : undefined}
                aria-label={piece.loved ? "Retirer des pièces aimées" : "Marquer comme aimée"}
                title={piece.loved ? "Pièce aimée" : "Marquer comme aimée"}
              >
                <Heart size={14} fill={piece.loved ? "currentColor" : "none"} />
              </button>
              <button onClick={() => onEdit(piece)} className="btn btn-ghost !p-1.5" aria-label="Modifier">
                <Pencil size={14} />
              </button>
              <button
                onClick={() => {
                  if (confirm(`Supprimer « ${piece.title} » ?`)) remove.mutate(piece.id);
                }}
                className="btn btn-ghost !p-1.5 text-bad"
                aria-label="Supprimer"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PieceModal({ piece, onClose }: { piece: Piece | null; onClose: () => void }) {
  const { create, update } = usePieceMutations();
  const [form, setForm] = useState({
    title: piece?.title ?? "",
    composer: piece?.composer ?? "",
    track: piece?.track ?? ("chopin" as Track),
    status: piece?.status ?? ("planned" as PieceStatus),
    difficulty: piece?.difficulty ?? 5,
    progress_pct: piece?.progress_pct ?? 0,
    target_tempo: piece?.target_tempo ?? 0,
    current_clean_tempo: piece?.current_clean_tempo ?? 0,
    notes: piece?.notes ?? "",
  });

  function submit() {
    if (!form.title.trim()) return;
    const body: Partial<Piece> = {
      title: form.title,
      composer: form.composer,
      track: form.track,
      status: form.status,
      difficulty: Number(form.difficulty) || null,
      progress_pct: Number(form.progress_pct),
      target_tempo: Number(form.target_tempo) || null,
      current_clean_tempo: Number(form.current_clean_tempo) || null,
      notes: form.notes,
    };
    if (piece) update.mutate({ id: piece.id, b: body }, { onSuccess: onClose });
    else create.mutate(body, { onSuccess: onClose });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open onClose={onClose} title={piece ? "Modifier la pièce" : "Ajouter une pièce"}>
      <div className="space-y-3">
        <Field label="Titre">
          <input className="input" value={form.title} onChange={set("title")} />
        </Field>
        <Field label="Compositeur">
          <input className="input" value={form.composer} onChange={set("composer")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Voie">
            <select className="input" value={form.track} onChange={set("track")}>
              {TRACK_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TRACKS[t].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Statut">
            <select className="input" value={form.status} onChange={set("status")}>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS[s].label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Difficulté /10">
            <input type="number" min={1} max={10} className="input" value={form.difficulty} onChange={set("difficulty")} />
          </Field>
          <Field label="Avancement %">
            <input type="number" min={0} max={100} className="input" value={form.progress_pct} onChange={set("progress_pct")} />
          </Field>
          <Field label="Tempo cible">
            <input type="number" className="input" value={form.target_tempo} onChange={set("target_tempo")} />
          </Field>
        </div>
        <Field label="Tempo propre actuel (BPM)">
          <input type="number" className="input" value={form.current_clean_tempo} onChange={set("current_clean_tempo")} />
        </Field>
        <Field label="Notes">
          <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={submit}>{piece ? "Enregistrer" : "Ajouter"}</Button>
        </div>
      </div>
    </Modal>
  );
}
