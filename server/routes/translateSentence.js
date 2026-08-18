const router = require('express').Router();
const fetch = require('node-fetch'); // <-- добавлено

// Поддерживаемые изучаемые языки (Settings.jsx) и их коды для Google Translate.
// Раньше sl (source language) был захардкожен на 'de' — из-за этого перевод
// всегда шёл "с немецкого", даже если пользователь изучает другой язык.
const SUPPORTED_SOURCE_LANGS = new Set(['de', 'en', 'es', 'fr', 'pt']);
// Spec 2 (доп., п.10): язык перевода — теперь настоящая настройка
// (Settings.jsx, translationLang), а не захардкоженный 'ru'.
const SUPPORTED_TRANSLATION_LANGS = new Set(['ru', 'en', 'de', 'es', 'pt']);

function resolveSourceLang(targetLang) {
  return SUPPORTED_SOURCE_LANGS.has(targetLang) ? targetLang : 'de';
}

function resolveTranslationLang(translationLang) {
  return SUPPORTED_TRANSLATION_LANGS.has(translationLang) ? translationLang : 'ru';
}

// ─── Одиночный перевод ──────────────────────────────────────────────────────
router.post('/translate-sentence', async (req, res) => {
  const { sentence, sentences, targetLang, translationLang } = req.body;
  const sl = resolveSourceLang(targetLang);
  const tl = resolveTranslationLang(translationLang);

  // Батч-перевод
  if (sentences && Array.isArray(sentences)) {
    try {
      const translations = await Promise.all(
        sentences.map(async (text) => {
          const response = await fetch(
            `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`
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
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(sentence)}`
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