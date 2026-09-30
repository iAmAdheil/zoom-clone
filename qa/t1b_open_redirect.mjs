// Confirms the open redirect on /signin?next=/%09/evil.example after demo login.
import { FE, launch, newPage, recorder, save, shot, sleep } from "./lib.mjs";

const { rows, check } = recorder();
const browser = await launch();
const page = await newPage(browser, { name: "anon-redirect" });
const seen = [];
await page.route("**://evil.example/**", (r) => {
  seen.push(r.request().url());
  return r.fulfill({ status: 200, contentType: "text/html", body: "<title>evil</title><h1>evil.example page</h1>" });
});
for (const next of ["/%09/evil.example/", "/%0a/evil.example/", "/%0d/evil.example/"]) {
  await page.context().clearCookies();
  await page.goto(`${FE}/signin?next=${next}`);
  await page.getByRole("button", { name: /demo user/i }).click();
  await sleep(2500);
  check(`open redirect: /signin?next=${next} stays on the site after demo login`, page.url().startsWith(FE), { final: page.url() });
  if (!page.url().startsWith(FE)) await shot(page, `bug-open-redirect-${next.replace(/[^a-z0-9]/gi, "")}.png`);
}
check("open redirect: requests that reached evil.example", seen.length === 0, { seen });
save("t1b_open_redirect", rows);
await browser.close();
