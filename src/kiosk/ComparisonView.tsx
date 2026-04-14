import { useState, useRef, useCallback } from 'react';

interface Props {
  originalPhoto: string;
  creationPhoto: string;
  onClose: () => void;
}

export default function ComparisonView({ originalPhoto, creationPhoto, onClose }: Props) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMove = useCallback((clientX: number) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  }, []);

  const handleStart = () => { dragging.current = true; };
  const handleEnd = () => { dragging.current = false; };

  return (
    <div className="relative h-full w-full">
      <button
        onClick={onClose}
        className="absolute top-2 right-2 z-10 text-gray-400 bg-black/80 px-3 py-1 rounded min-h-[44px] min-w-[44px]"
      >
        ✕
      </button>
      <p className="text-center text-gold text-xs mb-2">Original ← Slide → Student Creation</p>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded"
        style={{ height: 'calc(100% - 28px)' }}
        onMouseMove={e => handleMove(e.clientX)}
        onTouchMove={e => handleMove(e.touches[0].clientX)}
        onMouseUp={handleEnd}
        onTouchEnd={handleEnd}
        onMouseLeave={handleEnd}
      >
        {/* Original (full width, clipped by slider) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
          <img
            src={`/artifacts/${originalPhoto}`}
            alt="Original artifact"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Creation (full width, clipped by slider) */}
        <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}>
          <img
            src={`/artifacts/${creationPhoto}`}
            alt="Student creation"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Slider line and handle */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-gold cursor-col-resize z-10"
          style={{ left: `${sliderPos}%` }}
          onMouseDown={handleStart}
          onTouchStart={handleStart}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-gold rounded-full flex items-center justify-center text-black text-sm font-bold">
            ⟷
          </div>
        </div>
      </div>
    </div>
  );
}
