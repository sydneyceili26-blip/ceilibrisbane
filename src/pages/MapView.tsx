import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_MAP, type CategoryKey, formatPrice } from "@/lib/categories";
import { Button } from "@/components/ui/button";

// Fix default marker icons (Leaflet's default assets break under bundlers)
const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Pin {
  id: string;
  title: string;
  category: CategoryKey;
  price: number | null;
  suburb: string;
  lat: number;
  lng: number;
  isRequest?: boolean;
}

const MapView = () => {
  const [pins, setPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CategoryKey | "all">("all");

  useEffect(() => {
    document.title = "Map view - Céilí Brisbane";
    (async () => {
      const [{ data: listings }, { data: requests }, { data: coords }] = await Promise.all([
        supabase
          .from("listings")
          .select("id,title,category,price,suburb")
          .eq("status", "approved")
          .gt("expires_at", new Date().toISOString())
          .not("suburb", "is", null),
        supabase
          .from("requests")
          .select("id,title,category,suburb")
          .not("status", "eq", "rejected")
          .not("suburb", "is", null),
        supabase.from("suburb_coords").select("suburb,lat,lng"),
      ]);
      const coordMap = new Map<string, { lat: number; lng: number }>();
      (coords ?? []).forEach((c: any) => coordMap.set(c.suburb.toLowerCase(), { lat: Number(c.lat), lng: Number(c.lng) }));

      const toPin = (row: any, isRequest = false): Pin | null => {
        const c = coordMap.get((row.suburb ?? "").toLowerCase().trim());
        if (!c) return null;
        const jLat = (Math.random() - 0.5) * 0.004;
        const jLng = (Math.random() - 0.5) * 0.004;
        return { id: row.id, title: row.title, category: row.category, price: row.price ?? null, suburb: row.suburb, lat: c.lat + jLat, lng: c.lng + jLng, isRequest };
      };

      const result: Pin[] = [
        ...(listings ?? []).map((l: any) => toPin(l, false)),
        ...(requests ?? []).map((r: any) => toPin(r, true)),
      ].filter(Boolean) as Pin[];

      setPins(result);
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? pins : pins.filter((p) => p.category === filter)),
    [pins, filter],
  );

  const cats: (CategoryKey | "all")[] = ["all", "sublet", "lease_takeover", "job", "for_sale", "service", "event", "car", "sports_wellness"];

  return (
    <div className="flex min-h-screen flex-col bg-gradient-warm">
      <SiteHeader />
      <main className="flex-1">
        <section className="container py-8">
          <h1 className="font-display text-3xl font-bold md:text-4xl">Map view</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See where listings are around Brisbane. Pins are placed at suburb level.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {cats.map((c) => {
              const label = c === "all" ? "All" : CATEGORY_MAP[c as CategoryKey].short;
              const active = filter === c;
              return (
                <button
                  key={c}
                  onClick={() => setFilter(c)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-smooth ${
                    active
                      ? "bg-foreground text-background"
                      : "border border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <div className="relative z-0 isolate mt-6 overflow-hidden rounded-2xl border border-border shadow-soft">
            <div className="h-[70vh] w-full">
              <MapContainer center={[-27.4698, 153.0251]} zoom={12} scrollWheelZoom className="h-full w-full">
                <TileLayer
                  attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                />
                {visible.map((p) => (
                  <Marker key={p.id} position={[p.lat, p.lng]} icon={icon}>
                    <Popup>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            {CATEGORY_MAP[p.category]?.short}
                          </p>
                          {p.isRequest && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">Wanted</span>
                          )}
                        </div>
                        <p className="font-semibold">{p.title}</p>
                        {p.price != null && (
                          <p className="text-sm text-primary">{formatPrice(p.price, p.category)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{p.suburb}</p>
                        <Button asChild size="sm" variant="hero" className="mt-2 w-full">
                          <Link to={p.isRequest ? `/request/${p.id}` : `/listing/${p.id}`}>
                            {p.isRequest ? "View request" : "View listing"}
                          </Link>
                        </Button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {loading ? "Loading…" : `${visible.length} result${visible.length === 1 ? "" : "s"} on map`}
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
};

export default MapView;
