import express from 'express';
import { initDB, getDB } from './db.js';

const app = express();
const PORT = 5000;

app.use(express.json());

// Временно храним субтитры в памяти
let tempSubtitles = [];

app.post('/api/import/youtube', (req, res) => {
  const { youtube_url, title, subtitles } = req.body;
  
  if (!subtitles) {
    return res.status(400).json({ error: 'No subtitles' });
  }
  
  tempSubtitles = subtitles;
  
  res.json({
    success: true,
    title: title,
    youtube_url: youtube_url,
    subtitle_count: subtitles.length
  });
});

app.get('/api/material/:id', (req, res) => {
  res.json({
    id: req.params.id,
    title: 'Test Video',
    youtube_url: 'https://www.youtube.com/watch?v=PUg-020Isng',
    type: 'video'
  });
});

app.get('/api/subtitles/:id', (req, res) => {
  res.json(tempSubtitles);
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
  });
}

start();