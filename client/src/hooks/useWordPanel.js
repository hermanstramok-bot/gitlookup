import { useState, useRef, useCallback } from 'react';
import { apiFetch } from '../utils/api'; // <-- добавлен импорт

const cleanWord = (word) => {
  if (!word) return '';
  return word.replace(/^[^\p{L}\p{N}\-']+|[^\p{L}\p{N}\-']+$/gu, '');
};

const cleanPhrase = (phrase) =>
  phrase.split(/\s+/).map(w => cleanWord(w)).filter(w => w.length > 0).join(' ');

const JUNK = new Set(['—', '–', '-', '']);

const isValidTranslation = (t) => t && !JUNK.has(t.trim());

export function useWordPanel(materialId, savedWords, setSavedWords) {
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

  // Фолбэк на Google Translate
  const translateViaGoogle = useCallback(async (phrase) => {
    console.log('🔄 translateViaGoogle called with phrase:', phrase);
    try {
      const res = await fetch('/api/translate-sentence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sentence: phrase })
      });
      console.log('📡 Response status:', res.status);
      const data = await res.json();
      console.log('✅ translateViaGoogle response:', data);
      const result = data.translation || '';
      console.log('📝 Setting wordTranslation to:', result);
      setWordTranslation(result);
      setManualTranslation(result);
    } catch (err) {
      console.error('❌ translateViaGoogle error:', err);
    }
  }, []);

  const translatePhrase = useCallback(async (phrase) => {
    console.log('🔄 translatePhrase called with phrase:', phrase);
    if (!phrase) {
      console.log('⚠️ phrase is empty, skipping');
      return;
    }
    setTranslatingWord(true);
    try {
      if (phrase.includes(' ')) {
        console.log('🔍 Phrase detected, using Google Translate');
        await translateViaGoogle(phrase);
      } else {
        console.log('🔍 Single word, trying dictionary first');
        const res = await fetch('/api/dictionary-lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: phrase })
        });
        const data = await res.json();
        const validTranslations = (data.translations || []).filter(isValidTranslation);
        console.log('📚 Dictionary response:', data, 'validTranslations:', validTranslations);

        if (validTranslations.length > 0) {
          console.log('✅ Dictionary returned translations, setting translationsList');
          setTranslationsList(validTranslations);
        } else {
          console.log('⚠️ Dictionary empty, falling back to Google Translate');
          await translateViaGoogle(phrase);
        }
      }
    } catch (err) {
      console.error('❌ translatePhrase error:', err);
    } finally {
      setTranslatingWord(false);
    }
  }, [translateViaGoogle]);

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
    console.log('🔓 openPanel called with:', { word, sentenceIndex, sentence, phrase, reflexive });
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
    console.log('🔔 Calling translatePhrase with phrase:', phrase);
    translatePhrase(phrase);
  }, [translatePhrase]);
  console.log("📤 useWordPanel returns:", {
    canonicalWord,
    wordTranslation,
    translationsList,
    translatingWord,
});

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
  };
}