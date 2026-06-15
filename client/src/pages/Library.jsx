import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const PRESET_ICONS = [
  '/icons/icon1.png',
  '/icons/icon2.png',
  '/icons/icon3.png',
  '/icons/icon4.png',
];

const DEFAULT_ICON = '/icons/default.png';

// ============================================================
// Компонент для отображения сообщений (успех / ошибка)
// ============================================================
function MessageModal({ isOpen, type, title, message, onClose, showBugReport = false }) {
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
                {showBugReport && (
                  <button
                    onClick={() => window.open('https://example.com/report', '_blank')}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline mt-2"
                  >
                    Сообщить о баге
                  </button>
                )}
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
// Generic confirm dialog
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
// Folder name dialog (create / rename)
// ============================================================
function FolderNameModal({ isOpen, onClose, onSave, initialName = '', title = 'Новая папка' }) {
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
            <form onSubmit={handleSubmit} className="p-4">
              <input
                type="text"
                placeholder="Название папки"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                autoFocus
                required
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                  Отмена
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                  Сохранить
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
// "Move to folder" dialog
// ============================================================
function MoveToFolderModal({ isOpen, onClose, folders, currentFolderId, onMove }) {
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
              <h2 className="text-xl font-bold dark:text-white">Переместить в папку</h2>
            </div>
            <div className="p-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                <button
                  type="button"
                  onClick={() => onMove(null)}
                  className={`w-full text-left px-3 py-2 rounded ${
                    currentFolderId == null ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  } dark:text-gray-200`}
                >
                  📁 Без папки
                </button>
                {folders.map((folder) => (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => onMove(folder.id)}
                    className={`w-full text-left px-3 py-2 rounded ${
                      currentFolderId === folder.id ? 'bg-blue-100 dark:bg-blue-900' : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    } dark:text-gray-200`}
                  >
                    📁 {folder.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
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
// Shared icon picker (used by import + edit forms)
// ============================================================
function IconPicker({ selectedIcon, customIcon, onSelectPreset, onCustomFile }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onCustomFile(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block mb-2 dark:text-gray-200">Иконка</label>
      <div className="flex gap-2 flex-wrap">
        {PRESET_ICONS.map((icon) => (
          <button
            type="button"
            key={icon}
            onClick={() => onSelectPreset(icon)}
            className={`w-12 h-12 border rounded ${
              selectedIcon === icon && !customIcon ? 'ring-2 ring-blue-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <img src={icon} alt="icon" className="w-full h-full object-contain" />
          </button>
        ))}
        <label className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded flex items-center justify-center cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <span className="text-2xl dark:text-gray-200">+</span>
        </label>
      </div>
      {customIcon && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Кастомная иконка:</p>
          <img src={customIcon} alt="custom" className="w-12 h-12 object-contain mt-1" />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Import dialog (text / youtube)
// ============================================================
function ImportModal({ importType, onClose, onSubmit, loading }) {
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
  const [customIcon, setCustomIcon] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const icon = customIcon || selectedIcon || PRESET_ICONS[0];

    if (importType === 'text') {
      if (!title || !textContent) {
        alert('Заполните поля');
        return;
      }
      onSubmit({ type: 'text', title, content: textContent, icon });
    } else {
      if (!youtubeUrl) {
        alert('Введите URL');
        return;
      }
      onSubmit({ type: 'youtube', title: title || undefined, youtube_url: youtubeUrl, icon });
    }
  };

  if (!importType) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded max-w-md w-full"
        >
          <div className="flex justify-between p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white">
              Импорт {importType === 'text' ? 'текста' : 'YouTube'}
            </h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <input
              type="text"
              placeholder="Название"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required={importType === 'text'}
            />
            {importType === 'text' && (
              <textarea
                placeholder="Текст"
                rows={6}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            )}
            {importType === 'youtube' && (
              <input
                type="url"
                placeholder="YouTube URL"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            )}
            <IconPicker
              selectedIcon={selectedIcon}
              customIcon={customIcon}
              onSelectPreset={(icon) => {
                setSelectedIcon(icon);
                setCustomIcon(null);
              }}
              onCustomFile={(dataUrl) => {
                setCustomIcon(dataUrl);
                setSelectedIcon(null);
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                Отмена
              </button>
              <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                {loading ? 'Импорт...' : 'Импорт'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ============================================================
// Edit dialog (title + icon)
// ============================================================
function EditMaterialModal({ material, onClose, onSave }) {
  const [editTitle, setEditTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(null);
  const [customIcon, setCustomIcon] = useState(null);

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
  }, [material]);

  if (!material) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const icon = customIcon || selectedIcon || PRESET_ICONS[0];
    onSave({ title: editTitle, icon });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded max-w-md w-full"
        >
          <div className="flex justify-between p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white">Редактирование</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <input
              type="text"
              placeholder="Название"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
            <IconPicker
              selectedIcon={selectedIcon}
              customIcon={customIcon}
              onSelectPreset={(icon) => {
                setSelectedIcon(icon);
                setCustomIcon(null);
              }}
              onCustomFile={(dataUrl) => {
                setCustomIcon(dataUrl);
                setSelectedIcon(null);
              }}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                Отмена
              </button>
              <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                Сохранить
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ============================================================
// Material card (with drag and drop)
// ============================================================
function MaterialCard({ item, onOpen, onEdit, onDelete, onMove, onDragStart, onDragEnd }) {
  const formatDate = (dateString) => new Date(dateString).toLocaleDateString();

  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/plain', item.id);
    e.dataTransfer.effectAllowed = 'move';
    if (onDragStart) onDragStart(item.id);
  };

  const handleDragEnd = () => {
    if (onDragEnd) onDragEnd();
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className="bg-white dark:bg-gray-800 rounded shadow-md hover:shadow-lg transition cursor-pointer border dark:border-gray-700"
    >
      <div onClick={onOpen} className="p-3">
        <div className="flex items-center gap-3">
          <img src={item.icon || DEFAULT_ICON} alt="icon" className="w-8 h-8 object-contain flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-bold text-sm truncate dark:text-white">{item.title}</h3>
              <span className="text-xs bg-gray-200 dark:bg-gray-600 dark:text-gray-200 px-2 py-0.5 rounded whitespace-nowrap">
                {item.type === 'text' ? 'Текст' : 'Видео'}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {formatDate(item.imported_at || item.createdAt)}
            </p>
          </div>
        </div>
      </div>
      <div className="border-t dark:border-gray-700 px-3 py-2 flex justify-end gap-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
          title="Редактировать"
        >
          ✏️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onMove();
          }}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
          title="Переместить"
        >
          ➡️
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
          title="Удалить"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Folder section (drag and drop target, with collapsible)
// ============================================================
function FolderSection({ title, materials, folder, onRename, onDelete, onOpenMaterial, onEditMaterial, onDeleteMaterial, onMoveMaterial, onDrop, onDragOver, collapsed, onToggleCollapse }) {
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (onDragOver) onDragOver(folder?.id ?? 'none');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const materialId = e.dataTransfer.getData('text/plain');
    if (materialId && onDrop) {
      onDrop(materialId, folder?.id ?? null);
    }
  };

  return (
    <div
      className="mb-8"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 cursor-pointer" onClick={onToggleCollapse}>
          <span className="text-gray-600 dark:text-gray-400">
            {collapsed ? '►' : '▼'}
          </span>
          <h2 className="text-xl font-semibold dark:text-gray-200">{title}</h2>
        </div>
        {folder && (
          <div className="flex gap-2">
            <button
              onClick={onRename}
              className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              title="Переименовать"
            >
              ✏️
            </button>
            <button
              onClick={onDelete}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800"
              title="Удалить папку"
            >
              🗑️
            </button>
          </div>
        )}
      </div>
      {!collapsed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {materials.map((item) => (
            <MaterialCard
              key={item.id}
              item={item}
              onOpen={() => onOpenMaterial(item)}
              onEdit={() => onEditMaterial(item)}
              onDelete={() => onDeleteMaterial(item)}
              onMove={() => onMoveMaterial(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main component
// ============================================================
export default function Library() {
  const navigate = useNavigate();

  const [materials, setMaterials] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const [importType, setImportType] = useState(null);
  const [editMaterial, setEditMaterial] = useState(null);

  const [materialToDelete, setMaterialToDelete] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);

  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState(null);

  const [movingMaterial, setMovingMaterial] = useState(null);

  // Состояние для сворачивания папок
  const [collapsedFolders, setCollapsedFolders] = useState(new Set());

  // Для drag-and-drop
  const [dragOverTarget, setDragOverTarget] = useState(null);

  const [messageModal, setMessageModal] = useState({
    isOpen: false,
    type: 'success',
    title: '',
    message: '',
    showBugReport: false,
  });

  const showMessage = (type, title, message, showBugReport = false) => {
    setMessageModal({ isOpen: true, type, title, message, showBugReport });
  };

  const closeMessageModal = () => {
    setMessageModal(prev => ({ ...prev, isOpen: false }));
  };

  // Переключение сворачивания папки
  const toggleCollapse = (key) => {
    setCollapsedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // ===== Загрузка данных =====
  const loadMaterials = useCallback(async () => {
    const response = await fetch('/api/materials');
    if (response.ok) return await response.json();
    throw new Error('Failed to load materials');
  }, []);

  const loadFolders = useCallback(async () => {
    const response = await fetch('/api/folders');
    if (response.ok) return await response.json();
    throw new Error('Failed to load folders');
  }, []);

  const loadAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [materialsData, foldersData] = await Promise.all([loadMaterials(), loadFolders()]);
      setMaterials(materialsData);
      setFolders(foldersData);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось загрузить данные. Проверьте соединение.', true);
    } finally {
      setLoading(false);
    }
  }, [loadMaterials, loadFolders]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ===== CRUD для папок =====
  const createFolder = async (name) => {
    try {
      const response = await fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await response.json();
      if (!response.ok) {
        showMessage('error', 'Ошибка', data.error || 'Не удалось создать папку', true);
        return;
      }
      await loadAllData();
      showMessage('success', 'Успешно', `Папка "${name}" создана`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось создать папку. Проверьте соединение.', true);
    }
  };

  const renameFolder = async (folderId, newName) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (!response.ok) {
        showMessage('error', 'Ошибка', 'Не удалось переименовать папку', true);
        return;
      }
      await loadAllData();
      showMessage('success', 'Успешно', `Папка переименована в "${newName}"`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось переименовать папку. Проверьте соединение.', true);
    }
  };

  const deleteFolder = async (folderId) => {
    try {
      const response = await fetch(`/api/folders/${folderId}`, { method: 'DELETE' });
      if (!response.ok) {
        showMessage('error', 'Ошибка', 'Не удалось удалить папку', true);
        return;
      }
      await loadAllData();
      showMessage('success', 'Успешно', 'Папка удалена, материалы остались без папки');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось удалить папку. Проверьте соединение.', true);
    }
  };

  // ===== Работа с материалами =====
  const moveMaterialToFolder = async (materialId, folderId) => {
    try {
      const response = await fetch(`/api/materials/${materialId}/folder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
      });
      if (!response.ok) {
        showMessage('error', 'Ошибка', 'Не удалось переместить материал', true);
        return;
      }
      await loadAllData();
      showMessage('success', 'Успешно', 'Материал перемещён');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось переместить материал. Проверьте соединение.', true);
    }
  };

  const saveMaterialEdit = async (materialId, { title, icon }) => {
    try {
      const response = await fetch(`/api/materials/${materialId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, icon }),
      });
      if (!response.ok) {
        showMessage('error', 'Ошибка', 'Не удалось обновить материал', true);
        return;
      }
      await loadAllData();
      setEditMaterial(null);
      showMessage('success', 'Успешно', 'Материал обновлён');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось обновить материал. Проверьте соединение.', true);
    }
  };

  const deleteMaterial = async (materialId) => {
    try {
      const response = await fetch(`/api/materials/${materialId}`, { method: 'DELETE' });
      if (!response.ok) {
        showMessage('error', 'Ошибка', 'Не удалось удалить материал', true);
        return;
      }
      await loadAllData();
      showMessage('success', 'Успешно', 'Материал удалён');
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось удалить материал. Проверьте соединение.', true);
    } finally {
      setMaterialToDelete(null);
    }
  };

  // ===== Импорт =====
  const handleImport = async (payload) => {
    setImporting(true);
    try {
      const endpoint = payload.type === 'text' ? '/api/import/text' : '/api/import/youtube';
      const body =
        payload.type === 'text'
          ? { title: payload.title, content: payload.content, icon: payload.icon }
          : { youtube_url: payload.youtube_url, title: payload.title, icon: payload.icon };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!data.success) {
        showMessage('error', 'Ошибка', 'Не удалось импортировать материал. Проверьте данные.', true);
        return;
      }
      await loadAllData();
      setImportType(null);
      showMessage('success', 'Успешно', `Материал "${payload.title || 'без названия'}" успешно импортирован`);
    } catch (err) {
      console.error(err);
      showMessage('error', 'Ошибка', 'Не удалось импортировать материал. Проверьте соединение.', true);
    } finally {
      setImporting(false);
    }
  };

  // ===== Фильтрация и группировка =====
  const filteredMaterials = useMemo(() => {
    if (!searchTerm) return materials;
    const term = searchTerm.toLowerCase();
    return materials.filter((m) => m.title.toLowerCase().includes(term));
  }, [materials, searchTerm]);

  const groupedByFolder = useMemo(() => {
    const grouped = new Map();
    for (const mat of filteredMaterials) {
      const key = mat.folder_id == null ? 'none' : String(mat.folder_id);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(mat);
    }
    return grouped;
  }, [filteredMaterials]);

  const openMaterial = (item) => {
    navigate(item.type === 'text' ? `/read/${item.id}` : `/video/${item.id}`);
  };

  // ===== Drag-and-drop =====
  const handleDragOver = (targetId) => {
    setDragOverTarget(targetId);
  };

  const handleDrop = async (materialId, folderId) => {
    setDragOverTarget(null);
    const material = materials.find(m => m.id == materialId);
    if (!material) return;
    if ((folderId === null && material.folder_id === null) ||
        (folderId !== null && material.folder_id === folderId)) {
      return;
    }
    await moveMaterialToFolder(materialId, folderId);
  };

  const hasMaterials = filteredMaterials.length > 0 || folders.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors duration-300">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
          <h1 className="text-4xl font-bold dark:text-white">Библиотека</h1>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setFolderToRename(null);
                setFolderModalOpen(true);
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center gap-2"
            >
              + Папка
            </button>
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((prev) => !prev)}
                className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-bold py-2 px-4 rounded flex items-center gap-2"
              >
                <span>+</span> Импорт
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded shadow-lg z-10 border dark:border-gray-600">
                  <button
                    onClick={() => {
                      setImportType('text');
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
                  >
                    📖 Текст
                  </button>
                  <button
                    onClick={() => {
                      setImportType('youtube');
                      setDropdownOpen(false);
                    }}
                    className="block w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-gray-200"
                  >
                    ▶️ YouTube
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Поиск..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        {loading ? (
          <div className="text-center dark:text-gray-200">Загрузка...</div>
        ) : !hasMaterials ? (
          <div className="flex flex-col items-center justify-center text-center py-12">
            <img src="/icons/sad-doggy.png" alt="Sad doggy" className="w-64 h-64 object-contain mb-4" />
            <p className="text-gray-500 dark:text-gray-400">Нет материалов. Нажмите + Импорт</p>
          </div>
        ) : (
          <>
            {/* Секция "Без папки" */}
            {groupedByFolder.has('none') && (
              <FolderSection
                title="📁 Без папки"
                materials={groupedByFolder.get('none')}
                folder={null}
                onRename={null}
                onDelete={null}
                onOpenMaterial={openMaterial}
                onEditMaterial={setEditMaterial}
                onDeleteMaterial={setMaterialToDelete}
                onMoveMaterial={setMovingMaterial}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                collapsed={collapsedFolders.has('none')}
                onToggleCollapse={() => toggleCollapse('none')}
              />
            )}
            {/* Папки */}
            {folders.map((folder) => {
              const items = groupedByFolder.get(String(folder.id)) || [];
              if (items.length === 0 && searchTerm !== '') return null; // скрываем пустые папки при поиске
              return (
                <FolderSection
                  key={folder.id}
                  title={`📁 ${folder.name}`}
                  materials={items}
                  folder={folder}
                  onRename={() => {
                    setFolderToRename(folder);
                    setFolderModalOpen(true);
                  }}
                  onDelete={() => setFolderToDelete(folder)}
                  onOpenMaterial={openMaterial}
                  onEditMaterial={setEditMaterial}
                  onDeleteMaterial={setMaterialToDelete}
                  onMoveMaterial={setMovingMaterial}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  collapsed={collapsedFolders.has(folder.id)}
                  onToggleCollapse={() => toggleCollapse(folder.id)}
                />
              );
            })}
          </>
        )}
      </div>

      <ImportModal
        importType={importType}
        loading={importing}
        onClose={() => setImportType(null)}
        onSubmit={handleImport}
      />

      <EditMaterialModal
        material={editMaterial}
        onClose={() => setEditMaterial(null)}
        onSave={(changes) => saveMaterialEdit(editMaterial.id, changes)}
      />

      <FolderNameModal
        isOpen={folderModalOpen}
        initialName={folderToRename?.name || ''}
        title={folderToRename ? 'Переименовать папку' : 'Новая папка'}
        onClose={() => {
          setFolderModalOpen(false);
          setFolderToRename(null);
        }}
        onSave={async (name) => {
          if (folderToRename) {
            await renameFolder(folderToRename.id, name);
          } else {
            await createFolder(name);
          }
          setFolderModalOpen(false);
          setFolderToRename(null);
        }}
      />

      <MoveToFolderModal
        isOpen={!!movingMaterial}
        folders={folders}
        currentFolderId={movingMaterial?.folder_id ?? null}
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
        message={`Удалить папку "${folderToDelete?.name}"? Материалы останутся без папки.`}
        onClose={() => setFolderToDelete(null)}
        onConfirm={async () => {
          await deleteFolder(folderToDelete.id);
          setFolderToDelete(null);
        }}
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