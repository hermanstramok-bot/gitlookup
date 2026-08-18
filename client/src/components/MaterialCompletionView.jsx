import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/api';
import { useI18n } from '../context/I18nContext';

// Spec 2 (доп.): встроенный (не модальный) экран завершения материала —
// подменяет собой область текста/видео при достижении конца материала.
// Заменяет прежний PostReadingSummary (модалка) и ReviewSession (отдельная
// страница) — три фазы теперь живут в одном компоненте:
//   1) celebration — один раз, при переходе new -> viewed в этой сессии
//   2a) информационная сводка — все слова материала + CTA по статусу
//   2b) review-pass квиз — только если материал открыт в review-режиме
//
// Props:
//   materialId, materialStatus ('new'|'viewed'|'learning'|'completed')
//   justCompleted — показать фазу celebration при монтировании
//   reviewMode — открыть сразу в фазе квиза (2b) вместо сводки (2a)
//   sessionStartWords — Map<vocabId, status> снятая при монтировании ридера
//   onStatusChange(newStatus) — статус материала изменился (add/remove/archive)
//   onCelebrationDone() — пользователь закрыл фазу celebration (чтобы родитель
//     больше не показывал её повторно в рамках этой же сессии чтения)
//   onBack() — вернуться к тексту/видео (та же кнопка "← Назад", что и для
//     листания страниц — единый UI вместо отдельной "Назад к тексту/видео")
export default function MaterialCompletionView({
  materialId,
  materialStatus,
  justCompleted,
  reviewMode,
  sessionStartWords,
  onStatusChange,
  onCelebrationDone,
  onBack,
}) {
  const { t } = useI18n();
  const [phase, setPhase] = useState(() =>
    justCompleted ? 'celebration' : (reviewMode ? 'quiz' : 'summary')
  );
  const [status, setStatus] = useState(materialStatus);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setStatus(materialStatus); }, [materialStatus]);

  const changeStatus = (next) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  const handleContinueFromCelebration = () => {
    setPhase(reviewMode ? 'quiz' : 'summary');
    onCelebrationDone?.();
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
      {phase === 'celebration' && (
        <CelebrationPhase onContinue={handleContinueFromCelebration} />
      )}
      {phase === 'summary' && (
        <SummaryPhase
          materialId={materialId}
          status={status}
          sessionStartWords={sessionStartWords}
          busy={busy}
          setBusy={setBusy}
          onStatusChange={changeStatus}
        />
      )}
      {phase === 'quiz' && (
        <QuizPhase
          materialId={materialId}
          onStatusChange={changeStatus}
        />
      )}
      {onBack && (
        <div className="pt-4 mt-4 border-t border-[#E2E8F0] dark:border-[#263447] flex-shrink-0">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg font-medium transition bg-blue-500 text-white hover:bg-blue-600"
          >
            {t('common_prev_page')}
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Фаза 1 — celebration
// ============================================================
function CelebrationPhase({ onContinue }) {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="text-6xl mb-4">🎉</div>
      <h2 className="text-2xl font-bold text-[#0F172A] dark:text-white mb-2">{t('material_completion_celebration_title')}</h2>
      <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-8">
        {t('material_completion_celebration_subtitle')}
      </p>
      <button
        onClick={onContinue}
        className="bg-[#1560E8] hover:bg-[#114FC4] text-white font-medium text-sm py-2.5 px-6 rounded-full transition shadow-sm"
      >
        {t('material_completion_continue')}
      </button>
    </div>
  );
}

// ============================================================
// Фаза 2a — информационная сводка
// ============================================================
function SummaryPhase({ materialId, status, sessionStartWords, busy, setBusy, onStatusChange }) {
  const { t } = useI18n();
  const [words, setWords] = useState(null);
  const [excludeNew, setExcludeNew] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/materials/${materialId}/words`)
      .then(data => { if (!cancelled) setWords(data.words || []); })
      .catch(err => console.error('Ошибка загрузки слов материала:', err));
    return () => { cancelled = true; };
  }, [materialId]);

  const rankOf = (s) => (s === 'known' ? 2 : s === 'learning' ? 1 : 0);
  const rows = (words || []).map(w => {
    const startStatus = sessionStartWords?.get(w.vocabId) ?? null;
    const changed = startStatus !== null && rankOf(w.status) > rankOf(startStatus);
    return { ...w, changed };
  });

  // Spec 2 (доп., п.6.2): статус можно поправить руками только при первом
  // разборе материала — то есть здесь, в информационной сводке. В квизе
  // повторения (QuizPhase) статус меняется только через механику "знаю/учу".
  const handleWordStatusChange = async (vocabId, newStatus) => {
    try {
      await apiFetch(`/api/vocab/${vocabId}`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      setWords(prev => prev.map(w => w.vocabId === vocabId ? { ...w, status: newStatus } : w));
    } catch (err) {
      console.error('Ошибка изменения статуса слова:', err);
      alert(t('material_completion_error_status'));
    }
  };

  // Spec 2 (доп., п.6.1): экспорт изучаемых слов, с опцией не учитывать New.
  const handleExport = () => {
    const toExport = rows.filter(w => !excludeNew || w.status !== 'new');
    if (toExport.length === 0) {
      alert(t('material_completion_error_export_empty'));
      return;
    }
    let csv = `${t('material_completion_csv_header')}\n`;
    toExport.forEach(w => {
      csv += `"${w.word}","${w.translation || ''}","${w.status}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'material-words.csv');
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAddToReview = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/materials/${materialId}/review`, { method: 'POST' });
      onStatusChange('learning');
    } catch (err) {
      console.error('Ошибка добавления в Review loop:', err);
      alert(t('material_completion_error_add_review'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveFromReview = async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/materials/${materialId}/review`, { method: 'DELETE' });
      onStatusChange('viewed');
    } catch (err) {
      console.error('Ошибка удаления из Review loop:', err);
      alert(t('material_completion_error_remove_review'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-1 pb-4 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">{t('material_completion_summary_title')}</h2>
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
            {t('material_completion_summary_subtitle')}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 flex-shrink-0">
          <button
            onClick={handleExport}
            className="bg-[#1FB854] hover:bg-[#17A34A] text-white text-xs font-medium py-1.5 px-3 rounded-full transition shadow-sm whitespace-nowrap"
          >
            {t('material_completion_export_learning_words')}
          </button>
          <label className="inline-flex items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8] cursor-pointer whitespace-nowrap">
            <input
              type="checkbox"
              checked={excludeNew}
              onChange={(e) => setExcludeNew(e.target.checked)}
              className="w-3.5 h-3.5 accent-[#1560E8]"
            />
            {t('material_completion_exclude_new')}
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {words === null ? (
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] text-center py-6">{t('common_loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] text-center py-6">
            {t('material_completion_summary_empty')}
          </p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((w) => (
              <div
                key={w.vocabId}
                className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-[#F8FAFC] dark:bg-[#1E2A3B]"
              >
                <div className="min-w-0">
                  <div className="font-medium text-[#0F172A] dark:text-white truncate">{w.word}</div>
                  {w.translation && (
                    <div className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{w.translation}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {w.changed && <span className="text-[#16A34A] text-sm font-bold">↑</span>}
                  <select
                    value={w.status}
                    onChange={(e) => handleWordStatusChange(w.vocabId, e.target.value)}
                    title={t('material_completion_status_edit_title')}
                    className={`text-[10px] font-semibold uppercase tracking-wide rounded-full pl-2 pr-1 py-0.5 border-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#1560E8] ${
                      w.status === 'known'
                        ? 'bg-[#16A34A]/10 text-[#16A34A]'
                        : w.status === 'learning'
                        ? 'bg-[#F59E0B]/10 text-[#B45309]'
                        : 'bg-[#94A3B8]/10 text-[#64748B] dark:text-[#94A3B8]'
                    }`}
                  >
                    <option value="new">{t('word_panel_status_new')}</option>
                    <option value="learning">{t('word_panel_status_learning')}</option>
                    <option value="known">{t('word_panel_status_known')}</option>
                  </select>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-[#E2E8F0] dark:border-[#263447] flex justify-end">
        {status === 'learning' ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-[#16A34A]">✓ {t('material_completion_status_learning')}</span>
            <button
              onClick={handleRemoveFromReview}
              disabled={busy}
              className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8] hover:text-[#DC2626] transition disabled:opacity-50"
            >
              {t('material_completion_remove_from_review')}
            </button>
          </div>
        ) : status === 'completed' ? (
          <span className="text-sm font-medium text-[#16A34A]">✓ {t('material_completion_status_completed')}</span>
        ) : (
          <button
            onClick={handleAddToReview}
            disabled={busy}
            className="bg-[#1560E8] hover:bg-[#114FC4] disabled:opacity-50 text-white font-medium text-sm py-2.5 px-5 rounded-full transition shadow-sm"
          >
            {busy ? t('material_completion_adding') : t('material_completion_start_learning')}
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Фаза 2b — review-pass квиз
// ============================================================
function QuizPhase({ materialId, onStatusChange }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [archiving, setArchiving] = useState(false);
  const [archived, setArchived] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch(`/api/materials/${materialId}/review`);
      setWords(data.words || []);
      // New и Learning по умолчанию считаются "Ещё учу" — пользователь сам
      // подтверждает каждое слово как "Знаю", если действительно его выучил.
      // Known-слова в проход не попадают вовсе (см. calculateMaterialReviewStats
      // в reviewUtils.js — trackedWords содержит только new/learning).
      const initial = {};
      (data.words || []).forEach(w => { initial[w.vocabId] = 'learning'; });
      setDecisions(initial);
    } catch (err) {
      console.error('Ошибка загрузки review pass:', err);
    } finally {
      setLoading(false);
    }
  }, [materialId]);

  useEffect(() => { load(); }, [load]);

  const setDecision = (vocabId, s) => setDecisions(prev => ({ ...prev, [vocabId]: s }));

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const updates = Object.entries(decisions).map(([vocabId, newStatus]) => ({
        vocabId: parseInt(vocabId), newStatus,
      }));
      const data = await apiFetch(`/api/materials/${materialId}/review/pass`, {
        method: 'POST',
        body: JSON.stringify({ updates }),
      });
      setResult(data);
    } catch (err) {
      console.error('Ошибка сохранения прохода:', err);
      alert(t('material_completion_error_save_pass'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    setArchiving(true);
    try {
      await apiFetch(`/api/materials/${materialId}/archive`, { method: 'POST' });
      setArchived(true);
      onStatusChange('completed');
    } catch (err) {
      console.error('Ошибка архивации:', err);
      alert(t('material_completion_error_archive'));
    } finally {
      setArchiving(false);
    }
  };

  const knownCount = Object.values(decisions).filter(v => v === 'known').length;
  const stillLearningCount = Object.values(decisions).filter(v => v === 'learning').length;

  if (loading) {
    return <p className="text-sm text-[#64748B] dark:text-[#94A3B8] text-center py-16">{t('common_loading')}</p>;
  }

  if (result) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-6">
        <p className="text-lg font-semibold text-[#0F172A] dark:text-white mb-2">
          {result.percentKnown !== null
            ? t('material_completion_percent_known', { percent: Math.round(result.percentKnown) })
            : t('material_completion_pass_saved')}
        </p>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-6">
          {t('material_completion_next_review', {
            days: result.intervalDays,
            unit: t(result.intervalDays === 1 ? 'material_completion_day_unit_singular' : 'material_completion_day_unit_plural'),
          })}
        </p>
        {archived ? (
          <span className="text-sm font-medium text-[#16A34A]">✓ {t('material_completion_status_completed')}</span>
        ) : result.eligibleForArchive ? (
          <button
            onClick={handleArchive}
            disabled={archiving}
            className="bg-[#16A34A] hover:bg-[#128a3e] disabled:opacity-50 text-white font-medium text-sm py-2.5 px-5 rounded-full transition shadow-sm"
          >
            {archiving ? t('material_completion_archiving') : t('material_completion_archive_as_learned')}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-1 pb-4">
        <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">{t('material_completion_quiz_title')}</h2>
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-1">
          {t('material_completion_quiz_subtitle')}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-1">
        {words.length === 0 ? (
          <p className="text-sm text-[#64748B] dark:text-[#94A3B8] text-center py-6">
            {t('material_completion_quiz_empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {words.map((w) => (
              <div
                key={w.vocabId}
                className="flex items-center justify-between gap-3 bg-[#F8FAFC] dark:bg-[#1E2A3B] rounded-xl px-4 py-3"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <div>
                    <div className="font-medium text-[#0F172A] dark:text-white truncate">{w.word}</div>
                    {w.translation && (
                      <div className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{w.translation}</div>
                    )}
                  </div>
                  {w.status === 'new' && (
                    <span className="flex-shrink-0 text-[9px] font-semibold uppercase tracking-wide rounded-full px-1.5 py-0.5 bg-[#1560E8]/10 text-[#1560E8] dark:text-[#5B9CFF]">
                      {t('word_panel_status_new')}
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setDecision(w.vocabId, 'known')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition border ${
                      decisions[w.vocabId] === 'known'
                        ? 'bg-[#16A34A]/10 border-[#16A34A]/40 text-[#16A34A]'
                        : 'border-[#CBD5E1] dark:border-[#35465C] text-[#334155] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#263447]'
                    }`}
                  >
                    {t('word_panel_status_known')}
                  </button>
                  <button
                    onClick={() => setDecision(w.vocabId, 'learning')}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full transition border ${
                      decisions[w.vocabId] === 'learning'
                        ? 'bg-[#F59E0B]/10 border-[#F59E0B]/40 text-[#B45309]'
                        : 'border-[#CBD5E1] dark:border-[#35465C] text-[#334155] dark:text-[#CBD5E1] hover:bg-white dark:hover:bg-[#263447]'
                    }`}
                  >
                    {t('material_completion_still_learning')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="pt-4 mt-4 border-t border-[#E2E8F0] dark:border-[#263447] flex items-center justify-between">
        <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
          {t('material_completion_quiz_counts', { known: knownCount, learning: stillLearningCount })}
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting || words.length === 0}
          className="bg-[#1560E8] hover:bg-[#114FC4] disabled:opacity-50 text-white font-medium text-sm py-2.5 px-5 rounded-full transition shadow-sm"
        >
          {submitting ? t('material_completion_saving') : t('material_completion_finish_pass')}
        </button>
      </div>
    </div>
  );
}
