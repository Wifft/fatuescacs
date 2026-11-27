// SQLite via Node's built-in `node:sqlite` (no dependency). Server-only module.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { MIGRATIONS } from "./migrations";

export type Db = DatabaseSync;

/** Opens a database and applies pending migrations (tracked with PRAGMA user_version). */
export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
  migrate(db);
  return db;
}

export function migrate(db: Db): void {
  const row = db.prepare("PRAGMA user_version").get() as { user_version: number };
  for (let v = row.user_version; v < MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(MIGRATIONS[v] as string);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
}

let instance: Db | null = null;

/** Process-wide database. Path from DB_PATH, default ./data/fatuescacs.db. */
export function getDb(): Db {
  if (!instance) {
    // The DB file lives outside the build: tell Turbopack not to trace it.
    instance = openDb(
      resolve(/*turbopackIgnore: true*/ process.env.DB_PATH ?? "data/fatuescacs.db"),
    );
  }
  return instance;
}
