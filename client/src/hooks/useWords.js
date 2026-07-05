import { useState, useEffect, useMemo } from 'react';
import { apiFetch } from '../utils/api';
import { normalizeWord } from '../utils/normalizeWord';

export function useWords() {
  const [savedWords, setSavedWords] = useState([]);
  const [loading, setLoading] = useState(true);

  const parseWordIndices = (value) => {
    if (value == null) return null;

    // Уже массив
    if (Array.isArray(value)) {
      return value;
    }

    // Уже объект
    if (typeof value === 'object') {
      return value;
    }

    // Строка
    if (typeof value === 'string') {
      const trimmed = value.trim();

      // Явно некорректное значение
      if (
        trimmed === '' ||
        trimmed === '[object Object]' ||
        trimmed === 'undefined' ||
        trimmed === 'null'
      ) {
        return null;
      }

      try {
        return JSON.parse(trimmed);
      } catch (err) {
        console.warn('Invalid word_indices:', trimmed);
        return null;
      }
    }

    return null;
  };

  // Индекс для быстрого получения статуса по нормализованному слову
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

  const fetchWords = async () => {
    setLoading(true);
    try {
      const data = await apiFetch('/api/vocab');

      // Сохраняем оригинальное слово, не меняя регистр
      const normalized = data.map((w) => ({
        word: w.word ?? '',
        status: w.status,
        sentence_index: w.sentence_index,
        word_indices: parseWordIndices(w.word_indices),
      }));

      setSavedWords(normalized);
    } catch (err) {
      console.error('Error fetching saved words:', err);
      setSavedWords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWords();
  }, []);

  return {
    savedWords,      // оригинальные слова (как в БД)
    setSavedWords,
    fetchWords,
    wordStatusMap,   // Map<normalizedWord, status>
    loading,
  };
}