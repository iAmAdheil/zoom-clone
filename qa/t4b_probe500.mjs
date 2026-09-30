// Probe: non-host host-action calls through the Next.js proxy. Do they ever return 500?
import { FE, api, launch, newPage, pageFetch, recorder, save, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const alice = await newPage(browser, { name: "alice-probe", userId: 2 });
await alice.goto(`${FE}/join`);
const m = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA 500 probe" } })).body;
const g = (await api("POST", `/api/meetings/${m.meeting_code}/join`, { body: { display_name: "g" } })).body;
await api("POST", `/api/meetings/${m.meeting_code}/join`, { cookie: T["2"], body: { display_name: "Alice" } });
const statuses = { seq: [], parallel: [] };
for (let i = 0; i < 10; i++)
  statuses.seq.push((await pageFetch(alice, `/api/meetings/${m.meeting_code}/participants/${g.participant.id}/mute`, { method: "POST" })).status);
statuses.parallel = (
  await Promise.all(
    Array.from({ length: 40 }, (_, i) =>
      pageFetch(alice, `/api/meetings/${m.meeting_code}/${i % 2 ? "mute-all" : "end"}`, { method: "POST" }),
    ),
  )
).map((r) => r.status);
const hostPar = await Promise.all(
  Array.from({ length: 30 }, () => api("POST", `/api/meetings/${m.meeting_code}/participants/${g.participant.id}/mute`, { cookie: T["1"] })),
);
const count = (a) => a.reduce((o, s) => ((o[s] = (o[s] ?? 0) + 1), o), {});
const hostCounts = count(hostPar.map((r) => r.status));
const five = hostPar.find((r) => r.status >= 500);
check("probe: non-host calls give 403 only, and 30 parallel host mutes give no 5xx", !statuses.seq.some((s) => s >= 500) && !statuses.parallel.some((s) => s >= 500) && !five, {
  seq: count(statuses.seq),
  parallel: count(statuses.parallel),
  hostParallelMute: hostCounts,
  sample500: five ? five.body : null,
});
await api("POST", `/api/meetings/${m.meeting_code}/end`, { cookie: T["1"] });
save("t4b_probe500", rows);
await browser.close();
