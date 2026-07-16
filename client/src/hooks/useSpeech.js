import { useState, useEffect, useRef } from 'react';

// Соответствие кодов изучаемого языка (Settings.jsx: 'de', 'en', ...) и
// BCP-47 локалей для SpeechSynthesis.
const SPEECH_LOCALES = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-PT',
};

export function useSpeech() {
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (!window.speechSynthesis) setSpeechSupported(false);
  }, []);

  // lang — код изучаемого языка ('de', 'en', 'es', 'fr', 'pt'). Если не
  // передан, сохраняем прежнее поведение по умолчанию (немецкий), чтобы не
  // сломать существующие вызовы из Reader.jsx.
  const speak = (sentence, idx, lang = 'de') => {
    if (!speechSupported) {
      alert('Ваш браузер не поддерживает озвучивание');
      return;
    }
    if (speakingIdx === idx) {
      window.speechSynthesis.cancel();
      setSpeakingIdx(null);
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(sentence.original.trim());
    u.lang = SPEECH_LOCALES[lang] || SPEECH_LOCALES.de;
    u.rate = 0.9;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    utteranceRef.current = u;
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  };

  return { speechSupported, speakingIdx, speak };
}