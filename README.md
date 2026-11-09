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
  | DNS: Namecheap account (no mock) | `/dns/namecheap` |
  | DNS: Add domain + "Fetch from Namecheap" modal | `/dns/add-domain` |
  | DNS: Domain list | `/dns/domains` |
  | DNS: one domain (health, managed records, before/after, snapshots; mail IP from a linked server) | `/dns/domains/[id]` |
  | Servers: Add VPS server (MasterDB's SSH public key + copy-paste command, then the form) | `/servers/add` |
  | Servers: Server list (search, SSH / health / expiry filters, 14-day expiry warning, bulk re-check, delete) | `/servers/list` |
  | Servers: one server (details, edit, Connect → check fingerprint once → Trust, optionally with the root password used once to add MasterDB's key; changed key = blocked, Owner accepts; health per check with Re-check; linked domain and HELO / MAIL FROM) | `/servers/list/[id]` |
  | MTA: Install MTA (choose a ready server, optional webmail, live steps / progress ring / scrubbed output, then the DNS preview → write card) | `/mta/install?server=&job=` |
  | MTA: MTA list (service states, versions, queue size, when read; refresh, remove from list) | `/mta/list` |
  | Lists: Add list (name, ESP, country, remove duplicates, vertical, split by; a .txt/.csv from the PC or a Google Drive link; then the real upload progress, the email column, the import progress and the report) | `/lists/add` |
  | Lists: List emails (search, ESP / country / vertical / source / status filters, latest validation, delete with typed confirm) | `/lists/emails` |
  | Lists: one list (details, edit, import report, latest validation, parts, addresses page by page with the file's own columns, export CSV; an unfinished upload goes on here with the same file) | `/lists/emails/[id]` |
  | Validation: Email validation (one address through one server: category, reason, the provider's reply, SMTP conversation; history 90 days) | `/validation/check` |
  | Validation: Bulk validation (paste or open a .txt/.csv, choose servers, start; pacing per provider and pauses running now) | `/validation/bulk` |
  | Validation: Results (one row per job) and one job live (round chart of the six categories, counters, servers, stop / resume / retry unknown / delete, exports per category + detailed CSV, addresses) | `/validation/results`, `/validation/results/[id]` |
  | Validation: List status (every address by its latest result, in six sections) | `/validation/status` |
  | MTA: MTA manager (start / stop / restart / reset per service or all, stop and restart confirmed; mail queue and flush; recent logs) | `/mta/manager?server=` |

- **Big uploads** (`lib/lists.ts`, `app/(app)/lists/import-flow.tsx`): Vercel caps a request
  body at about 4.5 MB, so a list file goes through the same `/api` proxy (with the proxy
  secret, like every call) in 3 MB chunks, `PUT /api/v1/lists/{id}/upload?offset=N`, one after
  the other. The ring shows only `received`, the bytes the server says it has saved; a failed
  chunk is retried (1, 2, 4… s), a 409 offset answer moves to the server's position, and a
  stopped upload goes on from the list's page when the same file is chosen again. The browser
  never calls the API directly.
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
