// src/app/clubs/[clubId]/error.tsx
"use client";
export default function Error({ error }: { error: Error }) {
  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
        <p className="font-semibold">No se pudo cargar el club</p>
        <p className="text-sm opacity-80">{error.message}</p>
      </div>
    </div>
  );
}
