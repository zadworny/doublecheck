/**
 * QR generation for verifier links.
 *
 * A recruiter shows a code on a call or drops it into a DM; the person they are
 * talking to scans it and lands on the verifier page. It is the shortest path
 * from "someone claims X" to "the registry says X", and it works with the
 * camera app every phone already has.
 *
 * Rendered as SVG rather than canvas so it stays sharp when printed on a badge,
 * a conference lanyard or a slide, and so it can be downloaded as a file
 * without a rasterisation step.
 */

import qrcode from "qrcode-generator";

export interface QrSvgOptions {
  /** Quiet-zone width in modules. The spec requires at least 4. */
  margin?: number;
  /** Foreground colour. Defaults to `currentColor` so it follows the theme. */
  color?: string;
}

/**
 * Returns the QR for `text` as an SVG string.
 *
 * Error correction is fixed at level M (~15% recoverable). Verifier URLs are
 * short, so the extra redundancy costs little, and codes get photographed off
 * screens at an angle far more often than they get scanned in ideal conditions.
 */
export function qrSvg(text: string, { margin = 4, color = "currentColor" }: QrSvgOptions = {}): string {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const size = count + margin * 2;

  // One path for every dark module. Emitting a single path rather than a rect
  // per module keeps the markup small enough to inline comfortably.
  let path = "";
  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (qr.isDark(row, col)) {
        path += `M${col + margin} ${row + margin}h1v1h-1z`;
      }
    }
  }

  // `width`/`height` are required, not cosmetic: an SVG with only a viewBox
  // falls back to the CSS default replaced-element size (300×150) and renders
  // clipped and stretched inside a square container.
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"`,
    ` width="100%" height="100%" shape-rendering="crispEdges"`,
    ` role="img" aria-label="QR code linking to this verification page">`,
    `<path fill="${color}" d="${path}"/>`,
    `</svg>`,
  ].join("");
}

/** The same SVG as a data URI, for `<img>` or a download link. */
export function qrDataUri(text: string, options?: QrSvgOptions): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(qrSvg(text, options))}`;
}
