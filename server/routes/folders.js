const router = require('express').Router();
const prisma = require('../prismaClient');
const authenticateToken = require('../middleware/auth');

// GET /api/folders
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

// POST /api/folders
router.post('/folders', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }
  try {
    const folder = await prisma.folder.create({
      data: {
        name: name.trim(),
        userId
      }
    });
    res.status(201).json(folder);
  } catch (err) {
    console.error('Error creating folder:', err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// PUT /api/folders/:id
router.put('/folders/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }
  try {
    const existing = await prisma.folder.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found or not yours' });
    }
    const updated = await prisma.folder.update({
      where: { id },
      data: { name: name.trim() }
    });
    res.json(updated);
  } catch (err) {
    console.error('Error updating folder:', err);
    res.status(500).json({ error: 'Failed to update folder' });
  }
});

// DELETE /api/folders/:id
router.delete('/folders/:id', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.folder.findFirst({
      where: { id, userId }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Folder not found or not yours' });
    }
    // Снимаем привязку материалов к этой папке
    await prisma.material.updateMany({
      where: { folderId: id, userId },
      data: { folderId: null }
    });
    // Удаляем папку
    await prisma.folder.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting folder:', err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

module.exports = router;