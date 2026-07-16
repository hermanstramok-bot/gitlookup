import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

// Поддерживаемые изучаемые языки. Единственный источник правды для селекта
// в этом файле и для карты иконок в Header.jsx (держите синхронизировано).
const TARGET_LANGUAGES = [
  { code: 'de', label: 'Немецкий' },
  { code: 'es', label: 'Испанский' },
  { code: 'en', label: 'Английский' },
  { code: 'fr', label: 'Французский' },
  { code: 'pt', label: 'Португальский' },
];

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('account');

  const currentUser = {
    username: user?.username || 'Гость',
  };

  // Настройки языков
  const [interfaceLang, setInterfaceLang] = useState(() => {
    return localStorage.getItem('interfaceLang') || 'ru';
  });
  const [targetLang, setTargetLang] = useState(() => {
    return localStorage.getItem('targetLang') || 'de';
  });
  const [translationLang, setTranslationLang] = useState(() => {
    return localStorage.getItem('translationLang') || 'ru';
  });

  // Количество строк субтитров: 1 или 2
  const [subtitleLines, setSubtitleLines] = useState(() => {
    const saved = Number(localStorage.getItem('subtitleLines'));
    return saved === 2 ? 2 : 1;
  });

  // Настройки Ридера
  const [readerFont, setReaderFont] = useState(() => {
    return localStorage.getItem('readerFont') || 'sans';
  });
  const [readerVoice, setReaderVoice] = useState(() => {
    return localStorage.getItem('readerVoice') || 'male';
  });

  // Настройки targetLang/subtitleLines синхронизируются с бэкендом
  // (нужны на сервере — например, для подбора субтитров нужного языка).
  // Остальные настройки (интерфейс, перевод, шрифт, голос) пока только локальные.
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Загружаем настройки пользователя с бэкенда при монтировании.
  // Если запрос не удался — остаёмся на значениях из localStorage
  // и просто предупреждаем пользователя, не блокируя работу со страницей.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/user/settings');
        if (cancelled) return;
        if (data?.targetLang) setTargetLang(data.targetLang);
        if (data?.subtitleLines === 1 || data?.subtitleLines === 2) {
          setSubtitleLines(data.subtitleLines);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Не удалось загрузить настройки пользователя:', err);
          setSettingsError('Не удалось загрузить настройки с сервера. Используются локальные значения.');
        }
      } finally {
        if (!cancelled) setSettingsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Локальный кэш (localStorage) — как и раньше, для мгновенного чтения
  // другими компонентами (например, Header читает targetLang синхронно).
  useEffect(() => {
    localStorage.setItem('interfaceLang', interfaceLang);
    localStorage.setItem('translationLang', translationLang);
    localStorage.setItem('readerFont', readerFont);
    localStorage.setItem('readerVoice', readerVoice);
  }, [interfaceLang, translationLang, readerFont, readerVoice]);

  useEffect(() => {
    localStorage.setItem('targetLang', targetLang);
    // 'storage' событие не приходит в том же документе — уведомляем Header вручную.
    window.dispatchEvent(new Event('targetLangChange'));
  }, [targetLang]);

  useEffect(() => {
    localStorage.setItem('subtitleLines', String(subtitleLines));
  }, [subtitleLines]);

  // Сохраняем targetLang/subtitleLines на бэкенде с небольшим дебаунсом,
  // чтобы не слать запрос на каждый чих при быстром переключении.
  useEffect(() => {
    // Не шлём на сервер значения, пока не подтянули изначальные данные —
    // иначе можем на долю секунды перезаписать серверные настройки дефолтом.
    if (settingsLoading) return;

    const timeout = setTimeout(async () => {
      setSettingsSaving(true);
      try {
        await apiFetch('/api/user/settings', {
          method: 'PATCH',
          body: JSON.stringify({ targetLang, subtitleLines }),
        });
        setSettingsError(null);
      } catch (err) {
        console.error('Не удалось сохранить настройки пользователя:', err);
        setSettingsError('Не удалось сохранить настройки на сервере. Изменения сохранены только локально.');
      } finally {
        setSettingsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [targetLang, subtitleLines, settingsLoading]);

  // Редактирование ника
  const [editNickname, setEditNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(currentUser.username);

  const handleSaveNickname = () => {
    if (newNickname.trim()) {
      alert('Смена ника временно недоступна');
    }
    setEditNickname(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = () => {
    alert('Функция смены пароля будет доступна позже');
  };

  const menuItems = [
    { id: 'account', label: 'Аккаунт', icon: '👤' },
    { id: 'languages', label: 'Языки', icon: '🌐' },
    { id: 'subscription', label: 'Подписка', icon: '💎' },
    { id: 'reader', label: 'Ридер', icon: '📖' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Настройки</h1>
          <span className="text-sm dark:text-gray-300">👋 {currentUser.username}</span>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Левое меню */}
          <div className="md:w-64 bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <nav className="space-y-1 p-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors
                    ${
                      activeTab === item.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Правая область контента */}
          <div className="flex-1 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            {/* Вкладка: Аккаунт */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 pb-6 border-b border-gray-200 dark:border-gray-700">
                  {/* Аватар с весёлой собачкой */}
                  <div className="flex-shrink-0">
                    <img
                      src="/icons/happy.doggy.png"
                      alt="Аватар"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                    />
                    <button className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      Сменить аватар
                    </button>
                  </div>

                  {/* Данные пользователя */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Имя пользователя:</span>
                      {editNickname ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newNickname}
                            onChange={(e) => setNewNickname(e.target.value)}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveNickname}
                            className="px-2 py-1 bg-blue-600 text-white rounded text-sm"
                          >
                            Сохранить
                          </button>
                          <button
                            onClick={() => setEditNickname(false)}
                            className="px-2 py-1 bg-gray-500 text-white rounded text-sm"
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-900 dark:text-white font-medium">{currentUser.username}</span>
                          <button
                            onClick={() => setEditNickname(true)}
                            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            ✏️
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 text-sm">
                      <p className="text-gray-600 dark:text-gray-400">
                        <span className="text-gray-600 dark:text-gray-400">Email:</span> не указан
                      </p>
                      <p className="text-gray-600 dark:text-gray-400">
                        <span className="text-gray-600 dark:text-gray-400">Пароль:</span> ••••••••
                        <button
                          onClick={handleChangePassword}
                          className="ml-2 text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          Сменить
                        </button>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    onClick={handleLogout}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                  >
                    Выйти из аккаунта
                  </button>
                </div>
              </div>
            )}

            {/* Вкладка: Языки */}
            {activeTab === 'languages' && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Язык интерфейса
                  </label>
                  <select
                    value={interfaceLang}
                    onChange={(e) => setInterfaceLang(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="pt">Português</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Изучаемый язык
                  </label>
                  <select
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    disabled={settingsLoading}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-60"
                  >
                    {TARGET_LANGUAGES.map(({ code, label }) => (
                      <option key={code} value={code}>{label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Влияет на иконку языка в шапке, поиск субтитров и язык перевода в модальном окне.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Язык перевода
                  </label>
                  <select
                    value={translationLang}
                    onChange={(e) => setTranslationLang(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="ru">Русский</option>
                    <option value="en">Английский</option>
                    <option value="es">Испанский</option>
                    <option value="pt">Португальский</option>
                  </select>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  {settingsSaving
                    ? 'Сохранение изучаемого языка на сервере...'
                    : 'Настройки языка сохраняются автоматически'}
                </p>
                {settingsError && (
                  <p className="text-xs text-red-500 dark:text-red-400">{settingsError}</p>
                )}
              </div>
            )}

            {/* Вкладка: Подписка */}
            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <div className="bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 rounded-lg p-6 border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl">💎</span>
                    <div>
                      <h3 className="text-xl font-bold text-yellow-800 dark:text-yellow-400">Gold</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-300">
                        Действует до <strong>01.08.2027</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>✓ Неограниченный доступ к материалам</p>
                    <p>✓ Офлайн-словарь с расширенными переводами</p>
                    <p>✓ Приоритетная поддержка</p>
                  </div>
                  <button
                    onClick={() => alert('Управление подпиской будет доступно позже')}
                    className="mt-4 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition"
                  >
                    Управление подпиской
                  </button>
                </div>
              </div>
            )}

            {/* Новая вкладка: Ридер */}
            {activeTab === 'reader' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Настройки Ридера</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Эти параметры будут использоваться в режиме чтения текстов.
                </p>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Шрифт для чтения
                  </label>
                  <select
                    value={readerFont}
                    onChange={(e) => setReaderFont(e.target.value)}
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="sans">Sans-serif (без засечек)</option>
                    <option value="serif">Serif (с засечками)</option>
                    <option value="mono">Monospace (моноширинный)</option>
                    <option value="dyslexic">Dyslexic (для дислексии)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Озвучка (голос)
                  </label>
                  <div className="flex gap-6">
                    <label className="inline-flex items-center text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        value="male"
                        checked={readerVoice === 'male'}
                        onChange={() => setReaderVoice('male')}
                        className="form-radio text-blue-600 dark:text-blue-400"
                      />
                      <span className="ml-2">Мужской</span>
                    </label>
                    <label className="inline-flex items-center text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        value="female"
                        checked={readerVoice === 'female'}
                        onChange={() => setReaderVoice('female')}
                        className="form-radio text-blue-600 dark:text-blue-400"
                      />
                      <span className="ml-2">Женский</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Количество строк субтитров
                  </label>
                  <div className="flex gap-6">
                    <label className="inline-flex items-center text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        value={1}
                        checked={subtitleLines === 1}
                        onChange={() => setSubtitleLines(1)}
                        className="form-radio text-blue-600 dark:text-blue-400"
                      />
                      <span className="ml-2">1 строка</span>
                    </label>
                    <label className="inline-flex items-center text-gray-700 dark:text-gray-300">
                      <input
                        type="radio"
                        value={2}
                        checked={subtitleLines === 2}
                        onChange={() => setSubtitleLines(2)}
                        className="form-radio text-blue-600 dark:text-blue-400"
                      />
                      <span className="ml-2">2 строки</span>
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Применяется в видеоплеере и при записи видео.
                  </p>
                </div>

                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  {settingsSaving
                    ? 'Сохранение настроек субтитров на сервере...'
                    : 'Настройки сохраняются автоматически'}
                </p>
                {settingsError && (
                  <p className="text-xs text-red-500 dark:text-red-400">{settingsError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}