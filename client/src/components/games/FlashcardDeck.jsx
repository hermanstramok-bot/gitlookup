import { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSpeech } from '../../hooks/useSpeech';

const DEFAULT_LANG = 'de';
function getTargetLang() {
  return localStorage.getItem('targetLang') || DEFAULT_LANG;
}

// ===== Модалка подтверждения =====
function ConfirmModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-xl"
        >
          <h3 className="text-xl font-bold mb-4 dark:text-white">Выйти из флешкарт?</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-6">
            Вы ещё не прошли все карточки. Прогресс будет потерян. Уверены?
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-white"
            >
              Остаться
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-red-600 text-white rounded-full hover:bg-red-700"
            >
              Выйти
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ===== Основной компонент =====
export default function FlashcardDeck({ words, onFinish }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const total = words.length;
  const word = words[currentIndex] || {};
  const frontText = word.word || word.phrase || '';
  const backText = word.translation || '';

  // Рефы для доступа к актуальным значениям внутри обработчика клавиш
  const currentIndexRef = useRef(currentIndex);
  const isFlippedRef = useRef(isFlipped);
  const totalRef = useRef(total);

  // Обновляем рефы при каждом рендере
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isFlippedRef.current = isFlipped;
  }, [isFlipped]);

  useEffect(() => {
    totalRef.current = total;
  }, [total]);

  // Навигация
  const goToPrev = () => {
    if (currentIndexRef.current > 0) {
      setCurrentIndex(currentIndexRef.current - 1);
      setIsFlipped(false);
    }
  };

  const goToNext = () => {
    if (currentIndexRef.current < totalRef.current - 1) {
      setCurrentIndex(currentIndexRef.current + 1);
      setIsFlipped(false);
    }
  };

  // Бесконечный переворот – просто меняем состояние на противоположное
  const handleFlip = () => {
    setIsFlipped(prev => !prev);
  };

  // Озвучивание — тот же голос (язык + пол из настроек), что и в
  // Reader/VideoReader/WordPanel (см. useSpeech.js), а не захардкоженный
  // en-US.
  const { speak } = useSpeech();
  const speakWord = (word) => {
    speak({ original: word }, 'flashcard-front', getTargetLang());
  };

  // Выход
  const handleExit = () => {
    if (currentIndexRef.current < totalRef.current - 1) {
      setShowExitConfirm(true);
    } else {
      setShowCelebration(true);
      setTimeout(() => {
        onFinish();
      }, 2500);
    }
  };

  const confirmExit = () => {
    setShowExitConfirm(false);
    onFinish();
  };

  // Клавиатура с использованием рефов для актуальных значений
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNext();
      } else if (e.key === ' ' || e.key === 'Space') {
        e.preventDefault();
        handleFlip(); // всегда переворачивает
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleExit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // пустой массив зависимостей – обработчик создаётся один раз

  // Если показываем поздравление
  if (showCelebration) {
    return (
      <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col items-center justify-center">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
          Все карточки пройдены!
        </h2>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Отличная работа! Вы повторили {total} слов.
        </p>
        <div className="text-sm text-gray-400">Закрывается...</div>
        {/* Конфетти */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 80 }).map((_, i) => {
            const size = 6 + Math.random() * 10;
            const left = Math.random() * 100;
            const delay = Math.random() * 2;
            const duration = 2 + Math.random() * 2;
            const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#1dd1a1'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            return (
              <div
                key={i}
                className="absolute rounded-sm"
                style={{
                  left: `${left}%`,
                  top: '-10%',
                  width: `${size}px`,
                  height: `${size * 0.6}px`,
                  backgroundColor: color,
                  animation: `confettiFall ${duration}s ${delay}s linear infinite`,
                  borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Полноэкранный режим
  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col p-4 md:p-8">
      {/* Верхняя панель: индикатор + кнопка Выйти (текст без фона) */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {currentIndex + 1} / {total}
        </div>
        <button
          onClick={handleExit}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition"
        >
          Выйти
        </button>
      </div>

      {/* Карточка */}
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div
          className="relative w-full max-w-2xl aspect-[4/3] cursor-pointer perspective-1000"
          onClick={handleFlip}
        >
          <div
            className={`relative w-full h-full transition-transform duration-500 transform-style-3d ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
          >
            {/* Лицевая сторона (слово) */}
            <div className="absolute inset-0 backface-hidden bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col items-center justify-center p-8">
              <div className="text-4xl md:text-5xl font-medium text-gray-900 dark:text-white text-center">
                {frontText}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  speakWord(frontText);
                }}
                className="absolute bottom-6 right-6 p-3 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition text-3xl"
                title="Прослушать"
              >
                🔊
              </button>
              <div className="absolute bottom-6 left-6 text-xs text-gray-400 dark:text-gray-500">
                Нажмите или пробел
              </div>
            </div>

            {/* Обратная сторона (перевод) */}
            <div className="absolute inset-0 backface-hidden bg-blue-50 dark:bg-blue-900/30 rounded-2xl shadow-2xl flex items-center justify-center p-8 rotate-y-180">
              <div className="text-4xl md:text-5xl font-medium text-blue-700 dark:text-blue-300 text-center">
                {backText}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Навигация: стрелки + точки */}
      <div className="flex-shrink-0 mt-6 flex items-center justify-between gap-4">
        <button
          onClick={goToPrev}
          disabled={currentIndex === 0}
          className="text-2xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Назад"
        >
          ◀
        </button>

        {/* Точки прогресса */}
        <div className="flex-1 flex justify-center gap-1.5">
          {words.map((_, idx) => (
            <div
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === currentIndex
                  ? 'w-6 bg-blue-500'
                  : 'w-3 bg-gray-300 dark:bg-gray-600'
              }`}
            />
          ))}
        </div>

        <button
          onClick={goToNext}
          disabled={currentIndex === total - 1}
          className="text-2xl text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Вперёд"
        >
          ▶
        </button>
      </div>

      {/* Подсказка */}
      <div className="flex-shrink-0 mt-2 text-xs text-center text-gray-400 dark:text-gray-500">
        ← → или стрелки для переключения • пробел для переворота • ESC для выхода
      </div>

      {/* Модалка подтверждения */}
      <ConfirmModal
        isOpen={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        onConfirm={confirmExit}
      />
    </div>
  );
}