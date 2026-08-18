import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { translations } from '../i18n/translations';

// Spec 2 (доп., п.11): язык интерфейса — настоящая настройка (Settings.jsx,
// interfaceLang), а не заглушка. Читает localStorage и переподписывается на
// изменения через тот же паттерн, что и targetLang в Header.jsx.
const I18nContext = createContext(null);

function getInterfaceLang() {
  const lang = localStorage.getItem('interfaceLang') || 'ru';
  return translations[lang] ? lang : 'ru';
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(getInterfaceLang);

  useEffect(() => {
    const sync = () => setLang(getInterfaceLang());
    window.addEventListener('storage', sync);
    window.addEventListener('interfaceLangChange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('interfaceLangChange', sync);
    };
  }, []);

  const t = useCallback((key, vars) => {
    const dict = translations[lang] || translations.ru;
    let str = dict[key] ?? translations.ru[key] ?? key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, v);
      });
    }
    return str;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
