// client/src/pages/Settings.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Settings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');

  // Данные пользователя (заглушки)
  const [user, setUser] = useState({
    avatar: '/icons/default-avatar.png',
    nickname: 'GermanLearner',
    email: 'learner@example.com',
    login: 'german_learner'
  });

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

  // Сохранение в localStorage при изменении
  useEffect(() => {
    localStorage.setItem('interfaceLang', interfaceLang);
    localStorage.setItem('targetLang', targetLang);
    localStorage.setItem('translationLang', translationLang);
  }, [interfaceLang, targetLang, translationLang]);

  // Редактирование ника
  const [editNickname, setEditNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(user.nickname);

  const handleSaveNickname = () => {
    if (newNickname.trim()) {
      setUser({ ...user, nickname: newNickname.trim() });
    }
    setEditNickname(false);
  };

  const handleLogout = () => {
    // Очистить все данные сессии (если есть токены)
    localStorage.clear();
    // Перенаправить на главную
    navigate('/');
  };

  const handleChangePassword = () => {
    alert('Функция смены пароля будет доступна позже');
  };

  const menuItems = [
    { id: 'account', label: 'Аккаунт', icon: '👤' },
    { id: 'languages', label: 'Языки', icon: '🌐' },
    { id: 'subscription', label: 'Подписка', icon: '💎' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Настройки</h1>
        
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
                    ${activeTab === item.id
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
                  {/* Аватар */}
                  <div className="flex-shrink-0">
                    <img
                      src={user.avatar}
                      alt="Avatar"
                      className="w-24 h-24 rounded-full object-cover border-2 border-gray-300 dark:border-gray-600"
                      onError={(e) => { e.target.src = '/icons/default-avatar.png'; }}
                    />
                    <button className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                      Сменить аватар
                    </button>
                  </div>
                  
                  {/* Ник и данные */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">Ник:</span>
                      {editNickname ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newNickname}
                            onChange={(e) => setNewNickname(e.target.value)}
                            className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
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
                          <span className="text-gray-900 dark:text-white font-medium">{user.nickname}</span>
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
                      <p><span className="text-gray-600 dark:text-gray-400">Email:</span> {user.email}</p>
                      <p><span className="text-gray-600 dark:text-gray-400">Логин:</span> {user.login}</p>
                      <p>
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

                <div className="pt-4">
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
                    className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="de">Немецкий</option>
                    <option value="en">Английский</option>
                    <option value="fr">Французский</option>
                    <option value="es">Испанский</option>
                  </select>
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
                  Настройки языка сохраняются автоматически
                </p>
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
                      <p className="text-sm text-gray-600 dark:text-gray-300">Действует до <strong>01.08.2027</strong></p>
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
          </div>
        </div>
      </div>
    </div>
  );
}