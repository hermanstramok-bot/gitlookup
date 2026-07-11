const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');

// GET /api/games/:gameId
// Параметры: source_text_id (опционально), status (опционально, 'all' или 'new'/'learning'/'known')
router.get('/:gameId', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { gameId } = req.params;
  const { source_text_id, status } = req.query;
  try {
    const where = { userId };
    if (source_text_id) {
      where.sourceTextId = parseInt(source_text_id);
    }
    if (status && status !== 'all') {
      where.status = status;
    }
    const words = await prisma.vocab.findMany({
      where,
      select: {
        id: true,
        word: true,
        translation: true,
        // Для FillTheBlank можно добавить exampleSentence, если есть
        // exampleSentence: true,
      },
    });
    // В зависимости от gameId можно возвращать дополнительные данные
    // Например, для TranslateMe можно сгенерировать варианты ответов на сервере
    // Пока возвращаем просто список слов
    res.json({ words });
  } catch (err) {
    console.error(`Error fetching data for game ${gameId}:`, err);
    res.status(500).json({ error: 'Failed to fetch game data' });
  }
});

module.exports = router;