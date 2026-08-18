// server/utils/reviewUtils.js
//
// Общая логика для Spec 2 (Review Loop). Нормализация слов продублирована
// из materials.js намеренно так же, как она уже продублирована между
// materials.js и client/src/utils/normalizeWord.js — по договорённости не
// трогаем существующий рабочий код, а переиспользуем паттерн.
// Если захотите вынести в один общий модуль — normalizeWord/cleanWord можно
// импортировать сюда из materials.js (module.exports там уже есть смысл
// расширить), но на первом шаге безопаснее не менять существующий файл.

const prisma = require('../prismaClient');

function normalizeWord(word) {
  if (!word) return '';
  return word.trim().toLocaleLowerCase('de');
}

function cleanWord(word) {
  if (!word) return '';
  return word.replace(/^[^\p{L}\p{N}\-']+|[^\p{L}\p{N}\-']+$/gu, '');
}

function extractUniqueNormalizedWords(text) {
  if (!text) return new Set();
  const rawWords = text.split(/\s+/).filter(Boolean);
  const result = new Set();
  for (const raw of rawWords) {
    const cleaned = cleanWord(raw);
    if (!cleaned) continue;
    result.add(normalizeWord(cleaned));
  }
  return result;
}

// Spec 2 (доп., п.8) — "калькулятор повторений": дефолтная таблица
// интервалов + пороги, которые пользователь может переопределить через
// User.reviewSettings (JSON-строка). Форма ниже — единственный источник
// правды для формы, которую редактирует Settings.jsx.
const DEFAULT_REVIEW_SETTINGS = {
  intervals: [
    { maxPercent: 50, days: 3 },
    { maxPercent: 70, days: 7 },
    { maxPercent: 85, days: 14 },
    { maxPercent: 95, days: 30 },
  ],
  defaultDays: 60, // percentKnown >= последний maxPercent (95) — самый долгий интервал
  archivePercent: 95,
  archiveIntervalDays: 60, // "60-дневный чек" — при каком интервале достижение archivePercent даёт право на архивацию
  dropOverrideThreshold: 15, // просадка в п.п. с прошлого раза, форсирующая короткий интервал
  overrideMinDays: 3,
  overrideMaxDays: 7,
};

// Достаёт и валидирует reviewSettings пользователя, подмешивая дефолты для
// отсутствующих/некорректных полей — так частичный/повреждённый JSON никогда
// не роняет расчёт интервала.
async function getReviewSettings(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { reviewSettings: true } });
    if (!user?.reviewSettings) return DEFAULT_REVIEW_SETTINGS;
    const parsed = JSON.parse(user.reviewSettings);
    const intervals = Array.isArray(parsed.intervals) && parsed.intervals.length > 0
      ? parsed.intervals
          .filter(i => i && typeof i.maxPercent === 'number' && typeof i.days === 'number')
          .sort((a, b) => a.maxPercent - b.maxPercent)
      : DEFAULT_REVIEW_SETTINGS.intervals;
    return {
      intervals,
      defaultDays: typeof parsed.defaultDays === 'number' ? parsed.defaultDays : DEFAULT_REVIEW_SETTINGS.defaultDays,
      archivePercent: typeof parsed.archivePercent === 'number' ? parsed.archivePercent : DEFAULT_REVIEW_SETTINGS.archivePercent,
      archiveIntervalDays: typeof parsed.archiveIntervalDays === 'number' ? parsed.archiveIntervalDays : DEFAULT_REVIEW_SETTINGS.archiveIntervalDays,
      dropOverrideThreshold: typeof parsed.dropOverrideThreshold === 'number' ? parsed.dropOverrideThreshold : DEFAULT_REVIEW_SETTINGS.dropOverrideThreshold,
      overrideMinDays: typeof parsed.overrideMinDays === 'number' ? parsed.overrideMinDays : DEFAULT_REVIEW_SETTINGS.overrideMinDays,
      overrideMaxDays: typeof parsed.overrideMaxDays === 'number' ? parsed.overrideMaxDays : DEFAULT_REVIEW_SETTINGS.overrideMaxDays,
    };
  } catch (err) {
    console.error('Ошибка чтения reviewSettings, использую дефолты:', err);
    return DEFAULT_REVIEW_SETTINGS;
  }
}

// Таблица интервалов (Spec 2), теперь настраиваемая (см. getReviewSettings
// выше). Возвращает число дней до следующего повтора.
function nextIntervalDays(percentKnown, settings = DEFAULT_REVIEW_SETTINGS) {
  for (const { maxPercent, days } of settings.intervals) {
    if (percentKnown < maxPercent) return days;
  }
  return settings.defaultDays;
}

// Материал имеет право на архивацию, если % known достиг настраиваемого
// archivePercent и это тот самый "N-дневный чек" (предыдущий интервал уже
// был archiveIntervalDays и % снова прошёл порог).
function isEligibleForArchive(percentKnown, previousIntervalWasLongEnough, settings = DEFAULT_REVIEW_SETTINGS) {
  return percentKnown >= settings.archivePercent && previousIntervalWasLongEnough;
}

// Достаёт полный текст материала (rawContent для текста, конкатенация
// субтитров для видео) — материал должен быть подгружен с include subtitles.
function getMaterialFullText(material) {
  if (material.type === 'video') {
    return (material.subtitles || []).map(s => s.lineText).join(' ');
  }
  return material.rawContent || '';
}

// Основная функция: считает множество слов материала (уникальные,
// нормализованные, за вычетом Spec-1 skip-слов) и % known по формуле
// Spec 2: known / (known + learning), исключая New и Skipped.
//
// Возвращает { percentKnown, knownCount, learningCount, trackedWords }
// trackedWords — массив { word, vocabId, status } для learning-слов,
// нужен для экрана прохождения review (Spec 2: "review pass").
async function calculateMaterialReviewStats(materialId, userId) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: { subtitles: { select: { lineText: true } } }
  });
  if (!material) return null;

  const fullText = getMaterialFullText(material);
  const materialWords = extractUniqueNormalizedWords(fullText);

  const skips = await prisma.materialWordSkip.findMany({
    where: { materialId },
    select: { word: true }
  });
  const skipSet = new Set(skips.map(s => s.word));

  // Учитываем только слова этого материала, которые не пропущены (Spec 1).
  const effectiveWords = [...materialWords].filter(w => !skipSet.has(w));
  if (effectiveWords.length === 0) {
    return { percentKnown: null, knownCount: 0, learningCount: 0, trackedWords: [] };
  }

  // Тянем ВСЕ слова словаря пользователя (не только по sourceTextId — по
  // Spec 2 словарь материала считается динамически, как countNewWords).
  // Spec 2 (доп., п.7): New-слова тоже тянем — они не входят в % known, но
  // показываются в review pass с дефолтом "Знаю" (пользователь подтверждает
  // или переключает на "Учу").
  const vocabEntries = await prisma.vocab.findMany({
    where: { userId, status: { in: ['new', 'learning', 'known'] } },
    select: { id: true, word: true, translation: true, status: true }
  });

  const vocabByNormalized = new Map();
  for (const v of vocabEntries) {
    const norm = normalizeWord(cleanWord(v.word));
    // Если несколько vocab-записей нормализуются в одно и то же слово,
    // берём последнюю встреченную — крайний случай, в основном не должен
    // происходить при нормальной работе Spec 1/дедупликации на фронте.
    vocabByNormalized.set(norm, v);
  }

  let knownCount = 0;
  let learningCount = 0;
  const trackedWords = [];

  for (const w of effectiveWords) {
    const entry = vocabByNormalized.get(w);
    if (!entry) continue; // New-слово, не учитывается (Spec 2)
    if (entry.status === 'known') {
      knownCount++;
    } else if (entry.status === 'learning') {
      learningCount++;
      trackedWords.push({
        vocabId: entry.id,
        word: entry.word,
        translation: entry.translation,
        status: entry.status
      });
    } else if (entry.status === 'new') {
      // Не учитывается в % known (та же формула Spec 2), но показывается в
      // review pass — см. комментарий у vocabEntries выше.
      trackedWords.push({
        vocabId: entry.id,
        word: entry.word,
        translation: entry.translation,
        status: entry.status
      });
    }
  }

  const denominator = knownCount + learningCount;
  const percentKnown = denominator === 0 ? null : (knownCount / denominator) * 100;

  return { percentKnown, knownCount, learningCount, trackedWords };
}

// Возвращает ВСЕ слова материала, которые есть в словаре пользователя, вне
// зависимости от статуса (New/Learning/Known) — нужен для live-словаря во
// время чтения (Spec 2: "live dictionary view") и для экрана сводки после
// прочтения (Spec 2: "post-reading word summary"), где статусы сравниваются
// клиентом со снимком на начало сессии.
async function getMaterialWordList(materialId, userId) {
  const material = await prisma.material.findFirst({
    where: { id: materialId, userId },
    include: { subtitles: { select: { lineText: true } } }
  });
  if (!material) return null;

  const fullText = getMaterialFullText(material);
  const materialWords = extractUniqueNormalizedWords(fullText);

  const skips = await prisma.materialWordSkip.findMany({
    where: { materialId },
    select: { word: true }
  });
  const skipSet = new Set(skips.map(s => s.word));
  const effectiveWords = new Set([...materialWords].filter(w => !skipSet.has(w)));

  const vocabEntries = await prisma.vocab.findMany({
    where: { userId },
    select: { id: true, word: true, translation: true, status: true }
  });

  const result = [];
  for (const v of vocabEntries) {
    const norm = normalizeWord(cleanWord(v.word));
    if (effectiveWords.has(norm)) {
      result.push({ vocabId: v.id, word: v.word, translation: v.translation, status: v.status });
    }
  }
  return result;
}

module.exports = {
  normalizeWord,
  cleanWord,
  extractUniqueNormalizedWords,
  nextIntervalDays,
  isEligibleForArchive,
  getMaterialFullText,
  calculateMaterialReviewStats,
  getMaterialWordList,
  DEFAULT_REVIEW_SETTINGS,
  getReviewSettings,
};