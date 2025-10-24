import { useRef, useEffect } from 'react';

/**
 * Hook that returns a ref indicating whether the component is currently mounted.
 * This is useful for preventing state updates on unmounted components in async operations.
 *
 * @returns A ref object whose .current property is true when mounted, false when unmounted
 *
 * @example
 * ```typescript
 * const isMountedRef = useIsMounted();
 *
 * const fetchData = async () => {
 *   const data = await api.getData();
 *   if (isMountedRef.current) {
 *     setData(data);
 *   }
 * };
 * ```
 */
export function useIsMounted() {
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return isMountedRef;
}
