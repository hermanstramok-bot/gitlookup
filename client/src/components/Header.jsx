import { Link, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';
import { useI18n } from '../context/I18nContext';
import { sans, serif, useLibraryFonts, IconSettings, IconMenu, IconClose } from '../design/designSystem';

// Иконки изучаемых языков (лежат в /public/icons/lang/).
const LANG_ICONS = {
  de: { src: '/icons/lang/german_circle.png', title: 'Изучаемый язык: немецкий' },
  en: { src: '/icons/lang/english_circle.png', title: 'Изучаемый язык: английский' },
  es: { src: '/icons/lang/spanish_circle.png', title: 'Изучаемый язык: испанский' },
  fr: { src: '/icons/lang/french_circle.png', title: 'Изучаемый язык: французский' },
  pt: { src: '/icons/lang/portuguese_circle.png', title: 'Изучаемый язык: португальский' },
};
const DEFAULT_LANG = 'de';

export default function Header() {
  useLibraryFonts();
  const { t } = useI18n();
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Изучаемый язык — берём из localStorage (Settings.jsx пишет туда же).
  // Синхронизируется между вкладками через 'storage', а в пределах одной
  // вкладки — через кастомное событие 'targetLangChange' (localStorage
  // не шлёт 'storage' в том же документе, где было изменение).
  const [targetLang, setTargetLang] = useState(() => {
    return localStorage.getItem('targetLang') || DEFAULT_LANG;
  });

  useEffect(() => {
    const syncFromStorage = () => {
      setTargetLang(localStorage.getItem('targetLang') || DEFAULT_LANG);
    };
    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('targetLangChange', syncFromStorage);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('targetLangChange', syncFromStorage);
    };
  }, []);

  const langIcon = LANG_ICONS[targetLang] || LANG_ICONS[DEFAULT_LANG];

  // Для десктопного подчёркивания
  const libraryRef = useRef(null);
  const vocabRef = useRef(null);
  const trainerRef = useRef(null);
  const [underlineStyle, setUnderlineStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    let activeRef = null;
    if (isActive('/')) activeRef = libraryRef.current;
    else if (isActive('/vocab')) activeRef = vocabRef.current;
    else if (isActive('/trainer')) activeRef = trainerRef.current;

    if (activeRef) {
      const { offsetLeft, offsetWidth } = activeRef;
      setUnderlineStyle({ left: offsetLeft, width: offsetWidth });
    } else {
      setUnderlineStyle({ left: 0, width: 0 });
    }
  }, [location.pathname]);

  // Закрывать меню при смене страницы
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  // Закрывать меню при нажатии на Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // Блокировка скролла фона при открытом меню
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  // Мобильное меню (выезжает справа)
  const MobileMenu = () => (
    <AnimatePresence>
      {isMenuOpen && (
        <>
          {/* Затемнение фона */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Само меню */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-64 bg-[#1560E8] dark:bg-[#0F172A] z-50 shadow-2xl p-6 flex flex-col gap-6"
            style={sans}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-white/70 hover:text-white transition focus:outline-none p-1"
              >
                <IconClose className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-4 text-white">
              <Link
                to="/"
                className={`text-lg font-medium transition-colors hover:text-white/80 ${
                  isActive('/') ? 'text-white border-l-4 border-white pl-2' : ''
                }`}
              >
                {t('nav_library')}
              </Link>
              <Link
                to="/vocab"
                className={`text-lg font-medium transition-colors hover:text-white/80 ${
                  isActive('/vocab') ? 'text-white border-l-4 border-white pl-2' : ''
                }`}
              >
                {t('nav_vocab')}
              </Link>
              <Link
                to="/trainer"
                className={`text-lg font-medium transition-colors hover:text-white/80 ${
                  isActive('/trainer') ? 'text-white border-l-4 border-white pl-2' : ''
                }`}
              >
                {t('nav_trainer')}
              </Link>
              <Link
                to="/settings"
                className={`inline-flex items-center gap-2 text-lg font-medium transition-colors hover:text-white/80 ${
                  isActive('/settings') ? 'text-white border-l-4 border-white pl-2' : ''
                }`}
              >
                <IconSettings className="w-4 h-4" /> {t('nav_settings')}
              </Link>
              <div className="flex items-center gap-2 text-white text-sm">
                <img src={langIcon.src} alt={langIcon.title} className="h-5 w-5" title={langIcon.title} />
                <span className="opacity-70">{langIcon.title.replace('Изучаемый язык: ', '')}</span>
              </div>
              <div className="pt-4 mt-auto">
                <ThemeToggle />
              </div>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <header className="bg-[#1560E8] dark:bg-[#0F172A] text-white shadow-lg dark:border-b dark:border-[#263447] sticky top-0 z-10 transition-colors duration-300" style={sans}>
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition">
            <img src="/icons/doggy.png" alt="Doggy" className="h-7 w-auto" />
            <span className="font-bold text-lg" style={serif}>LeseLearn</span>
          </Link>

          {/* Десктопная навигация */}
          <nav className="hidden md:flex gap-6 items-center relative">
            <Link
              ref={libraryRef}
              to="/"
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              {t('nav_library')}
            </Link>
            <Link
              ref={vocabRef}
              to="/vocab"
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              {t('nav_vocab')}
            </Link>
            <Link
              ref={trainerRef}
              to="/trainer"
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              {t('nav_trainer')}
            </Link>

            {/* Флаг изучаемого языка между Словарём и Настройками */}
            <img
              src={langIcon.src}
              alt={langIcon.title}
              className="h-6 w-6"
              title={langIcon.title}
            />

            <Link
              to="/settings"
              className="text-white/85 transition-colors hover:text-white p-1"
              title={t('nav_settings')}
            >
              <IconSettings className="h-5 w-5" />
            </Link>

            <div className="ml-2">
              <ThemeToggle />
            </div>

            {underlineStyle.width > 0 && (
              <motion.div
                className="absolute bottom-0 h-0.5 bg-white rounded-full"
                initial={false}
                animate={{ left: underlineStyle.left, width: underlineStyle.width }}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
          </nav>

          {/* Мобильная кнопка-бургер */}
          <button
            onClick={() => setIsMenuOpen(true)}
            className="md:hidden flex items-center justify-center w-8 h-8 text-white/85 hover:text-white transition focus:outline-none"
          >
            <IconMenu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      <MobileMenu />
    </header>
  );
}