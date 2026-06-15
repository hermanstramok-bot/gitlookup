import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import WordPanel from '../components/WordPanel';

const SENTENCES_PER_PAGE = 10;

export default function Reader() {
  const { id } = useParams();
  const [text, setText] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(null);
  const [originalSentence, setOriginalSentence] = useState('');
  const [translatedSentence, setTranslatedSentence] = useState('');
  const [canonicalWord, setCanonicalWord] = useState('');
  const [wordTranslation, setWordTranslation] = useState('');
  const [savedWords, setSavedWords] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [hasReflexive, setHasReflexive] = useState(false);
  const [highlightedIndices, setHighlightedIndices] = useState(new Set());
  const [showContext, setShowContext] = useState(false);
  const [translatingWord, setTranslatingWord] = useState(false);
  const [selectedIndices, setSelectedIndices] = useState(new Set());
  const [isManualEdit, setIsManualEdit] = useState(false);
  const [translationsList, setTranslationsList] = useState([]);
  const [manualTranslation, setManualTranslation] = useState('');
  const [selectedVariant, setSelectedVariant] = useState('');
  const translateTimeoutRef = useRef(null);

  // Пагинация
  const [currentPage, setCurrentPage] = useState(0);
  const totalPages = text?.sentences ? Math.ceil(text.sentences.length / SENTENCES_PER_PAGE) : 0;
  const startIndex = currentPage * SENTENCES_PER_PAGE;
  const endIndex = startIndex + SENTENCES_PER_PAGE;
  const currentSentences = text?.sentences?.slice(startIndex, endIndex) || [];

  // Состояния для озвучивания
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const utteranceRef = useRef(null);

  // Проверка поддержки Web Speech API
  useEffect(() => {
    if (!window.speechSynthesis) setSpeechSupported(false);
  }, []);

  // Функция озвучивания предложения
  const speakSentence = (sentence, idx) => {
    if (!speechSupported) {
      alert('Ваш браузер не поддерживает озвучивание');
      return;
    }
    // Если уже читается это же предложение – останавливаем
    if (speakingIdx === idx && utteranceRef.current) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    // Останавливаем любое текущее воспроизведение
    window.speechSynthesis.cancel();
    if (utteranceRef.current) utteranceRef.current = null;

    const text = sentence.original.trim();
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    utteranceRef.current = utterance;
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
  };

  // Остановка при размонтировании
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    fetchText();
    fetchSavedWords();
  }, [id]);

  const fetchText = async () => {
    try {
      const response = await fetch(`/api/texts/${id}`);
      if (!response.ok) throw new Error('Text not found');
      const data = await response.json();
      setText(data);
      setCurrentPage(0);
    } catch (error) {
      console.error('Error fetching text:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedWords = async () => {
    try {
      const response = await fetch('/api/vocab');
      const data = await response.json();
      setSavedWords(data.map(w => ({ word: w.word.toLowerCase().trim(), status: w.status })));
    } catch (error) {
      console.error('Error fetching saved words:', error);
    }
  };

  const handleWordClick = async (word, wordIndex, globalSentenceIndex) => {
    if (!text.sentences || !text.sentences[globalSentenceIndex]) return;
    const sentence = text.sentences[globalSentenceIndex];
    const analysis = sentence.analysis || [];
    const words = sentence.words;

    if (selectedSentenceIndex === globalSentenceIndex && selectedWord !== null && !isManualEdit) {
      const newSelected = new Set(selectedIndices);
      if (newSelected.has(wordIndex)) {
        newSelected.delete(wordIndex);
      } else {
        newSelected.add(wordIndex);
      }
      if (newSelected.size === 0) {
        closePanel();
        return;
      }
      const sorted = Array.from(newSelected).sort((a, b) => a - b);
      const phraseWords = sorted.map(i => words[i]).join(' ').replace(/\s+/g, ' ').trim();

      setSelectedIndices(newSelected);
      setHighlightedIndices(newSelected);
      setCanonicalWord(phraseWords);
      setSelectedWord(phraseWords);
      setTranslationsList([]);
      setSelectedVariant('');
      setManualTranslation('');
      translatePhrase(phraseWords);
      return;
    }

    if (analysis.length > 0 && analysis[wordIndex]) {
      let token = analysis[wordIndex];
      let verbIndex = wordIndex;
      if (token.dep === 'svp') {
        const headId = token.head;
        const headToken = analysis.find(t => t.id === headId);
        if (headToken) {
          token = headToken;
          verbIndex = analysis.indexOf(headToken);
        }
      }
      const isVerb = token.pos === 'VERB' || token.pos === 'AUX';
      let reflexiveDetected = false;
      const initialSet = new Set();
      initialSet.add(verbIndex);
      if (isVerb) {
        analysis.filter(t => t.dep === 'svp' && t.head === token.id)
          .forEach(t => initialSet.add(analysis.indexOf(t)));
        const reflexive = analysis.find(t =>
          t.text.toLowerCase() === 'sich' &&
          t.head === token.id &&
          (t.dep === 'ob' || t.dep === 'expl')
        );
        if (reflexive) {
          reflexiveDetected = true;
          initialSet.add(analysis.indexOf(reflexive));
        }
      }
      const sorted = Array.from(initialSet).sort((a, b) => a - b);
      const startPhrase = sorted.map(i => words[i]).join(' ').replace(/\s+/g, ' ').trim();
      setSelectedIndices(initialSet);
      setHighlightedIndices(initialSet);
      setSelectedToken(token);
      setHasReflexive(reflexiveDetected);
      setCanonicalWord(startPhrase);
      setSelectedWord(startPhrase);
    } else {
      setSelectedIndices(new Set([wordIndex]));
      setHighlightedIndices(new Set([wordIndex]));
      setSelectedToken(null);
      setHasReflexive(false);
      setCanonicalWord(word);
      setSelectedWord(word);
    }

    setSelectedSentenceIndex(globalSentenceIndex);
    setOriginalSentence(sentence.original);
    setTranslatedSentence(sentence.translated);
    setShowContext(false);
    setTranslatingWord(true);
    setWordTranslation('');
    setTranslationsList([]);
    setManualTranslation('');
    setSelectedVariant('');
    setIsManualEdit(false);

    translatePhrase(selectedWord || word);
  };

  const translatePhrase = async (phrase) => {
    if (!phrase) return;
    setTranslatingWord(true);
    const isPhrase = phrase.includes(' ');
    try {
      if (isPhrase) {
        const res = await fetch('/api/translate-sentence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sentence: phrase })
        });
        const data = await res.json();
        const translation = data.translated || '';
        setWordTranslation(translation);
        setManualTranslation(translation);
      } else {
        const dictRes = await fetch('/api/dictionary-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: phrase })
        });
        const dictData = await dictRes.json();
        if (dictData.translations && dictData.translations.length > 0) {
          setTranslationsList(dictData.translations);
          setWordTranslation('');
          setManualTranslation('');
          setSelectedVariant('');
        } else {
          const gtRes = await fetch('/api/translate-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: phrase })
          });
          const gtData = await gtRes.json();
          const fallback = gtData.translated || '';
          setWordTranslation(fallback);
          setManualTranslation(fallback);
        }
      }
    } catch (err) {
      console.error('Translation error:', err);
    } finally {
      setTranslatingWord(false);
    }
  };

  const handleSaveWord = async (status) => {
    if (!selectedWord) return;
    const wordToSave = canonicalWord;
    try {
      const response = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: wordToSave,
          translation: wordTranslation,
          example_sentence: originalSentence,
          status,
          source_text_id: parseInt(id)
        })
      });
      if (response.ok) {
        setSavedWords(prev => [...prev, { word: wordToSave.toLowerCase().trim(), status }]);
        closePanel();
      } else {
        alert('Ошибка сохранения');
      }
    } catch (error) {
      console.error('Error saving word:', error);
      alert('Ошибка сети');
    }
  };

  const closePanel = () => {
    if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current);
    setSelectedWord(null);
    setSelectedSentenceIndex(null);
    setHighlightedIndices(new Set());
    setShowContext(false);
    setTranslationsList([]);
    setManualTranslation('');
    setSelectedIndices(new Set());
    setIsManualEdit(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100';
      case 'learning': return 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100';
      case 'known': return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
      default: return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
    }
  };

  const goPrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1);
  };

  const goNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1);
  };

  const progressPercent = totalPages > 0 ? ((currentPage + 1) / totalPages) * 100 : 0;

  if (loading) return <div className="p-8 dark:text-gray-100 text-center">Loading...</div>;
  if (!text) return <div className="p-8 dark:text-gray-100 text-center">Text not found</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 pt-4 px-4">
        <div className="max-w-4xl mx-auto">
          <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mb-2 inline-block">
            ← Назад в библиотеку
          </Link>
          <h1 className="text-3xl font-bold mb-1 dark:text-white">{text.title}</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-2">Тип: {text.type}</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">💡 Кликните по словам, чтобы составить фразу</p>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-3">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 leading-relaxed">
            {currentSentences.map((sentence, idx) => {
              const globalSentenceIndex = startIndex + idx;
              const phraseHighlightMap = new Map();
              savedWords.forEach(sw => {
                const parts = sw.word.split(' ');
                if (parts.length < 2) return;
                for (let i = 0; i <= sentence.words.length - parts.length; i++) {
                  const candidate = sentence.words
                    .slice(i, i + parts.length)
                    .map(w => w.toLowerCase().trim());
                  if (candidate.join(' ') === parts.join(' ')) {
                    for (let j = 0; j < parts.length; j++) {
                      phraseHighlightMap.set(i + j, sw.status);
                    }
                  }
                }
              });

              return (
                <div key={globalSentenceIndex} className="mb-4 group">
                  <div className="flex items-start gap-2">
                    {/* Кнопка озвучивания предложения */}
                    {speechSupported && (
                      <button
                        onClick={() => speakSentence(sentence, globalSentenceIndex)}
                        className="flex-shrink-0 mt-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        title="Озвучить предложение"
                      >
                        {speakingIdx === globalSentenceIndex ? (
                          <span className="text-blue-600 dark:text-blue-400">⏹️</span>
                        ) : (
                          <span>🔊</span>
                        )}
                      </button>
                    )}
                    <div className="flex-1 border-l-4 border-gray-200 dark:border-gray-600 pl-4">
                      <p>
                        {sentence.words.map((word, wordIndex) => {
                          if (/^\s+$/.test(word) || /^[.,!?;:]$/.test(word)) {
                            return <span key={wordIndex}>{word}</span>;
                          }
                          const cleanWord = word.toLowerCase().trim();
                          const savedEntry = savedWords.find(sw => sw.word === cleanWord);
                          const phraseStatus = phraseHighlightMap.get(wordIndex);
                          const isSaved = !!savedEntry || !!phraseStatus;
                          const isHighlighted = selectedSentenceIndex === globalSentenceIndex && highlightedIndices.has(wordIndex);

                          return (
                            <span
                              key={wordIndex}
                              onClick={() => handleWordClick(word, wordIndex, globalSentenceIndex)}
                              onMouseEnter={(e) => {
                                if (!isSaved && !isHighlighted) {
                                  e.currentTarget.classList.add('bg-yellow-200', 'rounded-md');
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSaved && !isHighlighted) {
                                  e.currentTarget.classList.remove('bg-yellow-200', 'rounded-md');
                                }
                              }}
                              className={`inline-block px-0.5 cursor-pointer transition-colors ${
                                isHighlighted
                                  ? 'bg-blue-300 dark:bg-blue-700 font-semibold rounded-md px-1'
                                  : isSaved
                                  ? `${getStatusColor(phraseStatus || savedEntry?.status)} font-bold rounded-md px-1`
                                  : ''
                              }`}
                            >
                              {word}
                            </span>
                          );
                        })}
                      </p>
                      {/* Можно показать перевод под предложением (опционально) */}
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {sentence.translated}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <button
                onClick={goPrevPage}
                disabled={currentPage === 0}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentPage === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                ← Предыдущая
              </button>
              <span className="text-gray-700 dark:text-gray-300 font-medium">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={goNextPage}
                disabled={currentPage === totalPages - 1}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  currentPage === totalPages - 1
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Следующая →
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedWord && (
        <div className="fixed top-20 right-5 z-50 w-96 max-h-[90vh] overflow-y-auto">
          <WordPanel
            canonicalWord={canonicalWord}
            wordTranslation={wordTranslation}
            translatingWord={translatingWord}
            translationsList={translationsList}
            manualTranslation={manualTranslation}
            selectedVariant={selectedVariant}
            originalSentence={originalSentence}
            translatedSentence={translatedSentence}
            showContext={showContext}
            selectedToken={selectedToken}
            hasReflexive={hasReflexive}
            onCanonicalChange={(val) => {
              setCanonicalWord(val);
              setIsManualEdit(true);
              setSelectedIndices(new Set());
              setHighlightedIndices(new Set());
              setTranslationsList([]);
              setSelectedVariant('');
              if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current);
              translateTimeoutRef.current = setTimeout(() => {
                if (val.trim()) {
                  translatePhrase(val.trim());
                } else {
                  setWordTranslation('');
                  setManualTranslation('');
                }
              }, 600);
            }}
            onVariantSelect={(tr) => {
              setSelectedVariant(tr);
              setWordTranslation(tr);
              setManualTranslation(tr);
            }}
            onManualChange={(val) => {
              setManualTranslation(val);
              setWordTranslation(val);
              setSelectedVariant('');
            }}
            onSave={handleSaveWord}
            onClose={closePanel}
            onToggleContext={() => setShowContext(!showContext)}
          />
        </div>
      )}
    </div>
  );
}