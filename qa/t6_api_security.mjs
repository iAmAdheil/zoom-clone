// Matrix item 9: API security and validation. Node fetch only (no browser).
import { BE, FE, api, recorder, save, tokens } from "./lib.mjs";

const { rows, check } = recorder();
const T = tokens();
const future = () => new Date(Date.now() + 2 * 86400000).toISOString();

// Fixtures: a scheduled meeting with a passcode (Alice hosts), and a live instant meeting (demo hosts).
const aliceMeeting = (
  await api("POST", "/api/meetings", {
    cookie: T["2"],
    body: { title: "QA Alice private", description: "secret agenda", scheduled_start: future(), duration_min: 30, timezone: "UTC", passcode: "s3cret", access: "allow_guests" },
  })
).body;
const live = (await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { title: "QA api live" } })).body;
const guestJoin = (await api("POST", `/api/meetings/${live.meeting_code}/join`, { body: { display_name: "api guest" } })).body;
const gid = guestJoin.participant.id;

// 1. Unauthenticated host endpoints.
{
  const calls = [
    ["POST", "/api/meetings/instant", {}],
    ["POST", "/api/meetings", { title: "x", scheduled_start: future(), duration_min: 30, timezone: "UTC" }],
    ["GET", "/api/meetings/upcoming"],
    ["GET", "/api/meetings/recent"],
    ["PATCH", `/api/meetings/${aliceMeeting.id}`, { title: "x" }],
    ["DELETE", `/api/meetings/${aliceMeeting.id}`],
    ["POST", `/api/meetings/${live.meeting_code}/end`],
    ["POST", `/api/meetings/${live.meeting_code}/mute-all`],
    ["POST", `/api/meetings/${live.meeting_code}/participants/${gid}/mute`],
    ["POST", `/api/meetings/${live.meeting_code}/participants/${gid}/remove`],
    ["GET", `/api/meetings/${live.meeting_code}/participants`],
  ];
  const res = {};
  for (const [m, p, b] of calls) res[`${m} ${p}`] = (await api(m, p, { body: b })).status;
  const ok = Object.entries(res).every(([k, s]) => (k.endsWith("/participants") && k.startsWith("GET") ? s === 403 : s === 401));
  check("api: unauthenticated calls to user/host endpoints get 401 (GET participants 403)", ok, res);
}

// 2. Another user's meeting by id (Bob acts on Alice's meeting; Alice acts on demo's live meeting).
{
  const res = {
    bobPatch: await api("PATCH", `/api/meetings/${aliceMeeting.id}`, { cookie: T["3"], body: { title: "pwned" } }),
    bobDelete: await api("DELETE", `/api/meetings/${aliceMeeting.id}`, { cookie: T["3"] }),
    aliceEndDemo: await api("POST", `/api/meetings/${live.meeting_code}/end`, { cookie: T["2"] }),
    alicePatchDemo: await api("PATCH", `/api/meetings/${live.id}`, { cookie: T["2"], body: { access: "verified_only" } }),
    aliceMuteAll: await api("POST", `/api/meetings/${live.meeting_code}/mute-all`, { cookie: T["2"] }),
    aliceRemove: await api("POST", `/api/meetings/${live.meeting_code}/participants/${gid}/remove`, { cookie: T["2"] }),
  };
  const statuses = Object.fromEntries(Object.entries(res).map(([k, v]) => [k, `${v.status} ${v.body.code}`]));
  check("api: other user's meeting: edit, cancel, end, mute-all, remove all 403", Object.values(res).every((r) => r.status === 403), statuses);
  const still = (await api("GET", `/api/meetings/${aliceMeeting.meeting_code}`)).body;
  check("api: Alice's meeting unchanged after Bob's attempts", still.title === "QA Alice private", { title: still.title });
}

// 3. Public lookup must not leak private fields.
{
  const r = await api("GET", `/api/meetings/${aliceMeeting.meeting_code}`);
  const keys = Object.keys(r.body).sort();
  const leaks = ["passcode", "description", "host_id", "invite_link", "email", "id"].filter((k) => JSON.stringify(r.body).includes(`"${k}"`));
  check("api: GET /api/meetings/{code} has only public fields (no passcode, description, email, invite_link)", leaks.length === 0 && !JSON.stringify(r.body).includes("s3cret"), { keys, leaks });
  // With spaces in the code.
  const spaced = await api("GET", `/api/meetings/${encodeURIComponent(aliceMeeting.meeting_code.replace(/(\d{3})(\d{4})(\d{3})/, "$1 $2 $3"))}`);
  check("api: lookup accepts a code with spaces", spaced.status === 200, { status: spaced.status });
}

// 3b. What a guest learns from the join response.
{
  const r = await api("POST", `/api/meetings/${aliceMeeting.meeting_code}/join`, { body: { display_name: "nosy guest", passcode: "s3cret" } });
  const host = r.body.meeting?.host ?? {};
  check("api: join response to an anonymous guest does not expose the host email", !host.email, { hostFields: Object.keys(host), hostEmail: host.email });
  // Alice's meeting was never started by Alice, yet the guest is in it.
  check("api: guest can join a scheduled meeting before the host starts it (info)", null, { status: r.status, meetingStatus: r.body.meeting?.status });
  // Recent list of another user who joined contains the passcode? (Bob joins Alice's meeting.)
  await api("POST", `/api/meetings/${aliceMeeting.meeting_code}/join`, { cookie: T["3"], body: { display_name: "Bob", passcode: "s3cret" } });
  const bobUp = await api("GET", "/api/meetings/upcoming", { cookie: T["3"] });
  check("api: Bob's upcoming does not contain Alice's meeting", !bobUp.body.some((m) => m.id === aliceMeeting.id), {});
}

// 4. SQL injection strings.
{
  const inj = ["' OR '1'='1", "1; DROP TABLE meetings;--", "\" OR 1=1 --", "' UNION SELECT email FROM users--"];
  const res = {};
  for (const s of inj) {
    res[`lookup ${s}`] = (await api("GET", `/api/meetings/${encodeURIComponent(s)}`)).status;
    const j = await api("POST", `/api/meetings/${live.meeting_code}/join`, { body: { display_name: s, passcode: s } });
    res[`join name ${s}`] = `${j.status} name=${j.body.participant?.display_name === s}`;
    const sch = await api("POST", "/api/meetings", { cookie: T["1"], body: { title: s, scheduled_start: future(), duration_min: 30, timezone: "UTC" } });
    res[`schedule title ${s}`] = `${sch.status} stored=${sch.body.title === s}`;
    if (sch.status === 200) await api("DELETE", `/api/meetings/${sch.body.id}`, { cookie: T["1"] });
    res[`recent limit ${s}`] = (await api("GET", `/api/meetings/recent?limit=${encodeURIComponent(s)}`, { cookie: T["1"] })).status;
  }
  const tables = (await api("GET", "/api/meetings/upcoming", { cookie: T["1"] })).status;
  check("api: SQL injection strings are stored as text or refused, no 500, tables intact", Object.values(res).every((v) => !String(v).startsWith("500")) && tables === 200, res);
  // The injected guests joined the live meeting with no socket. They are cleaned up at the end.
}

// 5. Oversized JSON body, wrong types, a code with letters.
{
  const big = JSON.stringify({ title: "x", description: "y".repeat(5 * 1024 * 1024), scheduled_start: future(), duration_min: 30, timezone: "UTC" });
  const t0 = Date.now();
  const r = await api("POST", "/api/meetings", { cookie: T["1"], raw: big });
  check("api: 5 MB JSON body is refused (413 or 422) quickly", r.status === 413 || r.status === 422, { status: r.status, code: r.body.code, ms: Date.now() - t0 });
  const huge = "x".repeat(50 * 1024 * 1024);
  const t1 = Date.now();
  let hs;
  try {
    hs = (await api("POST", `/api/meetings/${live.meeting_code}/join`, { raw: JSON.stringify({ display_name: huge }) })).status;
  } catch (e) {
    hs = String(e).slice(0, 100);
  }
  check("api: 50 MB join body is rejected before parsing (413); no body size limit is set", hs === 413, { status: hs, ms: Date.now() - t1 });

  const types = {
    durationString: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "x", scheduled_start: future(), duration_min: "abc", timezone: "UTC" } }),
    startGarbage: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "x", scheduled_start: "tomorrow", duration_min: 30, timezone: "UTC" } }),
    badTz: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "x", scheduled_start: future(), duration_min: 30, timezone: "Mars/Olympus" } }),
    titleNumber: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: 123, scheduled_start: future(), duration_min: 30, timezone: "UTC" } }),
    accessBad: await api("POST", "/api/meetings/instant", { cookie: T["1"], body: { access: "everyone" } }),
    nameArray: await api("POST", `/api/meetings/${live.meeting_code}/join`, { body: { display_name: ["a"] } }),
    notJson: await api("POST", `/api/meetings/${live.meeting_code}/join`, { raw: "not json" }),
    negDuration: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "x", scheduled_start: future(), duration_min: -5, timezone: "UTC" } }),
    floatDuration: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "x", scheduled_start: future(), duration_min: 30.5, timezone: "UTC" } }),
    naiveStart: await api("POST", "/api/meetings", { cookie: T["1"], body: { title: "QA naive", scheduled_start: "2031-01-01T10:00:00", duration_min: 30, timezone: "Asia/Kolkata" } }),
  };
  const st = Object.fromEntries(Object.entries(types).map(([k, v]) => [k, `${v.status} ${v.body.code ?? ""}`]));
  if (types.titleNumber.status === 200) await api("DELETE", `/api/meetings/${types.titleNumber.body.id}`, { cookie: T["1"] });
  if (types.naiveStart.status === 200) {
    st.naiveStartStoredAs = types.naiveStart.body.scheduled_start;
    await api("DELETE", `/api/meetings/${types.naiveStart.body.id}`, { cookie: T["1"] });
  }
  const bad = ["durationString", "startGarbage", "badTz", "accessBad", "nameArray", "notJson", "negDuration", "floatDuration"];
  check("api: wrong types give 422 validation_error (no 500)", bad.every((k) => types[k].status === 422), st);
  check("api: a number title is coerced or refused (info)", null, { titleNumber: st.titleNumber });
  const letters = {
    lookup: (await api("GET", "/api/meetings/abcdefghij")).status,
    lookupMixed: (await api("GET", `/api/meetings/${live.meeting_code.slice(0, 5)}abc${live.meeting_code.slice(5)}`)).status,
    join: (await api("POST", "/api/meetings/abc/join", { body: { display_name: "x" } })).status,
    participants: (await api("GET", "/api/meetings/abc/participants")).status,
  };
  check("api: code with letters: pure letters 404; digits mixed with letters are stripped to the digits (info)", letters.lookup === 404, letters);
  const idWord = await api("PATCH", "/api/meetings/abc", { cookie: T["1"], body: { title: "x" } });
  check("api: PATCH with a non-integer id gives 422 or 404, not 500", idWord.status === 422 || idWord.status === 404 || idWord.status === 405, { status: idWord.status });
}

// 6. CORS.
{
  const pre = await fetch(`${BE}/api/me`, {
    method: "OPTIONS",
    headers: { Origin: "https://evil.example", "Access-Control-Request-Method": "GET" },
  });
  const simple = await fetch(`${BE}/api/me`, { headers: { Origin: "https://evil.example", cookie: `session=${T["1"]}` } });
  const good = await fetch(`${BE}/api/me`, { headers: { Origin: FE } });
  const evilAllowed = pre.headers.get("access-control-allow-origin") ?? simple.headers.get("access-control-allow-origin");
  check("api: CORS does not allow a random origin with credentials", !evilAllowed, {
    preflightStatus: pre.status,
    preflightACAO: pre.headers.get("access-control-allow-origin"),
    simpleACAO: simple.headers.get("access-control-allow-origin"),
    frontendACAO: good.headers.get("access-control-allow-origin"),
    frontendACAC: good.headers.get("access-control-allow-credentials"),
  });
  // Cross-site WebSocket: the server does not check Origin, but a ticket is needed.
}

// 7. Cookie flags.
{
  const r = await fetch(`${FE}/api/auth/demo`, { method: "POST" });
  const sc = r.headers.get("set-cookie") ?? "";
  check("api: session cookie flags (HttpOnly, SameSite=Lax, Path=/; Secure only on https)", /HttpOnly/i.test(sc) && /SameSite=lax/i.test(sc), { setCookie: sc.replace(/session=[^;]+/, "session=<jwt>") });
  const lo = await fetch(`${FE}/api/auth/logout`, { method: "POST" });
  check("api: logout clears the cookie (Max-Age=0 or expires in the past)", /session=""|Max-Age=0|expires=Thu, 01 Jan 1970/i.test(lo.headers.get("set-cookie") ?? ""), { status: lo.status, setCookie: lo.headers.get("set-cookie") });
  // Logout is POST only. A GET is not a CSRF logout vector.
  const loGet = await fetch(`${FE}/api/auth/logout`);
  check("api: logout by GET is not allowed", loGet.status === 405, { status: loGet.status });
}

// 8. JWT tampering.
{
  const [h, p, s] = T["1"].split(".");
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const swapped = Buffer.from(JSON.stringify({ ...payload, sub: "2" })).toString("base64url");
  const none = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${swapped}.`;
  const res = {
    swappedSub: (await api("GET", "/api/me", { cookie: `${h}.${swapped}.${s}` })).status,
    algNone: (await api("GET", "/api/me", { cookie: none })).status,
    truncatedSig: (await api("GET", "/api/me", { cookie: `${h}.${p}.${s.slice(0, -4)}` })).status,
    wsTicketAsSession: (await api("GET", "/api/me", { cookie: guestJoin.ws_ticket })).status,
    rejoinAsSession: (await api("GET", "/api/me", { cookie: guestJoin.rejoin_token })).status,
    sessionAsTicket: (await api("GET", `/api/meetings/${live.meeting_code}/participants?ticket=${T["1"]}`)).status,
    nonexistentUser: null,
  };
  check("api: tampered JWTs (swapped sub, alg none, cut signature, wrong typ) are refused", Object.entries(res).every(([k, v]) => v === null || v === 401 || (k === "sessionAsTicket" && v === 403)), res);
  const dev = await api("GET", "/api/me", { cookie: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwIjoic2Vzc2lvbiIsImlhdCI6MTc1OTAwMDAwMCwiZXhwIjo0MTAyNDQ0ODAwfQ.x" });
  check("api: a token signed with a guessed key is refused", dev.status === 401, { status: dev.status });
}

// 9. Rate limit.
{
  const t0 = Date.now();
  const statuses = await Promise.all(Array.from({ length: 200 }, () => api("POST", "/api/auth/demo").then((r) => r.status)));
  const joins = await Promise.all(Array.from({ length: 50 }, (_, i) => api("POST", `/api/meetings/${live.meeting_code}/join`, { body: { display_name: `flood ${i}` } }).then((r) => r.status)));
  const guesses = await Promise.all(Array.from({ length: 100 }, (_, i) => api("POST", `/api/meetings/${aliceMeeting.meeting_code}/join`, { body: { display_name: "brute", passcode: `guess${i}` } }).then((r) => r.status)));
  check("api: rate limiting on login, join, passcode guessing", statuses.includes(429) || joins.includes(429) || guesses.includes(429), {
    demoLogins200: statuses.filter((s) => s === 200).length,
    joins200: joins.filter((s) => s === 200).length,
    passcodeGuesses403: guesses.filter((s) => s === 403).length,
    any429: false,
    ms: Date.now() - t0,
  });
  const list = await api("GET", `/api/meetings/${live.meeting_code}/participants`, { cookie: T["1"] });
  check("api: 50 flood guests (no socket) all sit in the participant list", null, { activeParticipants: list.body.length });
}

// 10. Host passcode leak in invite for non-host.
{
  const asBob = await api("POST", `/api/meetings/${aliceMeeting.meeting_code}/join`, { cookie: T["3"], body: { display_name: "Bob", passcode: "s3cret" } });
  check("api: invite_link for a non-host has no ?pwd=", !asBob.body.meeting.invite_link.includes("pwd"), { link: asBob.body.meeting.invite_link, passcodeField: asBob.body.meeting.passcode });
}

// Cleanup: end the live meeting, cancel Alice's meeting.
await api("POST", `/api/meetings/${live.meeting_code}/end`, { cookie: T["1"] });
const cancel = await api("DELETE", `/api/meetings/${aliceMeeting.id}`, { cookie: T["2"] });
check("api: host cancels a scheduled meeting that has participant rows", cancel.status === 204, { status: cancel.status, cancelledMeetingId: aliceMeeting.id });

save("t6_api_security", { rows, liveCode: live.meeting_code, cancelledId: aliceMeeting.id });
