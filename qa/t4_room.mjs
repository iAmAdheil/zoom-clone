// Matrix items 5 (XSS names in the room), 6 (room with 5 contexts) and 7 (media).
// Host = demo user (1), Alice (2), guest 1, guest 2 (XSS name), phone guest, then Bob (3) joins late.
import {
  FE,
  api,
  joinFromPreview,
  launch,
  mediaProbe,
  newPage,
  pageFetch,
  recorder,
  save,
  saveIssues,
  shot,
  sleep,
  tokens,
} from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const XSS = `<script>alert(1)</script><img src=x onerror=alert(2)>`;
const dialogs = [];

async function step(name, fn) {
  try {
    await fn();
  } catch (e) {
    check(`${name} (step crashed)`, false, { error: String(e).slice(0, 400) });
    for (const [n, p] of Object.entries(all)) await shot(p, `crash-${name.replace(/\W+/g, "-")}-${n}.png`);
  }
  save("t4_room", { rows });
}

const tb = (page) => page.getByRole("toolbar", { name: "Meeting controls" });
const tbButton = (page, name) => tb(page).getByRole("button", { name, exact: true });

async function ids(page) {
  const list = await page.$$eval("figure[data-participant-id]", (els) => els.map((e) => Number(e.dataset.participantId)));
  return [...new Set(list)].sort((a, b) => a - b);
}
async function labels(page) {
  return page.$$eval("figure[data-participant-id]", (els) =>
    Object.fromEntries(els.map((e) => [e.dataset.participantId, e.getAttribute("aria-label")])),
  );
}
async function until(fn, ms = 10000, every = 250) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(every);
  }
  return last;
}
async function serverList(code) {
  return (await api("GET", `/api/meetings/${code}/participants`, { cookie: T["1"] })).body;
}
async function openPanel(page) {
  if ((await page.locator('aside[aria-label^="Participants"]').count()) === 0)
    await tbButton(page, /Participants$/).click();
  await page.locator('aside[aria-label^="Participants"]').waitFor();
}
async function closePanels(page) {
  for (const n of ["Participants", "Meeting Chat"]) {
    const b = page.locator(`aside[aria-label^="${n}"] button[aria-label^="Close"]`);
    if (await b.count()) await b.click();
  }
}
async function rowAction(page, text, action) {
  await openPanel(page);
  const row = page.locator('aside[aria-label^="Participants"] li', { hasText: text }).first();
  await row.hover();
  await row.getByRole("button", { name: action, exact: true }).click();
}
/** Inbound audio bytes from one remote participant, measured over `ms` on `page`. */
async function inboundAudioFrom(page, pid, ms = 3000) {
  return page.evaluate(
    async ([pid, ms]) => {
      const el = document.querySelector(`audio[data-participant-id="${pid}"]`);
      const track = el?.srcObject?.getAudioTracks()[0];
      if (!track) return { error: "no audio element or track" };
      const pc = (window.__pcs ?? []).find(
        (p) => p.connectionState !== "closed" && p.getReceivers().some((r) => r.track === track),
      );
      if (!pc) return { error: "no pc for track" };
      const read = async () => {
        let b = 0;
        (await pc.getStats(track)).forEach((s) => {
          if (s.type === "inbound-rtp" && s.kind === "audio") b += s.bytesReceived ?? 0;
        });
        return b;
      };
      const a = await read();
      await new Promise((r) => setTimeout(r, ms));
      return { delta: (await read()) - a };
    },
    [pid, ms],
  );
}
async function outbound(page, ms = 3000) {
  return page.evaluate(async (ms) => {
    const read = async () => {
      let audio = 0;
      let video = 0;
      for (const pc of window.__pcs ?? []) {
        if (pc.connectionState === "closed") continue;
        (await pc.getStats()).forEach((s) => {
          if (s.type === "outbound-rtp" && s.kind === "audio") audio += s.bytesSent ?? 0;
          if (s.type === "outbound-rtp" && s.kind === "video") video += s.framesSent ?? 0;
        });
      }
      return { audio, video };
    };
    const a = await read();
    await new Promise((r) => setTimeout(r, ms));
    const b = await read();
    return { audioBytes: b.audio - a.audio, videoFrames: b.video - a.video };
  }, ms);
}
function summarize(probe) {
  return {
    remoteTiles: probe.tiles.length,
    videosWithSize: probe.tiles.filter((t) => t.videoWidth > 0).length,
    videosMoving: probe.tiles.filter((t) => (t.pixelDiff ?? 0) > 0).length,
    pcsConnected: probe.pcs.filter((p) => p.state === "connected").length,
    pcsWithAudioGrowth: probe.pcs.filter((p) => p.audioBytesDelta > 0).length,
    pcsWithVideoFrames: probe.pcs.filter((p) => p.videoFramesDelta > 0).length,
    audioElements: probe.audios.length,
    audioPaused: probe.audios.filter((a) => a.paused).length,
    detail: probe.tiles.map((t) => `${t.videoWidth}x${t.videoHeight} diff=${t.pixelDiff}`),
  };
}

// ---------------- setup ----------------
const host = await newPage(browser, { name: "host", userId: 1, viewport: { width: 1440, height: 900 } });
const alice = await newPage(browser, { name: "alice", userId: 2 });
const g1 = await newPage(browser, { name: "guest1" });
const g2 = await newPage(browser, { name: "guest2-xss" });
const phone = await newPage(browser, { name: "phone", phone: true });
const all = { host, alice, g1, g2, phone };
for (const [n, p] of Object.entries(all)) p.on("dialog", (d) => { dialogs.push({ ctx: n, msg: d.message() }); d.dismiss(); });

await host.goto(`${FE}/`);
const created = await pageFetch(host, "/api/meetings/instant", { method: "POST", body: JSON.stringify({ title: "QA room" }) });
const code = created.body.meeting_code;
console.log("meeting", code);
await host.goto(`${FE}/meeting/${code}`);
await joinFromPreview(host);

async function guestJoin(page, name) {
  await page.goto(`${FE}/j/${code}`);
  if (name !== null) await page.locator("#name").fill(name);
  // A signed-in user: wait for /api/me to fill the name (see bug: an early click says "Enter your name").
  else await page.waitForFunction(() => document.querySelector("#name")?.value.trim().length > 0);
  await page.getByRole("button", { name: /^Join$/ }).click();
  await page.waitForURL(new RegExp(`/meeting/${code}`), { waitUntil: "commit" });
  await joinFromPreview(page);
}
await guestJoin(alice, null); // Alice keeps her account name.
await guestJoin(g1, "Guest One");
await guestJoin(g2, XSS);
await until(async () => (await ids(host)).length === 4);
await sleep(4000);
await shot(host, "room-4tiles-1440.png");
await guestJoin(phone, "Phone Guest");

// ---------------- 6a. everyone sees the same list ----------------
await step("room: all 5 see the same participant ids", async () => {
  await until(async () => {
    const lists = await Promise.all(Object.values(all).map(ids));
    return lists.every((l) => l.length === 5);
  }, 15000);
  const lists = Object.fromEntries(await Promise.all(Object.entries(all).map(async ([n, p]) => [n, await ids(p)])));
  const server = (await serverList(code)).map((p) => p.id).sort((a, b) => a - b);
  const same = Object.values(lists).every((l) => JSON.stringify(l) === JSON.stringify(server));
  check("room: all 5 contexts show the same 5 participant ids as the server", same, { server, ...lists });
});

// ---------------- 7a. media between every pair ----------------
await sleep(5000);
const probes = {};
await step("media: 5-way mesh", async () => {
  for (const [n, p] of Object.entries(all)) probes[n] = summarize(await mediaProbe(p, 3000));
  const ok = Object.values(probes).every(
    (s) => s.remoteTiles === 4 && s.videosWithSize === 4 && s.videosMoving === 4 && s.pcsConnected === 4 && s.pcsWithAudioGrowth === 4,
  );
  check("media: each of 5 contexts has 4 remote videos (videoWidth>0, pixels change) and 4 connected PCs with inbound audio growth", ok, probes);
});
await shot(host, "room-5tiles-1440.png");
await shot(phone, "room-5tiles-390.png");

// ---------------- 5. XSS in display name ----------------
await step("xss", async () => {
  await openPanel(host);
  const panelText = await host.locator('aside[aria-label^="Participants"]').innerText();
  const tileText = await host.locator("figure[data-participant-id]").allInnerTexts();
  const injected = await host.evaluate(() => document.querySelectorAll("figure img[src='x'], aside img[src='x']").length);
  check("xss: <script>/<img onerror> name renders as text in panel and tiles, no dialog fired", dialogs.length === 0 && injected === 0 && panelText.includes("<script>alert(1)</script>") && tileText.join("").includes("<script>"), {
    dialogs,
    injectedImgs: injected,
  });
  await shot(host, "room-participants-panel-1440.png");
});

// ---------------- 6b. roles, host controls, 403 ----------------
await step("roles", async () => {
  const list = await serverList(code);
  check("room: API role values", true, { roles: list.map((p) => `${p.display_name.slice(0, 20)}=${p.role}`) });
  check("room: no co_host role in use and no UI to make one", !list.some((p) => p.role === "co_host"), {});
});
await step("non-host UI", async () => {
  await openPanel(alice);
  const muteAll = await alice.getByRole("button", { name: "Mute All" }).count();
  const row = alice.locator('aside[aria-label^="Participants"] li', { hasText: "Guest One" }).first();
  await row.hover();
  const rowBtns = await row.getByRole("button").count();
  const endBtn = await tb(alice).getByRole("button", { name: "End", exact: true }).count();
  check("room: non-host sees no Mute All, no row Mute/Remove, no End", muteAll === 0 && rowBtns === 0 && endBtn === 0, { muteAll, rowBtns, endBtn });
  await shot(alice, "room-participants-panel-nonhost-1280.png");
  await closePanels(alice);
});
const list0 = await serverList(code);
const pid = (name) => list0.find((p) => p.display_name === name)?.id;
const hostPid = list0.find((p) => p.role === "host").id;
await step("403", async () => {
  const meetingId = created.body.id;
  const calls = [
    ["POST", `/api/meetings/${code}/participants/${pid("Guest One")}/mute`],
    ["POST", `/api/meetings/${code}/mute-all`],
    ["POST", `/api/meetings/${code}/participants/${pid("Guest One")}/remove`],
    ["POST", `/api/meetings/${code}/end`],
    ["PATCH", `/api/meetings/${meetingId}`, JSON.stringify({ title: "hacked" })],
    ["DELETE", `/api/meetings/${meetingId}`],
  ];
  const res = {};
  for (const [m, u, b] of calls) {
    res[`alice ${m} ${u.replace(code, "{code}")}`] = (await pageFetch(alice, u, { method: m, body: b })).status;
    res[`guest ${m} ${u.replace(code, "{code}")}`] = (await pageFetch(g1, u, { method: m, body: b })).status;
  }
  const ok = Object.entries(res).every(([k, s]) => (k.startsWith("alice") ? s === 403 : s === 401));
  check("room: non-host (Alice) gets 403 and guest gets 401 on mute, mute-all, remove, end, patch, delete", ok, res);
});

// ---------------- 6c/7b. self mute and video ----------------
await step("self mute", async () => {
  const g1id = pid("Guest One");
  const before = await inboundAudioFrom(host, g1id, 2500);
  await tbButton(g1, "Mute").click();
  const seen = await until(async () => {
    const ls = await Promise.all([host, alice, g2, phone].map(labels));
    return ls.every((l) => (l[g1id] ?? "").includes("muted"));
  }, 12000);
  await sleep(1000);
  const out = await outbound(g1, 3000);
  const after = await inboundAudioFrom(host, g1id, 3000);
  const seenLabels = await Promise.all([host, alice, g2, phone].map(async (p) => (await labels(p))[g1id]));
  check("media: self mute shows the muted icon on the 4 others", !!seen, { g1id, seenLabels });
  check("media: self mute stops the audio for real (sender bytes 0, host inbound from guest ~0)", out.audioBytes === 0 && (after.delta ?? 1) === 0, {
    hostInboundBeforeMute: before,
    senderOutAudioBytesWhileMuted: out.audioBytes,
    hostInboundWhileMuted: after,
  });
  await tbButton(g1, "Unmute").click();
  await sleep(1500);
  const back = await inboundAudioFrom(host, g1id, 2500);
  check("media: unmute brings audio back", (back.delta ?? 0) > 0, { hostInboundAfterUnmute: back });
});
await step("video off", async () => {
  const g1id = pid("Guest One");
  await tbButton(g1, "Stop Video").click();
  const seen = await until(async () => {
    const r = await host.$eval(`figure[data-participant-id="${g1id}"]`, (f) => ({ label: f.getAttribute("aria-label"), video: !!f.querySelector("video") }));
    return r.label.includes("video off") && !r.video ? r : null;
  }, 5000);
  await sleep(800);
  const out = await outbound(g1, 2500);
  check("media: video off shows the avatar on others and stops sending frames", !!seen && out.videoFrames === 0, { hostTile: seen, senderFrames: out.videoFrames });
  await shot(host, "room-video-off-1440.png");
  await tbButton(g1, "Start Video").click();
  const back = await until(async () =>
    host.$eval(`figure[data-participant-id="${g1id}"] video`, (v) => (v.videoWidth > 0 ? v.videoWidth : 0)).catch(() => 0),
  8000);
  check("media: video on again shows the picture on others", back > 0, { videoWidth: back });
});

// ---------------- 6d. host mute one ----------------
await step("host mute one", async () => {
  const g1id = pid("Guest One");
  const resp = host.waitForResponse((r) => r.url().includes("/mute"), { timeout: 45000 });
  await rowAction(host, "Guest One", "Mute");
  const muteResp = await resp;
  const muteReq = { url: muteResp.url().replace(/.*\/api/, "/api"), status: muteResp.status() };
  const toast = await until(async () => (await g1.locator("[role=status]").allInnerTexts()).join(" ").includes("host muted you"), 10000);
  const btn = await tbButton(g1, "Unmute").count();
  await sleep(800);
  const out = await outbound(g1, 2500);
  const others = await Promise.all([alice, g2, phone].map(async (p) => (await labels(p))[g1id]));
  check("room: host mutes one guest; guest sees toast + Unmute button; audio stops; others see muted", !!toast && btn === 1 && out.audioBytes === 0 && others.every((l) => l.includes("muted")), {
    muteReq,
    toast: !!toast,
    unmuteButton: btn,
    senderAudioBytes: out.audioBytes,
    others,
  });
  await tbButton(g1, "Unmute").click();
});

// ---------------- 7c. rapid mute toggling ----------------
await step("rapid mute x20", async () => {
  const g2id = pid(XSS);
  const first = tb(g2).getByRole("button").first();
  for (let i = 0; i < 20; i++) await first.click({ delay: 0 });
  await sleep(3000);
  const local = await first.innerText();
  const server = (await serverList(code)).find((p) => p.id === g2id);
  const hostLabel = (await labels(host))[g2id];
  const out = await outbound(g2, 2500);
  const ok = !server.is_muted && !hostLabel.includes("muted") && /Mute/.test(local) && !/Unmute/.test(local) && out.audioBytes > 0;
  check("media: 20 fast mute clicks end unmuted everywhere (UI, server, others, audio)", ok, {
    localButton: local,
    serverMuted: server.is_muted,
    hostLabel,
    senderAudioBytes: out.audioBytes,
  });
});

// ---------------- 6e. mute all ----------------
await step("mute all", async () => {
  await openPanel(host);
  await host.getByRole("button", { name: "Mute All" }).click();
  const resp = host.waitForResponse((r) => r.url().includes("/mute-all"), { timeout: 45000 });
  await host.getByRole("dialog").getByRole("button", { name: "Yes" }).click();
  const r = await resp;
  const muteAllResp = { status: r.status(), body: await r.json().catch(() => null) };
  await sleep(2000);
  const server = await serverList(code);
  const hostRow = server.find((p) => p.role === "host");
  const attendees = server.filter((p) => p.role !== "host");
  const phoneOut = await outbound(phone, 2500);
  const phoneLabel = await tbButton(phone, "Unmute").count();
  check("room: mute all mutes every attendee (server + phone UI + phone audio), host stays unmuted", attendees.every((p) => p.is_muted) && !hostRow.is_muted && phoneLabel === 1 && phoneOut.audioBytes === 0, {
    muteAllResp: { status: muteAllResp.status, muted: Array.isArray(muteAllResp.body) ? muteAllResp.body.map((p) => p.id) : muteAllResp.body },
    server: server.map((p) => `${p.id}:${p.is_muted}`),
    phoneUnmuteButton: phoneLabel,
    phoneAudioBytes: phoneOut.audioBytes,
  });
  await closePanels(host);
  for (const p of [alice, g1, g2, phone]) if (await tbButton(p, "Unmute").count()) await tbButton(p, "Unmute").click();
});

// ---------------- 6f. reload (no duplicate) ----------------
await step("reload", async () => {
  const g1id = pid("Guest One");
  await g1.reload({ waitUntil: "domcontentloaded" });
  await joinFromPreview(g1);
  await sleep(4000);
  const hostIds = await ids(host);
  const g1ids = await ids(g1);
  const selfId = await g1.$eval('figure[aria-label*="(you)"]', (f) => Number(f.dataset.participantId));
  check("room: guest reload rejoins with the same id and no duplicate tile", selfId === g1id && hostIds.length === 5 && g1ids.length === 5, {
    before: g1id,
    after: selfId,
    hostIds,
    g1ids,
  });
  const probe = summarize(await mediaProbe(g1, 2500));
  check("media: after reload the guest gets 4 remote videos again", probe.videosWithSize === 4 && probe.pcsWithAudioGrowth === 4, probe);
});

// ---------------- 7d. late joiner, 6 people ----------------
const bob = await newPage(browser, { name: "bob-late", userId: 3 });
bob.on("dialog", (d) => { dialogs.push({ ctx: "bob", msg: d.message() }); d.dismiss(); });
all.bob = bob;
await step("late joiner", async () => {
  await guestJoin(bob, null);
  await until(async () => (await Promise.all(Object.values(all).map(ids))).every((l) => l.length === 6), 15000);
  await sleep(6000);
  const pb = summarize(await mediaProbe(bob, 3000));
  const ph = summarize(await mediaProbe(host, 3000));
  const pp = summarize(await mediaProbe(phone, 3000));
  check("media: late joiner (6th) gets 5 remote videos + audio; host and phone get 5", [pb, ph, pp].every((s) => s.videosWithSize === 5 && s.videosMoving === 5 && s.pcsWithAudioGrowth === 5), { bob: pb, host: ph, phone: pp });
  await shot(host, "room-6tiles-1440.png");
  await shot(phone, "room-6tiles-390.png");
  await host.setViewportSize({ width: 834, height: 1112 });
  await sleep(800);
  await shot(host, "room-6tiles-834.png");
  await host.setViewportSize({ width: 1440, height: 900 });
});

// ---------------- chat, invite, panels ----------------
await step("chat", async () => {
  await tbButton(host, "Chat").click();
  await host.getByLabel("Message to everyone").fill("hello from host <b>x</b>");
  await host.keyboard.press("Enter");
  await sleep(1000);
  await shot(host, "room-chat-panel-1440.png");
  await tbButton(alice, "Chat").click();
  await sleep(500);
  const aliceChat = await alice.locator('aside[aria-label="Meeting Chat"]').innerText();
  check("chat: a message from the host reaches other participants", aliceChat.includes("hello from host"), { aliceChat: aliceChat.slice(0, 200) });
  await closePanels(host);
  await closePanels(alice);
});
await step("invite popover", async () => {
  await openPanel(host);
  await host.locator('aside[aria-label^="Participants"]').getByRole("button", { name: "Invite" }).click();
  await sleep(400);
  const t = await host.getByRole("dialog", { name: "Invite" }).innerText();
  check("room: invite popover shows 3-4-3 ID and link", t.includes(`${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`) && t.includes(`/j/${code}`), { text: t.slice(0, 200) });
  await shot(host, "room-invite-popover-1440.png");
  await host.keyboard.press("Escape");
  await closePanels(host);
  await openPanel(phone);
  await shot(phone, "room-participants-panel-390.png");
  await closePanels(phone);
  await tbButton(phone, "Chat").click();
  await shot(phone, "room-chat-panel-390.png");
  await closePanels(phone);
});

// ---------------- 6g. host remove ----------------
await step("remove", async () => {
  const g2id = pid(XSS);
  await rowAction(host, "<script>", "Remove");
  await host.getByRole("dialog").getByRole("button", { name: "Remove" }).click();
  const removed = await until(async () => (await g2.locator("body").innerText()).includes("You were removed"), 6000);
  await shot(g2, "room-removed-1280.png");
  const hostIds = await until(async () => { const l = await ids(host); return l.includes(g2id) ? null : l; }, 5000);
  check("room: removed guest sees the removed page and leaves every list", !!removed && !!hostIds, { hostIds });
  const tracks = await g2.evaluate(() => (window.__streams ?? []).flatMap((s) => s.getTracks().map((t) => t.readyState)));
  check("media: removed guest's camera and mic are released", tracks.every((s) => s === "ended"), { tracks });

  // Same tab tries again (rejoin token in sessionStorage).
  await g2.goto(`${FE}/j/${code}`);
  await g2.locator("#name").fill("Back again");
  await g2.getByRole("button", { name: /^Join$/ }).click();
  await sleep(2000);
  const txt = await g2.locator("body").innerText();
  check("room: removed guest cannot rejoin from the same tab", !g2.url().includes("/meeting/") || /removed/i.test(txt), { url: g2.url(), msg: txt.match(/.*removed.*/i)?.[0] });

  // A fresh join without the token (new browser, or cleared storage).
  const fresh = await api("POST", `/api/meetings/${code}/join`, { body: { display_name: "Removed guest again" } });
  check("room: removed guest can come back with a fresh join (no token): expected blocked", fresh.status === 403, {
    status: fresh.status,
    newParticipantId: fresh.body?.participant?.id,
    oldParticipantId: g2id,
  });
  // The fresh join never opens a socket: it is a ghost now. Remove it again to clean up.
  if (fresh.status === 200) {
    await sleep(1500);
    const ghostOnHost = (await ids(host)).includes(fresh.body.participant.id);
    check("realtime: REST join without socket shows a ghost tile to others", !ghostOnHost, { ghostVisibleOnHost: ghostOnHost });
    await shot(host, "bug-ghost-tile-1440.png");
    await api("POST", `/api/meetings/${code}/participants/${fresh.body.participant.id}/remove`, { cookie: T["1"] });
  }
});

// ---------------- 6h. guest leave (phone) + camera release ----------------
await step("guest leave", async () => {
  const phoneId = await phone.$eval('figure[aria-label*="(you)"]', (f) => Number(f.dataset.participantId));
  await phone.getByRole("button", { name: "Leave", exact: true }).click();
  await phone.getByRole("button", { name: "Leave Meeting" }).click();
  await phone.waitForURL(/\/join/);
  const gone = await until(async () => !(await ids(host)).includes(phoneId), 5000);
  const tracks = await phone.evaluate(() => (window.__streams ?? []).flatMap((s) => s.getTracks().map((t) => t.readyState)));
  const pcs = await phone.evaluate(() => (window.__pcs ?? []).map((p) => p.connectionState));
  check("room: guest leave removes the tile for others; lands on /join", !!gone, { url: phone.url() });
  check("media: leaving releases the camera and mic (all tracks ended) and closes PCs", tracks.every((s) => s === "ended") && pcs.every((s) => s === "closed"), { tracks, pcs });
});

// ---------------- 6i. host leaves without ending ----------------
await step("host leave without end", async () => {
  await tb(host).getByRole("button", { name: "End", exact: true }).click();
  await host.getByRole("button", { name: "Leave Meeting" }).click();
  await host.waitForURL(`${FE}/`);
  await sleep(2000);
  const look = await api("GET", `/api/meetings/${code}`);
  const aliceIds = await ids(alice);
  check("room: host leaves without ending: meeting stays live, others stay", look.body.status === "live" && aliceIds.length === 3, { status: look.body.status, aliceIds });
  await shot(alice, "room-host-left-1280.png");
  // Host comes back through the dashboard link.
  await host.goto(`${FE}/meeting/${code}`);
  await joinFromPreview(host);
  await until(async () => (await ids(alice)).length === 4, 8000);
});

// ---------------- 6j. host ends for all ----------------
await step("end for all", async () => {
  await tb(host).getByRole("button", { name: "End", exact: true }).click();
  await host.getByRole("button", { name: "End Meeting for All" }).click();
  const seen = {};
  for (const [n, p] of Object.entries({ alice, g1, bob })) {
    seen[n] = !!(await until(async () => /Meeting ended|has ended/.test(await p.locator("body").innerText()), 6000));
  }
  const hostText = await host.locator("body").innerText();
  const look = await api("GET", `/api/meetings/${code}`);
  check("room: host End for All: every participant sees Meeting ended; API status ended", Object.values(seen).every(Boolean) && look.body.status === "ended", { seen, hostSees: hostText.slice(0, 80), status: look.body.status });
  await shot(g1, "room-ended-1280.png");
  const tracks = await g1.evaluate(() => (window.__streams ?? []).flatMap((s) => s.getTracks().map((t) => t.readyState)));
  check("media: meeting end releases the guest camera and mic", tracks.every((s) => s === "ended"), { tracks });
});

check("xss: no alert() fired in any context during the whole run", dialogs.length === 0, { dialogs });
save("t4_room", { code, rows });
saveIssues("t4");
await browser.close();
