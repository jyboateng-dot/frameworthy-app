# FrameWorthy iOS

This is the native iOS application, built in SwiftUI and opened through `FrameWorthy.xcodeproj`.

## Requirements

- Xcode 16 or later
- iOS 17.0 deployment target
- An iPhone simulator or device

## Run

1. Open `FrameWorthy.xcodeproj` in Xcode.
2. Select the **FrameWorthy** scheme and an iPhone destination.
3. Run the app.

The first native milestone is intentionally self-contained: customers can select a photo, configure a frame, add it to a local cart, and review their quote. Firebase authentication, orders, payments, and production asset catalogues will be added behind native service interfaces instead of embedding the existing web app in a WebView.
