// client/src/components/IconPicker.jsx
import { PRESET_ICONS } from '../constants';

export default function IconPicker({ selectedIcon, customIcon, onSelectPreset, onCustomFile }) {
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Выберите изображение');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => onCustomFile(reader.result);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <label className="block mb-2 dark:text-gray-200">Иконка</label>
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
            <img src={icon} alt="icon" className="w-full h-full object-contain" />
          </button>
        ))}
        <label className="w-12 h-12 border border-gray-300 dark:border-gray-600 rounded flex items-center justify-center cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          <span className="text-2xl dark:text-gray-200">+</span>
        </label>
      </div>
      {customIcon && (
        <div className="mt-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">Кастомная иконка:</p>
          <img src={customIcon} alt="custom" className="w-12 h-12 object-contain mt-1" />
        </div>
      )}
    </div>
  );
}