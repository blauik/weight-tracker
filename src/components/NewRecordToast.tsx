"use client";

interface Props {
  show: boolean;
  weight: number;
  previousMin: number;
  onClose: () => void;
}

export default function NewRecordToast({ show, weight, previousMin, onClose }: Props) {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[200] animate-slide-up">
      <div className="glass p-5 max-w-sm border-emerald-500/30 shadow-lg shadow-emerald-500/20">
        <div className="flex items-start gap-3">
          <div className="text-3xl">🎉</div>
          <div className="flex-1">
            <h4 className="font-bold text-emerald-500 dark:text-emerald-400">Nový rekord!</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {weight.toFixed(1)} kg - to je o{" "}
              <span className="text-emerald-500 dark:text-emerald-400 font-semibold">
                {(previousMin - weight).toFixed(1)} kg
              </span>{" "}
              míň než předchozí minimum!
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-600 hover:text-gray-400 dark:hover:text-gray-400 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
