// Matrix item 8: realtime resilience. Browser part (host + 2 guests) and raw WebSocket part (Node).
import { FE, WS, api, joinFromPreview, launch, mediaProbe, newPage, recorder, save, saveIssues, shot, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();

/** Opens a raw socket. Collects messages. Resolves when open or closed. */
function rawSocket(code, ticket) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS}/ws/meetings/${code}?ticket=${encodeURIComponent(ticket)}`);
    const out = { ws, messages: [], closed: null };
    ws.onmessage = (m) => out.messages.push(typeof m.data === "string" ? JSON.parse(m.data) : "<binary>");
    ws.onclose = (e) => {
      out.closed = { code: e.code, reason: e.reason };
      resolve(out);
    };
    ws.onerror = () => {};
    ws.onopen = () => setTimeout(() => resolve(out), 400);
  });
}
const waitMsg = async (s, pred, ms = 3000) => {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const m = s.messages.find(pred);
    if (m) return m;
    if (s.closed) return null;
    await sleep(50);
  }
  return null;
};
const guestJoin = (code, name, extra = {}) => api("POST", `/api/meetings/${code}/join`, { body: { display_name: name, ...extra } });

// ---------------- raw WebSocket protocol ----------------
const m = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA realtime raw" } })).body;
const code = m.meeting_code;
const other = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA realtime other" } })).body;

{
  const j = (await guestJoin(code, "raw 1")).body;
  const s1 = await rawSocket(code, j.ws_ticket);
  const snap = await waitMsg(s1, (x) => x.type === "snapshot");
  check("ws: a fresh ticket opens and the first message is the snapshot", !!snap && s1.messages[0]?.type === "snapshot", { first: s1.messages[0]?.type });
  const s2 = await rawSocket(code, j.ws_ticket);
  await sleep(500);
  check("ws: ticket reuse is refused with 4401 ticket_used", s2.closed?.code === 4401 && s2.closed?.reason === "ticket_used", s2.closed);

  const wrong = await rawSocket(other.meeting_code, (await guestJoin(code, "raw wrong")).body.ws_ticket);
  await sleep(300);
  check("ws: a ticket for another meeting is refused with 4403 wrong_meeting", wrong.closed?.code === 4403 && wrong.closed?.reason === "wrong_meeting", wrong.closed);
  const none = await rawSocket(code, "garbage");
  await sleep(300);
  check("ws: a garbage ticket is refused with 4401 invalid_ticket", none.closed?.code === 4401, none.closed);

  // Malformed messages on an open socket.
  const ws = s1.ws;
  const cases = [
    ["garbage text", "hello there"],
    ["empty object", "{}"],
    ["unknown type", JSON.stringify({ type: "make_me_host" })],
    ["set_muted string", JSON.stringify({ type: "set_muted", value: "yes" })],
    ["signal to self", JSON.stringify({ type: "signal", to: j.participant.id, data: { a: 1 } })],
    ["signal to unknown", JSON.stringify({ type: "signal", to: 999999, data: { a: 1 } })],
    ["signal data not object", JSON.stringify({ type: "signal", to: 1, data: "x" })],
    ["signal 17 KB", JSON.stringify({ type: "signal", to: 1, data: { x: "a".repeat(17000) } })],
    ["1 MB text", "x".repeat(1024 * 1024)],
  ];
  const replies = {};
  for (const [name, payload] of cases) {
    const before = s1.messages.length;
    ws.send(payload);
    const r = await (async () => {
      const end = Date.now() + 3000;
      while (Date.now() < end) {
        if (s1.messages.length > before) return s1.messages[s1.messages.length - 1];
        if (s1.closed) return null;
        await sleep(50);
      }
      return null;
    })();
    replies[name] = r ? `${r.type}:${r.code ?? ""}` : s1.closed ? `closed ${s1.closed.code}` : "no reply";
  }
  ws.send(new Uint8Array([1, 2, 3, 4]));
  await sleep(800);
  replies["binary frame"] = s1.closed ? `closed ${s1.closed.code}` : `${s1.messages.at(-1)?.type}:${s1.messages.at(-1)?.code ?? ""}`;
  check("ws: malformed messages get an error event and the socket stays open", !s1.closed && Object.values(replies).every((v) => v.startsWith("error:")), { replies, closed: s1.closed });

  // 20 MB message (uvicorn default max is 16 MB).
  const big = await rawSocket(code, (await guestJoin(code, "raw big")).body.ws_ticket);
  big.ws.send("y".repeat(20 * 1024 * 1024));
  await sleep(3000);
  check("ws: a 20 MB message closes only that socket (1009) and the server lives", big.closed !== null && (await api("GET", "/api/health")).status === 200, { closed: big.closed });

  // Many sockets for one participant (rejoin token gives a new ticket each time).
  let token = j.rejoin_token;
  const socks = [];
  for (let i = 0; i < 20; i++) {
    const r = (await guestJoin(code, "raw 1", { rejoin_token: token })).body;
    token = r.rejoin_token;
    socks.push(await rawSocket(code, r.ws_ticket));
  }
  await sleep(500);
  const open = socks.filter((x) => !x.closed).length;
  const lastSnap = socks.at(-1).messages.find((x) => x.type === "snapshot");
  check("ws: many sockets for one participant: count accepted (no per-participant cap)", open < 20, {
    openSockets: open + (s1.closed ? 0 : 1),
    sameParticipant: socks.every((x) => x.messages[0]?.participants?.some((p) => p.id === j.participant.id)),
    connectedIdsInSnapshot: lastSnap?.connected_ids,
  });
  for (const x of socks) x.ws.close();
  ws.close();

  // Expired ticket: wait longer than 60 s.
  const late = (await guestJoin(code, "raw late")).body;
  console.log("waiting 65 s for the ticket to expire...");
  await sleep(65000);
  const exp = await rawSocket(code, late.ws_ticket);
  await sleep(300);
  check("ws: an expired ticket (65 s) is refused with 4401 invalid_ticket", exp.closed?.code === 4401 && exp.closed?.reason === "invalid_ticket", exp.closed);
  // The GET participants endpoint with an expired ticket.
  const ex2 = await api("GET", `/api/meetings/${code}/participants?ticket=${late.ws_ticket}`);
  check("api: GET participants with an expired ticket is refused", ex2.status === 403, { status: ex2.status });
  // The 'late' guest never opened a socket. Is it still in the list after 65 s?
  const list = (await api("GET", `/api/meetings/${code}/participants`, { cookie: T["1"] })).body;
  check("realtime: a guest who joined by REST and never opened a socket is still listed after 65 s (ghost)", !list.some((p) => p.id === late.participant.id), {
    ghostStillListed: list.some((p) => p.id === late.participant.id),
    listed: list.map((p) => p.display_name),
  });
}
await api("POST", `/api/meetings/${code}/end`, { cookie: T["1"] });
await api("POST", `/api/meetings/${other.meeting_code}/end`, { cookie: T["1"] });

// ---------------- browser part ----------------
const browser = await launch();
const host = await newPage(browser, { name: "rt-host", userId: 1, viewport: { width: 1440, height: 900 } });
const g1 = await newPage(browser, { name: "rt-guest1" });
const g2 = await newPage(browser, { name: "rt-guest2" });
await host.goto(`${FE}/`);
const room = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA realtime room" } })).body;
const rc = room.meeting_code;
await host.goto(`${FE}/meeting/${rc}`);
await joinFromPreview(host);
for (const [p, n] of [[g1, "RT One"], [g2, "RT Two"]]) {
  await p.goto(`${FE}/j/${rc}`);
  await p.locator("#name").fill(n);
  await p.getByRole("button", { name: /^Join$/ }).click();
  await p.waitForURL(/\/meeting\//, { waitUntil: "commit" });
  await joinFromPreview(p);
}
const ids = (p) => p.$$eval("figure[data-participant-id]", (els) => [...new Set(els.map((e) => Number(e.dataset.participantId)))].sort());
await sleep(5000);
const g1id = await g1.$eval('figure[aria-label*="(you)"]', (f) => Number(f.dataset.participantId));

// Kill the guest socket from the page (like a proxy that drops it).
{
  const t0 = Date.now();
  await g1.evaluate(() => window.__sockets.forEach((s) => s.close(4000, "qa")));
  const timeline = [];
  let back = false;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    const hostIds = await ids(host);
    const status = (await g1.locator("[role=status]").allInnerTexts()).join("|");
    timeline.push(`${Date.now() - t0}ms host=${hostIds.length} g1=${status.slice(0, 30)}`);
    const open = await g1.evaluate(() => window.__sockets.filter((s) => s.readyState === 1).length);
    if (open === 1 && hostIds.includes(g1id) && i > 2) {
      back = true;
      break;
    }
  }
  await sleep(4000);
  const probe = await mediaProbe(host, 2500);
  const selfId = await g1.$eval('figure[aria-label*="(you)"]', (f) => Number(f.dataset.participantId));
  check("realtime: guest socket killed -> guest reconnects with the same id; host still gets its video", back && selfId === g1id && probe.tiles.every((t) => t.videoWidth > 0), {
    back,
    sameId: selfId === g1id,
    hostTiles: probe.tiles.map((t) => `${t.label}:${t.videoWidth}`),
    timeline: timeline.slice(0, 12),
  });
}

// Offline for 5 s.
{
  const t0 = Date.now();
  await g2.context().setOffline(true);
  const seen = [];
  for (let i = 0; i < 10; i++) {
    await sleep(500);
    seen.push(`${Date.now() - t0}ms host=${(await ids(host)).length} g2=${(await g2.locator("[role=status]").allInnerTexts()).join("|").slice(0, 30)}`);
  }
  await g2.context().setOffline(false);
  let recovered = false;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    const body = await g2.locator("body").innerText();
    if ((await ids(host)).length === 3 && !body.includes("Reconnecting") && !body.includes("Connection lost")) {
      recovered = true;
      break;
    }
  }
  await sleep(5000);
  const probe = await mediaProbe(g2, 2500);
  const txt = (await g2.locator("body").innerText()).slice(0, 120);
  if (!recovered) await shot(g2, "bug-offline-recovery-1280.png");
  check("realtime: guest offline 5 s then online: room recovers (3 people, remote media flows)", recovered && probe.tiles.every((t) => t.videoWidth > 0) && probe.pcs.every((p) => p.audioBytesDelta > 0), {
    recovered,
    recoverMs: Date.now() - t0,
    duringOffline: seen,
    g2Text: txt,
    g2Tiles: probe.tiles.map((t) => `${t.label}:${t.videoWidth}`),
    pcs: probe.pcs,
  });
}

// Ghost: REST join, no socket. How long does the tile stay on the host?
{
  const ghost = (await guestJoin(rc, "Ghost guest")).body;
  const t0 = Date.now();
  let visibleAt = null;
  let goneAt = null;
  while (Date.now() - t0 < 150000) {
    const has = (await ids(host)).includes(ghost.participant.id);
    if (has && visibleAt === null) visibleAt = Date.now() - t0;
    if (!has && visibleAt !== null) {
      goneAt = Date.now() - t0;
      break;
    }
    await sleep(2000);
  }
  await shot(host, "bug-ghost-tile-1440.png");
  const listed = (await api("GET", `/api/meetings/${rc}/participants`, { cookie: T["1"] })).body.some((p) => p.id === ghost.participant.id);
  check("realtime: ghost (REST join, no socket) disappears from others within 150 s", goneAt !== null, {
    visibleAfterMs: visibleAt,
    goneAfterMs: goneAt,
    stillInApiListAt150s: listed,
  });
  // A late real joiner: does it get a PC to the ghost (it is in the list but not connected)?
  const g3 = await newPage(browser, { name: "rt-guest3" });
  await g3.goto(`${FE}/j/${rc}`);
  await g3.locator("#name").fill("RT Three");
  await g3.getByRole("button", { name: /^Join$/ }).click();
  await g3.waitForURL(/\/meeting\//, { waitUntil: "commit" });
  await joinFromPreview(g3);
  await sleep(6000);
  const t = await g3.$$eval("figure[data-participant-id]", (els) => els.map((e) => e.getAttribute("aria-label")));
  check("realtime: a late joiner also sees the ghost tile (no video forever)", !t.some((x) => x.startsWith("Ghost guest")), { tiles: t });
  await api("POST", `/api/meetings/${rc}/participants/${ghost.participant.id}/remove`, { cookie: T["1"] });
}

// Rapid join and leave 10 times (one guest context).
{
  const g4 = await newPage(browser, { name: "rt-churn" });
  const t0 = Date.now();
  for (let i = 0; i < 10; i++) {
    await g4.goto(`${FE}/j/${rc}`);
    await g4.locator("#name").fill(`Churn ${i}`);
    await g4.getByRole("button", { name: /^Join$/ }).click();
    await g4.waitForURL(/\/meeting\//, { waitUntil: "commit" });
    await joinFromPreview(g4);
    await g4.getByRole("button", { name: "Leave", exact: true }).click();
    await g4.getByRole("button", { name: "Leave Meeting" }).click();
    await g4.waitForURL(/\/join/, { waitUntil: "commit" });
  }
  await sleep(4000);
  const hostTiles = await host.$$eval("figure[data-participant-id]", (els) => els.map((e) => e.getAttribute("aria-label")));
  const hostPcs = await host.evaluate(() => (window.__pcs ?? []).filter((p) => p.connectionState !== "closed").length);
  const server = (await api("GET", `/api/meetings/${rc}/participants`, { cookie: T["1"] })).body.map((p) => p.display_name);
  const churnRows = (await api("GET", `/api/meetings/${rc}/participants`, { cookie: T["1"] })).body.filter((p) => p.display_name.startsWith("Churn")).length;
  const tracks = await g4.evaluate(() => (window.__streams ?? []).map((s) => s.getTracks().map((t) => t.readyState).join("/")));
  check("realtime: 10 fast join/leave cycles leave no extra tiles, no open PCs, no live tracks", !hostTiles.some((l) => l.startsWith("Churn")) && churnRows === 0 && hostPcs === 3 && tracks.every((t) => !t.includes("live")), {
    ms: Date.now() - t0,
    hostTiles,
    server,
    hostOpenPcs: hostPcs,
    guestStreams: tracks.length,
    liveStreams: tracks.filter((t) => t.includes("live")).length,
  });
}

await api("POST", `/api/meetings/${rc}/end`, { cookie: T["1"] });
save("t5_realtime", rows);
saveIssues("t5");
await browser.close();
