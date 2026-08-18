// client/src/components/IconPicker.jsx
import { PRESET_ICONS } from '../constants';
import { useI18n } from '../context/I18nContext';

export default function IconPicker({ selectedIcon, customIcon, onSelectPreset, onCustomFile }) {
  const { t } = useI18n();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert(t('icon_picker_error_not_image'));
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onCustomFile(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block mb-2 dark:text-gray-200">{t('icon_picker_label')}</label>
      <div className="flex gap-2 flex-wrap">
        {PRESET_ICONS.map((icon) => (
          <button
            type="button"
            key={icon}
            onClick={() => onSelectPreset(icon)}
            className={`w-12 h-12 border rounded ${
              selectedIcon === icon && !customIcon ? 'ring-2 ring-blue-500' : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <img src={icon} alt={t('icon_picker_label')} className="w-full h-full object-contain" />
          </button>
        ))}
        <label className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded flex items-center justify-center cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <span className="text-2xl dark:text-gray-200">+</span>
        </label>
      </div>
      {customIcon && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('icon_picker_custom_label')}</p>
          <img src={customIcon} alt={t('icon_picker_custom_label')} className="w-12 h-12 object-contain mt-1" />
        </div>
      )}
    </div>
  );
}