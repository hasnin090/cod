import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

interface AutoFitNumberProps {
  value: number | string;
  format?: (v: number | string) => string;
  maxFont?: number; // px
  minFont?: number; // px
  className?: string;
  weightClassName?: string; // e.g., font-bold
  colorClassName?: string; // e.g., text-emerald-600
  title?: string;
}

/**
 * AutoFitNumber
 * - Scales the font-size of the numeric value to fit its container width.
 * - Uses ResizeObserver and a quick binary search to find the largest font size that fits.
 */
export const AutoFitNumber: React.FC<AutoFitNumberProps> = ({
  value,
  format,
  maxFont = 28,
  minFont = 14,
  className = '',
  weightClassName = 'font-bold',
  colorClassName = '',
  title,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState<number>(maxFont);

  const display = useMemo(() => (format ? format(value) : String(value)), [value, format]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const measure = measureRef.current;
    if (!container || !measure) return;

    // Binary search for best font size
    const containerWidth = container.clientWidth;
    if (containerWidth <= 0) return;

    let low = minFont;
    let high = maxFont;
    let best = minFont;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      measure.style.fontSize = mid + 'px';
      // ensure measuring uses same font weight/style
      const fits = measure.scrollWidth <= containerWidth;
      if (fits) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    setFontSize(best);
  }, [display, maxFont, minFont]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      // Re-trigger measurement by updating state slightly
      setFontSize((s) => Math.min(Math.max(s, minFont), maxFont));
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [maxFont, minFont]);

  return (
    <div ref={containerRef} className={`w-full ${className || ''}`} title={title}>
      <span
        ref={measureRef}
        className={`inline-block align-baseline ${weightClassName} ${colorClassName}`}
        style={{ fontSize }}
      >
        {display}
      </span>
    </div>
  );
};

export default AutoFitNumber;
