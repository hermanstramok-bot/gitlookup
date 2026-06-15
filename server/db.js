import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, 'data', 'db.sqlite');

let db = null;

async function initDB() {
  const SQL = await initSqlJs();
  
  let data;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  } else {
    data = null;
  }
  
  db = new SQL.Database(data);
  
  // Создаём таблицы если не существуют
  db.run(`
    CREATE TABLE IF NOT EXISTS texts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      type TEXT CHECK(type IN ('video', 'text')),
      youtube_url TEXT,
      raw_content TEXT,
      icon TEXT DEFAULT '/icons/default.png',
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subtitles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text_id INTEGER NOT NULL,
      start_ms INTEGER,
      end_ms INTEGER,
      line_text TEXT,
      line_index INTEGER,
      FOREIGN KEY(text_id) REFERENCES texts(id)
    );

    CREATE TABLE IF NOT EXISTS vocab (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      word TEXT NOT NULL,
      translation TEXT,
      example_sentence TEXT,
      status TEXT CHECK(status IN ('new', 'learning', 'known')) DEFAULT 'new',
      source_text_id INTEGER,
      source_subtitle_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_text_id) REFERENCES texts(id),
      FOREIGN KEY(source_subtitle_id) REFERENCES subtitles(id)
    );
  `);
  
  // Миграция: добавляем колонку icon, если её ещё нет (для старых БД)
  try {
    db.run(`ALTER TABLE texts ADD COLUMN icon TEXT DEFAULT '/icons/default.png'`);
    console.log('✓ Добавлена колонка icon в таблицу texts');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn('Migration warning (icon):', e.message);
    }
  }
  
  // Миграция: добавляем колонку imported_at, если её ещё нет (для старых БД)
  try {
    db.run(`ALTER TABLE texts ADD COLUMN imported_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    console.log('✓ Добавлена колонка imported_at в таблицу texts');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn('Migration warning (imported_at):', e.message);
    }
  }
  
  // Миграция: добавляем колонку updated_at в таблицу vocab, если её ещё нет
  try {
    db.run(`ALTER TABLE vocab ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
    console.log('✓ Добавлена колонка updated_at в таблицу vocab');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      console.warn('Migration warning (updated_at):', e.message);
    }
  }
  
  saveDB();
  return db;
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
  }
}

function getDB() {
  return db;
}

export { initDB, saveDB, getDB };