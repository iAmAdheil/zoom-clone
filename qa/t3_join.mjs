// Matrix item 5: join by ID, link and ?pwd=, the error cases, and display name edge cases.
import { FE, api, demoLogin, joinFromPreview, launch, newPage, recorder, save, saveIssues, shot, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const future = new Date(Date.now() + 3 * 3600000).toISOString();
const g343 = (c) => `${c.slice(0, 3)} ${c.slice(3, 7)} ${c.slice(7)}`;

const open = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA join open" } })).body;
const pass = (await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "QA join passcode", scheduled_start: future, duration_min: 30, timezone: "UTC", passcode: "Pa55" } })).body;
const verified = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA join verified", access: "verified_only" } })).body;
const ended = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA join ended" } })).body;
await api("POST", `/api/meetings/${ended.meeting_code}/end`, { cookie: T["1"] });
const xssTitle = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: `<img src=x onerror=alert('title')><b>bold</b>` } })).body;

const dialogs = [];
async function guest(name = "join-guest", opts = {}) {
  const p = await newPage(browser, { name, ...opts });
  p.on("dialog", (d) => {
    dialogs.push(d.message());
    d.dismiss();
  });
  return p;
}
async function submitJoin(p, { code, name, passcode }) {
  if (code !== undefined) await p.locator("#code").fill(code);
  if (name !== undefined) await p.locator("#name").fill(name);
  if (passcode !== undefined) await p.locator("#passcode").fill(passcode);
  await sleep(600);
  await p.getByRole("button", { name: /^Join$/ }).click();
  await sleep(2000);
  return { url: p.url(), text: await p.locator("body").innerText() };
}

// By ID with spaces, dashes and extra blanks.
for (const [label, input] of [
  ["spaces (3-4-3)", g343(open.meeting_code)],
  ["dashes", open.meeting_code.replace(/(\d{3})(\d{4})(\d{3})/, "$1-$2-$3")],
  ["leading/trailing blanks", `  ${open.meeting_code}  `],
]) {
  const p = await guest();
  await p.goto(`${FE}/join`);
  const r = await submitJoin(p, { code: input, name: "ID tester" });
  check(`join: by ID with ${label} opens the pre-join`, r.url.includes(`/meeting/${open.meeting_code}`), { input, url: r.url });
  if (label.startsWith("spaces")) await shot(p, "join-prejoin-guest-1280.png");
  await p.context().close();
}

// Full invite link pasted into the ID field (with ?pwd=).
{
  const p = await guest();
  await p.goto(`${FE}/join`);
  await p.locator("#code").fill(`${FE}/j/${pass.meeting_code}?pwd=Pa55`);
  const shown = await p.locator("#code").inputValue();
  const pw = await p.locator("#passcode").inputValue();
  const r = await submitJoin(p, { name: "Link tester" });
  check("join: pasting a full invite link fills the ID (3-4-3) and the passcode, then joins", shown === g343(pass.meeting_code) && pw === "Pa55" && r.url.includes(`/meeting/${pass.meeting_code}`), { shown, passcodeFilled: pw === "Pa55", url: r.url });
  // Invite link to another host: https://zoom.us/j/123... style
  await p.goto(`${FE}/join`);
  await p.locator("#code").fill(`https://us05web.zoom.us/j/${open.meeting_code}?pwd=abc`);
  const other = await p.locator("#code").inputValue();
  check("join: a link from another host (zoom.us) is also parsed (info)", null, { shown: other });
  await p.context().close();
}

// ?pwd= on /j/<code>.
{
  const p = await guest();
  await p.goto(`${FE}/j/${pass.meeting_code}?pwd=Pa55`);
  await p.locator("#name").waitFor();
  const pw = await p.locator("#passcode").inputValue();
  await shot(p, "join-link-pwd-1280.png");
  const r = await submitJoin(p, { name: "Pwd tester" });
  check("join: /j/<code>?pwd= fills the passcode and joins", pw === "Pa55" && r.url.includes("/meeting/"), { pw, url: r.url });
  // Pre-join after the join page: the room join should reuse the passcode.
  await joinFromPreview(p).catch(() => {});
  const inRoom = (await p.getByRole("toolbar", { name: "Meeting controls" }).count()) === 1;
  check("join: passcode meeting: pre-join Join enters the room without asking again", inRoom, {});
  await p.context().close();
}

// Wrong ID (unknown 10 digits), too short ID.
{
  const p = await guest();
  await p.goto(`${FE}/join`);
  let r = await submitJoin(p, { code: "1234567890", name: "Wrong" });
  check("join: unknown 10-digit ID shows 'not valid' next to the field", /not valid|No meeting/i.test(r.text) && r.url.endsWith("/join"), { msg: r.text.match(/.*(not valid|No meeting).*/i)?.[0] });
  await shot(p, "join-error-wrong-id-1280.png");
  r = await submitJoin(p, { code: "12345", name: "Wrong" });
  check("join: short ID shows a validation message", /valid 10-digit/i.test(r.text), {});
  // Direct room URL with a bad code.
  await p.goto(`${FE}/meeting/1234567890`);
  await sleep(1500);
  check("join: /meeting/<unknown> shows Meeting not found", /Meeting not found/.test(await p.locator("body").innerText()), {});
  await p.goto(`${FE}/meeting/abc`);
  await sleep(1500);
  check("join: /meeting/abc shows Meeting not found", /Meeting not found/.test(await p.locator("body").innerText()), {});
  await p.context().close();
}

// Wrong passcode, then right.
{
  const p = await guest();
  await p.goto(`${FE}/j/${pass.meeting_code}`);
  let r = await submitJoin(p, { name: "Bad pass", passcode: "nope" });
  const passMsg = await p.locator("#passcode-msg").innerText().catch(() => "");
  check("join: wrong passcode shows an error next to the passcode field", r.url.includes("/j/") && passMsg.length > 0, { passMsg });
  await shot(p, "join-error-passcode-1280.png");
  r = await submitJoin(p, { passcode: "Pa55" });
  check("join: right passcode after a wrong one joins", r.url.includes("/meeting/"), { url: r.url });
  // Passcode with a trailing space.
  await p.context().close();
  const q = await guest();
  await q.goto(`${FE}/j/${pass.meeting_code}`);
  r = await submitJoin(q, { name: "Space pass", passcode: " Pa55 " });
  check("join: a passcode typed with blanks around it is accepted", r.url.includes("/meeting/"), { url: r.url });
  await q.context().close();
}

// Ended meeting.
{
  const p = await guest();
  await p.goto(`${FE}/j/${ended.meeting_code}`);
  const r = await submitJoin(p, { name: "Late" });
  check("join: ended meeting says it has ended", /has ended/i.test(r.text), { msg: r.text.match(/.*ended.*/i)?.[0] });
  await p.goto(`${FE}/meeting/${ended.meeting_code}`);
  await sleep(1500);
  check("join: /meeting/<ended> shows 'This meeting has ended'", /has ended/.test(await p.locator("body").innerText()), {});
  await shot(p, "join-ended-1280.png");
  await p.context().close();
}

// Guest on verified_only: blocked, signs in with demo, returns.
{
  const p = await guest("verified-guest");
  await p.goto(`${FE}/j/${verified.meeting_code}`);
  const r = await submitJoin(p, { name: "Unverified" });
  const blocked = r.url.includes("/j/") && /sign in/i.test(r.text);
  await shot(p, "join-verified-only-blocked-1280.png");
  const link = p.getByRole("link", { name: /sign in/i }).first();
  const href = await link.getAttribute("href").catch(() => null);
  await link.click();
  await p.waitForURL(/\/signin/);
  await p.getByRole("button", { name: /demo user/i }).click();
  await p.waitForURL(new RegExp(`/j/${verified.meeting_code}`), { timeout: 15000 }).catch(() => {});
  const back = p.url();
  const nameNow = await p.locator("#name").inputValue().catch(() => "");
  const r2 = await submitJoin(p, {});
  check("join: guest on verified_only is blocked, signs in with demo, comes back and joins", blocked && back.includes(`/j/${verified.meeting_code}`) && r2.url.includes("/meeting/"), {
    blockedMsg: r.text.match(/.*sign in.*/i)?.[0],
    signInHref: href,
    returnedTo: back,
    prefilledName: nameNow,
    final: r2.url,
  });
  await p.context().close();
}

// Signed-in user clicks Join at once, before /api/me fills the name.
{
  const results = [];
  for (let i = 0; i < 3; i++) {
    const p = await newPage(browser, { name: "early-click", userId: 3 });
    await p.goto(`${FE}/j/${open.meeting_code}`);
    await p.getByRole("button", { name: /^Join$/ }).click();
    await sleep(2500);
    const txt = await p.locator("body").innerText();
    const value = await p.locator("#name").inputValue().catch(() => "");
    results.push({ url: p.url().replace(FE, ""), nameField: value, error: /Enter your name/.test(txt) });
    if (i === 0 && /Enter your name/.test(txt)) await shot(p, "bug-join-name-race-1280.png");
    await p.context().close();
  }
  check("join: signed-in user who clicks Join at once is not told 'Enter your name' while the field shows the name", !results.some((r) => r.error && r.nameField), { results });
}

// Empty and long display names.
{
  const p = await guest();
  await p.goto(`${FE}/j/${open.meeting_code}`);
  let r = await submitJoin(p, { name: "   " });
  check("join: empty (blank) display name is refused", /Enter your name/.test(r.text), {});
  const n200 = "N".repeat(190) + "0123456789";
  await p.locator("#name").fill(n200);
  const typed = (await p.locator("#name").inputValue()).length;
  check("join: 200-char display name: the UI cuts it (info: maxLength)", null, { typedLength: typed });
  const apiLong = await api("POST", `/api/meetings/${open.meeting_code}/join`, { body: { display_name: n200 } });
  const api256 = await api("POST", `/api/meetings/${open.meeting_code}/join`, { body: { display_name: "x".repeat(256) } });
  check("join: API accepts a 200-char name and refuses 256", apiLong.status === 200 && api256.status === 422, { long200: apiLong.status, long256: api256.status });
  await p.context().close();

  // Long name layout in the room, and an HTML title on join/prejoin/room.
  const host = await newPage(browser, { name: "join-host", userId: 1, viewport: { width: 1440, height: 900 } });
  host.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  await host.goto(`${FE}/meeting/${open.meeting_code}`);
  await joinFromPreview(host);
  const longGuest = await guest("long-name-guest");
  await longGuest.goto(`${FE}/j/${open.meeting_code}`);
  await longGuest.locator("#name").fill("W".repeat(64));
  await longGuest.getByRole("button", { name: /^Join$/ }).click();
  await longGuest.waitForURL(/\/meeting\//, { waitUntil: "commit" });
  await joinFromPreview(longGuest);
  await sleep(4000);
  await host.getByRole("toolbar", { name: "Meeting controls" }).getByRole("button", { name: /Participants$/ }).click();
  await sleep(800);
  const overflow = await host.evaluate(() => ({
    pageScrollX: document.documentElement.scrollWidth > window.innerWidth,
    tilesOverflow: [...document.querySelectorAll("figure figcaption")].filter((f) => f.scrollWidth > f.parentElement.clientWidth + 1).length,
  }));
  await shot(host, "room-long-names-1440.png");
  check("join: 64-char and 200-char names do not break the tile or panel layout", !overflow.pageScrollX && overflow.tilesOverflow === 0, overflow);
  await host.setViewportSize({ width: 390, height: 844 });
  await sleep(600);
  await shot(host, "room-long-names-390.png");
  await host.setViewportSize({ width: 1440, height: 900 });

  // HTML title.
  const t = await guest("xss-title");
  await t.goto(`${FE}/j/${xssTitle.meeting_code}`);
  await sleep(1500);
  const card = await t.locator("form").innerText();
  await t.locator("#name").fill("T");
  await t.getByRole("button", { name: /^Join$/ }).click();
  await t.waitForURL(/\/meeting\//, { waitUntil: "commit" });
  await sleep(1500);
  const pre = await t.locator("body").innerText();
  check("xss: an HTML meeting title renders as text on the join card and the pre-join", dialogs.length === 0 && card.includes("<img src=x") && pre.includes("<img src=x"), { dialogs });
  await host.goto(`${FE}/`);
  await sleep(2000);
  check("xss: HTML title on the host dashboard renders as text", dialogs.length === 0 && (await host.locator("body").innerText()).includes("<b>bold</b>"), { dialogs });
  await t.context().close();
  await longGuest.context().close();
  await host.context().close();
}

for (const mm of [open, verified, xssTitle]) await api("POST", `/api/meetings/${mm.meeting_code}/end`, { cookie: T["1"] });
await api("DELETE", `/api/meetings/${pass.id}`, { cookie: T["1"] });
check("xss: no alert() fired during the join tests", dialogs.length === 0, { dialogs });
save("t3_join", rows);
saveIssues("t3");
await browser.close();
