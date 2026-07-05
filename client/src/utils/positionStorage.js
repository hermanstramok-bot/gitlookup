export const savePosition = (materialId, type, data) => {
  try {
    const key = `reader_position_${materialId}_${type}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save position:', e);
  }
};

export const getPosition = (materialId, type) => {
  try {
    const key = `reader_position_${materialId}_${type}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to get position:', e);
    return null;
  }
};