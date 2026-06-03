import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

// Generates the PWA install icons at 192 and 512 (and a 32 favicon).
export function generateImageMetadata() {
  return [
    { id: "32", size: { width: 32, height: 32 }, contentType: "image/png" },
    { id: "192", size: { width: 192, height: 192 }, contentType: "image/png" },
    { id: "512", size: { width: 512, height: 512 }, contentType: "image/png" },
  ];
}

export const contentType = "image/png";

export default function Icon({ id }: { id: string }) {
  const size = id === "512" ? 512 : id === "192" ? 192 : 32;
  const radius = Math.round(size * 0.22);

  const logoData = readFileSync(join(process.cwd(), "public/images/Fixaro-Logo.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: radius,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoBase64}
          width={Math.round(size * 0.8)}
          height={Math.round(size * 0.8)}
          style={{ objectFit: "contain" }}
          alt="Fixaro"
        />
      </div>
    ),
    { width: size, height: size }
  );
}
