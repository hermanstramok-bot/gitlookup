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

    const result = materials.map((m) => {
      let fullText = '';
      if (m.type === 'video') {
        fullText = (m.subtitles || []).map(s => s.lineText).join(' ');
      } else {
        fullText = m.rawContent || '';
      }
      const newWordsCount = countNewWords(fullText, userVocabNormalizedSet);

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

module.exports = router;