const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');
const { clearTextCache } = require('./texts');

// GET /api/materials
router.get('/materials', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const materials = await prisma.material.findMany({
      where: { userId },
      orderBy: { id: 'desc' }
    });
    res.json(materials);
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