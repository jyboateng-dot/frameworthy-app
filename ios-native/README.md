# FrameWorthy iOS

This is the native SwiftUI application, opened through `FrameWorthy.xcodeproj`. It is developed independently from the repository-root Capacitor app while both clients share FrameWorthy backend services.

## Client identity

| Client | Bundle identifier | Source |
| --- | --- | --- |
| Capacitor iOS app | `com.frameworthyco.app` | Repository root |
| Native SwiftUI app | `com.frameworthyco.native` | `ios-native/FrameWorthy` |

Using different identifiers lets both apps coexist on one device and keeps their Apple signing and App Store releases independent.

## Requirements

- Xcode 16 or later
- iOS 17.0 deployment target
- An iPhone simulator or device

## Run

1. Open `FrameWorthy.xcodeproj` in Xcode.
2. Select the **FrameWorthy** scheme and an iPhone destination.
3. Run the app.

## Development workflow

- Build Capacitor features on a Capacitor-specific branch and pull request.
- Build SwiftUI features on a native-iOS-specific branch and pull request.
- Share API contracts and backend behavior; implement each client UI in its own source tree.
- Create a matching Apple App ID, development profile, and distribution profile for `com.frameworthyco.native` before physical-device or App Store distribution.

The first native milestone is intentionally self-contained: customers can select a photo, configure a frame, add it to a local cart, and review their quote. Firebase authentication, orders, payments, and production asset catalogues will be added behind native service interfaces instead of embedding the existing web app in a WebView.
