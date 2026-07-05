const router = require('express').Router();
const fetch = require('node-fetch'); // <-- добавлено

// ─── Одиночный перевод ──────────────────────────────────────────────────────
router.post('/translate-sentence', async (req, res) => {
  const { sentence, sentences } = req.body;

  // Батч-перевод
  if (sentences && Array.isArray(sentences)) {
    try {
      const translations = await Promise.all(
        sentences.map(async (text) => {
          const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=ru&dt=t&q=${encodeURIComponent(text)}`
          );
          const data = await response.json();
          return data[0]?.[0]?.[0] || '';
        })
      );
      return res.json({ translations });
    } catch (err) {
      console.error('Batch translation error:', err);
      return res.status(500).json({ error: err.message });
    }
  }

  // Одиночный запрос
  if (!sentence) {
    return res.status(400).json({ error: 'Missing sentence parameter' });
  }

  try {
    const response = await fetch(
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=de&tl=ru&dt=t&q=${encodeURIComponent(sentence)}`
    );
    const data = await response.json();
    const translated = data[0]?.[0]?.[0] || '';
    res.json({ translation: translated }); // единое поле translation
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;