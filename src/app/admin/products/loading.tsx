export default function AdminProductsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-40 bg-surface-700 animate-pulse" />
        <div className="h-10 w-32 bg-surface-700 animate-pulse" />
      </div>

      {/* Filters bar skeleton */}
      <div className="card p-4 mb-6 flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] h-10 bg-surface-700 animate-pulse" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-16 bg-surface-700 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Table skeleton */}
      <div className="card overflow-hidden">
        <div className="bg-surface-700/50 h-10" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3 border-t border-surface-600/50"
          >
            <div className="h-4 bg-surface-700 animate-pulse flex-1" />
            <div className="h-4 bg-surface-700 animate-pulse w-20" />
            <div className="h-4 bg-surface-700 animate-pulse w-16" />
            <div className="h-4 bg-surface-700 animate-pulse w-12" />
            <div className="h-5 bg-surface-700 animate-pulse w-14 rounded" />
            <div className="h-4 bg-surface-700 animate-pulse w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}
