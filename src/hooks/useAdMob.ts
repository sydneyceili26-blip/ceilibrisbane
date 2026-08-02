import { useEffect } from "react";

const isNative = typeof window !== "undefined" && window.location.protocol === "capacitor:";
const BANNER_AD_UNIT = "ca-app-pub-5768325702216711/7083101446";

export const useAdMob = () => {
  useEffect(() => {
    if (!isNative) return;

    (async () => {
      try {
        const { AdMob, BannerAdSize, BannerAdPosition } = await import("@capacitor-community/admob");

        await AdMob.initialize({ requestTrackingAuthorization: true });

        await AdMob.showBanner({
          adId: BANNER_AD_UNIT,
          adSize: BannerAdSize.ADAPTIVE_BANNER,
          position: BannerAdPosition.BOTTOM_CENTER,
          margin: 0,
          isTesting: false,
        });
      } catch (e) {
        console.error("AdMob setup failed:", e);
      }
    })();

    return () => {
      (async () => {
        try {
          const { AdMob } = await import("@capacitor-community/admob");
          await AdMob.removeBanner();
        } catch {}
      })();
    };
  }, []);
};
