// In-memory mock used only in the GitHub Pages demo build (VITE_DEMO=true).
// Seeded from real backend fixtures so shapes match exactly. GETs read the
// store, mutations update it (interactive within a session, not persisted),
// aggregate endpoints return the captured snapshot.
import fixtures from "../demoFixtures.json";

type Any = Record<string, unknown>;

const store: Record<string, any[]> = {
  pieces: structuredClone(fixtures.pieces),
  scales: structuredClone(fixtures.scales),
  milestones: structuredClone(fixtures.milestones),
  sessions: [],
  reading: [],
  tempo: [],
  chat: [],
};
let nextId = 10000;

// Generator config is a singleton object (not a collection).
const demoGenConfig: Any = {
  id: 1,
  w_scales: 0.15,
  w_etudes: 0.15,
  w_reading: 0.2,
  w_piece: 0.3,
  w_polyrhythm: 0.1,
  w_fun: 0.1,
  default_total_min: 90,
};

function match(path: string, re: RegExp) {
  return path.match(re);
}

export function mockRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const p = path.split("?")[0];
  const arrFor = (name: string) => store[name] as Any[];

  // Collection helpers
  const collection: Record<string, string> = {
    "/pieces": "pieces",
    "/scales": "scales",
    "/milestones": "milestones",
    "/sessions": "sessions",
    "/reading": "reading",
  };

  // Static aggregates
  if (method === "GET" && p === "/dashboard") return resolve(fixtures.dashboard);
  if (method === "GET" && p.startsWith("/generator/session")) return resolve(fixtures.generator);
  if (p === "/generator/config" && method === "GET") return resolve(demoGenConfig);
  if (p === "/generator/config" && method === "PUT") {
    Object.assign(demoGenConfig, body as Any);
    return resolve(demoGenConfig);
  }
  if (method === "GET" && p === "/settings") return resolve(fixtures.settings);
  if (method === "GET" && p === "/tempo/progression") return resolve(buildProgression());
  if (method === "GET" && p === "/scales/bpm-history") return resolve([]); // not tracked in demo
  if (method === "GET" && p === "/health")
    return resolve({ status: "demo", gemini_configured: false, video_local_only: true });

  // Chat (no backend in demo)
  if (p === "/chat/messages" && method === "GET") return resolve(store.chat);
  if (p === "/chat/messages" && method === "DELETE") {
    store.chat = [];
    return resolve(undefined);
  }
  if (p === "/chat" && method === "POST") {
    const b = body as Any;
    store.chat.push({ id: nextId++, role: "user", content: b.content, date: new Date().toISOString(), conversation_id: "default" });
    const reply = {
      id: nextId++,
      role: "assistant",
      conversation_id: "default",
      date: new Date().toISOString(),
      content:
        "🎹 Ceci est la démo statique de PianoCoach — le coach IA (Gemini) et l'analyse vidéo nécessitent le backend local. Clone le repo et lance `scripts/dev.sh` pour discuter avec tes vraies données.",
    };
    store.chat.push(reply);
    return resolve(reply);
  }

  // Videos: unsupported in demo
  if (p.startsWith("/videos")) return resolve(method === "GET" ? [] : {});

  // Tempo logging
  if (p === "/tempo" && method === "POST") {
    const rec = { id: nextId++, date: new Date().toISOString().slice(0, 10), ...(body as Any) };
    store.tempo.push(rec);
    return resolve(rec);
  }
  if (match(p, /^\/tempo\/\d+$/) && method === "DELETE") {
    const id = Number(p.split("/")[2]);
    store.tempo = store.tempo.filter((r: Any) => r.id !== id);
    return resolve(undefined);
  }
  if (p === "/tempo" && method === "GET") return resolve(store.tempo);

  // Reorder
  if (p === "/pieces/reorder" && method === "POST") {
    const ids = body as number[];
    const byId = new Map(arrFor("pieces").map((x: Any) => [x.id, x]));
    store.pieces = ids.map((id, i) => ({ ...(byId.get(id) as Any), order_index: i }));
    return resolve(store.pieces);
  }

  // Generic collection CRUD
  for (const [prefix, name] of Object.entries(collection)) {
    if (p === prefix && method === "GET") return resolve(arrFor(name));
    if (p === prefix && method === "POST") {
      const rec = {
        id: nextId++,
        date: new Date().toISOString().slice(0, 10),
        progress_pct: 0,
        ...(body as Any),
      };
      arrFor(name).push(rec);
      return resolve(rec);
    }
    const idMatch = match(p, new RegExp(`^${prefix}/(\\d+)$`));
    if (idMatch) {
      const id = Number(idMatch[1]);
      const list = arrFor(name);
      const idx = list.findIndex((x: Any) => x.id === id);
      if (method === "PATCH") {
        list[idx] = { ...list[idx], ...(body as Any) };
        return resolve(list[idx]);
      }
      if (method === "DELETE") {
        store[name] = list.filter((x: Any) => x.id !== id);
        return resolve(undefined);
      }
      if (method === "GET") return resolve(list[idx]);
    }
  }

  return resolve(undefined);
}

function buildProgression() {
  const groups: Record<number, any> = {};
  for (const t of store.tempo as Any[]) {
    const piece = (store.pieces as Any[]).find((x) => x.id === t.piece_id);
    const g = (groups[t.piece_id as number] ??= {
      piece_id: t.piece_id,
      piece_title: piece?.title ?? "?",
      target_tempo: piece?.target_tempo ?? null,
      points: [],
    });
    g.points.push({ id: t.id, date: t.date, bpm_clean: t.bpm_clean, passage_label: t.passage_label ?? "" });
  }
  return Object.values(groups);
}

function resolve<T>(v: unknown): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v as T), 120));
}
