import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import WordPanel from '../components/WordPanel';
import BookMode from '../components/BookMode';
import StudyMode from '../components/StudyMode';
import NavigationSlider from '../components/NavigationSlider';
import { useBookmarks } from '../hooks/useBookmarks';
import { useWords } from '../hooks/useWords';
import { useSpeech } from '../hooks/useSpeech';
import { useWordPanel } from '../hooks/useWordPanel';
import { useTranslations } from '../hooks/useTranslations';
import { useReaderScroll } from '../hooks/useReaderScroll';
import { usePagination } from '../hooks/usePagination';
import { normalizeWord } from '../utils/normalizeWord';
import MaterialCompletionView from '../components/MaterialCompletionView';
import LiveWordDictionary from '../components/LiveWordDictionary';
import { useI18n } from '../context/I18nContext';
import {
  sans, serif, useLibraryFonts,
  IconArrowLeft, IconBookmark, IconTrash,
} from '../design/designSystem';

const BOOKMODE_RANGE = 20;

// --- Ключи localStorage для персистентности режима/позиции на книгу ---
const modeKey = (id) => `reader_last_mode_${id}`;
const bookPosKey = (id) => `reader_pos_book_${id}`;
const studyPosKey = (id) => `reader_pos_study_${id}`;

// Spec 2 (доп., п.10): язык перевода — настоящая настройка (Settings.jsx).
const getTranslationLang = () => localStorage.getItem('translationLang') || 'ru';
const getTargetLang = () => localStorage.getItem('targetLang') || 'de';

export default function Reader() {
  const { t } = useI18n();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const reviewMode = searchParams.get('mode') === 'review';
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);
  // Дефолт при самом первом запуске (нет сохранённых данных) — Study Mode.
  const [bookMode, setBookMode] = useState(false);
  // Spec 2 (доп., п.10): targetLang/translationLang настраиваются в
  // Settings.jsx и хранятся в localStorage; слушаем изменения, чтобы
  // подхватить их без перезагрузки, если пользователь поменял их в другой вкладке.
  const [targetLang, setTargetLangState] = useState(getTargetLang);
  const [translationLang, setTranslationLang] = useState(getTranslationLang);
  useEffect(() => {
    const syncSettings = () => {
      setTargetLangState(getTargetLang());
      setTranslationLang(getTranslationLang());
    };
    window.addEventListener('storage', syncSettings);
    window.addEventListener('targetLangChange', syncSettings);
    window.addEventListener('interfaceLangChange', syncSettings);
    return () => {
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('targetLangChange', syncSettings);
      window.removeEventListener('interfaceLangChange', syncSettings);
    };
  }, []);

  const [showTranslations, setShowTranslations] = useState(() => {
    const saved = localStorage.getItem('reader_show_translations');
    return saved !== null ? saved === 'true' : false;
  });

  const containerRef = useRef(null);
  const shadowRef = useRef(null);
  const dropdownRef = useRef(null);

  // Отложенная позиция, которую нужно применить, как только соответствующий
  // режим будет готов (после загрузки текста, пагинации или скролла).
  const pendingSentenceRef = useRef(null); // для Book Mode
  const pendingPageRef = useRef(null);     // для Study Mode

  // ============================================================
  // SPEC 2 (доп.): встроенный экран завершения материала + статус материала
  // ============================================================
  // Снимок статусов слов материала на момент начала чтения (vocabId -> status).
  // Нужен, чтобы на экране сводки показать, какие слова изменились именно
  // за эту сессию чтения (не за всё время существования материала).
  const sessionStartWordsRef = useRef(null);
  const [materialStatus, setMaterialStatus] = useState(null);
  const [justTransitioned, setJustTransitioned] = useState(false); // new -> viewed произошло в этой сессии
  const [celebrationConsumed, setCelebrationConsumed] = useState(false);
  const atEndHandledRef = useRef(false); // защита от повторного срабатывания перехода статуса за сессию

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/materials/${id}/words`)
      .then(data => {
        if (cancelled) return;
        const map = new Map();
        (data.words || []).forEach(w => map.set(w.vocabId, w.status));
        sessionStartWordsRef.current = map;
      })
      .catch(err => console.error('Ошибка загрузки снимка слов материала:', err));
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    atEndHandledRef.current = false;
    setJustTransitioned(false);
    setCelebrationConsumed(false);
    apiFetch(`/api/material/${id}`)
      .then(data => { if (!cancelled) setMaterialStatus(data.status || 'new'); })
      .catch(err => console.error('Ошибка загрузки статуса материала:', err));
    return () => { cancelled = true; };
  }, [id]);

  const { savedWords, setSavedWords, wordStatusMap } = useWords();
  const { speechSupported, speakingIdx, speak } = useSpeech();
  const wordPanel = useWordPanel(id, savedWords, setSavedWords);
  const { bookmarks, showDropdown, setShowDropdown, addOrRemove, remove } = useBookmarks(id);

  const {
    currentSentenceIndex,
    scrollToSentence,
    isReady,
  } = useReaderScroll({
    materialId: id,
    totalSentences: text?.sentences?.length || 0,
    containerRef,
    enabled: bookMode,
  });

  const {
    pageStartIndices,
    currentPage,
    setCurrentPage,
    isCalculating,
    totalPages,
    startIndex,
    endIndex,
    findPageForSentence,
    waitForLayout,
  } = usePagination({
    text,
    bookMode,
    showTranslations,
    materialId: id,
    wrapperRef: containerRef,
    shadowRef,
    enabled: !bookMode,
  });

  const total = text?.sentences?.length || 0;

  // ============================================================
  // SPEC 2 (доп.): детект "дочитал до конца материала"
  // Study Mode — последняя страница пагинации; Book Mode — долистал
  // (доскроллил) до последнего предложения текста.
  // ============================================================
  const isAtEnd = bookMode
    ? (total > 0 && currentSentenceIndex >= total - 1)
    : (!isCalculating && totalPages > 0 && currentPage >= totalPages - 1);

  // Spec 2 (доп., п.6.3): Review-страница — не точка невозврата. Пользователь
  // может вручную вернуться к тексту (не потеряв позицию — он остаётся на
  // последней странице) и потом вернуться обратно к словам. viewingCompletion
  // отражает только это ручное переключение; сам факт isAtEnd не трогаем.
  const [viewingCompletion, setViewingCompletion] = useState(false);
  useEffect(() => {
    setViewingCompletion(isAtEnd);
  }, [isAtEnd]);

  const showCompletionView = isAtEnd && viewingCompletion && materialStatus !== null;

  // При первом достижении конца материала за сессию — если материал ещё
  // никогда не был дочитан (status === 'new'), помечаем его "viewed" и
  // показываем celebration-фазу ровно один раз за сессию.
  useEffect(() => {
    if (!isAtEnd || atEndHandledRef.current) return;
    atEndHandledRef.current = true;
    if (materialStatus === 'new') {
      apiFetch(`/api/materials/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'viewed' }) })
        .then(() => {
          setMaterialStatus('viewed');
          setJustTransitioned(true);
        })
        .catch(err => console.error('Ошибка обновления статуса материала:', err));
    }
  }, [showCompletionView, materialStatus, id]);

  const visibleSentences = useMemo(() => {
    if (!text?.sentences || total === 0) return [];

    if (bookMode) {
      const start = Math.max(0, currentSentenceIndex - BOOKMODE_RANGE);
      const end = Math.min(total, currentSentenceIndex + BOOKMODE_RANGE + 1);
      return text.sentences.slice(start, end);
    } else {
      const pageSize = endIndex - startIndex + 1;
      const prevStart = Math.max(0, startIndex - pageSize);
      const nextEnd = Math.min(total, endIndex + pageSize);
      return text.sentences.slice(prevStart, nextEnd);
    }
  }, [text, bookMode, currentSentenceIndex, startIndex, endIndex, total]);

  const { translations } = useTranslations(visibleSentences, id, targetLang, translationLang);

  useEffect(() => {
    localStorage.setItem('reader_show_translations', String(showTranslations));
  }, [showTranslations]);

  // Страница сама занимает весь экран (h-screen) и скроллит только внутри
  // себя — но т.к. она вложена в общий Layout с Header/Footer, суммарная
  // высота документа превышает 100vh и браузер добавляет лишний скроллбар
  // справа. Блокируем скролл body, пока эта страница смонтирована.
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // При открытии книги (смена id) — восстанавливаем последний использованный
  // режим для ЭТОЙ книги и запоминаем, на какую позицию нужно перейти,
  // как только режим будет готов к навигации.
  useEffect(() => {
    fetchText();

    const savedMode = localStorage.getItem(modeKey(id));
    const initialBookMode = savedMode === 'book';
    setBookMode(initialBookMode);

    // Spec 2 (доп.): review-режим всегда открывает материал с самого начала,
    // игнорируя сохранённую позицию обычного чтения.
    if (initialBookMode) {
      const savedPos = reviewMode ? null : localStorage.getItem(bookPosKey(id));
      pendingSentenceRef.current = savedPos !== null ? Number(savedPos) : 0;
      pendingPageRef.current = null;
    } else {
      const savedPos = reviewMode ? null : localStorage.getItem(studyPosKey(id));
      pendingPageRef.current = savedPos !== null ? Number(savedPos) : 0;
      pendingSentenceRef.current = null;
    }

    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  }, [id, reviewMode]);

  // Применяем отложенную позицию для Book Mode, как только скролл готов.
  useEffect(() => {
    if (bookMode && isReady && pendingSentenceRef.current !== null) {
      const target = pendingSentenceRef.current;
      pendingSentenceRef.current = null;
      scrollToSentence(target);
    }
  }, [bookMode, isReady, scrollToSentence]);

  // Применяем отложенную позицию для Study Mode, как только пагинация готова.
  useEffect(() => {
    if (!bookMode && !isCalculating && pendingPageRef.current !== null && totalPages > 0) {
      const target = Math.max(0, Math.min(pendingPageRef.current, totalPages - 1));
      pendingPageRef.current = null;
      setCurrentPage(target);
    }
  }, [bookMode, isCalculating, totalPages, setCurrentPage]);

  // Непрерывно сохраняем текущую позицию для активного режима, чтобы при
  // следующем открытии книги (или после перезагрузки) продолжить с того же места.
  useEffect(() => {
    if (bookMode && isReady && !reviewMode) {
      localStorage.setItem(bookPosKey(id), String(currentSentenceIndex));
    }
  }, [bookMode, isReady, currentSentenceIndex, id, reviewMode]);

  useEffect(() => {
    if (!bookMode && !isCalculating && !reviewMode) {
      localStorage.setItem(studyPosKey(id), String(currentPage));
    }
  }, [bookMode, isCalculating, currentPage, id, reviewMode]);

  const fetchText = async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/texts/${id}`);

      const sentences = data.sentences.map((s, idx) => {
        let text = '';
        if (typeof s === 'string') {
          text = s;
        } else if (s && typeof s === 'object') {
          const keys = Object.keys(s).filter(k => !isNaN(k) && k !== 'id');
          if (keys.length > 0) {
            const chars = keys.sort((a, b) => Number(a) - Number(b)).map(k => s[k]);
            text = chars.join('');
          } else if (s.text) {
            text = s.text;
          } else if (s.original) {
            text = s.original;
          }
        }
        return {
          id: `${id}-${idx}`,
          text: text,
          original: text,
          words: text.split(/[\s\n\r\t\u00A0]+/).filter(Boolean),
        };
      });

      data.sentences = sentences;

      if (data.paragraphs?.length) {
        let sentenceIndex = 0;
        data.paragraphs = data.paragraphs.map(paragraph =>
          paragraph.map(() => sentences[sentenceIndex++])
        );
      }

      setText(data);
    } catch (err) {
      console.error('Error fetching text:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleWordClick = useCallback((word, wordIndex, globalSentenceIndex) => {
    if (!text.sentences?.[globalSentenceIndex]) return;
    const sentence = text.sentences[globalSentenceIndex];
    const words = Array.isArray(sentence.words)
      ? sentence.words
      : (sentence.text ? sentence.text.split(/[\s\n\r\t\u00A0]+/).filter(Boolean) : []);
    if (!words.length) return;

    const analysis = sentence.analysis || [];

    if (wordPanel.selectedSentenceIndex === globalSentenceIndex && wordPanel.selectedWord !== null && !wordPanel.isManualEdit) {
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

    let computedPhrase = '';
    let initialSet = new Set([wordIndex]);
    let token = null;
    let reflexiveDetected = false;

    if (analysis.length > 0 && analysis[wordIndex]) {
      token = analysis[wordIndex];
      if (token.dep === 'svp') {
        const headToken = analysis.find(t => t.id === token.head);
        if (headToken) {
          token = headToken;
          initialSet = new Set([analysis.indexOf(headToken)]);
        }
      }
      if (token.pos === 'VERB' || token.pos === 'AUX') {
        analysis.filter(t => t.dep === 'svp' && t.head === token.id)
          .forEach(t => initialSet.add(analysis.indexOf(t)));
        const reflexive = analysis.find(t =>
          t.text.toLowerCase() === 'sich' && t.head === token.id &&
          (t.dep === 'ob' || t.dep === 'expl')
        );
        if (reflexive) { reflexiveDetected = true; initialSet.add(analysis.indexOf(reflexive)); }
      }
      const sorted = Array.from(initialSet).sort((a, b) => a - b);
      computedPhrase = sorted.map(i => words[i]).join(' ').trim();
    } else {
      computedPhrase = word.replace(/^[^\p{L}\p{N}\-']+|[^\p{L}\p{N}\-']+$/gu, '');
    }

    wordPanel.openPanel({
      word,
      sentenceIndex: globalSentenceIndex,
      sentence: sentence.original,
      translation: translations[sentence.id] || '',
      token,
      reflexive: reflexiveDetected,
      indices: initialSet,
      phrase: computedPhrase,
    });
  }, [text, wordPanel, translations]);

  // --- Рендер слов с исправлением цвета для тёмной темы ---
  const renderWords = useCallback((sentence, globalSentenceIndex) => {
    let words = [];
    if (Array.isArray(sentence.words)) {
      words = sentence.words;
    } else if (sentence.text) {
      words = sentence.text.split(/[\s\n\r\t\u00A0]+/).filter(Boolean);
    } else {
      const keys = Object.keys(sentence).filter(k => !isNaN(k) && k !== 'id');
      if (keys.length > 0) {
        const chars = keys.sort((a, b) => Number(a) - Number(b)).map(k => sentence[k]);
        const fullText = chars.join('');
        words = fullText.split(/[\s\n\r\t\u00A0]+/).filter(Boolean);
      } else {
        words = [];
      }
    }

    const highlightMap = new Map();
    savedWords.forEach(sw => {
      if (sw.sentence_index === globalSentenceIndex && sw.word_indices) {
        sw.word_indices.forEach(idx => highlightMap.set(idx, sw.status));
      }
    });

    return words.map((word, wordIndex) => {
      if (!word) return null;
      if (/^[.,!?;:()"']+$/.test(word)) {
        return <span key={`p-${globalSentenceIndex}-${wordIndex}`}>{word}</span>;
      }

      const normalizedWord = normalizeWord(word);
      // Spec 1: слово, пропущенное в этом материале, всегда рендерится как
      // обычный текст — статус (New/Learning/Known) игнорируется только
      // локально, здесь, глобальный словарь не трогаем.
      const isSkipped = wordPanel.isWordSkipped(normalizedWord);
      const statusFromMap = isSkipped ? undefined : wordStatusMap.get(normalizedWord);
      const isSaved = !isSkipped && (highlightMap.has(wordIndex) || !!statusFromMap);
      const status = isSkipped ? undefined : (highlightMap.get(wordIndex) || statusFromMap);

      const isHighlighted = wordPanel.selectedSentenceIndex === globalSentenceIndex && wordPanel.highlightedIndices.has(wordIndex);
      return (
        <span
          key={`w-${globalSentenceIndex}-${wordIndex}`}
          onClick={() => handleWordClick(word, wordIndex, globalSentenceIndex)}
          className={`inline-block px-0.5 cursor-pointer transition-colors ${
            isHighlighted
              ? 'bg-[#3D5A80]/30 dark:bg-[#3D5A80]/50 font-semibold rounded-md px-1 text-[#0F1720] dark:text-white'
              : isSaved
              ? `${getStatusColor(status)} font-bold rounded-md px-1`
              : 'hover:bg-[#E9C46A]/30 dark:hover:bg-[#E9C46A]/20 hover:rounded-md text-[#3D3B36] dark:text-[#D8D3C9]'
          }`}
        >
          {word}
        </span>
      );
    });
  }, [savedWords, wordPanel.selectedSentenceIndex, wordPanel.highlightedIndices, handleWordClick, wordStatusMap, wordPanel.skippedWords]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':      return 'bg-blue-500 text-white dark:bg-blue-500 dark:text-white';
      case 'learning': return 'bg-yellow-500 text-white dark:bg-yellow-500 dark:text-white';
      case 'known':    return 'bg-green-500 text-white dark:bg-green-500 dark:text-white';
      default:         return 'bg-green-500 text-white dark:bg-green-500 dark:text-white';
    }
  };

  // Тень для измерения высоты страниц ДОЛЖНА рендериться теми же элементами,
  // что и StudyMode (иконка озвучки + border-l-4 pl-4 + per-word span'ы из
  // renderWords) — иначе измеренная высота не совпадает с настоящей (spans с
  // паддингом и более узкая из-за иконки колонка текста переносятся иначе),
  // и последняя строка страницы обрезается контейнером с overflow-hidden.
  const renderShadowContent = useCallback(() => {
    if (!text?.sentences) return null;
    return (
      <div>
        {text.sentences.map((sentence, idx) => (
          <div key={sentence.id} data-page-item className="mb-4">
            <div className="flex items-start gap-2">
              {speechSupported && (
                <span className="flex-shrink-0 mt-1">🔊</span>
              )}
              <div className="flex-1 border-l-4 border-gray-200 dark:border-gray-600 pl-4">
                <p className="text-[20px]">{renderWords(sentence, idx)}</p>
                {showTranslations && (
                  <div className="text-sm mt-1 min-h-[1.5rem]">
                    {translations[sentence.id] || ' '}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }, [text, renderWords, speechSupported, showTranslations, translations]);

  const hasBookmark = bookmarks.some(b => b.sentenceIndex === (bookMode ? currentSentenceIndex : startIndex));
  const handleToggleBookmark = () => {
    const idx = bookMode ? currentSentenceIndex : startIndex;
    const textPreview = text?.sentences[idx]?.original?.slice(0, 50) || '';
    addOrRemove(idx, textPreview);
  };
  const handleRemoveBookmark = (sentenceIndex, e) => {
    e.stopPropagation();
    remove(sentenceIndex);
  };
  const goToBookmark = (sentenceIndex) => {
    if (bookMode) {
      scrollToSentence(sentenceIndex);
    } else {
      const page = findPageForSentence(sentenceIndex);
      if (page !== -1) setCurrentPage(page);
    }
    setShowDropdown(false);
  };

  // Переключение режима с сохранением места, на котором остановился пользователь.
  // Позиция конвертируется между "единицами" разных режимов:
  // Study Mode оперирует страницами, Book Mode — индексом предложения.
  const handleToggleMode = () => {
    const newBookMode = !bookMode;

    if (newBookMode) {
      // Study -> Book: берём первое предложение текущей страницы
      pendingSentenceRef.current = startIndex;
      pendingPageRef.current = null;
      if (!reviewMode) localStorage.setItem(bookPosKey(id), String(startIndex));
    } else {
      // Book -> Study: находим страницу, содержащую текущее предложение
      const page = findPageForSentence(currentSentenceIndex);
      const safePage = page !== -1 ? page : 0;
      pendingPageRef.current = safePage;
      pendingSentenceRef.current = null;
      if (!reviewMode) localStorage.setItem(studyPosKey(id), String(safePage));
    }

    localStorage.setItem(modeKey(id), newBookMode ? 'book' : 'study');
    setBookMode(newBookMode);
  };

  useLibraryFonts();

  if (loading) return (
    <div className="h-screen w-full bg-[#F2F4F7] dark:bg-[#0F172A] flex items-center justify-center text-[#8B8378] dark:text-[#8B8F97] text-sm" style={sans}>
      {t('common_loading')}
    </div>
  );
  if (!text) return (
    <div className="h-screen w-full bg-[#F2F4F7] dark:bg-[#0F172A] flex items-center justify-center text-[#8B8378] dark:text-[#8B8F97] text-sm" style={sans}>
      {t('reader_text_not_found')}
    </div>
  );

  return (
    <div className="h-screen w-full bg-[#F2F4F7] dark:bg-[#0F172A] flex flex-col overflow-hidden transition-colors duration-300" style={sans}>
      <div className="flex-shrink-0 bg-[#F2F4F7] dark:bg-[#0F172A] p-4 md:px-8 md:pt-8 md:pb-4 border-b border-[#EDE9E1] dark:border-[#2A3644]">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#8B8378] dark:text-[#8B8F97] hover:text-[#3D5A80] dark:hover:text-[#8AAFD9] transition"
            >
              <IconArrowLeft className="w-4 h-4" /> {t('common_back_to_library')}
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMode}
                className="bg-white dark:bg-[#1A2430] border border-[#DCD7CC] dark:border-[#3A4756] text-[#3D3B36] dark:text-[#D8D3C9] font-medium text-sm py-1.5 px-3.5 rounded-full hover:bg-[#F7F5F0] dark:hover:bg-[#233040] transition shadow-sm"
              >
                {bookMode ? t('reader_mode_switch_to_study') : t('reader_mode_switch_to_book')}
              </button>
              {!bookMode && (
                <button
                  onClick={() => setShowTranslations(prev => !prev)}
                  className="bg-white dark:bg-[#1A2430] border border-[#DCD7CC] dark:border-[#3A4756] text-[#3D3B36] dark:text-[#D8D3C9] font-medium text-sm py-1.5 px-3.5 rounded-full hover:bg-[#F7F5F0] dark:hover:bg-[#233040] transition shadow-sm"
                >
                  {showTranslations ? t('common_hide_translations') : t('common_show_translations')}
                </button>
              )}
              <LiveWordDictionary materialId={id} />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(prev => !prev)}
                  className="bg-white dark:bg-[#1A2430] border border-[#DCD7CC] dark:border-[#3A4756] text-[#3D3B36] dark:text-[#D8D3C9] font-medium text-sm py-1.5 px-3 rounded-full hover:bg-[#F7F5F0] dark:hover:bg-[#233040] transition flex items-center gap-1.5 shadow-sm"
                >
                  <IconBookmark className="w-4 h-4" />
                  {bookmarks.length > 0 && (
                    <span className="text-[11px] font-semibold bg-[#3D5A80] text-white rounded-full w-5 h-5 flex items-center justify-center">
                      {bookmarks.length}
                    </span>
                  )}
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-[#1A2430] rounded-2xl shadow-xl border border-[#EDE9E1] dark:border-[#2A3644] max-h-60 overflow-y-auto z-10">
                    {bookmarks.length === 0 ? (
                      <div className="p-4 text-[#8B8378] dark:text-[#8B8F97] text-sm">{t('reader_bookmarks_empty')}</div>
                    ) : (
                      <ul>
                        {bookmarks.map((bm) => (
                          <li
                            key={bm.sentenceIndex}
                            onClick={() => goToBookmark(bm.sentenceIndex)}
                            className="px-4 py-2.5 hover:bg-[#F7F5F0] dark:hover:bg-[#233040] cursor-pointer border-b border-[#EDE9E1] dark:border-[#2A3644] last:border-0 flex items-center justify-between transition"
                          >
                            <span className="text-sm truncate flex-1 text-[#3D3B36] dark:text-[#D8D3C9]">
                              {bm.text || t('reader_sentence_placeholder', { n: bm.sentenceIndex + 1 })}
                            </span>
                            <button
                              onClick={(e) => handleRemoveBookmark(bm.sentenceIndex, e)}
                              className="text-[#B4AEA2] dark:text-[#5A6472] hover:text-[#C1666B] transition-colors ml-2 flex-shrink-0"
                              title={t('reader_bookmark_remove_title')}
                            >
                              <IconTrash className="w-3.5 h-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold mb-1 text-[#0F1720] dark:text-white" style={serif}>{text.title}</h1>
          <p className="text-[#8B8378] dark:text-[#8B8F97] text-sm mb-2">{t('reader_type_label', { type: text.type })}</p>
          {!bookMode && (
            <p className="text-[#B4AEA2] dark:text-[#5A6472] text-xs mb-3">
              {t('reader_click_words_hint')}
            </p>
          )}

          {total > 0 && (
            <NavigationSlider
              total={bookMode ? total : totalPages}
              currentIndex={bookMode ? currentSentenceIndex : currentPage}
              onNavigate={(index) => {
                if (bookMode) {
                  scrollToSentence(index);
                } else {
                  setCurrentPage(index);
                }
              }}
              label={bookMode ? t('reader_nav_label_sentences') : t('reader_nav_label_pages')}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0 p-4 md:px-8 md:pb-8">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="bg-white dark:bg-[#1A2430] p-6 md:p-8 rounded-2xl border border-[#EDE9E1] dark:border-[#2A3644] shadow-[0_1px_2px_rgba(15,23,32,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] flex-1 flex flex-col min-h-0 relative">
            {!showCompletionView && (
              <button
                onClick={handleToggleBookmark}
                className="absolute top-3 right-4 z-10 p-1.5 rounded-lg text-[#B4AEA2] dark:text-[#5A6472] hover:text-[#E9C46A] hover:bg-[#F7F5F0] dark:hover:bg-[#233040] transition-colors"
                title={hasBookmark ? t('reader_bookmark_remove_title') : t('reader_bookmark_add_title')}
              >
                <IconBookmark className="w-5 h-5" filled={hasBookmark} />
              </button>
            )}

            {/* Spec 2 (доп., п.6.3): Review-страница не точка невозврата —
                можно вручную вернуться к тексту (кнопка "← Назад" внутри
                MaterialCompletionView, та же, что и для листания страниц)
                и обратно к словам. */}
            {isAtEnd && !viewingCompletion && (
              <button
                onClick={() => setViewingCompletion(true)}
                className="absolute top-3 left-4 z-10 inline-flex items-center gap-1 text-xs font-medium text-[#8B8378] dark:text-[#8B8F97] hover:text-[#3D5A80] dark:hover:text-[#8AAFD9] transition"
              >
                {t('reader_to_words')}
              </button>
            )}

            <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
              <div
                ref={shadowRef}
                aria-hidden="true"
                className="pointer-events-none select-none"
                style={{ opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, zIndex: -1 }}
              >
                {renderShadowContent()}
              </div>

              {showCompletionView ? (
                <MaterialCompletionView
                  materialId={id}
                  materialStatus={materialStatus}
                  justCompleted={justTransitioned && !celebrationConsumed}
                  reviewMode={reviewMode}
                  sessionStartWords={sessionStartWordsRef.current}
                  onStatusChange={setMaterialStatus}
                  onCelebrationDone={() => setCelebrationConsumed(true)}
                  onBack={() => setViewingCompletion(false)}
                />
              ) : bookMode ? (
                <BookMode text={text} renderWords={renderWords} />
              ) : (
                <StudyMode
                  text={text}
                  renderWords={renderWords}
                  translations={translations}
                  showTranslations={showTranslations}
                  speechSupported={speechSupported}
                  speakingIdx={speakingIdx}
                  onSpeak={speak}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  setCurrentPage={setCurrentPage}
                  isCalculating={isCalculating}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {wordPanel.selectedWord && (
        <div className="fixed top-20 right-5 z-50 w-96 max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl border border-[#EDE9E1] dark:border-[#2A3644]">
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
            isSkipped={wordPanel.isWordSkipped(wordPanel.canonicalWord)}
            isSaved={!!wordStatusMap.get(normalizeWord(wordPanel.canonicalWord)) || wordPanel.isWordSkipped(wordPanel.canonicalWord)}
            onToggleSkip={() => wordPanel.toggleSkipWord(wordPanel.canonicalWord)}
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