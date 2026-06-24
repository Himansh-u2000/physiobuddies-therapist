import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, type TextInput } from "react-native";

interface UseOtpOptions {
  length: number;
  onComplete?: (code: string) => void;
}

export function useOtp({ length, onComplete }: UseOtpOptions) {
  const [values, setValues] = useState<string[]>(Array(length).fill(""));
  const [isComplete, setIsComplete] = useState(false);
  const refs = useRef<(TextInput | null)[]>([]);

  const code = values.join("");

  useEffect(() => {
    const complete = values.every((v) => v !== "") && values.length === length;
    setIsComplete(complete);
    if (complete && onComplete) onComplete(code);
  }, [values, length, code, onComplete]);

  const setValue = useCallback(
    (index: number, val: string) => {
      const digit = val.replace(/\D/g, "").slice(-1);
      setValues((prev) => {
        const next = [...prev];
        next[index] = digit;
        return next;
      });
      if (digit && index < length - 1) {
        refs.current[index + 1]?.focus();
      }
    },
    [length],
  );

  const handlePaste = useCallback(
    (text: string) => {
      const digits = text.replace(/\D/g, "").slice(0, length);
      if (!digits) return;
      const next = Array(length).fill("");
      for (let i = 0; i < digits.length; i++) next[i] = digits[i];
      setValues(next);
      const focusIndex = Math.min(digits.length, length - 1);
      refs.current[focusIndex]?.focus();
    },
    [length],
  );

  const handleBackspace = useCallback(
    (index: number) => {
      if (values[index]) {
        setValues((prev) => {
          const next = [...prev];
          next[index] = "";
          return next;
        });
      } else if (index > 0) {
        refs.current[index - 1]?.focus();
        setValues((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
      }
    },
    [values, length],
  );

  const clear = useCallback(() => {
    setValues(Array(length).fill(""));
    refs.current[0]?.focus();
  }, [length]);

  const autofill = useCallback(
    (code: string) => {
      handlePaste(code);
    },
    [handlePaste],
  );

  return {
    values,
    code,
    isComplete,
    refs,
    setValue,
    handlePaste,
    handleBackspace,
    clear,
    autofill,
    textContentType: Platform.OS === "ios" ? "oneTimeCode" : undefined,
  };
}
