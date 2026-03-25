// src/components/MapboxMap.tsx
// Ikon/Epic-style 3D ski resort map — Mapbox GL JS, client-only.
//
// Features:
//   - Satellite imagery + 3D terrain (DEM exaggeration)
//   - Colored piste lines + white casing (green/blue/black/red)
//   - Lift lines (red dashed) with labels
//   - Best Runs heat-map glow — orange/amber highlight over recommended zone
//   - Live lift status dots at base stations
//   - Summit peak pin at farthest ski coordinate
//   - Full free-camera: user can pan/rotate/zoom/tilt anywhere
//   - Base-anchored 45° pitch so full mountain face is visible
//   - Prefetch OSM for all saved resorts on idle

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const TOKEN    = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export type MapMode = 'trail' | 'satellite' | 'hybrid';

export interface TrailFeature {
  id: string; trailName: string; difficulty: string; status: string;
}

// Best run zone passed from the parent (derived from score + trail data)
export interface BestZone {
  lat: number; lon: number; // center of the best zone
  radiusKm: number;         // approx radius to highlight
  label: string;            // e.g. "Sunshine Peak"
}

interface Props {
  lat: number; lon: number; zoom?: number; mode: MapMode;
  mountainId?: string;           // used to fetch trails from server cache
  enable3D?: boolean;             // false = 2D trail map (free tier)
  resortName?: string;
  bestZone?: BestZone | null;          // highlight zone for "Best Area Right Now"
  liftStatuses?: Record<string, string>; // liftName → 'open'|'closed'|'on_hold'
  prefetchCoords?: [number, number][];
  prefetchIds?: string[];            // mountain IDs for server-side prefetch
  trails?: TrailFeature[]; diffFilter?: string[]; onLoad?: () => void;
}

const MAP_STYLE: Record<MapMode, string> = {
  trail:     'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  hybrid:    'mapbox://styles/mapbox/satellite-v9',
};

// ── Trail GeoJSON fetch — server cache first, no direct Overpass ────────────
// The server at /api/mountains/[id]/trails/geojson caches Overpass results
// in the DB for 24h. Browser gets <50ms response on cache hit.
async function fetchTrailGeo(
  mountainId: string | undefined,
  lat: number, lon: number,
  signal: AbortSignal
): Promise<{ runs: any; lifts: any }> {
  const empty = {
    runs:  { type: 'FeatureCollection' as const, features: [] },
    lifts: { type: 'FeatureCollection' as const, features: [] },
  };

  if (!mountainId) return empty;

  try {
    const res = await fetch(`/api/mountains/${mountainId}/trails/geojson`, { signal });
    if (!res.ok) return empty;
    const geo = await res.json();
    if (geo?.runs && geo?.lifts) return geo;
    return empty;
  } catch (e: any) {
    if (e?.name !== 'AbortError') console.warn('[MapboxMap] trail fetch:', e?.message);
    return empty;
  }
}

// ── Summit pin ────────────────────────────────────────────────────────────
function createPinEl(label: string): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'display:flex','align-items:center','gap:5px',
    'background:rgba(255,255,255,0.95)',
    'backdrop-filter:blur(8px)','-webkit-backdrop-filter:blur(8px)',
    'border:1px solid rgba(100,150,200,0.25)',
    'border-radius:8px','padding:4px 10px',
    'font-size:11px','font-weight:700',
    'color:#0d1b2e','white-space:nowrap',
    'box-shadow:0 2px 10px rgba(15,40,80,0.18)',
    'pointer-events:none',
  ].join(';');
  el.innerHTML = `<span style="font-size:14px">⛰️</span><span>${label}</span>`;
  return el;
}

// ── Live lift status dot ───────────────────────────────────────────────────
function createLiftDot(status: string): HTMLElement {
  const el = document.createElement('div');
  const color = status === 'open' ? '#22c55e'
              : status === 'on_hold' ? '#f59e0b'
              : '#ef4444';
  el.style.cssText = [
    `width:10px`, `height:10px`,
    `border-radius:50%`,
    `background:${color}`,
    `border:2px solid rgba(255,255,255,0.9)`,
    `box-shadow:0 0 6px ${color}88`,
  ].join(';');
  return el;
}

// ── Helpers ───────────────────────────────────────────────────────────────
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

function computeAutoZoom(geo: { runs: any; lifts: any }, fallback: number): number {
  const all: [number, number][] = [];
  for (const f of [...(geo.runs?.features ?? []), ...(geo.lifts?.features ?? [])]) {
    for (const c of f.geometry?.coordinates ?? []) all.push(c as [number, number]);
  }
  if (all.length < 4) return fallback;
  const lats = all.map(c => c[1]), lons = all.map(c => c[0]);
  const midLat = (Math.max(...lats) + Math.min(...lats)) / 2;
  const dLat = (Math.max(...lats) - Math.min(...lats)) * 111;
  const dLon = (Math.max(...lons) - Math.min(...lons)) * 111 * Math.cos(midLat * Math.PI / 180);
  const spanKm = Math.max(Math.hypot(dLat, dLon), 0.3);
  return Math.max(10.5, Math.min(14.5, 14.5 - Math.log2(spanKm / 0.3)));
}

// ── Camera from lift endpoints ─────────────────────────────────────────────
interface CameraParams { center:[number,number]; bearing:number; zoom:number; pitch:number; }

function computeCamera(
  geo: { runs:any; lifts:any } | null,
  resortLat: number, resortLon: number, fallbackZoom: number,
  enable3D = true,
): CameraParams {
  const def: CameraParams = { center:[resortLon,resortLat], bearing:0, zoom:fallbackZoom, pitch: enable3D ? 45 : 0 };
  if (!geo) return def;
  const allLifts = geo.lifts?.features ?? [];
  if (allLifts.length === 0) return { ...def, zoom: computeAutoZoom(geo, fallbackZoom) };

  const baseNodes: [number,number][] = allLifts
    .map((f:any) => f.geometry?.coordinates?.[0]).filter(Boolean);
  const sumNodes: [number,number][] = allLifts
    .map((f:any) => { const c = f.geometry?.coordinates; return c?.[c.length-1]; }).filter(Boolean);

  if (!baseNodes.length || !sumNodes.length)
    return { ...def, zoom: computeAutoZoom(geo, fallbackZoom) };

  const baseLon = baseNodes.reduce((s,c)=>s+c[0],0)/baseNodes.length;
  const baseLat = baseNodes.reduce((s,c)=>s+c[1],0)/baseNodes.length;
  const sumLon  = sumNodes.reduce((s,c)=>s+c[0],0)/sumNodes.length;
  const sumLat  = sumNodes.reduce((s,c)=>s+c[1],0)/sumNodes.length;

  const dLon = sumLon - baseLon;
  const dLat = sumLat - baseLat;
  const bearing = ((Math.atan2(dLon, dLat) * 180 / Math.PI) + 360) % 360;

  // Position camera BEHIND base at 45° — shows full mountain face like Image 2
  const camLon = baseLon - dLon * 0.6;
  const camLat = baseLat - dLat * 0.6;

  return { center:[camLon,camLat], bearing, zoom:computeAutoZoom(geo,fallbackZoom), pitch: enable3D ? 45 : 0 };
}

// ── Build best-zone heat map GeoJSON ──────────────────────────────────────
// Creates a circle of points around the best zone center for a heatmap layer
function buildBestZoneGeoJSON(zone: BestZone): any {
  const points: any[] = [];
  // Dense center point (highest weight)
  for (let i = 0; i < 8; i++) {
    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [zone.lon, zone.lat] },
      properties: { weight: 1.0 },
    });
  }
  // Ring of points around center
  const steps = 16;
  const degPerKm = 1 / 111;
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const r = zone.radiusKm * degPerKm;
    points.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [
        zone.lon + Math.sin(angle) * r,
        zone.lat + Math.cos(angle) * r,
      ]},
      properties: { weight: 0.4 },
    });
  }
  return { type: 'FeatureCollection', features: points };
}

// ── Main 3D setup function ─────────────────────────────────────────────────
function setup3D(
  map: any,
  runs: any, lifts: any,
  diffFilter: string[],
  mode: MapMode,
  bestZone: BestZone | null | undefined,
  enable3D = true,
  liftStatuses?: Record<string,string>,
) {
  // ── Terrain (Pro only) ────────────────────────────────────────────────────
  if (enable3D && !map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512, maxzoom: 14,
    });
  }
  if (enable3D) map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
  else try { map.setTerrain(null); } catch(_){}

  // ── Hillshade ─────────────────────────────────────────────────────────────
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
        'hillshade-exaggeration':           0.65,
        'hillshade-shadow-color':           '#1a3a5c',
        'hillshade-highlight-color':        '#f0f7ff',
        'hillshade-accent-color':           '#7bafd4',
      },
    });
  }

  // ── Sky + Fog ─────────────────────────────────────────────────────────────
  if (!map.getLayer('sky')) {
    map.addLayer({ id: 'sky', type: 'sky', paint: {
      'sky-type':                     'atmosphere',
      'sky-atmosphere-sun':           [0.0, 75.0],
      'sky-atmosphere-sun-intensity': 12,
      'sky-atmosphere-color':         'rgba(186,210,235,1)',
      'sky-atmosphere-halo-color':    'rgba(255,255,255,0.5)',
    }});
  }
  map.setFog({
    color:           'rgba(220,235,248,0.5)',
    'high-color':    'rgba(180,210,240,0.2)',
    'horizon-blend': 0.05,
    'space-color':   'rgba(100,160,210,0.8)',
  });

  // ── Snow tint + forest (non-satellite modes) ───────────────────────────────
  ['piq-forest','piq-snow-cap'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
  });
  if (mode !== 'hybrid') {
    try {
      map.addLayer({ id: 'piq-forest', type: 'fill',
        source: 'composite', 'source-layer': 'landcover',
        filter: ['match', ['get', 'class'], ['wood', 'scrub'], true, false],
        paint: { 'fill-color': '#2d5a1b',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.55, 14, 0.4] },
      }, 'piq-hillshade');
    } catch (_) {}
    try {
      map.addLayer({ id: 'piq-snow-cap', type: 'background',
        paint: { 'background-color': '#ddeeff', 'background-opacity': 0.22 },
      });
    } catch (_) {}
  }

  // ── Remove old layers ─────────────────────────────────────────────────────
  ['piq-best-zone','piq-best-zone-glow',
   'piq-runs-case','piq-runs-line','piq-runs-lbl',
   'piq-lifts-case','piq-lifts-line','piq-lifts-lbl',
   'piq-hold-pills','piq-hold-labels'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch (_) {}
  });
  ['piq-runs','piq-lifts','piq-best-zone-src'].forEach(id => {
    try { if (map.getSource(id)) map.removeSource(id); } catch (_) {}
  });

  // ── Best Zone Heat Map ────────────────────────────────────────────────────
  // Orange/amber glow over the recommended ski area — like Image 2
  if (bestZone) {
    map.addSource('piq-best-zone-src', {
      type: 'geojson',
      data: buildBestZoneGeoJSON(bestZone),
    });

    // Outer glow (wide, soft)
    map.addLayer({ id: 'piq-best-zone-glow', type: 'heatmap',
      source: 'piq-best-zone-src',
      paint: {
        'heatmap-weight':   ['get', 'weight'],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 10, 0.8, 14, 1.5],
        'heatmap-radius':   ['interpolate', ['linear'], ['zoom'], 10, 60, 14, 120],
        'heatmap-opacity':  0.55,
        'heatmap-color':    ['interpolate', ['linear'], ['heatmap-density'],
          0,    'rgba(255,200,50,0)',
          0.2,  'rgba(255,160,20,0.3)',
          0.5,  'rgba(255,120,10,0.55)',
          0.8,  'rgba(255,80,0,0.65)',
          1.0,  'rgba(255,50,0,0.7)',
        ],
      },
    });

    // Inner bright core
    map.addLayer({ id: 'piq-best-zone', type: 'heatmap',
      source: 'piq-best-zone-src',
      paint: {
        'heatmap-weight':   ['get', 'weight'],
        'heatmap-intensity': 2,
        'heatmap-radius':   ['interpolate', ['linear'], ['zoom'], 10, 20, 14, 40],
        'heatmap-opacity':  0.4,
        'heatmap-color':    ['interpolate', ['linear'], ['heatmap-density'],
          0,   'rgba(255,240,100,0)',
          0.5, 'rgba(255,220,50,0.5)',
          1.0, 'rgba(255,200,0,0.8)',
        ],
      },
    });
  }

  // ── Piste runs ────────────────────────────────────────────────────────────
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
  // Enrich lift features with live status from liftStatuses prop
  const enrichedLifts = {
    ...lifts,
    features: lifts.features.map((f: any) => {
      const name   = f.properties?.name ?? '';
      const status = liftStatuses?.[name] ?? 'unknown';
      return { ...f, properties: { ...f.properties, status } };
    }),
  };
  map.addSource('piq-lifts', { type: 'geojson', data: enrichedLifts });

  // On-hold marker points — midpoint of each on-hold lift
  const holdPoints: any[] = enrichedLifts.features
    .filter((f: any) => f.properties?.status === 'on_hold' || f.properties?.status === 'scheduled')
    .map((f: any) => {
      const coords = f.geometry?.coordinates ?? [];
      const mid    = Math.floor(coords.length / 2);
      const pt     = coords[mid] ?? coords[0];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: {
          name:   f.properties?.name ?? '',
          status: f.properties?.status,
          label:  f.properties?.status === 'on_hold' ? 'On Hold' : 'Scheduled',
        },
      };
    });
  if (!map.getSource('piq-hold-src')) {
    map.addSource('piq-hold-src', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: holdPoints },
    });
  } else {
    (map.getSource('piq-hold-src') as any).setData(
      { type: 'FeatureCollection', features: holdPoints }
    );
  }

  // White casing for contrast on satellite
  map.addLayer({ id: 'piq-runs-case', type: 'line', source: 'piq-runs',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': '#ffffff',
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 13, 4, 15, 5.5],
      'line-opacity': 0.75 },
  });

  // Colored runs — matching Ikon/Epic visual system
  map.addLayer({ id: 'piq-runs-line', type: 'line', source: 'piq-runs',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'difficulty'],
        'novice',       '#2ecc40',   // bright green
        'easy',         '#2ecc40',
        'intermediate', '#0074d9',   // vivid blue
        'advanced',     '#111827',   // near-black
        'expert',       '#111827',
        'freeride',     '#ff851b',   // orange for backcountry
        '#0074d9'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 13, 2, 15, 3],
      'line-opacity': 0.95,
    },
  });

  // Run name labels
  map.addLayer({ id: 'piq-runs-lbl', type: 'symbol', source: 'piq-runs',
    minzoom: 13,
    layout: {
      'symbol-placement': 'line-center',
      'text-field':       ['get', 'name'],
      'text-font':        ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size':        10, 'text-max-width': 8,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#000', 'text-halo-width': 1.5, 'text-opacity': 0.9 },
  });

  // Lift lines — Pro only
  if (!enable3D) return;

  // Lift white casing
  map.addLayer({ id: 'piq-lifts-case', type: 'line', source: 'piq-lifts',
    layout: { 'line-cap': 'butt' },
    paint: { 'line-color': '#ffffff', 'line-width': 3.5, 'line-opacity': 0.45 },
  });

  // Lift lines — colored by live status
  // Open = red (#ef4444), On Hold/Scheduled = blue (#0074d9), Unknown/Closed = gray (#94a3b8)
  map.addLayer({ id: 'piq-lifts-line', type: 'line', source: 'piq-lifts',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get', 'status'],
        'open',      '#ef4444',   // red — running
        'on_hold',   '#0074d9',   // blue — hold
        'scheduled', '#0074d9',   // blue — scheduled
        'closed',    '#94a3b8',   // gray — closed
        '#94a3b8'],               // default gray
      'line-width':     2.5,
      'line-dasharray': ['match', ['get', 'status'],
        'open', ['literal', [1, 0]],          // solid when open
        ['literal', [2, 2]]],                  // dashed when hold/closed
      'line-opacity': ['match', ['get', 'status'],
        'closed', 0.4,
        0.92],
    },
  });

  // Lift name labels — colored by status
  map.addLayer({ id: 'piq-lifts-lbl', type: 'symbol', source: 'piq-lifts',
    minzoom: 12,
    layout: { 'symbol-placement': 'line-center', 'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'], 'text-size': 9 },
    paint: {
      'text-color': ['match', ['get', 'status'],
        'open', '#ef4444', 'on_hold', '#0074d9', 'scheduled', '#0074d9', '#94a3b8'],
      'text-halo-color': '#fff', 'text-halo-width': 1.5, 'text-opacity': 0.9,
    },
  });

  // ── On Hold / Scheduled pill markers at lift midpoints ─────────────────
  map.addLayer({ id: 'piq-hold-pills', type: 'circle', source: 'piq-hold-src',
    paint: {
      'circle-radius':       14,
      'circle-color': ['match', ['get', 'status'],
        'on_hold',   '#0074d9',
        'scheduled', '#f59e0b',
        '#0074d9'],
      'circle-opacity':      0.92,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  map.addLayer({ id: 'piq-hold-labels', type: 'symbol', source: 'piq-hold-src',
    layout: {
      'text-field':  ['get', 'label'],
      'text-font':   ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-size':   9,
      'text-anchor': 'center',
    },
    paint: {
      'text-color':       '#ffffff',
      'text-halo-color':  'rgba(0,0,0,0)',
      'text-halo-width':  0,
    },
  });
}

// ── Component ─────────────────────────────────────────────────────────────
export default function MapboxMap({
  lat, lon, zoom = 13, mode, mountainId, enable3D = true, resortName, bestZone,
  liftStatuses, prefetchCoords, prefetchIds,
  trails = [], diffFilter = [], onLoad,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const readyRef      = useRef(false);
  const osmCache      = useRef<Map<string, { runs: any; lifts: any }>>(new Map());
  const prevKey       = useRef('');
  const activeKeyRef  = useRef('');
  const markerRef     = useRef<any>(null);
  const liftMarkersRef = useRef<any[]>([]);
  const [error,   setError]   = useState('');
  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);

  const loadAndRender = useCallback(async (
    map: any,
    _lat: number, _lon: number,
    _df: string[], _mode: MapMode,
    _name: string | undefined,
    _fallbackZoom: number,
    _bestZone: BestZone | null | undefined,
    _liftStatuses: Record<string,string> | undefined,
    _mountainId: string | undefined,
    _enable3D: boolean,
  ) => {
    const key = `${_lat.toFixed(4)},${_lon.toFixed(4)}`;
    setLoading(true);

    let geo = osmCache.current.get(key);
    if (!geo) {
      const abortCtrl = new AbortController();
      geo = await fetchTrailGeo(_mountainId, _lat, _lon, abortCtrl.signal);
      // Cache if we got data; if empty don't cache so next visit retries
      if (geo.runs.features.length > 0 || geo.lifts.features.length > 0) {
        osmCache.current.set(key, geo);
      }
    }

    // If resort changed mid-fetch, skip this stale result
    if (activeKeyRef.current && key !== activeKeyRef.current) { setLoading(false); return; }

    if (!readyRef.current) { setLoading(false); return; }

    // Ensure style is loaded — poll with a short timeout rather than waiting on an event
    // (map.once('styledata') can hang if styledata already fired)
    if (!map.isStyleLoaded()) {
      let waited = 0;
      while (!map.isStyleLoaded() && waited < 3000) {
        await new Promise(r => setTimeout(r, 100));
        waited += 100;
      }
    }

    try {
      if (!readyRef.current) { setLoading(false); return; }
      setup3D(map, geo.runs, geo.lifts, _df, _mode, _enable3D ? _bestZone : null, _enable3D, _liftStatuses);

      // Camera: base-anchored, 45° pitch, facing ski face
      const cam = computeCamera(geo, _lat, _lon, _fallbackZoom, _enable3D);
      map.easeTo({ ...cam, duration: 1200 });

      // Summit pin
      const summit = findSummitCoord(geo, _lat, _lon);
      if (summit) {
        const mgl = (await import('mapbox-gl')).default;
        markerRef.current?.remove();
        const label = (_name ?? 'Summit').replace(/ (Resort|Mountain|Ski Area|Springs)$/i, '');
        markerRef.current = new mgl.Marker({ element: createPinEl(label), anchor: 'bottom' })
          .setLngLat(summit).addTo(map);
      }

      // Clear old Marker dots — status is now baked into the GeoJSON line colors
      liftMarkersRef.current.forEach(m => m.remove());
      liftMarkersRef.current = [];
    } catch (e) {
      console.warn('[MapboxMap] render:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────
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
          center: [lon, lat], zoom, pitch: enable3D ? 45 : 0, bearing: 0,
          attributionControl: false, logoPosition: 'bottom-left', antialias: true,
        });
        map.addControl(new mgl.AttributionControl({ compact: true }), 'bottom-left');
        // Full navigation controls for free-camera: pan, zoom, rotate, tilt
        map.addControl(new mgl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right');
        map.scrollZoom.enable();
        map.dragRotate.enable();
        map.touchZoomRotate.enableRotation();
        map.on('load', () => {
          mapRef.current = map;
          readyRef.current = true;
          setReady(true);
          onLoad?.();
          activeKeyRef.current = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          loadAndRender(map, lat, lon, diffFilter, mode, resortName, zoom, bestZone, liftStatuses, mountainId, enable3D);
        });
        map.on('error', (e: any) => {
          if (e?.error?.status !== 403) console.warn('[MapboxMap]', e?.error?.message ?? e);
        });
        // Prefetch other saved resorts via API after map is idle
        // This warms both the server DB cache and the client osmCache
        map.once('idle', () => {
          (prefetchIds ?? []).slice(0, 4).forEach((pid: string) => {
            fetch(`/api/mountains/${pid}/trails/geojson`)
              .then(r => r.ok ? r.json() : null)
              .then(geo => {
                if (geo?.runs && (prefetchCoords ?? []).length > 0) {
                  // We don't have coords→key mapping here so just warm server cache
                }
              })
              .catch(() => {});
          });
        });
      } catch (e: any) {
        setError(e?.message ?? 'Map failed to load');
      }
    })();
    return () => {
      readyRef.current = false;
      markerRef.current?.remove();
      liftMarkersRef.current.forEach(m => m.remove());
      mapRef.current = null;
      map?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resort change ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !lat || !lon) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;
    activeKeyRef.current = key; // keep in sync
    const cachedGeo = osmCache.current.get(key) ?? null;
    map.flyTo({ ...computeCamera(cachedGeo, lat, lon, zoom, enable3D), speed: 1.4, curve: 1.2 });
    loadAndRender(map, lat, lon, diffFilter, mode, resortName, zoom, bestZone, liftStatuses, mountainId, enable3D);
  }, [lat, lon, zoom, loadAndRender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mode switch ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(MAP_STYLE[mode]);
    map.once('styledata', () => {
      if (readyRef.current)
        loadAndRender(map, lat, lon, diffFilter, mode, resortName, zoom, bestZone, liftStatuses, mountainId, enable3D);
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Diff filter ───────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const geo = osmCache.current.get(key);
    if (geo) {
      try { setup3D(map, geo.runs, geo.lifts, diffFilter, mode, bestZone, enable3D, liftStatuses); } catch (_) {}
    }
  }, [diffFilter, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Best zone update ──────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const geo = osmCache.current.get(key);
    if (geo) {
      try { setup3D(map, geo.runs, geo.lifts, diffFilter, mode, bestZone, enable3D, liftStatuses); } catch (_) {}
    }
  }, [bestZone, ready]); // eslint-disable-line react-hooks/exhaustive-deps

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
