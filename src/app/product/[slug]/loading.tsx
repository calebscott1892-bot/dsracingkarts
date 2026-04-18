export default function ProductLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb skeleton */}
      <div className="flex gap-2 mb-8">
        <div className="h-3 w-10 bg-surface-700 animate-pulse" />
        <div className="h-3 w-3 bg-surface-700 animate-pulse" />
        <div className="h-3 w-12 bg-surface-700 animate-pulse" />
        <div className="h-3 w-3 bg-surface-700 animate-pulse" />
        <div className="h-3 w-32 bg-surface-700 animate-pulse" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Image skeleton */}
        <div className="space-y-3">
          <div className="aspect-square bg-surface-700 animate-pulse border border-surface-600/50" />
          <div className="flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-16 h-16 bg-surface-700 animate-pulse border border-surface-600/50" />
            ))}
          </div>
        </div>

        {/* Details skeleton */}
        <div className="space-y-6">
          <div className="h-8 bg-surface-700 animate-pulse w-3/4" />
          <div className="h-4 bg-surface-700 animate-pulse w-1/4" />
          <div className="space-y-2">
            <div className="h-4 bg-surface-700 animate-pulse w-full" />
            <div className="h-4 bg-surface-700 animate-pulse w-full" />
            <div className="h-4 bg-surface-700 animate-pulse w-2/3" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 w-20 bg-surface-700 animate-pulse border border-surface-600/50" />
            ))}
          </div>
          <div className="h-6 bg-surface-700 animate-pulse w-1/4" />
          <div className="h-12 bg-surface-700 animate-pulse w-full" />
        </div>
      </div>
    </div>
  );
}
