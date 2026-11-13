export default function MenuLoading() {
  return (
    <div role="status" aria-label="Loading menu" className="mx-auto max-w-7xl px-3 pt-3 sm:px-6">
      <div className="h-60 animate-pulse rounded-[1.75rem] bg-neutral-200 sm:h-80" />
      <div className="mt-4 flex gap-2">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-10 w-24 animate-pulse rounded-full bg-neutral-200" />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div key={key} className="h-44 animate-pulse rounded-[1.25rem] bg-neutral-100" />
        ))}
      </div>
      <span className="sr-only">Loading the menu…</span>
    </div>
  );
}
