// src/app/clubs/[clubId]/loading.tsx
export default function Loading() {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-10 w-64 bg-white/10 rounded-lg" />
          <div className="h-48 bg-white/10 rounded-2xl" />
          <div className="h-48 bg-white/10 rounded-2xl" />
        </div>
      </div>
    );
  }
  