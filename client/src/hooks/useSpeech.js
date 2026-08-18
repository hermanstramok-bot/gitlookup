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

// Web Speech API не даёт официального поля "пол голоса" — определяем его
// эвристически по имени голоса (имена, которые обычно используют
// Google/Microsoft/Apple TTS-движки для мужских/женских голосов).
const FEMALE_NAME_HINTS = [
  'female', 'zira', 'hazel', 'susan', 'samantha', 'victoria', 'karen', 'moira',
  'tessa', 'fiona', 'anna', 'martha', 'kate', 'salli', 'joanna', 'ivy',
  'kimberly', 'amy', 'emma', 'olivia', 'sophie', 'lucia', 'elena', 'paulina',
  'monica', 'conchita', 'lea', 'celine', 'audrey', 'marie', 'julie',
  'chantal', 'helena', 'petra', 'katja', 'vicki', 'marlene', 'sabina',
];
const MALE_NAME_HINTS = [
  'male', 'david', 'mark', 'james', 'daniel', 'alex', 'fred', 'tom', 'george',
  'ralph', 'stefan', 'yannick', 'nicolas', 'matthew', 'justin', 'russell',
  'brian', 'joey', 'miguel', 'diego', 'enrique', 'carlos', 'pedro', 'ricardo',
  'thiago', 'hans', 'klaus', 'reiner', 'jorge', 'juan',
];

function getReaderVoicePref() {
  return localStorage.getItem('readerVoice') || 'male';
}

// Ищем среди доступных голосов браузера тот, что подходит под нужный язык
// и (по возможности) под выбранный в Settings.jsx пол голоса. Если совпадение
// по полу не нашлось — берём любой голос нужного языка, чтобы озвучка вообще
// работала (лучше "не тот пол", чем полное отсутствие звука).
function pickVoice(locale, genderPref) {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;

  const localePrefix = locale.split('-')[0].toLowerCase();
  const matchingLocale = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith(localePrefix));
  const pool = matchingLocale.length ? matchingLocale : voices;

  const hints = genderPref === 'female' ? FEMALE_NAME_HINTS : MALE_NAME_HINTS;
  const byGender = pool.find(v => hints.some(h => v.name.toLowerCase().includes(h)));
  return byGender || pool[0] || null;
}

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
    const voice = pickVoice(u.lang, getReaderVoicePref());
    if (voice) u.voice = voice;
    u.rate = 0.9;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    utteranceRef.current = u;
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  };

  return { speechSupported, speakingIdx, speak };
}