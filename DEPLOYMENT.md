# ITS — Deployment Guide

Guidelines for deploying the Internship Tracking System beyond a local demo. The
app is three independently deployable pieces:

```
React static build  ──HTTPS──▶  Express API  ──▶  PostgreSQL (managed)
(Vercel/Netlify/…)              (Railway/Render/…)     (Railway/Neon/RDS/…)
```

> The repo already contains a hint of a prior deployment:
> `frontend-new/.env.production` points at a Railway backend
> (`https://its-production-7427.up.railway.app/api`). Update or replace that with
> **your** backend URL before building — see §5.

---

## ⚠️ 1. Read this first — security hardening checklist

This project was prototyped quickly and is **not production-hardened**. Address
these before exposing it to real users. Several are quick wins.

- [ ] **Rotate the leaked email credential.** A real Gmail App Password was
  committed in git history (`backend/.env.example`). The current file is scrubbed,
  but **history still contains it** — revoke that App Password in the Google
  account now. Never commit real secrets; keep them in the host's env vars.
- [ ] **Set a strong `JWT_SECRET`** (≥32 random chars) as an environment variable,
  unique per environment. Never use the example value.
- [ ] **Add authentication/authorization to the management endpoints.** Currently
  these routes have **no auth middleware** and are world-callable:
  - `POST /api/create-commission-chair`, `POST /api/create-commission-member`,
    `DELETE /api/remove-commission-chair/:id`, `DELETE /api/remove-commission-member/:id`,
    `POST /api/assign-commission-chair` (department management)
  - `POST /api/kullanici`, `GET /api/kullanicilar` (user create/list)
  - `GET /api/terms`, `GET /api/students/...`, `GET /api/departments`,
    `GET /api/commission-status` (data reads)

  Gate the admin/department/user routes behind `authenticateToken` +
  `requireRole(['General Admin'])` the same way `gradingRoutes`/`internshipRoutes`
  already do.
- [ ] **Lock down CORS.** The server uses `app.use(cors())` (allow-all). Restrict
  it to your frontend origin — the `CLIENT_URL` env var exists for this but isn't
  wired up yet:
  ```js
  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  ```
- [ ] **Add `helmet` and rate-limiting** (e.g. `express-rate-limit` on `/login` and
  `/forgot-password`) to blunt brute-force and add security headers.
- [ ] **Serve only over HTTPS** (all the recommended hosts do this by default).
- [ ] **Validate/limit uploads** — PDF parsing already caps at 10MB and filters by
  mimetype; keep it auth-gated if you don't want anonymous PDF parsing.

---

## 2. Environment variables

### Backend

| Var | Required | Example / notes |
|-----|----------|-----------------|
| `DATABASE_URL` | ✅ | `postgresql://user:pass@host:5432/db?schema=public` (your managed Postgres connection string). Must also be present **at build time** — Prisma's config reads it during `generate`/`migrate`. |
| `JWT_SECRET` | ✅ | Long random string, unique per env. |
| `JWT_EXPIRE` | – | Token lifetime, default `7d`. |
| `PORT` | – | Most hosts inject this automatically; the app honors it (`process.env.PORT`). |
| `NODE_ENV` | – | `production`. |
| `CLIENT_URL` | rec. | Your frontend origin; use it to lock down CORS (see checklist). |
| `EMAIL_USER` / `EMAIL_PASS` | optional | Gmail address + **App Password** to actually email reset codes. If blank, password reset returns an unavailable message. |

### Frontend (build-time only — CRA inlines `REACT_APP_*` at build)

| Var | Required | Notes |
|-----|----------|-------|
| `REACT_APP_API_URL` | ✅ | Full URL to the deployed backend **including `/api`**, e.g. `https://api.example.com/api`. |

---

## 3. Database

Use a managed PostgreSQL (Railway, Neon, Supabase, RDS, etc.). Then apply the
existing migrations from `backend/` (do **not** use `migrate dev` in production):

```bash
npx prisma migrate deploy
```

Seeding is optional in production. The seed creates demo users with the public
password `password123` — **only** run `npm run prisma:seed` if you want demo data,
and change those passwords immediately. For a real deployment, create the first
admin manually instead.

> `migrate deploy` applies committed migrations but does **not** create the
> database — your managed provider supplies an empty database for the connection
> string.

---

## 4. Backend deployment (Express API)

Works on any Node host (Railway, Render, Fly.io, a VM, etc.). Key points:

- **Build step must run `prisma generate`.** There's no `postinstall` hook, so add
  one or set the host's build command. Simplest: add to `backend/package.json`:
  ```json
  "scripts": { "postinstall": "prisma generate", "start": "node index.js" }
  ```
- **Start command:** `npm start` (runs `node index.js`).
- **Run migrations on release:** `npx prisma migrate deploy` (as a release/predeploy
  command, with `DATABASE_URL` set).
- The app binds `0.0.0.0` on `process.env.PORT` and exits with a clear error if the
  DB is unreachable — good for health checks.

**Railway example** (matches the prior setup):
1. New project → deploy the `backend/` folder (set root directory to `backend`).
2. Add a **PostgreSQL** plugin; Railway injects `DATABASE_URL`.
3. Set `JWT_SECRET`, `CLIENT_URL`, optionally `EMAIL_*`.
4. Build command: `npm install` (with the `postinstall` generate) →
   Deploy/Release command: `npx prisma migrate deploy` → Start: `npm start`.

---

## 5. Frontend deployment (React static build)

CRA produces static files — host them anywhere (Vercel, Netlify, Railway static,
S3+CloudFront, nginx).

1. Point the build at your backend. Either edit `frontend-new/.env.production`:
   ```env
   REACT_APP_API_URL=https://YOUR-BACKEND-HOST/api
   ```
   or set `REACT_APP_API_URL` in the host's build environment.
2. Build:
   ```bash
   cd frontend-new
   npm install
   npm run build      # outputs to frontend-new/build
   ```
3. Serve `frontend-new/build` as static files.
   - Configure SPA fallback so client-side routes (`/chair-dashboard`,
     `/forgot-password`, …) all serve `index.html` (Vercel/Netlify do this
     automatically; for nginx use `try_files $uri /index.html`).

**Vercel/Netlify:** project root `frontend-new`, build command `npm run build`,
output dir `build`, env var `REACT_APP_API_URL`.

---

## 6. Wire-up & CORS

The browser calls the backend cross-origin, so the backend must allow the
frontend origin. After the checklist change:

```
Frontend origin  →  CLIENT_URL on the backend
Backend /api URL →  REACT_APP_API_URL on the frontend build
```

Both must agree, both over HTTPS.

---

## 7. Post-deploy smoke test

1. `GET https://YOUR-BACKEND-HOST/` → returns the "Çalışıyor" banner (API up).
2. Open the frontend → log in (a real admin you created, or a seeded account if you
   seeded) → no CORS errors in the browser console.
3. Exercise one authenticated action (e.g. generate a report) → confirms JWT +
   DB + cross-origin all work end to end.
4. Check backend logs show `✓ Database connected`.

---

## 8. CI/CD notes

- Keep `DATABASE_URL` available to the build (Prisma needs it to generate).
- Run `npx prisma migrate deploy` on every release before the new app boots.
- Never commit `.env`; it's git-ignored. Manage secrets in the host/CI vault.
- Consider a smoke-test step hitting `/` after deploy.
