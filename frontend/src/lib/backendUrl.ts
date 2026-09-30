/** The FastAPI backend. Server code only (route handlers, generateMetadata). Same value as next.config.ts. */
export const backendUrl = (process.env.BACKEND_URL || "http://localhost:8000").replace(/\/+$/, "");
