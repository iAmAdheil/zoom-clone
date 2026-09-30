// Matrix item 7 edge cases: permission denied, camera busy (simulated), two tabs with the camera.
import { FE, api, joinFromPreview, launch, mediaProbe, newPage, recorder, save, saveIssues, shot, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const fake = await launch();
// No --use-fake-ui-for-media-stream and no granted permission: the browser refuses getUserMedia.
const noPerm = await launch({ fakeUi: false });

const m = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA media edge" } })).body;
const host = await newPage(fake, { name: "edge-host", userId: 1 });
await host.goto(`${FE}/meeting/${m.meeting_code}`);
await joinFromPreview(host);

// Permission denied.
{
  const p = await newPage(noPerm, { name: "edge-denied", media: false });
  await p.goto(`${FE}/j/${m.meeting_code}`);
  await p.locator("#name").fill("Denied guest");
  await p.getByRole("button", { name: /^Join$/ }).click();
  await p.waitForURL(/\/meeting\//, { waitUntil: "commit" });
  await p.locator("#display-name").waitFor();
  await sleep(2500);
  const pre = await p.locator("body").innerText();
  const gumError = await p.evaluate(() => navigator.mediaDevices.getUserMedia({ video: true }).then(() => "granted", (e) => e.name));
  const buttons = await p.$$eval("form button[aria-pressed]", (els) => els.map((b) => ({ t: b.textContent.trim(), disabled: b.disabled })));
  await shot(p, "prejoin-permission-denied-1280.png");
  check("media: permission denied: pre-join says so and disables the mic/camera toggles", /blocked/i.test(pre) && buttons.every((b) => b.disabled), {
    getUserMedia: gumError,
    message: pre.match(/.*blocked.*/i)?.[0],
    buttons,
  });
  await joinFromPreview(p);
  await sleep(6000);
  const probe = await mediaProbe(p, 3000);
  const hostSees = await host.$$eval("figure[data-participant-id]", (els) => els.map((e) => e.getAttribute("aria-label")));
  check("media: a no-media guest still sees and hears the host; host sees the guest as muted + video off", probe.tiles.length === 1 && probe.tiles[0].videoWidth > 0 && probe.pcs[0]?.audioBytesDelta > 0 && hostSees.some((l) => l.startsWith("Denied guest") && l.includes("muted") && l.includes("video off")), {
    guestSees: probe.tiles,
    guestPcs: probe.pcs,
    hostSees,
  });
  // The toolbar Unmute on a no-media guest.
  await p.getByRole("toolbar", { name: "Meeting controls" }).getByRole("button", { name: "Unmute", exact: true }).click();
  await sleep(600);
  const toast = (await p.locator("[role=status]").allInnerTexts()).join(" ");
  check("media: Unmute without a microphone says 'No microphone is available'", /No microphone/.test(toast), { toast });
  await shot(p, "room-no-media-guest-1280.png");
  await p.context().close();
}

// Camera busy (simulated: getUserMedia throws NotReadableError for video).
{
  const p = await newPage(fake, { name: "edge-busy" });
  await p.addInitScript(() => {
    const md = navigator.mediaDevices;
    const orig = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => {
      if (c && c.video) throw new DOMException("Could not start video source", "NotReadableError");
      return orig(c);
    };
  });
  await p.goto(`${FE}/meeting/${m.meeting_code}`);
  await p.locator("#display-name").waitFor();
  await sleep(2500);
  const pre = await p.locator("body").innerText();
  const tracks = await p.evaluate(() => (window.__streams ?? []).flatMap((s) => s.getTracks().map((t) => t.kind)));
  await shot(p, "prejoin-camera-busy-1280.png");
  check("media: camera busy (NotReadableError on video): falls back to microphone only with a message", /No camera is available|microphone only/i.test(pre) && tracks.includes("audio"), {
    message: pre.match(/.*(camera|microphone).*/i)?.[0],
    tracks,
  });
  await p.context().close();
}

// Same browser profile, two tabs, both open the (fake) camera.
{
  const p = await newPage(fake, { name: "edge-tab1" });
  const p2 = await p.context().newPage();
  await p.goto(`${FE}/meeting/${m.meeting_code}`);
  await p2.goto(`${FE}/meeting/${m.meeting_code}`);
  await sleep(3000);
  const a = await p.locator("body").innerText();
  const b = await p2.locator("body").innerText();
  check("media: camera used by another tab (fake device): both tabs get a preview (real devices not testable here)", !/blocked|Another app/.test(a + b), {
    tab1Error: a.match(/.*(blocked|Another app).*/)?.[0] ?? null,
    tab2Error: b.match(/.*(blocked|Another app).*/)?.[0] ?? null,
  });
  await p.context().close();
}

await api("POST", `/api/meetings/${m.meeting_code}/end`, { cookie: T["1"] });
save("t4c_media_edge", rows);
saveIssues("t4c");
await fake.close();
await noPerm.close();
