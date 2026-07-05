const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');
const { splitSentences } = require('../utils/sentenceSplitter');

// Кеш для текстов (в памяти)
const textCache = new Map();

router.get('/texts/:id', authenticateToken, async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = req.user.id;

  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  // Проверяем кеш
  const cached = textCache.get(id);
  if (cached) {
    return res.json(cached);
  }

  try {
    const text = await prisma.material.findFirst({
      where: { id, userId, type: 'text' }
    });
    if (!text) {
      return res.status(404).json({ error: 'Text not found or not yours' });
    }

    const raw = text.rawContent || '';
    // Разбиваем на абзацы (двойной перевод строки)
    const paragraphs = raw.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    
    // Определяем язык (по умолчанию немецкий, можно добавить поле в материал)
    const language = text.language || 'de';

    // Разбиваем каждый абзац на предложения с учётом аббревиатур
    // Используем Intl.Segmenter через функцию splitSentences
    const sentences = [];
    for (const paragraph of paragraphs) {
      const paraSentences = splitSentences(paragraph, language);
      sentences.push(...paraSentences);
    }

    const result = {
      id: text.id,
      title: text.title,
      type: text.type,
      sentences: sentences.map(s => ({ 
        original: s, 
        translated: '', 
        words: s.split(/\s+/) 
      })),
      paragraphs: paragraphs.map(p => splitSentences(p, language))
    };

    textCache.set(id, result);
    res.json(result);
  } catch (err) {
    console.error('Error fetching text:', err);
    res.status(500).json({ error: 'Failed to fetch text' });
  }
});

// Функция для очистки кеша (можно использовать при обновлении материала)
function clearTextCache() {
  textCache.clear();
  console.log('🧹 Text cache cleared');
}

module.exports = router;
module.exports.clearTextCache = clearTextCache;