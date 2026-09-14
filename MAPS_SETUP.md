# Google Maps setup — the route screen's map

The "Navigate to patient location" screen (`src/app/session/route.tsx`) renders a real map with
the therapist's position, the patient's home, and the straight-line distance between them.

**The app builds and runs without any of this.** Without a key it shows an address card instead of
a map, and the distance label still works. Nothing here is required to ship — it only turns the
map on.

---

## What it costs

**Nothing, for what this screen does.** Worth stating plainly, because "Google Maps" and "billing"
travel together in most people's heads:

| What we use | Billed? |
|---|---|
| Map display via **Maps SDK for Android** | **No** — mobile dynamic map loads are not charged |
| Deep link into Google Maps for turn-by-turn (`openInMaps`) | **No** — a URL intent, not an API call |
| Distance between the two points | **No** — haversine, computed on the device (`lib/utils/geo.ts`) |
| Geocoding / Directions / Distance Matrix / Places | **Yes** — and this screen calls none of them |

The screen deliberately avoids every billed SKU. It does not geocode (the backend now sends
`location.coords`), and it does not request a route — the dashed line is a bearing, and navigation
is handed off to the Maps app, which is free.

> Google restructured Maps Platform pricing in March 2025 to a per-SKU monthly free allowance.
> Confirm current terms before relying on this table; the *shape* of the argument — mobile map
> display and deep links are free, the lookup APIs are not — has held for years.

---

## Setup (one-time, ~5 minutes)

1. Open the [Google Cloud console](https://console.cloud.google.com/) and select project
   **`physiobuddies-d6a31`** — the same project as Firebase, so nothing new needs creating.
2. **APIs & Services → Library →** enable **Maps SDK for Android**.
   (Add **Maps SDK for iOS** too if iOS is ever built — it has never been compiled.)
3. **APIs & Services → Credentials → Create credentials → API key.**
4. **Restrict the key.** Not optional — see below.
5. Put it in the environment when building:

   ```bash
   # PowerShell
   $env:GOOGLE_MAPS_API_KEY = "AIza..."
   npm run apk
   ```

   For EAS builds, add `GOOGLE_MAPS_API_KEY` to the profile's `env` block in `eas.json`, or store
   it as an EAS secret.

`app.config.js` reads the variable, writes it into the native manifest as
`com.google.android.geo.API_KEY`, and publishes `extra.mapsEnabled` so the UI knows a map can
render. No key set means no manifest entry and no map — never a blank grey rectangle.

---

## Restricting the key — do not skip

**The key ships inside the APK and is extractable.** That is unavoidable: the Maps SDK reads it
from the manifest at runtime. Restriction, not secrecy, is what protects it.

In the console, on the key:

- **Application restrictions → Android apps.** Add package name `com.physiobuddies.therapist`
  plus a signing-certificate SHA-1.
- **API restrictions → Restrict key →** Maps SDK for Android only.

### Two SHA-1s, not one

The local review build (`npm run apk`) signs with the **debug keystore**; EAS builds sign with a
different key. A key restricted to only one of them makes the map blank on the other — which looks
exactly like a broken map rather than a rejected credential.

```bash
# debug keystore (local npm run apk builds)
keytool -list -v -keystore "$env:USERPROFILE\.android\debug.keystore" -alias androiddebugkey -storepass android -keypass android

# EAS build credentials
npx eas credentials
```

Add both SHA-1 values to the key's Android restrictions.

---

## Verifying it worked

```bash
node -e "console.log(require('./app.config.js')({config:{android:{},extra:{}}}).extra.mapsEnabled)"
```

`true` means the key was picked up. After building, confirm it reached the manifest:

```bash
grep -A1 "geo.API_KEY" android/app/src/main/AndroidManifest.xml
```

On device: open an appointment → **Navigate to patient location**. You should see the map with a
red home marker, and — once location permission is granted — a blue marker for yourself, a dashed
line between them, and a `~N km away` label.

---

## If the map is blank/grey

Almost always the key, in this order:

1. **Maps SDK for Android not enabled** on the project.
2. **SHA-1 mismatch** — you are running a debug-signed local build against a key restricted to the
   EAS certificate, or vice versa.
3. **Key absent at build time** — `GOOGLE_MAPS_API_KEY` was not exported in the shell that ran
   `npm run apk`. In this case you should see the address-card fallback rather than grey; grey
   means the key was present but rejected.

`adb logcat | grep -i "Google Maps Android API"` prints the SDK's own reason, which names the
failing restriction directly.

---

## A note on what is on screen

The patient's home coordinates are health-adjacent personal data. They now flow through the
booking detail into this screen, and the in-app network log (`Profile → Support → Network log`)
captures response bodies — it redacts credentials but **not** coordinates, and the log can be
shared out of the app. Worth remembering before adding more location data to this flow.
