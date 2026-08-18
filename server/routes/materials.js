const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');
const { clearTextCache } = require('./texts');

// Та же логика нормализации, что и на фронте (client/src/utils/normalizeWord.js),
// чтобы подсчёт совпадал 1-в-1 с тем, что подсвечивается в Reader/VideoReader.
// Немецкая локаль важна для корректной обработки ß/ẞ и т.п.
function normalizeWord(word) {
  if (!word) return '';
  return word.trim().toLocaleLowerCase('de');
}

// Убираем пунктуацию по краям слова — так же, как cleanWord в useWordPanel.js
// на фронте перед сохранением слова в словарь.
function cleanWord(word) {
  if (!word) return '';
  return word.replace(/^[^\p{L}\p{N}\-']+|[^\p{L}\p{N}\-']+$/gu, '');
}

// Разбивает произвольный текст на нормализованный Set уникальных слов.
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

// Считает количество уникальных слов материала, которые пользователь уже
// сохранил в словарь (vocab) со статусом 'new' или 'learning'. Каждое слово
// считается один раз, даже если встречается в тексте многократно.
function countNewWords(materialText, userVocabNormalizedSet) {
  const materialWords = extractUniqueNormalizedWords(materialText);
  let count = 0;
  for (const w of materialWords) {
    if (userVocabNormalizedSet.has(w)) count++;
  }
  return count;
}

// GET /api/materials
router.get('/materials', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const materials = await prisma.material.findMany({
      where: { userId },
      orderBy: { id: 'desc' },
      include: {
        // Для видео нужен текст субтитров, чтобы посчитать новые слова.
        subtitles: { select: { lineText: true } }
      }
    });

    // Словарь пользователя (только new/learning) — тянем один раз, а не на
    // каждый материал в цикле, и сразу нормализуем.
    const vocabEntries = await prisma.vocab.findMany({
      where: { userId, status: { in: ['new', 'learning'] } },
      select: { word: true }
    });
    const userVocabNormalizedSet = new Set(
      vocabEntries.map(v => normalizeWord(cleanWord(v.word)))
    );

    // Пропущенные слова (Spec 1) по всем материалам сразу, сгруппированные
    // по materialId — чтобы не делать отдельный запрос в цикле.
    const allSkips = await prisma.materialWordSkip.findMany({
      select: { materialId: true, word: true }
    });
    const skipsByMaterial = new Map();
    allSkips.forEach(s => {
      if (!skipsByMaterial.has(s.materialId)) skipsByMaterial.set(s.materialId, new Set());
      skipsByMaterial.get(s.materialId).add(s.word);
    });

    const result = materials.map((m) => {
      let fullText = '';
      if (m.type === 'video') {
        fullText = (m.subtitles || []).map(s => s.lineText).join(' ');
      } else {
        fullText = m.rawContent || '';
      }
      const skippedForThisMaterial = skipsByMaterial.get(m.id) || new Set();
      const effectiveVocabSet = skippedForThisMaterial.size === 0
        ? userVocabNormalizedSet
        : new Set([...userVocabNormalizedSet].filter(w => !skippedForThisMaterial.has(w)));
      const newWordsCount = countNewWords(fullText, effectiveVocabSet);

      // Не отдаём subtitles/rawContent целиком в списке — они там не нужны
      // фронту (Library.jsx показывает только карточки) и раздувают ответ.
      const { subtitles, rawContent, ...rest } = m;
      return { ...rest, newWordsCount };
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching materials:', err);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// GET /api/material/:id
router.get('/material/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({
      where: { id, userId }
    });
    if (!material) return res.status(404).json({ error: 'Material not found' });
    res.json(material);
  } catch (err) {
    console.error('Error fetching material:', err);
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// PUT /api/materials/:id – обновление материала (включая author и status)
router.put('/materials/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { title, icon, author, status } = req.body;

  if (!title || !icon) {
    return res.status(400).json({ error: 'Title and icon are required' });
  }

  try {
    const existing = await prisma.material.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Material not found or not yours' });
    }

    const updateData = { title, icon };
    if (author !== undefined) updateData.author = author;
    if (status !== undefined) updateData.status = status;

    const updated = await prisma.material.update({
      where: { id },
      data: updateData
    });

    if (existing.type === 'text') {
      clearTextCache();
    }

    res.json({ success: true, material: updated });
  } catch (err) {
    console.error('Error updating material:', err);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// PATCH /api/materials/:id/status – лёгкое обновление только статуса материала
// (в отличие от PUT /materials/:id — не требует title/icon). Используется
// автоматическими переходами статуса: new -> viewed при дочитывании/досмотре
// материала до конца (Spec 2 доп., см. client Reader.jsx/VideoReader.jsx).
const VALID_MATERIAL_STATUSES = ['new', 'viewed', 'learning', 'completed'];
router.patch('/materials/:id/status', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { status } = req.body;

  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!VALID_MATERIAL_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const existing = await prisma.material.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Material not found or not yours' });
    }

    const updated = await prisma.material.update({
      where: { id },
      data: { status }
    });

    res.json({ success: true, material: updated });
  } catch (err) {
    console.error('Error updating material status:', err);
    res.status(500).json({ error: 'Failed to update material status' });
  }
});

// DELETE /api/materials/:id
router.delete('/materials/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.material.findFirst({
      where: { id, userId },
      include: { subtitles: true, vocab: true }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Material not found or not yours' });
    }
    await prisma.material.delete({ where: { id } });
    if (existing.type === 'text') {
      clearTextCache();
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting material:', err);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

// PUT /api/materials/:id/folder – перемещение материала в папку
router.put('/materials/:id/folder', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { folder_id } = req.body;

  try {
    const existing = await prisma.material.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Material not found or not yours' });
    }

    let finalFolderId = null;
    if (folder_id !== null && folder_id !== undefined) {
      const folderIdNum = parseInt(folder_id);
      const folder = await prisma.folder.findFirst({
        where: { id: folderIdNum, userId }
      });
      if (!folder) {
        return res.status(403).json({ error: 'Folder not found or not yours' });
      }
      finalFolderId = folderIdNum;
    }

    const updated = await prisma.material.update({
      where: { id },
      data: { folderId: finalFolderId }
    });

    res.json({ success: true, material: updated });
  } catch (err) {
    console.error('Error moving material:', err);
    res.status(500).json({ error: 'Failed to move material' });
  }
});

// GET /api/subtitles/:id
router.get('/subtitles/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({
      where: { id, userId }
    });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const subtitles = await prisma.subtitle.findMany({
      where: { textId: id },
      orderBy: { startMs: 'asc' }
    });

    const result = subtitles.map(sub => ({
      id: sub.id,
      text_id: sub.textId,
      start_ms: sub.startMs,
      end_ms: sub.endMs,
      line_text: sub.lineText,
      line_index: sub.lineIndex
    }));

    res.json(result);
  } catch (err) {
    console.error('Error fetching subtitles:', err);
    res.status(500).json({ error: 'Failed to fetch subtitles' });
  }
});

// ============================================================
// SPEC 1: Per-Material Word Skip / Unhighlight
// ============================================================
// Пропуск слова действует только внутри конкретного материала — не
// затрагивает саму запись словаря (Vocab) и не влияет на слово в других
// материалах. Ключ — нормализованное слово (та же normalizeWord/cleanWord
// логика, что и в остальном materials.js), а не vocabId, потому что New-слово
// может ещё не иметь записи в Vocab вообще.

// GET /api/materials/:id/skipped-words — список пропущенных слов материала
router.get('/materials/:id/skipped-words', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const material = await prisma.material.findFirst({
      where: { id: materialId, userId }
    });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const skips = await prisma.materialWordSkip.findMany({
      where: { materialId },
      select: { word: true }
    });

    res.json(skips.map(s => s.word));
  } catch (err) {
    console.error('Error fetching skipped words:', err);
    res.status(500).json({ error: 'Failed to fetch skipped words' });
  }
});

// POST /api/materials/:id/skipped-words — пропустить слово в этом материале
router.post('/materials/:id/skipped-words', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  const { word } = req.body;

  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });
  if (!word || !cleanWord(word).trim()) {
    return res.status(400).json({ error: 'Word is required' });
  }

  const normalized = normalizeWord(cleanWord(word));

  try {
    const material = await prisma.material.findFirst({
      where: { id: materialId, userId }
    });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    const skip = await prisma.materialWordSkip.upsert({
      where: { materialId_word: { materialId, word: normalized } },
      update: {},
      create: { materialId, word: normalized }
    });

    res.status(201).json(skip);
  } catch (err) {
    console.error('Error skipping word:', err);
    res.status(500).json({ error: 'Failed to skip word' });
  }
});

// DELETE /api/materials/:id/skipped-words/:word — отменить пропуск (unskip)
router.delete('/materials/:id/skipped-words/:word', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const materialId = parseInt(req.params.id);
  if (isNaN(materialId)) return res.status(400).json({ error: 'Invalid id' });

  const normalized = normalizeWord(cleanWord(decodeURIComponent(req.params.word)));

  try {
    const material = await prisma.material.findFirst({
      where: { id: materialId, userId }
    });
    if (!material) return res.status(404).json({ error: 'Material not found or not yours' });

    await prisma.materialWordSkip.deleteMany({
      where: { materialId, word: normalized }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error unskipping word:', err);
    res.status(500).json({ error: 'Failed to unskip word' });
  }
});

module.exports = router;