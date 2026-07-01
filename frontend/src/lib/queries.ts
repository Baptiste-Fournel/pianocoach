import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { Milestone, Piece, PracticeSession, ReadingLog, Scale } from "../types";

// Invalidate a resource list + the dashboard (most mutations affect both).
function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: string[]) => {
    for (const k of [...keys, "dashboard"]) qc.invalidateQueries({ queryKey: [k] });
  };
}

// ---- Dashboard ----
export const useDashboard = () => useQuery({ queryKey: ["dashboard"], queryFn: api.dashboard });

// ---- Pieces ----
export const usePieces = () => useQuery({ queryKey: ["pieces"], queryFn: api.listPieces });
export function usePieceMutations() {
  const inv = useInvalidate();
  return {
    create: useMutation({ mutationFn: (b: Partial<Piece>) => api.createPiece(b), onSuccess: () => inv("pieces") }),
    update: useMutation({
      mutationFn: ({ id, b }: { id: number; b: Partial<Piece> }) => api.updatePiece(id, b),
      onSuccess: () => inv("pieces", "tempo-progression"),
    }),
    remove: useMutation({ mutationFn: (id: number) => api.deletePiece(id), onSuccess: () => inv("pieces") }),
    reorder: useMutation({ mutationFn: (ids: number[]) => api.reorderPieces(ids), onSuccess: () => inv("pieces") }),
  };
}

// ---- Sessions ----
export const useSessions = () => useQuery({ queryKey: ["sessions"], queryFn: api.listSessions });
export function useSessionMutations() {
  const inv = useInvalidate();
  return {
    create: useMutation({ mutationFn: (b: Partial<PracticeSession>) => api.createSession(b), onSuccess: () => inv("sessions") }),
    update: useMutation({
      mutationFn: ({ id, b }: { id: number; b: Partial<PracticeSession> }) => api.updateSession(id, b),
      onSuccess: () => inv("sessions"),
    }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteSession(id), onSuccess: () => inv("sessions") }),
  };
}

// ---- Scales ----
export const useScales = () => useQuery({ queryKey: ["scales"], queryFn: api.listScales });
export const useScaleBpmHistory = () =>
  useQuery({ queryKey: ["scale-bpm-history"], queryFn: api.scaleBpmHistory });
export function useScaleMutations() {
  const inv = useInvalidate();
  return {
    create: useMutation({ mutationFn: (b: Partial<Scale>) => api.createScale(b), onSuccess: () => inv("scales") }),
    update: useMutation({
      mutationFn: ({ id, b }: { id: number; b: Partial<Scale> }) => api.updateScale(id, b),
      onSuccess: () => inv("scales", "scale-bpm-history"),
    }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteScale(id), onSuccess: () => inv("scales") }),
  };
}

// ---- Tempo ----
export const useTempoProgression = () =>
  useQuery({ queryKey: ["tempo-progression"], queryFn: api.tempoProgression });
export function useTempoMutations() {
  const inv = useInvalidate();
  return {
    log: useMutation({ mutationFn: api.logTempo, onSuccess: () => inv("tempo-progression", "pieces") }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteTempo(id), onSuccess: () => inv("tempo-progression") }),
  };
}

// ---- Reading ----
export const useReading = () => useQuery({ queryKey: ["reading"], queryFn: api.listReading });
export function useReadingMutations() {
  const inv = useInvalidate();
  return {
    create: useMutation({ mutationFn: (b: Partial<ReadingLog>) => api.createReading(b), onSuccess: () => inv("reading") }),
    update: useMutation({
      mutationFn: ({ id, b }: { id: number; b: Partial<ReadingLog> }) => api.updateReading(id, b),
      onSuccess: () => inv("reading"),
    }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteReading(id), onSuccess: () => inv("reading") }),
  };
}

// ---- Milestones ----
export const useMilestones = () => useQuery({ queryKey: ["milestones"], queryFn: api.listMilestones });
export function useMilestoneMutations() {
  const inv = useInvalidate();
  return {
    create: useMutation({ mutationFn: (b: Partial<Milestone>) => api.createMilestone(b), onSuccess: () => inv("milestones") }),
    update: useMutation({
      mutationFn: ({ id, b }: { id: number; b: Partial<Milestone> }) => api.updateMilestone(id, b),
      onSuccess: () => inv("milestones"),
    }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteMilestone(id), onSuccess: () => inv("milestones") }),
  };
}

// ---- Settings ----
export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
}

// ---- Generator ----
export const useGeneratedSession = (totalMin: number, weekday?: number) =>
  useQuery({
    queryKey: ["generator", totalMin, weekday],
    queryFn: () => api.generateSession(totalMin, weekday),
  });
export const useGeneratorConfig = () =>
  useQuery({ queryKey: ["generator-config"], queryFn: api.getGeneratorConfig });
export function useUpdateGeneratorConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.updateGeneratorConfig,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["generator-config"] });
      qc.invalidateQueries({ queryKey: ["generator"] });
    },
  });
}

// ---- Chat ----
export const useChatMessages = (cid = "default") =>
  useQuery({ queryKey: ["chat", cid], queryFn: () => api.chatMessages(cid) });
export function useChatMutations(cid = "default") {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["chat", cid] });
  return {
    send: useMutation({ mutationFn: (content: string) => api.sendChat(content, cid), onSuccess: inv }),
    clear: useMutation({ mutationFn: () => api.clearChat(cid), onSuccess: inv }),
  };
}

// ---- Videos ----
export const useVideos = (pieceId?: number) =>
  useQuery({ queryKey: ["videos", pieceId ?? "all"], queryFn: () => api.listVideos(pieceId) });
export const useVideo = (id: number, poll = false) =>
  useQuery({
    queryKey: ["video", id],
    queryFn: () => api.getVideo(id),
    refetchInterval: poll ? 3000 : false,
  });
export function useVideoMutations() {
  const qc = useQueryClient();
  const inv = () => qc.invalidateQueries({ queryKey: ["videos"] });
  return {
    upload: useMutation({
      mutationFn: ({ file, pieceId, notes }: { file: File; pieceId?: number; notes?: string }) =>
        api.uploadVideo(file, pieceId, notes),
      onSuccess: inv,
    }),
    reanalyze: useMutation({ mutationFn: (id: number) => api.reanalyzeVideo(id), onSuccess: inv }),
    update: useMutation({
      mutationFn: ({ id, b }: { id: number; b: { self_notes?: string; piece_id?: number } }) => api.updateVideo(id, b),
      onSuccess: inv,
    }),
    remove: useMutation({ mutationFn: (id: number) => api.deleteVideo(id), onSuccess: inv }),
  };
}
