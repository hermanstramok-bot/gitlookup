import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import { useDarkMode } from '../hooks/useDarkMode';
import FlashcardDeck from '../components/games/FlashcardDeck';

// ===== ФИЛЬТРЫ: МАТЕРИАЛ + СТАТУС (независимые) =====
function WordFilters({ materials, selectedMaterialId, setSelectedMaterialId, selectedStatus, setSelectedStatus }) {
  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="material" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Материал
        </label>
        <select
          id="material"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          value={selectedMaterialId}
          onChange={(e) => setSelectedMaterialId(e.target.value)}
        >
          <option value="">Все материалы</option>
          {materials.map((mat) => (
            <option key={mat.id} value={mat.id}>
              {mat.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Статус
        </label>
        <select
          id="status"
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="all">Все статусы</option>
          <option value="new">Новое</option>
          <option value="learning">Изучается</option>
          <option value="known">Выучено</option>
        </select>
      </div>
    </div>
  );
}

// ===== БЛОК FLASHCARDS (использует FlashcardDeck) =====
// ===== БЛОК FLASHCARDS (использует FlashcardDeck) =====
function FlashcardsBlock() {
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [materials, setMaterials] = useState([]);
  const [words, setWords] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/materials')
      .then((data) => setMaterials(data))
      .catch(() => console.error('Failed to load materials'));
  }, []);

  const startFlashcards = async () => {
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMaterialId) params.append('source_text_id', selectedMaterialId);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      const url = `/api/flashcards${params.toString() ? '?' + params.toString() : ''}`;
      const data = await apiFetch(url);
      if (!data.words || data.words.length < 2) {
        setError('Недостаточно слов для флешкарт (минимум 2).');
        setLoading(false);
        return;
      }
      setWords(data.words);
      setIsRunning(true);
    } catch (err) {
      setError('Ошибка загрузки слов. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const finishFlashcards = () => {
    setIsRunning(false);
    setWords([]);
  };

  // Если флешкарты запущены – рендерим полноэкранный компонент
  if (isRunning && words.length > 0) {
    return <FlashcardDeck words={words} onFinish={finishFlashcards} />;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">📖 Flashcards</h2>
      <WordFilters
        materials={materials}
        selectedMaterialId={selectedMaterialId}
        setSelectedMaterialId={setSelectedMaterialId}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
      />
      {error && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</div>}
      <button
        onClick={startFlashcards}
        disabled={loading}
        className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Загрузка...' : 'Начать флешкарты'}
      </button>
    </div>
  );
}
// ===== БЛОК GAMES =====
const GAME_TYPES = [
  { id: 'translate', label: 'TranslateMe', icon: '🔤' },
  { id: 'fillblank', label: 'FillTheBlank', icon: '✏️' },
  { id: 'speed', label: 'SpeedWording', icon: '⏱️' },
  { id: 'earpair', label: 'EarPair', icon: '🎧' },
];

function GamesBlock() {
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [materials, setMaterials] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [gameState, setGameState] = useState('idle');
  const [gameData, setGameData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/materials')
      .then((data) => setMaterials(data))
      .catch(() => console.error('Failed to load materials'));
  }, []);

  const startGame = async () => {
    if (!selectedGame) {
      setError('Выберите игру');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedMaterialId) params.append('source_text_id', selectedMaterialId);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);
      const url = `/api/games/${selectedGame}${params.toString() ? '?' + params.toString() : ''}`;
      const data = await apiFetch(url);
      if (!data.words || data.words.length < 2) {
        setError('Недостаточно слов для игры (минимум 2).');
        setLoading(false);
        return;
      }
      setGameData(data);
      setGameState('playing');
    } catch (err) {
      setError('Ошибка загрузки игры. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const endGame = () => {
    setGameState('idle');
    setGameData(null);
    setSelectedGame(null);
  };

  if (gameState === 'playing' && gameData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            {GAME_TYPES.find((g) => g.id === selectedGame)?.label}
          </h3>
          <button
            onClick={endGame}
            className="text-sm text-red-600 dark:text-red-400 hover:underline"
          >
            Выйти
          </button>
        </div>
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-300">
            Игровой режим <strong>{selectedGame}</strong> в разработке.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Загружено {gameData.words.length} слов.
          </p>
          <button
            onClick={endGame}
            className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
          >
            Завершить игру (демо)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">🎮 Games</h2>

      <div className="grid grid-cols-2 gap-3 mb-4">
        {GAME_TYPES.map((game) => (
          <button
            key={game.id}
            onClick={() => setSelectedGame(game.id)}
            className={`p-3 border rounded-md text-center transition-colors ${
              selectedGame === game.id
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <div className="text-2xl">{game.icon}</div>
            <div className="text-sm font-medium">{game.label}</div>
          </button>
        ))}
      </div>

      <WordFilters
        materials={materials}
        selectedMaterialId={selectedMaterialId}
        setSelectedMaterialId={setSelectedMaterialId}
        selectedStatus={selectedStatus}
        setSelectedStatus={setSelectedStatus}
      />

      {error && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</div>}

      <button
        onClick={startGame}
        disabled={loading || !selectedGame}
        className="mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Загрузка...' : 'Начать игру'}
      </button>
    </div>
  );
}

// ===== БЛОК DAILY STREAK =====
function DailyStreakBlock() {
  const [streak, setStreak] = useState(0);
  const [weekDays, setWeekDays] = useState([]);
  const [canRecover, setCanRecover] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/streak')
      .then((data) => {
        setStreak(data.streak || 0);
        setWeekDays(data.weekDays || []);
        setCanRecover(data.canRecover || false);
        setLoading(false);
      })
      .catch(() => {
        // Заглушка
        setStreak(5);
        setWeekDays([
          { day: 'Пн', done: true },
          { day: 'Вт', done: true },
          { day: 'Ср', done: true },
          { day: 'Чт', done: false },
          { day: 'Пт', done: false },
          { day: 'Сб', done: false },
          { day: 'Вс', done: false },
        ]);
        setCanRecover(true);
        setLoading(false);
      });
  }, []);

  if (loading)
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center dark:text-gray-300">
        Загрузка...
      </div>
    );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">🔥 Daily Streak</h2>

      <div className="flex items-center justify-between">
        <div className="text-3xl font-bold text-orange-500 dark:text-orange-400">{streak}</div>
        <div className="text-sm text-gray-500 dark:text-gray-400">дней подряд</div>
      </div>

      <div className="flex justify-between mt-4">
        {weekDays.map((day, idx) => (
          <div key={idx} className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                day.done
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
              }`}
            >
              {day.done ? '✓' : '○'}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{day.day}</span>
          </div>
        ))}
      </div>

      {canRecover && (
        <p className="mt-4 text-sm font-bold text-yellow-700 dark:text-yellow-300">
          Пройди 7 игр чтобы восстановить серию
        </p>
      )}

      <div className="mt-4 text-xs text-gray-400 dark:text-gray-500">
        Ежедневная цель: 3 игровые сессии
      </div>
    </div>
  );
}

// ===== ГЛАВНАЯ СТРАНИЦА TRAINER =====
export default function Trainer() {
  const { user, logout } = useAuth();
  useDarkMode();

  return (
    <div className="min-h-screen dark:bg-gray-900">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Верхняя навигация */}
        <div className="flex justify-between items-center mb-6">
          <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            ← Назад в библиотеку
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm dark:text-gray-300">👋 {user?.username}</span>
            <button
              onClick={logout}
              className="text-sm text-red-600 dark:text-red-400 hover:underline"
            >
              Выйти
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Тренировка</h1>

        {/* Три независимых блока */}
        <div className="space-y-8">
          <FlashcardsBlock />
          <GamesBlock />
          <DailyStreakBlock />
        </div>

        {/* Декоративная картинка */}
        <div className="flex justify-center mt-8">
          <img
            src="/icons/happy.doggy.png"
            alt="Собачка делает упражнения"
            className="w-48 h-48 object-contain"
          />
        </div>
      </div>
    </div>
  );
}