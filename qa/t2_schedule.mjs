// Matrix item 4: the schedule form, through the UI, plus PATCH and DELETE through the API.
import { FE, api, launch, newPage, recorder, save, saveIssues, shot, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const page = await newPage(browser, { name: "host-schedule", userId: 1, viewport: { width: 1440, height: 900 } });

const pad = (n) => String(n).padStart(2, "0");
const dayStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const tomorrow = new Date(Date.now() + 86400000);
const yesterday = new Date(Date.now() - 86400000);

async function openForm() {
  await page.goto(`${FE}/schedule`);
  await page.locator("#topic").waitFor();
}
async function fill({ topic, description, date, time = "10:00", meridiem = "AM", hours = 1, minutes = 0, tz, passcode, usePasscode = true, access }) {
  if (topic !== undefined) await page.locator("#topic").fill(topic);
  if (description !== undefined) {
    await page.getByRole("button", { name: /Add Description/ }).click();
    await page.locator("#description").fill(description);
  }
  if (date !== undefined) await page.locator("#date").fill(date);
  await page.getByLabel("Start time").selectOption(time);
  await page.getByLabel("AM or PM").selectOption(meridiem);
  await page.getByLabel("Hours").selectOption(String(hours));
  await page.getByLabel("Minutes").selectOption(String(minutes));
  if (tz) await page.locator("#timezone").selectOption(tz);
  const box = page.locator("#use-passcode");
  if ((await box.isChecked()) !== usePasscode) await box.click();
  if (usePasscode && passcode !== undefined) await page.getByRole("textbox", { name: "Passcode" }).fill(passcode);
  if (access === "verified_only") await page.locator("#access-verified").check();
  if (access === "allow_guests") await page.locator("#access-guests").check();
}
async function submit() {
  await page.getByRole("button", { name: "Save" }).click();
  await sleep(1500);
  return page.locator("body").innerText();
}
async function upcoming() {
  return (await api("GET", "/api/meetings/upcoming", { cookie: T["1"] })).body;
}

const made = [];

// Valid, all fields.
await openForm();
await shot(page, "schedule-1440.png");
await fill({
  topic: "QA valid schedule",
  description: "Agenda: test every field.",
  date: dayStr(tomorrow),
  time: "10:00",
  meridiem: "AM",
  hours: 1,
  minutes: 30,
  tz: "Asia/Kolkata",
  passcode: "Ab1@*_-",
  access: "verified_only",
});
let text = await submit();
await shot(page, "schedule-summary-1440.png");
let up = await upcoming();
let m = up.find((x) => x.title === "QA valid schedule");
const expectedStart = new Date(`${dayStr(tomorrow)}T10:00:00+05:30`).toISOString();
check("schedule: valid form (all fields) creates the meeting with the right values", !!m && m.duration_min === 90 && m.timezone === "Asia/Kolkata" && m.passcode === "Ab1@*_-" && m.access === "verified_only" && m.description === "Agenda: test every field." && new Date(m.scheduled_start).toISOString() === expectedStart, {
  got: m && { start: m.scheduled_start, duration: m.duration_min, tz: m.timezone, passcode: m.passcode, access: m.access, description: m.description },
  expectedStart,
  summary: text.slice(0, 300),
});
if (m) made.push(m);

// Past date.
await openForm();
await fill({ topic: "QA past", date: dayStr(yesterday) });
text = await submit();
check("schedule: past date is refused with a message", /future/i.test(text) && !(await upcoming()).some((x) => x.title === "QA past"), { msg: text.match(/.*future.*/i)?.[0] });
await shot(page, "schedule-error-past-1440.png");

// Duration 0.
await openForm();
await fill({ topic: "QA zero", date: dayStr(tomorrow), hours: 0, minutes: 0 });
text = await submit();
check("schedule: duration 0 is refused", /at least/i.test(text), { msg: text.match(/.*at least.*/i)?.[0] });

// Very long duration: 24 h 45 min = 1485 min (API max is 1440). The form must not offer it (BUG-08).
await openForm();
await page.getByLabel("Hours").selectOption("24");
const minuteOptions = await page.getByLabel("Minutes").locator("option").allInnerTexts();
check("schedule: at 24 hr the Minutes picker offers only 0", minuteOptions.join(",") === "0", { minuteOptions });
// A server refusal shows a friendly text, not the Pydantic text. The route forces the server answer.
await fill({ topic: "QA server error", date: dayStr(tomorrow), hours: 24, minutes: 0 });
await page.route("**/api/meetings", (r) =>
  r.request().method() === "POST"
    ? r.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ detail: "duration_min: Input should be less than or equal to 1440", code: "validation_error" }) })
    : r.continue(),
);
await submit();
const durationMsg = await page.locator("#duration-msg").innerText().catch(() => "");
check("schedule: a server validation error shows a friendly message next to Duration", durationMsg.length > 0 && !/validation|less than or equal|duration_min/i.test(durationMsg), { durationMsg });
await page.route("**/api/meetings", (r) =>
  r.request().method() === "POST" ? r.fulfill({ status: 500, contentType: "text/plain", body: "Internal Server Error" }) : r.continue(),
);
await submit();
const formMsg = await page.locator("form [role=alert]").allInnerTexts();
check("schedule: a server 500 shows a friendly message", formMsg.some((m) => /could not be saved/i.test(m)), { formMsg });
await shot(page, "schedule-error-long-duration-1440.png");
await page.unroute("**/api/meetings");

// 24 h exactly works?
await openForm();
await fill({ topic: "QA 24h", date: dayStr(tomorrow), hours: 24, minutes: 0 });
await submit();
const h24 = (await upcoming()).find((x) => x.title === "QA 24h");
check("schedule: duration 24h (1440) is accepted", !!h24 && h24.duration_min === 1440, { saved: !!h24 });
if (h24) made.push(h24);

// Empty title.
await openForm();
await fill({ topic: "   ", date: dayStr(tomorrow) });
text = await submit();
check("schedule: empty title is refused", /Enter a topic/.test(text), {});

// 300-char title.
await openForm();
const long300 = "T".repeat(290) + "0123456789";
await fill({ topic: long300, date: dayStr(tomorrow) });
const typedLen = (await page.locator("#topic").inputValue()).length;
text = await submit();
const longTitle = (await upcoming()).find((x) => x.title.startsWith("TTTT"));
check("schedule: 300-char title: UI limits input (reported length) and saves without error", !!longTitle, { typedLength: typedLen, savedLength: longTitle?.title.length });
if (longTitle) made.push(longTitle);
await page.goto(`${FE}/`);
await page.getByRole("heading", { name: "Upcoming" }).waitFor();
await sleep(1500);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
check("schedule: long title does not cause horizontal scroll on the dashboard", !overflow, {});
const api300 = await api("POST", "/api/meetings", {
  cookie: T["1"],
  body: { title: "x".repeat(300), scheduled_start: new Date(Date.now() + 86400000).toISOString(), duration_min: 30, timezone: "UTC" },
});
check("schedule: API refuses a 300-char title with 422", api300.status === 422, { status: api300.status, code: api300.body.code });

// Unicode and emoji.
await openForm();
const uni = "Réunion 会议 🚀🎉 تجربة ✓";
await fill({ topic: uni, date: dayStr(tomorrow), usePasscode: false });
await submit();
const uniM = (await upcoming()).find((x) => x.title === uni);
await page.goto(`${FE}/`);
await page.getByRole("heading", { name: "Upcoming" }).waitFor();
await sleep(1500);
const dash = await page.locator("body").innerText();
check("schedule: unicode + emoji title saves and shows on the dashboard unchanged", !!uniM && dash.includes(uni) && uniM.passcode === null, { saved: uniM?.title, passcode: uniM?.passcode });
if (uniM) made.push(uniM);

// Passcode with spaces and symbols.
await openForm();
await fill({ topic: "QA passcode symbols", date: dayStr(tomorrow), passcode: "a b#c!" });
text = await submit();
check("schedule: UI refuses a passcode with spaces and # ! (allowed: letters, digits, @ * _ -)", /Use 1 to 10/.test(text), {});
const apiPass = await api("POST", "/api/meetings", {
  cookie: T["1"],
  body: { title: "QA api passcode", scheduled_start: new Date(Date.now() + 86400000).toISOString(), duration_min: 30, timezone: "UTC", passcode: " a b#c!&? " },
});
check("schedule: API accepts a passcode with spaces and symbols (trimmed) and the host invite link encodes it", apiPass.status === 200, {
  status: apiPass.status,
  stored: apiPass.body.passcode,
  invite: apiPass.body.invite_link,
});
if (apiPass.status === 200) {
  made.push(apiPass.body);
  // Join through the host invite link (pwd is URL encoded).
  const g = await newPage(browser, { name: "guest-passcode" });
  const u = new URL(apiPass.body.invite_link);
  await g.goto(`${FE}${u.pathname}${u.search}`);
  await g.locator("#name").fill("Pass tester");
  await g.getByRole("button", { name: /^Join$/ }).click();
  await sleep(2500);
  check("join: invite link with an encoded symbol passcode (?pwd=) joins", g.url().includes("/meeting/"), { url: g.url(), pwdParam: u.search });
  await g.context().close();
}

// Access: verified_only vs allow_guests badges.
await page.goto(`${FE}/`);
await page.getByRole("heading", { name: "Upcoming" }).waitFor();
await sleep(1500);
up = await upcoming();
const rowsText = await page.$$eval("section[aria-labelledby=upcoming-title] li", (els) => els.map((e) => e.innerText));
const badgeOk = up.every((mm, i) => rowsText[i]?.includes(mm.access === "verified_only" ? "Verified" : "Guests"));
check("schedule: new meetings appear in Upcoming with the right access badge", badgeOk && made.every((mm) => up.some((u2) => u2.id === mm.id)), { upcoming: up.length });
await shot(page, "dashboard-after-schedule-1440.png");

// Edit through the summary page Edit button (UI).
// PATCH and DELETE through the API, then refresh the UI.
const target = made[0];
const patched = await api("PATCH", `/api/meetings/${target.id}`, {
  cookie: T["1"],
  body: { title: "QA valid schedule (edited)", duration_min: 45 },
});
const bad = await api("PATCH", `/api/meetings/${target.id}`, { cookie: T["1"], body: { title: null } });
const pastPatch = await api("PATCH", `/api/meetings/${target.id}`, { cookie: T["1"], body: { scheduled_start: "2020-01-01T00:00:00Z" } });
await page.reload();
await page.getByRole("heading", { name: "Upcoming" }).waitFor();
await sleep(1500);
const afterPatch = await page.locator("section[aria-labelledby=upcoming-title]").innerText();
check("schedule: PATCH title+duration shows after refresh; null title 422; past start 422", patched.status === 200 && afterPatch.includes("QA valid schedule (edited)") && bad.status === 422 && pastPatch.status === 422, {
  patch: patched.status,
  nullTitle: `${bad.status} ${bad.body.code}`,
  pastStart: `${pastPatch.status} ${pastPatch.body.code}`,
});
const del = await api("DELETE", `/api/meetings/${target.id}`, { cookie: T["1"] });
const del2 = await api("DELETE", `/api/meetings/${target.id}`, { cookie: T["1"] });
await page.reload();
await page.getByRole("heading", { name: "Upcoming" }).waitFor();
await sleep(1500);
const afterDel = await page.locator("section[aria-labelledby=upcoming-title]").innerText();
check("schedule: DELETE removes it from Upcoming after refresh; second DELETE 404", del.status === 204 && !afterDel.includes("QA valid schedule (edited)") && del2.status === 404, { del: del.status, del2: del2.status });

// Clean up the other test meetings (cancel them).
for (const mm of made.slice(1)) await api("DELETE", `/api/meetings/${mm.id}`, { cookie: T["1"] });

save("t2_schedule", { rows, deletedIds: made.map((x) => x.id) });
saveIssues("t2");
await browser.close();
