import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import YouTube from 'react-youtube';
import WordPanel from '../components/WordPanel';

export default function VideoReader() {
  const { id } = useParams();
  const [material, setMaterial] = useState(null);
  const [subtitles, setSubtitles] = useState([]);
  const [currentSub, setCurrentSub] = useState(null);
  const [error, setError] = useState(null);
  const playerRef = useRef(null);
  const playerIntervalRef = useRef(null);
  const lastActiveSubTextRef = useRef(''); // запоминаем последний показанный текст

  const [analyses, setAnalyses] = useState({});
  const analyzingRef = useRef(new Set());
  const abortControllersRef = useRef(new Map());

  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedSubId, setSelectedSubId] = useState(null);
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

  useEffect(() => {
    const abortController = new AbortController();
    fetch(`/api/material/${id}`, { signal: abortController.signal })
      .then(res => res.ok ? res.json() : Promise.reject('Material not found'))
      .then(setMaterial)
      .catch(err => { if (err.name !== 'AbortError') setError(err); });
    fetch(`/api/subtitles/${id}`, { signal: abortController.signal })
      .then(res => res.ok ? res.json() : Promise.reject('Subtitles not found'))
      .then(setSubtitles)
      .catch(err => { if (err.name !== 'AbortError') setError(err); });
    return () => abortController.abort();
  }, [id]);

  useEffect(() => {
    const ac = new AbortController();
    fetch('/api/vocab', { signal: ac.signal })
      .then(res => res.json())
      .then(data => setSavedWords(data.map(w => ({ word: w.word.toLowerCase().trim(), status: w.status }))))
      .catch(console.error);
    return () => ac.abort();
  }, []);

  useEffect(() => {
    return () => {
      for (const [_, controller] of abortControllersRef.current.entries()) {
        controller.abort();
      }
    };
  }, []);

  const analyzeSubtitle = async (subtitleId, text) => {
    if (analyses[subtitleId]) return analyses[subtitleId];
    if (analyzingRef.current.has(subtitleId)) return null;

    analyzingRef.current.add(subtitleId);
    const controller = new AbortController();
    abortControllersRef.current.set(subtitleId, controller);
    try {
      const response = await fetch('/api/analyze-german', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal
      });
      const json = await response.json();
      const tokens = json.tokens || [];
      setAnalyses(prev => ({ ...prev, [subtitleId]: tokens }));
      return tokens;
    } catch (err) {
      if (err.name !== 'AbortError') console.error(`Анализ субтитра ${subtitleId} не удался:`, err);
      return null;
    } finally {
      analyzingRef.current.delete(subtitleId);
      abortControllersRef.current.delete(subtitleId);
    }
  };

  const handleWordClick = async (word, wordIndex, subId) => {
    const sub = subtitles.find(s => s.id === subId);
    if (!sub) return;
    const lineText = sub.line_text;

    let tokens = analyses[subId];
    if (!tokens) {
      tokens = await analyzeSubtitle(subId, lineText);
      if (!tokens) {
        if (playerRef.current?.pauseVideo) playerRef.current.pauseVideo();
        setSelectedIndices(new Set([wordIndex]));
        setHighlightedIndices(new Set([wordIndex]));
        setSelectedSubId(subId);
        setOriginalSentence(lineText);
        setSelectedToken(null);
        setHasReflexive(false);
        setShowContext(false);
        setTranslatingWord(true);
        setWordTranslation('');
        setTranslationsList([]);
        setManualTranslation('');
        setSelectedVariant('');
        setIsManualEdit(false);
        setCanonicalWord(word);
        setSelectedWord(word);
        try {
          const sentRes = await fetch('/api/translate-sentence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sentence: lineText })
          });
          const sentData = await sentRes.json();
          setTranslatedSentence(sentData.translated || '');
        } catch (e) {
          setTranslatedSentence('Не удалось перевести предложение');
        }
        translatePhrase(word);
        return;
      }
    }

    if (selectedSubId === subId && selectedWord !== null && !isManualEdit) {
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
      const phraseWords = sorted.map(i => tokens[i].text).join(' ').replace(/\s+/g, ' ').trim();
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

    let token = tokens[wordIndex];
    if (!token) return;
    let verbIndex = wordIndex;
    if (token.dep === 'svp') {
      const headId = token.head;
      const headToken = tokens.find(t => t.id === headId);
      if (headToken) {
        token = headToken;
        verbIndex = tokens.indexOf(headToken);
      }
    }
    const isVerb = token.pos === 'VERB' || token.pos === 'AUX';
    let reflexiveDetected = false;
    const initialSet = new Set();
    initialSet.add(verbIndex);
    if (isVerb) {
      tokens.filter(t => t.dep === 'svp' && t.head === token.id)
        .forEach(t => initialSet.add(tokens.indexOf(t)));
      const reflexive = tokens.find(t =>
        t.text.toLowerCase() === 'sich' &&
        t.head === token.id &&
        (t.dep === 'ob' || t.dep === 'expl')
      );
      if (reflexive) {
        reflexiveDetected = true;
        initialSet.add(tokens.indexOf(reflexive));
      }
    }
    if (playerRef.current?.pauseVideo) playerRef.current.pauseVideo();

    setSelectedIndices(initialSet);
    setHighlightedIndices(initialSet);
    setSelectedSubId(subId);
    setOriginalSentence(lineText);
    setSelectedToken(token);
    setHasReflexive(reflexiveDetected);
    setShowContext(false);
    setTranslatingWord(true);
    setWordTranslation('');
    setTranslationsList([]);
    setManualTranslation('');
    setSelectedVariant('');
    setIsManualEdit(false);

    const sorted = Array.from(initialSet).sort((a, b) => a - b);
    const startPhrase = sorted.map(i => tokens[i].text).join(' ').replace(/\s+/g, ' ').trim();
    setCanonicalWord(startPhrase);
    setSelectedWord(startPhrase);

    try {
      const sentRes = await fetch('/api/translate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: lineText })
      });
      const sentData = await sentRes.json();
      setTranslatedSentence(sentData.translated || '');
    } catch (e) {
      setTranslatedSentence('Не удалось перевести предложение');
    }
    translatePhrase(startPhrase);
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
      console.error(err);
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
    } catch (err) {
      alert('Ошибка сети');
    }
  };

  const closePanel = () => {
    if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current);
    setSelectedWord(null);
    setSelectedSubId(null);
    setHighlightedIndices(new Set());
    setShowContext(false);
    setTranslationsList([]);
    setManualTranslation('');
    setSelectedIndices(new Set());
    setIsManualEdit(false);
  };

  const onPlayerReady = (event) => { playerRef.current = event.target; };
  const onPlayerStateChange = (event) => {
    if (event.data === 1) {
      if (playerIntervalRef.current) clearInterval(playerIntervalRef.current);
      playerIntervalRef.current = setInterval(() => {
        if (playerRef.current) {
          const timeMs = playerRef.current.getCurrentTime() * 1000;
          const active = subtitles.find(
            sub => timeMs >= sub.start_ms && timeMs <= sub.end_ms
          );
          if (active) {
            // Обновляем только если текст субтитра изменился (строгая дедупликация)
            if (active.line_text !== lastActiveSubTextRef.current) {
              lastActiveSubTextRef.current = active.line_text;
              setCurrentSub(active);
            }
          } else if (currentSub) {
            // Нет активного субтитра – сбрасываем
            setCurrentSub(null);
            lastActiveSubTextRef.current = '';
          }
        }
      }, 500); // увеличен интервал до 500 мс
    } else {
      if (playerIntervalRef.current) clearInterval(playerIntervalRef.current);
      playerIntervalRef.current = null;
      lastActiveSubTextRef.current = '';
    }
  };

  const getVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-100';
      case 'learning': return 'bg-yellow-200 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100';
      case 'known': return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
      default: return 'bg-green-200 text-green-900 dark:bg-green-900 dark:text-green-100';
    }
  };

  const renderCurrentSubtitle = () => {
    if (!currentSub) {
      return <p className="text-center text-gray-500 dark:text-gray-400">🎬 Субтитры появятся при воспроизведении</p>;
    }

    const tokens = analyses[currentSub.id] || [];
    if (tokens.length === 0) {
      const words = currentSub.line_text.split(/\s+/);
      return (
        <div className="text-center text-xl leading-relaxed dark:text-gray-100">
          {words.map((word, idx) => (
            <span
              key={idx}
              onClick={() => handleWordClick(word, idx, currentSub.id)}
              className="inline-block px-0.5 cursor-pointer hover:bg-yellow-200 rounded-md transition-colors"
            >
              {word}
            </span>
          ))}
        </div>
      );
    }

    const phraseHighlightMap = new Map();
    savedWords.forEach(sw => {
      const parts = sw.word.split(' ');
      if (parts.length < 2) return;
      for (let i = 0; i <= tokens.length - parts.length; i++) {
        const candidate = tokens.slice(i, i + parts.length).map(t => t.text.toLowerCase());
        if (candidate.join(' ') === parts.join(' ')) {
          for (let j = 0; j < parts.length; j++) {
            phraseHighlightMap.set(i + j, sw.status);
          }
        }
      }
    });

    return (
      <div className="text-center text-xl leading-relaxed dark:text-gray-100">
        {tokens.map((tok, idx) => {
          const word = tok.text;
          const isPunct = tok.pos === 'PUNCT';
          const cleanWord = word.toLowerCase().replace(/[.,!?;:]/g, '');
          const savedEntry = savedWords.find(sw => sw.word === cleanWord);
          const phraseStatus = phraseHighlightMap.get(idx);
          const isSaved = !!savedEntry || !!phraseStatus;
          const isHighlighted = selectedSubId === currentSub.id && highlightedIndices.has(idx);

          return (
            <span key={idx}>
              <span
                onClick={() => handleWordClick(word, idx, currentSub.id)}
                onMouseEnter={(e) => {
                  if (!isSaved && !isHighlighted) e.currentTarget.classList.add('bg-yellow-200', 'rounded-md');
                }}
                onMouseLeave={(e) => {
                  if (!isSaved && !isHighlighted) e.currentTarget.classList.remove('bg-yellow-200', 'rounded-md');
                }}
                className={`inline-block px-0.5 cursor-pointer transition-colors ${
                  isHighlighted ? 'bg-blue-300 dark:bg-blue-700 font-semibold rounded-md px-1' :
                  isSaved ? `${getStatusColor(phraseStatus || savedEntry?.status)} font-bold rounded-md px-1` : ''
                }`}
              >
                {word}
              </span>
              {idx < tokens.length - 1 && !isPunct ? ' ' : ''}
            </span>
          );
        })}
      </div>
    );
  };

  const videoId = getVideoId(material?.youtube_url);
  if (error) return <div className="p-8 text-red-600">Ошибка: {error}</div>;
  if (!material) return <div className="p-8 dark:text-gray-100">Загрузка материала...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-5 p-5 min-h-screen">
      <div className="flex-1">
        <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">← Назад в библиотеку</Link>
        <h2 className="text-2xl font-bold mb-4 dark:text-white">{material.title}</h2>
        {videoId ? (
          <YouTube
            videoId={videoId}
            opts={{ width: '100%', height: '500px', playerVars: { modestbranding: 1, rel: 0 } }}
            onReady={onPlayerReady}
            onStateChange={onPlayerStateChange}
          />
        ) : (
          <p className="text-red-600">Не удалось извлечь ID видео</p>
        )}
        <div className="mt-5 bg-white dark:bg-gray-800 p-6 rounded-lg shadow-inner min-h-[60px] border border-gray-200 dark:border-gray-700">
          {renderCurrentSubtitle()}
        </div>
      </div>

      {selectedWord && (
        <div className="fixed top-20 right-5 z-50 w-96 max-h-[80vh] overflow-y-auto">
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