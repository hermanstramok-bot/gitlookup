import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { apiFetch } from '../utils/api';
import {
  sans, serif, useLibraryFonts,
  IconPencil, IconCheck, IconClose, IconLogout, IconTrash,
} from '../design/designSystem';

// Spec 2 (доп., п.8): дефолты "калькулятора повторений" — должны совпадать
// с DEFAULT_REVIEW_SETTINGS в server/utils/reviewUtils.js (единственный
// источник правды для расчёта живёт на бэкенде, это только форма для правки).
const DEFAULT_REVIEW_SETTINGS = {
  intervals: [
    { maxPercent: 50, days: 3 },
    { maxPercent: 70, days: 7 },
    { maxPercent: 85, days: 14 },
    { maxPercent: 95, days: 30 },
  ],
  defaultDays: 60,
  archivePercent: 95,
  archiveIntervalDays: 60,
  dropOverrideThreshold: 15,
  overrideMinDays: 3,
  overrideMaxDays: 7,
};

// Поддерживаемые изучаемые языки. Единственный источник правды для селекта
// в этом файле и для карты иконок в Header.jsx (держите синхронизировано).
// label — ключ перевода (lang_*), не готовая строка, т.к. язык интерфейса
// может отличаться от языка, показанного в списке.
const TARGET_LANGUAGES = [
  { code: 'de', labelKey: 'lang_de', icon: '/icons/lang/german_circle.png' },
  { code: 'es', labelKey: 'lang_es', icon: '/icons/lang/spanish_circle.png' },
  { code: 'en', labelKey: 'lang_en', icon: '/icons/lang/english_circle.png' },
  { code: 'fr', labelKey: 'lang_fr', icon: '/icons/lang/french_circle.png' },
  { code: 'pt', labelKey: 'lang_pt', icon: '/icons/lang/portuguese_circle.png' },
];

const TRANSLATION_LANGUAGES = ['ru', 'en', 'de', 'es', 'pt'];

// ============================================================
// Shared field wrappers so every input/select in this page has
// consistent label/spacing/focus treatment.
// ============================================================
function FieldLabel({ children }) {
  return (
    <label className="block text-sm font-medium text-[#3D3B36] dark:text-[#D8D3C9] mb-2">
      {children}
    </label>
  );
}

function SelectInput(props) {
  return (
    <select
      {...props}
      className={`w-full md:w-64 px-3.5 py-2.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-xl bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80] focus:border-transparent disabled:opacity-60 transition ${props.className || ''}`}
    />
  );
}

function RadioOption({ checked, onChange, children }) {
  return (
    <label className="inline-flex items-center gap-2 text-[#3D3B36] dark:text-[#D8D3C9] text-sm cursor-pointer">
      <span
        onClick={onChange}
        className={`w-4 h-4 rounded-full border flex items-center justify-center transition ${
          checked
            ? 'border-[#3D5A80] bg-[#3D5A80]'
            : 'border-[#DCD7CC] dark:border-[#3A4756] bg-white dark:bg-[#111A24]'
        }`}
      >
        {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
      </span>
      {children}
    </label>
  );
}

export default function Settings() {
  useLibraryFonts();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('account');

  const currentUser = {
    username: user?.username || t('settings_guest'),
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

  // Spec 2 (доп., п.8): "калькулятор повторений" — настраиваемые интервалы
  // и пороги Review Loop. Сохраняются на бэкенде вручную (кнопка), не
  // дебаунсом — это структура с массивом, часто трогать её нет смысла.
  const [reviewSettings, setReviewSettings] = useState(DEFAULT_REVIEW_SETTINGS);
  const [reviewSettingsSaving, setReviewSettingsSaving] = useState(false);
  const [reviewSettingsSaved, setReviewSettingsSaved] = useState(false);

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
        if (data?.reviewSettings) setReviewSettings(data.reviewSettings);
      } catch (err) {
        if (!cancelled) {
          console.error('Не удалось загрузить настройки пользователя:', err);
          setSettingsError(t('settings_error_load'));
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
    // 'storage' не приходит в том же документе — уведомляем I18nProvider вручную.
    window.dispatchEvent(new Event('interfaceLangChange'));
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
        setSettingsError(t('settings_error_save'));
      } finally {
        setSettingsSaving(false);
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [targetLang, subtitleLines, settingsLoading]);

  // --- Калькулятор повторений (п.8) ---
  const updateInterval = (index, field, value) => {
    setReviewSettings(prev => ({
      ...prev,
      intervals: prev.intervals.map((iv, i) => i === index ? { ...iv, [field]: Number(value) || 0 } : iv),
    }));
  };
  const addInterval = () => {
    setReviewSettings(prev => ({
      ...prev,
      intervals: [...prev.intervals, { maxPercent: 100, days: 1 }],
    }));
  };
  const removeInterval = (index) => {
    setReviewSettings(prev => ({
      ...prev,
      intervals: prev.intervals.filter((_, i) => i !== index),
    }));
  };
  const updateReviewField = (field, value) => {
    setReviewSettings(prev => ({ ...prev, [field]: Number(value) || 0 }));
  };

  const saveReviewSettings = async () => {
    setReviewSettingsSaving(true);
    setReviewSettingsSaved(false);
    try {
      const sorted = { ...reviewSettings, intervals: [...reviewSettings.intervals].sort((a, b) => a.maxPercent - b.maxPercent) };
      const data = await apiFetch('/api/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ reviewSettings: sorted }),
      });
      if (data?.reviewSettings) setReviewSettings(data.reviewSettings);
      setReviewSettingsSaved(true);
      setSettingsError(null);
    } catch (err) {
      console.error('Не удалось сохранить настройки повторений:', err);
      setSettingsError(t('settings_error_review_save'));
    } finally {
      setReviewSettingsSaving(false);
    }
  };

  const resetReviewSettings = async () => {
    setReviewSettingsSaving(true);
    setReviewSettingsSaved(false);
    try {
      const data = await apiFetch('/api/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ reviewSettings: null }),
      });
      setReviewSettings(data?.reviewSettings || DEFAULT_REVIEW_SETTINGS);
      setReviewSettingsSaved(true);
    } catch (err) {
      console.error('Не удалось сбросить настройки повторений:', err);
      setSettingsError(t('settings_error_review_reset'));
    } finally {
      setReviewSettingsSaving(false);
    }
  };

  // Редактирование ника
  const [editNickname, setEditNickname] = useState(false);
  const [newNickname, setNewNickname] = useState(currentUser.username);

  const handleSaveNickname = () => {
    if (newNickname.trim()) {
      alert(t('settings_alert_nickname_unavailable'));
    }
    setEditNickname(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleChangePassword = () => {
    alert(t('settings_alert_password_soon'));
  };

  const menuItems = [
    { id: 'account', label: t('settings_tab_account') },
    { id: 'languages', label: t('settings_tab_languages') },
    { id: 'review', label: t('settings_tab_review') },
    { id: 'subscription', label: t('settings_tab_subscription') },
    { id: 'reader', label: t('settings_tab_reader') },
  ];

  return (
    <div className="min-h-screen bg-[#F2F4F7] dark:bg-[#0F172A] py-10 px-4 transition-colors duration-300" style={sans}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 flex-wrap gap-2">
          <h1 className="text-4xl font-bold text-[#0F1720] dark:text-white tracking-tight" style={serif}>
            {t('settings_title')}
          </h1>
          <span className="text-sm text-[#8B8378] dark:text-[#8B8F97]">{currentUser.username}</span>
        </div>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Левое меню */}
          <div className="md:w-64 bg-white dark:bg-[#1A2430] rounded-2xl border border-[#EDE9E1] dark:border-[#2A3644] shadow-[0_1px_2px_rgba(15,23,32,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] overflow-hidden h-fit">
            <nav className="space-y-1 p-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-[#3D5A80]/10 dark:bg-[#3D5A80]/25 text-[#3D5A80] dark:text-[#8AAFD9]'
                      : 'text-[#3D3B36] dark:text-[#D8D3C9] hover:bg-[#F7F5F0] dark:hover:bg-[#233040]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Правая область контента */}
          <div className="flex-1 bg-white dark:bg-[#1A2430] rounded-2xl border border-[#EDE9E1] dark:border-[#2A3644] shadow-[0_1px_2px_rgba(15,23,32,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4)] p-6 md:p-8">
            {/* Вкладка: Аккаунт */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center sm:flex-row sm:items-start gap-6 pb-6 border-b border-[#EDE9E1] dark:border-[#2A3644]">
                  {/* Аватар с весёлой собачкой */}
                  <div className="flex-shrink-0 text-center sm:text-left">
                    <img
                      src="/icons/happy.doggy.png"
                      alt={t('settings_avatar_alt')}
                      className="w-24 h-24 rounded-full object-cover border-2 border-[#EDE9E1] dark:border-[#2A3644]"
                    />
                    <button className="mt-2 text-sm text-[#3D5A80] dark:text-[#8AAFD9] hover:underline font-medium">
                      {t('settings_change_avatar')}
                    </button>
                  </div>

                  {/* Данные пользователя */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#8B8378] dark:text-[#8B8F97] font-medium text-sm">{t('settings_username_label')}</span>
                      {editNickname ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newNickname}
                            onChange={(e) => setNewNickname(e.target.value)}
                            className="px-3 py-1.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-lg bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80] focus:border-transparent"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveNickname}
                            className="p-1.5 rounded-lg bg-[#3D5A80] hover:bg-[#324B69] text-white transition"
                            title={t('settings_save_title')}
                          >
                            <IconCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditNickname(false)}
                            className="p-1.5 rounded-lg border border-[#DCD7CC] dark:border-[#3A4756] text-[#8B8378] dark:text-[#8B8F97] hover:bg-[#F7F5F0] dark:hover:bg-[#233040] transition"
                            title={t('settings_cancel_title')}
                          >
                            <IconClose className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[#0F1720] dark:text-white font-medium text-sm">{currentUser.username}</span>
                          <button
                            onClick={() => setEditNickname(true)}
                            className="text-[#8B8378] dark:text-[#8B8F97] hover:text-[#3D5A80] dark:hover:text-[#8AAFD9] transition p-1"
                            title={t('settings_edit_name_title')}
                          >
                            <IconPencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 text-sm">
                      <p className="text-[#8B8378] dark:text-[#8B8F97]">
                        {t('settings_email_label')}
                      </p>
                      <p className="text-[#8B8378] dark:text-[#8B8F97] flex items-center gap-2">
                        {t('settings_password_label')}
                        <button
                          onClick={handleChangePassword}
                          className="text-[#3D5A80] dark:text-[#8AAFD9] hover:underline text-sm font-medium"
                        >
                          {t('settings_password_change')}
                        </button>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    onClick={handleLogout}
                    className="inline-flex items-center gap-2 bg-[#C1666B] hover:bg-[#A85358] text-white font-medium text-sm py-2.5 px-4 rounded-full transition shadow-sm"
                  >
                    <IconLogout className="w-4 h-4" /> {t('settings_logout')}
                  </button>
                </div>
              </div>
            )}

            {/* Вкладка: Языки */}
            {activeTab === 'languages' && (
              <div className="space-y-6">
                <div>
                  <FieldLabel>{t('settings_interface_lang_label')}</FieldLabel>
                  <SelectInput
                    value={interfaceLang}
                    onChange={(e) => setInterfaceLang(e.target.value)}
                  >
                    <option value="ru">Русский</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                    <option value="pt">Português</option>
                  </SelectInput>
                </div>

                <div>
                  <FieldLabel>{t('settings_target_lang_label')}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <img
                      src={TARGET_LANGUAGES.find((l) => l.code === targetLang)?.icon}
                      alt={targetLang}
                      className="w-8 h-8 rounded-full flex-shrink-0"
                    />
                    <SelectInput
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      disabled={settingsLoading}
                    >
                      {TARGET_LANGUAGES.map(({ code, labelKey }) => (
                        <option key={code} value={code}>{t(labelKey)}</option>
                      ))}
                    </SelectInput>
                  </div>
                  <p className="text-xs text-[#B4AEA2] dark:text-[#5A6472] mt-1.5">
                    {t('settings_target_lang_hint')}
                  </p>
                </div>

                <div>
                  <FieldLabel>{t('settings_translation_lang_label')}</FieldLabel>
                  <SelectInput
                    value={translationLang}
                    onChange={(e) => setTranslationLang(e.target.value)}
                  >
                    {TRANSLATION_LANGUAGES.map((code) => (
                      <option key={code} value={code}>{t(`lang_${code}`)}</option>
                    ))}
                  </SelectInput>
                  <p className="text-xs text-[#B4AEA2] dark:text-[#5A6472] mt-1.5">
                    {t('settings_translation_lang_hint')}
                  </p>
                </div>

                <p className="text-xs text-[#B4AEA2] dark:text-[#5A6472] mt-4">
                  {settingsSaving
                    ? t('settings_lang_saving')
                    : t('settings_lang_autosave')}
                </p>
                {settingsError && (
                  <p className="text-xs text-[#C1666B]">{settingsError}</p>
                )}
              </div>
            )}

            {/* Вкладка: Повторение (Spec 2 доп., п.8 — "калькулятор повторений") */}
            {activeTab === 'review' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-[#0F1720] dark:text-white mb-2" style={serif}>
                    {t('settings_review_how_title')}
                  </h2>
                  <div className="text-sm text-[#3D3B36] dark:text-[#D8D3C9] space-y-2">
                    <p>{t('settings_review_how_p1')}</p>
                    <p>{t('settings_review_how_p2')}</p>
                    <p>{t('settings_review_how_p3')}</p>
                    <p>{t('settings_review_how_p4')}</p>
                  </div>
                </div>

                <div>
                  <FieldLabel>{t('settings_review_intervals_label')}</FieldLabel>
                  <div className="space-y-2">
                    {reviewSettings.intervals.map((iv, idx) => (
                      <div key={idx} className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-[#3D3B36] dark:text-[#D8D3C9]">{t('settings_review_if_known_lt')}</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={iv.maxPercent}
                          onChange={(e) => updateInterval(idx, 'maxPercent', e.target.value)}
                          className="w-20 px-2.5 py-1.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-lg bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                        />
                        <span className="text-sm text-[#3D3B36] dark:text-[#D8D3C9]">{t('settings_review_then_repeat_in')}</span>
                        <input
                          type="number"
                          min="1"
                          value={iv.days}
                          onChange={(e) => updateInterval(idx, 'days', e.target.value)}
                          className="w-20 px-2.5 py-1.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-lg bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                        />
                        <span className="text-sm text-[#3D3B36] dark:text-[#D8D3C9]">{t('settings_review_days_suffix')}</span>
                        <button
                          onClick={() => removeInterval(idx)}
                          className="text-[#B4AEA2] dark:text-[#5A6472] hover:text-[#C1666B] transition p-1"
                          title={t('settings_review_remove_row_title')}
                        >
                          <IconTrash className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={addInterval}
                      className="text-sm text-[#3D5A80] dark:text-[#8AAFD9] hover:underline font-medium"
                    >
                      {t('settings_review_add_row')}
                    </button>
                    <span className="text-sm text-[#3D3B36] dark:text-[#D8D3C9]">
                      {t('settings_review_otherwise')}
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={reviewSettings.defaultDays}
                      onChange={(e) => updateReviewField('defaultDays', e.target.value)}
                      className="w-20 px-2.5 py-1.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-lg bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                    />
                    <span className="text-sm text-[#3D3B36] dark:text-[#D8D3C9]">{t('settings_review_days_suffix')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>{t('settings_review_archive_percent_label')}</FieldLabel>
                    <input
                      type="number" min="1" max="100"
                      value={reviewSettings.archivePercent}
                      onChange={(e) => updateReviewField('archivePercent', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-xl bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                    />
                  </div>
                  <div>
                    <FieldLabel>{t('settings_review_archive_days_label')}</FieldLabel>
                    <input
                      type="number" min="1"
                      value={reviewSettings.archiveIntervalDays}
                      onChange={(e) => updateReviewField('archiveIntervalDays', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-xl bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                    />
                  </div>
                  <div>
                    <FieldLabel>{t('settings_review_drop_threshold_label')}</FieldLabel>
                    <input
                      type="number" min="1" max="100"
                      value={reviewSettings.dropOverrideThreshold}
                      onChange={(e) => updateReviewField('dropOverrideThreshold', e.target.value)}
                      className="w-full px-3.5 py-2.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-xl bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                    />
                  </div>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <FieldLabel>{t('settings_review_override_min_label')}</FieldLabel>
                      <input
                        type="number" min="1"
                        value={reviewSettings.overrideMinDays}
                        onChange={(e) => updateReviewField('overrideMinDays', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-xl bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                      />
                    </div>
                    <div className="flex-1">
                      <FieldLabel>{t('settings_review_override_max_label')}</FieldLabel>
                      <input
                        type="number" min="1"
                        value={reviewSettings.overrideMaxDays}
                        onChange={(e) => updateReviewField('overrideMaxDays', e.target.value)}
                        className="w-full px-3.5 py-2.5 border border-[#DCD7CC] dark:border-[#3A4756] rounded-xl bg-[#FDFCFA] dark:bg-[#111A24] text-[#0F1720] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A80]"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={saveReviewSettings}
                    disabled={reviewSettingsSaving}
                    className="bg-[#3D5A80] hover:bg-[#324B69] disabled:opacity-50 text-white font-medium text-sm py-2.5 px-4 rounded-full transition shadow-sm"
                  >
                    {reviewSettingsSaving ? t('settings_review_saving') : t('settings_save_title')}
                  </button>
                  <button
                    onClick={resetReviewSettings}
                    disabled={reviewSettingsSaving}
                    className="border border-[#DCD7CC] dark:border-[#3A4756] text-[#3D3B36] dark:text-[#D8D3C9] font-medium text-sm py-2.5 px-4 rounded-full hover:bg-[#F7F5F0] dark:hover:bg-[#233040] transition"
                  >
                    {t('settings_review_reset')}
                  </button>
                  {reviewSettingsSaved && (
                    <span className="text-sm text-[#6B8F71] dark:text-[#8FB596] font-medium">{t('settings_review_saved')}</span>
                  )}
                </div>
              </div>
            )}

            {/* Вкладка: Подписка */}
            {activeTab === 'subscription' && (
              <div className="space-y-6">
                <div className="bg-[#E9C46A]/10 dark:bg-[#E9C46A]/10 rounded-2xl p-6 border border-[#E9C46A]/40 dark:border-[#E9C46A]/25">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#E9C46A]/25 flex items-center justify-center flex-shrink-0">
                      <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-[#8A6D1F]" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 3h12l4 6-10 12L2 9z" />
                        <path d="M2 9h20" />
                        <path d="M9 3l3 6 3-6" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#8A6D1F] dark:text-[#E9C46A]" style={serif}>Gold</h3>
                      <p className="text-sm text-[#3D3B36] dark:text-[#D8D3C9]">
                        {t('settings_sub_expires')} <strong>01.08.2027</strong>
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm text-[#3D3B36] dark:text-[#D8D3C9]">
                    <p>{t('settings_sub_feature1')}</p>
                    <p>{t('settings_sub_feature2')}</p>
                    <p>{t('settings_sub_feature3')}</p>
                  </div>
                  <button
                    onClick={() => alert(t('settings_alert_subscription_soon'))}
                    className="mt-4 bg-[#8A6D1F] hover:bg-[#725A19] text-white font-medium text-sm py-2.5 px-4 rounded-full transition shadow-sm"
                  >
                    {t('settings_sub_manage')}
                  </button>
                </div>
              </div>
            )}

            {/* Вкладка: Ридер */}
            {activeTab === 'reader' && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-[#0F1720] dark:text-white" style={serif}>{t('settings_reader_title')}</h2>
                <p className="text-sm text-[#8B8378] dark:text-[#8B8F97]">
                  {t('settings_reader_desc')}
                </p>

                <div>
                  <FieldLabel>{t('settings_reader_font_label')}</FieldLabel>
                  <SelectInput
                    value={readerFont}
                    onChange={(e) => setReaderFont(e.target.value)}
                  >
                    <option value="sans">{t('settings_reader_font_sans')}</option>
                    <option value="serif">{t('settings_reader_font_serif')}</option>
                    <option value="mono">{t('settings_reader_font_mono')}</option>
                    <option value="dyslexic">{t('settings_reader_font_dyslexic')}</option>
                  </SelectInput>
                </div>

                <div>
                  <FieldLabel>{t('settings_reader_voice_label')}</FieldLabel>
                  <div className="flex gap-6">
                    <RadioOption checked={readerVoice === 'male'} onChange={() => setReaderVoice('male')}>
                      {t('settings_reader_voice_male')}
                    </RadioOption>
                    <RadioOption checked={readerVoice === 'female'} onChange={() => setReaderVoice('female')}>
                      {t('settings_reader_voice_female')}
                    </RadioOption>
                  </div>
                </div>

                <div>
                  <FieldLabel>{t('settings_reader_subtitle_lines_label')}</FieldLabel>
                  <div className="flex gap-6">
                    <RadioOption checked={subtitleLines === 1} onChange={() => setSubtitleLines(1)}>
                      {t('settings_reader_subtitle_line_1')}
                    </RadioOption>
                    <RadioOption checked={subtitleLines === 2} onChange={() => setSubtitleLines(2)}>
                      {t('settings_reader_subtitle_line_2')}
                    </RadioOption>
                  </div>
                  <p className="text-xs text-[#B4AEA2] dark:text-[#5A6472] mt-1.5">
                    {t('settings_reader_subtitle_lines_hint')}
                  </p>
                </div>

                <p className="text-xs text-[#B4AEA2] dark:text-[#5A6472] mt-4">
                  {settingsSaving
                    ? t('settings_reader_saving')
                    : t('settings_reader_autosave')}
                </p>
                {settingsError && (
                  <p className="text-xs text-[#C1666B]">{settingsError}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}