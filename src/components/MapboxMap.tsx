// src/components/MapboxMap.tsx
// Dynamic Mapbox GL map component — client-only, never SSR'd.
// Renders a satellite, terrain, or hybrid map centered on the resort.
// Trail overlays are drawn from OSM GeoJSON when available.
// Safe to use in any Next.js page via next/dynamic with ssr:false.

'use client';
import { useEffect, useRef, useState } from 'react';

const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

export type MapMode = 'trail' | 'satellite' | 'hybrid';

export interface TrailFeature {
  id: string;
  trailName: string;
  difficulty: string;
  status: string;
}

interface Props {
  lat: number;
  lon: number;
  zoom?: number;
  mode: MapMode;
  trails?: TrailFeature[];
  diffFilter?: string[];
  onLoad?: () => void;
}

// Difficulty → line color
const DIFF_COLOR: Record<string, string> = {
  green:        '#22c55e',
  blue:         '#3b82f6',
  black:        '#1f2937',
  double_black: '#111827',
  terrain_park: '#f97316',
  backcountry:  '#eab308',
};

const STYLE: Record<MapMode, string> = {
  trail:     'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  hybrid:    'mapbox://styles/mapbox/satellite-v9',
};

export default function MapboxMap({ lat, lon, zoom = 13, mode, trails = [], diffFilter = [], onLoad }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const [error, setError]   = useState('');
  const [ready, setReady]   = useState(false);

  // ── Init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) { setError('Missing NEXT_PUBLIC_MAPBOX_TOKEN'); return; }

    let map: any;

    (async () => {
      try {
        if (!document.getElementById('mapbox-css')) {
          const link = document.createElement('link');
          link.id = 'mapbox-css';
          link.rel = 'stylesheet';
          link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
          document.head.appendChild(link);
        }
        // @ts-ignore — dynamic import, types resolved via @types/mapbox-gl
        const mapboxgl = (await import('mapbox-gl')).default;
        mapboxgl.accessToken = TOKEN;

        map = new mapboxgl.Map({
          container: containerRef.current!,
          style: STYLE[mode],
          center: [lon, lat],
          zoom,
          attributionControl: false,
          logoPosition: 'bottom-left',
        });

        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          mapRef.current = map;
          setReady(true);
          onLoad?.();
        });

        map.on('error', (e: any) => {
          console.error('[MapboxMap]', e);
        });
      } catch (e: any) {
        console.error('[MapboxMap] init failed', e);
        setError(e?.message ?? 'Map failed to load');
      }
    })();

    return () => {
      mapRef.current = null;
      map?.remove();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch style when mode changes ───────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setStyle(STYLE[mode]);
    // Re-add trail layers after style reload
    map.once('styledata', () => addTrailLayers(map, trails, diffFilter));
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add/update trail overlays ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    addTrailLayers(map, trails, diffFilter);
  }, [ready, trails, diffFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',
      background:'#f0f5fb',borderRadius:16,flexDirection:'column',gap:8}}>
      <span style={{fontSize:28}}>🗺️</span>
      <span style={{fontSize:12,color:'#6b849a',maxWidth:200,textAlign:'center'}}>{error}</span>
    </div>
  );

  return (
    <div ref={containerRef} style={{width:'100%',height:'100%',borderRadius:16,overflow:'hidden'}}/>
  );
}

// ── Trail layer helpers ───────────────────────────────────────────────────────

function addTrailLayers(map: any, trails: TrailFeature[], diffFilter: string[]) {
  // Clean up old layers/source
  ['piq-trails-line','piq-trails-label'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('piq-trails')) map.removeSource('piq-trails');

  if (trails.length === 0) return;

  // Filter by diffFilter if active
  const visible = diffFilter.length > 0
    ? trails.filter(t => diffFilter.includes(t.difficulty))
    : trails;

  // Build a minimal GeoJSON from trail names — we don't have geometry yet
  // (that comes from the trailMapService OSM fetch with full coordinates)
  // For now we draw colored legend dots at resort center — real geometry
  // will be wired in once the OSM geojson endpoint is connected
  // This structure is ready to accept real LineString features:
  const geojson = {
    type: 'FeatureCollection' as const,
    features: visible.map(t => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [0, 0] }, // placeholder
      properties: {
        name: t.trailName,
        difficulty: t.difficulty,
        status: t.status,
        color: DIFF_COLOR[t.difficulty] ?? '#3b82f6',
      },
    })),
  };

  // Source added — ready for real LineString geometry from OSM
  map.addSource('piq-trails', { type: 'geojson', data: geojson });
}
