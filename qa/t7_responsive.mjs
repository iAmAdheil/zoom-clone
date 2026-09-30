// Matrix item 10: screenshots of every screen at 1440x900, 834x1112 and 390x844, plus layout metrics.
// Room tiles 4 and 6 are filled with REST-joined guests (they show as avatar tiles, like video off).
import { FE, PHONE, api, joinFromPreview, launch, recorder, save, saveIssues, shot, sleep, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const browser = await launch();
const VIEWPORTS = [
  { tag: "1440", opts: { viewport: { width: 1440, height: 900 } } },
  { tag: "834", opts: { viewport: { width: 834, height: 1112 }, hasTouch: true } },
  { tag: "390", opts: PHONE },
];

// Layout metrics of the current page: horizontal scroll, off-screen text, small tap targets.
async function metrics(page, phone) {
  return page.evaluate((phone) => {
    const vw = window.innerWidth;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const name = (el) =>
      (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.id || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
    const offscreen = [...document.querySelectorAll("body *")]
      .filter((el) => el.children.length === 0 && el.textContent.trim() && visible(el))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.right > vw + 1 || r.left < -1;
      })
      .map((el) => name(el))
      .slice(0, 10);
    const clipped = [...document.querySelectorAll("p, span, h1, h2, h3, button, a, dd, label")]
      .filter((el) => visible(el) && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow !== "ellipsis" && getComputedStyle(el).overflow !== "visible")
      .map((el) => name(el))
      .slice(0, 10);
    const small = phone
      ? [...document.querySelectorAll("button, a[href], input:not([type=hidden]), select, textarea, [role=button]")]
          .filter(visible)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { name: name(el), w: Math.round(r.width), h: Math.round(r.height) };
          })
          .filter((x) => x.w < 40 || x.h < 40)
      : [];
    return {
      hScroll: document.documentElement.scrollWidth > vw,
      scrollWidth: document.documentElement.scrollWidth,
      offscreenText: offscreen,
      clippedNoEllipsis: clipped,
      smallTapTargets: small,
    };
  }, phone);
}

const all = {};
async function capture(page, screen, tag) {
  await sleep(700);
  const file = await shot(page, `${screen}-${tag}.png`);
  const m = await metrics(page, tag === "390");
  all[`${screen}@${tag}`] = { file, ...m };
}

// Meetings for the room screens.
const ended = [];
for (const vp of VIEWPORTS) {
  // A fresh meeting per viewport, so the 1, 4 and 6 tile screens really have 1, 4 and 6 people.
  const m1 = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA layout room with a fairly long meeting title to test wrapping" } })).body;
  ended.push(m1.meeting_code);
  const guests = [];
  const anon = await browser.newContext({ ...vp.opts, permissions: ["camera", "microphone"] });
  const a = await anon.newPage();
  await a.goto(`${FE}/signin`);
  await a.getByRole("button", { name: /demo user/i }).waitFor();
  await capture(a, "signin", vp.tag);
  await a.goto(`${FE}/join`);
  await a.locator("#code").waitFor();
  await capture(a, "join", vp.tag);
  await a.goto(`${FE}/j/${m1.meeting_code}`);
  await a.locator("#name").waitFor();
  await sleep(800);
  await capture(a, "join-link", vp.tag);
  await a.goto(`${FE}/meeting/${m1.meeting_code}`);
  await a.locator("#display-name").waitFor();
  await sleep(1500);
  await capture(a, "prejoin", vp.tag);
  await anon.close();

  const ctx = await browser.newContext({ ...vp.opts, permissions: ["camera", "microphone", "clipboard-read", "clipboard-write"] });
  await ctx.addCookies([{ name: "session", value: T["1"], domain: "localhost", path: "/" }]);
  const p = await ctx.newPage();
  await p.goto(`${FE}/`);
  await p.getByRole("heading", { name: "Upcoming" }).waitFor();
  await p.waitForFunction(() => !document.body.innerText.includes("Loading meetings..."));
  await capture(p, "dashboard", vp.tag);
  if (vp.tag === "390") {
    await p.getByRole("button", { name: "Open navigation" }).click().catch(() => {});
    await capture(p, "dashboard-nav-open", vp.tag);
    await p.keyboard.press("Escape");
  }
  await p.goto(`${FE}/schedule`);
  await p.locator("#topic").waitFor();
  await capture(p, "schedule", vp.tag);

  // Room with 1 tile.
  await p.goto(`${FE}/meeting/${m1.meeting_code}`);
  await joinFromPreview(p);
  await sleep(1500);
  await capture(p, "room-1tile", vp.tag);
  // 4 tiles, then 6 tiles.
  while (guests.length < 3) guests.push((await api("POST", `/api/meetings/${m1.meeting_code}/join`, { body: { display_name: `Layout guest ${guests.length + 1}` } })).body);
  await sleep(1500);
  await capture(p, "room-4tiles", vp.tag);
  while (guests.length < 5) guests.push((await api("POST", `/api/meetings/${m1.meeting_code}/join`, { body: { display_name: `Layout guest with a long name ${guests.length + 1}` } })).body);
  await sleep(1500);
  await capture(p, "room-6tiles", vp.tag);
  const tb = p.getByRole("toolbar", { name: "Meeting controls" });
  await tb.getByRole("button", { name: /Participants$/ }).click();
  await capture(p, "room-participants", vp.tag);
  await p.locator('aside[aria-label^="Participants"]').getByRole("button", { name: "Invite" }).click();
  await capture(p, "room-invite-popover", vp.tag);
  await p.keyboard.press("Escape");
  await p.locator('aside[aria-label^="Participants"] button[aria-label^="Close"]').click();
  await tb.getByRole("button", { name: "Chat", exact: true }).click();
  await p.getByLabel("Message to everyone").fill("A message to check the layout of the chat panel on this screen size.");
  await p.keyboard.press("Enter");
  await capture(p, "room-chat", vp.tag);
  await p.locator('aside[aria-label="Meeting Chat"] button[aria-label^="Close"]').click();
  await p.getByRole("button", { name: "Meeting information" }).click();
  await capture(p, "room-info-popover", vp.tag);
  await p.keyboard.press("Escape");
  await tb.getByRole("button", { name: "More", exact: true }).click();
  await capture(p, "room-more-menu", vp.tag);
  await p.keyboard.press("Escape");
  await tb.getByRole("button", { name: "End", exact: true }).click();
  await capture(p, "room-end-menu", vp.tag);
  await p.getByRole("button", { name: "Leave Meeting" }).click();
  await sleep(1000);
  await ctx.close();
}

// Summaries.
for (const [k, v] of Object.entries(all)) {
  if (v.hScroll) check(`responsive: horizontal scroll on ${k}`, false, { scrollWidth: v.scrollWidth });
  if (v.offscreenText.length) check(`responsive: text off screen on ${k}`, false, { offscreen: v.offscreenText });
}
const smallPhone = Object.fromEntries(Object.entries(all).filter(([k, v]) => k.endsWith("@390") && v.smallTapTargets.length).map(([k, v]) => [k, v.smallTapTargets]));
check("responsive: no tap target under 40 px on phone", Object.keys(smallPhone).length === 0, smallPhone);
check("responsive: no horizontal scroll on any screen", !Object.values(all).some((v) => v.hScroll), Object.fromEntries(Object.entries(all).map(([k, v]) => [k, v.hScroll])));

for (const c of ended) await api("POST", `/api/meetings/${c}/end`, { cookie: T["1"] });
save("t7_responsive", { rows, screens: all });
saveIssues("t7");
await browser.close();
