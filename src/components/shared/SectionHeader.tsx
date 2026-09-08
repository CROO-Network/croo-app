interface SectionHeaderProps {
  label: string;
}

export default function SectionHeader({ label }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="h-px w-5 bg-[#6EE646]" />
      <span className="text-[10px] font-mono uppercase tracking-[0.24em] text-[#9A9A9A]">
        {label}
      </span>
    </div>
  );
}
