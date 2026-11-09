// swift-tools-version: 5.8

// 資本主義ポケット TYCOON — iOS shell (Swift Playgrounds App).
//
// This package is assembled by `node scripts/build-ios-swiftpm.js`, which copies
// these sources next to a `web/` snapshot of the browser game. Do not hand-copy
// game files into `web/`; rebuild the package instead so the snapshot stays
// consistent with one commit.

import PackageDescription
import AppleProductTypes

let package = Package(
    name: "CapitalismPocketTycoon",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "資本主義ポケット TYCOON",
            targets: ["AppModule"],
            // Placeholder. Set the real identifier and team in Swift Playgrounds'
            // App Settings before uploading to App Store Connect.
            bundleIdentifier: "com.example.capitalism-pocket-tycoon",
            teamIdentifier: "",
            displayVersion: "1.0",
            bundleVersion: "1",
            appIcon: .placeholder(icon: .gamePad),
            accentColor: .presetColor(.purple),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ]
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: ".",
            resources: [
                // `.copy` keeps the directory tree (js/, css/, assets/, prototypes/)
                // exactly as the game's relative URLs expect it.
                .copy("web")
            ]
        )
    ]
)
