import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET(_request, { params }) {
  const { size: rawSize } = await params;
  const size = rawSize === "192" ? 192 : 512;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090d17",
          borderRadius: size * 0.23,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: size * 0.035 }}>
          {[0.32, 0.66, 1, 0.76, 0.52, 0.28].map((height, index) => (
            <div
              key={index}
              style={{
                width: size * 0.065,
                height: size * height * 0.52,
                borderRadius: size * 0.04,
                background: index < 2 ? "#32d7ff" : index < 4 ? "#596dff" : "#b04cff",
                boxShadow: "0 0 28px rgba(89,109,255,.22)",
              }}
            />
          ))}
        </div>
      </div>
    ),
    { width: size, height: size }
  );
}
