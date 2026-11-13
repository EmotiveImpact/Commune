import qrcode from "qrcode-generator";

/**
 * The QR code for some text as rows of dark (true) and light (false)
 * modules. Version is picked to fit (type 0) with medium error correction,
 * so a slightly scuffed or dim screen still scans.
 */
export function qrMatrix(text: string): boolean[][] {
  const code = qrcode(0, "M");
  code.addData(text, "Byte");
  code.make();
  const size = code.getModuleCount();
  return Array.from({ length: size }, (_, row) => Array.from({ length: size }, (_, col) => code.isDark(row, col)));
}

/** One SVG path for every dark module, in module units, so it draws crisp at any size. */
export function qrPath(matrix: boolean[][]): string {
  let d = "";
  matrix.forEach((row, y) => row.forEach((dark, x) => { if (dark) d += `M${x} ${y}h1v1h-1z`; }));
  return d;
}
