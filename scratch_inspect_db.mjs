import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'server/db/sureplug.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(orders)", (err, rows) => {
  if (err) {
    console.error('Error running pragma:', err);
  } else {
    console.log('Orders Columns:');
    rows.forEach(r => console.log(`- ${r.name} (${r.type})`));
  }
  db.close();
});
