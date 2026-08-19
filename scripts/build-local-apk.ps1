<#
  Builds a standalone review APK locally — the same thing the EAS "demo" profile produces,
  but on this machine (no queue, no build quota). First run downloads Gradle + deps and
  takes 20-40 min; later runs are incremental (~2-5 min).

  Usage:  powershell -ExecutionPolicy Bypass -File scripts\build-local-apk.ps1
          powershell -ExecutionPolicy Bypass -File scripts\build-local-apk.ps1 -Abi x86_64   # emulator
  Output: android\app\build\outputs\apk\release\app-release.apk

  Notes:
  - JAVA_HOME is auto-detected from Android Studio's bundled JBR (no separate JDK needed).
  - EXPO_PUBLIC_API_URL is exported as a REAL environment variable on purpose: a release build
    runs with NODE_ENV=production, so Expo would otherwise load .env.production and point this
    review build at the LIVE backend. Process env wins over .env files, which is what keeps it
    aimed at the dev API.
  - The release buildType signs with the bundled debug keystore (Expo template default),
    so this APK has a DIFFERENT signature than EAS-built ones — uninstall the existing app
    once before installing a local build.
  - Builds ONE native ABI (arm64-v8a by default — virtually every Android phone sold since
    ~2017) instead of gradle.properties' full armeabi-v7a/arm64-v8a/x86/x86_64 set. Two
    reasons: (1) ~4x faster since only one ABI's native modules compile; (2) building all 4
    in parallel (org.gradle.parallel=true, native CMake/ninja per ABI) is a known trigger for
    "ninja: manifest still dirty" flakiness on Windows under heavy concurrent I/O — this hit
    exactly that failure on the first local build here. Passed as a Gradle -P property, not
    written into gradle.properties, so EAS cloud builds (which need all 4 ABIs for store
    distribution) are untouched. Use -Abi x86_64 for an emulator instead of a physical device.
#>

param(
  [string]$Abi = "arm64-v8a"
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot

# --- Locate a JDK 17 ---
# MUST be 17, not just "any JDK". React Native's Gradle plugin compiles itself with
# `kotlin { jvmToolchain(17) }`. Android Studio bundles JDK 21, so with only that present
# Gradle tries to AUTO-DOWNLOAD a 17 toolchain — and the downloader pinned inside
# @react-native/gradle-plugin (foojay-resolver 0.5.0) predates Gradle 9 and dies on the
# removed JvmVendorSpec.IBM_SEMERU field. Running Gradle on 17 satisfies the toolchain
# request directly, so that download path is never taken.
$jdkCandidates = @(Get-ChildItem "$env:ProgramFiles\Eclipse Adoptium" -Directory -Filter "jdk-17*" -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
$jdkCandidates += @(
  "$env:ProgramFiles\Microsoft\jdk-17",
  "$env:ProgramFiles\Java\jdk-17"
)
$javaHome = $null
foreach ($candidate in $jdkCandidates) {
  if ($candidate -and (Test-Path (Join-Path $candidate "bin\java.exe"))) { $javaHome = $candidate; break }
}
if (-not $javaHome -and $env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  $javaHome = $env:JAVA_HOME   # last resort; may not be 17
}
if (-not $javaHome) {
  Write-Error "No JDK 17 found. Install one:  winget install EclipseAdoptium.Temurin.17.JDK"
}
$env:JAVA_HOME = $javaHome
$env:PATH = "$javaHome\bin;$env:PATH"
Write-Host "JAVA_HOME = $javaHome" -ForegroundColor Cyan

# --- Android SDK ---
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk" }
if (-not (Test-Path $env:ANDROID_HOME)) {
  Write-Error "Android SDK not found at $env:ANDROID_HOME. Open Android Studio > SDK Manager and install the SDK."
}
Write-Host "ANDROID_HOME = $($env:ANDROID_HOME)" -ForegroundColor Cyan

# --- CMake/ninja version override ---
# The SDK's default CMake (3.22.1) bundles ninja 1.10.2, whose "manifest still dirty after
# 100 tries" bug reproducibly fails react-native-screens' and react-native-worklets' native
# build on this machine (confirmed: path length, corrupted cache, Gradle parallelism, real-time
# antivirus, and clock sync were all ruled out first). CMake 4.1.2 (ninja 1.12.1) fixes it.
# Two mechanisms because the two modules resolve their CMake version differently:
#  - react-native-worklets hardcodes `System.getenv("CMAKE_VERSION") ?: "3.22.1"` in its own
#    build.gradle — this env var is what it actually reads.
#  - react-native-screens (and everything else) has no such override; local.properties'
#    `cmake.dir` (set once, alongside sdk.dir) is what redirects AGP's own default resolution.
# Requires CMake 4.1.2 installed via Android Studio > SDK Manager > SDK Tools first.
$cmake412 = "$($env:ANDROID_HOME)\cmake\4.1.2"
if (Test-Path $cmake412) {
  $env:CMAKE_VERSION = "4.1.2"
  # CMake 4.x's own documented migration escape hatch: it dropped support for the very old
  # `cmake_minimum_required()` floors several native modules (expo-updates, expo-sqlite) still
  # declare, and refuses to configure at all without this — no code/module patch needed, CMake
  # reads it as an env var for exactly this scenario.
  $env:CMAKE_POLICY_VERSION_MINIMUM = "3.5"
  Write-Host "CMAKE_VERSION = 4.1.2, CMAKE_POLICY_VERSION_MINIMUM = 3.5 (ninja + old-CMakeLists workarounds)" -ForegroundColor Cyan
} else {
  Write-Host "CMake 4.1.2 not found at $cmake412 — if the build fails with 'ninja: manifest still dirty', install a newer CMake via Android Studio's SDK Manager." -ForegroundColor Yellow
}

# --- Review-build env (see note above: must be process env, not .env files) ---
# Points at the DEPLOYED dev backend over HTTPS. This is what makes a release APK usable at all:
# release builds forbid cleartext HTTP, so a http://localhost:3000 value could never be reached
# from a phone.
$env:EXPO_PUBLIC_API_URL = "https://api.dev.physiobuddies.in/api/v1"

# In-app network log (Profile > Support > Network log). ON for this build specifically: it is a
# RELEASE build, so there is no Metro console and Chrome DevTools cannot attach - without this
# there is no way to see a request payload or an error body from the phone. Store builds leave
# the flag unset, where it defaults to __DEV__ (i.e. off).
$env:EXPO_PUBLIC_ENABLE_NETWORK_LOG = "true"

# Show the session OTP the backend echoes back, so the start-session flow can be tested on this
# one handset without a patient device. TESTING ONLY - store builds leave this unset/false.
$env:EXPO_PUBLIC_SHOW_TEST_OTP = "true"

Write-Host "Target ABI = $Abi (pass -Abi x86_64 for an emulator)" -ForegroundColor Cyan

Push-Location (Join-Path $projectRoot "android")
try {
  Write-Host "`nBuilding release APK (first run downloads Gradle + deps, be patient)...`n" -ForegroundColor Yellow
  & .\gradlew.bat assembleRelease "-PreactNativeArchitectures=$Abi" --no-daemon
  if ($LASTEXITCODE -ne 0) { Write-Error "Gradle build failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$apk = Join-Path $projectRoot "android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $apk) {
  $sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 1)
  Write-Host "`nAPK built: $apk ($sizeMb MB)" -ForegroundColor Green
  Write-Host "Install with:  adb install -r `"$apk`"" -ForegroundColor Green
  Write-Host "(If install fails with a signature mismatch, uninstall the EAS build first: adb uninstall in.physiobuddies.therapist)" -ForegroundColor DarkGray
} else {
  Write-Error "Build reported success but no APK found at $apk"
}
