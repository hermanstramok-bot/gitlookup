import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { normalizeWord } from '../utils/normalizeWord';

// ============================================================
// Модальное окно подтверждения
// ============================================================
function ConfirmModal({ isOpen, title = 'Подтверждение', message, confirmLabel = 'Удалить', onClose, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded max-w-md w-full"
          >
            <div className="p-4 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold dark:text-white">{title}</h2>
            </div>
            <div className="p-4">
              <p className="dark:text-gray-200">{message}</p>
            </div>
            <div className="border-t dark:border-gray-700 p-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Модальное окно сообщений (успех / ошибка)
// ============================================================
function MessageModal({ isOpen, type, title, message, onClose }) {
  const bgColor = type === 'success' ? 'bg-green-50 dark:bg-green-900' : 'bg-red-50 dark:bg-red-900';
  const borderColor = type === 'success' ? 'border-green-500' : 'border-red-500';
  const icon = type === 'success' ? '✅' : '❌';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className={`bg-white dark:bg-gray-800 rounded max-w-md w-full border-l-4 ${borderColor}`}
          >
            <div className="p-4 flex items-start gap-3">
              <div className="text-2xl">{icon}</div>
              <div className="flex-1">
                <h3 className="font-bold text-lg dark:text-white">{title}</h3>
                <p className="text-gray-700 dark:text-gray-300 mt-1">{message}</p>
              </div>
            </div>
            <div className="border-t dark:border-gray-700 p-3 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-1 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Главный компонент Vocab
// ============================================================
export default function Vocab() {
  const { user, logout } = useAuth();
  const [vocab, setVocab] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [sortField, setSortField] = useState('word');
  const [sortDir, setSortDir] = useState('asc');
  const [loading, setLoading] = useState(true);

  // Редактирование
  const [editingId, setEditingId] = useState(null);
  const [editWord, setEditWord] = useState('');
  const [editTranslation, setEditTranslation] = useState('');

  // Добавление нового слова
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newTranslation, setNewTranslation] = useState('');
  const [newStatus, setNewStatus] = useState('new');
  const [sourceType, setSourceType] = useState('existing');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [customSource, setCustomSource] = useState('');
  const [materials, setMaterials] = useState([]);
  const [adding, setAdding] = useState(false);

  // Выделенные ID для массовых операций
  const [selectedIds, setSelectedIds] = useState([]);

  // Модалки подтверждения
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: 'Подтверждение',
    message: '',
    confirmLabel: 'Удалить',
    onConfirm: null,
  });

  // Модалка сообщений
  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showMessage = (type, title, message) => {
    setMessageModal({ isOpen: true, type, title, message });
  };

  const closeMessageModal = () => {
    setMessageModal(prev => ({ ...prev, isOpen: false }));
  };

  const openConfirm = (title, message, confirmLabel, onConfirm) => {
    setConfirmModal({ isOpen: true, title, message, confirmLabel, onConfirm });
  };

  const closeConfirm = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  useEffect(() => {
    fetchVocab();
    fetchMaterials();
  }, []);

  const fetchVocab = async () => {
    try {
      const data = await apiFetch('/api/vocab');
      setVocab(data);
    } catch (error) {
      console.error('Ошибка загрузки словаря:', error);
      showMessage('error', 'Ошибка', 'Не удалось загрузить словарь');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const data = await apiFetch('/api/materials');
      setMaterials(data);
    } catch (err) {
      console.error('Не удалось загрузить материалы', err);
    }
  };

  const handleDelete = (id) => {
    const word = vocab.find(w => w.id === id);
    openConfirm(
      'Удалить слово',
      `Вы уверены, что хотите удалить слово "${word?.word}"?`,
      'Удалить',
      async () => {
        try {
          await apiFetch(`/api/vocab/${id}`, { method: 'DELETE' });
          setVocab(vocab.filter(w => w.id !== id));
          setSelectedIds(selectedIds.filter(sid => sid !== id));
          showMessage('success', 'Успешно', 'Слово удалено');
        } catch (error) {
          console.error('Ошибка удаления слова:', error);
          showMessage('error', 'Ошибка', 'Не удалось удалить слово');
        }
        closeConfirm();
      }
    );
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await apiFetch(`/api/vocab/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      setVocab(vocab.map(w => w.id === id ? { ...w, status: newStatus } : w));
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
      showMessage('error', 'Ошибка', 'Не удалось изменить статус');
    }
  };

  const startEdit = (word) => {
    setEditingId(word.id);
    setEditWord(word.word);
    setEditTranslation(word.translation);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditWord('');
    setEditTranslation('');
  };

  const saveEdit = async (id) => {
    if (!editWord.trim() || !editTranslation.trim()) {
      showMessage('error', 'Ошибка', 'Слово и перевод не могут быть пустыми');
      return;
    }
    try {
      await apiFetch(`/api/vocab/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ word: editWord.trim(), translation: editTranslation.trim() })
      });
      setVocab(vocab.map(w => 
        w.id === id ? { ...w, word: editWord.trim(), translation: editTranslation.trim() } : w
      ));
      cancelEdit();
      showMessage('success', 'Успешно', 'Слово обновлено');
    } catch (error) {
      console.error('Ошибка обновления слова:', error);
      showMessage('error', 'Ошибка', 'Не удалось сохранить изменения');
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim() || !newTranslation.trim()) {
      showMessage('error', 'Ошибка', 'Введите слово и перевод');
      return;
    }
    setAdding(true);
    try {
      const payload = {
        word: newWord.trim(),
        translation: newTranslation.trim(),
        status: newStatus,
        example_sentence: ''
      };
      if (sourceType === 'existing' && selectedSourceId) {
        payload.source_text_id = parseInt(selectedSourceId);
      } else if (sourceType === 'custom' && customSource.trim()) {
        payload.source_custom = customSource.trim();
      }
      await apiFetch('/api/vocab', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setNewWord('');
      setNewTranslation('');
      setSelectedSourceId('');
      setCustomSource('');
      setShowAddForm(false);
      fetchVocab();
      showMessage('success', 'Успешно', 'Слово добавлено');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось добавить слово');
    } finally {
      setAdding(false);
    }
  };

  // Сортировка
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortAlphabet = () => {
    setSortField('word');
    setSortDir('asc');
  };

  const sortRecent = () => {
    setSortField('id');
    setSortDir('desc');
  };

  // Массовые операции
  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map(w => w.id));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
    );
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    openConfirm(
      'Удалить выбранные слова',
      `Вы уверены, что хотите удалить ${selectedIds.length} выбранных слов?`,
      'Удалить все',
      async () => {
        try {
          for (const id of selectedIds) {
            await apiFetch(`/api/vocab/${id}`, { method: 'DELETE' });
          }
          setVocab(vocab.filter(w => !selectedIds.includes(w.id)));
          setSelectedIds([]);
          showMessage('success', 'Успешно', 'Выбранные слова удалены');
        } catch (error) {
          console.error('Ошибка массового удаления:', error);
          showMessage('error', 'Ошибка', 'Не удалось удалить все слова');
        }
        closeConfirm();
      }
    );
  };

  const exportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedWords = vocab.filter(w => selectedIds.includes(w.id));
    exportCSV(selectedWords);
  };

  const sources = [...new Set(vocab.map(w => w.source_title).filter(Boolean))];

  let filtered = vocab;
  if (filter !== 'all') {
    filtered = filtered.filter(w => w.status === filter);
  }
  if (sourceFilter !== 'all') {
    filtered = filtered.filter(w => w.source_title === sourceFilter);
  }
  // Регистронезависимый поиск с нормализацией
  if (searchTerm) {
    const term = normalizeWord(searchTerm);
    filtered = filtered.filter(w =>
      normalizeWord(w.word).includes(term) ||
      normalizeWord(w.translation).includes(term)
    );
  }

  filtered = [...filtered].sort((a, b) => {
    let valA, valB;
    if (sortField === 'word') {
      valA = a.word.toLowerCase();
      valB = b.word.toLowerCase();
    } else if (sortField === 'id') {
      valA = a.id;
      valB = b.id;
    } else {
      return 0;
    }
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const getSortIndicator = (field) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  };

  const statusColors = {
    new: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    learning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100',
    known: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
  };
  const statusLabels = {
    new: 'новое',
    learning: 'изучается',
    known: 'выучено'
  };

  if (loading) return <div className="p-8 dark:text-gray-100">Загрузка...</div>;

  return (
    // ВНЕШНИЙ КОНТЕЙНЕР – фон на всю страницу
    <div className="min-h-screen dark:bg-gray-900">
      {/* ВНУТРЕННИЙ КОНТЕЙНЕР – центрирование содержимого */}
      <div className="p-8 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-4">
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
        <h1 className="text-4xl font-bold mb-2 dark:text-white">📚 Словарь</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Всего слов: {vocab.length}</p>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="mb-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          + Добавить слово / фразу
        </button>

        {showAddForm && (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-8 border border-gray-200 dark:border-gray-600">
            <h3 className="text-xl font-semibold mb-4 dark:text-white">Добавить новое слово</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Слово / Фраза"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                className="p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <input
                type="text"
                placeholder="Перевод"
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                className="p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="new">Новое</option>
                <option value="learning">Изучается</option>
                <option value="known">Выучено</option>
              </select>
              <div className="col-span-2">
                <label className="block text-sm font-semibold dark:text-gray-200 mb-1">Источник:</label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1 dark:text-gray-200">
                    <input type="radio" value="existing" checked={sourceType === 'existing'} onChange={() => setSourceType('existing')} />
                    Выбрать из библиотеки
                  </label>
                  <label className="flex items-center gap-1 dark:text-gray-200">
                    <input type="radio" value="custom" checked={sourceType === 'custom'} onChange={() => setSourceType('custom')} />
                    Указать вручную
                  </label>
                </div>
                {sourceType === 'existing' && (
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  >
                    <option value="">-- Выберите материал --</option>
                    {materials.map(mat => (
                      <option key={mat.id} value={mat.id}>{mat.title}</option>
                    ))}
                  </select>
                )}
                {sourceType === 'custom' && (
                  <input
                    type="text"
                    placeholder="Например: Мои заметки, Фильм и т.д."
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddWord}
                disabled={adding}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {adding ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
              >
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Фильтры и поиск */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg mb-8 border border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold dark:text-gray-200 mb-2">Поиск:</label>
              <input
                type="text"
                placeholder="Слово или перевод"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold dark:text-gray-200 mb-2">Статус:</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <option value="all">Все ({vocab.length})</option>
                <option value="new">Новые ({vocab.filter(w => w.status === 'new').length})</option>
                <option value="learning">Изучаются ({vocab.filter(w => w.status === 'learning').length})</option>
                <option value="known">Выучены ({vocab.filter(w => w.status === 'known').length})</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold dark:text-gray-200 mb-2">Источник:</label>
              <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <option value="all">Все</option>
                {sources.map(src => (
                  <option key={src} value={src}>{src}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold dark:text-gray-200 mb-2">Сортировка:</label>
              <div className="flex gap-2">
                <button
                  onClick={sortAlphabet}
                  className={`px-3 py-1 rounded text-sm ${
                    sortField === 'word' && sortDir === 'asc'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  По алфавиту
                </button>
                <button
                  onClick={sortRecent}
                  className={`px-3 py-1 rounded text-sm ${
                    sortField === 'id' && sortDir === 'desc'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}
                >
                  По recent
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Массовые действия */}
        {selectedIds.length > 0 && (
          <div className="mb-4 flex gap-3 items-center">
            <span className="text-sm dark:text-gray-200">Выбрано: {selectedIds.length}</span>
            <button
              onClick={exportSelected}
              className="bg-green-600 text-white px-4 py-1.5 rounded text-sm hover:bg-green-700"
            >
              📥 Экспорт выбранных
            </button>
            <button
              onClick={deleteSelected}
              className="bg-red-600 text-white px-4 py-1.5 rounded text-sm hover:bg-red-700"
            >
              🗑 Удалить выбранные
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-gray-500 dark:text-gray-400 text-sm underline"
            >
              Снять выделение
            </button>
          </div>
        )}

        {/* Таблица слов */}
        {filtered.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-center py-8">Слова не найдены</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
                  <th className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filtered.length && filtered.length > 0}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="p-3 text-left cursor-pointer dark:text-white" onClick={() => handleSort('word')}>Слово{getSortIndicator('word')}</th>
                  <th className="p-3 text-left cursor-pointer dark:text-white" onClick={() => handleSort('translation')}>Перевод{getSortIndicator('translation')}</th>
                  <th className="p-3 text-left cursor-pointer dark:text-white" onClick={() => handleSort('status')}>Статус{getSortIndicator('status')}</th>
                  <th className="p-3 text-left cursor-pointer dark:text-white" onClick={() => handleSort('source')}>Источник{getSortIndicator('source')}</th>
                  <th className="p-3 text-center min-w-[200px] dark:text-white">Действия</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((word) => (
                  <tr key={word.id} className="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(word.id)}
                        onChange={() => toggleSelectOne(word.id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="p-3 font-semibold dark:text-white">
                      {editingId === word.id ? (
                        <input
                          type="text"
                          value={editWord}
                          onChange={(e) => setEditWord(e.target.value)}
                          className="w-full p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          autoFocus
                        />
                      ) : word.word}
                    </td>
                    <td className="p-3 dark:text-gray-200">
                      {editingId === word.id ? (
                        <input
                          type="text"
                          value={editTranslation}
                          onChange={(e) => setEditTranslation(e.target.value)}
                          className="w-full p-1 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                        />
                      ) : word.translation}
                    </td>
                    <td className="p-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[word.status]}`}>
                        {statusLabels[word.status]}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{word.source_title || '—'}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        {editingId === word.id ? (
                          <>
                            <button
                              onClick={() => saveEdit(word.id)}
                              className="px-3 py-1.5 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                            >
                              Сохранить
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-3 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                            >
                              Отмена
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(word)}
                              className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
                            >
                              Изменить
                            </button>
                            <select
                              value={word.status}
                              onChange={(e) => handleStatusChange(word.id, e.target.value)}
                              className="px-2 py-1.5 border rounded text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                            >
                              <option value="new">Новое</option>
                              <option value="learning">Изучается</option>
                              <option value="known">Выучено</option>
                            </select>
                            <button
                              onClick={() => handleDelete(word.id)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded text-sm hover:bg-red-600"
                            >
                              Удалить
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 pt-8 border-t-2 dark:border-gray-600 flex gap-4">
          <button onClick={() => exportCSV(vocab)} className="bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700">
            📥 Экспорт всего
          </button>
        </div>

        {/* Модалки */}
        <ConfirmModal
          isOpen={confirmModal.isOpen}
          title={confirmModal.title}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          onClose={closeConfirm}
          onConfirm={confirmModal.onConfirm}
        />

        <MessageModal
          isOpen={messageModal.isOpen}
          type={messageModal.type}
          title={messageModal.title}
          message={messageModal.message}
          onClose={closeMessageModal}
        />
      </div>
    </div>
  );
}

function exportCSV(vocab) {
  if (vocab.length === 0) {
    alert('Нет слов для экспорта');
    return;
  }
  let csv = 'Слово,Перевод\n';
  vocab.forEach(w => {
    csv += `"${w.word}","${w.translation}"\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'vocabulary.csv');
  link.click();
}