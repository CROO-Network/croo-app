"use client";

import { ArrowUp } from "lucide-react";
import { useLayoutEffect, useRef } from "react";

const MAX_HEIGHT = 160;

export function MessageInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Type a message...",
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && value.trim().length > 0;

  // Autosize: reset to auto, then grow up to MAX_HEIGHT (after which it scrolls)
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const next = Math.min(ta.scrollHeight, MAX_HEIGHT);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  const handleSend = () => {
    if (!canSend) return;
    onSend(value);
  };

  return (
    <div className="px-4 py-3 border-t border-[#E2E2E0] shrink-0">
      <div className="flex items-end gap-2">
        <textarea
          ref={taRef}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              handleSend();
            }
          }}
          disabled={disabled}
          placeholder={placeholder}
          className="flex-1 resize-none rounded-xl border border-[#E2E2E0] bg-white px-4 py-2.5 text-sm text-[#0F0F0F] placeholder:text-[#9A9A9A] focus:border-[#6EE646] focus:outline-none focus:ring-2 focus:ring-[#6EE646]/30 disabled:opacity-60 leading-relaxed"
          style={{ maxHeight: MAX_HEIGHT }}
        />
        <button
          disabled={!canSend}
          onClick={handleSend}
          className="h-10 w-10 rounded-full bg-[#0F0F0F] hover:bg-[#1A1A1A] text-white shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
