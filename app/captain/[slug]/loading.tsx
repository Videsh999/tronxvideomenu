export default function CaptainLoading() {
  return (
    <div role="status" aria-label="Loading" className="space-y-4">
      <div className="h-9 w-48 animate-pulse rounded-xl bg-neutral-200/70" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-3xl bg-white" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-white" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
