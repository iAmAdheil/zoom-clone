// Burst probe: 200 parallel POST /api/auth/demo, with /api/health probed during the burst.
// WARNING: this freezes the backend for about 90 seconds. Run it once, when nobody uses the app.
import { BE, api, recorder, save, sleep } from "./lib.mjs";

const { rows, check } = recorder();
const N = Number(process.env.N ?? 200);
const health = [];
let done = false;
const prober = (async () => {
  while (!done) {
    const t = Date.now();
    let s;
    try {
      s = (await fetch(`${BE}/api/health`, { signal: AbortSignal.timeout(15000) })).status;
    } catch {
      s = "timeout";
    }
    health.push({ at: t, status: s, ms: Date.now() - t });
    await sleep(2000);
  }
})();
const t0 = Date.now();
const rs = await Promise.all(Array.from({ length: N }, () => api("POST", "/api/auth/demo").catch((e) => ({ status: `ERR ${e.cause?.code ?? e}` }))));
const ms = Date.now() - t0;
done = true;
await prober;
const counts = rs.reduce((o, r) => ((o[r.status] = (o[r.status] ?? 0) + 1), o), {});
const bad = rs.find((r) => r.status !== 200);
const slowHealth = health.filter((h) => h.status !== 200 || h.ms > 2000);
check(`burst: ${N} parallel demo logins all succeed and /api/health stays fast`, !bad && slowHealth.length === 0, {
  counts,
  totalMs: ms,
  sample: bad ? { status: bad.status, body: bad.body } : null,
  healthProbes: health.length,
  healthSlowOrFailed: slowHealth.map((h) => `${h.status} ${h.ms}ms`),
});
save("t6b_burst", rows);
