import { useLayoutEffect, useRef, useState } from "react";

/** Keep the normal currency format unless its decimals exceed the cell's width. */
export function CalendarPnlValue({ formatted, title }: { formatted: string; title?: string }) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [omitDecimals, setOmitDecimals] = useState(false);

  useLayoutEffect(() => {
    const measure = measureRef.current;
    const cell = measure?.parentElement?.parentElement;
    if (!measure || !cell) return;

    const update = () => {
      const style = getComputedStyle(cell);
      const availableWidth = cell.getBoundingClientRect().width
        - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth);
      setOmitDecimals(availableWidth > 0 && measure.getBoundingClientRect().width > availableWidth);
    };

    // Measure the full label even while displaying its shorter version, so decimals
    // return when the cell grows or a responsive/font change gives them enough room.
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(cell);
    observer.observe(measure);
    return () => observer.disconnect();
  }, [formatted]);

  return (
    <strong className="calendar-pnl-value" title={title}>
      {omitDecimals ? formatted.replace(/\.\d+/, "") : formatted}
      <span ref={measureRef} className="calendar-pnl-measure" aria-hidden="true">{formatted}</span>
    </strong>
  );
}
