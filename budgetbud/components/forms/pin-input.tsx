"use client";

import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (pin: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function PinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  error,
  className,
}: PinInputProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleInputChange = (index: number, inputValue: string) => {
    // Only allow digits
    const digit = inputValue.replace(/\D/g, "");

    if (digit.length > 1) return; // Only allow one digit per input

    const newValue = value.split("");
    newValue[index] = digit;
    const updatedValue = newValue.join("").slice(0, 6); // Ensure max 6 digits

    onChange(updatedValue);

    // Auto-focus next input
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Call onComplete when all 6 digits are entered
    if (updatedValue.length === 6 && onComplete) {
      onComplete(updatedValue);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    onChange(pastedData);

    if (pastedData.length === 6 && onComplete) {
      onComplete(pastedData);
    }

    // Focus the appropriate input
    const focusIndex = Math.min(pastedData.length, 5);
    inputRefs.current[focusIndex]?.focus();
  };

  // Auto-focus first input on mount
  useEffect(() => {
    if (!disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [disabled]);

  return (
    <div className={cn("space-y-2", className)}>
      <label className="text-sm font-medium">Enter your 6-digit PIN</label>
      <div className="flex gap-3 justify-center">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={value[index] || ""}
            onChange={(e) => handleInputChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            onFocus={() => setFocusedIndex(index)}
            onBlur={() => setFocusedIndex(null)}
            disabled={disabled}
            className={cn(
              "w-12 h-12 text-center text-lg font-bold",
              "border-2 focus:border-primary",
              focusedIndex === index && "ring-2 ring-primary/20",
              error && "border-destructive focus:border-destructive"
            )}
          />
        ))}
      </div>
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
    </div>
  );
}
