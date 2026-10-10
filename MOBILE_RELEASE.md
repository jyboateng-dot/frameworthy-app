# FrameWorthy mobile apps

FrameWorthy ships iOS and Android apps through Capacitor. The native projects
load the production web app at `https://frameworthyco.com`, then add native
behavior for Apple sign-in, external links, network/status-bar handling, and
AR handoff.

## Local builds

Use Node 22 and install the root dependencies before syncing either platform.

```sh
npm install --legacy-peer-deps
npx cap sync android
npx cap sync ios
```

Open `android/` in Android Studio or `ios/App/App.xcodeproj` in Xcode for
device testing. A native build still depends on the production website being
available because `capacitor.config.json` points at the live URL.

## Android releases

Create a tag in the form `android-X.Y.Z`, for example
`android-1.1.0`. Codemagic uses the tag suffix as `versionName` and its
monotonically increasing `BUILD_NUMBER` as `versionCode`, then produces a
signed Android App Bundle.

The Codemagic `production` environment group must provide:

- `CM_KEYSTORE` — base64-encoded release keystore
- `CM_KEYSTORE_PASSWORD`
- `CM_KEY_ALIAS`
- `CM_KEY_PASSWORD`
- the same `VITE_*` values used by the production web build

The workflow currently emails the AAB artifact. Google Play internal-track
publishing still needs a Play service-account integration.

## iOS releases

Create a tag in the form `ios-X.Y.Z`, for example `ios-1.1.0`.
Codemagic writes the tag suffix to the Xcode marketing version, uses
`BUILD_NUMBER` for the bundle build number, signs the archive, and submits
it to TestFlight.

The Codemagic configuration expects:

- App Store Connect integration `frameworthy_asc`
- signing certificate `frameworthy_cert`
- provisioning profile `frameworthy_profile`
- the `production` environment group with the production `VITE_*` values

## Release checks

Before creating a release tag:

1. Confirm the matching web release is live and healthy.
2. Run the app unit, Firestore rules, and Cloud Functions suites.
3. Build the web app with the production environment values.
4. Test sign-in, artwork import, checkout, external links, and AR on real iOS
   and Android devices.
5. Confirm the App Check logs show verified requests from both native apps.

## Known native follow-ups

- Configure Universal Links and Android App Links.
- Add Google Play internal-track publishing.
- Replace placeholder native tests with launch and critical-flow smoke tests.
- Decide which assets and flows should be bundled for an offline launch
  experience instead of depending entirely on the live website.
- Revisit the shelved native iOS Quick Look plugin only with device logs
  available; the current Safari handoff is the supported path.
