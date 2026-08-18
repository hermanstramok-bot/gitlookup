import { useState, useRef, useCallback, useEffect } from 'react';
import { apiFetch } from '../utils/api'; // <-- добавлен импорт
import { normalizeWord } from '../utils/normalizeWord';

const cleanWord = (word) => {
  if (!word) return '';
  return word.replace(/^[^\p{L}\p{N}\-']+|[^\p{L}\p{N}\-']+$/gu, '');
};

const cleanPhrase = (phrase) =>
  phrase.split(/\s+/).map(w => cleanWord(w)).filter(w => w.length > 0).join(' ');

const JUNK = new Set(['—', '–', '-', '']);

const isValidTranslation = (t) => t && !JUNK.has(t.trim());

// targetLang — код изучаемого языка ('de' | 'en' | 'es' | 'fr' | 'pt'),
// используется для перевода (переводим ИЗ этого языка через Google Translate
// или локальный словарь). Озвучка слова в этом хуке больше не нужна — она
// реализована прямо в WordPanel.jsx через собственный useSpeech(targetLang).
export function useWordPanel(materialId, savedWords, setSavedWords, targetLang = 'de') {
  const [selectedWord, setSelectedWord] = useState(null);
  const [selectedSentenceIndex, setSelectedSentenceIndex] = useState(null);
  const [originalSentence, setOriginalSentence] = useState('');
  const [translatedSentence, setTranslatedSentence] = useState('');
  const [canonicalWord, setCanonicalWord] = useState('');
  const [wordTranslation, setWordTranslation] = useState('');
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

  const closePanel = useCallback(() => {
    if (translateTimeoutRef.current) clearTimeout(translateTimeoutRef.current);
    setSelectedWord(null);
    setSelectedSentenceIndex(null);
    setHighlightedIndices(new Set());
    setShowContext(false);
    setTranslationsList([]);
    setManualTranslation('');
    setSelectedIndices(new Set());
    setIsManualEdit(false);
  }, []);

  // Spec 1: слова, пропущенные ("skip / unhighlight") именно в этом материале.
  // Хранится как Set нормализованных слов — та же нормализация, что и в
  // wordStatusMap (useWords.js), чтобы совпадали 1-в-1.
  const [skippedWords, setSkippedWords] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    if (!materialId) return;
    apiFetch(`/api/materials/${materialId}/skipped-words`)
      .then(words => {
        if (!cancelled) setSkippedWords(new Set(words));
      })
      .catch(err => console.error('Ошибка загрузки пропущенных слов:', err));
    return () => { cancelled = true; };
  }, [materialId]);

  const isWordSkipped = useCallback((word) => {
    return skippedWords.has(normalizeWord(word));
  }, [skippedWords]);

  // Тоггл: скипнуть слово в этом материале, или отменить скип, если уже скипнуто.
  const toggleSkipWord = useCallback(async (word) => {
    if (!word) return;
    const normalized = normalizeWord(word);
    const currentlySkipped = skippedWords.has(normalized);
    try {
      if (currentlySkipped) {
        await apiFetch(`/api/materials/${materialId}/skipped-words/${encodeURIComponent(normalized)}`, {
          method: 'DELETE'
        });
        setSkippedWords(prev => {
          const next = new Set(prev);
          next.delete(normalized);
          return next;
        });
      } else {
        await apiFetch(`/api/materials/${materialId}/skipped-words`, {
          method: 'POST',
          body: JSON.stringify({ word: normalized })
        });
        setSkippedWords(prev => new Set(prev).add(normalized));
      }
      closePanel();
    } catch (err) {
      console.error('Ошибка изменения статуса пропуска слова:', err);
      alert('Не удалось изменить статус пропуска слова');
    }
  }, [materialId, skippedWords, closePanel]);

  // Фолбэк на Google Translate
  const translateViaGoogle = useCallback(async (phrase) => {
    try {
      const res = await fetch('/api/translate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: phrase, targetLang })
      });
      const data = await res.json();
      const result = data.translation || '';
      setWordTranslation(result);
      setManualTranslation(result);
    } catch (err) {
      console.error('❌ translateViaGoogle error:', err);
    }
  }, [targetLang]);

  const translatePhrase = useCallback(async (phrase) => {
    if (!phrase) {
      return;
    }
    setTranslatingWord(true);
    try {
      // Локальный словарь (server/data/de_rus_dict.json) есть только для
      // немецкого. Для остальных языков сразу используем Google Translate.
      if (phrase.includes(' ') || targetLang !== 'de') {
        await translateViaGoogle(phrase);
      } else {
        const res = await fetch('/api/dictionary-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: phrase, targetLang })
        });
        const data = await res.json();
        const validTranslations = (data.translations || []).filter(isValidTranslation);

        if (validTranslations.length > 0) {
          setTranslationsList(validTranslations);
        } else {
          await translateViaGoogle(phrase);
        }
      }
    } catch (err) {
      console.error('❌ translatePhrase error:', err);
    } finally {
      setTranslatingWord(false);
    }
  }, [translateViaGoogle, targetLang]);

  const handleSaveWord = useCallback(async (status) => {
    if (!selectedWord) return;
    const wordToSave = cleanPhrase(canonicalWord);
    if (!wordToSave) return alert('Не удалось очистить слово/фразу от пунктуации');
    try {
      // Используем apiFetch вместо обычного fetch – он автоматически добавляет Authorization
      await apiFetch('/api/vocab', {
        method: 'POST',
        body: JSON.stringify({
          word: wordToSave,
          translation: wordTranslation,
          example_sentence: originalSentence,
          status,
          source_text_id: parseInt(materialId),
          sentence_index: selectedSentenceIndex,
          word_indices: Array.from(selectedIndices)
        })
      });
      // apiFetch выбрасывает ошибку при статусе не 2xx, поэтому если дошли сюда – успех
      setSavedWords(prev => [...prev, {
        word: wordToSave.toLowerCase().trim(),
        status,
        sentence_index: selectedSentenceIndex,
        word_indices: Array.from(selectedIndices)
      }]);
      closePanel();
    } catch (err) {
      console.error('Ошибка сохранения слова:', err);
      alert('Ошибка сохранения');
    }
  }, [selectedWord, canonicalWord, wordTranslation, originalSentence, materialId, selectedSentenceIndex, selectedIndices, setSavedWords, closePanel]);

  const openPanel = useCallback(({
    word,
    sentenceIndex,
    sentence,
    translation,
    token,
    reflexive,
    indices,
    phrase
  }) => {
    setSelectedIndices(indices);
    setHighlightedIndices(indices);
    setSelectedToken(token);
    setHasReflexive(reflexive);
    setCanonicalWord(phrase);
    setSelectedWord(phrase);
    setSelectedSentenceIndex(sentenceIndex);
    setOriginalSentence(sentence);
    setTranslatedSentence(translation);
    setShowContext(false);
    setTranslatingWord(true);
    setWordTranslation('');
    setTranslationsList([]);
    setManualTranslation('');
    setSelectedVariant('');
    setIsManualEdit(false);

    // Явно вызываем перевод
    translatePhrase(phrase);
  }, [translatePhrase]);

  return {
    selectedWord,
    selectedSentenceIndex,
    originalSentence,
    translatedSentence,
    canonicalWord,
    wordTranslation,
    selectedToken,
    hasReflexive,
    highlightedIndices,
    showContext,
    translatingWord,
    selectedIndices,
    isManualEdit,
    translationsList,
    manualTranslation,
    selectedVariant,
    translateTimeoutRef,
    setWordTranslation,
    setTranslatingWord,
    setTranslationsList,
    setManualTranslation,
    setSelectedVariant,
    setIsManualEdit,
    setCanonicalWord,
    setSelectedWord,
    setSelectedSentenceIndex,
    setOriginalSentence,
    setTranslatedSentence,
    setSelectedToken,
    setHasReflexive,
    setHighlightedIndices,
    setShowContext,
    setSelectedIndices,
    closePanel,
    openPanel,
    translatePhrase,
    handleSaveWord,
    // Spec 1: per-material word skip / unhighlight
    skippedWords,
    isWordSkipped,
    toggleSkipWord,
  };
}