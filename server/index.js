const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const prisma = require('./prismaClient'); // единый экземпляр

const authRouter = require('./routes/auth');
const vocabRouter = require('./routes/vocab');
const textsRouter = require('./routes/texts');
const foldersRouter = require('./routes/folders');
const importRouter = require('./routes/import');
const materialsRouter = require('./routes/materials');
const reviewRouter = require('./routes/review');
const translateRouter = require('./routes/translateSentence');
const flashcardsRouter = require('./routes/flashcards');
const gamesRouter = require('./routes/games');
const settingsRouter = require('./routes/settings'); // ← ДОБАВЛЕНО: настройки пользователя (targetLang, subtitleLines)

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer для иконок (без изменений)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'client', 'public', 'icons');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'custom-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

app.post('/api/upload-icon', upload.single('icon'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ icon: `/icons/${req.file.filename}` });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Подключаем роуты ──────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api', vocabRouter);
app.use('/api', textsRouter);
app.use('/api', foldersRouter);
app.use('/api', importRouter);
app.use('/api', materialsRouter);
app.use('/api', reviewRouter);
app.use('/api', translateRouter);
app.use('/api', settingsRouter); // ← ДОБАВЛЕНО: даёт /api/user/settings (GET, PATCH)

// ─── Новые роуты для флешкарт и игр ───────────────────────
app.use('/api/flashcards', flashcardsRouter);
app.use('/api/games', gamesRouter);

// ─── Офлайн-словарь (оставляем как есть) ──────────────────
let dictionary = {};
try {
  const dictPath = path.join(__dirname, 'data', 'de_rus_dict.json');
  if (fs.existsSync(dictPath)) {
    const raw = fs.readFileSync(dictPath, 'utf-8');
    const json = JSON.parse(raw);
    if (json.entries && Array.isArray(json.entries)) {
      for (const entry of json.entries) {
        if (entry.word && entry.translations) {
          dictionary[entry.word.toLowerCase().trim()] = entry.translations;
        }
      }
    } else if (typeof json === 'object' && !json.entries) {
      dictionary = json;
    }
    console.log(`📖 Dictionary loaded: ${Object.keys(dictionary).length} entries`);
  } else {
    console.warn('⚠️ de_rus_dict.json not found');
  }
} catch (err) {
  console.error('Failed to load dictionary:', err.message);
}

app.post('/api/dictionary-lookup', (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ error: 'Missing word' });
  const cleanWord = word.toLowerCase().trim();
  const translations = dictionary[cleanWord] || [];
  res.json({ word: cleanWord, translations });
});

// ─── spaCy анализ ──────────────────────────────────────────
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});