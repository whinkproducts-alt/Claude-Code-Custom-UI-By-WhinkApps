// Composes the launcher icon: the Whink logo as a rounded app icon with the Claude icon as a badge in the corner.
// Uses only what macOS ships (osascript + AppKit).   osascript -l JavaScript tools/make-icon.js <whink.png> <claude.png|-> <out.png>
ObjC.import('AppKit');
function run(argv) {
  const [whinkPath, claudePath, outPath] = argv;
  const S = 1024;
  const img = (p) => $.NSImage.alloc.initWithContentsOfFile($(p));
  const whink = img(whinkPath);
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(
    $(), S, S, 8, 4, true, false, $.NSDeviceRGBColorSpace, 0, 0);
  $.NSGraphicsContext.saveGraphicsState;
  $.NSGraphicsContext.setCurrentContext($.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep));

  // Black app-icon shape, then the Whink logo inset inside it so the rounded corners stay clean.
  $.NSColor.blackColor.set;
  $.NSBezierPath.bezierPathWithRoundedRectXRadiusYRadius($.NSMakeRect(0, 0, S, S), 228, 228).fill;
  const w = S * 0.86;
  whink.drawInRectFromRectOperationFraction($.NSMakeRect((S - w) / 2, S * 0.10, w, w), $.NSZeroRect, $.NSCompositingOperationSourceOver, 1.0);

  // Claude badge, bottom-right, with a soft shadow so it reads on the dark logo.
  if (claudePath !== '-') {
    const claude = img(claudePath), b = S * 0.32, x = S * 0.62, y = S * 0.035;
    const shadow = $.NSShadow.alloc.init;
    shadow.setShadowColor($.NSColor.colorWithCalibratedWhiteAlpha(0, 0.55));
    shadow.setShadowBlurRadius(26); shadow.setShadowOffset($.NSMakeSize(0, -10));
    $.NSGraphicsContext.saveGraphicsState;
    shadow.set;
    claude.drawInRectFromRectOperationFraction($.NSMakeRect(x, y, b, b), $.NSZeroRect, $.NSCompositingOperationSourceOver, 1.0);
    $.NSGraphicsContext.restoreGraphicsState;
  }
  $.NSGraphicsContext.restoreGraphicsState;

  const png = rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $());
  png.writeToFileAtomically($(outPath), true);
  return outPath;
}
