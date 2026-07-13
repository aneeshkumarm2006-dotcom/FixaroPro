import { getRuntimeConfig } from "@/lib/config/service-config";
import { ServiceConfigProvider } from "@/lib/config/ServiceConfigProvider";

export const metadata = {
  title: "Book a service — Fixaro",
  description: "Book a professional handyman service in just a few clicks.",
};

/**
 * MUST be dynamic. This layout reads the service catalog from the DB, and
 * /book is otherwise statically prerenderable — Next would run this once at
 * BUILD time and freeze that catalog into the HTML, so an admin repricing a
 * service would never reach the booking page until the next deploy. That is the
 * exact failure Stage 8 exists to remove, so the prices must be resolved per
 * request.
 */
export const dynamic = "force-dynamic";

// The booking wizard is entirely client-side, so it cannot query the catalog
// itself. Loading the config here and handing it down means the services, prices,
// materials lines and painting ranges the customer sees are the admin-editable
// ones — not a TypeScript constant baked in at build time (SOP §3, stage 8).
export default async function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const config = await getRuntimeConfig();

  return (
    <ServiceConfigProvider config={config}>{children}</ServiceConfigProvider>
  );
}
