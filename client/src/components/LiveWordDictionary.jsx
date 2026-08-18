import { useState, useCallback, useRef, useEffect } from 'react';
import { apiFetch } from '../utils/api';
import { useI18n } from '../context/I18nContext';

const PANEL_WIDTH = 288; // px, соответствует w-72
const VIEWPORT_MARGIN = 16; // отступ от края экрана

// Spec 2: "During reading — live dictionary view". Иконка, по клику
// открывающая панель со списком слов материала (New/Learning/Known) и
// переводами. Чисто информационная — без возможности менять статус тут.
export default function LiveWordDictionary({ materialId }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [words, setWords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [panelStyle, setPanelStyle] = useState(null);
  const buttonRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/materials/${materialId}/words`);
      setWords(data.words || []);
    } catch (err) {
      console.error('Ошибка загрузки словаря материала:', err);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  // Кнопка часто оказывается у самого левого края экрана на мобильных
  // (шапка переносится в несколько строк), поэтому позиционируем панель
  // через fixed + вычисленные координаты кнопки, а не через absolute
  // right-0/left-0 относительно неё — иначе панель фиксированной ширины
  // (w-72) вылезает за край экрана и обрезается.
  const positionPanel = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2);
    const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
    const left = Math.min(Math.max(rect.left, VIEWPORT_MARGIN), Math.max(maxLeft, VIEWPORT_MARGIN));
    setPanelStyle({ top: rect.bottom + 8, left, width });
  }, []);

  useEffect(() => {
    if (!open) return;
    positionPanel();
    window.addEventListener('resize', positionPanel);
    return () => window.removeEventListener('resize', positionPanel);
  }, [open, positionPanel]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next) load();
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        title={t('live_dict_title')}
        className={`inline-flex items-center gap-1.5 font-medium text-sm py-1.5 px-3.5 rounded-full transition shadow-sm border ${
          open
            ? 'bg-[#1560E8]/10 dark:bg-[#1560E8]/20 border-[#1560E8]/40 text-[#1560E8] dark:text-[#5B9CFF]'
            : 'bg-white dark:bg-[#1A2430] border-[#DCD7CC] dark:border-[#3A4756] text-[#3D3B36] dark:text-[#D8D3C9] hover:bg-[#F7F5F0] dark:hover:bg-[#233040]'
        }`}
      >
        {t('live_dict_button')}
      </button>

      {open && panelStyle && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            style={{ top: panelStyle.top, left: panelStyle.left, width: panelStyle.width }}
            className="fixed max-h-96 overflow-y-auto bg-white dark:bg-[#16202E] border border-[#E2E8F0] dark:border-[#263447] rounded-xl shadow-lg z-50 p-2"
          >
            {loading ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center py-4">{t('common_loading')}</p>
            ) : words.length === 0 ? (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] text-center py-4">
                {t('live_dict_empty')}
              </p>
            ) : (
              <div className="space-y-1">
                {words.map((w) => (
                  <div key={w.vocabId} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F8FAFC] dark:hover:bg-[#1E2A3B]">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{w.word}</div>
                      {w.translation && (
                        <div className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{w.translation}</div>
                      )}
                    </div>
                    <span className={`flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 ${
                      w.status === 'known'
                        ? 'bg-[#16A34A]/10 text-[#16A34A]'
                        : w.status === 'learning'
                        ? 'bg-[#F59E0B]/10 text-[#B45309]'
                        : 'bg-[#94A3B8]/10 text-[#64748B] dark:text-[#94A3B8]'
                    }`}>
                      {w.status === 'known' ? t('live_dict_status_known') : w.status === 'learning' ? t('live_dict_status_learning') : t('live_dict_status_new')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}