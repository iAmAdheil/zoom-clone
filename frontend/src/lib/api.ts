import type {
  ApiErrorBody,
  InstantMeetingInput,
  JoinInput,
  JoinResult,
  Meeting,
  MeetingLookup,
  MeetingPatch,
  Participant,
  ScheduleMeetingInput,
  User,
} from "./types";
import { safeNext } from "./redirects";

// The one place that talks to the backend. The browser calls /api/* on its own origin,
// and next.config.ts forwards the call to FastAPI. See docs/api.md for each endpoint.

/** A failed API call. `code` is the machine code from the error body (docs/api.md). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ApiErrorBody).detail === "string" &&
    typeof (value as ApiErrorBody).code === "string"
  );
}

type RequestOptions = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown };

async function request<T>(path: string, { method = "GET", body }: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: "include",
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the server. Check your connection.");
  }

  if (response.status === 204) return undefined as T;

  // The proxy returns HTML when the backend is down, so the body may not be JSON.
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isErrorBody(data)) throw new ApiError(response.status, data.code, data.detail);
    throw new ApiError(response.status, "http_error", "The server could not do this. Try again.");
  }
  return data as T;
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body });
const code = (meetingCode: string) => encodeURIComponent(meetingCode.replace(/\D/g, ""));

export const api = {
  // ---- auth ----
  /** Full-page URL. The backend redirects to Google, then back to `next`. */
  googleLoginUrl: (next: string) => `/api/auth/google/login?next=${encodeURIComponent(safeNext(next))}`,
  demoLogin: () => post<User>("/auth/demo"),
  logout: () => post<void>("/auth/logout"),
  /** `null` for a guest: app/api/me/route.ts answers 200 with null instead of 401. */
  me: () => request<User | null>("/me"),

  // ---- meetings ----
  createInstant: (input: InstantMeetingInput = {}) => post<Meeting>("/meetings/instant", input),
  scheduleMeeting: (input: ScheduleMeetingInput) => post<Meeting>("/meetings", input),
  upcoming: () => request<Meeting[]>("/meetings/upcoming"),
  recent: (limit = 20) => request<Meeting[]>(`/meetings/recent?limit=${limit}`),
  lookup: (meetingCode: string) => request<MeetingLookup>(`/meetings/${code(meetingCode)}`),
  updateMeeting: (id: number, patch: MeetingPatch) =>
    request<Meeting>(`/meetings/${id}`, { method: "PATCH", body: patch }),
  cancelMeeting: (id: number) => request<void>(`/meetings/${id}`, { method: "DELETE" }),
  join: (meetingCode: string, input: JoinInput) =>
    post<JoinResult>(`/meetings/${code(meetingCode)}/join`, input),
  endMeeting: (meetingCode: string) => post<Meeting>(`/meetings/${code(meetingCode)}/end`),

  // ---- participants (host controls) ----
  /** A guest has no session, so a guest sends its WebSocket ticket. */
  participants: (meetingCode: string, ticket?: string) =>
    request<Participant[]>(
      `/meetings/${code(meetingCode)}/participants${ticket ? `?ticket=${encodeURIComponent(ticket)}` : ""}`,
    ),
  muteParticipant: (meetingCode: string, pid: number) =>
    post<Participant>(`/meetings/${code(meetingCode)}/participants/${pid}/mute`),
  muteAll: (meetingCode: string) => post<Participant[]>(`/meetings/${code(meetingCode)}/mute-all`),
  removeParticipant: (meetingCode: string, pid: number) =>
    post<Participant>(`/meetings/${code(meetingCode)}/participants/${pid}/remove`),
};

/** Error text for the UI. Any thrown value becomes one short sentence. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Try again.";
}
