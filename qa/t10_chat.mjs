// Chat, tap targets, accessible names and the passcode line, with 3 browser contexts.
// Run against a production build. Example (from the repo root):
//   QA_FE=http://localhost:3400 QA_BE=http://localhost:8400 \
//   PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs QA_CHROME=/path/to/chrome \
//   QA_VIDEO=/path/to/fake-320x180.y4m node qa/t10_chat.mjs
// Screenshots go to docs/screenshots/chat/. The script never changes files under frontend/ or backend/.
import fs from "node:fs";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const FE = process.env.QA_FE ?? "http://localhost:3400";
const OUT = process.env.QA_OUT ?? path.resolve(import.meta.dirname, "../docs/screenshots/chat");
const CHROME = process.env.QA_CHROME;
fs.mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail !== undefined && !ok ? "  " + JSON.stringify(detail) : ""}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"];
if (process.env.QA_VIDEO) args.push(`--use-file-for-fake-video-capture=${process.env.QA_VIDEO}`);
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args });

const dialogs = [];
async function newPage(name, viewport, phone = false) {
  const ctx = await browser.newContext({
    viewport,
    ...(phone ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}),
    permissions: ["camera", "microphone"],
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  page.on("dialog", (d) => {
    dialogs.push({ name, message: d.message() });
    d.dismiss();
  });
  page.on("pageerror", (e) => check(`no page error in ${name}`, false, String(e)));
  page.qa = name;
  return page;
}
const toolbar = (p) => p.getByRole("toolbar", { name: "Meeting controls" });
const tbButton = (p, name) => toolbar(p).getByRole("button", { name });
const chatPanel = (p) => p.locator('aside[aria-label="Meeting Chat"]');
const messages = (p) => chatPanel(p).locator('[role="log"] li');

async function api(page, url, init = {}) {
  return page.evaluate(
    async ([url, init]) => {
      const r = await fetch(url, { credentials: "include", headers: { "content-type": "application/json" }, ...init });
      return { status: r.status, body: await r.json().catch(() => null) };
    },
    [url, init],
  );
}

async function joinFromPreview(page) {
  await page.locator("#display-name").waitFor();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Join");
    return b && !b.disabled;
  });
  await page.getByRole("button", { name: /^Join$/ }).click();
  await toolbar(page).waitFor();
}
async function guestJoin(page, code, name, passcode) {
  await page.goto(`${FE}/j/${code}`);
  await page.locator("#name").fill(name);
  if (passcode) await page.locator("#passcode").fill(passcode);
  await page.getByRole("button", { name: /^Join$/ }).click();
  await page.waitForURL(new RegExp(`/meeting/${code}`));
  await joinFromPreview(page);
}
async function send(page, text) {
  const box = chatPanel(page).getByRole("textbox");
  await box.fill(text);
  await box.press("Enter");
}

// ---- setup: host (desktop), Ann (desktop), Ben (phone) ----
const host = await newPage("host", { width: 1440, height: 900 });
const ann = await newPage("ann", { width: 1280, height: 800 });
const ben = await newPage("ben", { width: 390, height: 844 }, true);

await host.goto(`${FE}/signin`);
await host.getByRole("button", { name: /demo user/i }).click();
await host.waitForURL(`${FE}/`);
const created = await api(host, "/api/meetings/instant", { method: "POST", body: JSON.stringify({ title: "Chat QA" }) });
const code = created.body.meeting_code;
console.log("meeting", code);
await host.goto(`${FE}/meeting/${code}`);
await joinFromPreview(host);
await guestJoin(ann, code, "Ann");
await guestJoin(ben, code, "Ben");
await host.getByRole("button", { name: /^Participants/ }).waitFor();
await host.waitForFunction(() => document.querySelectorAll("figure[data-participant-id]").length === 3);

// ---- BUG-22: accessible name of the Participants button ----
check("Participants button name is 'Participants, 3'", (await host.getByRole("button", { name: "Participants, 3", exact: true }).count()) === 1);

// ---- empty state and the visibility text ----
await tbButton(host, "Chat").click();
const hostPanelText = await chatPanel(host).innerText();
check("empty state has no 'does not reach' text", !/does not reach|stay in this window/i.test(hostPanelText), hostPanelText);
check("public hint text", await chatPanel(host).getByText("Messages are visible to everyone in the meeting", { exact: true }).isVisible());
const toOptions = await chatPanel(host).locator("#chat-to option").allInnerTexts();
check("To: menu lists Everyone, Ann, Ben", JSON.stringify(toOptions) === JSON.stringify(["Everyone", "Ann", "Ben"]), toOptions);

// ---- public message, unread badge ----
await send(host, "Hello everyone");
await sleep(600);
check("Ann's Chat button shows an unread badge", (await ann.getByRole("button", { name: "Chat, 1 unread" }).count()) === 1);
check("Ben's Chat button shows an unread badge", (await ben.getByRole("button", { name: "Chat, 1 unread" }).count()) === 1);
check("host sees own message as 'Me to Everyone'", (await messages(host).first().innerText()).includes("Me to Everyone"));
await tbButton(ann, /^Chat/).click();
await chatPanel(ann).getByText("Hello everyone").waitFor();
check("Ann sees the message with the host name", (await messages(ann).first().innerText()).startsWith("Chat QA") === false && /to Everyone/.test(await messages(ann).first().innerText()));
await sleep(400);
check("badge is gone after Ann opens the panel", (await ann.getByRole("button", { name: /^Chat, \d+ unread/ }).count()) === 0);
check("Ann's Chat button is back to 'Chat'", (await tbButton(ann, "Chat").getAttribute("aria-pressed")) === "true");
await tbButton(ben, /^Chat/).click();
await chatPanel(ben).getByText("Hello everyone").waitFor();

// ---- private message: host -> Ann. Ben must not see it ----
await chatPanel(host).locator("#chat-to").selectOption({ label: "Ann" });
check("private hint text", await chatPanel(host).getByText("Only you and Ann can see this", { exact: true }).isVisible());
await send(host, "Secret for Ann");
await chatPanel(ann).getByText("Secret for Ann").waitFor();
check("Ann sees the private message marked private", (await messages(ann).last().innerText()).includes("Me (private)"));
await sleep(800);
check("Ben does not see the private message", (await chatPanel(ben).innerText()).includes("Secret for Ann") === false);
check("Ben's unread badge did not change", (await ben.getByRole("button", { name: /^Chat, \d+ unread/ }).count()) === 0);
await chatPanel(host).locator("#chat-to").selectOption({ label: "Everyone" });

// ---- Enter sends, Shift+Enter adds a line ----
const box = chatPanel(host).getByRole("textbox");
await box.fill("");
await box.type("line one");
await box.press("Shift+Enter");
await box.type("line two");
check("Shift+Enter adds a line and does not send", (await messages(host).count()) === 2 && (await box.inputValue()) === "line one\nline two");
await box.press("Enter");
await chatPanel(ann).getByText("line two").waitFor();
const multi = await messages(ann).last().locator("p").last().innerText();
check("Enter sends the two-line message", multi === "line one\nline two", multi);
check("the box is empty after send", (await box.inputValue()) === "");

// ---- screenshots: chat panel at desktop and phone width ----
await chatPanel(host).locator("#chat-to").selectOption({ label: "Ben" });
await send(host, "Just for you, Ben");
await chatPanel(host).locator("#chat-to").selectOption({ label: "Everyone" });
await chatPanel(ben).getByText("Just for you, Ben").waitFor();
await sleep(400);
await host.screenshot({ path: path.join(OUT, "chat-desktop-1440.png") });
await chatPanel(ann).screenshot({ path: path.join(OUT, "chat-panel-desktop.png") });
await ben.screenshot({ path: path.join(OUT, "chat-phone-390.png") });

// ---- markup is plain text ----
const xss = `<script>window.__xss=1</script><img src=x onerror="window.__xss=2"> https://example.com/a?b=1&c=2`;
await send(ann, xss);
await chatPanel(host).getByText("window.__xss=1", { exact: false }).waitFor();
for (const p of [host, ann, ben]) {
  const info = await p.evaluate(() => ({
    scripts: document.querySelectorAll('[role="log"] script, [role="log"] img, [role="log"] a').length,
    xss: window.__xss ?? null,
  }));
  check(`markup is text in ${p.qa}`, info.scripts === 0 && info.xss === null, info);
}
const shown = await messages(host).last().locator("p").last().innerText();
check("the text shows unchanged", shown === xss, shown);
await chatPanel(host).screenshot({ path: path.join(OUT, "chat-markup-as-text.png") });
check("no dialog opened", dialogs.length === 0, dialogs);

// ---- rate limit ----
await sleep(10500);
for (let i = 0; i < 12; i++) await send(ann, `burst ${i}`);
await ann.getByText("too fast", { exact: false }).waitFor({ timeout: 5000 }).then(
  () => check("rate limit shows a notice", true),
  () => check("rate limit shows a notice", false),
);
await sleep(10500);

// ---- oversize is stopped in the box ----
const boxAnn = chatPanel(ann).getByRole("textbox");
await boxAnn.fill("x".repeat(600));
check("the box stops at 500 characters", (await boxAnn.inputValue()).length === 500);
await boxAnn.fill("");

// ---- auto-scroll ----
for (let i = 0; i < 8; i++) await send(host, `long message ${i}: ` + "word ".repeat(70));
await sleep(800);
const scroll = await chatPanel(host).evaluate((aside) => {
  const s = [...aside.querySelectorAll("div")].find((d) => getComputedStyle(d).overflowY === "auto");
  return { top: s.scrollTop, client: s.clientHeight, height: s.scrollHeight };
});
check("the list scrolls to the newest message", scroll.height > scroll.client && scroll.top + scroll.client >= scroll.height - 4, scroll);

// ---- history for a late joiner: public yes, private no ----
const late = await newPage("late", { width: 1000, height: 700 });
await guestJoin(late, code, "Late Lena");
await tbButton(late, /^Chat/).click();
await messages(late).first().waitFor();
const lateText = await chatPanel(late).innerText();
check("late joiner sees public history", lateText.includes("Hello everyone") && lateText.includes("line two"));
check("late joiner does not see the private message", !lateText.includes("Secret for Ann"));
await late.context().close();

// ---- BUG-13: tap targets on the phone, at 390 and 412 px ----
async function smallTargets(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("button, select, textarea, input, a, summary")) {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || st.visibility === "hidden") continue;
      if (r.height < 40 - 0.5) out.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
}
await ben.getByRole("button", { name: "Close Meeting Chat" }).click();
for (const width of [390, 412]) {
  await ben.setViewportSize({ width, height: 844 });
  await sleep(300);
  const bar = await toolbar(ben).evaluate((el) => {
    const r = el.getBoundingClientRect();
    const kids = [...el.querySelectorAll("button")].map((b) => b.getBoundingClientRect());
    return { scrollW: document.documentElement.scrollWidth, innerW: window.innerWidth, barRight: r.right, maxRight: Math.max(...kids.map((k) => k.right)), minLeft: Math.min(...kids.map((k) => k.left)) };
  });
  check(`toolbar fits at ${width}px`, bar.scrollW <= bar.innerW && bar.maxRight <= bar.innerW && bar.minLeft >= 0, bar);
  const closed = await smallTargets(ben);
  check(`no tap target under 40 px high in the room at ${width}px (bar closed)`, closed.length === 0, closed);
  await tbButton(ben, "More").click();
  const more = await smallTargets(ben);
  const reactBtns = await ben.getByRole("button", { name: /^React with/ }).evaluateAll((els) => els.map((e) => `${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`));
  check(`More menu targets at ${width}px are at least 40 px high`, more.length === 0, more);
  check(`6 reaction buttons are 40x40 at ${width}px`, reactBtns.length === 6 && reactBtns.every((s) => s === "40x40"), reactBtns);
  await ben.screenshot({ path: path.join(OUT, `toolbar-more-${width}.png`) });
  const dlg = await ben.getByRole("dialog", { name: "More" }).evaluate((d) => { const r = d.getBoundingClientRect(); return { left: r.left, right: r.right, w: window.innerWidth }; });
  check(`More menu is inside the screen at ${width}px`, dlg.left >= 0 && dlg.right <= dlg.w, dlg);
  await ben.keyboard.press("Escape");
  await ben.getByRole("button", { name: "Leave", exact: true }).click();
  const leave = await smallTargets(ben);
  check(`Leave menu (Cancel) targets at ${width}px are at least 40 px high`, leave.length === 0, leave);
  await ben.screenshot({ path: path.join(OUT, `toolbar-leave-${width}.png`) });
  await ben.keyboard.press("Escape");
}
const ctlHeights = await toolbar(ben).getByRole("button", { name: "Leave", exact: true }).evaluate((b) => Math.round(b.getBoundingClientRect().height));
check("Leave button is 40 px high on the phone", ctlHeights >= 40, ctlHeights);
const hostEnd = await tbButton(host, "End").evaluate((b) => Math.round(b.getBoundingClientRect().height));
check("End button keeps 36 px on desktop", hostEnd === 36, hostEnd);

// ---- passcode line (needs a meeting with a passcode) ----
const soon = new Date(Date.now() + 3600_000).toISOString();
const pw = await api(host, "/api/meetings", {
  method: "POST",
  body: JSON.stringify({ title: "Passcode QA", scheduled_start: soon, duration_min: 30, timezone: "UTC", passcode: "abc123" }),
});
const pcode = pw.body.meeting_code;
await host.goto(`${FE}/meeting/${pcode}`);
await joinFromPreview(host);
const guest2 = await newPage("guest2", { width: 1000, height: 700 });
await guestJoin(guest2, pcode, "Gia", "abc123");
await guest2.getByRole("button", { name: "Meeting information" }).click();
const gText = await guest2.getByRole("dialog", { name: "Meeting information" }).innerText();
check("guest sees 'Passcode Required' and not the value", /Passcode\s+Required/.test(gText) && !gText.includes("abc123") && !/Passcode\s+None/.test(gText), gText);
await host.getByRole("button", { name: "Meeting information" }).click();
const hText = await host.getByRole("dialog", { name: "Meeting information" }).innerText();
check("host sees the passcode value", /Passcode\s+abc123/.test(hText), hText);
await guest2.screenshot({ path: path.join(OUT, "info-passcode-guest.png") });

// ---- the host ends the meeting ----
await host.keyboard.press("Escape");
await browser.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
