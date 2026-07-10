import { useEffect, useRef } from "react";

export function useDebouncedCallback<Arguments extends unknown[]>(
  callback: (...callbackArguments: Arguments) => void,
  delayMilliseconds: number,
): (...callbackArguments: Arguments) => void {
  const timeoutReference = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackReference = useRef(callback);

  useEffect(() => {
    callbackReference.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutReference.current) {
        clearTimeout(timeoutReference.current);
      }
    };
  }, []);

  return (...callbackArguments: Arguments) => {
    if (timeoutReference.current) {
      clearTimeout(timeoutReference.current);
    }
    timeoutReference.current = setTimeout(() => {
      callbackReference.current(...callbackArguments);
    }, delayMilliseconds);
  };
}
