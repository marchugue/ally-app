import { useEffect, useState } from "react";

/**
 * Returns a debounced version of `value` that only updates after `delay` ms
 * of no changes. Useful for search inputs hitting an API.
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}
