# Matterhorn Backend Bruno Collection

Open the bruno directory as a collection in Bruno, then select the Local environment.

environments/Local.bru contains only safe local defaults:

| Variable | Purpose |
| --- | --- |
| baseUrl | API origin, initially http://localhost:3000. |
| registrationName | Name sent by Register. |
| registrationEmail | Email used by Register and Login. Set it to an unused address before registering. |
| registrationPassword | Password used by Register and Login. |
| verificationOtp | OTP copied from the test inbox before Verify Email. |
| communityId | Community UUID captured by Create Community or entered for a public community. |
| organizerId | Organizer UUID captured by Create Organizer. |
| eventId | Event UUID captured by Create Event. |
| accessToken | Optional manually supplied Bearer token. Login normally sets a runtime variable instead. |
| sumopodWebhookToken | Local-only webhook token sent in `X-Webhook-Token`; keep this empty in tracked files and set it in a private local environment. |

Recommended sequence:

1. Start the backend and select Local in Bruno.
2. Run Get Health.
3. Set a unique registrationEmail, then run Register.
4. Copy the six digit OTP from the test inbox into verificationOtp, then run Verify Email.
5. Run Login; it captures the token in memory as accessToken.
6. Run Get Current User; it sends Authorization: Bearer accessToken through Bruno bearer authentication.
7. Run Update User Details for JSON metadata changes, or Upload Profile Photo for a multipart request. Place a real JPEG, PNG, or WebP file at bruno/fixtures/profile-photo.png or edit the relative path.
8. Create a community, then run Upload Community Logo or Upload Community Cover with a real JPEG, PNG, or WebP file. Each request uses one multipart file field and the community owner/admin token.
9. Delete Current User is available at DELETE baseUrl/api/v1/users/me and permanently blocks the account through soft deletion. Use it only with a disposable user.

Reference data is available without authentication through GET baseUrl/api/v1/provinces. It returns active provinces ordered by name.

Roles are available without authentication through GET baseUrl/api/v1/roles. It returns active roles ordered by name.

Discipline sports are available without authentication through GET baseUrl/api/v1/discipline-sports. It returns active discipline sports ordered by name.

Assigning a role uses POST baseUrl/api/v1/user-roles with `{ "userId": "<uuid>", "roleId": 1 }`. It requires a verified account with the active `admin` role and the Bearer token from Login. Duplicate assignments return `409 USER_ROLE_ALREADY_EXISTS`.

Communities are available through GET baseUrl/api/v1/communities and GET baseUrl/api/v1/communities/:communityId; public reads show only active public rows. The list accepts `search`, `cityId`, and `disciplineSportId` filters and includes active disciplineSports, locations, schedules, and socialLinks arrays. Create with POST baseUrl/api/v1/communities, then run Update Community or Delete Community using the runtime communityId. Create requires a verified account with the active `community_owner` or `admin` role. Update and delete require the owner or an admin. Community deletion is a soft delete.

Add Community Discipline Sport uses POST baseUrl/api/v1/communities/:communityId/discipline-sports with `{ "disciplineSportId": 1 }`. It requires the community owner or an active admin role and an active discipline sport. Duplicate active relations return `409 COMMUNITY_DISCIPLINE_SPORT_ALREADY_EXISTS`; unknown communities return `404 COMMUNITY_NOT_FOUND` and unknown sports return `404 DISCIPLINE_SPORT_NOT_FOUND`.

Add Community Location uses POST baseUrl/api/v1/communities/:communityId/locations with `cityId`, `urlGmapsLocations`, and optional `isPrimary`. At least one of `cityId` or `urlGmapsLocations` is required. The caller must own the community or have the active admin role; city IDs must belong to active provinces; a second active primary location returns `409 COMMUNITY_PRIMARY_LOCATION_ALREADY_EXISTS`.

Add Community Schedule uses POST baseUrl/api/v1/communities/:communityId/schedules with `dayOfWeek` (1-7), `startTime`, `endTime`, and optional `locationId`. Times accept `HH:mm` or `HH:mm:ss`, and `endTime` must be later than `startTime`. If supplied, locationId must belong to the same active community. Duplicate active schedules return `409 COMMUNITY_SCHEDULE_ALREADY_EXISTS`.

Add Community Social Link uses POST baseUrl/api/v1/communities/:communityId/social-links with `{ "platform": "instagram", "url": "https://instagram.com/example" }`. Platform names are normalized to lowercase and URLs must use HTTPS. Each community can have one active link per platform; duplicates return `409 COMMUNITY_SOCIAL_LINK_ALREADY_EXISTS`.

Organizer mutations use Create Organizer, Update Organizer, and Delete Organizer. All three require a verified Bearer token with an active numeric `user_roles.role_id` of `1` or `4`. Create uses multipart form data with a `logo` file and JSON `data` field; place a real image at `bruno/fixtures/organizer-logo.png` or edit the file path. It demonstrates both `userId` and `communityId` as `null`; update can clear either or both; delete is a soft delete that preserves related events.

Events are available through Get Events and Get Event for public, non-deleted events. Get Events supports optional `search` across title, slug, city name, and discipline sport name, plus `cityId`, `disciplineSportId`, `organizerId`, `eventType`, and `startsFrom` filters. Both GET responses include `event_discipline_sports` rows whose linked discipline sport is active in the `disciplineSports` array; Get Event also includes `event_ticket_types` as `ticketTypes`. Create Event, Update Event, and Delete Event require a verified Bearer token with an active numeric `user_roles.role_id` of `1` or `4`. Create Event uses multipart form data: put event fields in the JSON `data` part and optionally attach one JPEG, PNG, or WebP file in `posterUrl` (maximum 5 MiB). The same `data` part may include `disciplineSports` (active integer IDs) and `ticketTypes` (`name`, `price`, `quota`, `salesStartAt`, `salesEndAt`); these child rows are inserted atomically with the event. Place a local image at `bruno/fixtures/event-poster.png` or edit the relative path in the Bruno request; omit the file to create an event without a poster. Do not send `posterUrl` inside `data`. The stored public URL is returned as `data.event.posterUrl`; child rows are visible through Get Event. Delete is a soft delete that preserves child rows. Expected errors include 400 VALIDATION_ERROR, INVALID_UPLOAD, INVALID_ORGANIZER, INVALID_CITY, or INVALID_DISCIPLINE_SPORT, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 EVENT_NOT_FOUND, 413 FILE_TOO_LARGE, 415 UNSUPPORTED_IMAGE_TYPE, 409 EVENT_SLUG_EXISTS, and 503 STORAGE_UNAVAILABLE.

Payment checkout is available through Create Payment and Get Payment Order. The verified user sends ticket UUIDs and quantities plus a UUID `Idempotency-Key`; the server calculates IDR from current database prices, checks ticket/event capacity, stores a pending order and item snapshots, and creates the Sumopod payment link. Store Sumopod credentials and fixed return URLs in the backend `.env`; never put the API key in Bruno. Use the same checkout key and exact body to retry a checkout, then change the key for a new purchase. `201` means a pending link was created, `200` is an idempotent replay, and `202` means provider outcome is unresolved. The Sumopod webhook is available through Sumopod Webhook Completed and uses `X-Webhook-Token` from `SUMOPOD_WEBHOOK_TOKEN`; set the Bruno variable only in a private local environment. A pending payment remains unpaid until a verified webhook arrives. Browser redirects never mark it paid.

Upload Community Logo uses PATCH baseUrl/api/v1/communities/:communityId/logo with multipart field `logo`; Upload Community Cover uses PATCH baseUrl/api/v1/communities/:communityId/cover with multipart field `cover`. POST aliases are also accepted for clients that use POST multipart uploads. Both require the owner or an active admin, accept JPEG/PNG/WebP up to 5 MiB, and return the full community view with the public S3 URL. Set a real local image path in each Bruno request before sending. Errors include 400 INVALID_UPLOAD, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 COMMUNITY_NOT_FOUND, 413 FILE_TOO_LARGE, 415 UNSUPPORTED_IMAGE_TYPE, and 503 STORAGE_UNAVAILABLE.

Cities for one province are available through GET baseUrl/api/v1/provinces/:provinceId/cities. Use an ID returned by Get Provinces.

The profile endpoint is PATCH baseUrl/api/v1/users/me/details. It always uses the caller from accessToken; no user ID is accepted. JSON omits unchanged fields and uses null to clear nullable values or remove the current photo. Uploads are limited to 5 MiB and require AWS_REGION, S3_PROFILE_PHOTO_BUCKET, PROFILE_PHOTO_PUBLIC_BASE_URL, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY in the server root .env file. For an S3-compatible provider, also configure S3_ENDPOINT and, if required, S3_FORCE_PATH_STYLE=true. The successful response contains the public S3 URL in data.details.profilePhoto.

When setting cityId, use an ID returned by the active PostgreSQL geography rows (cities joined to provinces with both deleted_at IS NULL); IDs are local and can differ between databases.

Expected errors are 400 VALIDATION_ERROR, 400 INVALID_UPLOAD, 400 INVALID_CITY, 401 UNAUTHORIZED, 413 FILE_TOO_LARGE, 415 UNSUPPORTED_IMAGE_TYPE, and 503 STORAGE_UNAVAILABLE.

Register requires SMTP_ENABLED=true. Verify Email and Resend Verification OTP do not require a token. The Login token is intentionally not persisted in the collection. Do not enter real production credentials, OTPs, or tokens in a tracked environment file. Create environments/Local.private.bru when real secrets are required; files with the .private.bru suffix are ignored by Git.
