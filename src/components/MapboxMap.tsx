// src/components/MapboxMap.tsx
// Client-only Mapbox GL component. Never SSR'd.
// Stays mounted across resort changes — uses flyTo() to move the camera
// rather than remounting, which avoids the flash/reload on every selection.

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

const DIFF_COLOR: Record<string, string> = {
  green:        '#22c55e',
  blue:         '#3b82f6',
  black:        '#1f2937',
  double_black: '#111827',
  terrain_park: '#f97316',
  backcountry:  '#eab308',
};

const MAP_STYLE: Record<MapMode, string> = {
  trail:     'mapbox://styles/mapbox/outdoors-v12',
  satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
  hybrid:    'mapbox://styles/mapbox/satellite-v9',
};

export default function MapboxMap({
  lat, lon, zoom = 13, mode,
  trails = [], diffFilter = [], onLoad,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const readyRef     = useRef(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  // ── One-time map initialisation ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!TOKEN) { setError('Mapbox token not configured'); return; }

    let map: any;

    (async () => {
      try {
        // Inject Mapbox CSS once
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
          attributionControl: false,
          logoPosition:       'bottom-left',
          antialias:          true,
        });

        map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-left');
        map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          mapRef.current  = map;
          readyRef.current = true;
          setReady(true);
          onLoad?.();
        });

        map.on('error', (e: any) => {
          if (e?.error?.status !== 403) {
            console.warn('[MapboxMap]', e?.error?.message ?? e);
          }
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

  // ── Fly to new resort when lat/lon change ─────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !lat || !lon) return;
    map.flyTo({ center: [lon, lat], zoom, speed: 1.4, curve: 1.2 });
  }, [lat, lon, zoom]);

  // ── Switch style when mode changes ────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(MAP_STYLE[mode]);
    map.once('styledata', () => {
      if (readyRef.current) addTrailLayers(map, trails, diffFilter);
    });
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update trail overlays ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    addTrailLayers(map, trails, diffFilter);
  }, [ready, trails, diffFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) return (
    <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',
      justifyContent:'center',background:'#f0f5fb',borderRadius:16,
      flexDirection:'column',gap:10}}>
      <span style={{fontSize:32}}>🗺️</span>
      <span style={{fontSize:12,color:'#6b849a',maxWidth:220,textAlign:'center'}}>{error}</span>
    </div>
  );

  return (
    <div ref={containerRef} style={{width:'100%',height:'100%',borderRadius:16,overflow:'hidden'}}/>
  );
}

function addTrailLayers(map: any, trails: TrailFeature[], diffFilter: string[]) {
  ['piq-trails-line','piq-trails-label'].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource('piq-trails')) map.removeSource('piq-trails');
  if (trails.length === 0) return;

  const visible = diffFilter.length > 0
    ? trails.filter(t => diffFilter.includes(t.difficulty))
    : trails;

  map.addSource('piq-trails', {
    type: 'geojson',
    data: {
      type: 'FeatureCollection',
      features: visible.map(t => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { name: t.trailName, difficulty: t.difficulty, status: t.status,
          color: DIFF_COLOR[t.difficulty] ?? '#3b82f6' },
      })),
    },
  });
}
