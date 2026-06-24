# Physiobuddies Therapist App - Implementation Status

Last audited: 2026-06-18

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

Overall planned app scope: about 60% complete.

MVP scope of auth + dashboard + session: about 70% complete.

Production readiness: about 45% complete.

The UI and route structure are significantly started, and TypeScript currently passes. The biggest remaining work is replacing mock data with backend integration, adding real offline sync, wiring native behaviors fully, and polishing against the exported prototype screens.

## Verification

Completed check:

```bash
./node_modules/.bin/tsc.cmd --noEmit
```

Result: passed with no TypeScript errors.

No runtime device/emulator QA has been completed in this audit.

## Completed Work

### Project Setup

Status: mostly complete, about 85%.

Implemented:

- Expo SDK 56 project is present.
- Expo Router is configured with file-based routing from `src/app`.
- NativeWind is configured through `tailwind.config.js`, `global.css`, and `nativewind-interop.ts`.
- Main providers are wired in `src/app/_layout.tsx`.
- TanStack Query provider exists.
- SQLite + Drizzle provider exists.
- Zustand stores exist for auth, app state, and session state.
- Secure storage exists for tokens, phone, biometric flag, and therapist profile.
- App permissions and plugins are configured in `app.json`.
- Core UI components exist: button, card, chip, input, OTP input, avatar, toggle, skeleton, bottom sheet, toast.

Remaining:

- Confirm all installed packages are the intended latest stable versions before release.
- Add lint/test scripts and CI workflow.
- Add environment-specific API configuration.
- Finish production build/dev client setup and EAS project configuration.

### Auth Flow

Status: partially complete, about 75%.

Implemented screens:

- `src/app/(auth)/splash.tsx`
- `src/app/(auth)/login.tsx`
- `src/app/(auth)/otp.tsx`
- `src/app/(auth)/biometric-setup.tsx`
- `src/app/(auth)/biometric-unlock.tsx`

Implemented behavior:

- Phone number entry and validation.
- OTP entry UI.
- Mock OTP verification.
- Token/profile persistence through secure storage.
- Biometric capability hook and unlock/setup screens.
- Protected route redirection in root layout.

Remaining:

- Backend-backed OTP login and verification.
- Google authentication, if still required by product scope.
- Android SMS OTP auto-detection.
- iOS-compatible manual OTP UX polish.
- Real error states for expired OTP, blocked account, unregistered therapist, and network retry.
- Session expiry handling and logout UX QA.

### Dashboard

Status: mostly complete for mock MVP, about 80%.

Implemented:

- Main dashboard route: `src/app/(app)/index.tsx`
- Top bar with therapist profile context.
- Hero/stat card.
- Online/offline toggle.
- Next session card.
- Quick actions.
- Pending tasks.
- Weekly earnings/chart section.
- Skeleton loading state.
- Mock dashboard API through TanStack Query.

Remaining:

- Backend dashboard API integration.
- SQLite-backed cache hydration.
- Empty/error/offline dashboard states.
- Final visual comparison with prototype `screens/dashboard.html`.
- Performance QA on low-end Android devices.

### Session Flow

Status: mostly complete for mock MVP, about 80%.

Implemented screens:

- `src/app/session/appointment/[id].tsx`
- `src/app/session/route.tsx`
- `src/app/session/otp.tsx`
- `src/app/session/active.tsx`
- `src/app/session/treatment.tsx`
- `src/app/session/complete.tsx`

Implemented behavior:

- Appointment detail and workflow steps.
- Route screen shell with ETA/distance display.
- Session OTP verification using mock API.
- Active session timer and treatment checklist.
- Quick session note.
- Treatment form with pain regions, pain scale, assessments, treatments, exercises, notes, precautions, follow-up, and submit confirmation.
- Session complete success/payout screen.

Remaining:

- Real Google Maps/deep-link navigation implementation.
- Real call redirect through IVR or device dialer.
- Messaging kept as future scope until backend exists.
- Real camera capture/upload flow for session photos and attachments.
- Persist session drafts to SQLite.
- Sync treatment form and completion state with backend.
- Handle paused/cancelled/emergency sessions properly.
- Final visual comparison with prototype session screens.

### Native Capabilities

Status: started, about 45%.

Implemented:

- `useBiometric.ts`
- `useCamera.ts`
- `useLocation.ts`
- `useNetwork.ts`
- `useNotifications.ts`
- `useOtp.ts`
- Expo permissions in `app.json`.

Remaining:

- Push token registration must be called from the app flow and tested on real devices.
- Expo/EAS project ID is still blank.
- SMS OTP retrieval is not actually implemented.
- Camera hook needs end-to-end capture, compression, storage/upload, and error states.
- Location hook needs real map opening and route handling.
- Network state should drive offline banners and cache behavior across screens.

### Local Data and Offline Support

Status: schema/provider started, about 35%.

Implemented:

- SQLite provider.
- Drizzle schema for therapist profile, patients, appointments, sessions, treatments, transactions, notifications, and key-value preferences.
- Migration SQL.
- Secure storage for sensitive auth values.

Remaining:

- Repository/helper functions for SQLite reads/writes.
- Cache hydration from SQLite into screens.
- API-to-SQLite sync for dashboard, appointments, patients, earnings, and notifications.
- Offline treatment/session draft queue.
- Retry/background sync strategy.
- Conflict handling and stale-data indicators.
- WAL mode/performance tuning for SQLite.

### API Layer

Status: scaffolded, about 55%.

Implemented:

- Axios client with base URL and token interceptor.
- Refresh-token flow scaffold.
- Mock service layer for auth, dashboard, appointments, sessions, treatments, patients, earnings, transactions, and notifications.
- Current `USE_MOCK` is hard-coded to `true` in `src/lib/api/client.ts`.

Remaining:

- Replace hard-coded mock mode with environment config.
- Confirm backend route paths match the MERN API.
- Add request/response typing for all endpoints.
- Add API error normalization.
- Add upload endpoints for photos/documents.
- Add real notification token registration.
- Add integration tests once backend contract is stable.

### Non-MVP and Stub Screens

Status: present as placeholders or partial screens, about 25%.

Implemented or present:

- Appointments list.
- Patients list.
- Earnings.
- Profile.
- Notifications.
- Articles stub.
- Documents stub.

Remaining:

- Patient detail route is not implemented in the current route structure.
- Transactions/settings/subscription/help/verification/clinic/availability screens from prototype are not fully mapped into app routes.
- Articles and documents are explicit "coming soon" placeholders.
- Chat and in-app messaging should remain future scope until backend exists.

## Major Gaps Before MVP Release

1. Turn off mock mode and connect the real therapist API.
2. Implement SQLite cache repositories and sync behavior.
3. Finish real session completion persistence, including treatment forms and attachments.
4. Complete native flows on physical Android/iOS devices: biometric, camera, push, location, OTP, network loss.
5. Match the key prototype screens visually: auth, dashboard, appointment detail, route, session OTP, active session, treatment form, complete.
6. Add error, empty, loading, offline, and permission-denied states for all MVP screens.
7. Add release checks: lint, tests, production build, Android/iOS QA.

## Suggested Next Implementation Order

1. Connect real auth endpoints and make `USE_MOCK` environment-driven.
2. Add SQLite repository functions and cache dashboard/appointments.
3. Persist session draft/treatment draft locally before API submission.
4. Finish camera capture and attachment upload for active session and treatment form.
5. Wire real map/dialer behavior on route and appointment screens.
6. Add offline banners, retry states, and synced/pending badges.
7. Run visual QA against prototype screens at the MVP device sizes.

