// src/components/ui/ConfirmModal.tsx
"use client";

export function ConfirmModal({
  title,
  body,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0B0F1A] border border-white/10 p-4">
        <div className="text-white font-semibold">{title}</div>
        <div className="text-white/80 text-sm mt-2">{body}</div>
        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full px-4 py-2 bg-white/10 text-white hover:bg-white/15"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full px-4 py-2 bg-red-600 text-white hover:bg-red-500"
          >
            Limpiar
          </button>
        </div>
      </div>
    </div>
  );
}
