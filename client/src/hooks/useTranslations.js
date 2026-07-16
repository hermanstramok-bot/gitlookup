import { useEffect, useState, useRef } from 'react';
import { apiFetch } from '../utils/api';

// Ограничение параллельности (не более 5 одновременных запросов)
async function throttlePromises(promises, limit = 5) {
  const results = new Array(promises.length);
  const executing = new Set();
  let index = 0;

  const enqueue = () => {
    if (index >= promises.length) return Promise.resolve();
    const currentIndex = index++;
    const p = promises[currentIndex]().then(result => {
      results[currentIndex] = result;
    });
    const e = p.finally(() => {
      executing.delete(e);
    });
    executing.add(e);
    const race = Promise.race([...executing]);
    if (executing.size >= limit) {
      return race.then(() => enqueue());
    }
    return Promise.resolve().then(() => enqueue());
  };

  await enqueue();
  await Promise.all([...executing]);
  return results;
}

export function useTranslations(visibleSentences, materialId, targetLang = 'de') {
  const [translations, setTranslations] = useState({});
  const translationCache = useRef(new Map());
  const pendingSet = useRef(new Set());
  const abortControllerRef = useRef(null);
  // Кэш и pending-множество завязаны на язык: при смене targetLang старые
  // переводы (на другом языке) не должны попадать в выдачу как валидные.
  const cacheLangRef = useRef(targetLang);

  useEffect(() => {
    // Отменяем предыдущие запросы
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Если сменился изучаемый язык — сбрасываем кэш и текущее состояние,
    // иначе увидим "старые" переводы на предыдущем языке.
    if (cacheLangRef.current !== targetLang) {
      translationCache.current.clear();
      pendingSet.current.clear();
      cacheLangRef.current = targetLang;
    }

    const fetchTranslations = async () => {
      if (!visibleSentences || visibleSentences.length === 0) {
        setTranslations({});
        return;
      }

      // Определяем, какие предложения нужно перевести (нет в кэше и не в процессе)
      const missing = visibleSentences.filter(s => {
        const id = s.id;
        return !translationCache.current.has(id) && !pendingSet.current.has(id);
      });

      // Если всё уже есть в кэше – просто обновляем состояние
      if (missing.length === 0) {
        const updated = {};
        visibleSentences.forEach(s => {
          updated[s.id] = translationCache.current.get(s.id) || '';
        });
        setTranslations(updated);
        return;
      }

      // Отмечаем их как "в процессе"
      missing.forEach(s => pendingSet.current.add(s.id));

      try {
        // Создаём массив функций для throttlePromises
        const fetchPromises = missing.map(s => async () => {
          if (abortController.signal.aborted) {
            return null;
          }
          try {
            const data = await apiFetch('/api/translate-sentence', {
              method: 'POST',
              body: JSON.stringify({ sentence: s.original || s.text, targetLang }),
              signal: abortController.signal
            });
            return { id: s.id, translation: data.translation || '' };
          } catch (err) {
            if (err.name === 'AbortError') {
              return null;
            }
            console.error(`Ошибка перевода предложения ${s.id}:`, err);
            return { id: s.id, translation: '' };
          }
        });

        // Выполняем с ограничением параллельности (5)
        const results = await throttlePromises(fetchPromises, 5);

        // Сохраняем в кэш и удаляем из pending
        results.forEach(result => {
          if (result && result.translation !== undefined) {
            translationCache.current.set(result.id, result.translation);
          }
          // Удаляем из pending в любом случае (даже если null из-за отмены)
          if (result?.id) {
            pendingSet.current.delete(result.id);
          }
        });

        // Обновляем состояние для всех видимых предложений
        const updated = {};
        visibleSentences.forEach(s => {
          updated[s.id] = translationCache.current.get(s.id) || '';
        });
        setTranslations(updated);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Общая ошибка при получении переводов:', err);
        }
        // В случае ошибки убираем из pending, чтобы можно было повторить
        missing.forEach(s => pendingSet.current.delete(s.id));
      }
    };

    fetchTranslations();

    return () => {
      // Отменяем запросы и очищаем pending, чтобы при следующем рендере можно было повторить
      abortController.abort();
      // Не удаляем из кэша, но очищаем pending – отменённые запросы будут перезапрошены
      pendingSet.current.clear();
    };
  }, [visibleSentences, materialId, targetLang]);

  return { translations };
}