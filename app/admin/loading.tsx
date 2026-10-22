export default function AdminLoading() {
  return (
    <div role="status" className="space-y-6" aria-label="Loading admin data">
      <div className="h-10 w-56 animate-pulse rounded-xl bg-neutral-100" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <div key={key} className="h-28 animate-pulse rounded-2xl bg-neutral-50" />)}
      </div>
      <div className="h-72 animate-pulse rounded-3xl bg-white" />
      <span className="sr-only">Loading admin data…</span>
    </div>
  );
}
