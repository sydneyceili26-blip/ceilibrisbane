import { useEffect, useRef } from "react";

declare global {
  interface Window { adsbygoogle: unknown[]; }
}

interface AdBannerProps {
  slot: string;
  className?: string;
}

const isNative = typeof window !== "undefined" && window.location.protocol === "capacitor:";

const AdBanner = ({ slot, className = "" }: AdBannerProps) => {
  const pushed = useRef(false);

  useEffect(() => {
    if (isNative || pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, []);

  if (isNative) return null;

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: "block" }}
      data-ad-client="ca-pub-5768325702216711"
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
};

export default AdBanner;
