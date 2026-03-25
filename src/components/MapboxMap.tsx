// src/components/MapboxMap.tsx
// 3D ski resort map — Mapbox GL JS, client-only, never SSR'd.

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const TOKEN    = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const BBOX_PAD = 0.04; // smaller bbox = faster Overpass
const OVERPASS = 'https://overpass-api.de/api/interpreter';

export type MapMode = 'trail' | 'satellite' | 'hybrid';

export interface TrailFeature {
  id: string; trailName: string; difficulty: string; status: string;
}

interface Props {
  lat: number; lon: number; zoom?: number; mode: MapMode;
  resortName?: string;
  prefetchCoords?: [number, number][]; // other saved resort coords to pre-warm
  trails?: TrailFeature[]; diffFilter?: string[]; onLoad?: () => void;
}

const MAP_STYLE: Record<MapMode, string> = {
  trail:     'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  hybrid:    'mapbox://styles/mapbox/satellite-v9',
};

// ── Overpass query ─────────────────────────────────────────────────────────
function buildQuery(s: number, w: number, n: number, e: number) {
  return `[out:json][timeout:28];
(
  way["piste:type"~"downhill|nordic|snow_park|terrain_park"](${s},${w},${n},${e});
  way["aerialway"~"gondola|chair_lift|drag_lift|t-bar|magic_carpet|rope_tow|cable_car|mixed_lift"](${s},${w},${n},${e});
);
out body geom;`;
}

// ── Parse Overpass response ─────────────────────────────────────────────────
function parseOverpass(data: any): { runs: any; lifts: any } {
  const runs: any[] = [], lifts: any[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
    const t = el.tags ?? {};
    if (t['piste:type']) {
      runs.push({ type: 'Feature',
        geometry:   { type: 'LineString', coordinates: coords },
        properties: { name: t.name ?? t['piste:name'] ?? '',
          difficulty: t['piste:difficulty'] ?? 'easy',
          grooming:   t['piste:grooming'] ?? '' }});
    } else if (t.aerialway) {
      lifts.push({ type: 'Feature',
        geometry:   { type: 'LineString', coordinates: coords },
        properties: { name: t.name ?? '', aerialway: t.aerialway }});
    }
  }
  return {
    runs:  { type: 'FeatureCollection', features: runs  },
    lifts: { type: 'FeatureCollection', features: lifts },
  };
}

// ── Summit pin element ─────────────────────────────────────────────────────
function createPinEl(label: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'display:flex', 'align-items:center', 'gap:5px',
    'background:rgba(255,255,255,0.95)',
    'backdrop-filter:blur(8px)', '-webkit-backdrop-filter:blur(8px)',
    'border:1px solid rgba(100,150,200,0.25)',
    'border-radius:8px', 'padding:4px 10px',
    'font-size:11px', 'font-weight:700',
    'color:#0d1b2e', 'white-space:nowrap',
    'box-shadow:0 2px 10px rgba(15,40,80,0.18)',
    'pointer-events:none',
  ].join(';');
  el.innerHTML = `<span style="font-size:14px">⛰️</span><span>${label}</span>`;
  return el;
}

// ── Find summit: farthest ski coordinate from resort center ─────────────────
// Does NOT rely on OSM way encoding direction.
// The summit is the point most distant from the resort's geographic center.
function findSummitCoord(
  geo: { runs: any; lifts: any },
  centerLat: number, centerLon: number
): [number, number] | null {
  const all: [number, number][] = [];
  for (const f of [...(geo.runs?.features ?? []), ...(geo.lifts?.features ?? [])]) {
    for (const c of f.geometry?.coordinates ?? []) all.push(c as [number, number]);
  }
  if (all.length === 0) return null;
  let best = all[0], bestD = 0;
  const cosLat = Math.cos(centerLat * Math.PI / 180);
  for (const c of all) {
    const d = Math.hypot((c[0] - centerLon) * cosLat, c[1] - centerLat);
    if (d > bestD) { bestD = d; best = c; }
  }
  return best;
}

// ── Auto-zoom from ski area footprint ─────────────────────────────────────
function computeAutoZoom(geo: { runs: any; lifts: any }, fallback: number): number {
  const all: [number, number][] = [];
  for (const f of [...(geo.runs?.features ?? []), ...(geo.lifts?.features ?? [])]) {
    for (const c of f.geometry?.coordinates ?? []) all.push(c as [number, number]);
  }
  if (all.length < 4) return fallback;
  const lats = all.map(c => c[1]);
  const lons = all.map(c => c[0]);
  const dLat = (Math.max(...lats) - Math.min(...lats)) * 111;
  const dLon = (Math.max(...lons) - Math.min(...lons)) * 111 *
    Math.cos(((Math.max(...lats) + Math.min(...lats)) / 2) * Math.PI / 180);
  const spanKm = Math.max(Math.hypot(dLat, dLon), 0.3);
  // 0.3km → 14.5, 1km → 13.5, 3km → 12.5, 8km → 11.5, 20km → 10.5
  return Math.max(10.5, Math.min(14.5, 14.5 - Math.log2(spanKm / 0.3)));
}

// ── 3D layers ─────────────────────────────────────────────────────────────
function setup3D(map: any, runs: any, lifts: any, diffFilter: string[], mode: MapMode) {
  // Terrain
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512, maxzoom: 14,
    });
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

  // Hillshade
  if (!map.getLayer('piq-hillshade')) {
    if (!map.getSource('piq-dem-src')) {
      map.addSource('piq-dem-src', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
      });
    }
    map.addLayer({ id: 'piq-hillshade', type: 'hillshade',
      source: 'piq-dem-src',
      paint: {
        'hillshade-illumination-direction': 315,
        'hillshade-illumination-anchor':    'map',
        'hillshade-exaggeration':           0.7,
        'hillshade-shadow-color':           '#1a3a5c',
        'hillshade-highlight-color':        '#f8fbff',
        'hillshade-accent-color':           '#7bafd4',
      },
    });
  }

  // Sky
  if (!map.getLayer('sky')) {
    map.addLayer({ id: 'sky', type: 'sky', paint: {
      'sky-type':                     'atmosphere',
      'sky-atmosphere-sun':           [0.0, 80.0],
      'sky-atmosphere-sun-intensity': 15,
      'sky-atmosphere-color':         'rgba(186,210,235,1)',
      'sky-atmosphere-halo-color':    'rgba(255,255,255,0.6)',
    }});
  }

  // Fog
  map.setFog({
    color:           'rgba(220,235,248,0.6)',
    'high-color':    'rgba(180,210,240,0.3)',
    'horizon-blend': 0.06,
    'space-color':   'rgba(100,160,210,0.8)',
  });

  // Snow tint + forest (trail/satellite-streets only — skip pure satellite)
  ['piq-forest','piq-snow-cap'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
  });
  if (mode !== 'hybrid') {
    try {
      map.addLayer({ id: 'piq-forest', type: 'fill',
        source: 'composite', 'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'scrub'], true, false],
        paint: { 'fill-color': '#2d5a1b',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.45] },
      }, 'piq-hillshade');
    } catch (_) {}
    try {
      map.addLayer({ id: 'piq-snow-cap', type: 'background',
        paint: { 'background-color': '#ddeeff', 'background-opacity': 0.25 },
      });
    } catch (_) {}
  }

  // Remove old piste/lift layers
  ['piq-runs-case','piq-runs-line','piq-runs-lbl',
   'piq-lifts-case','piq-lifts-line','piq-lifts-lbl'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
  });
  ['piq-runs','piq-lifts'].forEach(id => {
    try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
  });

  // Filter runs by difficulty
  const DIFF_OSM: Record<string, string> = {
    green: 'easy', blue: 'intermediate', black: 'advanced',
    double_black: 'expert', terrain_park: 'terrain_park', backcountry: 'freeride',
  };
  const filteredRuns = diffFilter.length > 0 ? {
    ...runs,
    features: runs.features.filter((f: any) =>
      diffFilter.some(d => DIFF_OSM[d] === f.properties.difficulty || d === f.properties.difficulty)
    ),
  } : runs;

  map.addSource('piq-runs',  { type: 'geojson', data: filteredRuns });
  map.addSource('piq-lifts', { type: 'geojson', data: lifts });

  // Piste white casing
  map.addLayer({ id: 'piq-runs-case', type: 'line', source: 'piq-runs',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5],
      'line-opacity': 0.7 },
  });

  // Piste colored lines
  map.addLayer({ id: 'piq-runs-line', type: 'line', source: 'piq-runs',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'difficulty'],
        'novice', '#22c55e', 'easy', '#22c55e',
        'intermediate', '#3b82f6',
        'advanced', '#1e293b', 'expert', '#0f172a',
        'freeride', '#d97706', '#3b82f6'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.5, 13, 2.5, 15, 3.5],
      'line-opacity': 0.92,
    },
  });

  // Piste labels
  map.addLayer({ id: 'piq-runs-lbl', type: 'symbol', source: 'piq-runs',
    minzoom: 13,
    layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': 10, 'text-max-width': 6 },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1.5 },
  });

  // Lift casing
  map.addLayer({ id: 'piq-lifts-case', type: 'line', source: 'piq-lifts',
    layout: { 'line-cap': 'butt' },
    paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.4 },
  });

  // Lift lines
  map.addLayer({ id: 'piq-lifts-line', type: 'line', source: 'piq-lifts',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ef4444', 'line-width': 2.5,
      'line-dasharray': [2, 2], 'line-opacity': 0.9 },
  });

  // Lift labels
  map.addLayer({ id: 'piq-lifts-lbl', type: 'symbol', source: 'piq-lifts',
    minzoom: 12,
    layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 9 },
    paint: { 'text-color': '#ef4444', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
  });
}

// ── Base-anchored camera from OSM lift endpoints ──────────────────────────
interface CameraParams { center:[number,number]; bearing:number; zoom:number; pitch:number; }

function computeCamera(
  geo: { runs:any; lifts:any } | null,
  resortLat: number, resortLon: number,
  fallbackZoom: number,
): CameraParams {
  const def: CameraParams = { center:[resortLon,resortLat], bearing:0, zoom:fallbackZoom, pitch:75 };
  if (!geo) return def;

  const allLifts = geo.lifts?.features ?? [];
  if (allLifts.length === 0) return { ...def, zoom: computeAutoZoom(geo, fallbackZoom) };

  const baseNodes: [number,number][] = allLifts
    .map((f:any) => f.geometry?.coordinates?.[0]).filter(Boolean);
  const sumNodes:  [number,number][] = allLifts
    .map((f:any) => { const c = f.geometry?.coordinates; return c?.[c.length-1]; }).filter(Boolean);

  if (!baseNodes.length || !sumNodes.length) return { ...def, zoom: computeAutoZoom(geo, fallbackZoom) };

  const baseLon = baseNodes.reduce((s,c)=>s+c[0],0)/baseNodes.length;
  const baseLat = baseNodes.reduce((s,c)=>s+c[1],0)/baseNodes.length;
  const sumLon  = sumNodes.reduce((s,c)=>s+c[0],0)/sumNodes.length;
  const sumLat  = sumNodes.reduce((s,c)=>s+c[1],0)/sumNodes.length;

  const dLon = sumLon - baseLon;
  const dLat = sumLat - baseLat;
  const bearing = ((Math.atan2(dLon, dLat) * 180 / Math.PI) + 360) % 360;

  // Position camera behind the base so mountain fills view at 75° pitch
  const camLon = baseLon - dLon * 0.55;
  const camLat = baseLat - dLat * 0.55;

  return { center:[camLon,camLat], bearing, zoom:computeAutoZoom(geo,fallbackZoom), pitch:75 };
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MapboxMap({
  lat, lon, zoom = 13, mode, resortName, prefetchCoords,
  trails = [], diffFilter = [], onLoad,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const readyRef      = useRef(false);
  const osmCache      = useRef<Map<string, { runs: any; lifts: any }>>(new Map());
  const prevKey       = useRef('');
  const markerRef     = useRef<any>(null);
  const [error,   setError]   = useState('');
  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Fetch OSM + setup layers + update camera ────────────────────────────
  const loadAndRender = useCallback(async (
    map: any,
    _lat: number, _lon: number,
    _df: string[], _mode: MapMode,
    _name: string | undefined,
    _fallbackZoom: number,
  ) => {
    const key = `${_lat.toFixed(4)},${_lon.toFixed(4)}`;
    setLoading(true);

    let geo = osmCache.current.get(key);
    if (!geo) {
      try {
        // Use AbortController so switching resorts cancels in-flight requests
        const controller = new AbortController();
        const s = _lat - BBOX_PAD, n = _lat + BBOX_PAD;
        const w = _lon - BBOX_PAD, e = _lon + BBOX_PAD;
        const res = await fetch(OVERPASS, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(buildQuery(s, w, n, e))}`,
          signal:  AbortSignal.timeout(20_000),
        });
        if (res.ok) {
          geo = parseOverpass(await res.json());
          osmCache.current.set(key, geo);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.warn('[MapboxMap] Overpass:', e);
      }
      if (!geo) geo = {
        runs:  { type: 'FeatureCollection', features: [] },
        lifts: { type: 'FeatureCollection', features: [] },
      };
    }

    // Abort if resort changed while we were fetching
    if (_lat.toFixed(4) + ',' + _lon.toFixed(4) !== prevKey.current) {
      setLoading(false);
      return;
    }

    if (!readyRef.current) { setLoading(false); return; }

    try {
      setup3D(map, geo.runs, geo.lifts, _df, _mode);

      // Compute base-anchored camera from lift endpoints
      const cam = computeCamera(geo, _lat, _lon, _fallbackZoom);
      map.easeTo({ ...cam, duration: 1200 });

      // Summit pin: farthest ski coordinate from resort center
      const summit = findSummitCoord(geo, _lat, _lon);
      if (summit) {
        const mgl = (await import('mapbox-gl')).default;
        markerRef.current?.remove();
        const label = (_name ?? 'Summit').replace(/ (Resort|Mountain|Ski Area|Springs)$/i, '');
        markerRef.current = new mgl.Marker({ element: createPinEl(label), anchor: 'bottom' })
          .setLngLat(summit)
          .addTo(map);
      }
    } catch (e) {
      console.warn('[MapboxMap] render:', e);
    }

    setLoading(false);
  }, []);

  // ── Init map (once) ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) { setError('Mapbox token not configured'); return; }
    let map: any;
    (async () => {
      try {
        if (!document.getElementById('mapbox-gl-css')) {
          const l = document.createElement('link');
          l.id = 'mapbox-gl-css'; l.rel = 'stylesheet';
          l.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
          document.head.appendChild(l);
        }
        // @ts-ignore
        const mgl = (await import('mapbox-gl')).default;
        // @ts-ignore
        mgl.accessToken = TOKEN;
        map = new mgl.Map({
          container: containerRef.current!, style: MAP_STYLE[mode],
          center: [lon, lat], zoom, pitch: 75, bearing: 0,  // refined after OSM loads
          attributionControl: false, logoPosition: 'bottom-left', antialias: true,
        });
        map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-left');
        map.addControl(new mgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
        map.on('load', () => {
          mapRef.current = map;
          readyRef.current = true;
          setReady(true);
          onLoad?.();
          loadAndRender(map, lat, lon, diffFilter, mode, resortName, zoom);
        });
        // Pre-warm Overpass cache for nearby/common resorts
        // This runs silently in the background after the map loads
        map.once('idle', () => {
          if (prefetchCoords?.length) {
            prefetchCoords.forEach(([pLat, pLon]: [number, number]) => {
              const k = `${pLat.toFixed(4)},${pLon.toFixed(4)}`;
              if (!osmCache.current.has(k)) {
                const s = pLat - BBOX_PAD, n = pLat + BBOX_PAD;
                const w = pLon - BBOX_PAD, e = pLon + BBOX_PAD;
                fetch(OVERPASS, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                  body: `data=${encodeURIComponent(buildQuery(s, w, n, e))}`,
                  signal: AbortSignal.timeout(15_000),
                }).then(r => r.ok ? r.json() : null)
                  .then(d => { if (d) osmCache.current.set(k, parseOverpass(d)); })
                  .catch(() => {});
              }
            });
          }
        });
        map.on('error', (e: any) => {
          if (e?.error?.status !== 403) console.warn('[MapboxMap]', e?.error?.message ?? e);
        });
      } catch (e: any) {
        setError(e?.message ?? 'Map failed to load');
      }
    })();
    return () => {
      readyRef.current = false;
      markerRef.current?.remove();
      mapRef.current = null;
      map?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fly + reload on resort change ──────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !lat || !lon) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    // Fly immediately to new resort center
    // Use cached OSM data if available for immediate correct bearing
    const cachedGeo = osmCache.current.get(`${lat.toFixed(4)},${lon.toFixed(4)}`);
    const initCam = computeCamera(cachedGeo ?? null, lat, lon, zoom);
    map.flyTo({ ...initCam, speed: 1.4, curve: 1.2 });

    // Start OSM fetch immediately — don't wait for fly animation
    // The fetch takes 2-5s anyway so starting now means it arrives sooner
    loadAndRender(map, lat, lon, diffFilter, mode, resortName, zoom);
  }, [lat, lon, zoom, loadAndRender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Style switch ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(MAP_STYLE[mode]);
    map.once('styledata', () => {
      if (readyRef.current) loadAndRender(map, lat, lon, diffFilter, mode, resortName, zoom);
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Diff filter update ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const geo = osmCache.current.get(key);
    if (geo) {
      try { setup3D(map, geo.runs, geo.lifts, diffFilter, mode); } catch (_) {}
    }
  }, [diffFilter, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f5fb', borderRadius: 16,
      flexDirection: 'column', gap: 10 }}>
      <span style={{ fontSize: 32 }}>🗺️</span>
      <span style={{ fontSize: 12, color: '#6b849a', maxWidth: 220, textAlign: 'center' }}>{error}</span>
    </div>
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: 16, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {loading && (
        <div style={{
          position: 'absolute', bottom: 14, right: 52,
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(8px)',
          borderRadius: 8, padding: '5px 10px', display: 'flex',
          alignItems: 'center', gap: 6, fontSize: 11, color: '#3d5166',
          boxShadow: '0 2px 8px rgba(15,40,80,0.12)', border: '1px solid rgba(100,150,200,0.2)',
        }}>
          <div style={{ width: 10, height: 10, border: '2px solid #dbeafe',
            borderTopColor: '#1d6ef5', borderRadius: '50%',
            animation: 'spin .7s linear infinite' }} />
          Loading trails…
        </div>
      )}
    </div>
  );
}
