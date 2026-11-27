import QRCode from "qrcode";

/** Real, scannable QR as an inline SVG string (server-side). */
export async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1F2428", light: "#FFFFFF" } });
}
