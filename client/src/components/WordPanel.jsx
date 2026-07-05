import { useSpeech } from '../hooks/useSpeech';

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

  onCanonicalChange,
  onVariantSelect,
  onManualChange,
  onSave,
  onClose,
  onToggleContext,
}) {
  const { speak, speechSupported } = useSpeech();

  const handleSpeak = () => {
    const word = (canonicalWord || '').trim();
    if (!word || !speechSupported) return;
    speak({ original: word }, 'wordpanel');
  };

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold dark:text-white">Перевод слова</h3>
        <button
          onClick={onClose}
          className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none"
        >
          ✕
        </button>
      </div>

      {selectedToken && (selectedToken.prefix || hasReflexive) && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 rounded">
          <div className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2">Компоненты глагола:</div>
          <div className="space-y-1 text-sm dark:text-gray-200">
            <div><strong>Основа:</strong> {selectedToken.lemma}</div>
            {selectedToken.prefix && (
              <div><strong>Приставка:</strong> {selectedToken.prefix}</div>
            )}
            {hasReflexive && (
              <div><strong>Возвратная частица:</strong> sich</div>
            )}
          </div>
        </div>
      )}

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Слово
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
              title="Прослушать слово"
            >
              🔊
            </button>
          )}
        </div>
      </div>

      <div className="mb-5 p-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 rounded">
        <label className="block text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
          Перевод
        </label>

        {translatingWord ? (
          <span className="animate-pulse dark:text-gray-300">⏳ Переводим...</span>
        ) : translationsList.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">Выберите вариант или введите свой:</p>
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
              placeholder="Свой перевод"
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
              placeholder="Редактировать перевод"
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
          📖 Показать контекст
        </button>
      ) : (
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
          <button
            onClick={onToggleContext}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
          >
            ✕ Скрыть
          </button>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Оригинальное предложение:</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{originalSentence || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Перевод предложения:</p>
              <p className="text-sm text-gray-800 dark:text-gray-200">{translatedSentence || '—'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <button onClick={() => onSave('new')} className="bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 dark:hover:bg-blue-700 transition text-sm">New</button>
        <button onClick={() => onSave('learning')} className="bg-yellow-500 text-white py-2 rounded-md hover:bg-yellow-600 dark:hover:bg-yellow-700 transition text-sm">Learning</button>
        <button onClick={() => onSave('known')} className="bg-green-500 text-white py-2 rounded-md hover:bg-green-600 dark:hover:bg-green-700 transition text-sm">Known</button>
      </div>
    </div>
  );
}