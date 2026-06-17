// ---------------------------------------------------------------------------
// Section card — reusable section surface aligned with premium dark/glass
// theme tokens. Obsidian variant uses solid surface token; glass variant
// uses the blur overlay utility from globals.css.
// ---------------------------------------------------------------------------

type SectionCardProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Surface variant — obsidian uses solid surface token; glass uses blur overlay */
  variant?: "obsidian" | "glass";
};

const surfaceByVariant: Record<NonNullable<SectionCardProps["variant"]>, string> = {
  obsidian: "border border-white/10 bg-[var(--surface)]",
  glass: "glass",
};

export function SectionCard({
  title,
  subtitle,
  children,
  variant = "obsidian",
}: SectionCardProps) {
  return (
    <section
      className={`rounded-[var(--radius-card)] p-6 ${surfaceByVariant[variant]}`}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="font-heading text-2xl font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        {subtitle ? (
          <span className="text-sm text-slate-500">{subtitle}</span>
        ) : null}
      </div>

      {children}
    </section>
  );
}
