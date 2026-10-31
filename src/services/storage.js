// Thin wrapper over localStorage so persistence can be swapped for a backend later.
const PREFIX = 'bookstore:';

export const storage = {
  get(key, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable (private mode) — app keeps working in memory.
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* ignore */
    }
  },
};
