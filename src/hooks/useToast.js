import { useState, useRef, useCallback, useEffect } from "react";

/**
 * Transient toast message. Returns the current message and a `showToast`
 * function that auto-dismisses after `duration` ms.
 */
export function useToast(duration = 2600) {
  const [toast, setToast] = useState(null);
  const timer = useRef();

  const showToast = useCallback(
    (msg) => {
      setToast(msg);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), duration);
    },
    [duration]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, showToast };
}
