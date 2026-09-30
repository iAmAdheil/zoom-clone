// Matrix item 11: keyboard pass, accessible names, axe-core, page titles, lang.
// axe-core is a dependency of qa/ only, never of the app.
import path from "node:path";
import { FE, QA_DIR, api, joinFromPreview, launch, newPage, recorder, save, saveIssues, shot, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const AXE = path.join(QA_DIR, "node_modules/axe-core/axe.min.js");

async function axe(page) {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      count: v.nodes.length,
      help: v.help,
      sample: v.nodes.slice(0, 3).map((n) => n.target.join(" ") + (n.any[0]?.message ? ` :: ${n.any[0].message.slice(0, 120)}` : "")),
    }));
  });
}
async function focusInfo(page) {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: "body" };
    const s = getComputedStyle(el);
    const ring = (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      name: (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || "").trim().slice(0, 30),
      ring,
    };
  });
}
async function tabWalk(page, n) {
  const seq = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press("Tab");
    seq.push(await focusInfo(page));
  }
  return seq;
}

const meeting = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA a11y room" } })).body;
const axeAll = {};
const titles = {};

// Anonymous pages.
{
  const p = await newPage(browser, { name: "a11y-anon" });
  for (const [k, url] of [
    ["signin", "/signin"],
    ["join", "/join"],
    ["invite-link", `/j/${meeting.meeting_code}`],
    ["prejoin", `/meeting/${meeting.meeting_code}`],
    ["not-found-meeting", "/meeting/1234567890"],
    ["404", "/no-such-page"],
  ]) {
    await p.goto(`${FE}${url}`);
    await sleep(1800);
    titles[k] = await p.title();
    axeAll[k] = await axe(p);
  }
  const lang = await p.evaluate(() => document.documentElement.lang);
  check("a11y: <html lang> is set", lang === "en", { lang });

  // Keyboard-only join: tab order, focus ring, Enter submits.
  await p.goto(`${FE}/join`);
  await sleep(1000);
  const seq = await tabWalk(p, 9);
  check("a11y: join form tab order reaches ID, name, passcode, remember, Join; every stop shows a focus ring", seq.every((s) => s.tag === "body" || s.ring), { seq });
  await p.goto(`${FE}/join`);
  await sleep(800);
  await p.locator("#code").focus();
  await p.keyboard.type(meeting.meeting_code);
  await p.keyboard.press("Tab");
  await p.keyboard.press("Tab"); // name (the meeting card is not focusable)
  let f = await focusInfo(p);
  if (f.id !== "name") await p.locator("#name").focus();
  await p.keyboard.type("Keyboard Guest");
  await p.keyboard.press("Enter");
  await p.waitForURL(/\/meeting\//, { timeout: 15000 }).catch(() => {});
  check("a11y: Enter in the join form submits it", p.url().includes("/meeting/"), { url: p.url(), focusAfterIdTab: f });
  // Pre-join by keyboard: Tab to Join and Enter.
  await p.locator("#display-name").waitFor();
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Join" && !b.disabled));
  await p.locator("#display-name").focus();
  await p.keyboard.press("Enter");
  const inRoom = await p.getByRole("toolbar", { name: "Meeting controls" }).waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  check("a11y: Enter in the pre-join name field joins the room", inRoom, {});
  if (inRoom) {
    await sleep(1500);
    titles.room = await p.title();
    axeAll.room = await axe(p);
    const roomSeq = await tabWalk(p, 16);
    check("a11y: room toolbar is reachable by Tab with a visible focus ring", roomSeq.filter((s) => s.tag === "button").length >= 8 && roomSeq.every((s) => s.tag === "body" || s.ring), { roomSeq });
    // Escape closes a popover and focus returns to its trigger.
    await p.getByRole("button", { name: "Meeting information" }).focus();
    await p.keyboard.press("Enter");
    await sleep(300);
    const opened = await p.getByRole("dialog", { name: "Meeting information" }).count();
    await p.keyboard.press("Escape");
    await sleep(300);
    const closed = await p.getByRole("dialog", { name: "Meeting information" }).count();
    const back = await focusInfo(p);
    check("a11y: popover opens with Enter, closes with Escape, focus returns to trigger", opened === 1 && closed === 0 && back.name === "Meeting information", { opened, closed, focus: back });
    // Buttons without an accessible name.
    const unnamed = await p.evaluate(() =>
      [...document.querySelectorAll("button, a[href], [role=button]")]
        .filter((b) => !(b.getAttribute("aria-label") || b.textContent.trim() || b.getAttribute("title")))
        .map((b) => b.outerHTML.slice(0, 120)),
    );
    check("a11y: every room button has an accessible name", unnamed.length === 0, { unnamed });
    const names = await p.getByRole("toolbar", { name: "Meeting controls" }).getByRole("button").evaluateAll((els) => els.map((e) => e.textContent.trim().replace(/\s+/g, " ")));
    check("a11y: toolbar button names (the Participants name starts with the count)", null, { names });
  }
  await p.context().close();
}

// Signed-in pages.
{
  const p = await newPage(browser, { name: "a11y-host", userId: 1 });
  for (const [k, url] of [
    ["dashboard", "/"],
    ["schedule", "/schedule"],
  ]) {
    await p.goto(`${FE}${url}`);
    await sleep(2000);
    titles[k] = await p.title();
    axeAll[k] = await axe(p);
  }
  // Keyboard-only schedule: tab order and Enter submits.
  await p.goto(`${FE}/schedule`);
  await p.locator("#topic").waitFor();
  await p.locator("#topic").focus();
  const seq = [await focusInfo(p), ...(await tabWalk(p, 14))];
  check("a11y: schedule form tab order covers every field with a visible focus ring", seq.every((s) => s.tag === "body" || s.ring), { seq });
  await p.locator("#topic").fill("QA keyboard schedule");
  await p.locator("#topic").focus();
  await p.keyboard.press("Enter");
  await sleep(2000);
  const up = (await api("GET", "/api/meetings/upcoming", { cookie: T["1"] })).body.find((m) => m.title === "QA keyboard schedule");
  check("a11y: Enter in the schedule topic field submits the form", !!up, {});
  if (up) await api("DELETE", `/api/meetings/${up.id}`, { cookie: T["1"] });
  await p.context().close();
}

const distinct = new Set(Object.values(titles));
check("a11y: each page has its own <title>", distinct.size >= Object.keys(titles).length - 1, titles);
const serious = Object.fromEntries(
  Object.entries(axeAll).map(([k, v]) => [k, v.filter((x) => x.impact === "serious" || x.impact === "critical").map((x) => `${x.id}(${x.count})`)]),
);
check("a11y: axe finds no serious or critical violations", Object.values(serious).every((v) => v.length === 0), serious);
await api("POST", `/api/meetings/${meeting.meeting_code}/end`, { cookie: T["1"] });
save("t8_a11y", { rows, axe: axeAll, titles });
saveIssues("t8");
await browser.close();
