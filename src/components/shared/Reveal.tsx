"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  x?: number;
  y?: number;
  once?: boolean;
  threshold?: number;
  margin?: string;
};

const Reveal = forwardRef<HTMLDivElement, RevealProps>(function Reveal({
  children,
  className = "",
  delay = 0,
  duration = 550,
  x = 0,
  y = 24,
  once = true,
  threshold = 0.14,
  margin = "0px 0px -80px 0px",
}: RevealProps, forwardedRef) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useImperativeHandle(forwardedRef, () => ref.current as HTMLDivElement, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.unobserve(node);
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: margin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [margin, once, threshold]);

  const style: CSSProperties = {
    opacity: visible ? 1 : 0,
    transform: visible ? "translate3d(0, 0, 0)" : `translate3d(${x}px, ${y}px, 0)`,
    transitionProperty: "opacity, transform",
    transitionDuration: `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    transitionDelay: `${delay}ms`,
    willChange: "opacity, transform",
  };

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
});

export default Reveal;
