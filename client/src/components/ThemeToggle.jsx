import { useDarkMode } from '../hooks/useDarkMode';

export default function ThemeToggle() {
  const [dark, setDark] = useDarkMode();

  return (
    <button
      onClick={() => setDark(!dark)}
      className="relative w-14 h-7 rounded-full bg-white/25 dark:bg-[#0B1220] border border-white/30 dark:border-[#35465C] transition-colors duration-300 focus:outline-none flex items-center px-1"
      aria-label="Toggle theme"
    >
      <div
        className={`w-5 h-5 rounded-full bg-white dark:bg-[#1A2430] shadow-md transform transition-transform duration-300 flex items-center justify-center text-xs ${
          dark ? 'translate-x-7' : 'translate-x-0'
        }`}
      >
        {dark ? '🌙' : '☀️'}
      </div>
    </button>
  );
}