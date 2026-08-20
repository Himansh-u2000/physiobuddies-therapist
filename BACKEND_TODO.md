# Backend work the therapist app is waiting on

The therapist app (`physiobuddies-therapist`) talks to `https://api.dev.physiobuddies.in/api/v1`.

**Most of what this document used to ask for has shipped.** Session lifecycle, clinical assessment,
the treatment-session operations and the weekly slot schedule are all implemented and wired. What
follows is only what is still outstanding, plus a set of **live defects** found while integrating.

Every response must use the standard envelope `{ success, message, data }` and read auth from the
`Authorization: Bearer <accessToken>` header — the app has no cookie jar.

**Priority order: §1 defects (cheap, currently breaking things) → §2 notifications (hang) →
§3 store blockers → §4 everything else.**

---

## 0. Read this first — verified live 2026-08-17

A full app-vs-server audit ran on 2026-08-17; findings and evidence are in
[`../API_AUDIT.md`](../API_AUDIT.md). Three things below have **changed since this file was
written**, and the app has been updated to match:

- **The clinical assessment moved** to `GET`/`POST /treatment-plan/:planId/assessment`. The old
  `POST /treatment-session/:id/assessment` now returns **404** (GET: **500**). Every clinical form
  the app submitted between the move and 2026-08-17 was lost at the final step. If the move was
  intentional, please keep the old path 410-ing rather than 404-ing, or leave a deprecation window —
  a silent relocation of the app's single most important write is expensive.
- **`/notifications/*` (plural) is implemented and working**; `/notification/*` (singular) returns
  **500**. Same split for `/complaints/` vs `/complaint/`. `/activity/` is unaffected. Please retire
  the dead singular mounts rather than leaving them answering 500. §2 has been rewritten around
  what is actually left there (2026-08-20) — it is no longer the "empty controllers" list.
- **`GET /payment/` and `/payments/` now both return 500.** They returned 200 on 2026-08-13, so this
  is a regression. The therapist billing screen has no working source until it's fixed.

Still missing, unchanged: `POST /auth/apple` and `DELETE /account` (both store-submission
blockers).

**Push-token registration landed 2026-08-20** — `POST`/`DELETE /notifications/device-token`,
probed live and now used by the app, superseding the "push is undeliverable" note that stood here.
Two issues remain and §2 has both: the `platform` enum rejects `"android"` (§2.1), and a
web-push-shaped send would display nothing on a native client (§2.2 — this one still blocks actual
delivery).

Two smaller gaps found in the same pass:

- `GET /blog/:slug` returns a like **count** but nothing about the caller's own like, so a reader
  can't be shown whether they already liked a post.
- `POST /therapist/leaves` has no companion **list or cancel** route, so applied leave can't be
  withdrawn from the app.

---

## 1. Live defects — small fixes, real breakage

### 1.1 `GET /therapist/sessions/today` and `/upcoming` are unreachable
Both controllers validate `req.params.therapistId`:

```ts
// therapistSession.controller.ts
getTodaySessions = asyncHandler(async (req, res) => {
  const therapistId = validateSchema(ObjectIdSchema, req.params.therapistId);  // ← always undefined
```

…but neither route declares a `:therapistId` path segment:

```ts
therapistSessionRouter.get('/today', therapistSessionController.getTodaySessions);
therapistSessionRouter.get('/upcoming', therapistSessionController.getUpcomingSessions);
```

So **every call returns `400 Invalid input: expected string, received undefined`**, for every caller,
always. The therapist is already known from `req.user.id` — resolve it there the way `getMyBookings`
does, and drop the param. The app composes today/upcoming from `/my-bookings` in the meantime.

### 1.2 `POST /file-upload/single` returns a URL that `PATCH /user/avatar` rejects
The upload controller returns a **server-relative** path:

```ts
const fileUrl = `/uploads/${req.file.filename}`;   // "/uploads/1786…-photo.jpg"
```

but the avatar endpoint validates its body with `z.string().url()`, so forwarding that value verbatim
— the obvious thing for any client to do — fails validation. It is also not fetchable by a mobile
image component. **Return an absolute URL** (or expose a documented base to join against). The app
currently reconstructs it from the API origin (`absoluteFileUrl()` in `src/lib/api/services.ts`),
which breaks the moment uploads move to S3/Cloudinary on a different host.

This is an **inconsistency, not a policy**: `GET /user` and `GET /therapist/` both return `image` as
a fully absolute `https://api.dev.physiobuddies.in/uploads/…`. Only the upload response is relative.

### 1.3 `GET /invoice/:id` can't be reached from a payment record
`GET /payment/` returns `"invoiceId": "INV-SUB-0001"` — a human display number. `GET /invoice/:id`
validates its param as a Mongo ObjectId and answers `400 Invalid ObjectId format` for that value.
So there is no path from a payment to its invoice. Either expose the invoice's ObjectId on the
payment, or let `/invoice/:id` resolve the display number.

### 1.4 `GET /user/sessions/` doesn't resolve `location` or `isCurrentSession`
Every row comes back with `"location": ""` and `"isCurrentSession": false` — including the session
created by the request making the call. Both fields are in the payload, so something is meant to
populate them. Until they do, a "sign out my other devices" UI can't safely mark the current device,
which is the one row it must never offer to revoke.

### 1.5 Assessment write and read field names differ
`POST /treatment-session/:id/assessment` reads the techniques array from **`treatmentPlan`**:

```ts
treatmentPlanItems: payload.treatmentPlan || [],   // assessment.helper.ts
```

…but `GET` returns it as **`treatmentPlanItems`**. A client that round-trips its own read — again,
the obvious thing — silently stores an empty array, because the mapper defaults rather than
validates. Accept both names on write, or rename one. This class of bug is invisible in testing:
nothing errors, the data is just gone.

### 1.6 Assessment enums are coerced, not validated
`mapDurationOfSymptoms`, `mapROM`, `mapMuscleStrength`, `mapVisitFrequency` all `default:` to a value
instead of rejecting:

```ts
default: return 'Full';        // an unrecognised ROM becomes "Full"
```

On **clinical data** that means a typo or a version skew stores *a different finding* rather than
failing. A therapist recording "Severe Restriction" against a client that sent a slightly wrong
string gets "Full" in the record. Please `throw` on unrecognised values.

### 1.7 `GET /treatment-plan/` list and detail hang
`AppointmentController.createTreatmentPlan / listTreatmentPlans / getTreatmentPlanById /
cancelTreatmentPlan` are empty method bodies — the request never gets a response and the client
waits for its timeout. Same class as §2. The app reads plan data from
`/therapist/sessions/my-bookings/:id` instead, which is complete and correct.

### 1.8 `GET /therapist/:id/faqs` and `/articles` omit the `id` — edit and delete are impossible
**Promoted out of "smaller items" (2026-08-13): this now visibly disables UI.** The read
projection returns `{ question, answer, createdAt }` with no primary key, while
`PATCH`/`DELETE /therapist/faqs/:id` (and the article equivalents) address rows *by* that key.
`therapistFAQ` is its own Prisma model and does have an `id` — the select just doesn't ask for it.

Verified live 2026-08-13:

```
POST /therapist/faqs {"question":"…","answer":"…"}
  → 201 {"success":true,"message":"Faq created successfully","data":null}
GET  /therapist/6a60ceb577a6fdaf79a22d9b/faqs
  → 200 [{"question":"…","answer":"…","createdAt":"2026-08-13T17:39:40.847Z"}]   ← no id
```

So a therapist can add an FAQ and then never change or remove it. **Fix: add `id` to the select in
both read projections** (and return the created row from `POST` rather than `data: null`, so the
app doesn't have to refetch to see it).

#### ✅ RESOLVED (2026-08-18): the write routes are back

They had vanished — every POST/PATCH/DELETE answered Express's unmatched-route 404 for part of
the day, and the app was made read-only behind a flag. All six are live again and were verified
end-to-end against `api.dev.physiobuddies.in`:

```
POST   /therapist/faqs      {question, answer}  → 200 {id, question, answer, createdAt}
POST   /therapist/articles  {title, content}    → 200 {id, title, content, createdAt}
PATCH  /therapist/faqs/:id                      → 200  (returns the updated row)
PATCH  /therapist/articles/:id                  → 200  (returns the updated row)
DELETE /therapist/faqs/:id                      → 202  "FAQ deleted successfully"
DELETE /therapist/articles/:id                  → 202  "Article deleted successfully"
```

The app-side flag is gone and the composers, editor and Create buttons are all wired up again.

#### ⚠️ STILL OPEN: the LIST reads omit `id`, so edit and delete remain unreachable

This is the original §1.8 defect and it survived the restore. `POST` and `PATCH` both return the
row *with* its `id`, but the list projection does not:

```
GET /therapist/6a830016f85ba191340ff715/faqs
  → 200 [{"question":"…","answer":"…","createdAt":"…"}]        ← no id
GET /therapist/6a830016f85ba191340ff715/articles
  → 200 [{"title":"…","content":"…","createdAt":"…"}]          ← no id
```

So the practical behaviour would be: **creating always works; editing or deleting works only
until the list refetches**, at which point every row loses the id its `PATCH`/`DELETE` needs.

**As of 2026-08-20 the app no longer offers edit or delete at all.** Both sections are
create-and-view: FAQs list as plain cards, and an article opens on a read-only `/article-view`
screen that renders its Markdown. The `updateFaq`/`deleteFaq`/`updateArticle`/`deleteArticle`
wrappers were removed from `contentApi` along with the UI, so restoring editing means re-adding
them — they are four one-line `client.patch`/`client.delete` calls.

**Fix: add `id` to the select in both list projections.** It is one field in each query, the
models already have it, and the write endpoints already return it — the two reads are the only
place it is missing. That is the only thing standing between here and editable content; the
routes themselves are live and were verified working.

### 1.9 The session-lifecycle paths the app was calling do not exist

Verified 2026-08-18. Three of the five calls that make up "start and finish a visit" were addressed
to routes the server has never served, each answering Express's unmatched-route 404:

| App called (404) | Route that actually exists | Status |
|---|---|---|
| `PATCH /therapist/sessions/my-bookings/:id/accept` | `POST /treatment-session/confirm`, body `{ sessionId }` | **fixed app-side** |
| `POST  /therapist/sessions/my-bookings/:id/generate-otp` | `POST /treatment-session/:id/send-otp` (no body) | **fixed app-side** |
| `POST  /therapist/sessions/my-bookings/:id/verify-otp` | `POST /treatment-session/:id/verify-otp`, body `{ otp }` | **fixed app-side** |
| `POST  /therapist/sessions/my-bookings/:id/end` | *nothing* — see below | **open** |

Note the id in `confirm` travels in the body, not the path, unlike every other call in the group.

**There is no `end` endpoint.** The closest documented equivalent is
`POST /treatment-session/:id/improvement-record` — Swagger summary "Record Improvement & Complete
Session" — which the app already calls separately, and `POST /treatment-plan/:planId/assessment`
also flips the plan's `active` session to `completed` as a side effect. So a visit *is* completed
server-side; it is the redundant extra call that fails, and it fails inside the offline sync queue,
which retries it until the row parks as `error`. Deciding whether the queue should drop that step
or call `improvement-record` in its place changes queue semantics, so it is left as an explicit
decision rather than a guess. **Either confirm `improvement-record` is the intended completion
call, or add the missing `end` route.**

#### `send-otp` does not return the code — there is no way to test the flow on one handset

Probed live 2026-08-18 against a real confirmed session
(`POST /treatment-session/6a830a19fb5588c9e1e6fc1c/send-otp`):

```
200 {"success":true,"message":"ok",
     "data":{"message":"OTP sent to patient successfully.","expiresInMinutes":5}}
```

No code in the body, and `GET /treatment-session/:id` immediately afterwards still reports
`otpCode: null`, `otpExpiresAt: null` — so the value is either held outside the session document
or nulled in the read projection. Either way the therapist has no way to obtain it, and QA needs a
second logged-in patient handset to test starting a visit at all.

**Ask:** return the generated code on the send-otp response (`otpCode`, matching the session
model's own field name) in the dev/staging deployment only. The app is already wired for it:
`pickEchoedOtp` reads it defensively, and `SHOW_TEST_OTP` — pinned `false` in `.env.production`
and the EAS production profile — decides whether it's rendered. **It must never be returned by
the production deployment:** it is a one-time password handed to a second party, and anyone
holding the therapist's device could then start a visit the patient never consented to.

### 1.10 `add-docs` is multipart, and clinical files were bypassing it

Two separate problems, found together on 2026-08-18.

**a) The app posted the wrong content type.** `sessionApi.addDocuments` sent JSON
(`{ documents: [{ url, name, fileType }] }`) to `POST /treatment-session/:id/add-docs`, which is a
multipart endpoint. Every shape of JSON is rejected identically:

```
400 {"success":false,"message":"No file uploaded","code":"VALIDATION_ERROR"}
```

It had no callers, so the breakage was latent. **Swagger is also wrong here** — it declares an
`application/json` request body of `{ name, fileType }` with no file part at all. The verified
contract, probed against the running server:

```
POST /treatment-session/:id/add-docs        multipart/form-data
  file      <the bytes>          (multer field name, same as /file-upload/single)
  name      "xray.jpg"
  fileType  "image/jpeg"
→ 200 { id, name, url: "/file/<id>", fileType, mimeType, treatmentPlanId,
        storagePath: "/app/private-uploads/<hash>", uploadedBy, uploadedByUserId, createdAt }
```

One document per call — not an array. The document then appears on
`GET /therapist/sessions/my-bookings/:planId` under `documents[]`. Fixed app-side as
`sessionApi.addDocument`, pinned by tests, since Swagger can't be trusted for this route.

**b) Patient files were going to a public path.** Session photos were uploaded with
`/file-upload/single`, which writes to a static path that is **not behind the auth middleware**
(`/uploads/...` returns no 401 challenge), and the resulting urls were stored on the clinical
assessment as `documentUrls`. `add-docs` exists precisely to avoid that: its bytes land in
`private-uploads` and `GET /api/v1/file/:id` gates retrieval — 401 without a token, 404 for anyone
who isn't the patient, the assigned therapist, or an admin. All clinical files now go through
`add-docs`; `/file-upload/single` is kept only for avatars and the therapist's own KYC documents.

**Backend asks:**

1. **Fix the Swagger entry** for `add-docs` to describe `multipart/form-data` with a `file` part.
   As written it would lead any new client into exactly the failure above.
2. **Accept `Idempotency-Key` on `add-docs`.** It has no dedupe today, so a retry after a dropped
   response attaches the same photograph to the plan twice. The app works around this by
   persisting the returned document id and refusing to re-send a row that has one, but that only
   protects this client.
3. **Consider whether `/uploads/*` should be public at all** — even for avatars, and given
   `storagePath` is already returned in API responses.

### 1.11 Smaller items
- **`my-bookings` returns no per-booking price.** `Appointment.amount` is `0` app-side, so no
  appointment surface can show what a visit is worth. `priceAtBooking` exists on the session.
- **Swagger is materially inaccurate.** It documents `POST /auth/refresh-token` (the real route is
  `/auth/refresh`) and omits `POST /treatment-session/:id/improvement-record` entirely. The slot
  routes (`GET/PUT /therapist/slots/schedule`, `/slots/overrides`, `/slots/blocks-and-leaves`) *are*
  documented as of 2026-08-18 — and their schemas are now enforced at runtime, which is how §1.10
  became a 500 rather than a quiet shape mismatch. Probing live beats reading either the doc or the
  checked-out source.

### 1.10 `PUT /therapist/slots/schedule` can store a week that `GET` then refuses to serve

Found live 2026-08-18. `PUT` documents and accepts a day in **either** shape:

```jsonc
{ "schedule": { "monday": ["morning", "evening"] } }                          // bare array
{ "schedule": { "monday": { "shifts": ["morning"], "disabledHours": [7] } } } // object
```

…and persists whichever it was given. But the **`GET` response contract only permits the array**
(`schedule` is typed `additionalProperties: { type: "array", items: { type: "string" } }`). So the
moment a day is saved in the object form, every later read fails the server's own response
validator:

```
GET /therapist/slots/schedule
500 { "success": false,
      "message": "Server produced a response that does not match its declared contract.",
      "code": "RESPONSE_CONTRACT_ERROR" }
```

It is permanent — retrying can't help, and the therapist's Weekly defaults tab is dead until the
schedule is overwritten. Reproduced end to end on the seed therapist: PUT object form → GET 500;
PUT array form → GET 200.

**Fix:** widen the GET response schema to the same `anyOf` the PUT request already uses (and return
`disabledHours`, which is currently write-only and therefore unusable). Either that, or reject the
object form on write instead of accepting data that can't be read back.

Meanwhile the app **only ever sends the bare array form** and treats
`RESPONSE_CONTRACT_ERROR` as "unreadable, re-save to repair" rather than as a retryable 5xx.

### 1.11 `GET /therapist/:id/availability` renamed its slot fields

The slot objects now come back as `{ startMinute, durationMinutes, category, status }`; they were
previously `{ startHour, startTime, endTime, category, status }`. Nothing announced the change and
the field names don't overlap, so every consumer reading `startHour` silently got `undefined` —
in the therapist app that emptied the whole day grid, since `/therapist/slots/block` keys on the
hour. The app now derives the hour from `startMinute` and accepts both shapes. Flagging it only as
a process point: a rename in a response payload needs the same deprecation window as a route move.

### 1.12 The therapist's copy of a booking drops the patient's coordinates and phone

Verified live 2026-08-20 against the seed therapist. `GET /therapist/sessions/my-bookings/:id`
returns:

```jsonc
"location": { "address": "…", "landmark": "…", "city": "…", "state": "…", "postalCode": "…" },
"patient":  { "id": "PAT-2026-001", "name": "…", "dob": "…", "gender": "FEMALE" }
```

Two fields the therapist needs on a home visit are missing, and **the data is already loaded when
the response is built** — this is a formatting omission, not a schema gap:

- **`location.coords` (lat/lng).** `PatientLocation.location` is `Json { lat, lng }`, and
  `therapistSession.service.ts` already selects it (`locations: { … location: true }`). But
  `formatTherapistBookingDetail` (`therapistSession.helper.ts`, the `location:` block) copies
  address/landmark/city/state/postalCode and drops `location`. The **patient's** formatter for the
  same booking does return it — `patient.helper.ts` emits `location.coords` — so the two sides of
  one booking disagree.
- **`patient.phone`.** Same helper: the patient-side formatter emits `phone`, the therapist-side
  one doesn't. The therapist app's Call button and the patient row on the route screen both read
  it, so they show blank and toast "Patient phone unavailable" against the real API.

**Fix:** in `formatTherapistBookingDetail`, add `coords: patientLocation?.location` to the
`location` object and `phone: patientDetail.phone` to `patient` — mirroring `patient.helper.ts`
so a booking reads the same from both sides. (`patientDetail` will need `phone: true` added to its
`select`.)

**Consequence today, and the workaround.** Turn-by-turn navigation to an exact point is
impossible for a therapist. The web app hit this first and worked around it the same way the
mobile app now does: hand Google Maps the **address string** rather than coordinates
(`maps/search/?api=1&query=…` — see `VisitLogistics.tsx` in `client2/`). That geocodes to a
best-guess pin, which is usually good enough for a street address and useless for anything
ambiguous. The app reads `location.coords` already and prefers it whenever it appears, so this
needs no app change once the field is sent.

---

## 2. Notifications — implemented; two issues left, one of them blocking push delivery

**Superseded 2026-08-20.** The plural `/notifications/*` mount is live and the app is fully wired
to it, including the device-token routes that did not exist when this section was written. What
was here — empty controllers, a missing `POST /notification/token`, "push cannot work no matter
what the app does" — is no longer true. The singular `/notification/*` mount is still dead (500),
and nothing calls it.

Verified live against `api.dev.physiobuddies.in` on 2026-08-20 with the seed therapist:

| Route | Result |
|---|---|
| `GET /notifications/` | 200 `{ items, nextCursor, hasMore, unreadCount }` |
| `GET /notifications/unread-count` | 200 `{ unreadCount }` |
| `PATCH /notifications/:id/read`, `/read-all` | 200 |
| `GET`/`PATCH /notifications/preferences` | 200, six booleans |
| `POST /notifications/device-token` | 200, upsert by token |
| `DELETE /notifications/device-token/:token` | 200 `{ success }` — `false`, not 404, when unknown |

### 2.1 `device-token.platform` is `enum: ["web"]` and rejects mobile clients

```
POST /notifications/device-token  { "token": "…", "platform": "android" }
→ 400 {"message":"Invalid input: expected \"web\"","code":"VALIDATION_ERROR","details":{"field":"platform"}}
```

The stored row then reads `platform: "web"` for what is an Android handset, because the field
defaults to `"web"` when omitted — so the table cannot distinguish a browser from a phone, which
is exactly the distinction the sender needs to make in §2.2.

**Ask:** widen the enum to `["web", "android", "ios"]`. The app currently omits `platform`
entirely to avoid the 400; it will start sending `Platform.OS` as soon as the enum accepts it
(one-line change, `notificationApi.registerPushToken`).

### 2.2 A web-push-shaped payload displays nothing on a native client — blocks push delivery

The endpoint documents itself as registering "an FCM **web-push** token for the signed-in user's
current browser", which suggests the sender builds the message as web push:

```ts
messaging.send({ token, webpush: { notification: { title, body }, fcmOptions: { link: url } } })
```

FCM will deliver that to a native Android token, but Android ignores the `webpush` block — the
message arrives as **data-only** and the system tray shows nothing. The therapist gets silence.

**Ask:** when the target token is not a browser, include a common `notification` block (and
ideally an `android` block) alongside the `webpush` one:

```ts
messaging.send({
  token,
  notification: { title, body },                     // ← what native clients render
  android: { priority: 'high', notification: { channelId: 'default', clickAction: '…' } },
  data: { url },                                     // ← the app reads `data.url` for deep links
  webpush: { notification: { title, body }, fcmOptions: { link: url } },
});
```

`data.url` matters independently of the above: it is how the app deep-links a tap. It should carry
the same path the catalog already puts on `metadata.url` (`/therapist/my-bookings/<planId>` etc.) —
the app translates those web paths to its own routes in `src/lib/notifications/links.ts`.

The app mitigates the foreground case only (it re-presents a data-only push as a local
notification). A push arriving while the app is killed cannot be rescued client-side.

### 2.3 Not a defect, just worth knowing

`metadata.url` on the in-app rows is already correct and the app now uses it — rows are tappable.
Note the app's `AppNotification.timestamp` is a *display label* ("3h ago"), derived from `time`;
`type` is a subject category derived from `event`, not the server's `transactional` /
`activity` / `promotional` channel. Both live in `src/lib/api/mappers.ts`.


---

## 3. Store-submission blockers

These are not nice-to-haves — **the apps will be rejected without them.**

| Endpoint | Why it blocks |
|---|---|
| `POST /auth/apple` | App Store Guideline 4.8: an app offering third-party sign-in (Google) **must** offer Apple Sign-In on iOS. The app's `appleSignIn.ts` obtains the identity token and is ready to post it. |
| `DELETE /account` | Both Play and the App Store mandate in-app account deletion. The app's destructive flow is built and calls this. Note Prisma-on-MongoDB needs a replica set for a multi-collection cascade. |

Also incomplete: **`POST /auth/logout` revokes via the refresh *cookie* only**
(`req.cookies.refresh_token`), so it is a no-op from mobile. The app already sends
`{ refresh }` in the body — reading that makes revocation work with no app change.

---

## 4. Still missing / incomplete

### 4.1 Idempotency
`Idempotency-Key` is sent by the app on assessment submit and session end (generated once per record,
resent unchanged on retry) but **is not deduped server-side**. The app retries from an offline queue,
and session completion is payout-adjacent, so a replayed request must not double-count. Today's
endpoints happen to be idempotent by accident (they rewrite the same terminal state); that stops
being true the moment settlement logic is attached.

### 4.2 Therapist-facing patients endpoint
There is none. `/patient/*` is the patient's own API and **403s for a therapist token** (verified).
The app derives its roster from `/therapist/sessions/my-bookings`, which loses phone number, address
and any clinical history not attached to a plan. A real `GET /therapist/patients` would fix that.

### 4.3 Document verification
The Documents screen uploads real files via `POST /file-upload/single`, but there is **no endpoint to
submit a document *as* a credential or read its review state** — the upload has no association to the
therapist or to verification. The app therefore tracks "which slot did I upload for" locally and says
so in the UI rather than inventing a per-document status.

To make it real:
- `POST /therapist/documents` `{ type, fileUrl }`
- `GET /therapist/documents` → `[{ type, fileUrl, status: "pending"|"verified"|"rejected", uploadedAt }]`

### 4.4 Therapist subscription billing
The app's Subscription screen (Quarterly ₹449 / Half-Yearly ₹749 / Annual ₹1199) has its pay button
**disabled** behind `SUBSCRIPTION_PAYMENT_ENABLED=false`, because paying would do nothing:
- `therapistMeta.service.submitFinalOnboarding` creates the `Subscription` **for free** — a literal
  `// TODO: payment for subscription`.
- `payment.verifyPayment` only finalises a patient's session booking; a `purpose:"subscription"`
  payment is marked completed and **activates nothing**.
- There is **no subscription-status endpoint** (`/user` returns onboarding flags only).

To enable: (a) on `POST /payment/confirm` with a subscription-purpose payment, create/extend the
therapist's `Subscription` (months from `notes.planId`); (b) add `GET /therapist/subscription`
returning `{ isActive, plan, startDate, endDate }`. Then the app flips the flag — and needs an RN
Razorpay checkout, which it does not have yet.

### 4.5 ~~Phone-OTP login~~ — **closed 2026-08-13, app side**
The app's login screen used to lead with a phone number field that had no backend behind it. That
screen and its OTP step are **deleted**; login is email/password + Google only. Nothing is expected
of the backend here any more. If phone-OTP is ever wanted as a product feature it is a fresh piece
of work on both sides, not a gap to close.

---

## 5. What's already working — don't re-implement

Wired and probed live against `api.dev.physiobuddies.in`. Every domain now talks to the backend —
there is no mock path left to fall back to:

| Domain | Endpoints |
|---|---|
| Auth | `/auth/login`, `/auth/refresh`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` |
| Profile | `GET /user`, `PATCH /user`, `PATCH /user/avatar`, `PATCH /user/password`, `GET /therapist/:id` |
| Appointments | `GET /therapist/sessions/my-bookings` (+ `/:id`) |
| Session lifecycle | `POST /treatment-session/confirm`, `POST /treatment-session/:id/{send-otp,verify-otp}`, `POST /therapist/sessions/plan/:id/complete` — see §1.9, the `my-bookings/:id/{accept,generate-otp,verify-otp,end}` paths do **not** exist |
| Treatment session | `POST /treatment-session/:id/{start,complete,cancel,no-show,add-docs,reschedule-slot}` |
| Clinical assessment | `GET/POST /treatment-plan/:planId/assessment` (plan id, not session id) |
| Earnings | `GET /therapist/earnings` (+ `/summary`), `GET /therapist/wallet` |
| Payouts | `GET /therapist/payout` (+ `/:id`), `POST /therapist/payout/request` |
| Availability | `GET /therapist/:id/availability`, `POST/DELETE /therapist/slots/block`, `GET/PUT /therapist/slots/schedule`, `GET /therapist/slots/overrides`, `POST /therapist/leaves` |
| Content | `GET /therapist/:id/{articles,faqs,reviews}` — **reads only**, the CRUD routes are gone (§1.8) |
| Support | `GET/POST /complaint`, `POST /complaint/:id/reply` |
| Upload | `POST /file-upload/single` |

**Two integration notes worth keeping in mind when changing any of this:**

1. **The lifecycle endpoints take a `treatmentSession` id, not the treatment-plan id** that
   `my-bookings` is keyed by. `/plan/:id/complete` is the one exception — it takes the plan id.
2. **The assessment POST has a side effect**: if the plan has a session in `active` status it also
   flips that session to `completed` and writes a status log. Submitting the assessment *is* the
   completion for the visit underway.

---

_Updated 2026-08-18: the per-domain `EXPO_PUBLIC_USE_MOCK_*` flags and the bundled fixtures
(`src/lib/api/mock.ts`) were deleted — every service in `src/lib/api/services.ts` now calls the
backend unconditionally, so an outstanding item below shows up as a real error rather than as
plausible-looking fake data._
