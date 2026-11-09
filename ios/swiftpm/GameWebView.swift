import SwiftUI
import UIKit
import WebKit

/// Hosts the browser game in a WKWebView.
///
/// The game itself is unchanged; this view only supplies what Safari normally
/// provides and a bare WKWebView does not:
/// - `confirm()` / `alert()` / `prompt()` dialogs (the game asks for
///   confirmation before irreversible actions);
/// - saving a downloaded file (JSON save backups, the result card image);
/// - opening external links outside the app.
struct GameWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: BundleSchemeHandler.scheme)
        // Persistent store: saves live in IndexedDB with a localStorage mirror.
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = false
        webView.allowsLinkPreview = false
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 8 / 255, green: 16 / 255, blue: 31 / 255, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        // The page handles the notch and home indicator itself.
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) {
            #if DEBUG
            webView.isInspectable = true
            #endif
        }

        if BundleSchemeHandler.webRoot != nil {
            webView.load(URLRequest(url: BundleSchemeHandler.entryURL))
        } else {
            webView.loadHTMLString(Self.missingBundleHTML, baseURL: nil)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private static let missingBundleHTML = """
    <!doctype html><html lang="ja"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="background:#08101f;color:#fff;font:16px -apple-system;padding:48px 24px">
    <h1 style="font-size:20px">ゲーム本体が見つかりません</h1>
    <p>このアプリの中に web フォルダがありません。配布されたZIPをそのまま開き直してください。</p>
    </body></html>
    """

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
        private var downloadDestinations: [ObjectIdentifier: URL] = [:]
        private weak var hostWebView: WKWebView?

        // MARK: Navigation

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            hostWebView = webView
            if navigationAction.shouldPerformDownload {
                decisionHandler(.download)
                return
            }
            guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
                decisionHandler(.cancel)
                return
            }
            switch scheme {
            case BundleSchemeHandler.scheme, "about", "blob", "data":
                decisionHandler(.allow)
            case "http", "https", "mailto":
                // The game is fully bundled; anything on the network is an
                // outbound link and belongs in the system browser.
                if navigationAction.targetFrame?.isMainFrame ?? true {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                } else {
                    decisionHandler(.allow)
                }
            default:
                decisionHandler(.cancel)
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                     decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
            decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
        }

        func webView(_ webView: WKWebView, navigationAction: WKNavigationAction,
                     didBecome download: WKDownload) {
            download.delegate = self
        }

        func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse,
                     didBecome download: WKDownload) {
            download.delegate = self
        }

        func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
            // iOS killed the web process (memory pressure). The game restores
            // from its own save on load.
            webView.reload()
        }

        // MARK: Downloads (save backups, result card)

        func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                      suggestedFilename: String,
                      completionHandler: @escaping (URL?) -> Void) {
            let name = suggestedFilename.isEmpty ? "capitalism-tycoon-export" : suggestedFilename
            let directory = FileManager.default.temporaryDirectory
                .appendingPathComponent("exports-\(UUID().uuidString)", isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            } catch {
                completionHandler(nil)
                return
            }
            let destination = directory.appendingPathComponent((name as NSString).lastPathComponent)
            downloadDestinations[ObjectIdentifier(download)] = destination
            completionHandler(destination)
        }

        func downloadDidFinish(_ download: WKDownload) {
            guard let file = downloadDestinations.removeValue(forKey: ObjectIdentifier(download)) else { return }
            presentShareSheet(for: file)
        }

        func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
            downloadDestinations.removeValue(forKey: ObjectIdentifier(download))
            presentMessage("ファイルを書き出せませんでした", detail: error.localizedDescription)
        }

        private func presentShareSheet(for file: URL) {
            guard let presenter = topViewController() else { return }
            let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            if let popover = sheet.popoverPresentationController, let view = hostWebView {
                popover.sourceView = view
                popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.midY, width: 1, height: 1)
                popover.permittedArrowDirections = []
            }
            presenter.present(sheet, animated: true)
        }

        // MARK: window.open / JavaScript dialogs

        func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for navigationAction: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = navigationAction.request.url,
               let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
                UIApplication.shared.open(url)
            }
            // No second window: replacing the game page would lose the session.
            return nil
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            hostWebView = webView
            guard let presenter = topViewController() else {
                completionHandler()
                return
            }
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            presenter.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                     initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
            hostWebView = webView
            guard let presenter = topViewController() else {
                // Never treat an undisplayable confirmation as consent.
                completionHandler(false)
                return
            }
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "キャンセル", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            presenter.present(alert, animated: true)
        }

        func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                     defaultText: String?, initiatedByFrame frame: WKFrameInfo,
                     completionHandler: @escaping (String?) -> Void) {
            hostWebView = webView
            guard let presenter = topViewController() else {
                completionHandler(nil)
                return
            }
            let alert = UIAlertController(title: nil, message: prompt, preferredStyle: .alert)
            alert.addTextField { $0.text = defaultText }
            alert.addAction(UIAlertAction(title: "キャンセル", style: .cancel) { _ in completionHandler(nil) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in
                completionHandler(alert?.textFields?.first?.text ?? "")
            })
            presenter.present(alert, animated: true)
        }

        // MARK: Presentation helpers

        private func presentMessage(_ title: String, detail: String) {
            guard let presenter = topViewController() else { return }
            let alert = UIAlertController(title: title, message: detail, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            presenter.present(alert, animated: true)
        }

        private func topViewController() -> UIViewController? {
            var controller = hostWebView?.window?.rootViewController
            if controller == nil {
                controller = UIApplication.shared.connectedScenes
                    .compactMap { $0 as? UIWindowScene }
                    .flatMap { $0.windows }
                    .first { $0.isKeyWindow }?
                    .rootViewController
            }
            while let presented = controller?.presentedViewController {
                controller = presented
            }
            return controller
        }
    }
}
