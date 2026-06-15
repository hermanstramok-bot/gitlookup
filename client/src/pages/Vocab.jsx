import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Vocab() {
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

  useEffect(() => {
    fetchVocab();
    fetchMaterials();
  }, []);

  const fetchVocab = async () => {
    try {
      const response = await fetch('/api/vocab');
      const data = await response.json();
      setVocab(data);
    } catch (error) {
      console.error('Ошибка загрузки словаря:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMaterials = async () => {
    try {
      const res = await fetch('/api/materials');
      const data = await res.json();
      setMaterials(data);
    } catch (err) {
      console.error('Не удалось загрузить материалы', err);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Удалить это слово?')) {
      try {
        await fetch(`/api/vocab/${id}`, { method: 'DELETE' });
        setVocab(vocab.filter(w => w.id !== id));
      } catch (error) {
        console.error('Ошибка удаления слова:', error);
      }
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await fetch(`/api/vocab/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      setVocab(vocab.map(w => w.id === id ? { ...w, status: newStatus } : w));
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
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
      alert('Слово и перевод не могут быть пустыми');
      return;
    }
    try {
      const response = await fetch(`/api/vocab/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: editWord.trim(), translation: editTranslation.trim() })
      });
      if (response.ok) {
        setVocab(vocab.map(w => 
          w.id === id ? { ...w, word: editWord.trim(), translation: editTranslation.trim() } : w
        ));
        cancelEdit();
      } else {
        alert('Ошибка при сохранении');
      }
    } catch (error) {
      console.error('Ошибка обновления слова:', error);
      alert('Ошибка сети');
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim() || !newTranslation.trim()) {
      alert('Введите слово и перевод');
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
      const response = await fetch('/api/vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setNewWord('');
        setNewTranslation('');
        setSelectedSourceId('');
        setCustomSource('');
        setShowAddForm(false);
        fetchVocab();
      } else {
        alert('Ошибка при добавлении');
      }
    } catch (err) {
      console.error(err);
      alert('Ошибка сети');
    } finally {
      setAdding(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sources = [...new Set(vocab.map(w => w.source_title).filter(Boolean))];

  let filtered = vocab;
  if (filter !== 'all') {
    filtered = filtered.filter(w => w.status === filter);
  }
  if (sourceFilter !== 'all') {
    filtered = filtered.filter(w => w.source_title === sourceFilter);
  }
  if (searchTerm) {
    filtered = filtered.filter(w =>
      w.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.translation.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  filtered = [...filtered].sort((a, b) => {
    let valA, valB;
    switch (sortField) {
      case 'word':
        valA = a.word.toLowerCase();
        valB = b.word.toLowerCase();
        break;
      case 'translation':
        valA = a.translation.toLowerCase();
        valB = b.translation.toLowerCase();
        break;
      case 'status':
        valA = a.status;
        valB = b.status;
        break;
      case 'source':
        valA = (a.source_title || '').toLowerCase();
        valB = (b.source_title || '').toLowerCase();
        break;
      default:
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
  const statusEmojis = { new: '💙', learning: '💛', known: '💚' };

  if (loading) return <div className="p-8 dark:text-gray-100">Загрузка...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen">
      <Link to="/" className="text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block">
        ← Назад в библиотеку
      </Link>
      <h1 className="text-4xl font-bold mb-2 dark:text-white">📚 Словарь</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-4">Всего слов: {vocab.length}</p>

      {/* Кнопка добавления — всегда видна */}
      <button
        onClick={() => setShowAddForm(!showAddForm)}
        className="mb-6 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
      >
        + Добавить слово / фразу
      </button>

      {/* Форма добавления (показывается только когда showAddForm = true) */}
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
                <label className="flex items-center gap-1">
                  <input type="radio" value="existing" checked={sourceType === 'existing'} onChange={() => setSourceType('existing')} />
                  Выбрать из библиотеки
                </label>
                <label className="flex items-center gap-1">
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
              <option value="new">💙 Новые ({vocab.filter(w => w.status === 'new').length})</option>
              <option value="learning">💛 Изучаются ({vocab.filter(w => w.status === 'learning').length})</option>
              <option value="known">💚 Выучены ({vocab.filter(w => w.status === 'known').length})</option>
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
        </div>
      </div>

      {/* Таблица слов */}
      {filtered.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-8">Слова не найдены</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-200 dark:bg-gray-700 border-b-2 border-gray-400 dark:border-gray-600">
                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('word')}>Слово{getSortIndicator('word')}</th>
                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('translation')}>Перевод{getSortIndicator('translation')}</th>
                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('status')}>Статус{getSortIndicator('status')}</th>
                <th className="p-3 text-left cursor-pointer" onClick={() => handleSort('source')}>Источник{getSortIndicator('source')}</th>
                <th className="p-3 text-center">Действия</th>
               </tr>
            </thead>
            <tbody>
              {filtered.map((word) => (
                <tr key={word.id} className="border-b dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="p-3 font-semibold dark:text-white">
                    {editingId === word.id ? (
                      <input type="text" value={editWord} onChange={(e) => setEditWord(e.target.value)} className="w-full p-1 border rounded" autoFocus />
                    ) : word.word}
                   </td>
                  <td className="p-3 dark:text-gray-200">
                    {editingId === word.id ? (
                      <input type="text" value={editTranslation} onChange={(e) => setEditTranslation(e.target.value)} className="w-full p-1 border rounded" />
                    ) : word.translation}
                   </td>
                  <td className="p-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColors[word.status]}`}>
                      {statusEmojis[word.status]} {word.status === 'new' ? 'новое' : word.status === 'learning' ? 'изучается' : 'выучено'}
                    </span>
                   </td>
                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">{word.source_title || '—'}</td>
                  <td className="p-3 text-center space-x-2">
                    {editingId === word.id ? (
                      <>
                        <button onClick={() => saveEdit(word.id)} className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600">Сохранить</button>
                        <button onClick={cancelEdit} className="px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600">Отмена</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEdit(word)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">Изменить</button>
                        <select value={word.status} onChange={(e) => handleStatusChange(word.id, e.target.value)} className="px-2 py-1 border rounded text-sm bg-white dark:bg-gray-700">
                          <option value="new">Новое</option>
                          <option value="learning">Изучается</option>
                          <option value="known">Выучено</option>
                        </select>
                        <button onClick={() => handleDelete(word.id)} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600">Удалить</button>
                      </>
                    )}
                   </td>
                 </tr>
              ))}
            </tbody>
           </table>
        </div>
      )}

      <div className="mt-8 pt-8 border-t-2 dark:border-gray-600">
        <button onClick={() => exportCSV(vocab)} className="bg-green-600 text-white px-6 py-3 rounded font-semibold hover:bg-green-700">
          📥 Экспорт в CSV
        </button>
      </div>
    </div>
  );
}

function exportCSV(vocab) {
  if (vocab.length === 0) {
    alert('Нет слов для экспорта');
    return;
  }
  const headers = ['Слово', 'Перевод', 'Статус', 'Источник'];
  const rows = vocab.map(w => [w.word, w.translation, w.status === 'new' ? 'Новое' : w.status === 'learning' ? 'Изучается' : 'Выучено', w.source_title || '']);
  let csv = headers.join(',') + '\n';
  rows.forEach(row => {
    csv += row.map(cell => `"${cell}"`).join(',') + '\n';
  });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'vocabulary.csv');
  link.click();
}