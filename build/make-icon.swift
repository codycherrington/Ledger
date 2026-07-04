// Converts the artwork in icon.png (project root) into the macOS app icon.
// Finds the squircle in the source image (which sits on a white background),
// crops it, re-masks it with transparent corners, and lays it out on the
// standard macOS icon grid. Run from the project root:
//   swift build/make-icon.swift && iconutil -c icns build/icon.iconset -o build/icon.icns
import AppKit

let sourcePath = "icon.png"

guard let src = NSImage(contentsOfFile: sourcePath),
      let tiff = src.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff)
else { fatalError("could not load \(sourcePath)") }

let w = rep.pixelsWide
let h = rep.pixelsHigh

// Bounding box of the artwork: anything clearly darker than the white
// background. A generous threshold ignores faint background noise/shadow.
var minX = w, minY = h, maxX = -1, maxY = -1
for y in 0..<h {
  for x in 0..<w {
    guard let c = rep.colorAt(x: x, y: y) else { continue }
    let brightness = (c.redComponent + c.greenComponent + c.blueComponent) / 3
    if brightness < 0.75 {
      if x < minX { minX = x }
      if x > maxX { maxX = x }
      if y < minY { minY = y }
      if y > maxY { maxY = y }
    }
  }
}
guard maxX >= 0 else { fatalError("no artwork found in \(sourcePath)") }

// Square the crop box around its center.
let boxW = maxX - minX + 1
let boxH = maxY - minY + 1
let side = max(boxW, boxH)
let cx = Double(minX) + Double(boxW) / 2
let cy = Double(minY) + Double(boxH) / 2
// colorAt uses top-left origin; drawing uses bottom-left — flip Y.
let cropRect = NSRect(
  x: cx - Double(side) / 2,
  y: Double(h) - (cy + Double(side) / 2),
  width: Double(side), height: Double(side))

let srcImage = NSImage(size: NSSize(width: w, height: h))
srcImage.addRepresentation(rep)

func renderIcon(canvas: CGFloat) -> NSImage {
  let image = NSImage(size: NSSize(width: canvas, height: canvas))
  image.lockFocus()

  // Standard macOS icon grid: plate is ~80% of the canvas.
  let plateSide = canvas * 0.805
  let inset = (canvas - plateSide) / 2
  // Shave a couple of edge pixels (relative to the 1024 master) so the
  // white-blended anti-aliased rim of the source doesn't show, and use a
  // slightly generous corner radius so the clip stays inside the artwork.
  let shave = max(canvas * 0.004, 0.5)
  let plateRect = NSRect(
    x: inset + shave, y: inset + shave,
    width: plateSide - 2 * shave, height: plateSide - 2 * shave)
  let radius = plateRect.width * 0.26
  let plate = NSBezierPath(roundedRect: plateRect, xRadius: radius, yRadius: radius)

  // Soft shadow, then the artwork clipped to the squircle.
  NSGraphicsContext.current?.saveGraphicsState()
  let shadow = NSShadow()
  shadow.shadowColor = NSColor.black.withAlphaComponent(0.30)
  shadow.shadowBlurRadius = canvas * 0.018
  shadow.shadowOffset = NSSize(width: 0, height: -canvas * 0.009)
  shadow.set()
  NSColor(calibratedRed: 0.08, green: 0.10, blue: 0.16, alpha: 1).setFill()
  plate.fill()
  NSGraphicsContext.current?.restoreGraphicsState()

  NSGraphicsContext.current?.saveGraphicsState()
  plate.addClip()
  srcImage.draw(in: plateRect.insetBy(dx: -shave, dy: -shave), from: cropRect, operation: .sourceOver, fraction: 1.0)
  NSGraphicsContext.current?.restoreGraphicsState()

  image.unlockFocus()
  return image
}

func writePNG(_ image: NSImage, pixels: Int, to url: URL) {
  guard let out = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .calibratedRGB,
    bytesPerRow: 0, bitsPerPixel: 0)
  else { fatalError("could not create bitmap rep") }
  out.size = NSSize(width: pixels, height: pixels)
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: out)
  image.draw(
    in: NSRect(x: 0, y: 0, width: pixels, height: pixels), from: .zero, operation: .copy,
    fraction: 1.0)
  NSGraphicsContext.restoreGraphicsState()
  guard let data = out.representation(using: .png, properties: [:]) else {
    fatalError("could not encode png")
  }
  try! data.write(to: url)
}

let iconsetURL = URL(fileURLWithPath: "build/icon.iconset")
try? FileManager.default.removeItem(at: iconsetURL)
try! FileManager.default.createDirectory(at: iconsetURL, withIntermediateDirectories: true)

let entries: [(String, Int)] = [
  ("icon_16x16.png", 16), ("icon_16x16@2x.png", 32),
  ("icon_32x32.png", 32), ("icon_32x32@2x.png", 64),
  ("icon_128x128.png", 128), ("icon_128x128@2x.png", 256),
  ("icon_256x256.png", 256), ("icon_256x256@2x.png", 512),
  ("icon_512x512.png", 512), ("icon_512x512@2x.png", 1024),
]

for (name, pixels) in entries {
  writePNG(renderIcon(canvas: CGFloat(pixels)), pixels: pixels, to: iconsetURL.appendingPathComponent(name))
}
print("iconset written from \(sourcePath)")
