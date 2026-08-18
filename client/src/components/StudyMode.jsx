import React from 'react';
import { useI18n } from '../context/I18nContext';

export default function StudyMode({
  text,
  renderWords,
  translations,
  showTranslations,
  speechSupported,
  speakingIdx,
  onSpeak,
  startIndex,
  endIndex,
  totalPages,
  currentPage,
  setCurrentPage,
  isCalculating,
}) {
  const { t } = useI18n();
  const currentSentences = text.sentences.slice(startIndex, endIndex);

  if (isCalculating) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 dark:text-gray-500">
          {t('study_mode_calculating')}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {currentSentences.map((sentence, idx) => {
          const globalIdx = startIndex + idx;
          return (
            <div key={sentence.id} className="mb-4 group">
              <div className="flex items-start gap-2">
                {speechSupported && (
                  <button
                    onClick={() => onSpeak(sentence, globalIdx)}
                    className="flex-shrink-0 mt-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                  >
                    {speakingIdx === globalIdx ? '⏹️' : '🔊'}
                  </button>
                )}
                <div className="flex-1 border-l-4 border-gray-200 dark:border-gray-600 pl-4">
                  <p className="text-[20px]">{renderWords(sentence, globalIdx)}</p>
                  {showTranslations && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 mt-1 min-h-[1.5rem]">
                      {translations[sentence.id] || t('study_mode_translation_loading')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {currentSentences.length === 0 && (
          <p className="text-gray-400 text-center">{t('study_mode_no_sentences')}</p>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {t('common_prev_page')}
          </button>
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              currentPage === totalPages - 1
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {t('common_next_page')}
          </button>
        </div>
      )}
    </div>
  );
}