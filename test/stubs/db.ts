// Test stub for `@/db` (aliased in vitest.config.ts).
//
// The money-math modules under test import src/db transitively, which
// instantiates a real PrismaClient at module load. These are PURE unit tests —
// every function under test takes a resolved config/job object as an argument
// and never queries — so we replace the client with a Proxy that throws the
// moment any query method is reached. That keeps the tests hermetic AND turns an
// accidental database access inside a "pure" function into a loud failure rather
// than a silent undefined.

export const db: unknown = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(
        `Unit tests must not touch the database — a function under test reached for db.${String(
          prop
        )}. Pass a resolved config/job object instead of calling getRuntimeConfig().`
      );
    },
  }
);
