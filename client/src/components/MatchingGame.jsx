// client/src/components/MatchingGame.jsx
import { useState, useEffect, useRef, useCallback } from 'react';

const RPB = 5;       // раундов на блок
const PPR = 6;       // пар в раунде
const BLOCKS_COUNT = 3;

const DIFF = {
  start: 120,   // секунд на первый блок
  dec: 20,      // уменьшение на блок
  min: 45
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function MatchingGame({ pairs, onGameEnd }) {
  const [blockIndex, setBlockIndex] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [rounds, setRounds] = useState([]);
  const [currentRoundPairs, setCurrentRoundPairs] = useState([]);
  const [deWords, setDeWords] = useState([]);
  const [ruWords, setRuWords] = useState([]);
  const [selectedDe, setSelectedDe] = useState(null);
  const [selectedRu, setSelectedRu] = useState(null);
  const [alive, setAlive] = useState(true);
  const [blockErrors, setBlockErrors] = useState(0);
  const [totalErrors, setTotalErrors] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DIFF.start);
  const [blockFinished, setBlockFinished] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [blockStat, setBlockStat] = useState(null);
  const [finalStat, setFinalStat] = useState(null);
  const [disableSelection, setDisableSelection] = useState(false);

  const timerRef = useRef(null);
  const deadlineRef = useRef(0);

  // генерация раундов для текущего блока
  const generateRounds = useCallback(() => {
    const need = RPB * PPR;
    let pool = [];
    while (pool.length < need) {
      pool = pool.concat(shuffleArray(pairs));
    }
    pool = pool.slice(0, need);
    const roundsArr = [];
    for (let i = 0; i < RPB; i++) {
      roundsArr.push(pool.slice(i * PPR, (i + 1) * PPR));
    }
    return roundsArr;
  }, [pairs]);

  // обновить таймер и полосу
  const updateTimerDisplay = useCallback(() => {
    const now = performance.now();
    const remaining = Math.max(0, (deadlineRef.current - now) / 1000);
    setTimeLeft(remaining);
    if (remaining <= 0 && alive && !blockFinished) {
      // время вышло
      if (timerRef.current) clearInterval(timerRef.current);
      setAlive(false);
      setBlockFinished(true);
      setBlockStat({ errors: blockErrors, isTimeout: true });
    }
  }, [alive, blockFinished, blockErrors]);

  const startTimer = useCallback((durationSec) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const start = performance.now();
    deadlineRef.current = start + durationSec * 1000;
    setTimeLeft(durationSec);
    timerRef.current = setInterval(updateTimerDisplay, 100);
  }, [updateTimerDisplay]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // загрузка раунда
  const loadRound = useCallback(() => {
    const roundPairs = rounds[roundIndex];
    setCurrentRoundPairs(roundPairs);
    const de = shuffleArray(roundPairs.map((p, idx) => ({ text: p.de, pairIdx: idx })));
    const ru = shuffleArray(roundPairs.map((p, idx) => ({ text: p.ru, pairIdx: idx })));
    setDeWords(de);
    setRuWords(ru);
    setSelectedDe(null);
    setSelectedRu(null);
  }, [rounds, roundIndex]);

  // завершение раунда
  const roundDone = useCallback(() => {
    if (roundIndex + 1 < RPB) {
      setRoundIndex(prev => prev + 1);
      setTimeout(() => loadRound(), 400);
    } else {
      // блок завершён
      stopTimer();
      setBlockFinished(true);
      setBlockStat({ errors: blockErrors, isTimeout: false });
    }
  }, [roundIndex, blockErrors, loadRound, stopTimer]);

  // проверка пары
  const checkMatch = useCallback(() => {
    if (!selectedDe || !selectedRu) return;
    const isMatch = selectedDe.pairIdx === selectedRu.pairIdx;
    if (isMatch) {
      // убираем выбранные плитки, помечаем как matched (исчезнут)
      setDeWords(prev => prev.map(w => 
        w.pairIdx === selectedDe.pairIdx ? { ...w, matched: true } : w
      ));
      setRuWords(prev => prev.map(w => 
        w.pairIdx === selectedRu.pairIdx ? { ...w, matched: true } : w
      ));
      setSelectedDe(null);
      setSelectedRu(null);

      // если все пары в раунде сопоставлены
      const allMatched = deWords.every(w => w.matched) && ruWords.every(w => w.matched);
      if (allMatched) {
        setTimeout(() => roundDone(), 400);
      }
    } else {
      // ошибка
      setBlockErrors(prev => prev + 1);
      setTotalErrors(prev => prev + 1);
      setDisableSelection(true);
      // анимация тряски
      const deTile = document.querySelector(`.tile[data-idx='${selectedDe.pairIdx}'][data-side='de']`);
      const ruTile = document.querySelector(`.tile[data-idx='${selectedRu.pairIdx}'][data-side='ru']`);
      if (deTile) deTile.classList.add('shake');
      if (ruTile) ruTile.classList.add('shake');
      setTimeout(() => {
        if (deTile) deTile.classList.remove('shake');
        if (ruTile) ruTile.classList.remove('shake');
        setSelectedDe(null);
        setSelectedRu(null);
        setDisableSelection(false);
      }, 550);
    }
  }, [selectedDe, selectedRu, deWords, ruWords, roundDone]);

  useEffect(() => {
    if (selectedDe && selectedRu && !disableSelection) {
      checkMatch();
    }
  }, [selectedDe, selectedRu, disableSelection, checkMatch]);

  const handleSelectDe = (word) => {
    if (!alive || blockFinished || disableSelection || word.matched) return;
    setSelectedDe(word);
  };

  const handleSelectRu = (word) => {
    if (!alive || blockFinished || disableSelection || word.matched) return;
    setSelectedRu(word);
  };

  // инициализация блока
  const initBlock = useCallback(() => {
    const newRounds = generateRounds();
    setRounds(newRounds);
    setRoundIndex(0);
    setBlockErrors(0);
    setBlockFinished(false);
    setAlive(true);
    setBlockStat(null);
    setDisableSelection(false);
    const time = Math.max(DIFF.min, DIFF.start - blockIndex * DIFF.dec);
    startTimer(time);
  }, [generateRounds, blockIndex, startTimer]);

  useEffect(() => {
    if (!gameFinished && !blockFinished) {
      initBlock();
    }
    // очистка таймера при размонтировании
    return () => stopTimer();
  }, [blockIndex, gameFinished, blockFinished, initBlock]);

  useEffect(() => {
    if (rounds.length > 0 && !blockFinished) {
      loadRound();
    }
  }, [rounds, blockFinished, loadRound]);

  // переход к следующему блоку или финал
  const nextBlock = () => {
    if (blockIndex + 1 < BLOCKS_COUNT) {
      setBlockIndex(prev => prev + 1);
      setBlockFinished(false);
      setBlockStat(null);
    } else {
      // игра окончена
      stopTimer();
      setGameFinished(true);
      setFinalStat({ totalErrors });
    }
  };

  const retryBlock = () => {
    setBlockFinished(false);
    setAlive(true);
    setBlockErrors(0);
    initBlock();
  };

  const restartGame = () => {
    setBlockIndex(0);
    setTotalErrors(0);
    setGameFinished(false);
    setBlockFinished(false);
    setBlockStat(null);
    setFinalStat(null);
  };

  // рендер прогресса раундов (точки)
  const renderRoundDots = () => {
    const dots = [];
    for (let i = 0; i < RPB; i++) {
      let cls = 'w-2 h-2 rounded-full ';
      if (i < roundIndex) cls += 'bg-gray-400 dark:bg-gray-500';
      else if (i === roundIndex) cls += 'bg-blue-600 dark:bg-blue-400 w-3 h-3';
      else cls += 'bg-gray-300 dark:bg-gray-700';
      dots.push(<div key={i} className={cls}></div>);
    }
    return dots;
  };

  // UI для завершённого блока (таймаут или успех)
  if (blockFinished && !gameFinished) {
    const isTimeout = blockStat?.isTimeout;
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        {isTimeout ? (
          <>
            <div className="text-6xl mb-4">⏰</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Время вышло</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Блок {blockIndex + 1} из {BLOCKS_COUNT}. Ошибок: {blockErrors}
            </p>
            <button
              onClick={retryBlock}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Повторить блок
            </button>
          </>
        ) : (
          <>
            <div className="text-6xl mb-4">✓</div>
            <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">
              {blockIndex + 1 === BLOCKS_COUNT ? 'Последний блок пройден!' : 'Блок пройден!'}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Блок {blockIndex + 1} из {BLOCKS_COUNT}. Ошибок: {blockErrors}
            </p>
            <button
              onClick={nextBlock}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              {blockIndex + 1 === BLOCKS_COUNT ? 'Завершить' : 'Следующий блок'}
            </button>
          </>
        )}
        <button
          onClick={onGameEnd}
          className="ml-4 px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Выбрать другие слова
        </button>
      </div>
    );
  }

  if (gameFinished) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Все блоки пройдены!</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">Всего ошибок: {totalErrors}</p>
        <div className="flex justify-center gap-4">
          <button
            onClick={restartGame}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Сыграть снова
          </button>
          <button
            onClick={onGameEnd}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            Выбрать другие слова
          </button>
        </div>
      </div>
    );
  }

  // Основной экран игры
  const progressPercent = (timeLeft / (DIFF.start - blockIndex * DIFF.dec)) * 100;
  let progressColor = 'bg-blue-600';
  if (progressPercent < 25) progressColor = 'bg-red-500';
  else if (progressPercent < 50) progressColor = 'bg-yellow-500';

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-4">
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${progressColor} transition-all duration-100`} style={{ width: `${Math.max(0, progressPercent)}%` }} />
        </div>
      </div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Блок {blockIndex + 1} из {BLOCKS_COUNT}
          </div>
          <div className="flex gap-2 mt-1">
            {renderRoundDots()}
          </div>
        </div>
        <div className={`text-2xl font-mono ${progressPercent < 25 ? 'text-red-600 dark:text-red-400' : progressPercent < 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>
          {Math.ceil(timeLeft)}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          {deWords.map((word, idx) => (
            <div
              key={`de-${idx}`}
              data-side="de"
              data-idx={word.pairIdx}
              onClick={() => handleSelectDe(word)}
              className={`tile p-3 rounded-lg border cursor-pointer transition-all ${
                word.matched ? 'opacity-0 pointer-events-none' : ''
              } ${
                selectedDe?.pairIdx === word.pairIdx && !word.matched
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {word.text}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {ruWords.map((word, idx) => (
            <div
              key={`ru-${idx}`}
              data-side="ru"
              data-idx={word.pairIdx}
              onClick={() => handleSelectRu(word)}
              className={`tile p-3 rounded-lg border cursor-pointer transition-all ${
                word.matched ? 'opacity-0 pointer-events-none' : ''
              } ${
                selectedRu?.pairIdx === word.pairIdx && !word.matched
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 dark:border-blue-400'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {word.text}
            </div>
          ))}
        </div>
      </div>
      <style jsx>{`
        .shake {
          animation: shake 0.28s ease;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          30% { transform: translateX(-7px); }
          70% { transform: translateX(7px); }
        }
      `}</style>
    </div>
  );
}