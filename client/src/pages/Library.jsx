import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiFetch } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import YouTubeImportModal from '../components/YouTubeImportModal';
import TextImportModal from '../components/TextImportModal';
import IconPicker from '../components/IconPicker';
import { PRESET_ICONS, DEFAULT_ICON } from '../constants';
import {
  sans, useLibraryFonts,
  IconPencil, IconTrash, IconArrowRight, IconFolder, IconChevronRight,
  IconClose, IconSearch, IconFilm, IconBook, IconFilter,
  MessageModal, ConfirmModal, STATUS_MAP,
} from '../design/designSystem';

// ============================================================
// Folder name dialog (create / rename)
// ============================================================
function FolderNameModal({ isOpen, onClose, onSave, initialName = '', title }) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (isOpen) setName(initialName);
  }, [isOpen, initialName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed) onSave(trimmed);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-white dark:bg-[#16202E] rounded-2xl max-w-md w-full shadow-2xl"
            style={sans}
          >
            <div className="p-5 border-b border-[#E2E8F0] dark:border-[#263447]">
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">{title || t('library_folder_new')}</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-5">
              <input
                type="text"
                placeholder={t('library_folder_name_placeholder')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#CBD5E1] dark:border-[#35465C] rounded-xl bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-full text-[#334155] dark:text-[#CBD5E1] text-sm font-medium hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition">
                  {t('library_folder_cancel')}
                </button>
                <button type="submit" className="px-4 py-2 bg-[#1560E8] text-white rounded-full text-sm font-medium hover:bg-[#114FC4] transition">
                  {t('library_folder_save')}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// "Move to folder" dialog (for materials — flat list picker)
// ============================================================
function MoveToFolderModal({ isOpen, onClose, folders, currentFolderId, onMove }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-white dark:bg-[#16202E] rounded-2xl max-w-md w-full shadow-2xl"
            style={sans}
          >
            <div className="p-5 border-b border-[#E2E8F0] dark:border-[#263447]">
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">Переместить в папку</h2>
            </div>
            <div className="p-5">
              <div className="space-y-1 max-h-96 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => onMove(null)}
                  className={`w-full flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-sm transition ${
                    currentFolderId == null
                      ? 'bg-[#1560E8]/10 dark:bg-[#1560E8]/25 text-[#1560E8] dark:text-[#5B9CFF] font-medium'
                      : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1]'
                  }`}
                >
                  <IconFolder className="w-4 h-4 flex-shrink-0" /> Без папки (корень)
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onMove(folder.id)}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-sm transition ${
                      currentFolderId === folder.id
                        ? 'bg-[#1560E8]/10 dark:bg-[#1560E8]/25 text-[#1560E8] dark:text-[#5B9CFF] font-medium'
                        : 'hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1]'
                    }`}
                  >
                    <IconFolder className="w-4 h-4 flex-shrink-0" /> {folder.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-full text-[#334155] dark:text-[#CBD5E1] text-sm font-medium hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition">
                  Отмена
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Material card — "book spine" card. Used for BOTH text and
// video materials now: video items no longer get a thumbnail —
// they use the same plain icon-based layout as text, just
// labeled "Видео" instead of "Текст" in the type tag.
// ============================================================
// Meta row (status pill + word count) — shared by both display modes.
// Материальные статусы (STATUS_MAP в designSystem.jsx) хранят только
// цветовые токены — подписи берём из i18n, чтобы не дублировать переводы
// в нескольких местах (те же ключи, что и в фильтре статусов Library).
const STATUS_LABEL_KEYS = {
  new: 'library_status_new',
  viewed: 'library_status_viewed',
  learning: 'library_status_learning',
  completed: 'library_status_completed',
};

function MaterialCardMeta({ item, showWordCount, t }) {
  return (
    <div className="flex items-center gap-1.5 mt-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
      {STATUS_MAP[item.status] && (
        <span className={`${STATUS_MAP[item.status].bg} ${STATUS_MAP[item.status].text} rounded-full pl-1.5 pr-2.5 py-1 text-[11px] font-medium inline-flex items-center gap-1.5`}>
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_MAP[item.status].dot}`} />
          {t(STATUS_LABEL_KEYS[item.status]) || STATUS_MAP[item.status].label}
        </span>
      )}
      {showWordCount && typeof item.newWordsCount === 'number' && item.newWordsCount > 0 && (
        <span
          className="bg-[#7C5CFA]/10 dark:bg-[#7C5CFA]/20 text-[#6A3FE0] dark:text-[#B49CFF] rounded-full px-2.5 py-1 text-[11px] font-medium"
          title={t('library_word_count_title')}
        >
          {t('library_word_count_badge', { count: item.newWordsCount })}
        </span>
      )}
    </div>
  );
}

function MaterialCardActions({ onEdit, onDelete, onMove }) {
  return (
    <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white p-1.5 rounded-lg bg-white/90 dark:bg-[#1E2A3B]/90 backdrop-blur-sm hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition shadow-sm"
        title="Редактировать"
      >
        <IconPencil />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMove(); }}
        className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white p-1.5 rounded-lg bg-white/90 dark:bg-[#1E2A3B]/90 backdrop-blur-sm hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition shadow-sm"
        title="Переместить"
      >
        <IconArrowRight />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#E23D3D] p-1.5 rounded-lg bg-white/90 dark:bg-[#1E2A3B]/90 backdrop-blur-sm hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition shadow-sm"
        title="Удалить"
      >
        <IconTrash />
      </button>
    </div>
  );
}

// Spec 2 (доп., п.2): два режима отображения карточки — "compact" (текущий,
// без превью) и "thumbnail" (крупное превью сверху, остальная информация
// ниже). Индикатор типа материала (видео/текст) убран из ОБОИХ режимов.
function MaterialCard({ item, displayMode, showWordCount, t, onOpen, onEdit, onDelete, onMove, onDragStart, onDragEnd }) {
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();
  const isVideo = item.type === 'video';

  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'material', id: item.id }));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(item.id);
  };

  const handleDragEnd = () => {
    if (onDragEnd) onDragEnd();
  };

  if (displayMode === 'thumbnail') {
    return (
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="group relative bg-white dark:bg-[#16202E] rounded-2xl border border-[#E2E8F0] dark:border-[#263447] shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer overflow-hidden"
        style={sans}
      >
        <MaterialCardActions onEdit={onEdit} onDelete={onDelete} onMove={onMove} />
        <div onClick={onOpen}>
          <div className="w-full aspect-video bg-[#F8FAFC] dark:bg-[#1E2A3B] flex items-center justify-center overflow-hidden">
            {item.thumbnail ? (
              <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
            ) : isVideo ? (
              <IconFilm className="w-10 h-10 text-[#1560E8] dark:text-[#5B9CFF]" />
            ) : (
              <img src={item.icon || DEFAULT_ICON} alt="" className="w-16 h-16 object-contain" />
            )}
          </div>
          <div className="p-4">
            <h3 className="font-semibold text-[15px] leading-snug truncate text-[#0F172A] dark:text-white">
              {item.title}
            </h3>
            {item.author && (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 truncate">{item.author}</p>
            )}
            {!isVideo && (
              <p className="text-[11px] text-[#94A3B8] dark:text-[#6B7684] mt-1">
                {formatDate(item.imported_at || item.createdAt)}
              </p>
            )}
            <MaterialCardMeta item={item} showWordCount={showWordCount} t={t} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="group relative bg-white dark:bg-[#16202E] rounded-2xl border border-[#E2E8F0] dark:border-[#263447] shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.10)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
      style={sans}
    >
      <MaterialCardActions onEdit={onEdit} onDelete={onDelete} onMove={onMove} />

      <div onClick={onOpen} className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#F8FAFC] dark:bg-[#1E2A3B] flex items-center justify-center flex-shrink-0 overflow-hidden">
            {isVideo ? (
              <IconFilm className="w-5 h-5 text-[#1560E8] dark:text-[#5B9CFF]" />
            ) : (
              <img src={item.icon || DEFAULT_ICON} alt="" className="w-6 h-6 object-contain" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[15px] leading-snug truncate text-[#0F172A] dark:text-white pr-16">
              {item.title}
            </h3>
            {item.author && (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 truncate">{item.author}</p>
            )}
            {!isVideo && (
              <p className="text-[11px] text-[#94A3B8] dark:text-[#6B7684] mt-1">
                {formatDate(item.imported_at || item.createdAt)}
              </p>
            )}
            <MaterialCardMeta item={item} showWordCount={showWordCount} t={t} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Folder row — compact chip, NOT a card. Folders are containers,
// not content, so they get a lighter, narrower visual treatment:
// a horizontal strip with icon + name + count, wrapping in a row
// above the material grid. Still fully drag-and-drop capable.
// ============================================================
function FolderChip({ folder, itemCount, onOpen, onRename, onDelete, onDragStart, onDragEnd, onDropItem, isDragOver, onDragOverTarget }) {
  const handleDragStart = (e) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ type: 'folder', id: folder.id }));
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(folder.id);
  };
  const handleDragEnd = () => { if (onDragEnd) onDragEnd(); };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOverTarget) onDragOverTarget(folder.id);
  };
  const handleDragLeave = () => { if (onDragOverTarget) onDragOverTarget(null); };
  const handleDrop = (e) => {
    e.preventDefault();
    if (onDragOverTarget) onDragOverTarget(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (onDropItem) onDropItem(payload, folder.id);
    } catch { /* ignore malformed payloads */ }
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={onOpen}
      className={`group flex items-center gap-2 min-w-[11rem] pl-3 pr-2 py-2 rounded-full border cursor-pointer transition-all duration-150 shadow-sm dark:shadow-[0_1px_3px_rgba(0,0,0,0.4)] ${
        isDragOver
          ? 'border-[#1560E8] bg-[#1560E8]/10 ring-2 ring-[#1560E8]/30'
          : 'border-[#CBD5E1] dark:border-[#35465C] bg-white dark:bg-[#16202E] hover:border-[#1560E8]/50 hover:bg-[#1560E8]/5 dark:hover:bg-[#1560E8]/10'
      }`}
      style={sans}
    >
      <span className="text-[#1560E8] dark:text-[#5B9CFF] flex-shrink-0">
        <IconFolder className="w-4 h-4" />
      </span>
      <span className="text-sm font-medium text-[#0F172A] dark:text-white truncate flex-1 min-w-0">
        {folder.name}
      </span>
      <span className="text-[11px] font-semibold text-[#64748B] dark:text-[#94A3B8] bg-[#F8FAFC] dark:bg-[#1E2A3B] rounded-full px-1.5 py-0.5 flex-shrink-0">
        {itemCount}
      </span>

      <span className="flex items-center gap-0.5 ml-0.5 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onRename(); }}
          className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white p-1 rounded-md hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition"
          title="Переименовать"
        >
          <IconPencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#E23D3D] p-1 rounded-md hover:bg-[#F8FAFC] dark:hover:bg-[#263447] transition"
          title="Удалить"
        >
          <IconTrash className="w-3.5 h-3.5" />
        </button>
      </span>

      <span className="text-[#94A3B8] dark:text-[#64748B] flex-shrink-0 ml-0.5">
        <IconChevronRight />
      </span>
    </div>
  );
}

// ============================================================
// Review zone — Spec 2 (доп.). Показывает материалы, у которых наступил
// срок повтора (due), и материалы, ожидающие первого прохода (waiting —
// добавлены в loop после первого прочтения, висят тут бессрочно, пока
// пользователь сам не откроет их на review pass). Чистый read-only блок,
// не влияет на фильтрацию/навигацию по папкам.
// ============================================================
// Spec 2 (доп., п.4): постоянная вкладка "Повторение" — показывает ВСЕ
// материалы в цикле повторения (не только те, что должны повторяться
// сегодня), с возможностью убрать из повторения или заархивировать прямо
// отсюда, без перехода на отдельный экран.
function ReviewTab({ items, loading, onOpen, onRemove, onArchive, busyId, t }) {
  const formatDate = (iso) => {
    if (!iso) return t('library_review_waiting');
    const d = new Date(iso);
    const today = new Date();
    const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return t('library_review_today');
    if (diffDays === 1) return t('library_review_tomorrow');
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  if (loading) {
    return <div className="text-center text-[#64748B] dark:text-[#94A3B8] py-16 text-sm">{t('library_loading')}</div>;
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16">
        <p className="text-[#64748B] dark:text-[#94A3B8] text-sm">
          {t('library_review_empty')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const eligibleForArchive = typeof item.lastPercentKnown === 'number' && item.lastPercentKnown >= 95;
        return (
          <div
            key={item.materialId}
            className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] shadow-[0_1px_2px_rgba(15,23,42,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
            style={sans}
          >
            <div onClick={() => onOpen(item)} className="min-w-0 flex-1 cursor-pointer">
              <div className="font-medium text-[#0F172A] dark:text-white truncate">{item.material?.title}</div>
              <div className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-0.5">{formatDate(item.nextReviewAt)}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {typeof item.lastPercentKnown === 'number' && (
                <span className="text-[11px] font-semibold text-[#1560E8] dark:text-[#5B9CFF] bg-[#1560E8]/10 dark:bg-[#1560E8]/20 rounded-full px-2 py-0.5">
                  {Math.round(item.lastPercentKnown)}%
                </span>
              )}
              {eligibleForArchive && (
                <button
                  onClick={() => onArchive(item.materialId)}
                  disabled={busyId === item.materialId}
                  className="text-xs font-medium text-[#1FB854] hover:underline disabled:opacity-50 whitespace-nowrap"
                >
                  {t('library_review_archive')}
                </button>
              )}
              <button
                onClick={() => onRemove(item.materialId)}
                disabled={busyId === item.materialId}
                title={t('library_review_remove_title')}
                className="text-[#94A3B8] hover:text-[#DC2626] transition text-sm px-1.5 disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Breadcrumb bar
// ============================================================
function Breadcrumb({ breadcrumb, currentFolder, onNavigate, dragOverCrumb, onDragOverCrumb, onDropOnCrumb }) {
  const handleDragOver = (e, targetId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOverCrumb) onDragOverCrumb(targetId);
  };
  const handleDragLeave = () => { if (onDragOverCrumb) onDragOverCrumb(null); };
  const handleDrop = (e, targetId) => {
    e.preventDefault();
    if (onDragOverCrumb) onDragOverCrumb(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (onDropOnCrumb) onDropOnCrumb(payload, targetId);
    } catch { /* ignore */ }
  };

  const crumbClass = (targetId) =>
    `px-2.5 py-1 rounded-lg transition ${
      dragOverCrumb === targetId
        ? 'bg-[#1560E8]/15 ring-1 ring-[#1560E8]/40'
        : 'hover:bg-[#E2E8F0] dark:hover:bg-[#1E2A3B]'
    }`;

  return (
    <div className="flex items-center flex-wrap gap-1 mb-6 text-sm" style={sans}>
      {breadcrumb.map((crumb) => (
        <span key={crumb.id} className="flex items-center gap-1">
          <span className="text-[#94A3B8] dark:text-[#64748B]">/</span>
          <button
            onClick={() => onNavigate(crumb.id)}
            onDragOver={(e) => handleDragOver(e, crumb.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, crumb.id)}
            className={`text-[#475569] dark:text-[#B8B2A8] ${crumbClass(crumb.id)}`}
          >
            {crumb.name}
          </button>
        </span>
      ))}
      {currentFolder && (
        <span className="flex items-center gap-1">
          <span className="text-[#94A3B8] dark:text-[#64748B]">/</span>
          <span className="font-semibold text-[#1560E8] dark:text-[#5B9CFF] px-2.5 py-1">{currentFolder.name}</span>
        </span>
      )}
    </div>
  );
}

// ============================================================
// Edit dialog – с автором и статусом
// ============================================================
function EditMaterialModal({ material, onClose, onSave }) {
  const { t } = useI18n();
  const [editTitle, setEditTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [customIcon, setCustomIcon] = useState(null);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('new');

  useEffect(() => {
    if (!material) return;
    setEditTitle(material.title);
    if (PRESET_ICONS.includes(material.icon)) {
      setSelectedIcon(material.icon);
      setCustomIcon(null);
    } else {
      setSelectedIcon(null);
      setCustomIcon(material.icon);
    }
    setAuthor(material.author || '');
    setStatus(material.status || 'new');
  }, [material]);

  if (!material) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const icon = customIcon || selectedIcon || PRESET_ICONS[0];
    onSave({
      title: editTitle,
      icon,
      author: author.trim() || null,
      status
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white dark:bg-[#16202E] rounded-2xl max-w-md w-full shadow-2xl"
          style={sans}
        >
          <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0] dark:border-[#263447]">
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">{t('library_edit_modal_title')}</h2>
            <button onClick={onClose} className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition p-1">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <input
              type="text"
              placeholder={t('library_edit_modal_title_placeholder')}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#CBD5E1] dark:border-[#35465C] rounded-xl bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent"
              required
            />
            <input
              type="text"
              placeholder={t('library_edit_modal_author_placeholder')}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-4 py-2.5 border border-[#CBD5E1] dark:border-[#35465C] rounded-xl bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent"
            />
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-[#64748B] dark:text-[#94A3B8] mb-1.5">
                {t('library_edit_modal_status_label')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-2.5 border border-[#CBD5E1] dark:border-[#35465C] rounded-xl bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent"
              >
                <option value="new">{t('library_status_new')}</option>
                <option value="learning">{t('library_status_learning')}</option>
                <option value="completed">{t('library_status_completed')}</option>
              </select>
            </div>
            {material.type !== 'video' && (
              <IconPicker
                selectedIcon={selectedIcon}
                customIcon={customIcon}
                onSelectPreset={(icon) => { setSelectedIcon(icon); setCustomIcon(null); }}
                onCustomFile={(dataUrl) => { setCustomIcon(dataUrl); setSelectedIcon(null); }}
              />
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-full text-[#334155] dark:text-[#CBD5E1] text-sm font-medium hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition">
                {t('common_cancel')}
              </button>
              <button type="submit" className="px-4 py-2 bg-[#1560E8] text-white rounded-full text-sm font-medium hover:bg-[#114FC4] transition">
                {t('common_save')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ============================================================
// Главный компонент Library
// ============================================================
export default function Library() {
  useLibraryFonts();
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [breadcrumb, setBreadcrumb] = useState([]);
  const [subfolders, setSubfolders] = useState([]);
  const [folderMaterials, setFolderMaterials] = useState([]);
  const [allFolders, setAllFolders] = useState([]);

  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('date-desc'); // 'date-desc' | 'date-asc' | 'status'
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Spec 2 (доп., п.2): режим отображения карточек в библиотеке.
  const [cardDisplayMode, setCardDisplayMode] = useState(() => localStorage.getItem('libraryCardDisplay') || 'compact');
  useEffect(() => {
    localStorage.setItem('libraryCardDisplay', cardDisplayMode);
  }, [cardDisplayMode]);

  const [showWordCount, setShowWordCount] = useState(() => localStorage.getItem('libraryShowWordCount') === 'true');
  useEffect(() => {
    localStorage.setItem('libraryShowWordCount', String(showWordCount));
  }, [showWordCount]);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Spec 2 (доп., п.4): постоянная вкладка "Повторение" — материалы/повторение.
  const [libraryTab, setLibraryTab] = useState('materials');
  const [allReviewItems, setAllReviewItems] = useState([]);
  const [reviewTabLoading, setReviewTabLoading] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState(null);

  // Spec 2 (доп., п.9): мультиязычная библиотека — показываем только
  // материалы, привязанные к текущему изучаемому языку (Settings.jsx).
  const [targetLang, setTargetLang] = useState(() => localStorage.getItem('targetLang') || 'de');
  useEffect(() => {
    const sync = () => setTargetLang(localStorage.getItem('targetLang') || 'de');
    window.addEventListener('storage', sync);
    window.addEventListener('targetLangChange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('targetLangChange', sync);
    };
  }, []);

  const [importType, setImportType] = useState(null);
  const [editMaterial, setEditMaterial] = useState(null);

  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);

  const [movingMaterial, setMovingMaterial] = useState(null);

  const [dragOverFolderId, setDragOverFolderId] = useState(null);
  const [dragOverCrumb, setDragOverCrumb] = useState(null);

  const [messageModal, setMessageModal] = useState({
    isOpen: false, type: 'success', title: '', message: '', showBugReport: false,
  });

  const showMessage = (type, title, message, showBugReport = false) => {
    setMessageModal({ isOpen: true, type, title, message, showBugReport });
  };
  const closeMessageModal = () => setMessageModal(prev => ({ ...prev, isOpen: false }));

  const loadFolderContents = useCallback(async (folderId) => {
    setLoading(true);
    try {
      const endpoint = folderId == null ? '/api/folders/contents' : `/api/folders/${folderId}/contents`;
      const data = await apiFetch(endpoint);
      setCurrentFolder(data.folder);
      setBreadcrumb(data.breadcrumb || []);
      setSubfolders(data.subfolders || []);
      setFolderMaterials(data.materials || []);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось загрузить данные. Проверьте соединение.', true);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAllFolders = useCallback(async () => {
    try {
      const data = await apiFetch('/api/folders');
      setAllFolders(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Spec 2 (доп., п.4): загружает ПОЛНЫЙ список материалов в Review loop
  // (не только due сегодня) — постоянная вкладка "Повторение".
  const loadAllReviewItems = useCallback(async () => {
    setReviewTabLoading(true);
    try {
      const data = await apiFetch('/api/review/all');
      setAllReviewItems(data || []);
    } catch (err) {
      console.error('Ошибка загрузки материалов на повторение:', err);
    } finally {
      setReviewTabLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([loadFolderContents(currentFolderId), loadAllFolders(), loadAllReviewItems()]);
  }, [currentFolderId, loadFolderContents, loadAllFolders, loadAllReviewItems]);

  useEffect(() => { loadFolderContents(currentFolderId); }, [currentFolderId, loadFolderContents]);
  useEffect(() => { loadAllFolders(); }, [loadAllFolders]);
  useEffect(() => { loadAllReviewItems(); }, [loadAllReviewItems]);

  const handleRemoveFromReview = async (materialId) => {
    setReviewBusyId(materialId);
    try {
      await apiFetch(`/api/materials/${materialId}/review`, { method: 'DELETE' });
      setAllReviewItems(prev => prev.filter(i => i.materialId !== materialId));
      await loadFolderContents(currentFolderId);
    } catch (err) {
      console.error('Ошибка удаления из повторения:', err);
      showMessage('error', 'Ошибка', 'Не удалось убрать материал из повторения');
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleArchiveFromReview = async (materialId) => {
    setReviewBusyId(materialId);
    try {
      await apiFetch(`/api/materials/${materialId}/archive`, { method: 'POST' });
      setAllReviewItems(prev => prev.filter(i => i.materialId !== materialId));
      await loadFolderContents(currentFolderId);
      showMessage('success', 'Успешно', 'Материал заархивирован как выученный');
    } catch (err) {
      console.error('Ошибка архивации:', err);
      showMessage('error', 'Ошибка', 'Не удалось заархивировать материал');
    } finally {
      setReviewBusyId(null);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToFolder = (folderId) => {
    setSearchTerm('');
    setCurrentFolderId(folderId);
  };

  const createFolder = async (name) => {
    try {
      await apiFetch('/api/folders', { method: 'POST', body: JSON.stringify({ name, parentId: currentFolderId }) });
      await refresh();
      showMessage('success', 'Успешно', `Папка "${name}" создана`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось создать папку. Проверьте соединение.', true);
    }
  };

  const renameFolder = async (folderId, newName) => {
    try {
      await apiFetch(`/api/folders/${folderId}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
      await refresh();
      showMessage('success', 'Успешно', `Папка переименована в "${newName}"`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось переименовать папку. Проверьте соединение.', true);
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      await apiFetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      await refresh();
      showMessage('success', 'Успешно', 'Папка удалена');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось удалить папку. Проверьте соединение.', true);
    }
  };

  const moveFolderToParent = async (folderId, newParentId) => {
    try {
      await apiFetch(`/api/folders/${folderId}/move`, { method: 'PUT', body: JSON.stringify({ parentId: newParentId }) });
      await refresh();
      showMessage('success', 'Успешно', 'Папка перемещена');
    } catch (err) {
      console.error(err);
      const msg = err?.message?.includes('own subfolders')
        ? 'Нельзя переместить папку в саму себя или в свою же вложенную папку.'
        : 'Не удалось переместить папку. Проверьте соединение.';
      showMessage('error', 'Ошибка', msg, true);
    }
  };

  const moveMaterialToFolder = async (materialId, folderId) => {
    try {
      await apiFetch(`/api/materials/${materialId}/folder`, { method: 'PUT', body: JSON.stringify({ folder_id: folderId }) });
      await refresh();
      showMessage('success', 'Успешно', 'Материал перемещён');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось переместить материал. Проверьте соединение.', true);
    }
  };

  const updateMaterialStatus = async (materialId, currentStatus) => {
    const nextStatus = { new: 'learning', learning: 'completed', completed: 'new' }[currentStatus] || 'new';
    try {
      const material = folderMaterials.find(m => m.id === materialId);
      if (!material) return;
      await apiFetch(`/api/materials/${materialId}`, {
        method: 'PUT',
        body: JSON.stringify({ title: material.title, icon: material.icon, author: material.author || null, status: nextStatus }),
      });
      await refresh();
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось обновить статус', true);
    }
  };

  const saveMaterialEdit = async (materialId, data) => {
    try {
      await apiFetch(`/api/materials/${materialId}`, { method: 'PUT', body: JSON.stringify(data) });
      await refresh();
      setEditMaterial(null);
      showMessage('success', 'Успешно', 'Материал обновлён');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось обновить материал. Проверьте соединение.', true);
    }
  };

  const deleteMaterial = async (materialId) => {
    try {
      await apiFetch(`/api/materials/${materialId}`, { method: 'DELETE' });
      await refresh();
      showMessage('success', 'Успешно', 'Материал удалён');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось удалить материал. Проверьте соединение.', true);
    } finally {
      setMaterialToDelete(null);
    }
  };

  const handleImport = async (payload) => {
    setImporting(true);
    try {
      const endpoint = payload.type === 'text' ? '/api/import/text' : '/api/import/youtube';
      const body = {
        title: payload.title, icon: payload.icon, author: payload.author || null,
        status: payload.status || 'new', folder_id: currentFolderId,
        // Spec 2 (доп., п.9): новые материалы автоматически привязываются
        // к текущему изучаемому языку (Settings.jsx).
        language: localStorage.getItem('targetLang') || 'de',
      };
      if (payload.type === 'text') body.content = payload.content;
      else body.youtube_url = payload.youtube_url;

      await apiFetch(endpoint, { method: 'POST', body: JSON.stringify(body) });
      await refresh();
      setImportType(null);
      showMessage('success', 'Успешно', `Материал "${payload.title || 'без названия'}" успешно импортирован`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось импортировать материал. Проверьте соединение.', true);
    } finally {
      setImporting(false);
    }
  };

  // Spec 2 (доп., п.9): язык материала по умолчанию 'de' (см. схему), так что
  // отсутствующее поле трактуем так же, как бэкенд.
  const languageFilteredMaterials = useMemo(() => {
    return folderMaterials.filter((m) => (m.language || 'de') === targetLang);
  }, [folderMaterials, targetLang]);

  const availableAuthors = useMemo(() => {
    return [...new Set(languageFilteredMaterials.map((m) => m.author).filter(Boolean))];
  }, [languageFilteredMaterials]);

  const STATUS_SORT_ORDER = { new: 0, viewed: 1, learning: 2, completed: 3 };

  const filteredMaterials = useMemo(() => {
    let result = languageFilteredMaterials;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((m) =>
        m.title.toLowerCase().includes(term) ||
        (m.author && m.author.toLowerCase().includes(term))
      );
    }
    if (authorFilter !== 'all') result = result.filter((m) => m.author === authorFilter);
    if (statusFilter !== 'all') result = result.filter((m) => (m.status || 'new') === statusFilter);
    return [...result].sort((a, b) => {
      if (sortOrder === 'status') {
        const rankA = STATUS_SORT_ORDER[a.status || 'new'] ?? 0;
        const rankB = STATUS_SORT_ORDER[b.status || 'new'] ?? 0;
        return rankA - rankB;
      }
      const dateA = new Date(a.imported_at || a.createdAt).getTime();
      const dateB = new Date(b.imported_at || b.createdAt).getTime();
      return sortOrder === 'date-asc' ? dateA - dateB : dateB - dateA;
    });
  }, [languageFilteredMaterials, searchTerm, authorFilter, statusFilter, sortOrder]);

  const filteredSubfolders = useMemo(() => {
    if (!searchTerm) return subfolders;
    const term = searchTerm.toLowerCase();
    return subfolders.filter((f) => f.name.toLowerCase().includes(term));
  }, [subfolders, searchTerm]);

  const openMaterial = (item) => navigate(item.type === 'text' ? `/read/${item.id}` : `/video/${item.id}`);

  const handleDropOnFolder = async (payload, targetFolderId) => {
    setDragOverFolderId(null);
    if (!payload) return;
    if (payload.type === 'material') await moveMaterialToFolder(payload.id, targetFolderId);
    else if (payload.type === 'folder') {
      if (payload.id === targetFolderId) return;
      await moveFolderToParent(payload.id, targetFolderId);
    }
  };

  const handleDropOnCrumb = async (payload, targetFolderId) => {
    setDragOverCrumb(null);
    if (!payload) return;
    if (targetFolderId === currentFolderId) return;
    if (payload.type === 'material') await moveMaterialToFolder(payload.id, targetFolderId);
    else if (payload.type === 'folder') {
      if (payload.id === targetFolderId) return;
      await moveFolderToParent(payload.id, targetFolderId);
    }
  };

  const hasContent = filteredMaterials.length > 0 || filteredSubfolders.length > 0;

  return (
    <div className="min-h-screen bg-[#F2F4F7] dark:bg-[#0F172A] transition-colors duration-300" style={sans}>
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-10">

        {/* Header */}
        <div className="flex justify-between items-start mb-2 flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[#0F172A] dark:text-white tracking-tight">
              {t('library_title')}
            </h1>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
              {user?.username && t('library_subtitle', { username: user.username })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => { setFolderToRename(null); setFolderModalOpen(true); }}
              className="bg-white dark:bg-[#16202E] border border-[#CBD5E1] dark:border-[#35465C] text-[#334155] dark:text-[#CBD5E1] font-medium text-sm py-2.5 px-4 rounded-full flex items-center gap-1.5 hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition shadow-sm"
            >
              {t('library_new_folder')}
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="bg-[#1560E8] hover:bg-[#114FC4] text-white font-medium text-sm py-2.5 px-4 rounded-full flex items-center gap-1.5 transition shadow-sm"
              >
                {t('library_import')}
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-[#16202E] rounded-2xl shadow-xl z-10 border border-[#E2E8F0] dark:border-[#263447] overflow-hidden">
                  <button
                    onClick={() => { setImportType('text'); setDropdownOpen(false); }}
                    className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1] text-sm transition"
                  >
                    <IconBook className="w-4 h-4" /> {t('library_import_text')}
                  </button>
                  <button
                    onClick={() => { setImportType('youtube'); setDropdownOpen(false); }}
                    className="flex items-center gap-2 w-full text-left px-4 py-2.5 hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1] text-sm transition"
                  >
                    <IconFilm className="w-4 h-4" /> {t('library_import_youtube')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="h-8" />

        {/* Spec 2 (доп., п.4): постоянные вкладки — материалы / повторение */}
        <div className="flex items-center gap-2 mb-6 border-b border-[#E2E8F0] dark:border-[#263447]">
          <button
            onClick={() => setLibraryTab('materials')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              libraryTab === 'materials'
                ? 'border-[#1560E8] text-[#1560E8] dark:text-[#5B9CFF]'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {t('library_tab_materials')}
          </button>
          <button
            onClick={() => setLibraryTab('review')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
              libraryTab === 'review'
                ? 'border-[#1560E8] text-[#1560E8] dark:text-[#5B9CFF]'
                : 'border-transparent text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white'
            }`}
          >
            {t('library_tab_review')}{allReviewItems.length > 0 ? ` (${allReviewItems.length})` : ''}
          </button>
        </div>

        {libraryTab === 'review' ? (
          <ReviewTab
            items={allReviewItems}
            loading={reviewTabLoading}
            busyId={reviewBusyId}
            onOpen={(item) => navigate(`${item.material?.type === 'video' ? '/video' : '/read'}/${item.materialId}?mode=review`)}
            onRemove={handleRemoveFromReview}
            onArchive={handleArchiveFromReview}
            t={t}
          />
        ) : (
        <>
        <Breadcrumb
          breadcrumb={breadcrumb}
          currentFolder={currentFolder}
          onNavigate={navigateToFolder}
          dragOverCrumb={dragOverCrumb}
          onDragOverCrumb={setDragOverCrumb}
          onDropOnCrumb={handleDropOnCrumb}
        />

        <div className="mb-4 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8] dark:text-[#64748B]">
              <IconSearch className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={t('library_search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-[#E2E8F0] dark:border-[#263447] rounded-2xl bg-white dark:bg-[#16202E] text-[#0F172A] dark:text-white text-sm placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setFiltersVisible((prev) => !prev)}
            title={t('library_filters_toggle')}
            aria-pressed={filtersVisible}
            className={`flex items-center justify-center w-11 h-11 rounded-2xl border transition shadow-sm flex-shrink-0 ${
              filtersVisible
                ? 'bg-[#1560E8] border-[#1560E8] text-white'
                : 'bg-white dark:bg-[#16202E] border-[#E2E8F0] dark:border-[#263447] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]'
            }`}
          >
            <IconFilter className="w-4 h-4" />
          </button>
        </div>

        {/* Spec 2 (доп., п.3): сортировка и фильтры + (п.2) переключатель режима карточек — скрыты, пока не нажата кнопка фильтра */}
        {filtersVisible && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-8">
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-[#E2E8F0] dark:border-[#263447] rounded-full bg-white dark:bg-[#16202E] text-[#334155] dark:text-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8]"
            >
              <option value="all">{t('library_status_all')}</option>
              <option value="new">{t('library_status_new')}</option>
              <option value="viewed">{t('library_status_viewed')}</option>
              <option value="learning">{t('library_status_learning')}</option>
              <option value="completed">{t('library_status_completed')}</option>
            </select>
            <select
              value={authorFilter}
              onChange={(e) => setAuthorFilter(e.target.value)}
              className="px-3 py-2 border border-[#E2E8F0] dark:border-[#263447] rounded-full bg-white dark:bg-[#16202E] text-[#334155] dark:text-[#CBD5E1] text-sm focus:outline-none focus:ring-2 focus:ring-[#1560E8]"
            >
              <option value="all">{t('library_author_all')}</option>
              {availableAuthors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <button
              onClick={() => setSortOrder('date-desc')}
              className={`px-3 py-2 rounded-full text-sm font-medium transition ${
                sortOrder === 'date-desc' ? 'bg-[#1560E8] text-white' : 'bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]'
              }`}
            >
              {t('library_sort_date_desc')}
            </button>
            <button
              onClick={() => setSortOrder('date-asc')}
              className={`px-3 py-2 rounded-full text-sm font-medium transition ${
                sortOrder === 'date-asc' ? 'bg-[#1560E8] text-white' : 'bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]'
              }`}
            >
              {t('library_sort_date_asc')}
            </button>
            <button
              onClick={() => setSortOrder('status')}
              className={`px-3 py-2 rounded-full text-sm font-medium transition ${
                sortOrder === 'status' ? 'bg-[#1560E8] text-white' : 'bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]'
              }`}
            >
              {t('library_sort_status')}
            </button>
            <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] text-sm font-medium text-[#334155] dark:text-[#CBD5E1] cursor-pointer">
              <input
                type="checkbox"
                checked={showWordCount}
                onChange={(e) => setShowWordCount(e.target.checked)}
                className="w-3.5 h-3.5 accent-[#1560E8]"
              />
              {t('library_word_count_toggle')}
            </label>
          </div>

          {/* Spec 2 (доп., п.2): переключатель режима отображения карточек */}
          <div className="flex items-center gap-1 bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] rounded-full p-1">
            <button
              onClick={() => setCardDisplayMode('compact')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                cardDisplayMode === 'compact' ? 'bg-[#1560E8] text-white' : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]'
              }`}
            >
              {t('library_display_compact')}
            </button>
            <button
              onClick={() => setCardDisplayMode('thumbnail')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                cardDisplayMode === 'thumbnail' ? 'bg-[#1560E8] text-white' : 'text-[#334155] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]'
              }`}
            >
              {t('library_display_thumbnail')}
            </button>
          </div>
        </div>
        )}

        {loading ? (
          <div className="text-center text-[#64748B] dark:text-[#94A3B8] py-16 text-sm">{t('library_loading')}</div>
        ) : !hasContent ? (
          <div className="flex flex-col items-center justify-center text-center py-16">
            <img src="/icons/sad-doggy.png" alt="" className="w-56 h-56 object-contain mb-4 opacity-90" />
            <p className="text-[#64748B] dark:text-[#94A3B8] text-sm">
              {searchTerm ? t('library_empty_search') : t('library_empty_default')}
            </p>
          </div>
        ) : (
          <>
            {filteredSubfolders.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {filteredSubfolders.map((folder) => (
                  <FolderChip
                    key={`folder-${folder.id}`}
                    folder={folder}
                    itemCount={folder._count ? (folder._count.materials || 0) + (folder._count.children || 0) : 0}
                    onOpen={() => navigateToFolder(folder.id)}
                    onRename={() => { setFolderToRename(folder); setFolderModalOpen(true); }}
                    onDelete={() => setFolderToDelete(folder)}
                    onDropItem={handleDropOnFolder}
                    isDragOver={dragOverFolderId === folder.id}
                    onDragOverTarget={setDragOverFolderId}
                  />
                ))}
              </div>
            )}
            {filteredMaterials.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredMaterials.map((item) => (
                  <MaterialCard
                    key={`material-${item.id}`}
                    item={item}
                    displayMode={cardDisplayMode}
                    showWordCount={showWordCount}
                    t={t}
                    onOpen={() => openMaterial(item)}
                    onEdit={() => setEditMaterial(item)}
                    onDelete={() => setMaterialToDelete(item)}
                    onMove={() => setMovingMaterial(item)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        </>
        )}
      </div>

      <TextImportModal isOpen={importType === 'text'} loading={importing} onClose={() => setImportType(null)} onSubmit={handleImport} />
      <YouTubeImportModal isOpen={importType === 'youtube'} loading={importing} onClose={() => setImportType(null)} onSubmit={handleImport} />

      <EditMaterialModal
        material={editMaterial}
        onClose={() => setEditMaterial(null)}
        onSave={(changes) => saveMaterialEdit(editMaterial.id, changes)}
      />

      <FolderNameModal
        isOpen={folderModalOpen}
        initialName={folderToRename?.name || ''}
        title={folderToRename ? t('library_folder_rename') : t('library_folder_new')}
        onClose={() => { setFolderModalOpen(false); setFolderToRename(null); }}
        onSave={async (name) => {
          if (folderToRename) await renameFolder(folderToRename.id, name);
          else await createFolder(name);
          setFolderModalOpen(false);
          setFolderToRename(null);
        }}
      />

      <MoveToFolderModal
        isOpen={!!movingMaterial}
        folders={allFolders}
        currentFolderId={movingMaterial?.folderId ?? null}
        onClose={() => setMovingMaterial(null)}
        onMove={async (folderId) => {
          if (movingMaterial) await moveMaterialToFolder(movingMaterial.id, folderId);
          setMovingMaterial(null);
        }}
      />

      <ConfirmModal
        isOpen={!!materialToDelete}
        message={`Вы уверены, что хотите удалить "${materialToDelete?.title}"? Все данные будут потеряны.`}
        onClose={() => setMaterialToDelete(null)}
        onConfirm={() => deleteMaterial(materialToDelete.id)}
      />

      <ConfirmModal
        isOpen={!!folderToDelete}
        message={`Удалить папку "${folderToDelete?.name}"? Вложенные папки поднимутся на уровень выше, материалы останутся без папки.`}
        onClose={() => setFolderToDelete(null)}
        onConfirm={async () => { await deleteFolder(folderToDelete.id); setFolderToDelete(null); }}
      />

      <MessageModal
        isOpen={messageModal.isOpen}
        type={messageModal.type}
        title={messageModal.title}
        message={messageModal.message}
        showBugReport={messageModal.showBugReport}
        onClose={closeMessageModal}
      />
    </div>
  );
}