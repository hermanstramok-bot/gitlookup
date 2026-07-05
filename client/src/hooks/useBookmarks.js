import { useState, useEffect } from 'react';
import { getBookmarksForMaterial, toggleBookmark, removeBookmark } from '../utils/bookmarkStorage';

export function useBookmarks(materialId) {
  const [bookmarks, setBookmarks] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setBookmarks(getBookmarksForMaterial(materialId));
  }, [materialId]);

  const addOrRemove = (sentenceIndex, textPreview) => {
    const newBookmarks = toggleBookmark(materialId, sentenceIndex, textPreview);
    setBookmarks(newBookmarks.filter(b => b.id === materialId));
  };

  const remove = (sentenceIndex) => {
    const newBookmarks = removeBookmark(materialId, sentenceIndex);
    setBookmarks(newBookmarks.filter(b => b.id === materialId));
  };

  return {
    bookmarks,
    showDropdown,
    setShowDropdown,
    addOrRemove,
    remove,
  };
}