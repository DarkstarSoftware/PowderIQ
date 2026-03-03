'use client';
// src/components/resort/ResortMap.tsx
// Leaflet satellite map showing summit/mid/base weather pins.
// Dynamically imported in the dashboard with { ssr: false }.

import { useEffect, useRef } from 'react';

interface ZoneWeather {
  zone: 'base' | 'mid' | 'summit';
  elevFt: number;
  tempF: number;
  windMph: number;
  snowfall24hIn: number;
  conditionDesc: string;
}

interface ResortMapProps {
  lat: number;
  lng: number;
  baseElevFt: number;
  summitElevFt: number;
  zones?: { base?: ZoneWeather; mid?: ZoneWeather; summit?: ZoneWeather };
  resortName: string;
}

const ZONE_CONFIG = {
  summit: { color: '#38bdf8', label: 'Summit', emoji: '🏔️' },
  mid:    { color: '#818cf8', label: 'Mid Mountain', emoji: '⛷️' },
  base:   { color: '#34d399', label: 'Base', emoji: '🏠' },
};

export default function ResortMap({ lat, lng, baseElevFt, summitElevFt, zones, resortName }: ResortMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Dynamically import leaflet (no SSR)
    import('leaflet').then(L => {
      // Fix default icon path issue with webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [lat, lng],
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: false,
      });

      // ESRI satellite imagery (no API key needed)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Tiles © Esri' }
      ).addTo(map);

      // Boundary labels overlay
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { attribution: '', opacity: 0.7 }
      ).addTo(map);

      // Elevation differential in degrees latitude (~364,000 ft per degree)
      const elevRange = summitElevFt - baseElevFt;
      const latDelta = elevRange / 364000;

      const zonePins: Array<{ key: keyof typeof ZONE_CONFIG; pinLat: number; zone?: ZoneWeather }> = [
        { key: 'summit', pinLat: lat + latDelta,       zone: zones?.summit },
        { key: 'mid',    pinLat: lat + latDelta * 0.5, zone: zones?.mid },
        { key: 'base',   pinLat: lat,                  zone: zones?.base },
      ];

      zonePins.forEach(({ key, pinLat, zone }) => {
        const cfg = ZONE_CONFIG[key];
        const elevFt = zone?.elevFt ?? (key === 'summit' ? summitElevFt : key === 'base' ? baseElevFt : Math.round((baseElevFt + summitElevFt) / 2));

        const windHold = (zone?.windMph ?? 0) > 35;
        const windBadge = windHold
          ? `<span style="background:#f59e0b;color:#fff;padding:1px 5px;border-radius:3px;font-size:10px;margin-left:4px;">WIND HOLD</span>`
          : '';

        const html = `
          <div style="
            background: rgba(15,23,42,0.92);
            border: 2px solid ${cfg.color};
            border-radius: 10px;
            padding: 8px 11px;
            font-family: system-ui, sans-serif;
            min-width: 140px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.5);
            backdrop-filter: blur(8px);
          ">
            <div style="color:${cfg.color};font-weight:700;font-size:12px;margin-bottom:4px;">
              ${cfg.emoji} ${cfg.label} ${windBadge}
            </div>
            <div style="color:#e2e8f0;font-size:13px;font-weight:600;">
              ${zone?.tempF?.toFixed(0) ?? '--'}°F
            </div>
            <div style="color:#94a3b8;font-size:11px;margin-top:2px;">
              ${elevFt.toLocaleString()} ft elev
            </div>
            ${zone ? `
            <div style="color:#94a3b8;font-size:11px;margin-top:2px;">
              💨 ${zone.windMph?.toFixed(0) ?? '--'} mph
            </div>
            <div style="color:#7dd3fc;font-size:11px;margin-top:2px;">
              ❄️ ${zone.snowfall24hIn?.toFixed(1) ?? '0'}" / 24h
            </div>
            <div style="color:#94a3b8;font-size:10px;margin-top:3px;text-transform:capitalize;">
              ${zone.conditionDesc ?? ''}
            </div>
            ` : `<div style="color:#475569;font-size:11px;margin-top:4px;">No data</div>`}
          </div>
        `;

        const icon = L.divIcon({ html, className: '', iconAnchor: [70, 8] });
        const marker = L.marker([pinLat, lng], { icon });

        marker.addTo(map);
        if (zone) {
          marker.bindPopup(`
            <b>${cfg.label}</b><br/>
            Elevation: ${elevFt.toLocaleString()} ft<br/>
            Temp: ${zone.tempF?.toFixed(1)}°F<br/>
            Wind: ${zone.windMph?.toFixed(0)} mph<br/>
            New snow: ${zone.snowfall24hIn?.toFixed(1)}" (24h)
          `);
        }
      });

      mapInstanceRef.current = map;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [lat, lng, baseElevFt, summitElevFt]);

  // Update pins when weather data changes without re-mounting the map
  useEffect(() => {
    if (!mapInstanceRef.current || !zones) return;
    // Pin updates handled via re-render of parent — map re-mounts when key changes
  }, [zones]);

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
      />
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute bottom-2 left-2 bg-gray-950/80 backdrop-blur-sm text-gray-400 text-xs px-2 py-1 rounded-lg pointer-events-none">
        {resortName} • Satellite View
      </div>
    </div>
  );
}
