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

So a therapist can add an FAQ and then never change or remove it. The app now renders those rows
as explicitly **read-only** with the reason stated, rather than offering Edit/Delete buttons that
fail on tap. **Fix: add `id` to the select in both read projections** (and return the created row
from `POST` rather than `data: null`, so the app doesn't have to refetch to see it).

### 1.9 Smaller items
- **`my-bookings` returns no per-booking price.** `Appointment.amount` is `0` app-side, so no
  appointment surface can show what a visit is worth. `priceAtBooking` exists on the session.
- **Swagger is materially inaccurate.** It documents `POST /auth/refresh-token` (the real route is
  `/auth/refresh`), omits `GET/PUT /therapist/slots/schedule`, `/slots/overrides`,
  `/slots/blocks-and-leaves` and `POST /treatment-session/:id/improvement-record` entirely, and types
  every response `data: any`. Reading the source is currently more reliable than reading the doc.

---

## 2. Notifications — still empty, still hanging

`NotificationController`'s methods are still literally empty:

```ts
async getUserNotifications(_req: Request, _res: Response, _next: NextFunction) {}
```

The request never gets a response, so a mobile client blocks until timeout. **A hang is worse than a
404** — the app can't distinguish it from a dead network, so it can't fail fast or fall back.

This is the last domain the app keeps pinned to bundled fixtures regardless of its global mock switch
(`USE_MOCK_NOTIFICATIONS` is hardcoded `true` for exactly this reason).

| Route | Purpose | Response `data` |
|---|---|---|
| `GET /notification` | list for the authed user | `AppNotification[]` (below) |
| `GET /notification/unread-count` | badge count | `{ count: number }` |
| `PATCH /notification/:id/read` | mark one read | `{ id, read: true }` or 202 |
| `PATCH /notification/read-all` | mark all read | 202 |
| `POST /notification/token` | register a push token | 202 — body `{ token: string }` (**route does not exist yet**) |

```ts
// AppNotification (src/types/index.ts)
{
  id: string;
  type: "appointment" | "payment" | "task" | "system" | "message";
  title: string;
  body: string;            // backend field is `description` — map it
  timestamp: string;       // ISO; app displays it verbatim
  read: boolean;           // backend field is `isRead`
  actionUrl?: string;      // deep link, e.g. "/appointment/<id>"
}
```

The `Notification` Prisma model already exists (`title`, `description`, `isRead`, `priority`, `time`,
`userId`) — this is mostly a query plus a field rename.

**Push depends on this too.** Without `POST /notification/token` there is nowhere to register an FCM
token, so remote push cannot work no matter what the app does.

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

Wired, probed live against `api.dev.physiobuddies.in`, and un-mocked in the app:

| Domain | Endpoints |
|---|---|
| Auth | `/auth/login`, `/auth/refresh`, `/auth/google`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/verify-email` |
| Profile | `GET /user`, `PATCH /user`, `PATCH /user/avatar`, `PATCH /user/password`, `GET /therapist/:id` |
| Appointments | `GET /therapist/sessions/my-bookings` (+ `/:id`) |
| Session lifecycle | `PATCH .../my-bookings/:id/accept`, `POST .../generate-otp`, `.../verify-otp`, `.../end`, `POST /therapist/sessions/plan/:id/complete` |
| Treatment session | `POST /treatment-session/:id/{start,complete,cancel,no-show,add-docs,reschedule-slot}` |
| Clinical assessment | `GET/POST /treatment-session/:id/assessment` |
| Earnings | `GET /therapist/earnings` (+ `/summary`), `GET /therapist/wallet` |
| Payouts | `GET /therapist/payout` (+ `/:id`), `POST /therapist/payout/request` |
| Availability | `GET /therapist/:id/availability`, `POST/DELETE /therapist/slots/block`, `GET/PUT /therapist/slots/schedule`, `GET /therapist/slots/overrides`, `POST /therapist/leaves` |
| Content | `GET /therapist/:id/{articles,faqs,reviews}` + therapist CRUD |
| Support | `GET/POST /complaint`, `POST /complaint/:id/reply` |
| Upload | `POST /file-upload/single` |

**Two integration notes worth keeping in mind when changing any of this:**

1. **The lifecycle endpoints take a `treatmentSession` id, not the treatment-plan id** that
   `my-bookings` is keyed by. `/plan/:id/complete` is the one exception — it takes the plan id.
2. **The assessment POST has a side effect**: if the plan has a session in `active` status it also
   flips that session to `completed` and writes a status log. Submitting the assessment *is* the
   completion for the visit underway.

---

_Updated 2026-08-11 after integrating against `api.dev.physiobuddies.in`. Per-domain mock flags live
in `src/constants/config.ts`; flip the matching `EXPO_PUBLIC_USE_MOCK_*` to `false` once each
outstanding item lands._
