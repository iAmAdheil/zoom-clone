// Matrix items 13 (performance sanity) and 14 (database checks, read only).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { FE, launch, newPage, recorder, save, sleep } from "./lib.mjs";

const { rows, check } = recorder();
const APP = process.env.QA_APP_DIR ?? "/Users/abhishekgupta/zoom-clone";
const DB = process.env.QA_DB ?? path.join(APP, "backend/zoom.db");
const sql = (q) => execFileSync("sqlite3", ["-readonly", "-json", DB, q], { encoding: "utf8" }).trim();
const rowsOf = (q) => {
  const t = sql(q);
  return t ? JSON.parse(t) : [];
};

// ---------- 13. performance ----------
{
  const browser = await launch();
  const p = await newPage(browser, { name: "perf", userId: 1, viewport: { width: 1440, height: 900 } });
  const runs = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await p.goto(`${FE}/`, { waitUntil: "load" });
    await p.getByRole("heading", { name: "Upcoming" }).waitFor();
    await p.waitForFunction(() => !document.body.innerText.includes("Loading meetings..."));
    const nav = await p.evaluate(() => {
      const n = performance.getEntriesByType("navigation")[0];
      const res = performance.getEntriesByType("resource");
      const js = res.filter((r) => r.name.endsWith(".js"));
      return {
        ttfb: Math.round(n.responseStart),
        domContentLoaded: Math.round(n.domContentLoadedEventEnd),
        load: Math.round(n.loadEventEnd),
        jsFiles: js.length,
        jsBytes: js.reduce((a, r) => a + (r.encodedBodySize || 0), 0),
        apiCalls: res.filter((r) => r.name.includes("/api/")).map((r) => `${new URL(r.name).pathname} ${Math.round(r.duration)}ms`),
      };
    });
    runs.push({ listsReadyMs: Date.now() - t0, ...nav });
  }
  check("perf: dashboard is usable (lists loaded) in under 2 s on localhost", runs.every((r) => r.listsReadyMs < 2000), { runs });
  await browser.close();

  const chunks = path.join(APP, "frontend/.next/static/chunks");
  if (fs.existsSync(chunks)) {
    const files = [];
    const walk = (d) => {
      for (const f of fs.readdirSync(d)) {
        const full = path.join(d, f);
        if (fs.statSync(full).isDirectory()) walk(full);
        else if (f.endsWith(".js")) files.push({ f: path.relative(chunks, full), kb: Math.round(fs.statSync(full).size / 1024) });
      }
    };
    walk(chunks);
    files.sort((a, b) => b.kb - a.kb);
    const total = files.reduce((a, x) => a + x.kb, 0);
    check("perf: no single JS chunk over 300 KB (uncompressed) in .next/static/chunks", files[0].kb < 300, { totalKb: total, count: files.length, largest: files.slice(0, 6) });
  }
}

// ---------- 14. data ----------
{
  const fks = sql("PRAGMA foreign_key_list(participants);") + sql("PRAGMA foreign_key_list(meetings);");
  const idx = rowsOf("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index';");
  check("data: foreign keys exist (meetings.host_id, participants.meeting_id, participants.user_id)", /meetings/.test(fks) && /users/.test(fks), {
    participantsFk: rowsOf("PRAGMA foreign_key_list(participants);").map((r) => `${r.from}->${r.table}.${r.to} on_delete=${r.on_delete}`),
    meetingsFk: rowsOf("PRAGMA foreign_key_list(meetings);").map((r) => `${r.from}->${r.table}.${r.to} on_delete=${r.on_delete}`),
  });
  const fkErrors = rowsOf("PRAGMA foreign_key_check;");
  check("data: PRAGMA foreign_key_check finds no broken references", fkErrors.length === 0, { fkErrors: fkErrors.slice(0, 5) });
  const hasUserIdx = idx.some((i) => i.tbl_name === "participants" && /user_id/.test(i.sql ?? ""));
  check("data: indexes: meeting_code unique, (host_id, scheduled_start), participants.meeting_id; participants.user_id has none", hasUserIdx, {
    indexes: idx.map((i) => `${i.tbl_name}.${i.name}`),
  });
  const endedNoAt = rowsOf("SELECT id, meeting_code, title FROM meetings WHERE status='ended' AND ended_at IS NULL;");
  check("data: every ended meeting has ended_at", endedNoAt.length === 0, { count: endedNoAt.length, sample: endedNoAt.slice(0, 5) });
  const endedOpen = rowsOf("SELECT m.id, count(*) n FROM participants p JOIN meetings m ON m.id=p.meeting_id WHERE m.status='ended' AND p.left_at IS NULL GROUP BY m.id;");
  check("data: no open participant rows (left_at NULL) in ended meetings", endedOpen.length === 0, { meetings: endedOpen.slice(0, 5) });
  const orphans = rowsOf("SELECT p.id, p.meeting_id FROM participants p LEFT JOIN meetings m ON m.id=p.meeting_id WHERE m.id IS NULL;");
  check("data: no orphan participant rows after cancels (meeting deleted)", orphans.length === 0, { orphans: orphans.slice(0, 5) });
  const removedOpen = rowsOf("SELECT id, meeting_id FROM participants WHERE removed=1 AND left_at IS NULL;");
  check("data: every removed participant has left_at", removedOpen.length === 0, { removedOpen });
  const liveStale = rowsOf(
    "SELECT m.id, m.meeting_code, m.title, m.started_at, (SELECT count(*) FROM participants p WHERE p.meeting_id=m.id AND p.left_at IS NULL AND p.removed=0) AS open_rows FROM meetings m WHERE m.status='live' ORDER BY m.started_at;",
  );
  check("data: live meetings that nobody ends (host left without ending, no auto-end) (info)", null, { liveCount: liveStale.length, sample: liveStale.slice(0, 8) });
  const ghosts = rowsOf("SELECT count(*) n FROM participants p JOIN meetings m ON m.id=p.meeting_id WHERE m.status='live' AND p.left_at IS NULL AND p.removed=0;");
  check("data: open participant rows in live meetings right now (includes REST-only ghosts) (info)", null, ghosts[0]);
  const enums = rowsOf("SELECT DISTINCT status, type, access FROM meetings;");
  const roles = rowsOf("SELECT role, count(*) n FROM participants GROUP BY role;");
  check("data: enum values in use (no co_host rows expected)", !roles.some((r) => r.role === "co_host"), { enums, roles });
  const seedDemo = rowsOf("SELECT id, email, is_demo FROM users WHERE is_demo=1;");
  check("data: exactly one demo user", seedDemo.length === 1, { seedDemo });
  const tz = rowsOf("SELECT timezone, count(*) n FROM meetings GROUP BY timezone;");
  check("data: time zones stored (instant meetings use UTC) (info)", null, { tz });
  const dupCodes = rowsOf("SELECT meeting_code, count(*) n FROM meetings GROUP BY meeting_code HAVING n>1;");
  check("data: meeting codes are unique and 10 digits", dupCodes.length === 0 && rowsOf("SELECT count(*) n FROM meetings WHERE length(meeting_code)<>10 OR meeting_code GLOB '*[^0-9]*';")[0].n === 0, {});
  const journal = sql("PRAGMA journal_mode;");
  check("data: SQLite journal mode (WAL helps concurrent readers) (info)", null, { journal_mode: journal });
}

save("t9_perf_data", rows);
