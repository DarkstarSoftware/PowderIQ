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
  lat: number; lon: number; zoom?: number; mode: MapMode; // zoom default 12 = whole resort visible
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

// ── Compute the map bearing so the ski face is front-and-center ─────────────
// The camera is positioned ABOVE the mountain looking DOWN at ~50° pitch.
// "Bearing" rotates the map so the ski face points toward the viewer.
// 
// Strategy:
//   1. Find summit cluster (top 15% by lat) and base cluster (bottom 15%).
//   2. The ski face runs from summit → base. We want this vector pointing
//      TOWARD the bottom of the screen (toward the viewer).
//   3. So bearing = direction FROM summit TO base (downhill vector).
//      That rotates the map so "downhill" points toward you.
function computeBearing(runs: any): number {
  const features = runs?.features ?? [];
  if (features.length < 3) return 160; // south-southeast default for most NA resorts

  const all: [number, number][] = [];
  for (const f of features) {
    for (const c of f.geometry?.coordinates ?? []) all.push(c as [number, number]);
  }
  if (all.length < 8) return 160;

  // Use lon as x, lat as y. Higher lat = further north = typically higher elevation.
  const byLat = [...all].sort((a, b) => b[1] - a[1]);
  const n     = Math.max(3, Math.floor(byLat.length * 0.15));

  // Summit centroid (highest lat cluster)
  const summit = byLat.slice(0, n);
  const sLon   = summit.reduce((s, c) => s + c[0], 0) / summit.length;
  const sLat   = summit.reduce((s, c) => s + c[1], 0) / summit.length;

  // Base centroid (lowest lat cluster)
  const base   = byLat.slice(byLat.length - n);
  const bLon   = base.reduce((s, c) => s + c[0], 0) / base.length;
  const bLat   = base.reduce((s, c) => s + c[1], 0) / base.length;

  // Direction from summit DOWN to base (this is the fall-line / ski direction)
  // We rotate the map so this vector points toward the bottom of the screen
  const dLon = bLon - sLon;
  const dLat = bLat - sLat;
  const bearing = (Math.atan2(dLon, dLat) * 180) / Math.PI;
  return (bearing + 360) % 360;
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

  // ── Snow white fill over terrain ─────────────────────────────────────────
  // On satellite mode skip (real imagery already shows snow)
  // On outdoors/trail mode: add a semi-transparent white layer above terrain
  // to give the traditional "white mountain with shadows" trail-map look
  if (!map.getLayer('piq-snow-fill')) {
    if (!map.getSource('piq-snow-src')) {
      map.addSource('piq-snow-src', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
      });
    }
    // Use fill-extrusion trick: flat terrain colored white with hillshade
    // Actually we layer a light snow-colored raster tint using a background layer
    if (!map.getLayer('piq-snow-tint')) {
      map.addLayer({
        id: 'piq-snow-tint', type: 'background',
        paint: {
          'background-color': '#ddeeff',   // cool snow-blue tint
          'background-opacity': mode === 'satellite' ? 0 : 0.22, // skip on satellite
        },
      }, 'piq-hillshade');
    }
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

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapboxMap({ lat, lon, zoom = 13, mode, trails = [], diffFilter = [], onLoad }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const readyRef      = useRef(false);
  const osmCache      = useRef<Map<string,{runs:any;lifts:any}>>(new Map());
  const prevKey       = useRef('');
  const [error,   setError]   = useState('');
  const [ready,   setReady]   = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Fetch OSM + render ────────────────────────────────────────────────────
  const loadAndRender = useCallback(async (_lat: number, _lon: number, _df: string[], _mode: MapMode) => {
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
        // Compute the best bearing to face the mountain front
        const bearing = computeBearing(geo.runs);

        // Adjust camera bearing without full flyTo (already at location)
        map.easeTo({ bearing, pitch: 50, duration: 1200 });

        setup3D(map, geo.runs, geo.lifts, _df, _mode);
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
          pitch:              50,
          bearing:            160,   // default SSE-facing; corrected after OSM load
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
          loadAndRender(lat, lon, diffFilter, mode);
        });
        map.on('error', (e: any) => {
          if (e?.error?.status !== 403) console.warn('[MapboxMap]', e?.error?.message ?? e);
        });
      } catch (e: any) {
        setError(e?.message ?? 'Map failed to load');
      }
    })();
    return () => { readyRef.current = false; mapRef.current = null; map?.remove(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fly to new resort ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !lat || !lon) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (key === prevKey.current) return;
    prevKey.current = key;

    map.flyTo({ center:[lon,lat], zoom, pitch:50, bearing:160, speed:1.2, curve:1.4 });
    map.once('moveend', () => {
      if (readyRef.current) loadAndRender(lat, lon, diffFilter, mode);
    });
  }, [lat, lon, zoom, loadAndRender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Style switch ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(MAP_STYLE[mode]);
    map.once('styledata', () => {
      if (readyRef.current) loadAndRender(lat, lon, diffFilter, mode);
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
