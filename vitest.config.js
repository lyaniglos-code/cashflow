import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Use forks so the native better-sqlite3 addon loads cleanly (some modules
    // transitively open the DB on import).
    pool: 'forks',
    // Modules that transitively import db.js open a throwaway in-memory DB —
    // tests never touch the real dev database.
    env: { DATABASE_PATH: ':memory:' },
    include: ['server/test/**/*.test.js'],
  },
});
