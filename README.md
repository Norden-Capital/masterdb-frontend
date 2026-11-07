# masterdb-frontend
Frontend for MasterDB, a platform for managing, cleaning, filtering, and segmenting email contact databases.

Frontend of MasterDB (Next.js 16, App Router, Turbopack, shadcn base). Deployed on Vercel at
https://db.nordencapital.ca.

## Run

```bash
npm install
npm run dev        # http://localhost:3000, needs BACKEND_URL + PROXY_SECRET in .env.local (see .env.example)
npm test           # unit tests (Node's built-in runner, lib/*.test.ts)
npm run lint
npm run build
```

## How it is put together

- **`app/api/[...path]/route.ts`**: the only way to the backend. Same-origin proxy that adds
  `X-Proxy-Secret` (server-side only), forwards the visitor's IP as `X-Client-IP` on Vercel,
  and refuses cross-site writes with 403 `CSRF_REJECTED` (`lib/proxy-guards.ts`).
- **`proxy.ts`** (Next 16's name for middleware): pages behind the login without the
  `md_session` cookie go to `/login?next=...`. Only an optimistic check; the backend decides.
- **Design**: `app/md.css` is the approved mock stylesheet (`graphic/mocks/auth/assets/app.css`)
  ported 1:1: tokens for light and dark (`<html data-theme>`, set before paint from the saved
  choice or the system), plain component classes (`.btn`, `.card`, `.t`, `.pill`, ...).
  Font: Plus Jakarta Sans. Icons: lucide-react.
- **Pages** (`app/(auth)` public, `app/(app)` behind the login with the app frame):

  | Mock | Route |
  | --- | --- |
  | 01 Log in | `/login` |
  | 02 2FA code / recovery code | `/login/2fa` |
  | 03 2FA setup (QR, confirm, recovery codes) | `/login/setup-2fa` |
  | 04 Forgot password | `/forgot-password` |
  | 05 Reset password | `/reset-password#<token>` |
  | 06 Accept invite | `/accept-invite#<token>` |
  | 07 Users | `/users` |
  | 08 Invite user | modal on `/users` |
  | 09 User detail | `/users/[id]` |
  | 10 Permissions editor | `/users/[id]/permissions` |
  | 11 My account / security | `/account`, `/account/security` |
  | 12 Activity log | `/activity` |
  | 13 Session expired | `/session-expired` |
  | 14 403 / 404 | `Forbidden` component, `app/not-found.tsx` |

- **Session**: `components/md/session.tsx` loads `/api/v1/auth/me` (user + effective
  permissions). `can("USERS:EDIT")` hides menu items and buttons; the API checks again. Any
  401 `UNAUTHENTICATED` while a page is open → `/session-expired`, and the page you were on is
  opened again after logging in.
- **Errors**: `lib/api.ts` turns every problem+json answer into `ApiError` with its `code`;
  pages switch on the code (`INVALID_CREDENTIALS`, `ACCOUNT_LOCKED` with a live countdown,
  `RATE_LIMITED`, `INVALID_TWO_FACTOR_CODE`, `LOGIN_CHALLENGE_INVALID`, `LINK_INVALID`,
  `CURRENT_PASSWORD_INCORRECT`, `CONFLICT`, `FORBIDDEN`, `VALIDATION_FAILED` per field, network
  and 5xx with the request id).
- Email links carry their token after `#`; the page reads it once and removes it from the
  address bar, so it never reaches a server log or the browser history.
