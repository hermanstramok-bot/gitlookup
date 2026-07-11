// client/src/components/YouTubeImportModal.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconPicker from './IconPicker';
import { PRESET_ICONS } from '../constants';

export default function YouTubeImportModal({ isOpen, onClose, onSubmit, loading }) {
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
  const [customIcon, setCustomIcon] = useState(null);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('new');

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setYoutubeUrl('');
      setSelectedIcon(PRESET_ICONS[0]);
      setCustomIcon(null);
      setIsFetchingTitle(false);
      setAuthor('');
      setStatus('new');
    }
  }, [isOpen]);

  const extractVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  useEffect(() => {
    if (!youtubeUrl) return;
    if (title.trim() !== '') return;

    const id = extractVideoId(youtubeUrl);
    if (!id) return;

    setIsFetchingTitle(true);
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
      .then(res => {
        if (!res.ok) throw new Error('Network response was not ok');
        return res.json();
      })
      .then(data => {
        if (data.title) {
          setTitle(data.title);
        }
        if (data.author_name && !author) {
          setAuthor(data.author_name);
        }
      })
      .catch(err => console.error('Error fetching video title:', err))
      .finally(() => setIsFetchingTitle(false));
  }, [youtubeUrl, title, author]);

  const handleSelectPreset = (icon) => {
    setSelectedIcon(icon);
    setCustomIcon(null);
  };

  const handleCustomFile = (dataUrl) => {
    setCustomIcon(dataUrl);
    setSelectedIcon(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const icon = customIcon || selectedIcon || PRESET_ICONS[0];
    if (!youtubeUrl) {
      alert('Введите URL');
      return;
    }
    onSubmit({
      type: 'youtube',
      title: title || undefined,
      youtube_url: youtubeUrl,
      icon,
      author: author.trim() || null,
      status
    });
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full"
        >
          <div className="flex justify-between p-4 border-b dark:border-gray-700">
            <h2 className="text-xl font-bold dark:text-white">Импорт YouTube</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div>
              <input
                type="text"
                placeholder="Название (заполнится автоматически)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              {isFetchingTitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Загрузка названия...</p>
              )}
            </div>

            <input
              type="text"
              placeholder="Автор (необязательно, будет автоматически подставлен с YouTube)"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Статус
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="new">Новое</option>
                <option value="learning">Изучается</option>
                <option value="completed">Пройдено</option>
              </select>
            </div>

            <input
              type="url"
              placeholder="YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
            <IconPicker
              selectedIcon={selectedIcon}
              customIcon={customIcon}
              onSelectPreset={handleSelectPreset}
              onCustomFile={handleCustomFile}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                Отмена
              </button>
              <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50">
                {loading ? 'Импорт...' : 'Импорт'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}