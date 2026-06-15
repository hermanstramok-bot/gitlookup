import { getDB, saveDB } from '../db.js';

export function setupVocabRoutes(app) {

  // GET все слова
  app.get('/api/vocab', (req, res) => {
    const db = getDB();
    try {
      const stmt = db.prepare(`
        SELECT v.*, t.title as source_title
        FROM vocab v
        LEFT JOIN texts t ON v.source_text_id = t.id
        ORDER BY v.created_at DESC
      `);
      const rows = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        if (!row.source_title && row.source_custom) {
          row.source_title = row.source_custom;
        }
        rows.push(row);
      }
      stmt.reset();
      res.json(rows);
    } catch (err) {
      console.error('Vocab GET error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // POST новое слово (поддержка source_text_id ИЛИ source_custom)
  app.post('/api/vocab', (req, res) => {
    const { word, translation, example_sentence, status, source_text_id, source_custom } = req.body;
    if (!word) return res.status(400).json({ error: 'Word required' });
    const db = getDB();
    try {
      const stmt = db.prepare(`
        INSERT INTO vocab (word, translation, example_sentence, status, source_text_id, source_custom)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      stmt.run([word, translation || '', example_sentence || '', status || 'new', source_text_id || null, source_custom || null]);
      saveDB();
      res.json({ success: true });
    } catch (err) {
      console.error('Vocab insert error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH обновить любые поля (статус, слово, перевод, источник)
  app.patch('/api/vocab/:id', (req, res) => {
    const { id } = req.params;
    const { status, word, translation, source_custom } = req.body;
    const db = getDB();
    try {
      const updates = [];
      const params = [];
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (word !== undefined) {
        updates.push('word = ?');
        params.push(word);
      }
      if (translation !== undefined) {
        updates.push('translation = ?');
        params.push(translation);
      }
      if (source_custom !== undefined) {
        updates.push('source_custom = ?');
        params.push(source_custom);
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      const sql = `UPDATE vocab SET ${updates.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      stmt.run(params);
      saveDB();

      const selectStmt = db.prepare('SELECT * FROM vocab WHERE id = ?');
      selectStmt.bind([id]);
      let updatedRow = null;
      if (selectStmt.step()) updatedRow = selectStmt.getAsObject();
      selectStmt.reset();
      res.json(updatedRow || { success: true });
    } catch (err) {
      console.error('Vocab PATCH error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // PUT (для совместимости)
  app.put('/api/vocab/:id', (req, res) => {
    const { id } = req.params;
    const { status, word, translation, source_custom } = req.body;
    const db = getDB();
    try {
      const updates = [];
      const params = [];
      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }
      if (word !== undefined) {
        updates.push('word = ?');
        params.push(word);
      }
      if (translation !== undefined) {
        updates.push('translation = ?');
        params.push(translation);
      }
      if (source_custom !== undefined) {
        updates.push('source_custom = ?');
        params.push(source_custom);
      }
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(id);
      const sql = `UPDATE vocab SET ${updates.join(', ')} WHERE id = ?`;
      const stmt = db.prepare(sql);
      stmt.run(params);
      saveDB();

      const selectStmt = db.prepare('SELECT * FROM vocab WHERE id = ?');
      selectStmt.bind([id]);
      let updatedRow = null;
      if (selectStmt.step()) updatedRow = selectStmt.getAsObject();
      selectStmt.reset();
      res.json(updatedRow || { success: true });
    } catch (err) {
      console.error('Vocab PUT error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE
  app.delete('/api/vocab/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    try {
      const stmt = db.prepare('DELETE FROM vocab WHERE id = ?');
      stmt.run([id]);
      saveDB();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}