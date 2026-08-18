import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../utils/api';
import { normalizeWord } from '../utils/normalizeWord';
import { useI18n } from '../context/I18nContext';
import {
  sans, serif, useLibraryFonts,
  IconArrowLeft, IconPencil, IconTrash, IconCheck, IconClose, IconSearch,
  MessageModal, ConfirmModal, STATUS_MAP,
} from '../design/designSystem';

// ============================================================
// Главный компонент Vocab
// ============================================================
export default function Vocab() {
  useLibraryFonts();
  const { t } = useI18n();
  const [vocab, setVocab] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  // Spec 2 (доп., п.12): множественный выбор материалов-источников вместо
  // одного — пустой массив означает "все материалы".
  const [sourceFilters, setSourceFilters] = useState([]);
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const sourceDropdownRef = useRef(null);
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
    title: t('vocab_confirm_title'),
    message: '',
    confirmLabel: t('vocab_delete_label'),
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target)) {
        setSourceDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSourceFilter = (source) => {
    setSourceFilters(prev => prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]);
  };

  const fetchVocab = async () => {
    try {
      const data = await apiFetch('/api/vocab');
      setVocab(data);
    } catch (error) {
      console.error('Ошибка загрузки словаря:', error);
      showMessage('error', t('vocab_error_title'), t('vocab_error_load'));
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
      t('vocab_confirm_delete_word_title'),
      t('vocab_confirm_delete_word_message', { word: word?.word }),
      t('vocab_delete_label'),
      async () => {
        try {
          await apiFetch(`/api/vocab/${id}`, { method: 'DELETE' });
          setVocab(vocab.filter(w => w.id !== id));
          setSelectedIds(selectedIds.filter(sid => sid !== id));
          showMessage('success', t('vocab_success_title'), t('vocab_word_deleted'));
        } catch (error) {
          console.error('Ошибка удаления слова:', error);
          showMessage('error', t('vocab_error_title'), t('vocab_error_delete'));
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
      showMessage('error', t('vocab_error_title'), t('vocab_error_status'));
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
      showMessage('error', t('vocab_error_title'), t('vocab_error_empty_fields'));
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
      showMessage('success', t('vocab_success_title'), t('vocab_word_updated'));
    } catch (error) {
      console.error('Ошибка обновления слова:', error);
      showMessage('error', t('vocab_error_title'), t('vocab_error_save_changes'));
    }
  };

  const handleAddWord = async () => {
    if (!newWord.trim() || !newTranslation.trim()) {
      showMessage('error', t('vocab_error_title'), t('vocab_error_enter_word'));
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
      showMessage('success', t('vocab_success_title'), t('vocab_word_added'));
    } catch (err) {
      console.error(err);
      showMessage('error', t('vocab_error_title'), t('vocab_error_add'));
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
      t('vocab_confirm_delete_selected_title'),
      t('vocab_confirm_delete_selected_message', { count: selectedIds.length }),
      t('vocab_delete_all_label'),
      async () => {
        try {
          for (const id of selectedIds) {
            await apiFetch(`/api/vocab/${id}`, { method: 'DELETE' });
          }
          setVocab(vocab.filter(w => !selectedIds.includes(w.id)));
          setSelectedIds([]);
          showMessage('success', t('vocab_success_title'), t('vocab_words_deleted'));
        } catch (error) {
          console.error('Ошибка массового удаления:', error);
          showMessage('error', t('vocab_error_title'), t('vocab_error_delete_all'));
        }
        closeConfirm();
      }
    );
  };

  const exportSelected = () => {
    if (selectedIds.length === 0) return;
    const selectedWords = vocab.filter(w => selectedIds.includes(w.id));
    exportCSV(selectedWords, t);
  };

  const sources = [...new Set(vocab.map(w => w.source_title).filter(Boolean))];

  let filtered = vocab;
  if (filter !== 'all') {
    filtered = filtered.filter(w => w.status === filter);
  }
  if (sourceFilters.length > 0) {
    filtered = filtered.filter(w => sourceFilters.includes(w.source_title));
  }
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
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  // Map Vocab's 3-state status ('new' | 'learning' | 'known') onto the
  // shared STATUS_MAP tokens. 'known' reuses the 'completed' visual.
  const statusVisual = (status) => STATUS_MAP[status === 'known' ? 'completed' : status] || STATUS_MAP.new;
  const statusLabels = {
    new: t('vocab_status_pill_new'),
    learning: t('vocab_status_pill_learning'),
    known: t('vocab_status_pill_known'),
  };

  const inputClass = 'w-full px-3 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-xl bg-[#FFFFFF] dark:bg-[#0B1220] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent transition';
  const selectClass = inputClass;

  if (loading) return (
    <div className="min-h-screen bg-[#F2F4F7] dark:bg-[#0F172A] flex items-center justify-center text-[#64748B] dark:text-[#94A3B8] text-sm" style={sans}>
      {t('common_loading')}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F2F4F7] dark:bg-[#0F172A] transition-colors duration-300" style={sans}>
      <div className="p-6 sm:p-8 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#1560E8] dark:hover:text-[#5B9CFF] transition"
          >
            <IconArrowLeft className="w-4 h-4" /> {t('common_back_to_library')}
          </Link>
        </div>
        <h1 className="text-4xl font-bold mb-1 text-[#0F172A] dark:text-white tracking-tight" style={serif}>{t('vocab_title')}</h1>
        <p className="text-[#64748B] dark:text-[#94A3B8] text-sm mb-6">{t('vocab_total_words', { count: vocab.length })}</p>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="mb-6 bg-[#1560E8] hover:bg-[#114FC4] text-white font-medium text-sm py-2.5 px-4 rounded-full transition shadow-sm inline-flex items-center gap-1.5"
        >
          <span className="text-base leading-none">+</span> {t('vocab_add_word_button_label')}
        </button>

        {showAddForm && (
          <div className="bg-white dark:bg-[#16202E] p-6 rounded-2xl mb-8 border border-[#E2E8F0] dark:border-[#263447] shadow-[0_1px_2px_rgba(15,23,32,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            <h3 className="text-xl font-semibold mb-4 text-[#0F172A] dark:text-white" style={serif}>{t('vocab_add_form_title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder={t('vocab_word_placeholder')}
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder={t('vocab_translation_placeholder')}
                value={newTranslation}
                onChange={(e) => setNewTranslation(e.target.value)}
                className={inputClass}
              />
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className={selectClass}
              >
                <option value="new">{t('vocab_status_new')}</option>
                <option value="learning">{t('vocab_status_learning')}</option>
                <option value="known">{t('vocab_status_known')}</option>
              </select>
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mb-2">{t('vocab_source_label')}</label>
                <div className="flex gap-4 mb-2 flex-wrap">
                  <label className="flex items-center gap-1.5 text-[#334155] dark:text-[#CBD5E1] text-sm">
                    <input type="radio" value="existing" checked={sourceType === 'existing'} onChange={() => setSourceType('existing')} className="accent-[#1560E8]" />
                    {t('vocab_source_existing')}
                  </label>
                  <label className="flex items-center gap-1.5 text-[#334155] dark:text-[#CBD5E1] text-sm">
                    <input type="radio" value="custom" checked={sourceType === 'custom'} onChange={() => setSourceType('custom')} className="accent-[#1560E8]" />
                    {t('vocab_source_custom')}
                  </label>
                </div>
                {sourceType === 'existing' && (
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="">{t('vocab_source_select_placeholder')}</option>
                    {materials.map(mat => (
                      <option key={mat.id} value={mat.id}>{mat.title}</option>
                    ))}
                  </select>
                )}
                {sourceType === 'custom' && (
                  <input
                    type="text"
                    placeholder={t('vocab_source_custom_placeholder')}
                    value={customSource}
                    onChange={(e) => setCustomSource(e.target.value)}
                    className={inputClass}
                  />
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleAddWord}
                disabled={adding}
                className="bg-[#1560E8] hover:bg-[#114FC4] text-white font-medium text-sm py-2 px-4 rounded-full transition disabled:opacity-50 shadow-sm"
              >
                {adding ? t('vocab_saving') : t('vocab_save')}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="border border-[#CBD5E1] dark:border-[#35465C] text-[#334155] dark:text-[#CBD5E1] font-medium text-sm py-2 px-4 rounded-full hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition"
              >
                {t('vocab_cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Фильтры и поиск */}
        <div className="bg-white dark:bg-[#16202E] p-6 rounded-2xl mb-8 border border-[#E2E8F0] dark:border-[#263447] shadow-[0_1px_2px_rgba(15,23,32,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mb-2">{t('vocab_search_label')}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-[#64748B]">
                  <IconSearch className="w-3.5 h-3.5" />
                </span>
                <input
                  type="text"
                  placeholder={t('vocab_search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={`${inputClass} pl-8`}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mb-2">{t('vocab_status_filter_label')}</label>
              <select value={filter} onChange={(e) => setFilter(e.target.value)} className={selectClass}>
                <option value="all">{t('vocab_status_all_count', { count: vocab.length })}</option>
                <option value="new">{t('vocab_status_new_count', { count: vocab.filter(w => w.status === 'new').length })}</option>
                <option value="learning">{t('vocab_status_learning_count', { count: vocab.filter(w => w.status === 'learning').length })}</option>
                <option value="known">{t('vocab_status_known_count', { count: vocab.filter(w => w.status === 'known').length })}</option>
              </select>
            </div>
            <div className="relative" ref={sourceDropdownRef}>
              <label className="block text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mb-2">{t('vocab_source_label')}</label>
              <button
                type="button"
                onClick={() => setSourceDropdownOpen(prev => !prev)}
                className={`${selectClass} text-left flex items-center justify-between`}
              >
                <span className="truncate">
                  {sourceFilters.length === 0 ? t('vocab_source_all') : t('vocab_source_selected_count', { count: sourceFilters.length })}
                </span>
                <span className="text-[#94A3B8] ml-2">▾</span>
              </button>
              {sourceDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white dark:bg-[#0B1220] border border-[#CBD5E1] dark:border-[#35465C] rounded-xl shadow-lg p-2">
                  {sources.length === 0 ? (
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center py-2">{t('vocab_source_empty')}</p>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setSourceFilters([])}
                        className="w-full text-left text-xs font-medium text-[#1560E8] hover:underline px-2 py-1"
                      >
                        {t('vocab_source_reset')}
                      </button>
                      {sources.map(src => (
                        <label key={src} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] cursor-pointer text-sm text-[#334155] dark:text-[#CBD5E1]">
                          <input
                            type="checkbox"
                            checked={sourceFilters.includes(src)}
                            onChange={() => toggleSourceFilter(src)}
                            className="w-3.5 h-3.5 accent-[#1560E8]"
                          />
                          <span className="truncate">{src}</span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mb-2">{t('vocab_sort_label')}</label>
              <div className="flex gap-2">
                <button
                  onClick={sortAlphabet}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    sortField === 'word' && sortDir === 'asc'
                      ? 'bg-[#1560E8] text-white'
                      : 'bg-[#F8FAFC] dark:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#263447]'
                  }`}
                >
                  {t('vocab_sort_alphabet')}
                </button>
                <button
                  onClick={sortRecent}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                    sortField === 'id' && sortDir === 'desc'
                      ? 'bg-[#1560E8] text-white'
                      : 'bg-[#F8FAFC] dark:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#E2E8F0] dark:hover:bg-[#263447]'
                  }`}
                >
                  {t('vocab_sort_recent')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Массовые действия */}
        {selectedIds.length > 0 && (
          <div className="mb-4 flex gap-3 items-center flex-wrap">
            <span className="text-sm text-[#334155] dark:text-[#CBD5E1]">{t('vocab_selected_count', { count: selectedIds.length })}</span>
            <button
              onClick={exportSelected}
              className="bg-[#1FB854] hover:bg-[#17A34A] text-white px-4 py-1.5 rounded-full text-sm font-medium transition"
            >
              {t('vocab_export_selected')}
            </button>
            <button
              onClick={deleteSelected}
              className="bg-[#E23D3D] hover:bg-[#C42E2E] text-white px-4 py-1.5 rounded-full text-sm font-medium transition"
            >
              {t('vocab_delete_selected')}
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-[#64748B] dark:text-[#94A3B8] text-sm hover:underline"
            >
              {t('vocab_deselect')}
            </button>
          </div>
        )}

        {/* Таблица слов */}
        {filtered.length === 0 ? (
          <p className="text-[#64748B] dark:text-[#94A3B8] text-center py-12 text-sm">{t('vocab_empty')}</p>
        ) : (
          <div className="bg-white dark:bg-[#16202E] rounded-2xl border border-[#E2E8F0] dark:border-[#263447] shadow-[0_1px_2px_rgba(15,23,32,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse" style={sans}>
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-[#1E2A3B] border-b border-[#E2E8F0] dark:border-[#263447]">
                    <th className="p-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filtered.length && filtered.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 accent-[#1560E8]"
                      />
                    </th>
                    <th className="p-3 text-left text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] cursor-pointer select-none" onClick={() => handleSort('word')}>{t('vocab_table_word')}{getSortIndicator('word')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] cursor-pointer select-none" onClick={() => handleSort('translation')}>{t('vocab_table_translation')}{getSortIndicator('translation')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] cursor-pointer select-none" onClick={() => handleSort('status')}>{t('vocab_table_status')}{getSortIndicator('status')}</th>
                    <th className="p-3 text-left text-sm font-semibold text-[#334155] dark:text-[#CBD5E1] cursor-pointer select-none" onClick={() => handleSort('source')}>{t('vocab_table_source')}{getSortIndicator('source')}</th>
                    <th className="p-3 text-center min-w-[220px] text-sm font-semibold text-[#334155] dark:text-[#CBD5E1]">{t('vocab_table_actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((word) => {
                    const visual = statusVisual(word.status);
                    return (
                      <tr key={word.id} className="border-b border-[#E2E8F0] dark:border-[#263447] last:border-0 hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]/60 transition-colors">
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(word.id)}
                            onChange={() => toggleSelectOne(word.id)}
                            className="w-4 h-4 accent-[#1560E8]"
                          />
                        </td>
                        <td className="p-3 font-semibold text-[#0F172A] dark:text-white text-sm">
                          {editingId === word.id ? (
                            <input
                              type="text"
                              value={editWord}
                              onChange={(e) => setEditWord(e.target.value)}
                              className={`${inputClass} py-1.5`}
                              autoFocus
                            />
                          ) : word.word}
                        </td>
                        <td className="p-3 text-[#334155] dark:text-[#CBD5E1] text-sm">
                          {editingId === word.id ? (
                            <input
                              type="text"
                              value={editTranslation}
                              onChange={(e) => setEditTranslation(e.target.value)}
                              className={`${inputClass} py-1.5`}
                            />
                          ) : word.translation}
                        </td>
                        <td className="p-3">
                          <span className={`${visual.bg} ${visual.text} rounded-full pl-1.5 pr-2.5 py-1 text-[11px] font-medium inline-flex items-center gap-1.5`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${visual.dot}`} />
                            {statusLabels[word.status]}
                          </span>
                        </td>
                        <td className="p-3 text-sm text-[#64748B] dark:text-[#94A3B8]">{word.source_title || '—'}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                            {editingId === word.id ? (
                              <>
                                <button
                                  onClick={() => saveEdit(word.id)}
                                  className="p-1.5 rounded-lg bg-[#1FB854] hover:bg-[#17A34A] text-white transition"
                                  title={t('vocab_save')}
                                >
                                  <IconCheck className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="p-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#35465C] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition"
                                  title={t('vocab_cancel')}
                                >
                                  <IconClose className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => startEdit(word)}
                                  className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition"
                                  title={t('vocab_action_edit_title')}
                                >
                                  <IconPencil className="w-3.5 h-3.5" />
                                </button>
                                <select
                                  value={word.status}
                                  onChange={(e) => handleStatusChange(word.id, e.target.value)}
                                  className="px-2 py-1.5 border border-[#CBD5E1] dark:border-[#35465C] rounded-lg text-sm bg-[#FFFFFF] dark:bg-[#0B1220] text-[#0F172A] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1560E8]"
                                >
                                  <option value="new">{t('vocab_status_new')}</option>
                                  <option value="learning">{t('vocab_status_learning')}</option>
                                  <option value="known">{t('vocab_status_known')}</option>
                                </select>
                                <button
                                  onClick={() => handleDelete(word.id)}
                                  className="p-1.5 rounded-lg text-[#64748B] dark:text-[#94A3B8] hover:text-[#E23D3D] hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition"
                                  title={t('vocab_action_delete_title')}
                                >
                                  <IconTrash className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-8 pt-8 border-t border-[#E2E8F0] dark:border-[#263447] flex gap-4">
          <button
            onClick={() => exportCSV(filtered, t)}
            className="bg-[#1FB854] hover:bg-[#17A34A] text-white px-6 py-3 rounded-full font-medium text-sm transition shadow-sm"
          >
            {t('vocab_export_list', { count: filtered.length })}
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

function exportCSV(vocab, t) {
  if (vocab.length === 0) {
    alert(t('vocab_error_export_empty'));
    return;
  }
  let csv = `${t('vocab_csv_header')}\n`;
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