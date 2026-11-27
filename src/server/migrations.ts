// Schema migrations, applied in order. Never edit a released migration: append a new one.
export const MIGRATIONS: readonly string[] = [
  /* 1 */ `
  CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    recovery_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE INDEX sessions_user ON sessions(user_id);

  CREATE TABLE analyses (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pgn_hash TEXT NOT NULL,
    pgn TEXT NOT NULL,
    white TEXT,
    black TEXT,
    event TEXT,
    game_date TEXT,
    result TEXT,
    opening_eco TEXT,
    opening_name TEXT,
    depth INTEGER NOT NULL,
    book_plies INTEGER NOT NULL DEFAULT 0,
    accuracy_w REAL,
    accuracy_b REAL,
    counts TEXT NOT NULL,
    evals TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (user_id, pgn_hash)
  );
  CREATE INDEX analyses_user_updated ON analyses(user_id, updated_at DESC);
  `,
];
