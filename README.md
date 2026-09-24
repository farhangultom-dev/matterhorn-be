# Matterhorn Backend

Fondasi REST API dengan TypeScript, Node.js, Express 5, PostgreSQL, Knex, Zod, JWT, bcrypt, dan Nodemailer SMTP. Struktur kode memakai MVC dengan service untuk aturan autentikasi dan email.

## Prasyarat

- Node.js 24.x dan npm (lingkungan saat ini memakai Node.js 22.21.0; build berhasil tetapi engine memberi peringatan).
- PostgreSQL native yang dapat diakses secara lokal atau melalui credential yang disediakan.
- Credential SMTP hanya jika pengiriman/verifikasi email dibutuhkan.

Project ini belum memakai Docker, Redis, queue, ORM, atau layanan deployment.

## Menjalankan secara lokal

```sh
npm ci
```

Salin `.env.example` menjadi `.env`, lalu isi database dan secret. `JWT_SECRET` harus sedikitnya 32 karakter; gunakan secret acak untuk lingkungan nyata. Nilai boolean harus ditulis persis `true` atau `false`.

Buat database dan role development melalui akses PostgreSQL Anda, misalnya dengan `psql` atau admin tool. Ganti placeholder sebelum menjalankan perintah berikut dan jangan menaruh password nyata pada command history:

```sql
CREATE ROLE matterhorn_app LOGIN PASSWORD '<development-password>';
CREATE DATABASE matterhorn_dev OWNER matterhorn_app;
```

Jalankan migrasi dan server:

```sh
npm run db:check
npm run db:migrate
npm run build
npm start
```

Migration tidak dijalankan otomatis saat startup. Untuk status dan rollback gunakan `npm run db:status` dan `npm run db:rollback`; rollback hanya boleh dicoba pada database uji/disposable yang memang disediakan.

Untuk development, gunakan dua terminal:

```sh
# terminal A
npm run dev:build

# terminal B
npm run dev
```

Terminal A mengompilasi source ke `dist`; terminal B menjalankan Node watch pada output tersebut. Perbaiki error compiler sebelum menilai request HTTP.

## Endpoint

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/health` | Status service dan koneksi database |
| POST | `/api/v1/auth/register` | Body `{ "name", "email", "password" }` |
| POST | `/api/v1/auth/login` | Body `{ "email", "password" }`; mengembalikan access token |
| POST | `/api/v1/auth/verify-email` | Verify email with a six digit OTP |
| POST | `/api/v1/auth/resend-verification-otp` | Resend a verification OTP |
| GET | `/api/v1/auth/me` | Header `Authorization: Bearer <accessToken>`; returns user and userDetails |
| PATCH | `/api/v1/users/me/details` | Update profile metadata or upload `profilePhoto` for the token subject |
| DELETE | `/api/v1/users/me` | Soft-delete the authenticated user and user details |
| GET | `/api/v1/provinces` | List all active provinces |
| GET | `/api/v1/provinces/:provinceId/cities` | List all active cities for a province |
| GET | `/api/v1/roles` | List all active roles |
| POST | `/api/v1/user-roles` | Assign an active role to an active user; admin Bearer token required |
| POST | `/api/v1/organizers` | Create an organizer; active role ID 1 or 4 required |
| PATCH | `/api/v1/organizers/:organizerId` | Update an organizer; active role ID 1 or 4 required |
| DELETE | `/api/v1/organizers/:organizerId` | Soft-delete an organizer; active role ID 1 or 4 required |
| GET | `/api/v1/events` | List public non-deleted events with title/city/discipline search, filters, pagination, and discipline sports |
| GET | `/api/v1/events/:eventId` | Get one public event with discipline sports and ticket types |
| POST | `/api/v1/events` | Create an event; active role ID 1 or 4 required |
| PATCH | `/api/v1/events/:eventId` | Update an event; active role ID 1 or 4 required |
| DELETE | `/api/v1/events/:eventId` | Soft-delete an event; active role ID 1 or 4 required |
| GET | `/api/v1/discipline-sports` | List all active discipline sports |
| GET | `/api/v1/communities` | List active public communities with pagination |
| GET | `/api/v1/communities/:communityId` | Get one active public community |
| POST | `/api/v1/communities` | Create a community; community_owner/admin Bearer token required |
| POST | `/api/v1/communities/:communityId/discipline-sports` | Add a discipline sport to a community; owner/admin Bearer token required |
| POST | `/api/v1/communities/:communityId/locations` | Add a location to a community; owner/admin Bearer token required |
| POST | `/api/v1/communities/:communityId/schedules` | Add a schedule to a community; owner/admin Bearer token required |
| POST | `/api/v1/communities/:communityId/social-links` | Add a social link to a community; owner/admin Bearer token required |
| PATCH/POST | `/api/v1/communities/:communityId/logo` | Upload or replace a community logo; owner/admin Bearer token required |
| PATCH/POST | `/api/v1/communities/:communityId/cover` | Upload or replace a community cover; owner/admin Bearer token required |
| PATCH | `/api/v1/communities/:communityId` | Update an owned community or admin-managed community |
| DELETE | `/api/v1/communities/:communityId` | Soft-delete an owned community or admin-managed community |

Response memakai envelope `{ success, message, data }` untuk sukses dan `{ success, message, error }` untuk gagal. User publik tidak pernah berisi password atau password hash. Login memakai JWT HS256 dengan expiry sesuai `JWT_EXPIRES_IN_SECONDS`.

Community reads are public but only return non-deleted communities with `visibility=public` and `status=active`. `GET /api/v1/communities` supports `search` (name or slug), `cityId`, and `disciplineSportId` filters in addition to pagination. `POST /api/v1/communities` accepts `name`, lowercase kebab-case `slug`, optional description/media URLs, optional active `cityId`, visibility, and contact person; it requires a verified account with `community_owner` or `admin` role and creates a draft owned by the token subject. Owners or admins can update a community, and deletion is a soft delete. Public responses also include active `disciplineSports`, `locations`, `schedules`, and `socialLinks` arrays. The discipline-sport relation can be added through the dedicated authenticated endpoint below.

Add a discipline sport with `POST /api/v1/communities/:communityId/discipline-sports` and JSON `{ "disciplineSportId": 1 }`. The caller must own the community or have the active `admin` role. The discipline sport must be active; duplicate active relations return `409 COMMUNITY_DISCIPLINE_SPORT_ALREADY_EXISTS`.

Add a community location with `POST /api/v1/communities/:communityId/locations` and JSON `{ "cityId": 1, "urlGmapsLocations": "https://maps.google.com/...", "isPrimary": true }`. At least `cityId` or `urlGmapsLocations` is required. The city must belong to an active province, and only one active primary location is allowed per community.

Add a community schedule with `POST /api/v1/communities/:communityId/schedules` and JSON `{ "dayOfWeek": 1, "startTime": "06:00", "endTime": "08:00", "locationId": 1 }`. `dayOfWeek` uses 1 for Monday through 7 for Sunday; times accept `HH:mm` or `HH:mm:ss`; `locationId` is optional but must reference an active location in the same community when provided. Duplicate active schedules return `409 COMMUNITY_SCHEDULE_ALREADY_EXISTS`.

Add a community social link with `POST /api/v1/communities/:communityId/social-links` and JSON `{ "platform": "instagram", "url": "https://instagram.com/example" }`. Platform names are trimmed and stored in lowercase, URLs must use HTTPS, and each community can have only one active link per platform. Duplicate links return `409 COMMUNITY_SOCIAL_LINK_ALREADY_EXISTS`.

Organizer mutations use `POST /api/v1/organizers`, `PATCH /api/v1/organizers/:organizerId`, and `DELETE /api/v1/organizers/:organizerId`. They require a verified Bearer token with an active `user_roles.role_id` of `1` or `4`. `userId` and `communityId` are optional UUIDs and may both be `null`; non-null references must point to active users or non-deleted communities. Create accepts JSON or multipart form data with a `logo` file and a JSON `data` field; the uploaded JPEG/PNG/WebP is stored in S3 and its public URL is saved to `logoUrl`. Delete is a soft delete and preserves related events. Create and update return `data.organizer`; validation errors use `400 VALIDATION_ERROR`, invalid references use `400 INVALID_USER` or `400 INVALID_COMMUNITY`, upload failures use `400 INVALID_UPLOAD`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_IMAGE_TYPE`, or `503 STORAGE_UNAVAILABLE`, unauthorized roles use `403 FORBIDDEN`, and missing targets use `404 ORGANIZER_NOT_FOUND`.

Events use `GET /api/v1/events`, `GET /api/v1/events/:eventId`, `POST /api/v1/events`, `PATCH /api/v1/events/:eventId`, and `DELETE /api/v1/events/:eventId`. Public GET responses include active discipline sports and event details include ticket types. Create requires a verified Bearer token with active role ID `1` or `4`; send event fields as multipart JSON `data` and optionally attach one JPEG, PNG, or WebP file in `posterUrl` (maximum 5 MiB). The `data.disciplineSports` array accepts active discipline sport IDs, and `data.ticketTypes` accepts ticket `name`, non-negative `price`, positive `quota`, `salesStartAt`, and `salesEndAt`. Do not include `posterUrl` inside `data`; the generated public URL is stored in `events.poster_url` and returned as `data.event.posterUrl`. JSON create remains valid only when no poster is supplied. PATCH keeps its JSON `posterUrl` URL-or-null behavior. Search and city/discipline filters are optional on GET list.

Payment checkout uses `POST /api/v1/payments` and `GET /api/v1/payments/orders/:orderId`. The caller supplies ticket type IDs and quantities plus an `Idempotency-Key` UUID; the server reads prices, validates the public event and sale windows, checks capacity, and creates the local order, item snapshots, and Sumopod payment link. Configure `SUMOPOD_BASE_URL`, `SUMOPOD_API_KEY`, `SUMOPOD_SUCCESS_RETURN_URL`, and `SUMOPOD_CANCEL_RETURN_URL` in the backend `.env`. The sandbox base URL is the development default; production requires an explicit non-sandbox URL unless temporary production-host testing is explicitly enabled with `SUMOPOD_ALLOW_SANDBOX_IN_PRODUCTION=true`. Keep that flag `false` for live payments. Sumopod QRIS responses include the provider fee in `amount`: `net_amount` must equal the local ticket subtotal, `fee` is saved to `orders.fee_amount`, and `amount` becomes both `orders.total_amount` and `payment_transactions.amount`. Reuse the same idempotency key and body for the same checkout. The backend accepts only Sumopod HTTP 201 as a successful create-payment response. Its own HTTP 202 indicates an unresolved provider outcome; check the order endpoint and do not retry with a new key until reconciled. Payment and order statuses change from pending only after a verified webhook; the browser success return is not proof of payment.

Sumopod posts payment events to `POST /api/v1/payments/webhooks/sumopod` with `X-Webhook-Token`; configure the server-only `SUMOPOD_WEBHOOK_TOKEN` in `.env` and the corresponding `sumopodWebhookToken` value in a private Bruno environment. JWT is not used on the webhook endpoint. `payment.completed` marks the payment and order paid using provider timestamps; `payment.failed` marks the payment failed and order cancelled; `payment.expired` marks both expired; `payment.test` is acknowledged without database changes. Duplicate deliveries return HTTP 200 and do not repeat the state change. The webhook verifies provider payment ID, merchant reference, amount, fee, and net amount; for QRIS, `amount = net_amount + fee` and `net_amount` must match the local ticket subtotal. Browser redirects never mark a payment as paid. Never put the webhook token in a tracked file or log.

Community logos and covers use authenticated multipart endpoints. Upload a single `logo` file to `PATCH` (or compatibility `POST`) `/api/v1/communities/:communityId/logo`, or a single `cover` file to `PATCH` (or compatibility `POST`) `/api/v1/communities/:communityId/cover`. The file must be JPEG, PNG, or WebP, must match its detected signature, and must be no larger than 5 MiB. Only the community owner or an active admin can upload; owners cannot modify suspended communities. The server generates a random S3 object key under `community-media/<communityId>/logo/` or `community-media/<communityId>/cover/`, stores the public HTTPS URL in the matching column, and never uses the client filename or an ACL. Existing JSON `logoUrl` and `coverUrl` behavior remains available, including `null` to clear a value. Upload failures return `503 STORAGE_UNAVAILABLE`; malformed uploads use `400 INVALID_UPLOAD`, oversized files use `413 FILE_TOO_LARGE`, and unsupported or signature-mismatched images use `415 UNSUPPORTED_IMAGE_TYPE`.

Contoh:

```sh
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "content-type: application/json" \
  -d '{"name":"Example User","email":"user@example.com","password":"password123"}'
```

Register returns `201` and a public pending user object with `isEmailVerified:false`. It assigns `role_id=5` through `user_roles`, sends a six digit OTP through SMTP, and does not issue a token. Role ID 5 must exist and be active before registration; otherwise the API returns `500 AUTH_REFERENCE_DATA_MISSING`. Verify the OTP before Login. Register returns `503 EMAIL_DELIVERY_UNAVAILABLE` when SMTP is disabled or unavailable, and duplicate emails remain `409 EMAIL_ALREADY_EXISTS` so the client can use resend.

Login and call the current-user endpoint:

```sh
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

curl http://localhost:3000/api/v1/auth/me \
  -H "authorization: Bearer <accessToken>"
```

Verify Email accepts `{ "email", "otp" }`; the OTP is a six digit string valid for 10 minutes and can be used once. Invalid or expired codes return `400 INVALID_OR_EXPIRED_OTP`, while an already verified account returns `409 EMAIL_ALREADY_VERIFIED`. Resend uses `{ "email" }`, has a 60 second delay and five sends per hour, and returns `429 OTP_RESEND_LIMITED` when throttled. Login returns `200` with a short-lived HS256 Bearer access token only after verification; pending users receive `403 EMAIL_NOT_VERIFIED`. Its lifetime is controlled by `JWT_EXPIRES_IN_SECONDS`. `GET /api/v1/auth/me` returns `data.user` and `data.userDetails`; `userDetails` is `null` when no active details row exists. Invalid request bodies return `400 VALIDATION_ERROR`, duplicate registration returns `409 EMAIL_ALREADY_EXISTS`, disabled or unavailable SMTP returns `503 EMAIL_DELIVERY_UNAVAILABLE`, invalid credentials return `401 INVALID_CREDENTIALS`, and missing or invalid Bearer tokens return `401 UNAUTHORIZED`. Passwords, password hashes, OTPs, and SMTP credentials are never included in responses or logs. Refresh tokens, logout/revocation, password reset, and general role/permission management are not implemented; role assignment is available only through the admin-protected user-roles endpoint.

### User details and profile photo

After Register → Login, update the caller's own details with `PATCH /api/v1/users/me/details`. JSON requests use `application/json`; omitted fields are preserved and nullable fields are cleared with `null`. `name` changes update both `users.name` and `user_details.name` in one transaction. `cityId` must reference an active city in an active province. The JSON `profilePhoto` field accepts only `null` to remove an existing photo; clients cannot submit a photo URL.

For a new photo, send `multipart/form-data` with one `profilePhoto` file and an optional `data` part containing a UTF-8 JSON object of metadata. Use JPEG, PNG, or WebP up to 5 MiB. Let the HTTP client generate the multipart boundary. The server checks image signature bytes, uploads to S3, and stores the public HTTPS URL in `user_details.profile_photo`. It never uses a client filename, presigned URL, or `public-read` ACL.

Photo, community media, organizer logo, and event poster uploads require these environment settings:

```text
AWS_REGION=
S3_PROFILE_PHOTO_BUCKET=
PROFILE_PHOTO_PUBLIC_BASE_URL=https://cdn.example.com
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_ENDPOINT=
S3_FORCE_PATH_STYLE=false
```

Set the values in the root `.env` file. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are required together for uploads and are passed directly to the AWS SDK; `.env` is ignored by Git. `PROFILE_PHOTO_PUBLIC_BASE_URL` must be HTTPS without query strings, fragments, credentials, or a trailing slash. For Deka Box path-style access, use `S3_ENDPOINT=https://<rest-endpoint>`, `S3_FORCE_PATH_STYLE=true`, and `PROFILE_PHOTO_PUBLIC_BASE_URL=https://<rest-endpoint>/<bucket>`. The stored URL is then `https://<rest-endpoint>/<bucket>/<object-key>`. The IAM identity needs PutObject/DeleteObject for the `profile-photos/`, `community-media/`, `organizer-media/`, and `event-media/` prefixes. Metadata-only JSON updates work when these settings are empty. Event create uses multipart data with a JSON `data` part and an optional `posterUrl` image part; the generated public URL is stored in `events.poster_url`. Upload failures return `503 STORAGE_UNAVAILABLE`; validation errors use `400 VALIDATION_ERROR`, `400 INVALID_UPLOAD`, or `400 INVALID_CITY`; unsupported images return `415 UNSUPPORTED_IMAGE_TYPE`; oversized files return `413 FILE_TOO_LARGE`.

Use a city ID from the active reference data; IDs are local PostgreSQL integers and must not be assumed from the source dataset. For example:

```sql
SELECT cities.id, cities.name, provinces.name AS province
FROM cities JOIN provinces ON provinces.id = cities.province_id
WHERE cities.deleted_at IS NULL AND provinces.deleted_at IS NULL
ORDER BY provinces.name, cities.name;
```

If a process stops after an S3 upload and before the database commit, an unreferenced object can remain. Reconcile by listing only `profile-photos/<userId>/` keys and comparing them with `user_details.profile_photo` references before deleting anything. Never run a broad bucket wipe or delete URLs that cannot be proven to belong to this prefix.

## Bruno API collection

The import-ready Bruno collection is in [`bruno`](./bruno). Open that folder in Bruno, select the `Local` environment, set an unused `registrationEmail`, then run Health, Register, Login, and Get Current User in that order. The Login request stores its token in Bruno runtime memory as `accessToken`, and the protected request uses it as Bearer authorization. See [`bruno/README.md`](./bruno/README.md) for the complete variable reference.

Organizer logo uploads use the existing S3 configuration and the `organizer-media/` prefix. Grant the server IAM identity PutObject and DeleteObject for that prefix in addition to the existing photo and community media prefixes.

## MVC dan migration

Route meneruskan request ke middleware, controller, service, dan model. Model hanya menangani query Knex; controller menangani HTTP; service menangani aturan auth; view memilih field response publik; config membaca environment tervalidasi.

Migration baru ditulis sebagai file TypeScript di `src/database/migrations`. Setelah build, Knex CLI menjalankan file JavaScript hasil kompilasi di `dist/database/migrations`. Migration yang sudah diterapkan tidak diedit; buat migration baru untuk perubahan schema.

Migration `202609220001_allow_unowned_organizers` mengizinkan `organizers.user_id` dan `organizers.community_id` sama-sama `NULL`. Terapkan migration sebelum memakai endpoint organizer pada database target.

## Reference and development seeds

The migration set adds roles, geography, sports, profiles, communities, events, orders, and payment transactions. Run migrations before any seed:

```sh
npm run db:migrate
npm run db:seed:reference
```

`db:seed:reference` can be run repeatedly. It creates or updates roles, discipline sports, all 38 Indonesian provinces, and all 514 Indonesian regencies/cities without multiplying rows. The geography source is a pinned revision, so the dataset is consistent between runs; the command needs internet access to download it. Database IDs remain local PostgreSQL IDs, while source region codes are used only to link each city to its province.

To add the deterministic local demo data, set `SEED_DEMO_PASSWORD` in `.env` to a value between 8 and 72 UTF-8 bytes, then run:

```sh
npm run db:seed:development
```

The development seed creates two `.test` users, a running community, organizer, event, tickets, participant, pending order, and pending payment. It uses fixed UUIDs and can be run repeatedly without creating duplicates. It refuses to run when `NODE_ENV=production`, and it never prints the password or password hash.

The schedule convention is `day_of_week` 1 for Monday through 7 for Sunday. Monetary amounts are integer rupiah values: `100000` means Rp100,000. Do not send formatted currency strings to the database.

Use rollback only with a disposable database:

```sh
npm run db:rollback
npm run db:migrate
```

## SMTP

Set `SMTP_ENABLED=true` dan isi host, port, secure, user, password, serta sender agar register dapat mengirim OTP. Jika `SMTP_ENABLED=false`, register baru ditolak dengan `503 EMAIL_DELIVERY_UNAVAILABLE`; akun lama yang sudah diverifikasi tetap dapat login. Port 465 biasanya memakai `SMTP_SECURE=true`, sedangkan port 587 memakai STARTTLS (`false`). `npm run smtp:check` hanya menguji koneksi/auth SMTP, bukan delivery ke inbox.

Service email internal tersedia melalui `sendEmail` dan pengiriman OTP verifikasi; tidak ada endpoint publik untuk mengirim email bebas. Jangan mengirim email nyata tanpa izin serta alamat tujuan yang jelas.

## Verifikasi yang sudah dijalankan

- `npm run typecheck` — passed.
- `npm run build` — passed.
- Smoke test HTTP untuk 404, validasi body, dan malformed JSON — passed.
- SMTP disabled check — passed.
- `npm install` audit — 0 vulnerability.
- PostgreSQL `db:check` — passed.
- `npm run db:status` — passed read-only; the existing working database has 8 completed migrations and no pending migrations.
- `npm run db:seed:reference` — passed; 38 provinces and 514 regencies/cities available.
- OTP helper self-check — passed for six digit format, matching hash, and mismatch rejection without printing the OTP or hash.
- Community public HTTP checks — passed for paginated list, search, hidden/missing detail, unknown query rejection, and invalid pagination rejection.
- Community mutation HTTP checks — blocked for create/update/delete because the available database is the working database rather than an approved disposable database.
- Authentication HTTP and SMTP delivery checks — blocked until the email-verification migration is applied to an approved disposable database and a test SMTP inbox is configured.
- Runtime rollback and full constraint matrix — blocked; use a disposable PostgreSQL database before exercising destructive rollback checks.

Fondasi ini belum menyediakan refresh token, revocation/logout server-side, reset password, general role/permission management, CRUD bisnis, testing framework, Docker, atau deployment.
