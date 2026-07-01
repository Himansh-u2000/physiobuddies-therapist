# Physiobuddies Therapist App - Implementation Status

Last audited: 2026-06-24

## Source Context

Primary design and implementation references:

- Prototype/design source: `../physiobuddies-therapist-prototype`
- Visual handoff: `../physiobuddies-therapist-prototype/DESIGN-HANDOFF.md`
- Machine-readable design map: `../physiobuddies-therapist-prototype/DESIGN-MANIFEST.json`
- Original pasted MVP plan: Codex attachment `pasted-text.txt`

Current app target:

- Build the physiotherapist partner app using Expo, Expo Router, NativeWind, SQLite/Drizzle, Zustand, TanStack Query, Axios, secure storage, native device capabilities, and mock data until the MERN therapist APIs are connected.
- Current MVP focus is auth, dashboard, and session flow.
- Keep future space for chat and call service, but do not implement messaging until backend support exists.

## Current Completion Estimate

Overall planned app scope: about 75% complete.

MVP scope of auth + dashboard + session + patients: about 85% complete.

Production readiness: about 55% complete.

The UI and route structure are significantly complete, TypeScript passes with zero errors. Core screens (auth, dashboard, appointments, patients, patient detail, earnings, notifications, profile, full session flow) are implemented with mock data. The biggest remaining work is replacing mock data with backend integration, adding real offline sync with SQLite repositories, wiring native behaviors fully (camera upload, real maps, push notifications), and polishing against the exported prototype screens.

## Verification

Completed check:

```bash
./node_modules/.bin/tsc.cmd --noEmit
```

Result: passed with 0 TypeScript errors.

No runtime device/emulator QA has been completed in this audit.

## Completed Work

### Project Setup

Status: mostly complete, about 90%.

Implemented:

- Expo SDK 56 project is present.
- Expo Router is configured with file-based routing from `src/app` (typed routes enabled).
- NativeWind is configured through `tailwind.config.js`, `global.css`, and `nativewind-interop.ts`.
- Main providers are wired in `src/app/_layout.tsx` (DatabaseProvider, QueryProvider, AuthStore hydration, Network monitoring, ToastContainer).
- TanStack Query provider exists with query client.
- SQLite + Drizzle provider exists with schema, migrations, and database instance.
- Zustand stores exist for auth, app state, and session state.
- Secure storage exists for tokens, phone, biometric flag, and therapist profile (expo-secure-store).
- App permissions and plugins are configured in `app.json` (camera, location, biometric, notifications, sqlite, secure-store, sharing).
- Core UI components exist and are exported: Button, Card, Chip, Input (with TextArea, PhoneInput), Avatar, OTPInput, Toggle, Skeleton, BottomSheet, Toast.
- Constants module (`src/constants/config.ts`) centralizes colors, gradients, radii, API base URL (with `EXPO_PUBLIC_API_URL` env var), storage keys, OTP config, session config.
- Types module (`src/types/index.ts`) defines all domain types.
- Utility functions (`src/lib/utils/format.ts`) for currency, time, session type labels, debounce.

Remaining:

- Confirm all installed packages are the intended latest stable versions before release.
- Add lint/test scripts and CI workflow (currently only `expo lint`).
- Add environment-specific API configuration files (`.env.development`, `.env.staging`, `.env.production`).
- Finish production build/dev client setup and EAS project configuration (`app.json` has empty `eas.projectId`).
- Add GitHub Actions or similar for automated typecheck/lint on PR.

### Auth Flow

Status: mostly complete for mock MVP, about 85%.

Implemented screens (6):

- `src/app/(auth)/splash.tsx` - Initial load, hydrate auth, biometric check.
- `src/app/(auth)/login.tsx` - Phone entry with validation, country code selector.
- `src/app/(auth)/otp.tsx` - 6-digit OTP input with paste handling, resend timer.
- `src/app/(auth)/biometric-setup.tsx` - Enable FaceID/TouchID after login.
- `src/app/(auth)/biometric-unlock.tsx` - Biometric prompt on app resume.
- `src/app/(auth)/_layout.tsx` - Auth stack layout.

Implemented behavior:

- Phone number entry and validation (Indian format).
- OTP entry UI with auto-advance, paste support, backspace handling.
- Mock OTP verification (demo OTP: 123456).
- Token/profile persistence through secure storage (access/refresh tokens, expiry, therapist profile, phone, biometric flag).
- Biometric capability hook (`useBiometric.ts`) with hardware detection, enrollment check, authentication.
- Protected route redirection in root layout (`useProtectedRouting`).
- Network monitoring integrated at root (`useNetwork` updates global online state).

Remaining:

- Backend-backed OTP login and verification (replace mock in `authApi.login`/`verifyOtp`).
- Google authentication, if still required by product scope.
- Android SMS OTP auto-detection (READ_SMS permission + SMS Retriever API).
- iOS-compatible manual OTP UX polish.
- Real error states for expired OTP, blocked account, unregistered therapist, network retry with exponential backoff.
- Session expiry handling and logout UX QA.
- Biometric fallback to device passcode UX refinement.

### Dashboard

Status: mostly complete for mock MVP, about 90%.

Implemented:

- Main dashboard route: `src/app/(app)/index.tsx`
- Top bar with therapist profile context (avatar, name, specialization, rating, verification badge, online toggle).
- Hero/stat card with weekly earnings, sessions, patients, rating.
- Online/offline toggle with visual feedback.
- Next session card with patient, time, navigation, start session actions.
- Quick actions grid (Patients, Appointments, Earnings, Documents).
- Pending tasks section.
- Weekly earnings/chart section using `WeeklyChart` component.
- Skeleton loading states for all sections.
- Mock dashboard API through TanStack Query (`therapistApi.getDashboard`).
- Pull-to-refresh pattern ready.

Remaining:

- Backend dashboard API integration.
- SQLite-backed cache hydration (repository functions needed).
- Empty/error/offline dashboard states (offline banner, cached data indicator).
- Final visual comparison with prototype `screens/dashboard.html`.
- Performance QA on low-end Android devices.
- Real-time earnings/session updates via WebSocket or polling.

### Patients Flow

Status: mostly complete for mock MVP, about 90%.

Implemented screens:

- `src/app/(app)/patients.tsx` - Searchable patient list with FlashList, avatar, tags, condition, last visit, session count badge.
- `src/app/patient/[id].tsx` - Patient detail/profile screen with clinical summary, next appointment link, call/message actions, workflow steps, tags.

Implemented behavior:

- Patient list with debounced search (name, condition).
- Patient cards with avatar, age/gender, primary condition chip, tags, last visit.
- Navigation to patient detail on press.
- Patient detail: gradient header with session count, clinical summary card, next appointment card with navigation, workflow progress tracker.
- Call patient action (tel: link).
- Message patient placeholder (toast).
- Mock patient API through TanStack Query (`patientApi.list`, `patientApi.getById`).

Remaining:

- Backend patient API integration.
- SQLite cache repositories for patients.
- Patient create/edit flows (if therapist can add patients).
- Patient documents/attachments view.
- Offline patient list with sync indicators.
- Patient search pagination/infinite scroll for large lists.

### Appointments Flow

Status: mostly complete for mock MVP, about 90%.

Implemented screens:

- `src/app/(app)/appointments.tsx` - Appointments list with time sidebar, patient avatar, status chips, ETA/distance, payment status, navigation to detail.
- `src/app/session/appointment/[id].tsx` - Appointment detail with patient info, map preview with ETA/distance, workflow steps (4 steps), patient notes/history, payment/insurance info, bottom action bar (Navigate, Start Session).

Implemented behavior:

- Appointments list grouped/ordered by time.
- Time column with ETA badge.
- Patient avatar, name, condition, session type chip, payment status chip.
- Distance/km and ETA display when available.
- Navigation to appointment detail.
- Appointment detail: workflow progress (Navigate → OTP → Treatment → Submit), map preview with static position indicators, route stats, call/message patient, patient notes, payment status.
- "Start navigation" deep link to route screen.
- "Start session" deep link to OTP screen.
- Mock appointment API through TanStack Query (`appointmentApi.list`, `appointmentApi.getById`).

Remaining:

- Backend appointments API integration.
- SQLite cache for appointments.
- Real Google Maps/deep-link navigation implementation (currently `geo:` scheme only).
- Real-time appointment updates (new booking, cancellation, reschedule).
- Calendar view alternative.
- Offline appointment list with pending changes queue.

### Session Flow

Status: mostly complete for mock MVP, about 90%.

Implemented screens (7):

- `src/app/session/route.tsx` - Navigation screen with static map preview, route stats, checklist, visit instructions, Open Maps / Enter OTP actions.
- `src/app/session/otp.tsx` - 4-digit session OTP entry with verification, demo OTP hint, "Start without OTP (flagged)" emergency option.
- `src/app/session/active.tsx` - Active session with circular timer, treatment checklist (4 default items), quick session note, upload photo button, end & document button, pause/emergency stop with bottom sheet confirmation.
- `src/app/session/treatment.tsx` - Comprehensive treatment form: chief complaint, pain regions (10 body parts), pain scale (VAS 1-10), assessment findings (6 types), treatments given (9 types), exercises prescribed (with reps/sets, add/remove), clinical notes, precautions, follow-up scheduling, attachments section (placeholder UI).
- `src/app/session/complete.tsx` - Session completion success screen with summary, payout queued, milestones, next actions.
- `src/app/session/_layout.tsx` - Session stack layout.
- `src/app/session/appointment/[id].tsx` - (Also listed under Appointments) Entry point to session flow.

Implemented behavior:

- Session OTP verification using mock API (`sessionApi.start`).
- Session store (`session.store.ts`) manages patientName, condition, elapsedSeconds, checklist, quickNote, sessionId, appointmentId.
- Active session timer updates every second via `setInterval` in screen.
- Treatment checklist toggle with visual feedback.
- Quick note text area auto-saves to store.
- Photo upload placeholder (camera hook wired, opens toast).
- Treatment form: all fields controlled, comprehensive UI, submit calls `treatmentApi.submit`, shows bottom sheet confirmation, navigates to complete on success.
- Session completion triggers payout queued mock, resets session store.
- Navigation flow: Appointment Detail → Route → OTP → Active → Treatment → Complete.

Remaining:

- Real Google Maps/deep-link navigation implementation (launch Google Maps / Apple Maps with directions).
- Real call redirect through IVR or device dialer (currently tel: link only).
- Messaging kept as future scope until backend exists.
- Real camera capture/upload flow for session photos and attachments (camera hook exists, needs integration in active session and treatment form).
- Persist session drafts to SQLite (session store → SQLite).
- Sync treatment form and completion state with backend.
- Handle paused/cancelled/emergency sessions properly (server sync, state recovery).
- Final visual comparison with prototype session screens.
- Offline session draft queue with background sync.

### Earnings Flow

Status: mostly complete for mock MVP, about 85%.

Implemented screens:

- `src/app/(app)/earnings.tsx` - Earnings dashboard with weekly summary card (total this week, change %, this month, pending payout, next payout date), weekly chart, transactions list (FlashList) with status icons (paid/pending/failed), patient name, date, type, amount.

Implemented behavior:

- Mock earnings API (`earningsApi.getSummary`, `earningsApi.getTransactions`).
- Weekly chart component (`WeeklyChart` using FlashList/SVG).
- Transaction list with color-coded status, payout vs session type distinction.
- Skeleton loading states.
- Pull-to-refresh ready.

Remaining:

- Backend earnings API integration.
- SQLite cache for earnings/transactions.
- Detailed transaction view.
- Payout history/schedule screen.
- Export earnings (CSV/PDF).
- Tax/invoice generation.

### Notifications Flow

Status: mostly complete for mock MVP, about 85%.

Implemented screens:

- `src/app/(app)/notifications.tsx` - Notifications list with type icons (appointment, payment, task, system, message), read/unread styling, timestamp, FlashList.

Implemented behavior:

- Mock notification API (`notificationApi.list`).
- Type-specific icons and colors.
- Read/unread visual distinction (highlighted background, blue dot).
- Skeleton loading.
- Push token registration scaffold in `useNotifications.ts` (registers with Expo, calls `notificationApi.registerPushToken`).

Remaining:

- Backend notifications API integration.
- SQLite cache for notifications.
- Mark as read / mark all as read actions.
- Push notification handling (foreground/background, deep linking from notification).
- Notification preferences screen.
- Real push token registration on app start (call `registerForPushNotifications` in root layout).

### Profile & Settings

Status: partially complete, about 70%.

Implemented screens:

- `src/app/(app)/profile.tsx` - Profile screen with therapist avatar, name, specialization, rating, verification badge, settings list (Documents & verification, Notifications, Biometric login toggle display, Security, Help & support), Logout button.

Implemented behavior:

- Therapist info display from auth store.
- Settings list with icons, navigation-ready Pressables.
- Biometric toggle display (reads from auth store).
- Logout action clears auth store, redirects to splash.
- Version display.

Remaining:

- Settings screens for each setting item (Documents, Notifications preferences, Biometric enable/disable, Security, Help).
- Edit profile flow.
- Change password / 2FA setup.
- Account deletion.
- App preferences (theme, language, units).

### Articles & Documents (Stubs)

Status: explicit stubs, about 10%.

Implemented screens:

- `src/app/(app)/articles.tsx` - "Articles module coming soon."
- `src/app/(app)/documents.tsx` - "Document verification module coming soon."

Remaining:

- Full implementation when backend supports content management and document verification.

### Native Capabilities

Status: significantly implemented, about 75%.

Implemented hooks (`src/lib/hooks/`):

- `useBiometric.ts` - Hardware detection, enrollment check, authentication prompt.
- `useCamera.ts` - Permissions, photo capture with `expo-camera`, resize/compress with `expo-image-manipulator`, file size check with `expo-file-system`.
- `useLocation.ts` - Foreground permission, current position, `openInMaps` returning `geo:` scheme URL.
- `useNetwork.ts` - NetInfo listener, updates global online state in app store.
- `useNotifications.ts` - Expo push token registration, channel config (Android), listeners, API registration.
- `useOtp.ts` - Generic OTP input logic (values, complete, paste, backspace, clear, autofill, textContentType).

Expo permissions in `app.json` configured for: camera, location (fine/coarse), biometric, fingerprint, storage, vibration, boot completed, notifications.

Remaining:

- Push token registration must be called from the app flow (e.g., in root layout after auth) and tested on real devices.
- Expo/EAS project ID is still blank in `app.json`.
- SMS OTP retrieval is not actually implemented.
- Camera hook needs end-to-end integration in active session (photo button) and treatment form (attachments), with upload to backend, error states, retry.
- Location hook `openInMaps` returns `geo:` scheme; needs actual `Linking.openURL` call in route screen, test on device.
- Network state drives global online flag; offline banners and cache behavior need to be added across screens.
- Background fetch / background sync for offline queue.

### Local Data and Offline Support

Status: schema/provider started, about 40%.

Implemented:

- SQLite provider (`src/lib/db/provider.tsx`) with `useSQLiteContext`, migration runner.
- Drizzle schema (`src/lib/db/schema.ts`) for therapist_profile, patients, appointments, sessions, treatments, transactions, notifications, app_kv.
- Migration SQL (`src/lib/db/migration.ts`).
- Secure storage for sensitive auth values.
- Types exported for all tables.

Remaining:

- Repository/helper functions for SQLite reads/writes (CRUD for each table).
- Cache hydration from SQLite into screens (initial load from cache, then sync).
- API-to-SQLite sync for dashboard, appointments, patients, earnings, notifications.
- Offline treatment/session draft queue (session store → SQLite → background sync).
- Retry/background sync strategy (exponential backoff, connectivity awareness).
- Conflict handling and stale-data indicators.
- WAL mode/performance tuning for SQLite.
- Encrypted database for sensitive data (SQLCipher).

### API Layer

Status: scaffolded with mock implementations, about 65%.

Implemented:

- Axios client (`src/lib/api/client.ts`) with base URL, timeout, token interceptor (attach access token), refresh-token flow scaffold (401 intercept, refresh, retry).
- Refresh token flow logic complete (queueing during refresh).
- Mock service layer (`src/lib/api/services.ts`) for auth, dashboard, appointments, sessions, treatments, patients, earnings, transactions, notifications.
- All service functions check `USE_MOCK` flag.
- Request/response typing for all endpoints using types from `@/types`.
- `API_BASE_URL` reads from `EXPO_PUBLIC_API_URL` env var with production fallback.

Remaining:

- Replace hard-coded `USE_MOCK = true` with environment config (e.g., `__DEV__` or env var).
- Confirm backend route paths match the MERN API exactly.
- Add API error normalization (standard error shape, user-facing messages).
- Add upload endpoints for photos/documents (multipart/form-data).
- Add real notification token registration endpoint.
- Add integration tests once backend contract is stable.
- Request/response logging in development.
- Request cancellation on unmount.

### Non-MVP and Stub Screens

Status: core MVP screens done; non-MVP are stubs or settings placeholders, about 30%.

Implemented or present:

- Appointments list (MVP) - **DONE**
- Patients list (MVP) - **DONE**
- Patient detail (MVP) - **DONE** (`src/app/patient/[id].tsx`)
- Earnings (MVP) - **DONE**
- Profile (MVP) - **DONE** (settings navigation only)
- Notifications (MVP) - **DONE**
- Articles stub - **STUB**
- Documents stub - **STUB**
- Chat and in-app messaging - **FUTURE SCOPE** (until backend exists)

Remaining:

- Transactions/settings/subscription/help/verification/clinic/availability screens from prototype are not fully mapped into app routes.
- Articles and documents are explicit "coming soon" placeholders.
- Chat and in-app messaging should remain future scope until backend exists.
- Settings sub-screens (Documents, Notifications prefs, Biometric, Security, Help).

## Major Gaps Before MVP Release

1. Turn off mock mode and connect the real therapist API (set `USE_MOCK=false`, verify all endpoints).
2. Implement SQLite cache repositories and sync behavior (read/write helpers, hydration, background sync).
3. Finish real session completion persistence, including treatment forms and attachments (SQLite draft queue + backend sync).
4. Complete native flows on physical Android/iOS devices: biometric, camera (capture/upload), push (token registration + handling), location (real maps), OTP (SMS auto-fill), network loss (offline banner, queue).
5. Match the key prototype screens visually: auth, dashboard, appointment detail, route, session OTP, active session, treatment form, complete, patients list, patient detail, earnings, notifications, profile.
6. Add error, empty, loading, offline, and permission-denied states for all MVP screens.
7. Add release checks: lint, tests, production build, Android/iOS QA on real devices.
8. Configure EAS project (`eas.json`, `app.json` projectId), create development builds, test on device.
9. Set up environment configuration (`.env` files for dev/staging/prod, CI secrets).

## Suggested Next Implementation Order

1. Connect real auth endpoints and make `USE_MOCK` environment-driven (`process.env.EXPO_PUBLIC_USE_MOCK !== 'false'`).
2. Add SQLite repository functions and cache dashboard/appointments/patients for offline-first load.
3. Persist session draft/treatment draft locally (SQLite) before API submission; implement background sync queue.
4. Finish camera capture and attachment upload for active session (photo button) and treatment form (attachments section).
5. Wire real map/deep-link behavior on route and appointment screens (`Linking.openURL` with Google Maps/Apple Maps URLs).
6. Add offline banners, retry states, and synced/pending badges on all lists.
7. Run visual QA against prototype screens at the MVP device sizes.
8. Configure EAS, create development builds, test on physical Android/iOS devices.
9. Implement push notification registration on app start and handle deep links from notifications.
10. Add settings sub-screens and profile editing.

## File Counts Summary (as of audit)

- Auth screens: 6
- App (tab) screens: 9 (index, appointments, patients, earnings, notifications, profile, articles, documents, _layout)
- Session screens: 7
- Patient detail screen: 1
- Components: 15 (ui: 10, shared: 1, dashboard: 4)
- Hooks: 7
- API service modules: 1 (services.ts with 8 service objects)
- DB modules: 3 (schema, migration, provider)
- Store modules: 3 (auth, app, session)
- Types: 1 (index.ts with all domain types)
- Constants: 1 (config.ts)
- Utils: 1 (format.ts)