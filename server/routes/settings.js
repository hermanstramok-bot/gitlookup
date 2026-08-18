const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');
const { DEFAULT_REVIEW_SETTINGS } = require('../utils/reviewUtils');

const TARGET_LANGUAGES = ['de', 'en', 'es', 'fr', 'pt'];
const SUBTITLE_LINES_VALUES = [1, 2];
// Spec 2 (доп., п.10): translationLang — язык, НА который переводятся
// предложения/слова. Держит 'ru' (дефолт большинства текущих пользователей)
// плюс четыре языка из ТЗ.
const TRANSLATION_LANGUAGES = ['ru', 'en', 'de', 'es', 'pt'];

// Валидация формы reviewSettings ("калькулятор повторений", п.8) — см.
// DEFAULT_REVIEW_SETTINGS в reviewUtils.js за описанием формы.
function validateReviewSettings(input) {
  if (input === null) return null; // null = сброс на дефолты
  if (typeof input !== 'object') return undefined;

  const intervals = Array.isArray(input.intervals)
    ? input.intervals.filter(i =>
        i && typeof i.maxPercent === 'number' && i.maxPercent > 0 && i.maxPercent <= 100 &&
        typeof i.days === 'number' && i.days > 0
      ).sort((a, b) => a.maxPercent - b.maxPercent)
    : DEFAULT_REVIEW_SETTINGS.intervals;
  if (intervals.length === 0) return undefined;

  const num = (v, fallback) => (typeof v === 'number' && v > 0 ? v : fallback);

  return {
    intervals,
    defaultDays: num(input.defaultDays, DEFAULT_REVIEW_SETTINGS.defaultDays),
    archivePercent: num(input.archivePercent, DEFAULT_REVIEW_SETTINGS.archivePercent),
    archiveIntervalDays: num(input.archiveIntervalDays, DEFAULT_REVIEW_SETTINGS.archiveIntervalDays),
    dropOverrideThreshold: num(input.dropOverrideThreshold, DEFAULT_REVIEW_SETTINGS.dropOverrideThreshold),
    overrideMinDays: num(input.overrideMinDays, DEFAULT_REVIEW_SETTINGS.overrideMinDays),
    overrideMaxDays: num(input.overrideMaxDays, DEFAULT_REVIEW_SETTINGS.overrideMaxDays),
  };
}

// GET /api/user/settings
// Возвращает настройки текущего пользователя. Используется в Settings.jsx
// при монтировании страницы.
router.get('/user/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { targetLang: true, subtitleLines: true, reviewSettings: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    let reviewSettings = DEFAULT_REVIEW_SETTINGS;
    if (user.reviewSettings) {
      try { reviewSettings = JSON.parse(user.reviewSettings); } catch { /* fall back to defaults below */ }
    }

    res.json({
      targetLang: user.targetLang,
      subtitleLines: user.subtitleLines,
      reviewSettings,
    });
  } catch (err) {
    console.error('GET /api/user/settings error:', err);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

// PATCH /api/user/settings
// Частично обновляет targetLang, subtitleLines и/или reviewSettings. Все
// поля опциональны. translationLang намеренно НЕ здесь — это чисто
// клиентская настройка (localStorage), сервер её не хранит и не валидирует,
// но список поддерживаемых значений (TRANSLATION_LANGUAGES) экспортирован
// для единообразия с translateSentence.js.
router.patch('/user/settings', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { targetLang, subtitleLines, reviewSettings } = req.body || {};

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

  if (reviewSettings !== undefined) {
    const validated = validateReviewSettings(reviewSettings);
    if (validated === undefined) {
      return res.status(400).json({ error: 'Invalid reviewSettings' });
    }
    data.reviewSettings = validated === null ? null : JSON.stringify(validated);
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { targetLang: true, subtitleLines: true, reviewSettings: true },
    });
    res.json({
      targetLang: updated.targetLang,
      subtitleLines: updated.subtitleLines,
      reviewSettings: updated.reviewSettings ? JSON.parse(updated.reviewSettings) : DEFAULT_REVIEW_SETTINGS,
    });
  } catch (err) {
    console.error('PATCH /api/user/settings error:', err);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

module.exports = router;
module.exports.TRANSLATION_LANGUAGES = TRANSLATION_LANGUAGES;