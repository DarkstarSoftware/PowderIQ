// src/components/MapboxMap.tsx
// 3D ski resort map — Mapbox GL JS, client-only, never SSR'd.
//
// Features:
//  - 3D terrain via Mapbox DEM source + exaggeration
//  - Colored piste lines from Overpass OSM (real LineString geometry)
//  - Aerial lift lines (gondola / chairlift / drag)
//  - Difficulty-coded trail colors matching PowderIQ design system
//  - 45° pitch with north-up bearing for mountain feel
//  - flyTo() on resort change — never remounts
//  - Trail/lift overlays update when diffFilter changes

'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const TOKEN     = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
const BBOX_PAD  = 0.045; // ~5 km bounding box around resort
const OVERPASS  = 'https://overpass-api.de/api/interpreter';

export type MapMode = 'trail' | 'satellite' | 'hybrid';

export interface TrailFeature {
  id: string;
  trailName: string;
  difficulty: string;
  status: string;
}

interface Props {
  lat:         number;
  lon:         number;
  zoom?:       number;
  mode:        MapMode;
  trails?:     TrailFeature[];
  diffFilter?: string[];
  onLoad?:     () => void;
}

// ── Color system — matches PowderIQ design ────────────────────────────────────
const PISTE_COLOR: Record<string, string> = {
  novice:       '#22c55e',   // bright green
  easy:         '#22c55e',
  intermediate: '#3b82f6',   // blue
  advanced:     '#1f2937',   // dark / black
  expert:       '#111827',
  freeride:     '#eab308',   // backcountry amber
};
const PISTE_WIDTH: Record<string, number> = {
  novice: 2.5, easy: 2.5, intermediate: 2.5, advanced: 3, expert: 3, freeride: 2,
};
const LIFT_COLOR = '#ef4444'; // red for lifts — easy to spot

// ── Map styles ────────────────────────────────────────────────────────────────
const MAP_STYLE: Record<MapMode, string> = {
  trail:     'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  hybrid:    'mapbox://styles/mapbox/satellite-v9',
};

// ── OSM Overpass query: pistes + aerialways with full geometry ─────────────
function buildQuery(s: number, w: number, n: number, e: number) {
  const bbox = `${s},${w},${n},${e}`;
  return `[out:json][timeout:25];
(
  way["piste:type"~"downhill|nordic|snow_park|terrain_park"](${bbox});
  way["aerialway"~"gondola|chair_lift|drag_lift|t-bar|magic_carpet|rope_tow|cable_car|mixed_lift"](${bbox});
);\nout body geom;`;
}

// ── Parse Overpass response into two GeoJSON FeatureCollections ───────────
function parseOverpass(data: any) {
  const runs:  any[] = [];
  const lifts: any[] = [];

  for (const el of data.elements ?? []) {
    if (el.type !== 'way' || !el.geometry?.length) continue;
    const coords = el.geometry.map((p: any) => [p.lon, p.lat]);
    const tags   = el.tags ?? {};

    if (tags['piste:type']) {
      runs.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          name:       tags.name ?? tags['piste:name'] ?? '',
          difficulty: tags['piste:difficulty'] ?? 'easy',
          grooming:   tags['piste:grooming'] ?? '',
          pisteType:  tags['piste:type'],
        },
      });
    } else if (tags.aerialway) {
      lifts.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
        properties: {
          name:    tags.name ?? '',
          type:    tags.aerialway,
        },
      });
    }
  }

  return {
    runs:  { type: 'FeatureCollection', features: runs  },
    lifts: { type: 'FeatureCollection', features: lifts },
  };
}

// ── Add/update 3D terrain + ski layers ────────────────────────────────────
function setup3D(map: any, runsGeo: any, liftsGeo: any, diffFilter: string[]) {
  // 3D terrain
  if (!map.getSource('mapbox-dem')) {
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url:  'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });
  }
  map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

  // Sky layer for atmosphere
  if (!map.getLayer('sky')) {
    map.addLayer({
      id: 'sky', type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0, 60],
        'sky-atmosphere-sun-intensity': 10,
        'sky-atmosphere-color': 'rgba(135,206,235,1)',
        'sky-atmosphere-halo-color': 'rgba(255,255,255,0.5)',
      },
    });
  }

  // ── Piste (run) lines ─────────────────────────────────────────────────────
  // Remove old layers first
  ['piq-runs-casing','piq-runs','piq-runs-labels',
   'piq-lifts-casing','piq-lifts','piq-lifts-labels'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  ['piq-runs-src','piq-lifts-src'].forEach(id => {
    if (map.getSource(id)) map.removeSource(id);
  });

  // Filter runs by difficulty if filter active
  const DIFF_MAP: Record<string,string> = {
    green:'easy', blue:'intermediate', black:'advanced',
    double_black:'expert', terrain_park:'terrain_park', backcountry:'freeride',
  };
  const filteredRuns = diffFilter.length > 0
    ? {
        ...runsGeo,
        features: runsGeo.features.filter((f: any) => {
          const d = f.properties.difficulty;
          return diffFilter.some(df => DIFF_MAP[df] === d || df === d);
        }),
      }
    : runsGeo;

  map.addSource('piq-runs-src', { type: 'geojson', data: filteredRuns });

  // White casing for visibility on satellite
  map.addLayer({
    id: 'piq-runs-casing', type: 'line',
    source: 'piq-runs-src',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#ffffff',
      'line-width': ['match', ['get','difficulty'],
        'novice',3.5,'easy',3.5,'intermediate',3.5,'advanced',4,'expert',4, 3],
      'line-opacity': 0.7,
      'line-blur': 0.5,
    },
  });

  // Colored run lines
  map.addLayer({
    id: 'piq-runs', type: 'line',
    source: 'piq-runs-src',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': ['match', ['get','difficulty'],
        'novice',   '#22c55e',
        'easy',     '#22c55e',
        'intermediate', '#3b82f6',
        'advanced', '#1f2937',
        'expert',   '#111827',
        'freeride', '#eab308',
        '#3b82f6',
      ],
      'line-width': ['match', ['get','difficulty'],
        'novice',2,'easy',2,'intermediate',2,'advanced',2.5,'expert',2.5, 2],
      'line-opacity': 0.95,
    },
  });

  // Run name labels
  map.addLayer({
    id: 'piq-runs-labels', type: 'symbol',
    source: 'piq-runs-src',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': 10,
      'text-max-width': 8,
      'symbol-placement': 'line-center',
      'text-offset': [0, 0.6],
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
      'text-opacity': 0.9,
    },
  });

  // ── Lift lines ────────────────────────────────────────────────────────────
  map.addSource('piq-lifts-src', { type: 'geojson', data: liftsGeo });

  // Lift casing
  map.addLayer({
    id: 'piq-lifts-casing', type: 'line',
    source: 'piq-lifts-src',
    layout: { 'line-join': 'round', 'line-cap': 'butt' },
    paint: { 'line-color': '#ffffff', 'line-width': 4, 'line-opacity': 0.5 },
  });

  // Lift line
  map.addLayer({
    id: 'piq-lifts', type: 'line',
    source: 'piq-lifts-src',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#ef4444',
      'line-width': 2,
      'line-dasharray': [1.5, 1.5],
      'line-opacity': 0.9,
    },
  });

  // Lift labels
  map.addLayer({
    id: 'piq-lifts-labels', type: 'symbol',
    source: 'piq-lifts-src',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
      'text-size': 9,
      'symbol-placement': 'line-center',
    },
    paint: {
      'text-color': '#ef4444',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
      'text-opacity': 0.85,
    },
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MapboxMap({
  lat, lon, zoom = 13, mode,
  trails = [], diffFilter = [], onLoad,
}: Props) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const mapRef        = useRef<any>(null);
  const readyRef      = useRef(false);
  const osmCacheRef   = useRef<Map<string, {runs:any;lifts:any}>>(new Map());
  const currentKeyRef = useRef('');

  const [error,    setError]    = useState('');
  const [ready,    setReady]    = useState(false);
  const [loading,  setLoading]  = useState(false);

  // ── Fetch OSM piste/lift geometry and render ──────────────────────────────
  const loadAndRender = useCallback(async (
    map: any, _lat: number, _lon: number, df: string[]
  ) => {
    const key = `${_lat.toFixed(4)},${_lon.toFixed(4)}`;
    setLoading(true);

    let geo = osmCacheRef.current.get(key);

    if (!geo) {
      try {
        const s = _lat - BBOX_PAD, n = _lat + BBOX_PAD;
        const w = _lon - BBOX_PAD, e = _lon + BBOX_PAD;
        const res = await fetch(OVERPASS, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    `data=${encodeURIComponent(buildQuery(s, w, n, e))}`,
          signal:  AbortSignal.timeout(25_000),
        });
        if (res.ok) {
          const data = await res.json();
          geo = parseOverpass(data);
          osmCacheRef.current.set(key, geo);
        }
      } catch (e) {
        console.warn('[MapboxMap] Overpass failed:', e);
        geo = { runs: { type:'FeatureCollection', features:[] }, lifts: { type:'FeatureCollection', features:[] } };
      }
    }

    if (geo && readyRef.current) {
      try {
        setup3D(map, geo.runs, geo.lifts, df);
      } catch (e) {
        // Style may have changed mid-flight — ignore
      }
    }
    setLoading(false);
  }, []);

  // ── One-time map init ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) { setError('Mapbox token not configured'); return; }

    let map: any;

    (async () => {
      try {
        if (typeof document !== 'undefined' && !document.getElementById('mapbox-gl-css')) {
          const link = document.createElement('link');
          link.id   = 'mapbox-gl-css';
          link.rel  = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
          document.head.appendChild(link);
        }

        // @ts-ignore
        const mapboxgl = (await import('mapbox-gl')).default;
        // @ts-ignore
        mapboxgl.accessToken = TOKEN;

        map = new mapboxgl.Map({
          container:          containerRef.current!,
          style:              MAP_STYLE[mode],
          center:             [lon, lat],
          zoom,
          pitch:              52,          // 3D camera angle
          bearing:            -15,         // slight rotation looks great on mountains
          attributionControl: false,
          logoPosition:       'bottom-left',
          antialias:          true,
        });

        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
        map.addControl(new mapboxgl.NavigationControl({ showCompass: true,  visualizePitch: true }), 'top-right');

        map.on('load', () => {
          mapRef.current   = map;
          readyRef.current = true;
          setReady(true);
          onLoad?.();
          loadAndRender(map, lat, lon, diffFilter);
        });

        map.on('error', (e: any) => {
          if (e?.error?.status !== 403) console.warn('[MapboxMap]', e?.error?.message ?? e);
        });
      } catch (e: any) {
        console.error('[MapboxMap] init failed', e);
        setError(e?.message ?? 'Map failed to load');
      }
    })();

    return () => {
      readyRef.current = false;
      mapRef.current = null;
      map?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fly to new resort + reload OSM data ──────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !lat || !lon) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    if (key === currentKeyRef.current) return;
    currentKeyRef.current = key;

    map.flyTo({
      center:  [lon, lat],
      zoom,
      pitch:   52,
      bearing: -15,
      speed:   1.2,
      curve:   1.4,
    });

    // Load OSM data for new resort after fly animation starts
    map.once('moveend', () => {
      if (readyRef.current) loadAndRender(map, lat, lon, diffFilter);
    });
  }, [lat, lon, zoom, loadAndRender]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch style ──────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(MAP_STYLE[mode]);
    map.once('styledata', () => {
      if (readyRef.current) loadAndRender(map, lat, lon, diffFilter);
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update trail filter ───────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
    const geo = osmCacheRef.current.get(key);
    if (geo) {
      try { setup3D(map, geo.runs, geo.lifts, diffFilter); } catch (e) { /* style changing */ }
    }
  }, [diffFilter, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',
      justifyContent:'center',background:'#f0f5fb',borderRadius:16,
      flexDirection:'column',gap:10}}>
      <span style={{fontSize:32}}>🗺️</span>
      <span style={{fontSize:12,color:'#6b849a',maxWidth:220,textAlign:'center'}}>{error}</span>
    </div>
  );

  return (
    <div style={{position:'relative',width:'100%',height:'100%',borderRadius:16,overflow:'hidden'}}>
      <div ref={containerRef} style={{width:'100%',height:'100%'}}/>
      {/* Loading spinner while fetching OSM data */}
      {loading && (
        <div style={{position:'absolute',bottom:12,right:50,
          background:'rgba(255,255,255,0.92)',backdropFilter:'blur(6px)',
          borderRadius:8,padding:'5px 10px',display:'flex',alignItems:'center',
          gap:6,fontSize:11,color:'#3d5166',boxShadow:'0 2px 8px rgba(15,40,80,0.12)'}}>
          <div style={{width:10,height:10,border:'2px solid #dbeafe',
            borderTopColor:'#1d6ef5',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
          Loading trails…
        </div>
      )}
    </div>
  );
}
