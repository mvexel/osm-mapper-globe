import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, "../../data/thank-a-mapper.db");

// make the data dir if it does not exist (sync or we may die)
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// get the database
export const db = new Database(dbPath);

// write ahead logging - we probably don't need
db.pragma("journal_mode = WAL");

// init the table
db.exec(`
CREATE TABLE IF NOT EXISTS changesets (
    id INTEGER PRIMARY KEY,
    user TEXT,
    location TEXT,
    summary TEXT,
    hearts INTEGER NOT NULL DEFAULT 0,
    processedAt INTEGER,
    lat REAL,
    lon REAL
);
CREATE INDEX IF NOT EXISTS idx_changesets_processedAt ON changesets(processedAt);
`);
