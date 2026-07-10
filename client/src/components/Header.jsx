import { Link, useLocation } from 'react-router-dom';
import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThemeToggle from './ThemeToggle';

export default function Header() {
  const location = useLocation();
  const isActive = (path) => location.pathname === path;
  const [isMenuOpen, setIsMenuOpen] = useState(false);

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
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsMenuOpen(false)}
          />
          {/* Само меню */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed top-0 right-0 bottom-0 w-64 bg-blue-900 dark:bg-gray-800 z-50 shadow-xl p-6 flex flex-col gap-6"
          >
            <div className="flex justify-end">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="text-white text-2xl focus:outline-none"
              >
                ✕
              </button>
            </div>
            <nav className="flex flex-col gap-4 text-white">
              <Link
                to="/"
                className={`text-lg font-medium transition-colors hover:text-blue-200 ${
                  isActive('/') ? 'text-blue-200 border-l-4 border-blue-200 pl-2' : ''
                }`}
              >
                Библиотека
              </Link>
              <Link
                to="/vocab"
                className={`text-lg font-medium transition-colors hover:text-blue-200 ${
                  isActive('/vocab') ? 'text-blue-200 border-l-4 border-blue-200 pl-2' : ''
                }`}
              >
                Словарь
              </Link>
              <Link
                to="/trainer"
                className={`text-lg font-medium transition-colors hover:text-blue-200 ${
                  isActive('/trainer') ? 'text-blue-200 border-l-4 border-blue-200 pl-2' : ''
                }`}
              >
                Тренажёр
              </Link>
              <Link
                to="/settings"
                className={`text-lg font-medium transition-colors hover:text-blue-200 ${
                  isActive('/settings') ? 'text-blue-200 border-l-4 border-blue-200 pl-2' : ''
                }`}
              >
                ⚙️ Настройки
              </Link>
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
    <header className="bg-blue-900 dark:bg-gray-900 text-white shadow-lg sticky top-0 z-10 transition-colors duration-300">
      <div className="w-full px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          {/* Логотип */}
          <Link to="/" className="flex items-center gap-2 hover:opacity-90 transition">
            <img src="/icons/doggy.png" alt="Doggy" className="h-7 w-auto" />
            <span className="font-bold text-lg">LeseLearn</span>
          </Link>

          {/* Десктопная навигация */}
          <nav className="hidden md:flex gap-6 items-center relative">
            <Link
              ref={libraryRef}
              to="/"
              className="text-sm font-medium text-white transition-colors hover:text-blue-200 dark:hover:text-gray-300"
            >
              Библиотека
            </Link>
            <Link
              ref={vocabRef}
              to="/vocab"
              className="text-sm font-medium text-white transition-colors hover:text-blue-200 dark:hover:text-gray-300"
            >
              Словарь
            </Link>
            <Link
              ref={trainerRef}
              to="/trainer"
              className="text-sm font-medium text-white transition-colors hover:text-blue-200 dark:hover:text-gray-300"
            >
              Тренажёр
            </Link>

            {/* Флаг немецкого языка между Словарём и Настройками */}
            <img
              src="/icons/lang/german_circle.png"
              alt="язык: немецкий"
              className="h-6 w-6"
              title="Изучаемый язык: немецкий"
            />

            <Link
              to="/settings"
              className="text-sm font-medium text-white transition-colors hover:text-blue-200 dark:hover:text-gray-300 p-1"
              title="Настройки"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
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
            className="md:hidden flex flex-col justify-center items-center w-8 h-8 gap-1 text-white focus:outline-none"
          >
            <span className="block w-5 h-0.5 bg-white rounded"></span>
            <span className="block w-5 h-0.5 bg-white rounded"></span>
            <span className="block w-5 h-0.5 bg-white rounded"></span>
          </button>
        </div>
      </div>

      {/* Мобильное меню */}
      <MobileMenu />
    </header>
  );
}