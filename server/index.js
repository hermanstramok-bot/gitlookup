import express from 'express';
import { initDB, getDB, saveDB } from './db.js';
import { setupImportRoutes } from './routes/import.js';
import { setupVocabRoutes } from './routes/vocab.js';
import translateSentenceRouter from './routes/translateSentence.js';
import { setupTextsRoutes } from './routes/texts.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 5000;

// ===============================================
// ЗАГРУЗКА ОФЛАЙН-СЛОВАРЯ (de_rus_dict.json)
// ===============================================
let dictionary = {};
try {
  const dictPath = path.join(__dirname, 'data', 'de_rus_dict.json');
  if (fs.existsSync(dictPath)) {
    const raw = fs.readFileSync(dictPath, 'utf-8');
    const json = JSON.parse(raw);
    if (json.entries && Array.isArray(json.entries)) {
      for (const entry of json.entries) {
        if (entry.word && entry.translations) {
          const word = entry.word.toLowerCase().trim();
          dictionary[word] = entry.translations;
        }
      }
      console.log(`📖 Dictionary loaded: ${Object.keys(dictionary).length} entries`);
    } else if (typeof json === 'object' && !json.entries) {
      dictionary = json;
      console.log(`📖 Dictionary loaded: ${Object.keys(dictionary).length} entries`);
    } else {
      console.warn('⚠️ JSON structure not recognised – missing "entries" array or wrong format.');
    }
  } else {
    console.warn('⚠️ de_rus_dict.json not found in server/data/. Dictionary will be empty.');
  }
} catch (err) {
  console.error('Failed to load dictionary:', err.message);
}

// Настройка multer для загрузки иконок
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'public', 'icons');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'custom-' + uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

app.use(express.json());
app.use('/api/translate-sentence', translateSentenceRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

console.log('🔧 Registering import routes...');
setupImportRoutes(app);
console.log('🔧 Registering vocab routes...');
setupVocabRoutes(app);
console.log('🔧 Registering texts routes...');
setupTextsRoutes(app);

// ===== ЗАГРУЗКА КАСТОМНОЙ ИКОНКИ =====
app.post('/api/upload-icon', upload.single('icon'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    const iconUrl = `/icons/${req.file.filename}`;
    res.json({ success: true, iconUrl: iconUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload icon' });
  }
});

// ===== ОБНОВЛЕНИЕ МАТЕРИАЛА (PUT) =====
app.put('/api/materials/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;
  const { title, icon } = req.body;
  if (!title || !icon) {
    return res.status(400).json({ error: 'Title and icon are required' });
  }
  try {
    const stmt = db.prepare('UPDATE texts SET title = ?, icon = ? WHERE id = ?');
    stmt.run([title, icon, id]);
    saveDB();
    res.json({ success: true });
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== УДАЛЕНИЕ МАТЕРИАЛА =====
app.delete('/api/materials/:id', (req, res) => {
  const db = getDB();
  const { id } = req.params;
  try {
    const deleteSubtitles = db.prepare('DELETE FROM subtitles WHERE text_id = ?');
    deleteSubtitles.run([id]);
    const deleteVocab = db.prepare('DELETE FROM vocab WHERE source_text_id = ?');
    deleteVocab.run([id]);
    const deleteMaterial = db.prepare('DELETE FROM texts WHERE id = ?');
    deleteMaterial.run([id]);
    saveDB();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ПОЛУЧИТЬ МАТЕРИАЛ ПО ID =====
app.get('/api/material/:id', (req, res) => {
  const db = getDB();
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const stmt = db.prepare('SELECT * FROM texts WHERE id = ?');
    stmt.bind([id]);
    let row = null;
    if (stmt.step()) {
      row = stmt.getAsObject();
    }
    stmt.reset();
    if (!row) return res.status(404).json({ error: 'Material not found' });
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ПОЛУЧИТЬ СУБТИТРЫ =====
app.get('/api/subtitles/:id', (req, res) => {
  const db = getDB();
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const stmt = db.prepare('SELECT * FROM subtitles WHERE text_id = ? ORDER BY start_ms');
    stmt.bind([id]);
    const rows = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      rows.push({
        id: row.id,
        text_id: row.text_id,
        start_ms: row.start_ms,
        end_ms: row.end_ms,
        line_text: row.line_text,
        line_index: row.line_index
      });
    }
    stmt.reset();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ВСЕ МАТЕРИАЛЫ =====
app.get('/api/materials', (req, res) => {
  const db = getDB();
  try {
    const stmt = db.prepare('SELECT * FROM texts ORDER BY id DESC');
    stmt.bind([]);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.reset();
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== ТРЕНАЖЁР =====
app.get('/api/vocab/trainer', (req, res) => {
  const db = getDB();
  const sourceTextId = req.query.source_text_id;

  let sql = 'SELECT word, translation FROM vocab';
  const params = [];

  if (sourceTextId && sourceTextId !== 'all') {
    sql += ' WHERE source_text_id = ?';
    params.push(parseInt(sourceTextId, 10));
  }

  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const words = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      words.push({ de: row.word, ru: row.translation });
    }
    stmt.reset();
    res.json({ words });
  } catch (err) {
    console.error('Trainer endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ПОИСК В ОФЛАЙН-СЛОВАРЕ =====
app.post('/api/dictionary-lookup', (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Missing word' });
  const cleanWord = word.toLowerCase().trim();
  const translations = dictionary[cleanWord] || [];
  res.json({ word: cleanWord, translations });
});

// ===== АНАЛИЗ НЕМЕЦКОГО ТЕКСТА =====
app.post('/api/analyze-german', async (req, res) => {
  try {
    const response = await fetch('http://127.0.0.1:8001/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('spaCy error:', err);
    res.status(500).json({ error: 'German analysis failed' });
  }
});

// ========== ПАПКИ ==========
app.get('/api/folders', (req, res) => {
  const db = getDB();
  try {
    const stmt = db.prepare('SELECT * FROM folders ORDER BY name ASC');
    stmt.bind([]);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.reset();
    res.json(rows);
  } catch (err) {
    console.error('Get folders error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Folder name is required' });
  }
  const db = getDB();
  try {
    const stmt = db.prepare('INSERT INTO folders (name) VALUES (?)');
    const info = stmt.run([name.trim()]);
    saveDB();
    const newFolder = { id: info.lastInsertRowid, name: name.trim(), created_at: new Date().toISOString() };
    res.status(201).json(newFolder);
  } catch (err) {
    console.error('Create folder error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/folders/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Folder name is required' });
  }
  const db = getDB();
  try {
    const stmt = db.prepare('UPDATE folders SET name = ? WHERE id = ?');
    const result = stmt.run([name.trim(), id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    saveDB();
    res.json({ id: parseInt(id), name: name.trim() });
  } catch (err) {
    console.error('Rename folder error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', (req, res) => {
  const { id } = req.params;
  const db = getDB();
  try {
    const updateMaterials = db.prepare('UPDATE texts SET folder_id = NULL WHERE folder_id = ?');
    updateMaterials.run([id]);
    const deleteFolder = db.prepare('DELETE FROM folders WHERE id = ?');
    const result = deleteFolder.run([id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    saveDB();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete folder error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/materials/:id/folder', (req, res) => {
  const { id } = req.params;
  const { folder_id } = req.body;
  const db = getDB();
  try {
    let stmt;
    if (folder_id === null || folder_id === undefined) {
      stmt = db.prepare('UPDATE texts SET folder_id = NULL WHERE id = ?');
      stmt.run([id]);
    } else {
      const checkFolder = db.prepare('SELECT id FROM folders WHERE id = ?');
      checkFolder.bind([folder_id]);
      let exists = false;
      if (checkFolder.step()) {
        exists = true;
      }
      checkFolder.reset();
      if (!exists) {
        return res.status(400).json({ error: 'Folder does not exist' });
      }
      stmt = db.prepare('UPDATE texts SET folder_id = ? WHERE id = ?');
      stmt.run([folder_id, id]);
    }
    saveDB();
    res.json({ success: true });
  } catch (err) {
    console.error('Move material error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ЗАПУСК =====
async function start() {
  try {
    console.log('🔧 Initializing database...');
    await initDB();
    console.log('✅ Database initialized');

    // Миграция: добавить колонку source_custom
    const db = getDB();
    try {
      const checkColumn = db.prepare("PRAGMA table_info(vocab)");
      let hasSourceCustom = false;
      while (checkColumn.step()) {
        const col = checkColumn.getAsObject();
        if (col.name === 'source_custom') hasSourceCustom = true;
      }
      checkColumn.reset();
      if (!hasSourceCustom) {
        db.prepare("ALTER TABLE vocab ADD COLUMN source_custom TEXT").run();
        console.log("✓ Added source_custom column to vocab");
        saveDB();
      }
    } catch (err) {
      console.error("Migration error:", err);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`✓ Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ FATAL ERROR during server startup:', err);
    process.exit(1);
  }
}

start();