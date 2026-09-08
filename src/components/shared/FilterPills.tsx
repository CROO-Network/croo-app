"use client";

import { cn } from "@/lib/utils";

export type FilterPillItem<TKey extends string = string> = {
  key: TKey;
  label: string;
};

interface FilterPillsProps<TKey extends string> {
  items: ReadonlyArray<FilterPillItem<TKey>>;
  activeKey: TKey;
  onSelect: (key: TKey) => void;
}

export default function FilterPills<TKey extends string>({
  items,
  activeKey,
  onSelect,
}: FilterPillsProps<TKey>) {
  return (
    <div className="flex w-fit items-center gap-2">
      {items.map((item) => {
        const isActive = item.key === activeKey;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              "shrink-0 rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "bg-[#0F0F0F] text-white"
                : "border border-[#E2E2E0] text-[#6B6B6B] hover:border-[#C2C2C0] hover:text-[#0F0F0F]"
            )}
            aria-pressed={isActive}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
