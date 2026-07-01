import { useEffect, useRef, useState } from "react";
import { Cable, RefreshCw } from "lucide-react";
import { PageHeader, Card, SectionTitle, Button, Badge, Empty } from "../components/ui";
import { PianoKeyboard } from "../components/PianoKeyboard";
import { useMidiStatus, useMidiStream } from "../lib/useMidi";
import { noteName } from "../lib/midi";
import { DEMO } from "../lib/api";

export default function Piano() {
  const status = useMidiStatus();
  const ports = status.data?.ports ?? [];
  const available = !!status.data?.available;
  const [port, setPort] = useState<string | undefined>(undefined);

  const { connected, error, active, onNote } = useMidiStream(port, available && !DEMO);

  // Rolling log of recently-played notes (keyed, allows repeats).
  const [log, setLog] = useState<{ id: number; note: number }[]>([]);
  const counter = useRef(0);
  useEffect(
    () =>
      onNote((e) => {
        if (e.type === "note_on") {
          setLog((l) => [{ id: counter.current++, note: e.note }, ...l].slice(0, 30));
        }
      }),
    [onNote]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Piano (MIDI)"
        subtitle="Branche ton Kawai CN201 en USB : PianoCoach lit les notes en direct. C'est la base du trainer de solfège et de la vérification des gammes."
        right={
          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
            style={{
              color: connected ? "var(--color-good)" : "var(--color-faint)",
              backgroundColor: connected
                ? "color-mix(in srgb, var(--color-good) 16%, transparent)"
                : "var(--color-surface-2)",
            }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: connected ? "var(--color-good)" : "var(--color-faint)" }}
            />
            {connected ? "Piano connecté" : "Aucun piano"}
          </span>
        }
      />

      {DEMO ? (
        <Card>
          <Empty>Le MIDI nécessite le backend local (lecture du port USB). Indisponible dans la démo.</Empty>
        </Card>
      ) : (
        <>
          <Card>
            <SectionTitle
              title="Connexion"
              right={
                <Button variant="ghost" onClick={() => status.refetch()} disabled={status.isFetching}>
                  <RefreshCw size={15} /> Actualiser
                </Button>
              }
            />
            {!available ? (
              <div className="flex items-start gap-2 text-sm text-warn">
                <Cable size={16} className="mt-0.5 shrink-0" />
                <span>
                  Aucun backend MIDI détecté. Branche ton piano en USB, puis clique « Actualiser ». (Sur macOS,
                  le CN201 apparaît automatiquement — pas de pilote à installer.)
                </span>
              </div>
            ) : ports.length === 0 ? (
              <div className="flex items-start gap-2 text-sm text-warn">
                <Cable size={16} className="mt-0.5 shrink-0" />
                <span>Backend MIDI OK, mais aucun port détecté. Branche le CN201 en USB puis « Actualiser ».</span>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-sm text-muted">Port MIDI</label>
                <select className="input w-auto" value={port ?? ports[0]} onChange={(e) => setPort(e.target.value)}>
                  {ports.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {connected && <Badge color="var(--color-good)">En écoute</Badge>}
              </div>
            )}
            {error && <p className="mt-3 text-sm text-bad">{error}</p>}
          </Card>

          <Card>
            <SectionTitle title="Clavier en direct" subtitle="Joue quelques notes : elles s'allument ici." />
            <PianoKeyboard active={active} low={36} high={84} />
            <div className="mt-4">
              <div className="text-xs uppercase tracking-wide text-muted mb-2">Dernières notes</div>
              {log.length === 0 ? (
                <p className="text-sm text-faint">
                  {connected ? "Joue une note sur ton piano…" : "En attente de connexion…"}
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {log.map((l) => (
                    <span
                      key={l.id}
                      className="rounded-md bg-surface-2 border border-border px-2 py-0.5 text-sm tabular-nums"
                    >
                      {noteName(l.note)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
