import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';

// Spec 2: Review Loop. Хук инкапсулирует состояние "материал в review loop
// или нет" для конкретного материала (используется в Reader/VideoReader),
// плюс действия добавить/убрать.
export function useReview(materialId) {
  const [inLoop, setInLoop] = useState(false);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);

  const load = useCallback(async () => {
    if (!materialId) return;
    setLoading(true);
    try {
      const data = await apiFetch(`/api/materials/${materialId}/review`);
      setReview(data.review);
      setInLoop(true);
    } catch (err) {
      // 404 = материал ещё не в review loop — это ожидаемое состояние, не ошибка
      setInLoop(false);
      setReview(null);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => { load(); }, [load]);

  const addToReview = useCallback(async () => {
    try {
      const data = await apiFetch(`/api/materials/${materialId}/review`, { method: 'POST' });
      setInLoop(true);
      setReview(data.review);
      return data;
    } catch (err) {
      console.error('Ошибка добавления в Review loop:', err);
      throw err;
    }
  }, [materialId]);

  const removeFromReview = useCallback(async () => {
    try {
      await apiFetch(`/api/materials/${materialId}/review`, { method: 'DELETE' });
      setInLoop(false);
      setReview(null);
    } catch (err) {
      console.error('Ошибка удаления из Review loop:', err);
      throw err;
    }
  }, [materialId]);

  return { inLoop, loading, review, addToReview, removeFromReview, reload: load };
}