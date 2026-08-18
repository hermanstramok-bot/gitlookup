// server/routes/review.js
//
// Spec 2: Review Loop / Spaced Repetition for Materials.
// Материал (не слово) — единица планирования. Наличие записи в
// MaterialReview = материал в Review loop. Никакого фикс. таймера —
// материал "лежит" до тех пор, пока пользователь вручную не откроет его
// на review pass (обычно после дриллинга во внешнем инструменте, Anki).

const router = require('express').Router();
const prisma = require('../prismaClient');
const authModule = require('../middleware/auth');
// Некоторые проекты экспортируют middleware как module.exports = fn,
// другие — как module.exports = { authenticateToken: fn }. Поддерживаем
// оба варианта, чтобы не зависеть от того, как именно оформлен auth.js.
const authenticateToken = typeof authModule === 'function'
  ? authModule
  : authModule.authenticateToken;
const {
  calculateMaterialReviewStats,
  getMaterialWordList,
  nextIntervalDays,
  getReviewSettings,
} = require('../utils/reviewUtils');

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ============================================================
// GET /api/materials/:id/words — все слова материала (New/Learning/Known)
// Используется: live-словарь во время чтения + сводка после прочтения
// (клиент сам сравнивает два снимка этого списка — на старте сессии и в
// конце — чтобы определить, какие слова сменили статус).
// ============================================================
router.get('/materials/:id/words', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const words = await getMaterialWordList(materialId, userId);
    if (words === null) return res.status(404).json({ error: 'Material not found or not yours' });
    res.json({ words });
  } catch (err) {
    console.error('Error fetching material word list:', err);
    res.status(500).json({ error: 'Failed to fetch material word list' });
  }
});

// ============================================================
// POST /api/materials/:id/review — добавить материал в Review loop
// ============================================================
router.post('/materials/:id/review', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({ where: { id: materialId, userId } });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const existing = await prisma.materialReview.findUnique({ where: { materialId } });
    if (existing) {
      return res.json({ success: true, review: existing, alreadyInLoop: true });
    }

    // ОБНОВЛЕНО (Spec 2 доп.): при первом добавлении в loop дата следующего
    // повтора НЕ назначается. Материал висит в зоне "ожидает первого
    // повтора" (nextReviewAt = null) до тех пор, пока пользователь сам не
    // откроет его на review pass — только тогда появляется расписание.
    const stats = await calculateMaterialReviewStats(materialId, userId);
    const percentKnown = stats?.percentKnown ?? null;

    const review = await prisma.materialReview.create({
      data: {
        materialId,
        lastPercentKnown: percentKnown,
        nextReviewAt: null,
      }
    });

    // Spec 2 (доп.): добавление в Review loop = материал теперь "изучается".
    await prisma.material.update({ where: { id: materialId }, data: { status: 'learning' } });

    res.status(201).json({ success: true, review, percentKnown });
  } catch (err) {
    console.error('Error adding material to review loop:', err);
    res.status(500).json({ error: 'Failed to add material to review loop' });
  }
});

// ============================================================
// DELETE /api/materials/:id/review — убрать материал из Review loop
// ============================================================
router.delete('/materials/:id/review', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({ where: { id: materialId, userId } });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    await prisma.materialReview.deleteMany({ where: { materialId } });

    // Spec 2 (доп.): ручное удаление из Review loop возвращает материал в
    // "просмотрено" — если только он уже не заархивирован как выученный.
    if (material.status !== 'completed') {
      await prisma.material.update({ where: { id: materialId }, data: { status: 'viewed' } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error removing material from review loop:', err);
    res.status(500).json({ error: 'Failed to remove material from review loop' });
  }
});

// ============================================================
// GET /api/materials/:id/review — статус + слова для review pass
// ============================================================
router.get('/materials/:id/review', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({ where: { id: materialId, userId } });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const review = await prisma.materialReview.findUnique({ where: { materialId } });
    if (!review) return res.status(404).json({ error: 'Material is not in the review loop' });

    const stats = await calculateMaterialReviewStats(materialId, userId);

    res.json({
      review,
      percentKnown: stats?.percentKnown ?? null,
      knownCount: stats?.knownCount ?? 0,
      learningCount: stats?.learningCount ?? 0,
      // Слова для прохождения review — New/Learning/Known (Known тоже
      // показываются, чтобы их можно было откатить обратно на "Ещё учу";
      // см. calculateMaterialReviewStats в reviewUtils.js).
      words: stats?.trackedWords ?? [],
    });
  } catch (err) {
    console.error('Error fetching review details:', err);
    res.status(500).json({ error: 'Failed to fetch review details' });
  }
});

// ============================================================
// GET /api/review/due — материалы, у которых наступил срок повтора, ИЛИ
// которые ещё ни разу не проходили review (ожидают первого прохода).
// Возвращаем раздельно due/waiting, чтобы фронт мог показать их по-разному
// в зоне Review на Library (Spec 2 доп.: "waiting" висят там бессрочно).
// ============================================================
router.get('/review/due', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const now = new Date();

    const dueReviews = await prisma.materialReview.findMany({
      where: {
        archived: false,
        nextReviewAt: { not: null, lte: now },
        material: { userId },
      },
      include: { material: { select: { id: true, title: true, type: true, icon: true } } },
      orderBy: { nextReviewAt: 'asc' },
    });

    const waitingReviews = await prisma.materialReview.findMany({
      where: {
        archived: false,
        nextReviewAt: null,
        material: { userId },
      },
      include: { material: { select: { id: true, title: true, type: true, icon: true } } },
      orderBy: { createdAt: 'asc' },
    });

    const mapItem = (r) => ({
      materialId: r.materialId,
      material: r.material,
      lastPercentKnown: r.lastPercentKnown,
      nextReviewAt: r.nextReviewAt,
      lastReviewedAt: r.lastReviewedAt,
    });

    res.json({
      due: dueReviews.map(mapItem),
      waiting: waitingReviews.map(mapItem),
    });
  } catch (err) {
    console.error('Error fetching due reviews:', err);
    res.status(500).json({ error: 'Failed to fetch due reviews' });
  }
});

// ============================================================
// GET /api/review/all — ПОЛНЫЙ список материалов в Review loop (не только
// due/waiting, но и запланированные на будущее) — для "Show all" / full
// funnel view в Library.
// ============================================================
router.get('/review/all', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const allReviews = await prisma.materialReview.findMany({
      where: {
        archived: false,
        material: { userId },
      },
      include: { material: { select: { id: true, title: true, type: true, icon: true } } },
      orderBy: [{ nextReviewAt: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(allReviews.map(r => ({
      materialId: r.materialId,
      material: r.material,
      lastPercentKnown: r.lastPercentKnown,
      nextReviewAt: r.nextReviewAt,
      lastReviewedAt: r.lastReviewedAt,
    })));
  } catch (err) {
    console.error('Error fetching all reviews:', err);
    res.status(500).json({ error: 'Failed to fetch all reviews' });
  }
});

// ============================================================
// POST /api/materials/:id/review/pass — зафиксировать проход review
// body: { updates: [{ vocabId, newStatus: 'known' | 'learning' }] }
// ============================================================
router.post('/materials/:id/review/pass', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  const { updates } = req.body;

  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'updates must be an array' });

  try {
    const material = await prisma.material.findFirst({ where: { id: materialId, userId } });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const review = await prisma.materialReview.findUnique({ where: { materialId } });
    if (!review) return res.status(404).json({ error: 'Material is not in the review loop' });

    // Применяем статусы, только к словам, реально принадлежащим пользователю.
    for (const u of updates) {
      if (!u || !u.vocabId || !['known', 'learning'].includes(u.newStatus)) continue;
      await prisma.vocab.updateMany({
        where: { id: u.vocabId, userId },
        data: { status: u.newStatus, updatedAt: new Date() },
      });
    }

    // Spec 2 (доп., п.8): интервалы/пороги настраиваемы через Settings.jsx
    // ("калькулятор повторений") — читаем их с фолбэком на дефолты.
    const settings = await getReviewSettings(userId);

    // Пересчитываем % known после применения обновлений.
    const stats = await calculateMaterialReviewStats(materialId, userId);
    const newPercent = stats?.percentKnown ?? null;
    const previousPercent = review.lastPercentKnown;

    let intervalDays;
    if (newPercent === null) {
      // Нечего трекать (например все слова стали known и New) — не двигаем
      // расписание резко, используем самый долгий интервал по умолчанию,
      // чтобы не заспамить due-список.
      intervalDays = settings.defaultDays;
    } else {
      intervalDays = nextIntervalDays(newPercent, settings);

      // Override rule: реальная просадка > dropOverrideThreshold п.п. с
      // прошлого прохода форсирует короткий интервал вне зависимости от бакета.
      if (previousPercent !== null && previousPercent !== undefined) {
        const drop = previousPercent - newPercent;
        if (drop > settings.dropOverrideThreshold) {
          intervalDays = Math.min(Math.max(intervalDays, settings.overrideMinDays), settings.overrideMaxDays);
        }
      }
    }

    const wasLongEnoughInterval = review.nextReviewAt && review.lastReviewedAt
      ? Math.round((review.nextReviewAt - review.lastReviewedAt) / (1000 * 60 * 60 * 24)) >= settings.archiveIntervalDays
      : false;
    const eligibleForArchive = newPercent !== null && newPercent >= settings.archivePercent && wasLongEnoughInterval;

    const now = new Date();
    const updatedReview = await prisma.materialReview.update({
      where: { materialId },
      data: {
        lastPercentKnown: newPercent,
        lastReviewedAt: now,
        nextReviewAt: addDays(now, intervalDays),
      }
    });

    res.json({
      success: true,
      review: updatedReview,
      percentKnown: newPercent,
      intervalDays,
      eligibleForArchive,
    });
  } catch (err) {
    console.error('Error recording review pass:', err);
    res.status(500).json({ error: 'Failed to record review pass' });
  }
});

// ============================================================
// POST /api/materials/:id/archive — вручную заархивировать материал
// ============================================================
router.post('/materials/:id/archive', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({ where: { id: materialId, userId } });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const review = await prisma.materialReview.findUnique({ where: { materialId } });
    if (!review) return res.status(404).json({ error: 'Material is not in the review loop' });

    const settings = await getReviewSettings(userId);

    // Архивация — ручное действие пользователя, но только предлагается на
    // фронте при lastPercentKnown >= archivePercent; здесь мягкая проверка на
    // бэкенде, чтобы не архивировать по ошибке материал, который не дошёл до порога.
    if (review.lastPercentKnown === null || review.lastPercentKnown < settings.archivePercent) {
      return res.status(400).json({ error: `Material has not reached ${settings.archivePercent}% known yet` });
    }

    const updated = await prisma.materialReview.update({
      where: { materialId },
      data: { archived: true, archivedAt: new Date() }
    });

    // Spec 2 (доп.): архивация = материал "выучен".
    await prisma.material.update({ where: { id: materialId }, data: { status: 'completed' } });

    res.json({ success: true, review: updated });
  } catch (err) {
    console.error('Error archiving material:', err);
    res.status(500).json({ error: 'Failed to archive material' });
  }
});

module.exports = router;