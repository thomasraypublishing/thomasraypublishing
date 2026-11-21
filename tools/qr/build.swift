// tools/qr/build.swift — writes the static "scan with your iPhone" QR codes
// (ticket W20) shown beside the final App Store link on the three shipping
// app pages at desktop widths, then reads each one back to prove it decodes.
//
// Each code encodes that product's canonicalUrl from
// tools/tests/products.json, byte for byte: no campaign or tracking
// parameters. Encoding is Apple's own (Core Image); nothing is downloaded
// and the site gains no dependency. tools/qr/manifest.json records the URL
// and SHA-256 of every file written, and tools/tests/cta.test.js holds the
// committed files to that manifest and the manifest to products.json, so a
// changed store URL fails the build until the codes are rebuilt here.
//
// Dark modules on a light plate, always: phone cameras read inverted codes
// unreliably, so the two dark pages (The Device, Hush Hush Snap Snap) get a
// light card too. The 4-module quiet zone is part of the plate.
//
// Run from the repo root (macOS):   swift tools/qr/build.swift

import AppKit
import CoreImage
import CryptoKit
import Foundation
import Vision

struct Target { let file: String; let dark: String; let light: String }

// Where each code lives and its two colours: each page's own darkest ink on
// its own lightest paper.
let targets: [String: Target] = [
    "pomagotchi": Target(file: "pomagotchi/images/qr-app-store.svg", dark: "#241A2E", light: "#FFFFFF"),
    "the-device": Target(file: "thedevice/images/qr-app-store.svg", dark: "#140A26", light: "#F2EDF5"),
    "hush-hush-snap-snap": Target(file: "hush-hush-snap-snap/images/qr-app-store.svg", dark: "#000000", light: "#ECE9E2"),
]
let quiet = 4

struct Fail: Error, CustomStringConvertible { let description: String }

/// The symbol as rows of booleans (true = dark), without any quiet zone.
func modules(for url: String) throws -> [[Bool]] {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else { throw Fail(description: "no CIQRCodeGenerator") }
    filter.setValue(Data(url.utf8), forKey: "inputMessage")
    filter.setValue("M", forKey: "inputCorrectionLevel") // 15% error correction
    guard let image = filter.outputImage else { throw Fail(description: "no QR image for \(url)") }
    let width = Int(image.extent.width), height = Int(image.extent.height)
    var pixels = [UInt8](repeating: 0, count: width * height * 4)
    CIContext(options: [.workingColorSpace: NSNull()]).render(
        image, toBitmap: &pixels, rowBytes: width * 4,
        bounds: image.extent, format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
    var grid = (0..<height).map { y in (0..<width).map { x in pixels[(y * width + x) * 4] < 128 } }
    // Core Image pads the symbol with light modules; trim to the symbol itself.
    while let first = grid.first, !first.contains(true) { grid.removeFirst() }
    while let last = grid.last, !last.contains(true) { grid.removeLast() }
    let left = grid.map { $0.firstIndex(of: true) ?? $0.count }.min() ?? 0
    let right = grid.map { $0.lastIndex(of: true) ?? 0 }.max() ?? 0
    grid = grid.map { Array($0[left...right]) }
    guard grid.count == grid[0].count, (grid.count - 17) % 4 == 0 else {
        throw Fail(description: "unexpected symbol size \(grid[0].count)x\(grid.count)")
    }
    return grid
}

func svg(_ grid: [[Bool]], dark: String, light: String) -> String {
    let n = grid.count, size = n + quiet * 2
    var d = ""
    for y in 0..<n {
        var x = 0
        while x < n {
            guard grid[y][x] else { x += 1; continue }
            var run = 1
            while x + run < n, grid[y][x + run] { run += 1 }
            d += "M\(x + quiet) \(y + quiet)h\(run)v1h-\(run)z"
            x += run
        }
    }
    return "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 \(size) \(size)\" shape-rendering=\"crispEdges\">"
        + "<rect width=\"\(size)\" height=\"\(size)\" rx=\"2.5\" fill=\"\(light)\"/>"
        + "<path fill=\"\(dark)\" d=\"\(d)\"/></svg>\n"
}

/// Renders the written SVG the way a browser would and reads it with Vision.
func decode(svgAt url: URL) throws -> String {
    guard let image = NSImage(contentsOf: url) else { throw Fail(description: "cannot load \(url.path)") }
    let side = 660
    guard let rep = NSBitmapImageRep(
        bitmapDataPlanes: nil, pixelsWide: side, pixelsHigh: side, bitsPerSample: 8, samplesPerPixel: 4,
        hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)
    else { throw Fail(description: "no bitmap") }
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current?.imageInterpolation = .none
    image.draw(in: NSRect(x: 0, y: 0, width: side, height: side))
    NSGraphicsContext.restoreGraphicsState()
    guard let cg = rep.cgImage else { throw Fail(description: "no CGImage") }
    let request = VNDetectBarcodesRequest()
    request.symbologies = [.qr]
    try VNImageRequestHandler(cgImage: cg).perform([request])
    guard let payload = request.results?.first?.payloadStringValue else {
        throw Fail(description: "Vision found no QR code in \(url.lastPathComponent)")
    }
    return payload
}

do {
    let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
    let productsURL = root.appendingPathComponent("tools/tests/products.json")
    guard
        let json = try JSONSerialization.jsonObject(with: Data(contentsOf: productsURL)) as? [String: Any],
        let products = json["products"] as? [[String: Any]]
    else { throw Fail(description: "cannot read tools/tests/products.json") }

    var manifest: [[String: String]] = []
    for product in products {
        guard let id = product["id"] as? String, let canonical = product["canonicalUrl"] as? String else {
            throw Fail(description: "product without id/canonicalUrl")
        }
        guard let target = targets[id] else { throw Fail(description: "no QR target for product \(id)") }
        let text = svg(try modules(for: canonical), dark: target.dark, light: target.light)
        let out = root.appendingPathComponent(target.file)
        try Data(text.utf8).write(to: out)
        let read = try decode(svgAt: out)
        guard read == canonical else { throw Fail(description: "\(target.file) decodes to \(read), expected \(canonical)") }
        let sha = SHA256.hash(data: Data(text.utf8)).map { String(format: "%02x", $0) }.joined()
        manifest.append(["id": id, "file": target.file, "url": canonical, "sha256": sha])
        print("\(target.file)  decodes to  \(read)")
    }
    let data = try JSONSerialization.data(withJSONObject: ["codes": manifest], options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
    try (data + Data("\n".utf8)).write(to: root.appendingPathComponent("tools/qr/manifest.json"))
} catch {
    FileHandle.standardError.write(Data("build.swift: \(error)\n".utf8))
    exit(1)
}
