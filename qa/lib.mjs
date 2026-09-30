// Shared helpers for the QA scripts. Run the scripts from qa/ with `node <script>.mjs`.
// The scripts never change files under frontend/src or backend/app.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

export const QA_DIR = import.meta.dirname;
export const ROOT = path.resolve(QA_DIR, "..");
// QA_OUT: write screenshots and results to another folder, so a re-run does not replace the committed evidence.
export const SHOTS = process.env.QA_OUT ?? path.join(ROOT, "docs/qa");
export const RESULTS = process.env.QA_OUT ? path.join(process.env.QA_OUT, "results") : path.join(ROOT, "docs/qa/results");
export const FE = process.env.QA_FE ?? "http://localhost:3000";
export const BE = process.env.QA_BE ?? "http://localhost:8000";
export const WS = BE.replace(/^http/, "ws");
// Playwright 1.60 expects chromium-1223. This machine has chromium-1243 only.
export const CHROME =
  process.env.QA_CHROME ??
  "/Users/abhishekgupta/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing";

fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(RESULTS, { recursive: true });

export const FAKE_MEDIA_ARGS = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];

/** Session tokens made by mint_tokens.py (qa/out/tokens.json, not committed). */
export function tokens() {
  return JSON.parse(fs.readFileSync(path.join(QA_DIR, "out/tokens.json"), "utf8"));
}

// The default fake camera is 1280x720. Five or six contexts on one 8-core machine then push the
// load average over 100 and the test itself times out. With QA_SMALL_VIDEO=1 (the default) the
// fake camera plays a 320x180 test pattern (made with ffmpeg into qa/out/). Run with
// QA_SMALL_VIDEO=0 to use the 720p default.
export const SMALL_VIDEO = path.join(QA_DIR, "out/fake-320x180.y4m");

export async function launch({ fakeMedia = true, fakeUi = true } = {}) {
  const args = [];
  if (fakeMedia) args.push("--use-fake-device-for-media-stream");
  if (fakeMedia && process.env.QA_SMALL_VIDEO !== "0" && fs.existsSync(SMALL_VIDEO))
    args.push(`--use-file-for-fake-video-capture=${SMALL_VIDEO}`);
  if (fakeUi) args.push("--use-fake-ui-for-media-stream");
  return chromium.launch({ executablePath: CHROME, headless: true, args });
}

// Records every RTCPeerConnection, WebSocket and getUserMedia stream of the page.
// The app has no debug hook, so the QA scripts add these from the outside.
const HOOKS = `(() => {
  window.__pcs = [];
  window.__sockets = [];
  window.__streams = [];
  const PC = window.RTCPeerConnection;
  if (PC) {
    window.RTCPeerConnection = class extends PC {
      constructor(...a) { super(...a); window.__pcs.push(this); }
    };
  }
  const W = window.WebSocket;
  window.WebSocket = class extends W {
    constructor(...a) { super(...a); window.__sockets.push(this); }
  };
  const md = navigator.mediaDevices;
  if (md && md.getUserMedia) {
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const s = await gum(c); window.__streams.push(s); return s; };
  }
})();`;

export const PHONE = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 3,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

/** The log of console errors, page errors and failed requests of all contexts. */
export const issues = [];

function track(page, name) {
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      issues.push({ ctx: name, kind: `console.${m.type()}`, text: m.text().slice(0, 400), url: page.url() });
  });
  page.on("pageerror", (e) => issues.push({ ctx: name, kind: "pageerror", text: String(e).slice(0, 400), url: page.url() }));
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "";
    // Aborted prefetches and media are normal on navigation.
    issues.push({ ctx: name, kind: "requestfailed", text: `${r.method()} ${r.url()} ${f}`, url: page.url() });
  });
  page.on("response", (r) => {
    if (r.status() >= 400)
      issues.push({ ctx: name, kind: `http.${r.status()}`, text: `${r.request().method()} ${r.url()}`, url: page.url() });
  });
}

/**
 * A new browser context and page.
 * userId: sign in with a forged session cookie. media: grant camera and microphone.
 */
export async function newPage(browser, { name, userId = null, phone = false, viewport, media = true } = {}) {
  const ctx = await browser.newContext({
    ...(phone ? PHONE : { viewport: viewport ?? { width: 1280, height: 800 } }),
    permissions: media ? ["camera", "microphone", "clipboard-read", "clipboard-write"] : [],
  });
  if (userId !== null) {
    await ctx.addCookies([
      { name: "session", value: tokens()[String(userId)], domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" },
    ]);
  }
  await ctx.addInitScript(HOOKS);
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);
  track(page, name);
  page.qaName = name;
  return page;
}

export async function demoLogin(page) {
  await page.goto(`${FE}/signin`);
  await page.getByRole("button", { name: /demo user/i }).click();
  await page.waitForURL(`${FE}/`);
}

/** Screenshot. It never throws: a busy machine can make a screenshot time out. */
export async function shot(page, file) {
  const p = path.join(SHOTS, file);
  try {
    await page.screenshot({ path: p, fullPage: false, timeout: 60000, animations: "disabled", caret: "initial" });
    return `docs/qa/${file}`;
  } catch (e) {
    console.log(`screenshot failed: ${file}: ${String(e).slice(0, 120)}`);
    return null;
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A fetch from inside the page, with its cookies. Returns {status, body}. */
export async function pageFetch(page, url, init = {}) {
  return page.evaluate(
    async ([url, init]) => {
      const r = await fetch(url, { credentials: "include", headers: { "content-type": "application/json" }, ...init });
      const text = await r.text();
      let body;
      try {
        body = JSON.parse(text);
      } catch {
        body = text.slice(0, 300);
      }
      return { status: r.status, body };
    },
    [url, init],
  );
}

/** Node-side API call. `cookie` is a session token or null. */
export async function api(method, pathname, { body, cookie, headers = {}, raw } = {}) {
  const h = { ...headers };
  if (body !== undefined || raw !== undefined) h["content-type"] = h["content-type"] ?? "application/json";
  if (cookie) h.cookie = `session=${cookie}`;
  const r = await fetch(`${BE}${pathname}`, {
    method,
    headers: h,
    body: raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = text.slice(0, 300);
  }
  return { status: r.status, body: json, headers: Object.fromEntries(r.headers) };
}

/** Pre-join -> room. Fills the name when given, then clicks Join. */
export async function joinFromPreview(page, { name } = {}) {
  const input = page.locator("#display-name");
  await input.waitFor();
  if (name !== undefined) await input.fill(name);
  const btn = page.getByRole("button", { name: /^Join$/ });
  await btn.waitFor();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Join");
    return b && !b.disabled;
  });
  await btn.click();
  await page.getByRole("toolbar", { name: "Meeting controls" }).waitFor();
}

/** Guest or user: open /j/<code>, fill the form, then the pre-join, then the room. */
export async function joinViaLink(page, code, { name, passcode } = {}) {
  await page.goto(`${FE}/j/${code}`);
  if (name !== undefined) await page.locator("#name").fill(name);
  if (passcode) await page.locator("#passcode").fill(passcode);
  await page.getByRole("button", { name: /^Join$/ }).click();
  await page.waitForURL(new RegExp(`/meeting/${code}`));
  await joinFromPreview(page);
}

/** The names on the video tiles, and on the participants panel if it is open. */
export async function tileNames(page) {
  return page.$$eval("figure[data-participant-id]", (els) =>
    els.map((e) => ({ id: Number(e.getAttribute("data-participant-id")), label: e.getAttribute("aria-label") })),
  );
}

/** Opens the participants panel and returns its row texts. */
export async function panelRows(page) {
  const open = await page.getByRole("button", { name: /Participants/ }).first().getAttribute("aria-pressed");
  if (open !== "true") await page.getByRole("button", { name: /Participants/ }).first().click();
  await page.waitForSelector("text=/In the meeting \\(/");
  return page.$$eval("aside li, [role=dialog] li, section li", (els) => els.map((e) => e.textContent.trim()));
}

/**
 * Media probe, run in the page. For each remote tile: video size and whether the pixels change.
 * For each RTCPeerConnection: state and inbound audio bytes and video frames, sampled twice.
 */
export async function mediaProbe(page, waitMs = 3000) {
  return page.evaluate(async (waitMs) => {
    const sample = (v) => {
      const c = document.createElement("canvas");
      c.width = 32;
      c.height = 18;
      const g = c.getContext("2d");
      try {
        g.drawImage(v, 0, 0, 32, 18);
        return Array.from(g.getImageData(0, 0, 32, 18).data);
      } catch {
        return null;
      }
    };
    const stats = async () => {
      const out = [];
      for (const pc of window.__pcs ?? []) {
        if (pc.connectionState === "closed") continue;
        const r = await pc.getStats();
        let audioBytes = 0;
        let videoFrames = 0;
        let outAudioBytes = 0;
        r.forEach((s) => {
          if (s.type === "inbound-rtp" && s.kind === "audio") audioBytes += s.bytesReceived ?? 0;
          if (s.type === "inbound-rtp" && s.kind === "video") videoFrames += s.framesDecoded ?? 0;
          if (s.type === "outbound-rtp" && s.kind === "audio") outAudioBytes += s.bytesSent ?? 0;
        });
        out.push({ state: pc.connectionState, audioBytes, videoFrames, outAudioBytes });
      }
      return out;
    };
    const tiles = [...document.querySelectorAll("figure[data-participant-id]")].filter(
      (f) => !(f.getAttribute("aria-label") ?? "").includes("(you)"),
    );
    const vids = tiles.map((f) => ({ label: f.getAttribute("aria-label"), v: f.querySelector("video") }));
    const first = vids.map((x) => (x.v ? sample(x.v) : null));
    const s1 = await stats();
    await new Promise((r) => setTimeout(r, waitMs));
    const s2 = await stats();
    const tileOut = vids.map((x, i) => {
      const b = x.v ? sample(x.v) : null;
      let diff = null;
      if (first[i] && b) diff = first[i].reduce((acc, val, k) => acc + Math.abs(val - b[k]), 0);
      return {
        label: x.label,
        hasVideo: !!x.v,
        videoWidth: x.v?.videoWidth ?? 0,
        videoHeight: x.v?.videoHeight ?? 0,
        pixelDiff: diff,
      };
    });
    const pcs = s2.map((b, i) => ({
      state: b.state,
      audioBytesDelta: b.audioBytes - (s1[i]?.audioBytes ?? 0),
      videoFramesDelta: b.videoFrames - (s1[i]?.videoFrames ?? 0),
      outAudioBytesDelta: b.outAudioBytes - (s1[i]?.outAudioBytes ?? 0),
    }));
    const audios = [...document.querySelectorAll("audio[data-participant-id]")].map((a) => ({
      id: a.getAttribute("data-participant-id"),
      paused: a.paused,
      tracks: a.srcObject ? a.srcObject.getAudioTracks().map((t) => t.readyState) : [],
    }));
    return { tiles: tileOut, pcs, audios };
  }, waitMs);
}

export function save(name, data) {
  fs.writeFileSync(path.join(RESULTS, `${name}.json`), JSON.stringify(data, null, 2));
}

export function saveIssues(name) {
  save(`console-${name}`, issues);
}

/** A tiny result log: check(name, pass, evidence). */
export function recorder() {
  const rows = [];
  const check = (name, pass, evidence = {}) => {
    rows.push({ name, pass, evidence });
    console.log(`${pass === true ? "PASS" : pass === false ? "FAIL" : "INFO"}  ${name}  ${JSON.stringify(evidence).slice(0, 1500)}`);
  };
  return { rows, check };
}
