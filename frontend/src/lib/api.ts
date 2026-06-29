import { mockRequest } from "./mock";
import type {
  AppSettings,
  ChatMessage,
  Dashboard,
  GeneratedSession,
  Milestone,
  Piece,
  PracticeSession,
  ReadingLog,
  Scale,
  ScaleBpmHistory,
  TempoLog,
  TempoProgression,
  Video,
} from "../types";

export const DEMO = import.meta.env.VITE_DEMO === "true";
const BASE = "/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DEMO) return mockRequest<T>(method, path, body);

  const opts: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(detail, res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const get = <T>(p: string) => request<T>("GET", p);
const post = <T>(p: string, body?: unknown) => request<T>("POST", p, body);
const patch = <T>(p: string, body?: unknown) => request<T>("PATCH", p, body);
const del = (p: string) => request<void>("DELETE", p);

export const api = {
  // Pieces
  listPieces: () => get<Piece[]>("/pieces"),
  createPiece: (b: Partial<Piece>) => post<Piece>("/pieces", b),
  updatePiece: (id: number, b: Partial<Piece>) => patch<Piece>(`/pieces/${id}`, b),
  deletePiece: (id: number) => del(`/pieces/${id}`),
  reorderPieces: (ids: number[]) => post<Piece[]>("/pieces/reorder", ids),

  // Practice sessions
  listSessions: () => get<PracticeSession[]>("/sessions"),
  createSession: (b: Partial<PracticeSession>) => post<PracticeSession>("/sessions", b),
  updateSession: (id: number, b: Partial<PracticeSession>) => patch<PracticeSession>(`/sessions/${id}`, b),
  deleteSession: (id: number) => del(`/sessions/${id}`),

  // Scales
  listScales: () => get<Scale[]>("/scales"),
  createScale: (b: Partial<Scale>) => post<Scale>("/scales", b),
  updateScale: (id: number, b: Partial<Scale>) => patch<Scale>(`/scales/${id}`, b),
  deleteScale: (id: number) => del(`/scales/${id}`),
  scaleBpmHistory: () => get<ScaleBpmHistory[]>("/scales/bpm-history"),

  // Tempo
  listTempo: (pieceId?: number) => get<TempoLog[]>(`/tempo${pieceId ? `?piece_id=${pieceId}` : ""}`),
  logTempo: (b: Partial<TempoLog>) => post<TempoLog>("/tempo", b),
  deleteTempo: (id: number) => del(`/tempo/${id}`),
  tempoProgression: () => get<TempoProgression[]>("/tempo/progression"),

  // Reading
  listReading: () => get<ReadingLog[]>("/reading"),
  createReading: (b: Partial<ReadingLog>) => post<ReadingLog>("/reading", b),
  updateReading: (id: number, b: Partial<ReadingLog>) => patch<ReadingLog>(`/reading/${id}`, b),
  deleteReading: (id: number) => del(`/reading/${id}`),

  // Milestones
  listMilestones: () => get<Milestone[]>("/milestones"),
  createMilestone: (b: Partial<Milestone>) => post<Milestone>("/milestones", b),
  updateMilestone: (id: number, b: Partial<Milestone>) => patch<Milestone>(`/milestones/${id}`, b),
  deleteMilestone: (id: number) => del(`/milestones/${id}`),

  // Dashboard + generator
  dashboard: () => get<Dashboard>("/dashboard"),
  generateSession: (totalMin: number, weekday?: number) =>
    get<GeneratedSession>(`/generator/session?total_min=${totalMin}${weekday != null ? `&weekday=${weekday}` : ""}`),

  // Settings
  getSettings: () => get<AppSettings>("/settings"),
  updateSettings: (b: { gemini_api_key?: string; gemini_model?: string; video_local_only?: boolean }) =>
    request<AppSettings>("PUT", "/settings", b),

  // Chat
  chatMessages: (cid = "default") => get<ChatMessage[]>(`/chat/messages?conversation_id=${cid}`),
  sendChat: (content: string, cid = "default") => post<ChatMessage>("/chat", { conversation_id: cid, content }),
  clearChat: (cid = "default") => del(`/chat/messages?conversation_id=${cid}`),

  // Videos
  listVideos: (pieceId?: number) => get<Video[]>(`/videos${pieceId ? `?piece_id=${pieceId}` : ""}`),
  getVideo: (id: number) => get<Video>(`/videos/${id}`),
  reanalyzeVideo: (id: number) => post<Video>(`/videos/${id}/analyze`),
  updateVideo: (id: number, b: { self_notes?: string; piece_id?: number }) => patch<Video>(`/videos/${id}`, b),
  deleteVideo: (id: number) => del(`/videos/${id}`),
  videoFileUrl: (id: number) => `${BASE}/videos/${id}/file`,
  uploadVideo: async (file: File, pieceId?: number, selfNotes = "") => {
    if (DEMO) return mockRequest<Video>("POST", "/videos");
    const fd = new FormData();
    fd.append("file", file);
    if (pieceId != null) fd.append("piece_id", String(pieceId));
    fd.append("self_notes", selfNotes);
    const res = await fetch(`${BASE}/videos`, { method: "POST", body: fd });
    if (!res.ok) throw new ApiError((await res.json().catch(() => ({}))).detail ?? res.statusText, res.status);
    return (await res.json()) as Video;
  },
};
