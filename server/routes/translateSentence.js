import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { sentence } = req.body;
    if (!sentence || typeof sentence !== 'string' || sentence.trim().length === 0) {
      return res.status(400).json({ error: 'No valid sentence provided' });
    }

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=ru&dt=t&q=${encodeURIComponent(sentence)}`;
    const response = await fetch(url);
    const data = await response.json();

    // Формат ответа Google: [[["translated text","original",...]]]
    let translated = '';
    if (data && data[0] && data[0][0] && data[0][0][0]) {
      translated = data[0][0][0];
    } else {
      translated = 'Translation failed';
    }

    res.json({
      original: sentence,
      translated: translated,
      detectedSourceLang: 'de'
    });
  } catch (error) {
    console.error('Google Translate error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

export default router;