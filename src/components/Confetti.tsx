"use client";

import { useEffect } from "react";

interface Props {
  trigger: boolean;
  onComplete?: () => void;
}

// Confetti component - currently disabled (requires canvas-confetti package)
// Will be enabled once `npm install` runs successfully on Zerops
export default function Confetti({ trigger, onComplete }: Props) {
  useEffect(() => {
    if (!trigger) return;

    // TODO: Re-enable when canvas-confetti is installed
    // For now, just call onComplete immediately
    console.log('Confetti would fire here!');
    setTimeout(() => onComplete?.(), 100);
  }, [trigger, onComplete]);

  return null;
}
