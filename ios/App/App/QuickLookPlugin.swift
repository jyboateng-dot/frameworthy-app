import Foundation
import UIKit
import QuickLook
import Capacitor

/**
 * Presents Apple's own AR Quick Look (QLPreviewController) directly from
 * native code, bypassing WKWebView entirely.
 *
 * WKWebView — what this app's web content runs inside — does not hand a
 * tapped `rel="ar"` link to Quick Look the way Safari does. By default it
 * shows its own generic in-page model preview instead, with AR bolted on
 * as a secondary control buried inside that — confirmed on real hardware
 * as the extra "view 3D object, then tap AR" steps a customer had to take
 * to get into AR at all. There is a private WKWebView flag
 * (`_systemPreviewEnabled`) that reportedly restores the Safari-like
 * hand-off, but it's unpublished API and a real App Store review risk to
 * ship. QLPreviewController is the public, documented alternative Apple
 * ships for exactly this case — it's what Files, Mail, and Messages use
 * to preview a USDZ — and calling it from Swift never touches the
 * WebView at all, so none of its link-handling behaviour is involved.
 *
 * `ARQuickLookPreviewItem` only accepts a local file URL, not a remote
 * one (confirmed against Apple's own guidance — passing a `https://` URL
 * directly silently fails to load), so the model is downloaded here
 * before Quick Look ever sees it. The relay endpoint it downloads from
 * (functions/index.js's arRelay) already exists for the web build's own
 * AR path; this plugin is simply a second consumer of the same URL.
 */
@objc(QuickLookPlugin)
public class QuickLookPlugin: CAPPlugin, CAPBridgedPlugin, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    public let identifier = "QuickLookPlugin"
    public let jsName = "QuickLook"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "present", returnType: CAPPluginReturnPromise)
    ]

    // Held for the presentation's lifetime — QLPreviewControllerDataSource
    // is asked for this lazily as the sheet renders, not just once at
    // present() time, and the delegate needs it again on dismiss to know
    // which temp file to clean up.
    private var previewItem: ARQuickLookPreviewItem?

    @objc func present(_ call: CAPPluginCall) {
        guard let urlString = call.getString("url"), let remoteURL = URL(string: urlString) else {
            call.reject("A valid url is required")
            return
        }
        guard let hostController = self.bridge?.viewController else {
            call.reject("No view controller to present from")
            return
        }

        let task = URLSession.shared.downloadTask(with: remoteURL) { [weak self] tempLocation, _, error in
            guard let self = self else { return }
            guard let tempLocation = tempLocation, error == nil else {
                call.reject("Could not download AR model", nil, error)
                return
            }

            // A download task's temp file has no extension, and Quick
            // Look reads the file's own extension to recognise it as a
            // USDZ — the network response's Content-Type header isn't
            // consulted the way a browser would.
            let localURL = FileManager.default.temporaryDirectory
                .appendingPathComponent(UUID().uuidString)
                .appendingPathExtension("usdz")
            do {
                if FileManager.default.fileExists(atPath: localURL.path) {
                    try FileManager.default.removeItem(at: localURL)
                }
                try FileManager.default.moveItem(at: tempLocation, to: localURL)
            } catch {
                call.reject("Could not stage AR model locally", nil, error)
                return
            }

            let item = ARQuickLookPreviewItem(fileAt: localURL)
            item.allowsContentScaling = true
            self.previewItem = item

            DispatchQueue.main.async {
                let controller = QLPreviewController()
                controller.dataSource = self
                controller.delegate = self
                hostController.present(controller, animated: true) {
                    call.resolve()
                }
            }
        }
        task.resume()
    }

    public func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        previewItem == nil ? 0 : 1
    }

    public func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        // Only ever called after numberOfPreviewItems reports 1, so this
        // item is guaranteed to exist.
        previewItem!
    }

    public func previewControllerDidDismiss(_ controller: QLPreviewController) {
        if let url = previewItem?.previewItemURL {
            try? FileManager.default.removeItem(at: url)
        }
        previewItem = nil
    }
}
