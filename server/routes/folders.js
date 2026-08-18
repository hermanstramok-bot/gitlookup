const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');

// Та же логика, что и в materials.js (GET /api/materials) — продублирована
// намеренно, по тому же паттерну, что и в reviewUtils.js, чтобы карточки в
// Library.jsx (которые тянут данные через /api/folders/.../contents, а не
// через /api/materials) тоже получали newWordsCount для бейджа "Количество
// слов".
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

function countNewWords(materialText, userVocabNormalizedSet) {
  const materialWords = extractUniqueNormalizedWords(materialText);
  let count = 0;
  for (const w of materialWords) {
    if (userVocabNormalizedSet.has(w)) count++;
  }
  return count;
}

// Подмешивает newWordsCount в список материалов — те же вычисления, что и
// в GET /api/materials, только с материалами, уже загруженными вызывающим
// кодом (в т.ч. с include: subtitles).
async function attachNewWordsCount(userId, materials) {
  const vocabEntries = await prisma.vocab.findMany({
    where: { userId, status: { in: ['new', 'learning'] } },
    select: { word: true }
  });
  const userVocabNormalizedSet = new Set(
    vocabEntries.map(v => normalizeWord(cleanWord(v.word)))
  );

  const materialIds = materials.map(m => m.id);
  const allSkips = await prisma.materialWordSkip.findMany({
    where: { materialId: { in: materialIds } },
    select: { materialId: true, word: true }
  });
  const skipsByMaterial = new Map();
  allSkips.forEach(s => {
    if (!skipsByMaterial.has(s.materialId)) skipsByMaterial.set(s.materialId, new Set());
    skipsByMaterial.get(s.materialId).add(s.word);
  });

  return materials.map((m) => {
    const fullText = m.type === 'video'
      ? (m.subtitles || []).map(s => s.lineText).join(' ')
      : (m.rawContent || '');
    const skippedForThisMaterial = skipsByMaterial.get(m.id) || new Set();
    const effectiveVocabSet = skippedForThisMaterial.size === 0
      ? userVocabNormalizedSet
      : new Set([...userVocabNormalizedSet].filter(w => !skippedForThisMaterial.has(w)));
    const newWordsCount = countNewWords(fullText, effectiveVocabSet);

    const { subtitles, ...rest } = m;
    return { ...rest, newWordsCount };
  });
}

// Helper: walk up the parent chain from `startId` and check if `targetId` appears.
// Used to prevent a folder becoming its own descendant.
async function wouldCreateCycle(folderId, newParentId) {
  if (newParentId == null) return false;
  if (newParentId === folderId) return true;

  let currentId = newParentId;
  const visited = new Set();
  while (currentId != null) {
    if (currentId === folderId) return true;
    if (visited.has(currentId)) break; // safety net against pre-existing bad data
    visited.add(currentId);
    const current = await prisma.folder.findUnique({
      where: { id: currentId },
      select: { parentId: true }
    });
    if (!current) break;
    currentId = current.parentId;
  }
  return false;
}

// GET /api/folders — flat list of all folders (used by "move to folder" pickers etc.)
router.get('/folders', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const folders = await prisma.folder.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(folders);
  } catch (err) {
    console.error('Error fetching folders:', err);
    res.status(500).json({ error: 'Failed to fetch folders' });
  }
});

// GET /api/folders/contents — root-level contents (no folder open)
router.get('/folders/contents', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const [subfolders, materials] = await Promise.all([
      prisma.folder.findMany({
        where: { userId, parentId: null },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { materials: true, children: true } } }
      }),
      prisma.material.findMany({
        where: { userId, folderId: null },
        orderBy: { createdAt: 'desc' },
        include: { subtitles: { select: { lineText: true } } }
      })
    ]);

    res.json({
      folder: null,
      breadcrumb: [],
      subfolders,
      materials: await attachNewWordsCount(userId, materials)
    });
  } catch (err) {
    console.error('Error fetching root contents:', err);
    res.status(500).json({ error: 'Failed to fetch root contents' });
  }
});

// GET /api/folders/:id/contents — contents of a specific folder, plus breadcrumb
router.get('/folders/:id/contents', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid folder id' });

  try {
    const folder = await prisma.folder.findFirst({ where: { id, userId } });
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found or not yours' });
    }

    // Build breadcrumb by walking up parentId chain
    const breadcrumb = [];
    let currentParentId = folder.parentId;
    const visited = new Set();
    while (currentParentId != null) {
      if (visited.has(currentParentId)) break;
      visited.add(currentParentId);
      const ancestor = await prisma.folder.findFirst({
        where: { id: currentParentId, userId }
      });
      if (!ancestor) break;
      breadcrumb.unshift({ id: ancestor.id, name: ancestor.name });
      currentParentId = ancestor.parentId;
    }

    const [subfolders, materials] = await Promise.all([
      prisma.folder.findMany({
        where: { userId, parentId: id },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { materials: true, children: true } } }
      }),
      prisma.material.findMany({
        where: { userId, folderId: id },
        orderBy: { createdAt: 'desc' },
        include: { subtitles: { select: { lineText: true } } }
      })
    ]);

    res.json({
      folder: { id: folder.id, name: folder.name },
      breadcrumb,
      subfolders,
      materials: await attachNewWordsCount(userId, materials)
    });
  } catch (err) {
    console.error('Error fetching folder contents:', err);
    res.status(500).json({ error: 'Failed to fetch folder contents' });
  }
});

// POST /api/folders
router.post('/folders', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name, parentId } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  try {
    let finalParentId = null;
    if (parentId != null) {
      const parentIdNum = parseInt(parentId);
      const parent = await prisma.folder.findFirst({
        where: { id: parentIdNum, userId }
      });
      if (!parent) {
        return res.status(403).json({ error: 'Parent folder not found or not yours' });
      }
      finalParentId = parentIdNum;
    }

    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId,
        parentId: finalParentId
      }
    });
    res.status(201).json(folder);
  } catch (err) {
    console.error('Error creating folder:', err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// PUT /api/folders/:id — rename and/or reparent
router.put('/folders/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { name, parentId } = req.body;

  try {
    const existing = await prisma.folder.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found or not yours' });
    }

    const data = {};

    if (name !== undefined) {
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Folder name is required' });
      }
      data.name = name.trim();
    }

    if (parentId !== undefined) {
      const newParentId = parentId === null ? null : parseInt(parentId);

      if (newParentId != null) {
        const parent = await prisma.folder.findFirst({
          where: { id: newParentId, userId }
        });
        if (!parent) {
          return res.status(403).json({ error: 'Parent folder not found or not yours' });
        }
      }

      const cycle = await wouldCreateCycle(id, newParentId);
      if (cycle) {
        return res.status(400).json({ error: 'Cannot move a folder into itself or one of its own subfolders' });
      }

      data.parentId = newParentId;
    }

    const updated = await prisma.folder.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('Error updating folder:', err);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// PUT /api/folders/:id/move — dedicated endpoint for drag-and-drop reparenting
router.put('/folders/:id/move', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { parentId } = req.body;

  try {
    const existing = await prisma.folder.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found or not yours' });
    }

    const newParentId = parentId === null || parentId === undefined ? null : parseInt(parentId);

    if (newParentId != null) {
      const parent = await prisma.folder.findFirst({
        where: { id: newParentId, userId }
      });
      if (!parent) {
        return res.status(403).json({ error: 'Parent folder not found or not yours' });
      }
    }

    const cycle = await wouldCreateCycle(id, newParentId);
    if (cycle) {
      return res.status(400).json({ error: 'Cannot move a folder into itself or one of its own subfolders' });
    }

    const updated = await prisma.folder.update({
      where: { id },
      data: { parentId: newParentId }
    });
    res.json(updated);
  } catch (err) {
    console.error('Error moving folder:', err);
    res.status(500).json({ error: 'Failed to move folder' });
  }
});

// DELETE /api/folders/:id
// Children folders are re-parented up one level (to the deleted folder's parent),
// not deleted, and not orphaned. Materials directly inside get folderId = null.
router.delete('/folders/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.folder.findFirst({ where: { id, userId } });
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found or not yours' });
    }

    // Re-parent child folders to this folder's parent (may be null = becomes top-level)
    await prisma.folder.updateMany({
      where: { parentId: id, userId },
      data: { parentId: existing.parentId }
    });

    // Detach materials directly inside this folder
    await prisma.material.updateMany({
      where: { folderId: id, userId },
      data: { folderId: null }
    });

    await prisma.folder.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting folder:', err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

module.exports = router;