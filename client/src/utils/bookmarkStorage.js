const STORAGE_KEY = 'bookmarks';

export const getBookmarks = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveBookmarks = (bookmarks) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
  } catch {}
};

export const getBookmarksForMaterial = (materialId) => {
  return getBookmarks().filter(b => b.id === materialId);
};

export const toggleBookmark = (materialId, sentenceIndex, text) => {
  const all = getBookmarks();
  const existingIndex = all.findIndex(b => b.id === materialId && b.sentenceIndex === sentenceIndex);
  let newBookmarks;
  if (existingIndex !== -1) {
    newBookmarks = all.filter((_, i) => i !== existingIndex);
  } else {
    newBookmarks = [...all, { 
      id: materialId, 
      sentenceIndex, 
      text: text || `Предложение ${sentenceIndex + 1}`, 
      createdAt: Date.now() 
    }];
  }
  saveBookmarks(newBookmarks);
  return newBookmarks;
};

export const removeBookmark = (materialId, sentenceIndex) => {
  const all = getBookmarks();
  const filtered = all.filter(b => !(b.id === materialId && b.sentenceIndex === sentenceIndex));
  saveBookmarks(filtered);
  return filtered;
};