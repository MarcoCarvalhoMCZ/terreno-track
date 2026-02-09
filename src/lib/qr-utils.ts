import QRCode from "qrcode";

/**
 * Generates a QR code as a data URL (PNG base64) programmatically,
 * without depending on any DOM element.
 * This ensures 100% reliable QR code generation for PDF exports.
 */
export async function generateQrDataUrl(
  payload: string,
  size: number = 200
): Promise<string> {
  return QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
    errorCorrectionLevel: "M",
  });
}
