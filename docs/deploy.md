# Deploy guide

Backend on Render (free web service, Docker). Frontend on Vercel.

The two services need each other's URL. Follow the steps in this order.

1. Render: create the backend.
2. Vercel: create the frontend with the Render URL.
3. Render: set `FRONTEND_ORIGIN` to the Vercel URL.
4. Google Cloud: add the redirect URI.
5. Run the post-deploy checklist.

Never commit real secret values. Put them only in the Render and Vercel dashboards.

## How the pieces connect

- The browser calls `/api/*` on the Vercel origin. Next.js rewrites forward the call to `BACKEND_URL` (the Render URL).
- The WebSocket goes straight to Render with `NEXT_PUBLIC_WS_URL` (`wss://...`).
- The backend allows CORS and WebSocket connections only from `FRONTEND_ORIGIN`.

## 1. Render (backend)

Before you start: the repo must be on GitHub, and `render.yaml` must be on the branch you deploy.

1. Sign in at https://dashboard.render.com. Use "Sign in with GitHub".
2. Click **New +** at the top right. Click **Blueprint**.
3. Click **Connect a repository** and allow Render to read your repo. Pick this repo.
4. Pick the branch (`main`). Render finds `render.yaml` at the repo root.
5. Give the blueprint a name, for example `zoom-clone`.
6. Render asks for the values that have `sync: false`:
   - `FRONTEND_ORIGIN`: type a placeholder now, for example `https://zoom-clone.vercel.app`. You fix it in step 3.
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: paste the values from Google Cloud, or leave them empty to turn Google sign-in off. Demo login still works.
7. Click **Apply** (or **Deploy Blueprint**). Render builds the Docker image. The first build takes a few minutes.
8. Open the service `zoom-clone-api`. Wait for the status **Live**.
9. Copy the service URL at the top of the page. It looks like `https://zoom-clone-api.onrender.com`. You need it in the next part.
10. Open `<render-url>/api/health` in a browser. You must see `{"status":"ok"}`.

Notes:

- The blueprint sets the free plan, region Singapore (change `region` in `render.yaml` to `oregon` if you prefer), the health check `/api/health`, `ENVIRONMENT=production` and `ENABLE_DEMO_LOGIN=true`.
- Render makes `JWT_SECRET` for you (`generateValue: true`). Do not change it after users sign in. A new secret ends every session.
- The container listens on the `PORT` that Render sets. `start.sh` runs `alembic upgrade head`, seeds the demo data if there are no users, then starts uvicorn.
- Free Render has no persistent disk. Every deploy and restart resets SQLite.

### Render environment variables

| Name | Value source | Example |
|---|---|---|
| `ENVIRONMENT` | Set in `render.yaml` | `production` |
| `ENABLE_DEMO_LOGIN` | Set in `render.yaml` | `true` |
| `JWT_SECRET` | Made by Render (`generateValue: true`) | (random, do not copy) |
| `FRONTEND_ORIGIN` | The Vercel URL. Use `https`. No trailing slash. | `https://zoom-clone.vercel.app` |
| `GOOGLE_CLIENT_ID` | Google Cloud Console, OAuth client | `1234-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console, OAuth client | (from Google) |
| `PORT` | Set by Render. Do not add it. | `10000` |
| `DATABASE_URL` | Optional. The default is a SQLite file in the container. | `sqlite:///./zoomclone.db` |

## 2. Vercel (frontend)

Before you start: you need the Render URL from step 1.

1. Sign in at https://vercel.com. Use "Continue with GitHub".
2. Click **Add New...**. Click **Project**.
3. Find this repo in the list. Click **Import**.
4. Under **Project Name**, type a name. Use `zoom-clone` if it is free. The URL becomes `https://<name>.vercel.app`.
5. Next to **Root Directory**, click **Edit**. Pick `frontend`. Click **Continue**.
6. Check **Framework Preset**. It must be **Next.js**.
7. Open **Environment Variables**. Add these before you click Deploy:
   - `BACKEND_URL` = the Render URL, no trailing slash.
   - `NEXT_PUBLIC_WS_URL` = the Render host with `wss://`, no trailing slash.
   - Optional: the three TURN variables (see the table).
8. Click **Deploy**. Wait for **Congratulations**.
9. Click **Continue to Dashboard**. Copy the production domain, for example `https://zoom-clone.vercel.app`.

Why you must set the variables first: `frontend/next.config.ts` reads `BACKEND_URL` when Next.js builds. The value goes into the rewrite rule. `NEXT_PUBLIC_*` values go into the browser bundle. If you add or change a variable after the build, open **Deployments**, click the three dots on the latest one, and click **Redeploy**. Vercel then builds again with the new values.

`frontend/vercel.json` is not needed. Next.js already has the rewrite in `next.config.ts`.

### Vercel environment variables

| Name | Value source | Example |
|---|---|---|
| `BACKEND_URL` | The Render service URL | `https://zoom-clone-api.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | The Render host, with `wss://` | `wss://zoom-clone-api.onrender.com` |
| `NEXT_PUBLIC_TURN_URL` | Optional. Your TURN provider. Separate many URLs with commas. | `turn:turn.example.com:3478?transport=udp` |
| `NEXT_PUBLIC_TURN_USERNAME` | Optional. Your TURN provider. | `turnuser` |
| `NEXT_PUBLIC_TURN_CREDENTIAL` | Optional. Your TURN provider. It is public in the bundle. Use a limited account. | (from provider) |

## 3. Render: set FRONTEND_ORIGIN

1. Go to the Render dashboard. Open `zoom-clone-api`.
2. Click **Environment** in the left menu.
3. Find `FRONTEND_ORIGIN`. Click **Edit**.
4. Paste the Vercel URL. Use `https`. No trailing slash. Example: `https://zoom-clone.vercel.app`.
5. Click **Save, rebuild, and deploy** (or **Save Changes**). Wait for **Live**.

The backend uses this value for CORS, the WebSocket origin check, invite links and the Google redirect URI.

## 4. Google OAuth

Skip this part if you do not use Google sign-in.

1. Open https://console.cloud.google.com/apis/credentials.
2. Click your OAuth client (type **Web application**). Or click **Create credentials**, then **OAuth client ID**, to make one.
3. Under **Authorized redirect URIs**, click **Add URI**.
4. Paste: `https://<your-vercel-domain>/api/auth/google/callback`. Example: `https://zoom-clone.vercel.app/api/auth/google/callback`.
5. Do not use the Render host here. The redirect must use the Vercel origin.
6. Click **Save**. Google can take a few minutes to apply the change.
7. Copy the client ID and secret. Put them in the Render env vars `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Save. Render deploys again.
8. If the OAuth consent screen is in **Testing** mode, add the reviewers' Google accounts under **Test users**. Or click **Publish app**.

## 5. Post-deploy checklist

Do these on the Vercel URL. Use a fresh browser profile.

- [ ] Health: `<render-url>/api/health` returns `{"status":"ok"}`. If the service slept, wait about a minute and try again.
- [ ] Proxy: `<vercel-url>/api/health` returns the same body. This proves the rewrite works.
- [ ] Demo login: open `<vercel-url>/signin`. Click **Continue as demo user**. The dashboard opens with sample meetings.
- [ ] Cookie: in browser dev tools, the `session` cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
- [ ] Google login: sign out. Click **Continue with Google**. Pick an account. You return to the dashboard. If Google shows `redirect_uri_mismatch`, check step 4.
- [ ] Create a meeting: click **New Meeting**. The room opens. The invite link starts with the Vercel URL.
- [ ] Two-browser join: copy the meeting ID. Open a second browser (or a private window). Join as a guest with a name. Both people see each other's video and hear audio. Check mute and video toggles.
- [ ] WebSocket: in dev tools, open **Network**, then **WS**. A connection to `wss://<render-host>/ws/meetings/<code>?ticket=...` shows status 101 and stays open. No `4403 origin_not_allowed` close.
- [ ] Host controls: mute the guest, then remove the guest. The guest sees the removed screen.

## Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| `/api/*` on Vercel returns 404 or 500 | `BACKEND_URL` was not set at build time | Set it. Redeploy on Vercel. |
| Browser shows a CORS error | `FRONTEND_ORIGIN` is wrong (trailing slash, `http`, wrong domain) | Fix it on Render. |
| WebSocket closes at once with `origin_not_allowed` | `FRONTEND_ORIGIN` does not match the page origin | Fix it on Render. |
| WebSocket does not connect | `NEXT_PUBLIC_WS_URL` is missing or uses `ws://` | Set `wss://...`. Redeploy on Vercel. |
| Google `redirect_uri_mismatch` | The redirect URI in Google differs from `<vercel-url>/api/auth/google/callback` | Fix it in Google Cloud. |
| Data disappeared | Render made a new container. SQLite is not persistent on the free plan. | Expected. Demo data is seeded again on start. |
| First request is very slow | Free Render sleeps after 15 minutes without traffic | Wait about a minute. |
| Video does not connect for some people | Strict NAT. Needs TURN. | Set the TURN variables. Redeploy on Vercel. |
