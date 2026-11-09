import Foundation
import WebKit

/// Serves the bundled `web/` snapshot under a stable custom origin
/// (`tycoon://game`).
///
/// A custom scheme is used instead of `file://` for two reasons:
/// - `fetch()` (the map sprite manifest) and lazily injected scripts work the
///   same way they do on GitHub Pages;
/// - localStorage / IndexedDB are keyed to one fixed origin, so saves survive
///   app updates even though the bundle path on disk changes.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    static let scheme = "tycoon"
    static let host = "game"

    static var entryURL: URL {
        URL(string: "\(scheme)://\(host)/index.html")!
    }

    /// Root of the bundled game, or nil when the app was built without it.
    static let webRoot: URL? = {
        guard let root = Bundle.main.url(forResource: "web", withExtension: nil) else { return nil }
        let index = root.appendingPathComponent("index.html")
        guard FileManager.default.fileExists(atPath: index.path) else { return nil }
        return root.standardizedFileURL
    }()

    private static let mimeTypes: [String: String] = [
        "html": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8",
        "json": "application/json; charset=utf-8",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "webp": "image/webp",
        "svg": "image/svg+xml",
        "txt": "text/plain; charset=utf-8",
        "md": "text/plain; charset=utf-8"
    ]

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        guard let root = Self.webRoot, let file = Self.resolve(url, under: root),
              let data = try? Data(contentsOf: file) else {
            respond(to: urlSchemeTask, url: url, status: 404,
                    contentType: "text/plain; charset=utf-8", body: Data("Not found".utf8))
            return
        }
        let contentType = Self.mimeTypes[file.pathExtension.lowercased()] ?? "application/octet-stream"
        respond(to: urlSchemeTask, url: url, status: 200, contentType: contentType, body: data)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Responses are produced synchronously in `start`, so nothing is pending.
    }

    /// Maps a request URL to a file inside `root`. The query string (`?rev=…`
    /// asset stamps) is ignored, and anything that would escape `root` is refused.
    static func resolve(_ url: URL, under root: URL) -> URL? {
        var relative = url.path
        while relative.hasPrefix("/") { relative.removeFirst() }
        if relative.isEmpty { relative = "index.html" }
        let candidate = root.appendingPathComponent(relative).standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: candidate.path, isDirectory: &isDirectory),
              !isDirectory.boolValue else { return nil }
        return candidate
    }

    private func respond(to task: WKURLSchemeTask, url: URL, status: Int,
                         contentType: String, body: Data) {
        let headers = [
            "Content-Type": contentType,
            "Content-Length": String(body.count),
            // The bundle is immutable per app version; the web view may revalidate
            // freely but must never keep a previous version's file.
            "Cache-Control": "no-cache"
        ]
        guard let response = HTTPURLResponse(url: url, statusCode: status,
                                             httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}
