import { useState, useEffect, useCallback, useRef } from 'react';
import { getPosition, savePosition } from '../utils/positionStorage';

export function usePagination({
  text,
  bookMode,
  showTranslations,
  materialId,
  wrapperRef,
  shadowRef,
}) {
  const [pageStartIndices, setPageStartIndices] = useState([0]);
  const [studyPage, setStudyPage] = useState(0);
  const [bookPage, setBookPage] = useState(0);
  const [isCalculating, setIsCalculating] = useState(true);
  const [isLayoutReady, setIsLayoutReady] = useState(false);

  const isFirstStudyLoad = useRef(true);
  const isFirstBookLoad = useRef(true);
  const resolvePaginationRef = useRef(null);

  const paginationReadyPromise = useRef(
    new Promise((resolve) => { resolvePaginationRef.current = resolve; })
  );

  const currentPage = bookMode ? bookPage : studyPage;
  const setCurrentPage = useCallback((val) => {
    bookMode ? setBookPage(val) : setStudyPage(val);
  }, [bookMode]);

  const totalSentences = text?.sentences?.length ?? 0;
  const totalPages = pageStartIndices.length;
  const startIndex = pageStartIndices[currentPage] ?? 0;
  const endIndex = pageStartIndices[currentPage + 1] ?? totalSentences;

  const findPageForSentence = useCallback((sentenceIndex) => {
    if (!pageStartIndices.length) return -1;
    let left = 0;
    let right = pageStartIndices.length - 1;
    let result = 0;
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (pageStartIndices[mid] <= sentenceIndex) {
        result = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    return result;
  }, [pageStartIndices]);

  const recalcPages = useCallback(() => {
    const wrapper = wrapperRef.current;
    const shadow = shadowRef.current;
    if (!wrapper || !shadow) { setIsCalculating(false); return; }

    const items = shadow.querySelectorAll('[data-page-item]');
    if (!items.length) { setIsCalculating(false); return; }

    const maxH = wrapper.clientHeight;
    if (maxH < 50) { setIsCalculating(false); return; }

    // Небольшой запас на случай, если реальная высота строки после рендера
    // (curPage-контент) окажется чуть больше измеренной в shadow-элементе —
    // например, из-за font boosting на мобильных браузерах, sub-pixel
    // округления offsetHeight или смены масштаба страницы. Без запаса
    // последняя строка страницы может быть обрезана контейнером с
    // overflow-hidden.
    const SAFETY_MARGIN = 12;
    const fitH = maxH - SAFETY_MARGIN;

    const pages = [0];
    const baseTop = items[0].offsetTop;
    let pageTopOffset = baseTop;

    for (let i = 1; i < items.length; i++) {
      const itemBottom = items[i].offsetTop + items[i].offsetHeight - pageTopOffset;
      if (itemBottom > fitH) {
        pages.push(i);
        pageTopOffset = items[i].offsetTop;
      }
    }

    setPageStartIndices(pages);
    setIsCalculating(false);
    setIsLayoutReady(true);

    if (resolvePaginationRef.current) {
      resolvePaginationRef.current();
      resolvePaginationRef.current = null;
    }
  }, [wrapperRef, shadowRef]);

  // Пересчёт при смене режима или контента
  useEffect(() => {
    if (!text) return;
    setIsCalculating(true);
    setIsLayoutReady(false);
    paginationReadyPromise.current = new Promise((resolve) => {
      resolvePaginationRef.current = resolve;
    });
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => recalcPages())
    );
    return () => cancelAnimationFrame(raf);
  }, [text, bookMode, showTranslations, recalcPages]);

  // Восстановление позиции — отдельно для каждого режима
  useEffect(() => {
    if (!isLayoutReady) return;

    const isFirstLoad = bookMode ? isFirstBookLoad.current : isFirstStudyLoad.current;
    if (!isFirstLoad) return;

    const saved = getPosition(materialId, bookMode ? 'book' : 'study');
    if (saved?.sentenceIndex !== undefined) {
      const page = findPageForSentence(saved.sentenceIndex);
      setCurrentPage(page !== -1 ? page : 0);
    } else if (saved?.page !== undefined) {
      setCurrentPage(Math.min(saved.page, pageStartIndices.length - 1));
    } else {
      setCurrentPage(0);
    }

    if (bookMode) isFirstBookLoad.current = false;
    else isFirstStudyLoad.current = false;
  }, [isLayoutReady, bookMode, materialId, pageStartIndices, findPageForSentence]);

  // Сохранение позиции
  useEffect(() => {
    const isFirstLoad = bookMode ? isFirstBookLoad.current : isFirstStudyLoad.current;
    if (isFirstLoad || !isLayoutReady || totalPages === 0) return;
    savePosition(materialId, bookMode ? 'book' : 'study', {
      page: currentPage,
      sentenceIndex: startIndex,
    });
  }, [currentPage, materialId, isLayoutReady, totalPages, startIndex, bookMode]);

  // Пересчёт при изменении размера окна
  useEffect(() => {
    if (!wrapperRef.current) return;
    let rafId;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setIsCalculating(true);
        setIsLayoutReady(false);
        paginationReadyPromise.current = new Promise((resolve) => {
          resolvePaginationRef.current = resolve;
        });
        recalcPages();
      });
    });
    ro.observe(wrapperRef.current);
    return () => { ro.disconnect(); cancelAnimationFrame(rafId); };
  }, [recalcPages, wrapperRef]);

  const waitForLayout = useCallback(async () => {
    await paginationReadyPromise.current;
  }, []);

  return {
    pageStartIndices,
    currentPage,
    setCurrentPage,
    isCalculating,
    isLayoutReady,
    totalPages,
    startIndex,
    endIndex,
    findPageForSentence,
    waitForLayout,
  };
}