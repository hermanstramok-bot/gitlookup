import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
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

const BOOKMODE_RANGE = 20;

// --- Ключи localStorage для персистентности режима/позиции на книгу ---
const modeKey = (id) => `reader_last_mode_${id}`;
const bookPosKey = (id) => `reader_pos_book_${id}`;
const studyPosKey = (id) => `reader_pos_study_${id}`;

export default function Reader() {
  const { id } = useParams();
  const { user, logout } = useAuth();
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);
  // Дефолт при самом первом запуске (нет сохранённых данных) — Study Mode.
  const [bookMode, setBookMode] = useState(false);
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

  const { translations } = useTranslations(visibleSentences, id);

  useEffect(() => {
    localStorage.setItem('reader_show_translations', String(showTranslations));
  }, [showTranslations]);

  // При открытии книги (смена id) — восстанавливаем последний использованный
  // режим для ЭТОЙ книги и запоминаем, на какую позицию нужно перейти,
  // как только режим будет готов к навигации.
  useEffect(() => {
    fetchText();

    const savedMode = localStorage.getItem(modeKey(id));
    const initialBookMode = savedMode === 'book';
    setBookMode(initialBookMode);

    if (initialBookMode) {
      const savedPos = localStorage.getItem(bookPosKey(id));
      pendingSentenceRef.current = savedPos !== null ? Number(savedPos) : 0;
      pendingPageRef.current = null;
    } else {
      const savedPos = localStorage.getItem(studyPosKey(id));
      pendingPageRef.current = savedPos !== null ? Number(savedPos) : 0;
      pendingSentenceRef.current = null;
    }

    return () => { if (window.speechSynthesis) window.speechSynthesis.cancel(); };
  }, [id]);

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
    if (bookMode && isReady) {
      localStorage.setItem(bookPosKey(id), String(currentSentenceIndex));
    }
  }, [bookMode, isReady, currentSentenceIndex, id]);

  useEffect(() => {
    if (!bookMode && !isCalculating) {
      localStorage.setItem(studyPosKey(id), String(currentPage));
    }
  }, [bookMode, isCalculating, currentPage, id]);

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
      const statusFromMap = wordStatusMap.get(normalizedWord);
      const isSaved = highlightMap.has(wordIndex) || !!statusFromMap;
      const status = highlightMap.get(wordIndex) || statusFromMap;

      const isHighlighted = wordPanel.selectedSentenceIndex === globalSentenceIndex && wordPanel.highlightedIndices.has(wordIndex);
      return (
        <span
          key={`w-${globalSentenceIndex}-${wordIndex}`}
          onClick={() => handleWordClick(word, wordIndex, globalSentenceIndex)}
          className={`inline-block px-0.5 cursor-pointer transition-colors ${
            isHighlighted
              ? 'bg-blue-300 dark:bg-blue-700 font-semibold rounded-md px-1 dark:text-white' // FIX: добавлен светлый текст
              : isSaved
              ? `${getStatusColor(status)} font-bold rounded-md px-1`
              : 'hover:bg-yellow-200 dark:hover:bg-yellow-900 hover:rounded-md dark:text-gray-200' // FIX: добавлен цвет для тёмной темы
          }`}
        >
          {word}
        </span>
      );
    });
  }, [savedWords, wordPanel.selectedSentenceIndex, wordPanel.highlightedIndices, handleWordClick, wordStatusMap]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'new':      return 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100';
      case 'learning': return 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100';
      case 'known':    return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
      default:         return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
    }
  };

  const renderShadowContent = useCallback(() => {
    if (!text?.sentences) return null;
    return (
      <div>
        {text.sentences.map((sentence, idx) => (
          <div key={sentence.id} data-page-item className="mb-4">
            <div className="text-[20px]">{sentence.text}</div>
          </div>
        ))}
      </div>
    );
  }, [text]);

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
      localStorage.setItem(bookPosKey(id), String(startIndex));
    } else {
      // Book -> Study: находим страницу, содержащую текущее предложение
      const page = findPageForSentence(currentSentenceIndex);
      const safePage = page !== -1 ? page : 0;
      pendingPageRef.current = safePage;
      pendingSentenceRef.current = null;
      localStorage.setItem(studyPosKey(id), String(safePage));
    }

    localStorage.setItem(modeKey(id), newBookMode ? 'book' : 'study');
    setBookMode(newBookMode);
  };

  if (loading) return <div className="p-8 dark:text-gray-100 text-center">Загрузка...</div>;
  if (!text) return <div className="p-8 dark:text-gray-100 text-center">Текст не найден</div>;

  return (
    <div className="h-screen w-full bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 bg-gray-50 dark:bg-gray-900 p-4 md:px-8 md:pt-8 md:pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
            <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline inline-block">
              ← Назад в библиотеку
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-sm dark:text-gray-300">👋 {user?.username}</span>
              <button
                onClick={logout}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Выйти
              </button>
              {/* FIX: добавлен dark:text-white для кнопки Book Mode */}
              <button
                onClick={handleToggleMode}
                className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition dark:text-white"
              >
                {bookMode ? '📖 Study Mode' : '📚 Book Mode'}
              </button>
              {!bookMode && (
                /* FIX: добавлен dark:text-white для кнопки Показать переводы */
                <button
                  onClick={() => setShowTranslations(prev => !prev)}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition dark:text-white"
                >
                  {showTranslations ? 'Скрыть переводы' : 'Показать переводы'}
                </button>
              )}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(prev => !prev)}
                  className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded-lg text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition flex items-center gap-1"
                >
                  📑 {bookmarks.length > 0 && (
                    <span className="text-xs bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                      {bookmarks.length}
                    </span>
                  )}
                </button>
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 max-h-60 overflow-y-auto z-10">
                    {bookmarks.length === 0 ? (
                      <div className="p-3 text-gray-500 dark:text-gray-400 text-sm">Нет закладок</div>
                    ) : (
                      <ul>
                        {bookmarks.map((bm) => (
                          <li
                            key={bm.sentenceIndex}
                            onClick={() => goToBookmark(bm.sentenceIndex)}
                            className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-0 flex items-center justify-between"
                          >
                            <span className="text-sm truncate flex-1">
                              {bm.text || `Предложение ${bm.sentenceIndex + 1}`}
                            </span>
                            <button
                              onClick={(e) => handleRemoveBookmark(bm.sentenceIndex, e)}
                              className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                              title="Удалить закладку"
                            >
                              🗑️
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

          <h1 className="text-3xl font-bold mb-1 dark:text-white">{text.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">Тип: {text.type}</p>
          {!bookMode && (
            <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
              💡 Кликните по словам, чтобы составить фразу
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
              label={bookMode ? 'предложений' : 'страниц'}
            />
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden min-h-0 p-4 md:px-8 md:pb-8">
        <div className="max-w-4xl mx-auto h-full flex flex-col">
          <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 flex-1 flex flex-col min-h-0 relative">
            <button
              onClick={handleToggleBookmark}
              className="absolute top-3 right-4 text-2xl text-gray-400 hover:text-yellow-500 transition-colors z-10"
              title={hasBookmark ? 'Удалить закладку' : 'Добавить закладку'}
            >
              {hasBookmark ? '⭐' : '☆'}
            </button>

            <div ref={containerRef} className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
              <div
                ref={shadowRef}
                aria-hidden="true"
                className="pointer-events-none select-none"
                style={{ opacity: 0, position: 'absolute', top: 0, left: 0, right: 0, zIndex: -1 }}
              >
                {renderShadowContent()}
              </div>

              {bookMode ? (
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