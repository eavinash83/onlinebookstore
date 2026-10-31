import { useEffect, useState } from 'react';
import { storage } from '../services/storage';

// useState that mirrors its value into localStorage under `key`.
export function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => storage.get(key, initialValue));

  useEffect(() => {
    storage.set(key, value);
  }, [key, value]);

  return [value, setValue];
}
