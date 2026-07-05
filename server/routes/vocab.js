const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');

// ─── ПОЛУЧИТЬ ВСЕ СЛОВА (только для текущего пользователя) ──
router.get('/vocab', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const words = await prisma.vocab.findMany({
      where: { userId },
      include: {
        material: { select: { title: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    const result = words.map(w => ({
      ...w,
      source_title: w.material?.title || w.sourceCustom || null
    }));
    res.json(result);
  } catch (err) {
    console.error('Error fetching vocab:', err);
    res.status(500).json({ error: 'Failed to fetch vocab' });
  }
});

// ─── ДОБАВИТЬ СЛОВО ──────────────────────────────────────────
router.post('/vocab', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    word,
    translation,
    example_sentence,
    status,
    source_text_id,
    source_subtitle_id,
    sentence_index,
    word_indices,
    source_custom
  } = req.body;

  if (!word) {
    return res.status(400).json({ error: 'Word is required' });
  }

  try {
    if (source_text_id) {
      const material = await prisma.material.findFirst({
        where: { id: source_text_id, userId }
      });
      if (!material) {
        return res.status(403).json({ error: 'Source material not found or not yours' });
      }
    }

    // Преобразуем массив индексов в JSON-строку, т.к. в схеме Prisma поле wordIndices имеет тип String?
    const wordIndicesValue = word_indices ? JSON.stringify(word_indices) : null;

    const newWord = await prisma.vocab.create({
      data: {
        word,
        translation: translation || '',
        exampleSentence: example_sentence || '',
        status: status || 'new',
        sourceTextId: source_text_id || null,
        sourceSubtitleId: source_subtitle_id || null,
        sentenceIndex: sentence_index || null,
        wordIndices: wordIndicesValue,
        sourceCustom: source_custom || null,
        userId
      }
    });
    res.status(201).json(newWord);
  } catch (err) {
    console.error('Error adding word:', err);
    res.status(500).json({ error: 'Failed to add word' });
  }
});

// ─── ОБНОВИТЬ СЛОВО (PATCH) ──────────────────────────────────
router.patch('/vocab/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { word, translation, status, source_custom } = req.body;

  try {
    const existing = await prisma.vocab.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Word not found or not yours' });
    }

    const updated = await prisma.vocab.update({
      where: { id },
      data: {
        word: word !== undefined ? word : undefined,
        translation: translation !== undefined ? translation : undefined,
        status: status !== undefined ? status : undefined,
        sourceCustom: source_custom !== undefined ? source_custom : undefined,
        updatedAt: new Date()
      }
    });
    res.json(updated);
  } catch (err) {
    console.error('Error updating word:', err);
    res.status(500).json({ error: 'Failed to update word' });
  }
});

// ─── УДАЛИТЬ СЛОВО ──────────────────────────────────────────
router.delete('/vocab/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);

  try {
    const existing = await prisma.vocab.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Word not found or not yours' });
    }

    await prisma.vocab.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting word:', err);
    res.status(500).json({ error: 'Failed to delete word' });
  }
});

// ─── ТРЕНАЖЁР (получить слова для тренировки) ──────────────
router.get('/vocab/trainer', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const sourceTextId = req.query.source_text_id;

  try {
    const where = { userId };
    if (sourceTextId && sourceTextId !== 'all') {
      where.sourceTextId = parseInt(sourceTextId);
    }

    const words = await prisma.vocab.findMany({
      where,
      select: { word: true, translation: true }
    });

    res.json({
      words: words.map(w => ({ de: w.word, ru: w.translation }))
    });
  } catch (err) {
    console.error('Error trainer:', err);
    res.status(500).json({ error: 'Failed to fetch trainer data' });
  }
});

module.exports = router;