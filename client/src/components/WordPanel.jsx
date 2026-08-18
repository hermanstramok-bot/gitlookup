import { useSpeech } from '../hooks/useSpeech';
import { useI18n } from '../context/I18nContext';

// targetLang — код изучаемого языка ('de' | 'en' | 'es' | 'fr' | 'pt'),
// передаётся из Reader.jsx / VideoReader.jsx. Определяет, на каком языке
// озвучивается слово (иначе всегда звучало по-немецки, независимо от
// выбранного в Settings языка).
export default function WordPanel({
  canonicalWord,
  wordTranslation,
  translatingWord,
  translationsList,
  manualTranslation,
  selectedVariant,
  originalSentence,
  translatedSentence,
  showContext,
  selectedToken,
  hasReflexive,
  targetLang = 'de',
  isSkipped = false,
  isSaved = false,

  onCanonicalChange,
  onVariantSelect,
  onManualChange,
  onSave,
  onClose,
  onToggleContext,
  onToggleSkip,
}) {
  const { t } = useI18n();
  const { speak, speechSupported } = useSpeech();

  const handleSpeak = () => {
    const word = (canonicalWord || '').trim();
    if (!word || !speechSupported) return;
    speak({ original: word }, 'wordpanel', targetLang);
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold dark:text-white">{t('word_panel_title')}</h3>
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {selectedToken && (selectedToken.prefix || hasReflexive) && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded">
          <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">{t('word_panel_verb_components')}</div>
          <div className="space-y-1 text-sm dark:text-gray-200">
            <div><strong>{t('word_panel_stem')}</strong> {selectedToken.lemma}</div>
            {selectedToken.prefix && (
              <div><strong>{t('word_panel_prefix')}</strong> {selectedToken.prefix}</div>
            )}
            {hasReflexive && (
              <div><strong>{t('word_panel_reflexive_particle')}</strong> sich</div>
            )}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t('word_panel_word_label')}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={canonicalWord || ''}
            onChange={(e) => onCanonicalChange(e.target.value)}
            className="flex-1 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          />
          {speechSupported && (canonicalWord || '').trim() && (
            <button
              onClick={handleSpeak}
              className="flex-shrink-0 px-3 py-2 text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400 transition-colors"
              title={t('word_panel_listen_title')}
            >
              🔊
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 p-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded">
        <label className="block text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
          {t('word_panel_translation_label')}
        </label>

        {translatingWord ? (
          <span className="animate-pulse dark:text-gray-300">⏳ {t('word_panel_translating')}</span>
        ) : translationsList.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">{t('word_panel_choose_variant')}</p>
            <div className="flex flex-wrap gap-2">
              {translationsList.map((tr, i) => (
                <button
                  key={i}
                  onClick={() => onVariantSelect(tr)}
                  className={`px-3 py-1 rounded-full text-sm border transition ${
                    selectedVariant === tr
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-green-100 dark:hover:bg-green-800'
                  }`}
                >
                  {tr}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={manualTranslation || ''}
              onChange={(e) => onManualChange(e.target.value)}
              placeholder={t('word_panel_own_translation_placeholder')}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm mt-2"
            />
          </div>
        ) : (
          <div>
            <div className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
              {wordTranslation || '—'}
            </div>
            <input
              type="text"
              value={manualTranslation || ''}
              onChange={(e) => onManualChange(e.target.value)}
              placeholder={t('word_panel_edit_translation_placeholder')}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            />
          </div>
        )}
      </div>

      {!showContext ? (
        <button
          onClick={onToggleContext}
          className="w-full mb-4 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition text-sm"
        >
          {t('word_panel_show_context')}
        </button>
      ) : (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
          <button
            onClick={onToggleContext}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
          >
            {t('word_panel_hide_context')}
          </button>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{t('word_panel_original_sentence')}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{originalSentence || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">{t('word_panel_translated_sentence')}</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{translatedSentence || '—'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button onClick={() => onSave('new')} className="bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 transition text-sm">{t('word_panel_status_new')}</button>
        <button onClick={() => onSave('learning')} className="bg-yellow-500 text-white py-2 rounded-md hover:bg-yellow-600 dark:hover:bg-yellow-700 transition text-sm">{t('word_panel_status_learning')}</button>
        <button onClick={() => onSave('known')} className="bg-green-500 text-white py-2 rounded-md hover:bg-green-600 dark:hover:bg-green-700 transition text-sm">{t('word_panel_status_known')}</button>
      </div>

      {/* Spec 1: пропустить слово только в этом материале (не трогает словарь).
          Показываем только для уже сохранённых слов (New/Learning/Known) —
          для ещё не сохранённого слова скрывать нечего, поэтому кнопка не нужна. */}
      {onToggleSkip && isSaved && (
        <div className="mt-2">
          <button
            onClick={onToggleSkip}
            className={`w-full py-2 rounded-md transition text-sm border ${
              isSkipped
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
            title={isSkipped
              ? t('word_panel_skip_restore_title')
              : t('word_panel_skip_hide_title')}
          >
            {isSkipped ? t('word_panel_skip_restore_button') : t('word_panel_skip_hide_button')}
          </button>
        </div>
      )}
    </div>
  );
}