import { ImageResponse } from "next/og";

// Rendered to PNG rather than shipped as icon.svg — Safari doesn't support
// SVG favicons and falls back to its generic globe.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 56,
      }}
    >
      🏈
    </div>,
    size,
  );
}
