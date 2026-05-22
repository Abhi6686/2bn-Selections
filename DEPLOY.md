# Deploy to Vercel

## 1. GitHub

Code is pushed to: https://github.com/abhijeetgosavi89/selections

## 2. Vercel (one-time setup)

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
2. Click **Add New Project** → Import `abhijeetgosavi89/selections`.
3. **Root Directory:** leave as repository root (all app files are at root).
4. **Framework Preset:** Vite (auto-detected).
5. **Build Command:** `npm run build`
6. **Output Directory:** `dist`
7. **Environment Variables** (optional — defaults work if unset):

   | Name | Value |
   |------|--------|
   | `VITE_ADMIN_USERNAME` | `admin` |
   | `VITE_ADMIN_PASSWORD` | `2BN-Admin-2026!` |

8. Click **Deploy**.

Your site will be live at `https://<project-name>.vercel.app`.

## 3. Admin login

| Field | Value |
|-------|--------|
| **User ID** | `admin` |
| **Password** | `2BN-Admin-2026!` |

Change these in Vercel env vars for production. Session ends when the browser tab/session is closed.

## 4. Local development

```bash
npm install
npm run dev
```

Open http://localhost:5173/login
