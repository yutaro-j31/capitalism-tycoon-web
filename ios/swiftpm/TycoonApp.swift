import SwiftUI

@main
struct TycoonApp: App {
    var body: some Scene {
        WindowGroup {
            ZStack {
                // Matches the game's theme-color so no white flash shows before
                // the first paint or behind the safe areas.
                Color(red: 8 / 255, green: 16 / 255, blue: 31 / 255)
                    .ignoresSafeArea()
                // The page declares viewport-fit=cover and pads itself with
                // env(safe-area-inset-*), so the web view takes the full screen.
                GameWebView()
                    .ignoresSafeArea()
            }
            .preferredColorScheme(.dark)
        }
    }
}
