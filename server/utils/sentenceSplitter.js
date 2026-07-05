// server/utils/sentenceSplitter.js

const sbd = require('sbd');

/**
 * Разбивает текст на предложения, используя библиотеку sbd.
 * Поддерживает немецкий и английский языки "из коробки".
 *
 * @param {string} text - текст для разбиения
 * @param {string} language - код языка ('de' или 'en')
 * @returns {string[]} массив предложений
 */
function splitSentences(text, language = 'de') {
  if (!text || typeof text !== 'string') return [];

  // sbd ожидает опции
  const options = {
    newline_boundaries: false,
    html_boundaries: false,
    sanitize: false,
    allowed_tags: false,
    // Для немецкого нужно использовать 'de', для английского 'en'
    // По умолчанию используется 'en'
  };

  // sbd использует разные внутренние правила в зависимости от языка
  // Но в текущей версии он определяет язык автоматически, или можно указать в параметрах
  // Для надёжности явно передаём язык (sbd поддерживает 'de', 'en', 'fr', 'es', и др.)
  const sentences = sbd.sentences(text, {
    ...options,
    // Явно указываем язык для правильной обработки аббревиатур
    language: language === 'de' ? 'de' : 'en'
  });

  // Обрезаем пробелы и фильтруем пустые
  return sentences.map(s => s.trim()).filter(s => s.length > 0);
}

module.exports = { splitSentences };