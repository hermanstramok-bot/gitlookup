// client/src/components/TextImportModal.jsx
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import IconPicker from './IconPicker';
import { PRESET_ICONS } from '../constants';
import JSZip from 'jszip';

export default function TextImportModal({ isOpen, onClose, onSubmit, loading }) {
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(PRESET_ICONS[0]);
  const [customIcon, setCustomIcon] = useState(null);
  const fileInputRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState('new');

  useEffect(() => {
    if (!isOpen) {
      setTitle('');
      setTextContent('');
      setSelectedIcon(PRESET_ICONS[0]);
      setCustomIcon(null);
      setIsProcessing(false);
      setAuthor('');
      setStatus('new');
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
      alert('Не удалось прочитать файл');
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
            throw new Error('Не найдено ни одного HTML или текстового файла в EPUB');
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
            throw new Error('Не удалось извлечь текст из файлов');
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
          throw new Error('Не удалось извлечь текст из EPUB');
        }

        setTextContent(fullText.trim());
        setIsProcessing(false);
      } catch (err) {
        console.error('Ошибка парсинга EPUB:', err);
        alert(`Не удалось распарсить EPUB-файл: ${err.message}`);
        setIsProcessing(false);
      }
    };
    reader.onerror = () => {
      alert('Не удалось прочитать файл');
      setIsProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (ext !== 'txt' && ext !== 'epub') {
      alert('Пожалуйста, выберите файл с расширением .txt или .epub');
      e.target.value = '';
      return;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    if (!title.trim()) {
      setTitle(baseName);
    }

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
      alert('Заполните все поля');
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
            <h2 className="text-xl font-bold dark:text-white">Импорт текста</h2>
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
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
            
            <input
              type="text"
              placeholder="Автор (необязательно)"
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

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Загрузите .txt или .epub файл
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.epub"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  dark:file:bg-blue-900 dark:file:text-blue-200
                  hover:file:bg-blue-100 dark:hover:file:bg-blue-800
                  cursor-pointer"
              />
              {isProcessing && (
                <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                  ⏳ Обработка файла...
                </p>
              )}
            </div>

            <textarea
              placeholder="Или введите текст вручную"
              rows={6}
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
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
              <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-full dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700">
                Отмена
              </button>
              <button type="submit" disabled={loading || isProcessing} className="px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 disabled:opacity-50">
                {loading ? 'Импорт...' : 'Импорт'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}