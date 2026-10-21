# ITS — Local Demo Guide

How to run the Internship Tracking System on a single machine and walk through
**every** feature. Written for **Windows 11 + PowerShell** (the machine this was
prepared on), with macOS/Linux notes where they differ.

> TL;DR: start PostgreSQL → create `backend/.env` → `prisma migrate dev` + seed →
> run backend on **:3001** and frontend on **:3000** → log in as
> `ceng_chair@example.com` / `password123`.

---

## 0. What you're running

| Piece | Tech | URL |
|-------|------|-----|
| Backend API | Node + Express + Prisma | http://localhost:3001 |
| Frontend | React (Create React App dev server) | http://localhost:3000 |
| Database | PostgreSQL 18 | localhost:5432 |

The frontend defaults to `http://localhost:3001/api`, so the backend **must** run
on port 3001. (`npm start` ignores `frontend-new/.env.production`, which only
applies to production builds — so local runs always hit localhost.)

---

## 1. Prerequisites

Already installed on this machine — verify with:

```powershell
node --version    # v22.x  (need v16+)
npm --version     # 10.x
```

PostgreSQL 18 is installed at `C:\Program Files\PostgreSQL\18`. `psql` is **not**
on the PATH, but you don't need it — Prisma talks to the DB directly via
`DATABASE_URL`. If you want the `psql` CLI anyway, add
`C:\Program Files\PostgreSQL\18\bin` to your PATH.

Dependencies are already installed (`node_modules` present in both `backend/` and
`frontend-new/`). If they ever go missing:

```powershell
cd c:\dev\ITS\backend ; npm install
cd c:\dev\ITS\frontend-new ; npm install
```

---

## 2. Start PostgreSQL

The Windows service `postgresql-x64-18` ships **stopped**. Start it from an
**Administrator** PowerShell (right-click PowerShell → *Run as administrator*):

```powershell
net start postgresql-x64-18
```

Or: press `Win+R` → `services.msc` → find **postgresql-x64-18** → **Start**
(optionally set *Startup type* to *Automatic* so it comes up on boot).

Confirm it's listening:

```powershell
Get-Service postgresql-x64-18    # Status should be "Running"
```

> **macOS:** `brew services start postgresql@16`  •  **Linux:** `sudo service postgresql start`

---

## 3. Configure the backend `.env`

There is no `.env` yet (it's git-ignored). Create one from the template:

```powershell
cd c:\dev\ITS\backend
copy .env.example .env
```

Open `backend/.env` and set `DATABASE_URL` to your PostgreSQL **superuser
password** (the one you chose when installing PostgreSQL 18). The default
superuser is `postgres`:

```env
PORT=3001
NODE_ENV=development

DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/internship_db?schema=public"

JWT_SECRET=any_long_random_string_at_least_32_characters_long
JWT_EXPIRE=7d
CLIENT_URL=http://localhost:3000

# Password reset is unavailable until email credentials are configured.
EMAIL_USER=
EMAIL_PASS=
```

Notes:
- The database `internship_db` does **not** need to exist yet — `prisma migrate dev`
  creates it for you (the `postgres` superuser has permission to).
- If your password contains URL-special characters (`@ : / ?`), URL-encode them
  (e.g. `@` → `%40`).

---

## 4. Initialize the database

From `backend/`:

```powershell
npx prisma generate          # build the Prisma client
npx prisma migrate dev       # creates internship_db + all tables
npm run prisma:seed          # loads demo data (users, departments, students, internships)
```

Seeding loads: 3 roles, 22 departments, admin/chair/member users, 12 students
across 3 engineering departments, 2 terms, 7 companies, and a spread of
internships in every lifecycle state.

Want a visual DB browser during the demo? `npx prisma studio` → http://localhost:5555.

---

## 5. Start the backend

```powershell
cd c:\dev\ITS\backend
npm run dev
```

You should see:

```
✓ Database connected
✓ Server running on http://localhost:3001
```

If you instead get `✗ Could not connect to the database`, PostgreSQL isn't
running or `DATABASE_URL` is wrong — revisit steps 2–3.

---

## 6. Start the frontend (second terminal)

```powershell
cd c:\dev\ITS\frontend-new
npm start
```

It opens http://localhost:3000 automatically.

---

## 7. Demo login accounts

**Every seeded account's password is `password123`.**

| Role | Email | What they can do |
|------|-------|------------------|
| General Admin | `admin1@example.com` | Assign commission chairs, view commission status |
| Commission Chair (Computer Eng.) | `ceng_chair@example.com` | Everything below + manage members |
| Commission Member (Computer Eng.) | `ceng_member1@example.com` | Students, grading, early eval, reports |

Other seeded staff (all `password123`): `eeng_chair@example.com`,
`meng_chair@example.com`, `ceng_member2@example.com`, `admin2@example.com`, etc.

> Computer Engineering is the richest department to demo: it has 4 students with
> internships in various states, a chair, and 2 members.

---

## 8. Full showcase script

A ~10-minute path that touches every feature. Keep the **backend terminal
visible** — one step reads a code from it.

### Act 1 — Admin (`admin1@example.com`)

1. **Log in** as the admin → lands on the Admin dashboard.
2. **Komisyon Durumu Görüntüle** (sidebar): shows every department with its chair
   and up to two members. Point out CENG/EENG/MENG are staffed.
3. **Komisyon Başkanı Atama**: pick a department with **no** chair yet (e.g.
   *Mimarlık* or *Biyomühendislik*), fill İsim / Soyisim / E-posta / **Geçici
   Şifre** (e.g. `temp123`), and **Başkanı Kaydet**. The new chair appears in the
   "Mevcut Komisyon" panel on the right.
   - *Note:* assigning a chair to a department that already has one **replaces**
     the existing chair — so avoid CENG/EENG/MENG here, or you'll change the demo
     logins.
3b. (Optional) Click **Sil** next to that chair to show removal.

### Act 2 — First-login password change (ties Admin → Auth together)

4. **Log out** (top-right Çıkış). Log in as the chair you just created, using the
   temporary password. Because app-created accounts are flagged
   `requiresPasswordChange`, you're forced onto the **Şifre Değiştirme** screen.
5. Enter the temporary password + a new one (≥6 chars) → you're redirected into
   the Chair dashboard. (This account is now a normal login.)

### Act 3 — Commission Chair (`ceng_chair@example.com`)

6. **Log out** and log in as `ceng_chair@example.com` / `password123`.
7. **Öğrenci Listesi**: select the **2025 Summer Internship Term**. You'll see the
   CENG students, their current/previous internship, dates, and an S/U/– grade
   badge. Try the **Puana Göre Filtrele** and **Staj Tipi** filters. Rows with
   dates outside the term are highlighted red.
8. **Staj Puanlandır**: the default filter is *Puanlanmamış* (ungraded). For the
   Summer term you'll see ungraded internships (e.g. Ayşe Kaya, Fatma Demir, Ali
   Veli's STAJ2). Set a grade **S/U** and an optional note for one or two, then
   **Tüm Notları Kaydet**. They disappear from the ungraded list (now graded).
9. **Erken Değerlendirme**: select one or more students with the checkboxes →
   **Erken Değerlendir** → fill grade + reason in the modal → **Değerlendirme
   Tutanağı Oluştur**. A `.docx` evaluation record downloads automatically. Open
   it to show the formatted GTU report (header, commission names, student table).
10. **Öğrenci Listesi → Komisyon Değerlendirme Tutanağı Oluştur**: generates a
    `.docx` for the whole filtered list. *Heads-up:* each internship is marked
    "reported" once included, so a second identical report says "nothing left to
    report" — that's expected. Re-seed (step 9 below) to reset.
11. **Komisyon Üyesi Ekleme**: CENG already has its **max of 2** members, so
    adding a third shows the "already 2 members" guard (a feature). To demo a
    successful add, **Sil** one member first, then add a new one (İsim / Soyisim /
    E-posta / Geçici Şifre).
12. **Staj PDF Yükleme**: select a term, then choose a GTU internship-form PDF
    (*staj fişi*). The backend parses name, student number, company, contact,
    dates and STAJ type into an editable review form. **Any PDF works for the
    demo** — fields the parser can't read show as blank/"NOT FOUND" and you can
    type them in before saving. Click **Tümünü Onayla ve Kaydet** to create the
    internship.
    - **Business rule to show:** set Staj Tipi to **Zorunlu Staj 2** for a brand-new
      student number → save → the backend rejects it ("must complete/pass STAJ1
      first"). Switch to **Staj 1** and it saves.

### Act 4 — Commission Member (`ceng_member1@example.com`)

13. **Log out** → log in as a member. Same dashboard minus *Komisyon Üyesi Ekleme*.
    Members can view students, grade, early-evaluate, and generate reports — show
    one of those to prove role-scoped access.

### Act 5 — Forgot-password flow

Configure `EMAIL_USER` and `EMAIL_PASS` with a Gmail address and App Password before
using password reset. Use a demo account whose mailbox you can access.

14. Log out and click **Şifremi Unuttum?**.
15. Enter the account email and click **Kod Gönder**.
16. Read the six-digit code from the email, enter it, and set a new password.
17. Log in with the new password.

With blank mail settings, the form shows an unavailable message and stays on the
email step. Failed delivery also shows an error. Reset codes are never printed to
the server console.

---

## 9. Reset / re-seed between demos

Reports flip internships to "reported" and grading mutates state, so to get a
clean slate:

```powershell
cd c:\dev\ITS\backend
npx prisma migrate reset    # drops everything, re-applies migrations, re-runs the seed
```

(One command — it re-seeds automatically. Answer "y" when prompted.)

---

## 10. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend prints `✗ Could not connect to the database` | PostgreSQL service not running (step 2) or wrong password in `DATABASE_URL`. |
| `net start` → "Access is denied" | You're not in an **Administrator** PowerShell. |
| `PrismaConfigEnvError: Missing ... DATABASE_URL` | `backend/.env` missing or `DATABASE_URL` not set (step 3). |
| Frontend loads but every request fails | Backend isn't running, or it's not on port **3001**. |
| Port 3001 already in use | `netstat -ano | findstr :3001` then `taskkill /PID <pid> /F`. |
| Login fails for a seeded user | DB wasn't seeded — run `npm run prisma:seed`. All seeded passwords are `password123`. |
| "Bu bölümde zaten 2 komisyon üyesi var" | Expected — CENG starts full. Remove a member first. |
| Report says nothing to report | Those internships were already reported; re-seed (step 9). |
