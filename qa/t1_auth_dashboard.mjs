// Matrix items 1 (auth), 2 (dashboard) and 3 (instant meeting).
import { BE, FE, api, demoLogin, launch, mediaProbe, newPage, recorder, save, saveIssues, shot, sleep, tokens, joinFromPreview } from "./lib.mjs";

const { rows, check } = recorder();
const browser = await launch();
const T = tokens();

// ---------- 1. Auth ----------
{
  const page = await newPage(browser, { name: "anon" });
  for (const p of ["/", "/schedule"]) {
    await page.goto(`${FE}${p}`);
    await page.waitForLoadState("networkidle");
    check(`auth: logged-out ${p} redirects to /signin`, page.url().startsWith(`${FE}/signin`), { url: page.url() });
  }
  await shot(page, "signin-1440.png").catch(() => {});

  // A garbage session cookie passes the proxy (it only checks that the cookie exists).
  await page.context().addCookies([{ name: "session", value: "garbage", domain: "localhost", path: "/" }]);
  await page.goto(`${FE}/`);
  await sleep(2500);
  check("auth: invalid session cookie on / ends on /signin", page.url().includes("/signin"), {
    url: page.url(),
    text: (await page.locator("body").innerText()).slice(0, 200),
  });
  await page.context().clearCookies();

  // Demo login through the UI.
  await demoLogin(page);
  const me = await page.evaluate(async () => (await fetch("/api/me")).json());
  check("auth: demo login lands on / and /api/me is the demo user", me.is_demo === true && page.url() === `${FE}/`, me);
  const cookies = await page.context().cookies(FE);
  const session = cookies.find((c) => c.name === "session");
  check("auth: session cookie HttpOnly + SameSite=Lax", session?.httpOnly === true && session?.sameSite === "Lax", {
    httpOnly: session?.httpOnly,
    sameSite: session?.sameSite,
    secure: session?.secure,
    expiresInDays: session ? Math.round((session.expires - Date.now() / 1000) / 86400) : null,
  });

  // Logout through the profile menu.
  await page.getByRole("button", { name: /^Profile:/ }).click();
  await page.getByRole("menuitem", { name: /Sign out/ }).or(page.getByRole("button", { name: /Sign out/ })).first().click();
  await page.waitForURL(/\/signin/);
  const after = await page.evaluate(async () => (await fetch("/api/me")).status);
  await page.goto(`${FE}/`);
  check("auth: logout clears the session (/api/me 401, / -> /signin)", after === 401 && page.url().includes("/signin"), {
    meStatus: after,
    url: page.url(),
  });

  // Open redirect probe on the sign-in `next` parameter (client side).
  const probes = ["//evil.example/", "/%09/evil.example/", "/%5C/evil.example/", "https://evil.example/"];
  const redirects = {};
  for (const n of probes) {
    await page.context().clearCookies();
    await page.goto(`${FE}/signin?next=${n}`);
    await page.getByRole("button", { name: /demo user/i }).click();
    await sleep(2500);
    redirects[n] = page.url();
  }
  check(
    "auth: /signin?next= does not redirect off-site",
    Object.values(redirects).every((u) => u.startsWith(FE)),
    redirects,
  );
  await page.context().close();
}

// Google login endpoint (no real sign-in).
{
  const r = await fetch(`${FE}/api/auth/google/login?next=/schedule`, { redirect: "manual" });
  const loc = r.headers.get("location") ?? "";
  const u = loc ? new URL(loc) : null;
  check(
    "auth: /api/auth/google/login redirects to Google with client_id and redirect_uri",
    r.status >= 300 &&
      r.status < 400 &&
      u?.host === "accounts.google.com" &&
      !!u.searchParams.get("client_id") &&
      (u.searchParams.get("redirect_uri") ?? "").endsWith("/api/auth/google/callback"),
    {
      status: r.status,
      host: u?.host,
      hasClientId: !!u?.searchParams.get("client_id"),
      redirect_uri: u?.searchParams.get("redirect_uri"),
      scope: u?.searchParams.get("scope"),
      hasState: !!u?.searchParams.get("state"),
    },
  );
  const cb = await fetch(`${FE}/api/auth/google/callback?code=x&state=y`, { redirect: "manual" });
  check("auth: Google callback with a forged state gives a clean 400 (no 500)", cb.status === 400, {
    status: cb.status,
    body: (await cb.text()).slice(0, 200),
  });
}

// ---------- 2. Dashboard ----------
{
  const page = await newPage(browser, { name: "host-dash", userId: 1, viewport: { width: 1440, height: 900 } });
  await page.goto(`${FE}/`);
  await page.getByRole("heading", { name: "Upcoming" }).waitFor();
  await page.getByRole("heading", { name: "Upcoming" }).waitFor();
  await page.waitForFunction(() => !document.body.innerText.includes("Loading meetings..."));
  await shot(page, "dashboard-1440.png");
  const up = await page.evaluate(async () => (await fetch("/api/meetings/upcoming")).json());
  const rec = await page.evaluate(async () => (await fetch("/api/meetings/recent")).json());
  const upDom = await page.$$eval("section[aria-labelledby=upcoming-title] li", (els) => els.map((e) => e.innerText));
  const recDom = await page.$$eval("section[aria-labelledby=recent-title] li", (els) => els.map((e) => e.innerText));
  const code343 = (c) => `${c.slice(0, 3)} ${c.slice(3, 7)} ${c.slice(7)}`;
  const upMatch = up.length === upDom.length && up.every((m, i) => upDom[i].includes(code343(m.meeting_code)));
  const recMatch = rec.length === recDom.length && rec.every((m, i) => recDom[i].includes(code343(m.meeting_code)));
  check("dashboard: Upcoming matches the API (count and order)", upMatch, { api: up.length, dom: upDom.length });
  check("dashboard: Recent matches the API (count and order)", recMatch, { api: rec.length, dom: recDom.length });

  // Access badges.
  const badgeOk = up.every((m, i) => upDom[i].includes(m.access === "verified_only" ? "Verified" : "Guests"));
  check("dashboard: access badges match the API", badgeOk, {
    upcoming: up.map((m) => m.access),
    domBadges: upDom.map((t) => (t.includes("Verified") ? "verified" : t.includes("Guests") ? "guests" : "?")),
  });

  // Recent row labels for lapsed scheduled meetings (never started).
  const lapsed = rec.filter((m) => m.status === "scheduled");
  const lapsedRows = lapsed.map((m) => recDom[rec.indexOf(m)]);
  check("dashboard: a lapsed scheduled meeting (never started) is labeled correctly in Recent", lapsedRows.every((t) => !/\bEnded\b/.test(t)), {
    lapsed: lapsed.map((m) => ({ title: m.title, status: m.status })),
    rows: lapsedRows,
  });

  // Copy invite link.
  if (up.length > 0) {
    await page.getByRole("button", { name: `Copy invite link for ${up[0].title}` }).first().click();
    await sleep(300);
    const clip = await page.evaluate(() => navigator.clipboard.readText()).catch((e) => String(e));
    check("dashboard: copy invite link puts the host link (with ?pwd when set) on the clipboard", clip === up[0].invite_link, {
      clip,
      expected: up[0].invite_link,
    });
  }

  // Time zone display: same meeting in two browser time zones.
  if (up.length > 0) {
    const m = up[0];
    const out = {};
    for (const tz of ["America/New_York", "Asia/Kolkata"]) {
      const ctx = await browser.newContext({ timezoneId: tz, viewport: { width: 1440, height: 900 } });
      await ctx.addCookies([{ name: "session", value: T["1"], domain: "localhost", path: "/" }]);
      const p = await ctx.newPage();
      await p.goto(`${FE}/`);
      await p.getByRole("heading", { name: "Upcoming" }).waitFor();
  await p.waitForFunction(() => !document.body.innerText.includes("Loading meetings..."));
      const row = await p.$$eval("section[aria-labelledby=upcoming-title] li", (els) => els[0]?.innerText ?? "");
      const expected = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(
        new Date(m.scheduled_start),
      );
      out[tz] = { row: row.split("\n")[0], expectedStart: expected, ok: row.includes(expected) };
      await ctx.close();
    }
    check("dashboard: upcoming times follow the browser time zone", Object.values(out).every((x) => x.ok), out);
  }

  // Empty states (no user without meetings exists in the seed, so the API is mocked here).
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "session", value: T["4"], domain: "localhost", path: "/" }]);
  const p = await ctx.newPage();
  await p.route("**/api/meetings/upcoming", (r) => r.fulfill({ json: [] }));
  await p.route("**/api/meetings/recent**", (r) => r.fulfill({ json: [] }));
  await p.goto(`${FE}/`);
  await p.getByRole("heading", { name: "Upcoming" }).waitFor();
  await p.waitForFunction(() => !document.body.innerText.includes("Loading meetings..."));
  const body = await p.locator("body").innerText();
  check(
    "dashboard: empty states (mocked API) show friendly text",
    body.includes("No upcoming meetings") && body.includes("no recent meetings"),
    { snippet: body.slice(0, 400) },
  );
  await shot(p, "dashboard-empty-1440.png");
  // Error state: API returns 500.
  await p.unroute("**/api/meetings/upcoming");
  await p.route("**/api/meetings/upcoming", (r) => r.fulfill({ status: 500, json: { detail: "boom", code: "http_error" } }));
  await p.reload();
  await sleep(2500);
  const eb = await p.locator("section[aria-labelledby=upcoming-title]").innerText();
  check("dashboard: upcoming error state shows a retry", /try again|retry/i.test(eb), { text: eb.slice(0, 200) });
  await ctx.close();
  await page.context().close();
}

// ---------- 3. Instant meeting ----------
{
  const page = await newPage(browser, { name: "host-instant", userId: 1, viewport: { width: 1440, height: 900 } });
  await page.goto(`${FE}/`);
  const t0 = Date.now();
  await page.getByRole("button", { name: /New Meeting/ }).click();
  await page.waitForURL(/\/meeting\/\d+/);
  const code = page.url().split("/meeting/")[1].split(/[?#]/)[0];
  check("instant: New Meeting opens /meeting/<10 digits>", /^\d{10}$/.test(code), { code, ms: Date.now() - t0 });
  const look = await api("GET", `/api/meetings/${code}`);
  check("instant: meeting is live right after creation", look.body.status === "live", look.body);
  await page.locator("#display-name").waitFor();
  await sleep(1500);
  await shot(page, "prejoin-1440.png");
  await joinFromPreview(page);
  await sleep(1500);
  await shot(page, "room-1tile-1440.png");
  await page.getByRole("button", { name: "Meeting information" }).click();
  await sleep(400);
  const info = await page.locator("body").innerText();
  const grouped = `${code.slice(0, 3)} ${code.slice(3, 7)} ${code.slice(7)}`;
  check("instant: info popover shows 3-4-3 code, invite link, passcode row", info.includes(grouped) && info.includes(`/j/${code}`) && /Passcode\s*\n?\s*None/.test(info), {
    grouped,
    hasLink: info.includes(`/j/${code}`),
  });
  await shot(page, "room-info-popover-1440.png");
  await page.keyboard.press("Escape");
  // End the meeting so it does not stay live.
  const end = await api("POST", `/api/meetings/${code}/end`, { cookie: T["1"] });
  check("instant: host can end via API", end.status === 200, { status: end.status });
  await sleep(1500);
  await page.context().close();
}

save("t1_auth_dashboard", rows);
saveIssues("t1");
await browser.close();
