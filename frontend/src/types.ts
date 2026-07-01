// Types mirroring the FastAPI / SQLModel backend (see backend/app/models.py).

export type PieceStatus = "target" | "planned" | "in_progress" | "learned";
export type Track = "chopin" | "beethoven" | "common" | "neoclassical";
export type ScaleType = "major" | "minor_harmonic" | "minor_melodic";
export type Hands = "separate" | "together";
export type ClefFocus = "treble" | "bass" | "both";
export type Horizon = "3m" | "6m" | "12m" | "24m";
export type FocusArea =
  | "scales"
  | "arpeggios"
  | "etudes"
  | "reading"
  | "polyrhythm"
  | "piece"
  | "fun";

export interface Piece {
  id: number;
  title: string;
  composer: string;
  status: PieceStatus;
  track: Track;
  difficulty: number | null;
  date_started: string | null;
  date_completed: string | null;
  progress_pct: number;
  target_tempo: number | null;
  current_clean_tempo: number | null;
  order_index: number;
  notes: string;
}

export interface PracticeSession {
  id: number;
  date: string;
  duration_min: number;
  focus_areas: FocusArea[];
  pieces_worked: string[];
  tension_level: number | null;
  mood: string;
  notes: string;
}

export interface Scale {
  id: number;
  key: string;
  type: ScaleType;
  hands: Hands;
  current_bpm: number | null;
  target_bpm: number;
  mastered: boolean;
  last_practiced: string | null;
}

export interface ScaleBpmHistory {
  scale_id: number;
  key: string;
  type: string;
  target_bpm: number | null;
  points: { date: string; bpm: number }[];
}

export interface TempoLog {
  id: number;
  piece_id: number;
  passage_label: string;
  date: string;
  bpm_clean: number;
}

export interface TempoProgression {
  piece_id: number;
  piece_title: string;
  target_tempo: number | null;
  points: { date: string; bpm_clean: number; passage_label: string }[];
}

export interface ReadingLog {
  id: number;
  date: string;
  clef_focus: ClefFocus;
  material: string;
  minutes: number;
  notes: string;
}

export interface Milestone {
  id: number;
  label: string;
  horizon: Horizon;
  done: boolean;
  date_done: string | null;
  order_index: number;
}

export interface VideoFeedback {
  overall_summary?: string;
  strengths?: string[];
  areas_to_work?: string[];
  suggested_exercises?: string[];
  hands_and_fingers?: string;
  tension_vs_release?: string;
  posture?: string;
  tempo_and_evenness?: string;
  tone_and_dynamics?: string;
  error?: string;
}

export interface AudioMetrics {
  duration_s: number;
  tempo_bpm_global: number;
  tempo: {
    mean_bpm: number | null;
    min_bpm?: number;
    max_bpm?: number;
    bpm_cv: number | null;
    stability_score: number | null;
    times: number[];
    bpm: number[];
  };
  onsets: {
    onset_count: number;
    mean_interval_s: number | null;
    interval_cv: number | null;
    regularity_score: number | null;
  };
  dynamics: {
    mean_db: number | null;
    min_db?: number;
    max_db?: number;
    dynamic_range_db: number | null;
    times: number[];
    rms: number[];
  };
}

export interface Video {
  id: number;
  piece_id: number | null;
  date: string;
  file_path: string;
  self_notes: string;
  ai_feedback: VideoFeedback | null;
  audio_metrics: AudioMetrics | null;
  analysis_status: "pending" | "analyzing" | "done" | "error";
}

export interface ChatMessage {
  id: number;
  conversation_id: string;
  date: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export interface Projection {
  target_title: string;
  track: Track;
  remaining_hours: number;
  weekly_hours: number;
  weeks_remaining: number;
  months_remaining: number;
  weeks_low: number;
  weeks_high: number;
  eta_date: string | null;
  eta_low: string | null;
  eta_high: string | null;
  assumptions: string[];
  rungs: { title: string; difficulty: number | null; progress_pct: number; remaining_hours: number }[];
}

export interface Readiness {
  target_title: string;
  track: Track;
  readiness_pct: number;
  components: { key: string; label: string; score: number; weight: number }[];
}

export interface Dashboard {
  totals: { week_min: number; month_min: number; total_min: number; week_hours: number; month_hours: number };
  streak: { current_streak: number; longest_streak: number; practiced_today: boolean };
  focus_distribution: { focus: string; minutes: number }[];
  daily_minutes: { date: string; minutes: number }[];
  projections: Projection[];
  readiness: Readiness[];
  scale_bpm: { key: string; type: string; current_bpm: number | null; target_bpm: number; mastered: boolean }[];
  repertoire_counts: { target: number; in_progress: number; planned: number; learned: number };
  milestone_progress: { done: number; total: number };
}

export interface SessionBlock {
  focus: FocusArea;
  label: string;
  minutes: number;
  detail: string;
}

export interface GeneratedSession {
  weekday: number;
  weekday_name: string;
  total_min: number;
  scale_of_day: string | null;
  piece_of_day: string | null;
  polyrhythm: string;
  blocks: SessionBlock[];
}

export interface AppSettings {
  gemini_configured: boolean;
  gemini_model: string;
  video_local_only: boolean;
  data_dir: string;
  ffmpeg_available: boolean;
}
