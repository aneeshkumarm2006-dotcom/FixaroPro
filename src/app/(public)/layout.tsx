// Deliberately does NOT load the runtime config. Most pages in this group are
// static marketing pages (/faq, /reviews, …) and should stay statically
// prerendered; a DB read here would either force the whole group dynamic or —
// worse — be executed once at BUILD time and freeze a stale catalog into them.
// Only /quote needs the catalog, so it mounts the provider itself and opts into
// per-request rendering.
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      {/* Public Header */}
      <header className="border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-white overflow-hidden shadow-sm flex items-center justify-center" style={{ border: "1px solid rgba(0,0,0,0.06)" }}>
              <img src="/images/Fixaro-Logo.png" alt="Fixaro" width={36} height={36} style={{ objectFit: "contain" }} />
            </div>
            <span className="text-lg font-[600] text-[#161514]" style={{ letterSpacing: "-0.01em" }}>Fixaro</span>
          </div>
        </div>
      </header>

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-5xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-gray-400">
            &copy; {new Date().getFullYear()} Fixaro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
