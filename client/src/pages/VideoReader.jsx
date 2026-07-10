import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import YouTube from 'react-youtube';
import WordPanel from '../components/WordPanel';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useTranslations } from '../hooks/useTranslations';
import { useWordPanel } from '../hooks/useWordPanel';
import { usePagination } from '../hooks/usePagination';
import { normalizeWord } from '../utils/normalizeWord';

// --- Ключи localStorage для персистентности режима/времени на видео ---
const viewModeKey = (id) => `videoreader_last_mode_${id}`;
const videoTimeKey = (id) => `videoreader_time_${id}`;

// Достаём координаты как из мышиных, так и из тач-событий.
const getPoint = (e) => {
  if (e.touches && e.touches.length) {
    return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  if (e.changedTouches && e.changedTouches.length) {
    return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  }
  return { x: e.clientX, y: e.clientY };
};

export default function VideoReader() {
  const { user, logout } = useAuth();
  const { id } = useParams();
  const [material, setMaterial] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);
  const playerIntervalRef = useRef(null);
  const isMounted = useRef(true);
  const videoTimeRef = useRef(0);
  const lastSubIndexRef = useRef(-1);

  // Дефолт при самом первом открытии материала — субтитры.
  const [viewMode, setViewMode] = useState('subtitles');

  const [isVideoMinimized, setIsVideoMinimized] = useState(false);
  const [videoPosition, setVideoPosition] = useState({ x: 20, y: 80 });
  const [videoSize, setVideoSize] = useState({ width: 384, height: 216 });
  const videoRef = useRef(null);
  const videoSizeRef = useRef({ width: 384, height: 216 });

  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const videoPositionRef = useRef({ x: 20, y: 80 });
  const resizing = useRef(false);
  const resizeStart = useRef({ x: 0, y: 0, width: 384, height: 216, aspect: 384 / 216 });

  const [activeSubId, setActiveSubId] = useState(null);

  const [savedWords, setSavedWords] = useState([]);
  const wordPanel = useWordPanel(id, savedWords, setSavedWords);

  const textForPagination = useMemo(() => {
    return {
      sentences: subtitles.map((sub) => ({
        id: sub.id,
        text: sub.line_text,
        original: sub.line_text,
        words: sub.line_text.split(/\s+/).filter(Boolean),
      })),
    };
  }, [subtitles]);

  const containerRef = useRef(null);
  const shadowRef = useRef(null);

  const {
    pageStartIndices: pages,
    currentPage: curPage,
    setCurrentPage: setCurPage,
    isCalculating: isCalc,
    totalPages: totalPagesCount,
    startIndex: startIdx,
    endIndex: endIdx,
  } = usePagination({
    text: textForPagination,
    bookMode: false,
    showTranslations: false,
    materialId: id,
    wrapperRef: containerRef,
    shadowRef: shadowRef,
    enabled: viewMode === 'subtitles',
  });

  const translationSentences = useMemo(() => {
    return subtitles.map(sub => ({
      id: sub.id,
      original: sub.line_text,
    }));
  }, [subtitles]);

  const { translations } = useTranslations(translationSentences, id);

  const wordStatusMap = useMemo(() => {
    const map = new Map();
    savedWords.forEach(sw => {
      const key = normalizeWord(sw.word);
      if (!map.has(key)) {
        map.set(key, sw.status);
      }
    });
    return map;
  }, [savedWords]);

  // Сохраняем текущее время видео и в ref (для мгновенного использования
  // в рамках сессии), и в localStorage (чтобы восстановить после перезахода).
  const saveCurrentTime = useCallback(() => {
    if (playerRef.current) {
      try {
        const t = playerRef.current.getCurrentTime();
        if (t > 0) {
          videoTimeRef.current = t;
          localStorage.setItem(videoTimeKey(id), String(t));
        }
      } catch {}
    }
  }, [id]);

  const switchViewMode = () => {
    saveCurrentTime();
    setViewMode(m => {
      const next = m === 'full' ? 'subtitles' : 'full';
      localStorage.setItem(viewModeKey(id), next);
      return next;
    });
  };

  // --- Drag (перетаскивание окна видео), с поддержкой мыши и тача ---
  const onDragStart = useCallback((e) => {
    if (!e.target.closest('.video-drag-handle')) return;
    if (e.cancelable) e.preventDefault();
    const point = getPoint(e);
    const rect = videoRef.current.getBoundingClientRect();
    const offsetX = point.x - rect.left;
    const offsetY = point.y - rect.top;
    dragging.current = true;
    dragOffset.current = { x: offsetX, y: offsetY };

    const onMove = (e) => {
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      const p = getPoint(e);
      const el = videoRef.current;
      if (!el) return;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = Math.max(0, Math.min(p.x - offsetX, window.innerWidth - w));
      const y = Math.max(0, Math.min(p.y - offsetY, window.innerHeight - h));
      el.style.left = x + 'px';
      el.style.top  = y + 'px';
      videoPositionRef.current = { x, y };
    };
    const onEnd = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      setVideoPosition({ ...videoPositionRef.current });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, []);

  // --- Resize (изменение размера окна видео), с поддержкой мыши и тача ---
  const onResizeStart = useCallback((e) => {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    const point = getPoint(e);
    const el = videoRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const aspect = rect.width / rect.height;
    resizing.current = true;
    resizeStart.current = {
      x: point.x,
      y: point.y,
      width: rect.width,
      height: rect.height,
      aspect: aspect,
    };
    const onMove = (e) => {
      if (!resizing.current) return;
      if (e.cancelable) e.preventDefault();
      const p = getPoint(e);
      const dx = p.x - resizeStart.current.x;
      const dy = p.y - resizeStart.current.y;
      const newWidth = Math.max(280, resizeStart.current.width + dx);
      const newHeight = newWidth / resizeStart.current.aspect;
      const maxW = window.innerWidth - videoPositionRef.current.x - 20;
      const maxH = window.innerHeight - videoPositionRef.current.y - 20;
      const finalW = Math.min(newWidth, maxW);
      const finalH = Math.min(newHeight, maxH);
      el.style.width = finalW + 'px';
      el.style.height = finalH + 'px';
      videoSizeRef.current = { width: finalW, height: finalH };
    };
    const onEnd = () => {
      resizing.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
      saveCurrentTime();
      setVideoSize({ ...videoSizeRef.current });
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
  }, [saveCurrentTime]);

  const findActiveSubtitle = useCallback((timeMs) => {
    const subs = subtitles;
    if (!subs.length) return -1;
    const lastIdx = lastSubIndexRef.current;
    if (lastIdx >= 0 && lastIdx < subs.length) {
      const sub = subs[lastIdx];
      if (timeMs >= sub.start_ms && timeMs <= sub.end_ms) return lastIdx;
    }
    let lo = 0, hi = subs.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (subs[mid].start_ms <= timeMs) lo = mid + 1;
      else hi = mid - 1;
    }
    const idx = hi;
    if (idx >= 0 && idx < subs.length && timeMs <= subs[idx].end_ms) {
      lastSubIndexRef.current = idx;
      return idx;
    }
    lastSubIndexRef.current = -1;
    return -1;
  }, [subtitles]);

  const syncWithVideo = useCallback(() => {
    if (!playerRef.current) return;
    let timeMs;
    try {
      timeMs = playerRef.current.getCurrentTime() * 1000;
    } catch { return; }
    const activeIdx = findActiveSubtitle(timeMs);
    if (activeIdx >= 0) {
      const activeSub = subtitles[activeIdx];
      setActiveSubId(activeSub.id);
      if (viewMode === 'subtitles' && pages.length > 0) {
        let page = 0;
        for (let p = pages.length - 1; p >= 0; p--) {
          if (pages[p] <= activeIdx) { page = p; break; }
        }
        if (page !== curPage) setCurPage(page);
      }
    } else {
      setActiveSubId(null);
    }
  }, [findActiveSubtitle, subtitles, viewMode, pages, curPage, setCurPage]);

  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    if (videoTimeRef.current > 0) {
      event.target.seekTo(videoTimeRef.current, true);
      // Обновляем активные субтитры/страницу сразу, даже если видео на паузе.
      setTimeout(syncWithVideo, 300);
    }
  };

  const onPlayerStateChange = (event) => {
    if (event.data === 1) {
      if (playerIntervalRef.current) clearInterval(playerIntervalRef.current);
      playerIntervalRef.current = setInterval(() => {
        syncWithVideo();
        saveCurrentTime();
      }, 500);
    } else {
      if (playerIntervalRef.current) {
        clearInterval(playerIntervalRef.current);
        playerIntervalRef.current = null;
      }
      // Сохраняем позицию и на паузе/остановке, а не только во время игры.
      saveCurrentTime();
    }
  };

  useEffect(() => {
    isMounted.current = true;

    // Восстанавливаем последний использованный режим и время просмотра для этого материала.
    const savedMode = localStorage.getItem(viewModeKey(id));
    setViewMode(savedMode === 'full' ? 'full' : 'subtitles');

    const savedTime = localStorage.getItem(videoTimeKey(id));
    videoTimeRef.current = savedTime !== null ? Number(savedTime) : 0;
    lastSubIndexRef.current = -1;

    const ac = new AbortController();
    apiFetch(`/api/material/${id}`, { signal: ac.signal })
      .then(d => { if (isMounted.current) setMaterial(d); })
      .catch(e => { if (e.name !== 'AbortError' && isMounted.current) setError(String(e)); });
    apiFetch(`/api/subtitles/${id}`, { signal: ac.signal })
      .then(d => { if (isMounted.current) setSubtitles(d); })
      .catch(e => { if (e.name !== 'AbortError' && isMounted.current) setError(String(e)); });
    apiFetch('/api/vocab', { signal: ac.signal })
      .then(d => {
        if (isMounted.current) {
          setSavedWords(d.map(w => ({
            word: w.word ?? '',
            status: w.status,
            sentence_index: w.sentence_index,
            word_indices: w.word_indices,
          })));
        }
      })
      .catch(e => { if (e.name !== 'AbortError') console.error('vocab:', e); });

    return () => {
      isMounted.current = false;
      ac.abort();
      saveCurrentTime();
      if (playerIntervalRef.current) clearInterval(playerIntervalRef.current);
    };
  }, [id]);

  // Дополнительная подстраховка: сохраняем время при уходе со страницы/сворачивании вкладки.
  useEffect(() => {
    const handleBeforeUnload = () => saveCurrentTime();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveCurrentTime();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [saveCurrentTime]);

  const handleWordClick = useCallback(async (word, wordIndex, subId) => {
    const subIndex = subtitles.findIndex(s => s.id === subId);
    if (subIndex === -1) return;
    const sub = subtitles[subIndex];
    const lineText = sub.line_text;
    const words = lineText.split(/\s+/).filter(Boolean);

    if (wordPanel.selectedSentenceIndex === subIndex && wordPanel.selectedWord !== null && !wordPanel.isManualEdit) {
      const newSelected = new Set(wordPanel.selectedIndices);
      newSelected.has(wordIndex) ? newSelected.delete(wordIndex) : newSelected.add(wordIndex);
      if (newSelected.size === 0) { wordPanel.closePanel(); return; }
      const sorted = Array.from(newSelected).sort((a, b) => a - b);
      const phrase = sorted.map(i => words[i]).join(' ').trim();
      wordPanel.setSelectedIndices(newSelected);
      wordPanel.setHighlightedIndices(newSelected);
      wordPanel.setCanonicalWord(phrase);
      wordPanel.setSelectedWord(phrase);
      wordPanel.setTranslationsList([]);
      wordPanel.setSelectedVariant('');
      wordPanel.setManualTranslation('');
      wordPanel.translatePhrase(phrase);
      return;
    }

    const initialSet = new Set([wordIndex]);
    const computedPhrase = word;

    if (playerRef.current?.pauseVideo) playerRef.current.pauseVideo();

    wordPanel.openPanel({
      word,
      sentenceIndex: subIndex,
      sentence: sub.line_text,
      translation: translations[String(subId)] || '',
      token: null,
      reflexive: false,
      indices: initialSet,
      phrase: computedPhrase,
    });
  }, [subtitles, wordPanel, translations]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':      return 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100';
      case 'learning': return 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100';
      case 'known':    return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
      default:         return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
    }
  };

  const renderSubtitleText = useCallback((sub, index, isFullMode = false) => {
    const words = sub.line_text.split(/\s+/).filter(Boolean);
    const isActive = activeSubId === sub.id;

    const highlightMap = new Map();
    savedWords.forEach(sw => {
      if (sw.sentence_index === index && sw.word_indices) {
        sw.word_indices.forEach(idx => highlightMap.set(idx, sw.status));
      }
    });

    return words.map((word, idx) => {
      const normalizedWord = normalizeWord(word);
      const statusFromMap = wordStatusMap.get(normalizedWord);
      const isSavedByWord = !!statusFromMap;
      const isSavedByIndex = highlightMap.has(idx);
      const isSaved = isSavedByIndex || isSavedByWord;
      const status = highlightMap.get(idx) || statusFromMap;

      const isHighlighted = wordPanel.selectedSentenceIndex === index && wordPanel.highlightedIndices.has(idx);

      return (
        <span
          key={`w-${sub.id}-${idx}`}
          onClick={() => handleWordClick(word, idx, sub.id)}
          className={`inline-block px-0.5 cursor-pointer transition-colors ${
            isHighlighted
              ? 'bg-blue-300 dark:bg-blue-700 font-semibold rounded-md'
              : isSaved
              ? `${getStatusColor(status)} font-bold rounded-md`
              : isActive && !isFullMode
              ? 'font-bold hover:bg-yellow-200 dark:hover:bg-yellow-900 hover:rounded-md'
              : 'hover:bg-yellow-200 dark:hover:bg-yellow-900 hover:rounded-md'
          }`}
        >
          {word}
        </span>
      );
    });
  }, [activeSubId, savedWords, handleWordClick, wordPanel.selectedSentenceIndex, wordPanel.highlightedIndices, wordStatusMap]);

  const renderShadowContent = useCallback(() => {
    if (!subtitles.length) return null;
    return (
      <div>
        {subtitles.map((sub) => (
          <div key={sub.id} data-page-item className="mb-4">
            <div className="text-[20px] leading-relaxed">{sub.line_text}</div>
          </div>
        ))}
      </div>
    );
  }, [subtitles]);

  const videoId = material?.youtubeUrl
    ? material.youtubeUrl.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/)?.[1]
    : null;

  if (error)    return <div className="p-8 text-red-600 dark:text-red-400">Ошибка: {error}</div>;
  if (!material) return <div className="p-8 dark:text-gray-100">Загрузка материала...</div>;

  const activeSubtitle = subtitles.find(s => s.id === activeSubId);
  const currentSubtitles = viewMode === 'subtitles' ? subtitles.slice(startIdx, endIdx) : [];

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">

      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 p-4 md:px-8 md:pt-8 md:pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto flex justify-between items-center flex-wrap gap-2">
          <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">← Назад в библиотеку</Link>
          <h2 className="text-2xl font-bold dark:text-white">{material.title}</h2>
          <div className="flex items-center gap-3">
            <span className="text-sm dark:text-gray-300">👋 {user?.username}</span>
            <button onClick={logout} className="text-sm text-red-600 dark:text-red-400 hover:underline">Выйти</button>
            <button
              onClick={switchViewMode}
              className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition dark:text-white"
            >
              {viewMode === 'full' ? '📺 Субтитры' : '📺 Полный экран'}
            </button>
          </div>
        </div>
        {viewMode === 'subtitles' && totalPagesCount > 0 && !isCalc && (
          <div className="max-w-4xl mx-auto mt-2">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${((curPage + 1) / totalPagesCount) * 100}%` }} />
            </div>
          </div>
        )}
      </div>

      {viewMode === 'full' ? (
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="w-full">
            <div className="mb-4 dark:bg-gray-900 rounded-lg overflow-hidden">
              <YouTube
                key="player-full"
                videoId={videoId}
                opts={{ width: '100%', height: '600', playerVars: { modestbranding: 1, rel: 0 } }}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
              />
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 select-none">
              <div className="text-[20px] leading-relaxed text-center dark:text-gray-100">
                {activeSubtitle ? (
                  renderSubtitleText(activeSubtitle, subtitles.indexOf(activeSubtitle), true)
                ) : (
                  <span className="text-gray-400">🎬 Субтитры появятся при воспроизведении</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-hidden min-h-0 p-4 md:px-8 md:pb-8">
            <div className="max-w-4xl mx-auto h-full flex flex-col">
              <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex-1 flex flex-col min-h-0">
                <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
                  <div
                    ref={shadowRef}
                    aria-hidden="true"
                    className="pointer-events-none select-none"
                    style={{ opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, zIndex: -1 }}
                  >
                    {renderShadowContent()}
                  </div>

                  {isCalc ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="animate-pulse text-gray-400 dark:text-gray-500">Верстка страницы...</div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="space-y-4">
                        {currentSubtitles.map((sub, idx) => (
                          <div key={sub.id} className="text-[20px] leading-relaxed dark:text-gray-100">
                            {renderSubtitleText(sub, startIdx + idx, false)}
                          </div>
                        ))}
                      </div>
                      {currentSubtitles.length === 0 && (
                        <p className="text-gray-400 text-center">Нет субтитров на этой странице</p>
                      )}
                    </div>
                  )}
                </div>

                {!isCalc && totalPagesCount > 1 && (
                  <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
                    <button
                      onClick={() => setCurPage(p => Math.max(0, p - 1))}
                      disabled={curPage === 0}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        curPage === 0
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      ← Назад
                    </button>
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {curPage + 1} / {totalPagesCount}
                    </span>
                    <button
                      onClick={() => setCurPage(p => Math.min(totalPagesCount - 1, p + 1))}
                      disabled={curPage === totalPagesCount - 1}
                      className={`px-4 py-2 rounded-lg font-medium transition ${
                        curPage === totalPagesCount - 1
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      Вперед →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {videoId && (
            <div
              ref={videoRef}
              className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border border-gray-300 dark:border-gray-600 overflow-hidden"
              style={{
                top: videoPosition.y,
                left: videoPosition.x,
                width: videoSize.width + 'px',
                height: isVideoMinimized ? '48px' : videoSize.height + 'px'
              }}
              onMouseDown={onDragStart}
              onTouchStart={onDragStart}
            >
              <div
                className="video-drag-handle cursor-move bg-gray-100 dark:bg-gray-700 px-3 py-2 flex justify-between items-center select-none"
                style={{ touchAction: 'none' }}
              >
                <span className="text-sm font-medium dark:text-gray-200">🎬 Видео</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsVideoMinimized(p => !p); }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg leading-none"
                >
                  {isVideoMinimized ? '⤢' : '⤡'}
                </button>
              </div>
              <div style={{ display: isVideoMinimized ? 'none' : 'block', width: '100%', height: '100%' }}>
                <YouTube
                  key="player-sub"
                  videoId={videoId}
                  opts={{
                    width: videoSize.width,
                    height: videoSize.height - 40,
                    playerVars: { modestbranding: 1, rel: 0 }
                  }}
                  onReady={onPlayerReady}
                  onStateChange={onPlayerStateChange}
                />
              </div>
              {isVideoMinimized && (
                <div className="flex items-center justify-center h-8 text-gray-500 dark:text-gray-400 text-sm">Видео свернуто</div>
              )}
              {!isVideoMinimized && (
                <div
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize"
                  onMouseDown={onResizeStart}
                  onTouchStart={onResizeStart}
                  style={{ background: 'transparent', touchAction: 'none' }}
                >
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-r-2 border-b-2 border-gray-400 dark:border-gray-500"></div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {wordPanel.selectedWord && (
        <div className="fixed top-20 right-5 z-50 w-96 max-h-[90vh] overflow-y-auto shadow-2xl rounded-lg">
          <WordPanel
            canonicalWord={wordPanel.canonicalWord}
            wordTranslation={wordPanel.wordTranslation}
            translatingWord={wordPanel.translatingWord}
            translationsList={wordPanel.translationsList}
            manualTranslation={wordPanel.manualTranslation}
            selectedVariant={wordPanel.selectedVariant}
            originalSentence={wordPanel.originalSentence}
            translatedSentence={wordPanel.translatedSentence}
            showContext={wordPanel.showContext}
            selectedToken={wordPanel.selectedToken}
            hasReflexive={wordPanel.hasReflexive}
            onCanonicalChange={(val) => {
              wordPanel.setCanonicalWord(val);
              wordPanel.setIsManualEdit(true);
              if (wordPanel.translateTimeoutRef.current) clearTimeout(wordPanel.translateTimeoutRef.current);
              wordPanel.translateTimeoutRef.current = setTimeout(() => {
                if (val.trim()) wordPanel.translatePhrase(val.trim());
              }, 600);
            }}
            onVariantSelect={(tr) => {
              wordPanel.setSelectedVariant(tr);
              wordPanel.setWordTranslation(tr);
              wordPanel.setManualTranslation(tr);
            }}
            onManualChange={(val) => {
              wordPanel.setManualTranslation(val);
              wordPanel.setWordTranslation(val);
              wordPanel.setSelectedVariant('');
            }}
            onSave={wordPanel.handleSaveWord}
            onClose={wordPanel.closePanel}
            onToggleContext={() => wordPanel.setShowContext(!wordPanel.showContext)}
          />
        </div>
      )}
    </div>
  );
}