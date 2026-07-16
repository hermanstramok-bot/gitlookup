const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');

const TARGET_LANGUAGES = ['de', 'en', 'es', 'fr', 'pt'];
const SUBTITLE_LINES_VALUES = [1, 2];

// GET /api/user/settings
// Возвращает настройки текущего пользователя: изучаемый язык и количество
// строк субтитров. Используется в Settings.jsx при монтировании страницы.
router.get('/user/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetLang: true, subtitleLines: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      targetLang: user.targetLang,
      subtitleLines: user.subtitleLines,
    });
  } catch (err) {
    console.error('GET /api/user/settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PATCH /api/user/settings
// Частично обновляет targetLang и/или subtitleLines. Оба поля опциональны.
router.patch('/user/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { targetLang, subtitleLines } = req.body || {};

  const data = {};

  if (targetLang !== undefined) {
    if (!TARGET_LANGUAGES.includes(targetLang)) {
      return res.status(400).json({
        error: `Invalid targetLang. Must be one of: ${TARGET_LANGUAGES.join(', ')}`,
      });
    }
    data.targetLang = targetLang;
  }

  if (subtitleLines !== undefined) {
    const parsed = Number(subtitleLines);
    if (!SUBTITLE_LINES_VALUES.includes(parsed)) {
      return res.status(400).json({ error: 'Invalid subtitleLines. Must be 1 or 2.' });
    }
    data.subtitleLines = parsed;
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { targetLang: true, subtitleLines: true },
    });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /api/user/settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;