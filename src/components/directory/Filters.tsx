"use client";
import { useEffect, useRef } from "react";
export function Filters({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 761px)");
    const update = () => {
      if (ref.current) ref.current.open = media.matches;
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <details ref={ref} className="filters">
      <summary>篩選條件</summary>
      {children}
    </details>
  );
}
