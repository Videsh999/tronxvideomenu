type BrandMarkProps = {
  subtitle?: string;
  size?: "sm" | "md";
  className?: string;
};

export default function BrandMark({ subtitle, size = "md", className = "" }: BrandMarkProps) {
  const tile = size === "sm" ? "h-8 w-8 rounded-lg text-sm" : "h-9 w-9 rounded-xl text-base";
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <span className={`bg-brand-gradient relative grid shrink-0 place-items-center font-black text-white shadow-[0_6px_24px_-6px_rgb(0_0_0/0.22)] ${tile}`}>
        T
        <span className="absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-neutral-300" />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block text-sm font-bold tracking-tight text-neutral-900">TRONX</span>
        {subtitle ? <span className="block truncate text-[11px] font-medium text-neutral-500">{subtitle}</span> : null}
      </span>
    </span>
  );
}
