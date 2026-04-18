export default function ShopLoading() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb skeleton */}
      <div className="flex gap-2 mb-6">
        <div className="h-3 w-10 bg-surface-700 animate-pulse" />
        <div className="h-3 w-3 bg-surface-700 animate-pulse" />
        <div className="h-3 w-12 bg-surface-700 animate-pulse" />
      </div>

      <div className="h-8 w-48 bg-surface-700 animate-pulse mb-8" />

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8">
        {/* Sidebar skeleton */}
        <div className="hidden lg:block space-y-6">
          <div className="h-4 w-16 bg-surface-700 animate-pulse" />
          <div className="h-10 bg-surface-700 animate-pulse" />
          <div className="h-4 w-20 bg-surface-700 animate-pulse" />
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-6 bg-surface-700 animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
            ))}
          </div>
        </div>

        {/* Product grid skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="bg-surface-800 border border-surface-600/30">
              <div className="aspect-square bg-surface-700 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-surface-700 animate-pulse w-full" />
                <div className="h-4 bg-surface-700 animate-pulse w-2/3" />
                <div className="h-5 bg-surface-700 animate-pulse w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
