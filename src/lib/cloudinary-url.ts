// Trust gate for customer-supplied intake photo URLs (SOP v4.2 §4).
//
// The public upload action (uploadIntakePhoto) is not a hard gate — a crafted
// request can POST arbitrary `photoUrls` straight to submitBooking / submitQuote.
// Those URLs are later rendered in <img src> (and opened via <a>) by admins and
// providers, so we must only persist URLs that are genuinely our own uploads:
// the shared res.cloudinary.com host is multi-tenant, so we bind to OUR cloud
// name, the /image/upload/ delivery type (rejecting /fetch/ proxies), and the
// dedicated `fixaro/intake` folder. Pure — no SDK import.

const INTAKE_FOLDER = "fixaro/intake";

export function isTrustedIntakePhotoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "res.cloudinary.com") return false;

    // Path shape: /<cloud>/image/upload/v<n>/fixaro/intake/<publicId>.<ext>
    const parts = u.pathname.split("/").filter(Boolean);
    const cloud = process.env.CLOUDINARY_CLOUD_NAME;
    if (cloud && parts[0] !== cloud) return false; // bind to our account
    if (parts[1] !== "image" || parts[2] !== "upload") return false; // not /fetch/, etc.

    return u.pathname.includes(`/${INTAKE_FOLDER}/`);
  } catch {
    return false;
  }
}
