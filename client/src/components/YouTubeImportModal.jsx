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
  // const [autoThumbnail, setAutoThumbnail] = useState(false); // временно отключено
  // const [currentVideoId, setCurrentVideoId] = useState(null); // временно отключено
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);

  // Сброс при закрытии
  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setYoutubeUrl('');
      setSelectedIcon(PRESET_ICONS[0]);
      setCustomIcon(null);
      // setAutoThumbnail(false);
      // setCurrentVideoId(null);
      setIsFetchingTitle(false);
    }
  }, [isOpen]);

  // Извлечение video ID (оставляем для будущих нужд)
  const extractVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  // Автоматическое получение названия видео через oEmbed
  useEffect(() => {
    if (!youtubeUrl) {
      // Если URL пуст, не делаем запрос
      return;
    }

    // Если пользователь уже ввёл название вручную — не перезаписываем
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
      })
      .catch(err => console.error('Error fetching video title:', err))
      .finally(() => setIsFetchingTitle(false));
  }, [youtubeUrl, title]);

  // ===== Автоподстановка thumbnail (временно отключена) =====
  /*
  useEffect(() => {
    if (!youtubeUrl) {
      setAutoThumbnail(false);
      return;
    }
    const id = extractVideoId(youtubeUrl);
    if (!id) {
      setAutoThumbnail(false);
      return;
    }

    if (id !== currentVideoId || !autoThumbnail) {
      const thumbUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
      setCurrentVideoId(id);
      if (autoThumbnail || !customIcon) {
        setCustomIcon(thumbUrl);
        setSelectedIcon(null);
        setAutoThumbnail(true);
      }
    }
  }, [youtubeUrl, customIcon, autoThumbnail, currentVideoId]);
  */

  const handleSelectPreset = (icon) => {
    setSelectedIcon(icon);
    setCustomIcon(null);
    // setAutoThumbnail(false);
  };

  const handleCustomFile = (dataUrl) => {
    setCustomIcon(dataUrl);
    setSelectedIcon(null);
    // setAutoThumbnail(false);
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
          className="bg-white dark:bg-gray-800 rounded max-w-md w-full"
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              />
              {isFetchingTitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Загрузка названия...</p>
              )}
            </div>
            <input
              type="url"
              placeholder="YouTube URL"
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
            <IconPicker
              selectedIcon={selectedIcon}
              customIcon={customIcon}
              onSelectPreset={handleSelectPreset}
              onCustomFile={handleCustomFile}
            />
            {/* Временно убираем индикатор автоподстановки thumbnail */}
            {/* {autoThumbnail && customIcon && (
              <p className="text-xs text-green-600 dark:text-green-400">
                ✅ Thumbnail автоматически загружен с YouTube
              </p>
            )} */}
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