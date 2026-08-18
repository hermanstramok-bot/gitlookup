// ============================================================
// client/src/design/designSystem.jsx
//
// Shared design tokens, fonts, line-icons, and small reusable
// components for the LeseLearn UI. Extracted from Library.jsx
// so every page (Reader, Settings, VideoReader, Vocab, ...)
// draws from the same palette/typography/patterns instead of
// re-declaring them per-file.
//
// Usage:
//   import { sans, serif, useLibraryFonts, colors,
//            IconPencil, IconTrash, IconArrowRight, IconFolder,
//            IconChevronRight, IconClose, IconCheck, IconSettings,
//            IconBookmark, IconPlay, IconMenu, IconSearch,
//            MessageModal, ConfirmModal, StatusPill, STATUS_MAP
//   } from '../design/designSystem';
// ============================================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// Fonts
// ============================================================
const FONT_IMPORT_ID = 'leselearn-font-import';
export function useLibraryFonts() {
  useEffect(() => {
    if (document.getElementById(FONT_IMPORT_ID)) return;
    const link = document.createElement('link');
    link.id = FONT_IMPORT_ID;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
  }, []);
}

export const sans = { fontFamily: "'Inter', system-ui, sans-serif" };
// Kept as an alias so existing `style={serif}` call sites (headings, titles)
// don't need to change per-file — the whole app is now all-Inter, no serif.
export const serif = sans;

// ============================================================
// Color tokens (for reference / non-Tailwind usage, e.g. inline
// styles, SVG fills, canvas, chart libraries). Tailwind arbitrary
// values like `bg-[#1560E8]` remain the primary way these are
// used in JSX className strings.
// ============================================================
export const colors = {
  bg: { light: '#F2F4F7', dark: '#0F172A' },
  surface: { light: '#FFFFFF', dark: '#16202E' },
  surfaceSubtle: { light: '#F8FAFC', dark: '#1E2A3B' },
  surfaceInput: { light: '#FFFFFF', dark: '#0B1220' },
  border: { light: '#E2E8F0', dark: '#263447' },
  borderStrong: { light: '#CBD5E1', dark: '#35465C' },
  textPrimary: { light: '#0F172A', dark: '#FFFFFF' },
  textBody: { light: '#334155', dark: '#CBD5E1' },
  textMuted: { light: '#64748B', dark: '#94A3B8' },
  textFaint: { light: '#94A3B8', dark: '#64748B' },
  textSecondary: { light: '#475569', dark: '#B8B2A8' },
  navy: { DEFAULT: '#1560E8', hover: '#114FC4', darkText: '#5B9CFF' },
  sage: { DEFAULT: '#1FB854', text: '#0F8A3D', darkText: '#34D171' },
  clay: { DEFAULT: '#E23D3D', hover: '#C42E2E' },
  gold: { DEFAULT: '#FFB020', text: '#B45B00' },
  plum: { DEFAULT: '#7C5CFA', text: '#6A3FE0', darkText: '#B49CFF' },
};

// ============================================================
// Simple line icons (replace emoji) — inherit color via currentColor.
// Keep new icons in this file as the app grows, rather than
// re-declaring per-page copies.
// ============================================================
export function IconPencil({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

export function IconTrash({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function IconArrowRight({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconArrowLeft({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5" />
      <path d="M11 18l-6-6 6-6" />
    </svg>
  );
}

export function IconFolder({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

export function IconChevronRight({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconChevronLeft({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

export function IconChevronDown({ className = 'w-3.5 h-3.5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconClose({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18" />
      <path d="M6 6l12 12" />
    </svg>
  );
}

export function IconCheck({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export function IconSettings({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function IconBookmark({ className = 'w-4 h-4', filled = false }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17l-6-4-6 4V4z" />
    </svg>
  );
}

export function IconPlay({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export function IconPause({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

export function IconMenu({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </svg>
  );
}

export function IconSearch({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function IconSpeaker({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

export function IconFilter({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <line x1="4" y1="18" x2="20" y2="18" />
      <circle cx="10" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconLogout({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function IconExpand({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function IconMinimize({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v6H3" />
      <path d="M15 21v-6h6" />
      <path d="M21 3l-7 7" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

export function IconBook({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

export function IconFilm({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 4v16" />
      <path d="M17 4v16" />
      <path d="M3 9h4" />
      <path d="M3 15h4" />
      <path d="M17 9h4" />
      <path d="M17 15h4" />
    </svg>
  );
}

export function IconGrid({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function IconList({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3 6h.01" />
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
    </svg>
  );
}

// ============================================================
// Status pill tokens — shared across Library cards, Reader,
// Vocab. Keep this ONE definition so status colors never drift
// between pages.
// ============================================================
export const STATUS_MAP = {
  new: { label: 'Новое', dot: 'bg-[#1560E8]', text: 'text-[#1560E8] dark:text-[#5B9CFF]', bg: 'bg-[#1560E8]/10 dark:bg-[#1560E8]/20' },
  viewed: { label: 'Просмотрено', dot: 'bg-[#64748B]', text: 'text-[#475569] dark:text-[#94A3B8]', bg: 'bg-[#64748B]/10 dark:bg-[#64748B]/20' },
  learning: { label: 'Изучается', dot: 'bg-[#FFB020]', text: 'text-[#B45B00] dark:text-[#FFB020]', bg: 'bg-[#FFB020]/20 dark:bg-[#FFB020]/10' },
  completed: { label: 'Пройдено', dot: 'bg-[#1FB854]', text: 'text-[#0F8A3D] dark:text-[#34D171]', bg: 'bg-[#1FB854]/15 dark:bg-[#1FB854]/15' },
};

export function StatusPill({ status, className = '' }) {
  const s = STATUS_MAP[status];
  if (!s) return null;
  return (
    <span className={`${s.bg} ${s.text} rounded-full pl-1.5 pr-2.5 py-1 text-[11px] font-medium inline-flex items-center gap-1.5 ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ============================================================
// Shared modal shell — the consistent overlay/card/header/body/
// footer wrapper used everywhere a dialog appears.
// ============================================================
export function ModalShell({ isOpen, onClose, title, children, footer, maxWidth = 'max-w-md' }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`bg-white dark:bg-[#16202E] rounded-2xl w-full ${maxWidth} shadow-2xl`}
            style={sans}
          >
            {title && (
              <div className="p-5 border-b border-[#E2E8F0] dark:border-[#263447]">
                <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white" style={serif}>{title}</h2>
              </div>
            )}
            <div className="p-5">{children}</div>
            {footer && (
              <div className="border-t border-[#E2E8F0] dark:border-[#263447] p-4 flex justify-end gap-2">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Message (success / error) modal
// ============================================================
export function MessageModal({ isOpen, type, title, message, onClose, showBugReport = false }) {
  const borderColor = type === 'success' ? 'border-l-[#1FB854]' : 'border-l-[#E23D3D]';
  const icon = type === 'success' ? '✓' : '✕';
  const iconBg = type === 'success' ? 'bg-[#1FB854]' : 'bg-[#E23D3D]';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={`bg-white dark:bg-[#16202E] rounded-2xl max-w-md w-full border-l-4 ${borderColor} shadow-2xl`}
            style={sans}
          >
            <div className="p-5 flex items-start gap-3">
              <div className={`w-7 h-7 rounded-full ${iconBg} text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5`}>
                {icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg text-[#0F172A] dark:text-white">{title}</h3>
                <p className="text-[#475569] dark:text-[#B8B2A8] mt-1 text-sm leading-relaxed">{message}</p>
                {showBugReport && (
                  <button
                    onClick={() => window.open('https://example.com/report', '_blank')}
                    className="text-sm text-[#1560E8] dark:text-[#5B9CFF] hover:underline mt-2 font-medium"
                  >
                    Сообщить о баге
                  </button>
                )}
              </div>
            </div>
            <div className="border-t border-[#E2E8F0] dark:border-[#263447] p-3 flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#F8FAFC] dark:bg-[#1E2A3B] text-[#334155] dark:text-[#CBD5E1] rounded-full text-sm font-medium hover:bg-[#E2E8F0] dark:hover:bg-[#263447] transition"
              >
                Закрыть
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Generic confirm dialog
// ============================================================
export function ConfirmModal({ isOpen, title = 'Подтверждение', message, confirmLabel = 'Удалить', onClose, onConfirm }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="bg-white dark:bg-[#16202E] rounded-2xl max-w-md w-full shadow-2xl"
            style={sans}
          >
            <div className="p-5 border-b border-[#E2E8F0] dark:border-[#263447]">
              <h2 className="text-lg font-semibold text-[#0F172A] dark:text-white">{title}</h2>
            </div>
            <div className="p-5">
              <p className="text-[#334155] dark:text-[#CBD5E1] text-sm leading-relaxed">{message}</p>
            </div>
            <div className="border-t border-[#E2E8F0] dark:border-[#263447] p-4 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-[#CBD5E1] dark:border-[#35465C] rounded-full text-[#334155] dark:text-[#CBD5E1] text-sm font-medium hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition"
              >
                Отмена
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 bg-[#E23D3D] text-white rounded-full text-sm font-medium hover:bg-[#C42E2E] transition"
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ============================================================
// Primary / secondary / danger button style strings — use as
// `className={btn.primary}` etc. so button treatment stays
// consistent without copy-pasting the class list everywhere.
// ============================================================
export const btn = {
  primary: 'bg-[#1560E8] hover:bg-[#114FC4] text-white font-medium text-sm py-2.5 px-4 rounded-full transition shadow-sm',
  secondary: 'bg-white dark:bg-[#16202E] border border-[#CBD5E1] dark:border-[#35465C] text-[#334155] dark:text-[#CBD5E1] font-medium text-sm py-2.5 px-4 rounded-full hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B] transition shadow-sm',
  ghost: 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white text-sm font-medium transition px-2',
  danger: 'bg-[#E23D3D] hover:bg-[#C42E2E] text-white font-medium text-sm py-2.5 px-4 rounded-full transition shadow-sm',
  dangerGhost: 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#E23D3D] text-sm font-medium transition px-2',
};

// ============================================================
// Shared page shell — bg + max-width container used by every
// top-level page (Library, Vocab, Settings). Reader/VideoReader
// use their own full-bleed layout instead (see those files).
// ============================================================
export function PageShell({ children, maxWidth = 'max-w-6xl' }) {
  useLibraryFonts();
  return (
    <div className="min-h-screen bg-[#F2F4F7] dark:bg-[#0F172A] transition-colors duration-300" style={sans}>
      <div className={`${maxWidth} mx-auto px-6 sm:px-8 py-10`}>
        {children}
      </div>
    </div>
  );
}