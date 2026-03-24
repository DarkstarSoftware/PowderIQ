// src/components/MapboxMap.tsx
// 3D ski resort map — Mapbox GL JS, client-only, never SSR'd.
//
// Ikon/Epic-style 3D mountain map:
//  - Real elevation via Mapbox DEM + 1.5x exaggeration
//  - Camera auto-orients to face the mountain's fall line (downhill direction)
//  - 65° pitch for dramatic mountain perspective
//  - Atmospheric fog + sky layer for depth
//  - OSM piste LineStrings with difficulty colors + white casing
//  - Lift lines (red dashed) with name labels
//  - flyTo() on resort change — never remounts the map

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const TOKEN    = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const BBOX_PAD = 0.05;
const OVERPASS = 'https://overpass-api.de/api/interpreter';

export type MapMode = 'trail' | 'satellite' | 'hybrid';

export interface TrailFeature {
  id: string; trailName: string; difficulty: string; status: string;
}

interface Props {
  lat: number; lon: number; zoom?: number; mode: MapMode;
  resortName?: string;        // shown in summit pin label
  summitLat?: number;         // actual summit coordinates for the peak pin
  summitLon?: number;
  trails?: TrailFeature[]; diffFilter?: string[]; onLoad?: () => void;
}

const MAP_STYLE: Record<MapMode, string> = {
  trail:     'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',  // labels + satellite
  hybrid:    'mapbox://styles/mapbox/satellite-v9',            // pure satellite, cleanest
};

// ── Overpass query — pistes + lifts with full node geometry ─────────────────
function buildQuery(s: number, w: number, n: number, e: number) {
  return `[out:json][timeout:28];
(
  way["piste:type"~"downhill|nordic|snow_park|terrain_park"](${s},${w},${n},${e});
  way["aerialway"~"gondola|chair_lift|drag_lift|t-bar|magic_carpet|rope_tow|cable_car|mixed_lift"](${s},${w},${n},${e});
);
out body geom;`;
}

// ── Parse Overpass → two GeoJSON FeatureCollections ─────────────────────────
function parseOverpass(data: any): { runs: any; lifts: any } {
  const runs: any[] = [], lifts: any[] = [];
  for (const el of data.elements ?? []) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
    const t = el.tags ?? {};
    if (t['piste:type']) {
      runs.push({ type:'Feature',
        geometry:   { type:'LineString', coordinates: coords },
        properties: { name: t.name ?? t['piste:name'] ?? '',
          difficulty: t['piste:difficulty'] ?? 'easy',
          grooming:   t['piste:grooming']   ?? '' }});
    } else if (t.aerialway) {
      lifts.push({ type:'Feature',
        geometry:   { type:'LineString', coordinates: coords },
        properties: { name: t.name ?? '', aerialway: t.aerialway }});
    }
  }
  return {
    runs:  { type:'FeatureCollection', features: runs  },
    lifts: { type:'FeatureCollection', features: lifts },
  };
}

// ── Extract summit + base coordinates from OSM piste/lift data ──────────────
// Uses lift endpoints: in OSM, aerialway ways go base→summit (first→last node).
// Falls back to the piste coordinate with highest elevation tag, or
// the coordinate farthest from the resort centroid (uphill end of runs).
interface MountainExtents {
  summit: [number, number];
  base:   [number, number];
  center: [number, number];
  spanKm: number;
}

function extractMountainExtents(geo: { runs: any; lifts: any }): MountainExtents | null {
  const allCoords: [number, number][] = [];

  // Collect all piste coords
  for (const f of geo.runs?.features ?? []) {
    for (const c of f.geometry?.coordinates ?? []) allCoords.push(c as [number, number]);
  }

  // Best summit: last node of each lift (aerialway goes base→summit in OSM)
  const liftSummits: [number, number][] = [];
  for (const f of geo.lifts?.features ?? []) {
    const coords = f.geometry?.coordinates ?? [];
    if (coords.length >= 2) {
      liftSummits.push(coords[coords.length - 1] as [number, number]);
    }
  }

  if (allCoords.length < 4 && liftSummits.length === 0) return null;

  // Resort center = centroid of all piste coordinates
  const all = allCoords.length > 0 ? allCoords : liftSummits;
  const cLon = all.reduce((s, c) => s + c[0], 0) / all.length;
  const cLat = all.reduce((s, c) => s + c[1], 0) / all.length;

  // Summit = centroid of lift top stations (most reliable)
  let summit: [number, number];
  if (liftSummits.length > 0) {
    summit = [
      liftSummits.reduce((s, c) => s + c[0], 0) / liftSummits.length,
      liftSummits.reduce((s, c) => s + c[1], 0) / liftSummits.length,
    ];
  } else {
    // Fallback: coordinate farthest from centroid (tends to be the summit)
    const farthest = allCoords.reduce((best, c) => {
      const d = Math.hypot(c[0] - cLon, c[1] - cLat);
      return d > best.d ? { c, d } : best;
    }, { c: allCoords[0], d: 0 });
    summit = farthest.c;
  }

  // Base = lift first nodes (base stations)
  const liftBases: [number, number][] = [];
  for (const f of geo.lifts?.features ?? []) {
    const coords = f.geometry?.coordinates ?? [];
    if (coords.length >= 2) liftBases.push(coords[0] as [number, number]);
  }
  const base: [number, number] = liftBases.length > 0
    ? [
        liftBases.reduce((s, c) => s + c[0], 0) / liftBases.length,
        liftBases.reduce((s, c) => s + c[1], 0) / liftBases.length,
      ]
    : [cLon, cLat];

  // Span in km (approximate)
  const dLat = (summit[1] - base[1]) * 111;
  const dLon = (summit[0] - base[0]) * 111 * Math.cos(cLat * Math.PI / 180);
  const spanKm = Math.hypot(dLat, dLon);

  return { summit, base, center: [cLon, cLat], spanKm };
}

// ── Compute camera bearing from summit→base fall line ───────────────────────
// Camera is positioned beyond the base looking toward the summit.
// Bearing = direction FROM base TO summit (we look toward the mountain face).
function computeBearingFromExtents(extents: MountainExtents): number {
  const dLon = extents.summit[0] - extents.base[0];
  const dLat = extents.summit[1] - extents.base[1];
  // Bearing from base to summit = the direction the camera looks
  const bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

// ── Compute ideal zoom level from resort geographic span ─────────────────────
function computeZoomFromSpan(spanKm: number, pitchDeg: number): number {
  // At 75° pitch, the visible area is foreshortened — need to zoom out more
  // Base zoom for span: ~1km resort = zoom 14, ~5km = zoom 12, ~15km = zoom 11
  const baseZoom = Math.max(10.5, Math.min(15, 14 - Math.log2(Math.max(spanKm, 0.5))));
  // Pitch compensation: higher pitch means foreshortening, zoom out slightly
  const pitchFactor = 1 - (pitchDeg - 45) / 200;
  return Math.round(baseZoom * pitchFactor * 10) / 10;
}

// ── Compute camera center offset ─────────────────────────────────────────────
// At high pitch the summit appears at the top of the screen only if the camera
// center is positioned between base and summit, biased toward the base.
// We offset the center ~40% of the way from resort-center toward the base.
function computeCameraCenter(extents: MountainExtents): [number, number] {
  const bias = 0.35; // 0=resort center, 1=base
  return [
    extents.center[0] + (extents.base[0] - extents.center[0]) * bias,
    extents.center[1] + (extents.base[1] - extents.center[1]) * bias,
  ];
}

// ── 3D terrain + sky + fog + piste/lift layers ───────────────────────────────
function setup3D(map: any, runs: any, lifts: any, diffFilter: string[], mode: MapMode) {
  // Terrain DEM
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512, maxzoom: 14,
    });
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

  // ── Hillshade for shadow depth — traditional trail map feel ──────────────
  if (!map.getLayer('piq-hillshade')) {
    if (!map.getSource('piq-hillshade-src')) {
      map.addSource('piq-hillshade-src', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
      });
    }
    map.addLayer({
      id: 'piq-hillshade', type: 'hillshade',
      source: 'piq-hillshade-src',
      paint: {
        'hillshade-illumination-direction': 315, // NW light source — classic ski map lighting
        'hillshade-illumination-anchor':    'map',
        'hillshade-exaggeration':           0.7,  // strong shadows show terrain depth
        'hillshade-shadow-color':           '#1a3a5c',  // deep blue shadow (like reference)
        'hillshade-highlight-color':        '#f8fbff',  // bright white peaks
        'hillshade-accent-color':           '#7bafd4',  // blue-gray mid tones
      },
    }, 'waterway-label'); // insert below labels
  }

  // ── Snow + forest layers ─────────────────────────────────────────────────
  // Strategy: use Mapbox's built-in terrain DEM source for fill-extrusion
  // to create a white "snow cap" on the mountain. Trees/forest come from
  // the 'landuse' vector source which is available in all standard styles.
  // We always try-catch each layer addition since availability varies by style.

  // Clean up stale layers first
  ['piq-snow-cap','piq-forest','piq-trees','piq-snow-white',
   'piq-snow-tint','piq-snow-base','piq-rock'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch(_) {}
  });

  if (mode !== 'hybrid') {
    // ── Forest layer from Mapbox's standard landuse source ────────────────
    // 'landuse' source-layer exists in outdoors-v12 and satellite-streets-v12
    try {
      map.addLayer({
        id: 'piq-forest', type: 'fill',
        source: 'composite',
        'source-layer': 'landuse',
        filter: ['match', ['get', 'class'],
          ['wood', 'scrub', 'grass', 'forest'], true, false],
        paint: {
          'fill-color': '#2d5a1b',
          'fill-opacity': ['interpolate', ['linear'], ['zoom'],
            10, 0.65, 13, 0.55, 15, 0.45],
        },
      });
    } catch(_) {
      // Try alternate source-layer name
      try {
        map.addLayer({
          id: 'piq-forest', type: 'fill',
          source: 'composite',
          'source-layer': 'landcover',
          filter: ['match', ['get', 'class'],
            ['wood', 'scrub'], true, false],
          paint: {
            'fill-color': '#2d5a1b',
            'fill-opacity': 0.55,
          },
        });
      } catch(_2) { /* not available in this style */ }
    }

    // ── Snow-white terrain tint ───────────────────────────────────────────
    // A light blue-white background at ~25% opacity gives non-forested
    // terrain the white snow look while letting hillshade shadows through.
    // Inserted BELOW piste lines but above the base map.
    try {
      const insertBefore = map.getLayer('piq-runs-case') ? 'piq-runs-case'
                         : map.getLayer('piq-hillshade') ? undefined
                         : undefined;
      const layerDef: any = {
        id: 'piq-snow-cap', type: 'background',
        paint: {
          'background-color':   '#ddeeff',
          'background-opacity': 0.28,
        },
      };
      if (insertBefore) map.addLayer(layerDef, insertBefore);
      else map.addLayer(layerDef);
    } catch(_) { /* ignore */ }
  }

  // Sky layer — only works on outdoor/satellite styles
  if (!map.getLayer('sky')) {
    map.addLayer({ id:'sky', type:'sky', paint: {
      'sky-type':                    'atmosphere',
      'sky-atmosphere-sun':          [0.0, 80.0],
      'sky-atmosphere-sun-intensity': 15,
      'sky-atmosphere-color':        'rgba(186,210,235,1)',
      'sky-atmosphere-halo-color':   'rgba(255,255,255,0.6)',
    }});
  }

  // Fog for depth — makes distant peaks feel atmospheric
  map.setFog({
    color:            'rgba(220,235,248,0.6)',
    'high-color':     'rgba(180,210,240,0.3)',
    'horizon-blend':  0.06,
    'space-color':    'rgba(100,160,210,0.8)',
    'star-intensity': 0.08,
  });

  // Remove old layers/sources
  ['piq-runs-case','piq-runs-line','piq-runs-lbl',
   'piq-lifts-case','piq-lifts-line','piq-lifts-lbl'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  ['piq-runs','piq-lifts'].forEach(id => {
    if (map.getSource(id)) map.removeSource(id);
  });

  // Difficulty filter
  const DIFF_OSM: Record<string,string> = {
    green:'easy', blue:'intermediate', black:'advanced',
    double_black:'expert', terrain_park:'terrain_park', backcountry:'freeride',
  };
  const filteredRuns = diffFilter.length > 0 ? {
    ...runs,
    features: runs.features.filter((f: any) =>
      diffFilter.some(d => DIFF_OSM[d] === f.properties.difficulty || d === f.properties.difficulty)
    ),
  } : runs;

  map.addSource('piq-runs',  { type:'geojson', data: filteredRuns });
  map.addSource('piq-lifts', { type:'geojson', data: lifts });

  // ── Piste white casing (contrast on satellite) ────────────────────────────
  map.addLayer({ id:'piq-runs-case', type:'line', source:'piq-runs',
    layout: { 'line-join':'round', 'line-cap':'round' },
    paint: {
      'line-color': '#ffffff',
      'line-width': ['interpolate',['linear'],['zoom'], 10,3, 14,5, 16,7],
      'line-opacity': 0.65,
    },
  });

  // ── Piste colored lines ───────────────────────────────────────────────────
  map.addLayer({ id:'piq-runs-line', type:'line', source:'piq-runs',
    layout: { 'line-join':'round', 'line-cap':'round' },
    paint: {
      'line-color': ['match', ['get','difficulty'],
        'novice','#22c55e', 'easy','#22c55e',
        'intermediate','#3b82f6',
        'advanced','#1e293b', 'expert','#0f172a',
        'freeride','#d97706',
        '#3b82f6'],
      'line-width': ['interpolate',['linear'],['zoom'], 10,1.5, 13,2.5, 15,3.5],
      'line-opacity': 0.92,
    },
  });

  // ── Piste name labels ─────────────────────────────────────────────────────
  map.addLayer({ id:'piq-runs-lbl', type:'symbol', source:'piq-runs',
    minzoom: 13,
    layout: {
      'symbol-placement': 'line-center',
      'text-field':       ['get','name'],
      'text-font':        ['DIN Pro Bold','Arial Unicode MS Bold'],
      'text-size':        10,
      'text-max-width':   6,
      'text-offset':      [0, 0.5],
    },
    paint: {
      'text-color':       '#ffffff',
      'text-halo-color':  '#000000',
      'text-halo-width':  1.5,
      'text-opacity':     0.95,
    },
  });

  // ── Lift casing ───────────────────────────────────────────────────────────
  map.addLayer({ id:'piq-lifts-case', type:'line', source:'piq-lifts',
    layout: { 'line-cap':'butt' },
    paint: { 'line-color':'#ffffff', 'line-width':4, 'line-opacity':0.4 },
  });

  // ── Lift lines (red dashed) ───────────────────────────────────────────────
  map.addLayer({ id:'piq-lifts-line', type:'line', source:'piq-lifts',
    layout: { 'line-join':'round', 'line-cap':'round' },
    paint: {
      'line-color':     '#ef4444',
      'line-width':     2.5,
      'line-dasharray': [2, 2],
      'line-opacity':   0.9,
    },
  });

  // ── Lift name labels ──────────────────────────────────────────────────────
  map.addLayer({ id:'piq-lifts-lbl', type:'symbol', source:'piq-lifts',
    minzoom: 12,
    layout: {
      'symbol-placement': 'line-center',
      'text-field':       ['get','name'],
      'text-font':        ['DIN Pro Medium','Arial Unicode MS Regular'],
      'text-size':        9,
    },
    paint: {
      'text-color':      '#ef4444',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-opacity':    0.9,
    },
  });
}

// ── Summit pin helper ────────────────────────────────────────────────────────
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
  el.innerHTML = `<span style="font-size:14px">⛰️</span><span>${label} Peak</span>`;
  return el;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapboxMap({ lat, lon, zoom = 13, mode,
  resortName, summitLat, summitLon,
  trails = [], diffFilter = [], onLoad }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const readyRef      = useRef(false);
  const osmCache      = useRef<Map<string,{runs:any;lifts:any}>>(new Map());
  const prevKey       = useRef('');
  const markerRef = useRef<any>(null);
  const [error,   setError]   = useState('');
  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Fetch OSM + render ────────────────────────────────────────────────────
  const loadAndRender = useCallback(async (_lat: number, _lon: number, _df: string[], _mode: MapMode, _name?: string) => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const key = `${_lat.toFixed(4)},${_lon.toFixed(4)}`;
    setLoading(true);

    let geo = osmCache.current.get(key);
    if (!geo) {
      try {
        const s = _lat - BBOX_PAD, n = _lat + BBOX_PAD;
        const w = _lon - BBOX_PAD, e = _lon + BBOX_PAD;
        const res = await fetch(OVERPASS, {
          method: 'POST',
          headers: { 'Content-Type':'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(buildQuery(s, w, n, e))}`,
          signal: AbortSignal.timeout(26_000),
        });
        if (res.ok) {
          geo = parseOverpass(await res.json());
          osmCache.current.set(key, geo);
        }
      } catch (e) {
        console.warn('[MapboxMap] Overpass:', e);
      }
      if (!geo) geo = {
        runs:  { type:'FeatureCollection', features:[] },
        lifts: { type:'FeatureCollection', features:[] },
      };
    }

    if (readyRef.current) {
      try {
        setup3D(map, geo.runs, geo.lifts, _df, _mode);

        // Compute extents from lift endpoints (most accurate)
        const extents = extractMountainExtents(geo);

        if (extents) {
          const bearing = computeBearingFromExtents(extents);
          const autoZoom = computeZoomFromSpan(extents.spanKm, 75);
          const center  = computeCameraCenter(extents);

          // Smoothly reorient camera to face the mountain front
          map.easeTo({
            center,
            zoom:    autoZoom,
            bearing,
            pitch:   75,
            duration: 1400,
          });

          // Place summit marker at lift top stations
          const mglMod = (await import('mapbox-gl')).default;
          markerRef.current?.remove();
          const label = (_name ?? resortName ?? 'Summit').replace(/ (Resort|Mountain|Ski Area)$/i, '');
          const el = createPinEl(label);
          markerRef.current = new mglMod.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(extents.summit)
            .addTo(map);
        } else {
          // No OSM data yet — just fix pitch
          map.easeTo({ pitch: 75, duration: 800 });
        }
      } catch (e) {
        console.warn('[MapboxMap] setup3D:', e);
      }
    }
    setLoading(false);
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────────
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
          container:          containerRef.current!,
          style:              MAP_STYLE[mode],
          center:             [lon, lat],
          zoom,
          pitch:              75,
          bearing:            160,
          attributionControl: false,
          logoPosition:       'bottom-left',
          antialias:          true,
        });

        map.addControl(new mgl.AttributionControl({ compact:true }), 'bottom-left');
        map.addControl(new mgl.NavigationControl({ showCompass:true, visualizePitch:true }), 'top-right');

        map.on('load', () => {
          mapRef.current   = map;
          readyRef.current = true;
          setReady(true);
          onLoad?.();
          loadAndRender(lat, lon, diffFilter, mode, resortName);
        });
        map.on('error', (e: any) => {
          if (e?.error?.status !== 403) console.warn('[MapboxMap]', e?.error?.message ?? e);
        });
      } catch (e: any) {
        setError(e?.message ?? 'Map failed to load');
      }
    })();
    return () => { readyRef.current = false; markerRef.current?.remove(); mapRef.current = null; map?.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fly to new resort ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !lat || !lon) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    // Initial fly to resort center — OSM load will refine position
    map.flyTo({ center:[lon,lat], zoom, pitch:75, bearing:160, speed:1.4, curve:1.2 });
    map.once('moveend', () => {
      if (readyRef.current) loadAndRender(lat, lon, diffFilter, mode, resortName);
    });
  }, [lat, lon, zoom, loadAndRender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Style switch ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(MAP_STYLE[mode]);
    map.once('styledata', () => {
      if (readyRef.current) loadAndRender(lat, lon, diffFilter, mode, resortName);
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Diff filter update ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const geo = osmCache.current.get(key);
    if (geo) {
      try { setup3D(map, geo.runs, geo.lifts, diffFilter, mode); } catch (_) { /* style changing */ }
    }
  }, [diffFilter, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',
      justifyContent:'center',background:'#f0f5fb',borderRadius:16,flexDirection:'column',gap:10}}>
      <span style={{fontSize:32}}>🗺️</span>
      <span style={{fontSize:12,color:'#6b849a',maxWidth:220,textAlign:'center'}}>{error}</span>
    </div>
  );

  return (
    <div style={{position:'relative',width:'100%',height:'100%',borderRadius:16,overflow:'hidden'}}>
      <div ref={containerRef} style={{width:'100%',height:'100%'}}/>
      {loading && (
        <div style={{position:'absolute',bottom:14,right:52,background:'rgba(255,255,255,0.9)',
          backdropFilter:'blur(8px)',borderRadius:8,padding:'5px 10px',
          display:'flex',alignItems:'center',gap:6,
          fontSize:11,color:'#3d5166',boxShadow:'0 2px 8px rgba(15,40,80,0.12)',
          border:'1px solid rgba(100,150,200,0.2)'}}>
          <div style={{width:10,height:10,border:'2px solid #dbeafe',borderTopColor:'#1d6ef5',
            borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
          Loading trails…
        </div>
      )}
    </div>
  );
}
