// client/src/components/YouTubeImportModal.jsx
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// NOTE: icon picker intentionally disabled for video imports (per design
// decision) — video cards don't use a custom icon anymore, they always
// show the film icon (see Library.jsx MaterialCard). Left the import and
// component commented out rather than deleted, in case this changes later.
// import IconPicker from './IconPicker';
import { PRESET_ICONS } from '../constants';
import { sans, IconClose } from '../design/designSystem';
import { useI18n } from '../context/I18nContext';

export default function YouTubeImportModal({ isOpen, onClose, onSubmit, loading }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
  const [customIcon, setCustomIcon] = useState(null);
  const [isFetchingTitle, setIsFetchingTitle] = useState(false);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('new');
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setYoutubeUrl('');
      setSelectedIcon(PRESET_ICONS[0]);
      setCustomIcon(null);
      setIsFetchingTitle(false);
      setAuthor('');
      setStatus('new');
      setThumbnailError(false);
    }
  }, [isOpen]);

  const extractVideoId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  const videoId = extractVideoId(youtubeUrl);
  const thumbnailUrl = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : null;

  useEffect(() => {
    // reset broken-image state whenever the URL (and therefore videoId) changes
    setThumbnailError(false);
  }, [videoId]);

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

  // Kept for payload compatibility (onSubmit still sends an `icon` field,
  // since that's what the backend/Material model expects) — but the picker
  // UI itself is removed, so this always stays at the default preset icon.
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
      alert(t('import_youtube_error_missing_url'));
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

  const inputClass = 'w-full px-3.5 py-2.5 border border-[#CBD5E1] dark:border-[#35465C] rounded-xl bg-white dark:bg-[#0B1220] text-[#0F172A] dark:text-white text-sm placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[#1560E8] focus:border-transparent transition';
  const labelClass = 'block text-sm font-medium text-[#334155] dark:text-[#CBD5E1] mb-1.5';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="bg-white dark:bg-[#16202E] rounded-2xl max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto"
          style={sans}
        >
          <div className="flex justify-between items-center p-5 border-b border-[#E2E8F0] dark:border-[#263447]">
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">{t('import_youtube_title')}</h2>
            <button onClick={onClose} className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition p-1">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <input
              type="url"
              placeholder={t('import_youtube_url_placeholder')}
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              className={inputClass}
              required
            />

            {thumbnailUrl && !thumbnailError && (
              <div className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#263447] bg-[#F8FAFC] dark:bg-[#0B1220] aspect-video">
                <img
                  src={thumbnailUrl}
                  alt={t('import_youtube_thumbnail_alt')}
                  className="w-full h-full object-cover"
                  onError={() => setThumbnailError(true)}
                />
              </div>
            )}

            <div>
              <input
                type="text"
                placeholder={t('import_youtube_title_placeholder')}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputClass}
              />
              {isFetchingTitle && (
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1.5">{t('import_youtube_title_loading')}</p>
              )}
            </div>

            <input
              type="text"
              placeholder={t('import_youtube_author_placeholder')}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputClass}
            />

            <div>
              <label className={labelClass}>{t('import_youtube_status_label')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="new">{t('import_youtube_status_new')}</option>
                <option value="completed">{t('import_youtube_status_completed')}</option>
              </select>
            </div>

            {/*
              Icon picker removed for video imports per design decision —
              video materials always display the film icon (see
              Library.jsx MaterialCard), so there's nothing for the user
              to pick here. Left commented rather than deleted in case
              per-video custom icons come back later.

              <IconPicker
                selectedIcon={selectedIcon}
                customIcon={customIcon}
                onSelectPreset={handleSelectPreset}
                onCustomFile={handleCustomFile}
              />
            */}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-full text-[#334155] dark:text-[#CBD5E1] text-sm font-medium hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition"
              >
                {t('import_youtube_cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#1560E8] text-white rounded-full text-sm font-medium hover:bg-[#114FC4] transition disabled:opacity-50"
              >
                {loading ? t('import_youtube_submitting') : t('import_youtube_submit')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}