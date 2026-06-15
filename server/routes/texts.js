import { getDB } from '../db.js';

// Кеш переводов и разбора предложений (очищается при перезапуске сервера или импорте)
const textCache = new Map();

export function setupTextsRoutes(app) {

  // GET /api/texts/:id - получить текст с предварительно переведёнными предложениями (с кешем)
  app.get('/api/texts/:id', async (req, res) => {
    const { id } = req.params;
    const startTime = Date.now();

    // Проверяем кеш
    if (textCache.has(id)) {
      const cached = textCache.get(id);
      console.log(`✅ Text ${id} served from cache (age: ${Date.now() - cached.timestamp} ms)`);
      return res.json(cached.data);
    }

    console.log(`🔄 Text ${id} not in cache, processing...`);
    const db = getDB();

    try {
      // Получаем текст из БД
      const stmt = db.prepare('SELECT * FROM texts WHERE id = ?');
      stmt.bind([id]);
      let textRow = null;
      if (stmt.step()) {
        textRow = stmt.getAsObject();
      }
      stmt.reset();

      if (!textRow) {
        return res.status(404).json({ error: 'Text not found' });
      }

      const content = textRow.raw_content || '';
      if (!content) {
        return res.json({
          id: textRow.id,
          title: textRow.title,
          type: textRow.type,
          content: '',
          sentences: []
        });
      }

      // Разбиваем на предложения
      const rawSentences = splitIntoSentences(content);
      const sentences = [];

      for (const sentence of rawSentences) {
        // Переводим каждое предложение (Google Translate)
        const tStart = Date.now();
        const translated = await translateSentenceViaGoogle(sentence);
        console.log(`   Translation of "${sentence.slice(0, 30)}..." took ${Date.now() - tStart} ms`);

        sentences.push({
          original: sentence.trim(),
          translated: translated.trim(),
          words: sentence.trim().split(/\s+/),
          analysis: [] // анализ подгружается по требованию на клиенте
        });
      }

      const responseData = {
        id: textRow.id,
        title: textRow.title,
        type: textRow.type,
        content: content,
        sentences: sentences
      };

      // Сохраняем в кеш
      textCache.set(id, {
        data: responseData,
        timestamp: Date.now()
      });

      console.log(`✅ Text ${id} processed and cached in ${Date.now() - startTime} ms`);
      res.json(responseData);

    } catch (err) {
      console.error('Error fetching text:', err);
      res.status(500).json({ error: err.message });
    }
  });
}

// ============================
// HELPER: Разбиение на предложения
// ============================
function splitIntoSentences(text) {
  const sentenceRegex = /[^.!?]*[.!?]+/g;
  const matches = text.match(sentenceRegex) || [];
  return matches
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ============================
// HELPER: Перевод предложения через Google Translate
// ============================
async function translateSentenceViaGoogle(sentence) {
  if (!sentence || sentence.trim().length === 0) {
    return '';
  }

  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.append('client', 'gtx');
    url.searchParams.append('sl', 'de');
    url.searchParams.append('tl', 'ru');
    url.searchParams.append('dt', 't');
    url.searchParams.append('q', sentence);

    const result = await fetch(url.toString());
    const data = await result.json();

    if (data && data[0] && data[0][0]) {
      return data[0][0][0];
    }
    return sentence;
  } catch (err) {
    console.error('Google Translate error:', err);
    return sentence;
  }
}

// Функция для очистки кеша (например, после импорта текста)
export function clearTextCache() {
  textCache.clear();
  console.log('🧹 Text cache cleared');
}