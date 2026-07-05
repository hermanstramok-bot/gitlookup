import { useState, useEffect, useRef } from 'react';

export function useSpeech() {
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const utteranceRef = useRef(null);

  useEffect(() => {
    if (!window.speechSynthesis) setSpeechSupported(false);
  }, []);

  const speak = (sentence, idx) => {
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
    u.lang = 'de-DE';
    u.rate = 0.9;
    u.onend = () => setSpeakingIdx(null);
    u.onerror = () => setSpeakingIdx(null);
    utteranceRef.current = u;
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(u);
  };

  return { speechSupported, speakingIdx, speak };
}