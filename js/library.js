/**
 * VerseCam — Library & Scrapbook Storage
 * Handles local saving of photo compositions and text-only verses,
 * filtering (All, Photos, Favourites), and empty state rendering.
 */

const LibraryStore = (() => {
  const STORAGE_KEY = 'versecam_library_items_v1';
  let items = [];

  function load() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      items = data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to load library items from localStorage', e);
      items = [];
    }
    return items;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn('LocalStorage quota reached, pruning oldest item', e);
      if (items.length > 3) {
        items.pop();
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch (e2) {}
      }
    }
  }

  async function compressPhotoThumbnail(dataUrl, maxW = 540) {
    if (!dataUrl || !dataUrl.startsWith('data:image')) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxW) return resolve(dataUrl);
        const scale = maxW / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = maxW;
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  async function addItem({ type = 'photo', photo = null, poem, mood = 'Dreamy', theme = 'Nature', detectedObjects = [], atmospherePalette = [], environmentInfo = null, isFav = false }) {
    let storedPhoto = photo;
    if (type === 'photo' && photo) {
      storedPhoto = await compressPhotoThumbnail(photo);
    }
    const newItem = {
      id: 'verse_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      type, // 'photo' or 'text'
      photo: storedPhoto,
      poem,
      mood,
      theme,
      detectedObjects,
      atmospherePalette,
      environmentInfo,
      isFav,
      createdAt: new Date().toISOString(),
      formattedDate: formatCurrentDate()
    };
    items.unshift(newItem);
    save();
    return newItem;
  }

  function removeItem(id) {
    items = items.filter(it => it.id !== id);
    save();
  }

  function toggleFavourite(id) {
    const item = items.find(it => it.id === id);
    if (item) {
      item.isFav = !item.isFav;
      save();
      return item.isFav;
    }
    return false;
  }

  function clearAll() {
    items = [];
    save();
  }

  function formatCurrentDate() {
    const d = new Date();
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const month = months[d.getMonth()];
    const date = d.getDate();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month} ${date} • ${hours}:${mins}`;
  }

  function getItems(filter = 'all') {
    if (filter === 'photos') {
      return items.filter(it => it.type === 'photo');
    }
    if (filter === 'favourites') {
      return items.filter(it => it.isFav);
    }
    return items;
  }

  function getCounts() {
    return {
      all: items.length,
      photos: items.filter(it => it.type === 'photo').length,
      favs: items.filter(it => it.isFav).length
    };
  }

  return {
    load,
    addItem,
    removeItem,
    toggleFavourite,
    clearAll,
    getItems,
    getCounts,
    formatCurrentDate
  };

})();

window.LibraryStore = LibraryStore;
