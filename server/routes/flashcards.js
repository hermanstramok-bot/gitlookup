const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');

// GET /api/flashcards
// Параметры: source_text_id (опционально), status (опционально, 'all' или 'new'/'learning'/'known')
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.id;
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
      },
    });
    res.json({ words });
  } catch (err) {
    console.error('Error fetching flashcards:', err);
    res.status(500).json({ error: 'Failed to fetch flashcards' });
  }
});

module.exports = router;