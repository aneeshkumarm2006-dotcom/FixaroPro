import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Money-math unit tests (SOP §12 QA — Stage 9.1). These exercise the PURE
// billing/pricing/painting/policy functions with no database and no network.
//
// The `@/db` alias points at a stub: the modules under test (e.g. billing.ts)
// transitively import src/db, which instantiates a real PrismaClient at module
// load. The functions we test never touch it — they take a resolved config
// object as an argument — so we swap the client for a Proxy that throws if any
// test accidentally reaches for the database. Everything else resolves `@/` to
// src/ exactly as the app's tsconfig `paths` does.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/db$/,
        replacement: fileURLToPath(new URL("./test/stubs/db.ts", import.meta.url)),
      },
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL("./src/", import.meta.url)),
      },
    ],
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    // Fail loudly on an unhandled console.error from a module under test.
    clearMocks: true,
  },
});
