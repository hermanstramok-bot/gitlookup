import { useEffect, useState, useCallback, useRef } from 'react';
import { getPosition, savePosition } from '../utils/positionStorage';

export function useReaderScroll({
  materialId,
  totalSentences,
  containerRef,
  enabled = true,
}) {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const isFirstLoad = useRef(true);
  const updateTimeoutRef = useRef(null);
  const lastIndexRef = useRef(0);

  const scrollToSentence = useCallback(
    (index) => {
      if (!containerRef.current || !enabled) return;
      const container = containerRef.current;
      const target = container.querySelector(`[data-sentence-index="${index}"]`);
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'smooth' });
        setCurrentSentenceIndex(index);
        lastIndexRef.current = index;
      }
    },
    [containerRef, enabled]
  );

  // Восстановление позиции
  useEffect(() => {
    if (!enabled || !totalSentences) return;
    const saved = getPosition(materialId, 'book');
    if (saved?.sentenceIndex !== undefined && saved.sentenceIndex < totalSentences) {
      setCurrentSentenceIndex(saved.sentenceIndex);
      lastIndexRef.current = saved.sentenceIndex;
      requestAnimationFrame(() => {
        scrollToSentence(saved.sentenceIndex);
      });
    }
    setIsReady(true);
    isFirstLoad.current = false;
  }, [enabled, materialId, totalSentences, scrollToSentence]);

  // Сохранение позиции
  useEffect(() => {
    if (!enabled || isFirstLoad.current || !isReady) return;
    savePosition(materialId, 'book', {
      page: 0,
      sentenceIndex: currentSentenceIndex,
    });
  }, [enabled, currentSentenceIndex, materialId, isReady]);

  // IntersectionObserver с дебаунсом
  useEffect(() => {
    if (!enabled || !containerRef.current || !isReady) return;
    const container = containerRef.current;
    const options = { root: container, rootMargin: '0px 0px -80% 0px' };

    const observer = new IntersectionObserver((entries) => {
      // Находим видимый элемент с наименьшим индексом (самый верхний)
      let minIndex = Infinity;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.dataset.sentenceIndex);
          if (!isNaN(idx) && idx < minIndex) {
            minIndex = idx;
          }
        }
      }

      // Если найден новый индекс и он отличается от последнего сохранённого
      if (minIndex !== Infinity && minIndex !== lastIndexRef.current) {
        // Очищаем предыдущий таймаут
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
        // Дебаунс 150 мс – обновляем состояние только после паузы
        updateTimeoutRef.current = setTimeout(() => {
          setCurrentSentenceIndex(minIndex);
          lastIndexRef.current = minIndex;
          updateTimeoutRef.current = null;
        }, 150);
      }
    }, options);

    const items = container.querySelectorAll('[data-sentence-index]');
    items.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [enabled, containerRef, isReady]);

  return { currentSentenceIndex, scrollToSentence, isReady };
}