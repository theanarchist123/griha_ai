"use client";

import { useEffect, useRef } from "react";

export interface POI {
  name: string;
  lat: number;
  lng: number;
  distance_m?: number;
  category: string;
  emoji: string;
}

export interface RouteData {
  polyline: [number, number][];
  distance_km: number;
  duration_min: number;
  destination_name: string;
  destination_lat: number;
  destination_lng: number;
}

interface MapComponentProps {
  centerLat: number;
  centerLng: number;
  pois: POI[];
  route: RouteData | null;
  propertyAddress: string;
}

export default function MapComponent({ centerLat, centerLng, pois, route, propertyAddress }: MapComponentProps) {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Dynamically import Leaflet
    import("leaflet").then((L) => {
      if (mapInstanceRef.current) return; // Already initialized

      // Fix default icon path issue with webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapRef.current!, {
        center: [centerLat, centerLng],
        zoom: 14,
        zoomControl: true,
        attributionControl: true,
      });

      // Dark CartoDB tiles
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      // Home marker — larger, gold pin
      const homeIcon = L.divIcon({
        html: `<div style="
          width:44px; height:44px; border-radius:50% 50% 50% 0;
          background: linear-gradient(135deg, #C9922A, #E5B94E);
          border: 3px solid white;
          transform: rotate(-45deg);
          box-shadow: 0 4px 20px rgba(201,146,42,0.6);
          display:flex; align-items:center; justify-content:center;
        ">
          <span style="transform:rotate(45deg); font-size:18px;">🏠</span>
        </div>`,
        className: "",
        iconSize: [44, 44],
        iconAnchor: [22, 44],
        popupAnchor: [0, -48],
      });

      const homeMarker = L.marker([centerLat, centerLng], { icon: homeIcon })
        .addTo(map)
        .bindPopup(`<div style="font-family:sans-serif; padding:4px;">
          <strong style="font-size:13px;">📍 Your Property</strong><br>
          <span style="font-size:11px; color:#666;">${propertyAddress}</span>
        </div>`);

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [centerLat, centerLng, propertyAddress]);

  // Update markers when POIs change
  useEffect(() => {
    if (!mapInstanceRef.current || typeof window === "undefined") return;

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current;
      if (!map) return;

      // Clear old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Clear old route
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }

      if (pois.length === 0 && !route) return;

      const bounds: [number, number][] = [[centerLat, centerLng]];

      // Draw POI markers
      pois.forEach((poi, idx) => {
        const poiIcon = L.divIcon({
          html: `<div style="
            width:36px; height:36px; border-radius:50%;
            background: linear-gradient(135deg, #1a1a2e, #2d2d4e);
            border: 2px solid rgba(255,255,255,0.3);
            display:flex; align-items:center; justify-content:center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.5);
            animation: dropIn 0.3s ease ${idx * 0.05}s both;
            font-size:18px;
          ">${poi.emoji}</div>
          <style>
            @keyframes dropIn {
              from { opacity:0; transform:translateY(-20px); }
              to { opacity:1; transform:translateY(0); }
            }
          </style>`,
          className: "",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          popupAnchor: [0, -20],
        });

        const distanceText = poi.distance_m != null
          ? poi.distance_m < 1000
            ? `${poi.distance_m}m away`
            : `${(poi.distance_m / 1000).toFixed(1)}km away`
          : "";

        const marker = L.marker([poi.lat, poi.lng], { icon: poiIcon })
          .addTo(map)
          .bindPopup(`<div style="font-family:sans-serif; padding:4px; min-width:140px;">
            <strong style="font-size:13px;">${poi.emoji} ${poi.name}</strong><br>
            ${distanceText ? `<span style="font-size:11px; color:#888;">${distanceText}</span>` : ""}
          </div>`);

        markersRef.current.push(marker);
        bounds.push([poi.lat, poi.lng]);
      });

      // Draw route if present
      if (route && route.polyline && route.polyline.length > 0) {
        // Animated dashed line
        const routeLine = L.polyline(route.polyline as [number, number][], {
          color: "#C9922A",
          weight: 3,
          opacity: 0.85,
          dashArray: "12, 8",
        }).addTo(map);
        routeLayerRef.current = routeLine;

        // Destination marker
        const destIcon = L.divIcon({
          html: `<div style="
            width:40px; height:40px; border-radius:50%;
            background: linear-gradient(135deg, #2D5016, #4A7A28);
            border: 3px solid white;
            display:flex; align-items:center; justify-content:center;
            box-shadow: 0 4px 15px rgba(45,80,22,0.6);
            font-size:20px;
          ">📍</div>`,
          className: "",
          iconSize: [40, 40],
          iconAnchor: [20, 20],
          popupAnchor: [0, -24],
        });

        const destMarker = L.marker([route.destination_lat, route.destination_lng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<div style="font-family:sans-serif; padding:4px;">
            <strong style="font-size:13px;">🏁 ${route.destination_name}</strong><br>
            <span style="font-size:11px; color:#888;">${route.distance_km}km · ~${route.duration_min} min by car</span>
          </div>`)
          .openPopup();

        markersRef.current.push(destMarker);
        bounds.push([route.destination_lat, route.destination_lng]);
      }

      // Fit map to show all markers
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    });
  }, [pois, route, centerLat, centerLng]);

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div
        ref={mapRef}
        style={{ width: "100%", height: "100%", background: "#1a1a2e" }}
      />
    </>
  );
}
