import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import { qrMatrix, qrPath } from "../lib/qr";

const QUIET = 4;

/**
 * A QR code drawn as one crisp SVG path, always black on white with the
 * standard four-module quiet zone, whatever the app's theme, so any phone
 * camera reads it.
 */
export function QrCode({ value, size = 240, label }: { value: string; size?: number; label?: string }) {
  const { path, count } = useMemo(() => {
    const matrix = qrMatrix(value);
    return { path: qrPath(matrix), count: matrix.length };
  }, [value]);
  const box = count + QUIET * 2;
  // Whole pixels per module, so neighbouring squares never show a seam.
  const side = Math.max(1, Math.floor(size / box)) * box;
  return <View accessibilityRole="image" accessibilityLabel={label ?? "QR code"} style={{ width: size, height: size, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" }}>
    <Svg width={side} height={side} viewBox={`0 0 ${box} ${box}`}>
      <Rect x={0} y={0} width={box} height={box} fill="#fff" />
      <Path d={path} fill="#111" transform={`translate(${QUIET} ${QUIET})`} />
    </Svg>
  </View>;
}
