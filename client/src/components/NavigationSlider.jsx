import React, { useState, useEffect } from 'react';

export default function NavigationSlider({
  total,           // общее количество элементов (предложений или страниц)
  currentIndex,    // текущий индекс (0-based)
  onNavigate,      // функция перехода к индексу (принимает число)
  label,           // текст для отображения, например "предложений" или "страниц"
}) {
  const [sliderValue, setSliderValue] = useState(0);

  // Синхронизация значения ползунка с текущей позицией
  useEffect(() => {
    if (total <= 1) {
      setSliderValue(0);
      return;
    }
    const value = (currentIndex / (total - 1)) * 100;
    setSliderValue(Math.min(100, Math.max(0, value)));
  }, [currentIndex, total]);

  const handleChange = (e) => {
    setSliderValue(parseFloat(e.target.value));
  };

  const handleCommit = () => {
    if (total <= 1) return;
    const target = Math.round((sliderValue / 100) * (total - 1));
    onNavigate(Math.min(total - 1, Math.max(0, target)));
  };

  // Текущее отображаемое значение (1-based)
  const displayIndex = total > 0 ? Math.round((sliderValue / 100) * (total - 1)) + 1 : 0;

  return (
    <div className="w-full mt-2">
      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max="100"
          value={sliderValue}
          onChange={handleChange}
          onMouseUp={handleCommit}
          onTouchEnd={handleCommit}
          className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${sliderValue}%, #e5e7eb ${sliderValue}%, #e5e7eb 100%)`
          }}
        />
        <span className="text-sm text-gray-600 dark:text-gray-300 min-w-[60px] text-right">
          {displayIndex} / {total}
        </span>
      </div>
    </div>
  );
}