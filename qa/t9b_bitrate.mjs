// Performance note: outbound video per peer connection with the default 720p fake camera.
// Run with QA_SMALL_VIDEO=0 so the fake camera is 1280x720.
import { FE, api, joinFromPreview, launch, newPage, recorder, save, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const m = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA bitrate" } })).body;
const host = await newPage(browser, { name: "br-host", userId: 1 });
await host.goto(`${FE}/meeting/${m.meeting_code}`);
await joinFromPreview(host);
const g = await newPage(browser, { name: "br-guest" });
await g.goto(`${FE}/meeting/${m.meeting_code}`);
await joinFromPreview(g, { name: "Bitrate guest" });
await sleep(15000);
const out = await host.evaluate(async () => {
  const read = async () => {
    const r = [];
    for (const pc of window.__pcs.filter((p) => p.connectionState === "connected"))
      (await pc.getStats()).forEach((s) => {
        if (s.type === "outbound-rtp" && s.kind === "video") r.push({ bytes: s.bytesSent, w: s.frameWidth, h: s.frameHeight, fps: s.framesPerSecond, limit: s.qualityLimitationReason });
      });
    return r;
  };
  const a = await read();
  await new Promise((r) => setTimeout(r, 5000));
  const b = await read();
  const params = window.__pcs
    .filter((p) => p.connectionState === "connected")
    .flatMap((p) => p.getSenders().filter((s) => s.track?.kind === "video").map((s) => s.getParameters().encodings));
  return b.map((x, i) => ({ kbps: Math.round(((x.bytes - a[i].bytes) * 8) / 5000), res: `${x.w}x${x.h}`, fps: x.fps, limit: x.limit, encodings: params[i] }));
});
check("perf: outbound video per peer (720p camera): no maxBitrate or resolution cap set (info)", null, { perPeer: out });
await api("POST", `/api/meetings/${m.meeting_code}/end`, { cookie: T["1"] });
save("t9b_bitrate", rows);
await browser.close();
