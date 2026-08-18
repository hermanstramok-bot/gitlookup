// client/src/components/TextImportModal.jsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconPicker from './IconPicker';
import { PRESET_ICONS } from '../constants';
import JSZip from 'jszip';
import { sans, IconClose } from '../design/designSystem';
import { useI18n } from '../context/I18nContext';

export default function TextImportModal({ isOpen, onClose, onSubmit, loading }) {
  const { t } = useI18n();
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
  const [customIcon, setCustomIcon] = useState(null);
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('new');
  const [selectedFileName, setSelectedFileName] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setTextContent('');
      setSelectedIcon(PRESET_ICONS[0]);
      setCustomIcon(null);
      setIsProcessing(false);
      setAuthor('');
      setStatus('new');
      setSelectedFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [isOpen]);

  const handleTxtFile = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      setTextContent(event.target.result);
      setIsProcessing(false);
    };
    reader.onerror = () => {
      alert(t('import_text_error_read_file'));
      setIsProcessing(false);
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleEpubFile = (file) => {
    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const arrayBuffer = event.target.result;
        const zip = await JSZip.loadAsync(arrayBuffer);

        const htmlFiles = [];
        zip.forEach((relativePath, zipEntry) => {
          if (!zipEntry.dir) {
            const ext = relativePath.split('.').pop().toLowerCase();
            if (['html', 'htm', 'xhtml', 'xml'].includes(ext)) {
              htmlFiles.push(relativePath);
            }
          }
        });

        if (htmlFiles.length === 0) {
          const textFiles = [];
          zip.forEach((relativePath, zipEntry) => {
            if (!zipEntry.dir && /\.(txt|html?|xhtml|xml)$/i.test(relativePath)) {
              textFiles.push(relativePath);
            }
          });
          if (textFiles.length === 0) {
            throw new Error(t('import_text_error_no_html_in_epub'));
          }
          let fullText = '';
          for (const filePath of textFiles) {
            try {
              const content = await zip.file(filePath).async('text');
              if (content) fullText += content + '\n\n';
            } catch (err) {
              console.warn(`Не удалось прочитать ${filePath}:`, err);
            }
          }
          if (!fullText.trim()) {
            throw new Error(t('import_text_error_extract_files'));
          }
          setTextContent(fullText.trim());
          setIsProcessing(false);
          return;
        }

        htmlFiles.sort();

        let fullText = '';
        for (const filePath of htmlFiles) {
          try {
            const content = await zip.file(filePath).async('text');
            const parser = new DOMParser();
            const doc = parser.parseFromString(content, 'text/html');
            const bodyText = doc.body?.textContent || '';
            if (bodyText) fullText += bodyText + '\n\n';
          } catch (err) {
            console.warn(`Не удалось прочитать ${filePath}:`, err);
          }
        }

        if (!fullText.trim()) {
          throw new Error(t('import_text_error_extract_epub'));
        }

        setTextContent(fullText.trim());
        setIsProcessing(false);
      } catch (err) {
        console.error('Ошибка парсинга EPUB:', err);
        alert(t('import_text_error_parse_epub', { message: err.message }));
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      alert(t('import_text_error_read_file'));
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'txt' && ext !== 'epub') {
      alert(t('import_text_error_invalid_ext'));
      e.target.value = '';
      return;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    if (!title.trim()) {
      setTitle(baseName);
    }
    setSelectedFileName(file.name);

    if (ext === 'txt') {
      handleTxtFile(file);
    } else if (ext === 'epub') {
      handleEpubFile(file);
    }

    e.target.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const icon = customIcon || selectedIcon || PRESET_ICONS[0];
    if (!title || !textContent) {
      alert(t('import_text_error_missing_fields'));
      return;
    }
    onSubmit({
      type: 'text',
      title,
      content: textContent,
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
            <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">{t('import_text_title')}</h2>
            <button onClick={onClose} className="text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white transition p-1">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            <input
              type="text"
              placeholder={t('import_text_title_placeholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              required
            />

            <input
              type="text"
              placeholder={t('import_text_author_placeholder')}
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className={inputClass}
            />

            <div>
              <label className={labelClass}>{t('import_text_status_label')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={inputClass}
              >
                <option value="new">{t('import_text_status_new')}</option>
                <option value="completed">{t('import_text_status_completed')}</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>{t('import_text_file_label')}</label>
              <div className="flex items-center gap-3">
                <label className="flex-shrink-0 py-2 px-4 rounded-full text-sm font-semibold bg-[#1560E8] text-white hover:bg-[#114FC4] cursor-pointer transition">
                  {t('import_text_file_choose')}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.epub"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-sm text-[#64748B] dark:text-[#94A3B8] truncate">
                  {selectedFileName || t('import_text_file_none')}
                </span>
              </div>
              {isProcessing && (
                <p className="text-sm text-[#1560E8] dark:text-[#5B9CFF] mt-1.5">
                  {t('import_text_file_processing')}
                </p>
              )}
            </div>

            <textarea
              placeholder={t('import_text_content_placeholder')}
              rows={6}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className={`${inputClass} resize-none`}
              required={!textContent}
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
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-full text-[#334155] dark:text-[#CBD5E1] text-sm font-medium hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition"
              >
                {t('import_text_cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || isProcessing}
                className="px-4 py-2 bg-[#1560E8] text-white rounded-full text-sm font-medium hover:bg-[#114FC4] transition disabled:opacity-50"
              >
                {loading ? t('import_text_submitting') : t('import_text_submit')}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}