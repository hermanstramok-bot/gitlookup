import { useState, useEffect } from 'react';
import MatchingGame from '../components/MatchingGame';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

export default function Trainer() {
  const { user, logout } = useAuth();
  const [sourceType, setSourceType] = useState('all');
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [materialsList, setMaterialsList] = useState([]);
  const [gamePairs, setGamePairs] = useState([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/materials')
      .then(data => setMaterialsList(data))
      .catch(err => console.error('Failed to load materials:', err));
  }, []);

  const handleStartGame = async () => {
    setError('');
    setLoading(true);
    try {
      let url = '/api/vocab/trainer';
      if (sourceType === 'material' && selectedMaterialId) {
        url += `?source_text_id=${selectedMaterialId}`;
      }
      const data = await apiFetch(url);
      const words = data.words || [];
      if (words.length < 2) {
        setError('Недостаточно слов для тренировки (нужно минимум 2 пары).');
        setLoading(false);
        return;
      }
      setGamePairs(words);
      setGameStarted(true);
    } catch (err) {
      console.error(err);
      setError('Ошибка загрузки слов. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const handleGameEnd = () => {
    setGameStarted(false);
    setGamePairs([]);
  };

  if (gameStarted) {
    return <MatchingGame pairs={gamePairs} onGameEnd={handleGameEnd} />;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
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

      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Тренажёр немецких слов</h1>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Источник слов
            </label>
            <div className="flex gap-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-blue-600 dark:text-blue-400"
                  name="sourceType"
                  value="all"
                  checked={sourceType === 'all'}
                  onChange={() => setSourceType('all')}
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">Все слова</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio text-blue-600 dark:text-blue-400"
                  name="sourceType"
                  value="material"
                  checked={sourceType === 'material'}
                  onChange={() => setSourceType('material')}
                />
                <span className="ml-2 text-gray-700 dark:text-gray-300">По материалу</span>
              </label>
            </div>
          </div>

          {sourceType === 'material' && (
            <div>
              <label htmlFor="material" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Выберите материал
              </label>
              <select
                id="material"
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
              >
                <option value="">-- Выберите --</option>
                {materialsList.map(mat => (
                  <option key={mat.id} value={mat.id}>{mat.title}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm">{error}</div>
          )}

          <button
            onClick={handleStartGame}
            disabled={loading || (sourceType === 'material' && !selectedMaterialId)}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Загрузка...' : 'Начать тренировку'}
          </button>
        </div>
      </div>

      <div className="flex justify-center mt-4">
        <img
          src="/icons/happy.doggy.png"
          alt="Собачка делает упражнения"
          className="w-64 h-64 object-contain"
        />
      </div>
    </div>
  );
}