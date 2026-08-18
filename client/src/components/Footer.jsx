import { sans } from '../design/designSystem';
import { useI18n } from '../context/I18nContext';

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="bg-[#1560E8] dark:bg-[#0F172A] transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <p className="text-center text-sm text-white/80" style={sans}>
          {t('footer_tagline')}
        </p>
      </div>
    </footer>
  );
}
