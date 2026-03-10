'use client';
// src/components/resort/TrailMap.tsx
//
// Interactive trail map with two base modes:
//   1. OSM mode (default): ESRI satellite + OpenStreetMap piste/lift geometry
//   2. Custom image mode:   Resort-uploaded trail map PNG/PDF overlaid on satellite,
//                           with OSM status lines drawn on top for live coloring
//
// Interactive features:
//   - Click lift  → status, wait time, lift type popup
//   - Click trail → difficulty, status, groomed date, snow depth popup
//   - Weather pins at summit / mid / base (temp, wind, new snow)
//   - Color-coded open / closed / groomed / on-hold overlays
//   - All/Open/Groomed filter buttons
//   - Operator-only: settings panel to upload custom map image + set bounds
//
// Usage:
//   <TrailMap resortId={id} token={tok} height="600px" readOnly={false} />
//   — loaded via dynamic import with { ssr: false }

import { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CustomMap {
  imageUrl: string;
  bounds:   [[number, number], [number, number]]; // [[s,w],[n,e]]
  opacity:  number;
}

interface MapData {
  resort: {
    id:        string;
    name:      string;
    plan:      string;
    customMap: CustomMap | null;
    mountain:  {
      latitude:    number; longitude:  number;
      baseElevFt:  number; summitElevFt: number; midElevFt: number;
    };
  };
  bbox: [number, number, number, number];
  layers: {
    trails:      GeoJSONCollection;
    lifts:       GeoJSONCollection;
    liftPoints:  GeoJSONCollection;
    weatherPins: GeoJSONCollection;
  };
  summary: {
    lifts:  { total: number; open: number; on_hold: number; closed: number; osmMatched: number };
    trails: { total: number; open: number; groomed: number; closed: number; osmRuns: number };
    osmSource: string;
    osmFetchedAt: string;
  };
}

interface GeoJSONCollection { type: 'FeatureCollection'; features: any[] }

interface TrailMapProps {
  resortId:     string;
  token:        string;           // empty string for public/guest pages
  height?:      string;
  showWeather?: boolean;
  readOnly?:    boolean;          // true = guest view, hides operator controls
}

// ─── Color constants ──────────────────────────────────────────────────────────

const TRAIL_COLORS: Record<string, string> = {
  green:        '#22c55e',
  blue:         '#60a5fa',
  black:        '#e2e8f0',
  double_black: '#f1f5f9',
  terrain_park: '#fb923c',
  backcountry:  '#fbbf24',
};

const LIFT_COLORS: Record<string, string> = {
  open:      '#10b981',
  on_hold:   '#f59e0b',
  scheduled: '#3b82f6',
  closed:    '#ef4444',
  unknown:   '#6b7280',
};

const ZONE_COLORS: Record<string, string> = {
  summit: '#38bdf8', mid: '#818cf8', base: '#34d399',
};

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function liftPopupHTML(p: any): string {
  const color = LIFT_COLORS[p.status] || '#6b7280';
  return `
    <div style="font-family:system-ui,sans-serif;min-width:190px;">
      <div style="font-weight:700;font-size:14px;color:#f1f5f9;margin-bottom:6px;">
        🚡 ${p.name || 'Unnamed Lift'}
      </div>
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px;">
        <span style="width:9px;height:9px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0;"></span>
        <span style="color:#cbd5e1;font-size:13px;text-transform:capitalize;">
          ${p.status === 'on_hold' ? '⚠ Wind Hold' : (p.statusLabel || p.status || 'Unknown')}
        </span>
      </div>
      ${p.waitMinutes != null && p.status === 'open'
        ? `<div style="color:#fbbf24;font-size:13px;font-weight:600;margin-bottom:4px;">⏱ ${p.waitMinutes} min wait</div>` : ''}
      ${p.aerialwayType
        ? `<div style="color:#64748b;font-size:11px;text-transform:capitalize;">${p.aerialwayType.replace(/_/g,' ')}</div>` : ''}
      ${p.capacity
        ? `<div style="color:#64748b;font-size:11px;">Capacity: ${p.capacity}/hr</div>` : ''}
    </div>`;
}

function trailPopupHTML(p: any): string {
  const isClosed = p.status === 'closed';
  const color = isClosed ? '#ef4444' : (TRAIL_COLORS[p.appDifficulty] || '#94a3b8');
  const icons: Record<string, string> = {
    green:'●', blue:'◆', black:'◆', double_black:'◆◆', terrain_park:'▲', backcountry:'⬡',
  };
  return `
    <div style="font-family:system-ui,sans-serif;min-width:190px;">
      <div style="font-weight:700;font-size:14px;color:#f1f5f9;margin-bottom:6px;">
        <span style="color:${color}">${icons[p.appDifficulty] || '●'}</span>
        ${p.name || 'Unnamed Trail'}
      </div>
      <div style="color:#cbd5e1;font-size:13px;margin-bottom:4px;text-transform:capitalize;">
        ${p.status || 'Unknown status'} · ${(p.appDifficulty || '').replace('_',' ')}
      </div>
      ${p.snowDepthIn
        ? `<div style="color:#7dd3fc;font-size:12px;">❄ Snow depth: ${p.snowDepthIn}"</div>` : ''}
      ${p.status === 'groomed' && p.groomedAt
        ? `<div style="color:#5eead4;font-size:12px;margin-top:3px;">🎿 Groomed: ${new Date(p.groomedAt).toLocaleDateString()}</div>` : ''}
      ${p.grooming
        ? `<div style="color:#64748b;font-size:11px;margin-top:2px;text-transform:capitalize;">Grooming: ${p.grooming.replace(/_/g,' ')}</div>` : ''}
    </div>`;
}

function weatherPinHTML(p: any): string {
  const color = ZONE_COLORS[p.zone] || '#94a3b8';
  const labels: Record<string, string> = { summit: '🏔️ Summit', mid: '⛷️ Mid Mountain', base: '🏠 Base' };
  const windHold = (p.windMph ?? 0) > 35;
  return `
    <div style="
      background:rgba(15,23,42,0.95);border:2px solid ${color};border-radius:10px;
      padding:8px 11px;font-family:system-ui,sans-serif;min-width:148px;
      box-shadow:0 4px 20px rgba(0,0,0,0.65);
    ">
      <div style="color:${color};font-weight:700;font-size:11px;margin-bottom:4px;">
        ${labels[p.zone] || p.zone}
        ${windHold ? `<span style="background:#f59e0b;color:#000;padding:1px 4px;border-radius:3px;font-size:9px;margin-left:4px;">⚠ WIND</span>` : ''}
      </div>
      <div style="color:#f1f5f9;font-size:19px;font-weight:700;">${p.tempF?.toFixed(0) ?? '--'}°F</div>
      <div style="color:#94a3b8;font-size:11px;">${(p.elevFt||0).toLocaleString()} ft · Feels ${p.feelsLikeF?.toFixed(0) ?? '--'}°</div>
      <div style="margin-top:5px;display:grid;grid-template-columns:1fr 1fr;gap:3px;">
        ${[
          { label:'WIND',    val:`${p.windMph?.toFixed(0) ?? '--'} mph ${p.windDir||''}`, hi: windHold },
          { label:'NEW SNOW',val:`${p.snowfall24hIn?.toFixed(1) ?? '0'}"`,                 hi: false },
          { label:'DEPTH',   val:`${p.snowDepthIn?.toFixed(0)   ?? '--'}"`,                 hi: false },
          { label:'VIZ',     val:`${p.visibilityMi?.toFixed(1)  ?? '--'} mi`,               hi: false },
        ].map(r => `
          <div style="background:#1e293b;border-radius:4px;padding:3px 5px;">
            <div style="color:#475569;font-size:9px;">${r.label}</div>
            <div style="color:${r.hi ? '#f59e0b' : '#f1f5f9'};font-size:11px;font-weight:600;">${r.val}</div>
          </div>`).join('')}
      </div>
      <div style="color:#475569;font-size:10px;margin-top:3px;text-transform:capitalize;">${p.conditionDesc||''}</div>
    </div>`;
}

// ─── Settings Panel (operator-only) ──────────────────────────────────────────

interface SettingsPanelProps {
  resortId:     string;
  token:        string;
  currentMap:   CustomMap | null;
  suggestedBounds: [[number, number], [number, number]] | null;
  onSave:       (customMap: CustomMap | null) => void;
  onClose:      () => void;
}

function MapSettingsPanel({ resortId, token, currentMap, suggestedBounds, onSave, onClose }: SettingsPanelProps) {
  const [imageUrl, setImageUrl]   = useState(currentMap?.imageUrl || '');
  const [southLat, setSouthLat]   = useState(currentMap?.bounds?.[0][0]?.toString() || suggestedBounds?.[0][0]?.toString() || '');
  const [westLon,  setWestLon]    = useState(currentMap?.bounds?.[0][1]?.toString() || suggestedBounds?.[0][1]?.toString() || '');
  const [northLat, setNorthLat]   = useState(currentMap?.bounds?.[1][0]?.toString() || suggestedBounds?.[1][0]?.toString() || '');
  const [eastLon,  setEastLon]    = useState(currentMap?.bounds?.[1][1]?.toString() || suggestedBounds?.[1][1]?.toString() || '');
  const [opacity,  setOpacity]    = useState(currentMap?.opacity?.toString() || '0.85');
  const [saving,   setSaving]     = useState(false);
  const [clearing, setClearing]   = useState(false);
  const [error,    setError]      = useState('');

  async function handleSave() {
    if (!imageUrl) { setError('Image URL is required'); return; }
    const s = parseFloat(southLat), w = parseFloat(westLon);
    const n = parseFloat(northLat), e = parseFloat(eastLon);
    if ([s, w, n, e].some(isNaN)) { setError('All four coordinates are required'); return; }
    if (n <= s) { setError('North latitude must be greater than south latitude'); return; }
    if (e <= w) { setError('East longitude must be greater than west longitude'); return; }

    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/resort/${resortId}/map-settings`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customMapImageUrl: imageUrl,
          customMapBounds: [[s, w], [n, e]],
          customMapOpacity: parseFloat(opacity) || 0.85,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSave(data.data?.customMap);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    setClearing(true);
    try {
      await fetch(`/api/resort/${resortId}/map-settings`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      onSave(null);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="absolute inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-bold text-base">Custom Trail Map</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-xl leading-none">×</button>
        </div>

        <p className="text-gray-400 text-sm mb-5 leading-relaxed">
          Upload your official trail map image to Supabase Storage or any public CDN, then paste the URL here.
          OSM trail/lift status lines will be drawn on top automatically.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-gray-400 text-xs mb-1.5 font-medium">Image URL <span className="text-red-400">*</span></label>
            <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://…/trail-map.png"
              className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:border-sky-500 placeholder-gray-600" />
            <p className="text-gray-600 text-xs mt-1">PNG, JPEG, or WebP. Must be publicly accessible (CORS-friendly).</p>
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5 font-medium">Geographic Bounds <span className="text-red-400">*</span></label>
            <p className="text-gray-600 text-xs mb-2">
              The lat/lon corners of your image. Use <a href="https://epsg.io/map" target="_blank" rel="noopener" className="text-sky-500 hover:underline">epsg.io/map</a> or
              Google Maps to find coordinates.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'South Lat (bottom)', val: southLat, set: setSouthLat, placeholder: '39.55' },
                { label: 'West Lon (left)',     val: westLon,  set: setWestLon,  placeholder: '-106.40' },
                { label: 'North Lat (top)',      val: northLat, set: setNorthLat, placeholder: '39.65' },
                { label: 'East Lon (right)',     val: eastLon,  set: setEastLon,  placeholder: '-106.30' },
              ].map(f => (
                <div key={f.label}>
                  <p className="text-gray-500 text-[10px] mb-1">{f.label}</p>
                  <input value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                    className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-sky-500 placeholder-gray-600" />
                </div>
              ))}
            </div>
            {suggestedBounds && !currentMap && (
              <button
                onClick={() => { setSouthLat(suggestedBounds[0][0].toString()); setWestLon(suggestedBounds[0][1].toString()); setNorthLat(suggestedBounds[1][0].toString()); setEastLon(suggestedBounds[1][1].toString()); }}
                className="mt-2 text-sky-400 hover:text-sky-300 text-xs underline"
              >
                Use suggested bounds ({suggestedBounds[0][0].toFixed(3)}, {suggestedBounds[0][1].toFixed(3)} → {suggestedBounds[1][0].toFixed(3)}, {suggestedBounds[1][1].toFixed(3)})
              </button>
            )}
          </div>

          <div>
            <label className="block text-gray-400 text-xs mb-1.5 font-medium">
              Opacity: {Math.round(parseFloat(opacity || '0.85') * 100)}%
            </label>
            <input type="range" min="0.1" max="1" step="0.05" value={opacity}
              onChange={e => setOpacity(e.target.value)}
              className="w-full accent-sky-500" />
            <div className="flex justify-between text-gray-600 text-xs mt-0.5">
              <span>Transparent</span>
              <span>Opaque</span>
            </div>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} disabled={saving}
            className="flex-1 bg-sky-600 hover:bg-sky-700 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors">
            {saving ? 'Saving…' : '✓ Save Map'}
          </button>
          {currentMap && (
            <button onClick={handleClear} disabled={clearing}
              className="bg-red-950 hover:bg-red-900 border border-red-800 text-red-400 text-sm px-4 py-2.5 rounded-xl transition-colors">
              {clearing ? '…' : 'Remove'}
            </button>
          )}
          <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2.5 rounded-xl transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrailMap({ resortId, token, height = '600px', showWeather = true, readOnly = false }: TrailMapProps) {
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstance    = useRef<any>(null);
  const layerRefs      = useRef<{ trails?: any; lifts?: any; liftPoints?: any; weather?: any; customImage?: any }>({});
  const [mapData, setMapData]           = useState<MapData | null>(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'groomed'>('all');
  const [showSettings, setShowSettings] = useState(false);
  const [customMap, setCustomMap]       = useState<CustomMap | null>(null);
  const [suggestedBounds, setSuggestedBounds] = useState<[[number,number],[number,number]] | null>(null);
  const [mapMode, setMapMode]           = useState<'osm' | 'custom'>('osm');

  const fetchMapData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`/api/resort/${resortId}/map`, { headers });
if (!res.ok) throw new Error(`Map API ${res.status}`);
const json = await res.json();
const d = json.data;

// Transform API response to component's expected shape
const bbox = d.map?.bbox ?? [0,0,0,0];
const runs = d.map?.runs ?? { type: 'FeatureCollection', features: [] };
const lifts = d.map?.lifts ?? { type: 'FeatureCollection', features: [] };

// Build weather pins GeoJSON from weatherZones
const weatherPins = {
  type: 'FeatureCollection' as const,
  features: (d.weatherZones ?? []).map((z: any) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [
        z.zone === 'base'    ? d.resort.mountain?.longitude ?? 0 :
        z.zone === 'summit'  ? d.resort.mountain?.longitude ?? 0 :
                               d.resort.mountain?.longitude ?? 0,
        z.zone === 'base'    ? d.resort.mountain?.latitude ?? 0 :
        z.zone === 'summit'  ? d.resort.mountain?.latitude ?? 0 :
                               d.resort.mountain?.latitude ?? 0,
      ],
    },
    properties: { ...z },
  })),
};

const transformed: MapData = {
  resort: {
    ...d.resort,
    plan: d.resort.plan ?? 'starter',
   customMap: (d.overlays?.type === 'customMap' || d.overlays?.type === 'skimapImage') ? {
  imageUrl: d.overlays.imageUrl,
  bounds: d.overlays.bounds ?? null,
  opacity: d.overlays.opacity ?? 0.85,
} : null,
    mountain: {
      latitude: d.resort.mountain?.latitude ?? 42.73,
      longitude: d.resort.mountain?.longitude ?? -83.38,
      baseElevFt: d.resort.baseElevFt ?? 900,
      summitElevFt: d.resort.summitElevFt ?? 1100,
      midElevFt: d.resort.midElevFt ?? 1000,
    },
  },
  bbox,
  layers: {
    trails: runs,
    lifts: lifts,
    liftPoints: { type: 'FeatureCollection', features: [] },
    weatherPins,
  },
  summary: {
    lifts:  { total: d.lifts?.length ?? 0, open: 0, on_hold: 0, closed: 0, osmMatched: 0 },
    trails: { total: d.trails?.length ?? 0, open: 0, groomed: 0, closed: 0, osmRuns: runs.features.length },
    osmSource: d.map?.source ?? 'osm',
    osmFetchedAt: d.map?.fetchedAt ?? new Date().toISOString(),
  },
};

setMapData(transformed);
if (transformed.resort.customMap) {
  setCustomMap(transformed.resort.customMap);
  setMapMode('custom');
}
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [resortId, token]);

  // Fetch suggested bounds for settings panel
  const fetchSettings = useCallback(async () => {
    if (!token || readOnly) return;
    try {
      const res = await fetch(`/api/resort/${resortId}/map-settings`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.data?.suggestedBounds) setSuggestedBounds(json.data.suggestedBounds);
      }
    } catch { /* ignore */ }
  }, [resortId, token, readOnly]);

  useEffect(() => { fetchMapData(); fetchSettings(); }, [fetchMapData, fetchSettings]);

  // Init map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current || !mapData) return;
    import('leaflet').then(L => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl:       'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl:     'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });
      const { mountain } = mapData.resort;
      const map = L.map(mapRef.current!, {
        center: [mountain.latitude, mountain.longitude],
        zoom: 13, zoomControl: true, scrollWheelZoom: true,
      });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { attribution: 'Imagery © Esri', maxZoom: 18 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        { attribution: '', opacity: 0.55, maxZoom: 18 }).addTo(map);
      mapInstance.current = map;
      renderLayers(L, map, mapData, activeFilter, customMap, mapMode);
    });
    return () => {
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  }, [mapData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-render on filter / mode / customMap change
  useEffect(() => {
    if (!mapInstance.current || !mapData) return;
    import('leaflet').then(L => renderLayers(L, mapInstance.current, mapData, activeFilter, customMap, mapMode));
  }, [activeFilter, mapData, customMap, mapMode]);

  function renderLayers(L: any, map: any, data: MapData, filter: string, cm: CustomMap | null, mode: string) {
    // Clear all data layers (preserve base tiles)
    Object.values(layerRefs.current).forEach(layer => layer && map.removeLayer(layer));

    // ── Custom image overlay ──────────────────────────────────────────────────
    if (cm && mode === 'custom') {
      const [[s, w], [n, e]] = cm.bounds;
      layerRefs.current.customImage = L.imageOverlay(
        cm.imageUrl,
        [[s, w], [n, e]],
        { opacity: cm.opacity, interactive: false, zIndex: 200 }
      ).addTo(map);
      // Fit map to image bounds
      map.fitBounds([[s, w], [n, e]], { padding: [10, 10] });
    }

    // ── Trail lines (OSM geometry + live status colors) ───────────────────────
    const trailFeatures = data.layers.trails.features.filter(f => {
      if (filter === 'open')    return f.properties.status === 'open' || f.properties.status === 'groomed';
      if (filter === 'groomed') return f.properties.status === 'groomed';
      return true;
    });

    layerRefs.current.trails = L.geoJSON(
      { type: 'FeatureCollection', features: trailFeatures },
      {
        style: (f: any) => ({
          color:     f.properties.trailColor || '#6b7280',
          weight:    f.properties.strokeWeight || 3,
          opacity:   f.properties.status === 'closed' ? 0.45 : 0.92,
          dashArray: f.properties.dashArray || null,
          lineCap: 'round', lineJoin: 'round',
        }),
        onEachFeature: (f: any, layer: any) => {
          layer.bindPopup(trailPopupHTML(f.properties), { className: 'powderiq-popup', maxWidth: 220 });
          layer.on('mouseover', () => layer.setStyle({ weight: 5, opacity: 1 }));
          layer.on('mouseout',  () => layer.setStyle({
            weight: f.properties.strokeWeight || 3,
            opacity: f.properties.status === 'closed' ? 0.45 : 0.92,
          }));
        },
      }
    ).addTo(map);

    // ── Lift lines ────────────────────────────────────────────────────────────
    layerRefs.current.lifts = L.geoJSON(data.layers.lifts, {
      style: (f: any) => ({
        color:   f.properties.statusColor || '#6b7280',
        weight:  5,
        opacity: f.properties.status === 'closed' ? 0.3 : 0.95,
      }),
      onEachFeature: (f: any, layer: any) => {
        layer.bindPopup(liftPopupHTML(f.properties), { className: 'powderiq-popup', maxWidth: 220 });
        layer.on('mouseover', () => layer.setStyle({ weight: 8 }));
        layer.on('mouseout',  () => layer.setStyle({ weight: 5 }));
      },
    }).addTo(map);

    // ── Unmatched lifts as dot markers ────────────────────────────────────────
    layerRefs.current.liftPoints = L.geoJSON(data.layers.liftPoints, {
      pointToLayer: (f: any, latlng: any) => {
        const color = LIFT_COLORS[f.properties.status] || '#6b7280';
        return L.marker(latlng, {
          icon: L.divIcon({
            html: `<div style="background:${color};border:2px solid rgba(255,255,255,0.7);border-radius:50%;width:13px;height:13px;box-shadow:0 2px 8px rgba(0,0,0,0.5);"></div>`,
            className: '', iconSize: [13, 13], iconAnchor: [6, 6],
          }),
        });
      },
      onEachFeature: (f: any, layer: any) => {
        layer.bindPopup(liftPopupHTML(f.properties), { className: 'powderiq-popup' });
      },
    }).addTo(map);

    // ── Weather pins ──────────────────────────────────────────────────────────
    if (showWeather && data.layers.weatherPins.features.length > 0) {
      layerRefs.current.weather = L.geoJSON(data.layers.weatherPins, {
        pointToLayer: (f: any, latlng: any) => L.marker(latlng, {
          icon: L.divIcon({ html: weatherPinHTML(f.properties), className: '', iconAnchor: [74, 10] }),
          interactive: false, zIndexOffset: 1000,
        }),
      }).addTo(map);
    }
  }

  function handleSettingsSave(newCustomMap: CustomMap | null) {
    setCustomMap(newCustomMap);
    setMapMode(newCustomMap ? 'custom' : 'osm');
    setShowSettings(false);
    // Re-fetch map data to get updated resort.customMap
    fetchMapData();
  }

  // ── Loading / error states ────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center bg-gray-900 rounded-2xl border border-gray-800" style={{ height }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Loading trail map…</p>
        <p className="text-gray-600 text-xs mt-1">Fetching OSM geometry from OpenStreetMap</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center bg-gray-900 rounded-2xl border border-red-900/30" style={{ height }}>
      <div className="text-center px-4">
        <p className="text-red-400 font-medium mb-2">Map unavailable</p>
        <p className="text-gray-500 text-sm">{error}</p>
        <button onClick={fetchMapData} className="mt-3 text-sky-400 text-sm hover:text-sky-300">Retry</button>
      </div>
    </div>
  );

  const { summary } = mapData!;
  const liftPct  = summary?.lifts.total  ? Math.round((summary.lifts.open  / summary.lifts.total)  * 100) : 0;
  const trailPct = summary?.trails.total ? Math.round(((summary.trails.open + summary.trails.groomed) / summary.trails.total) * 100) : 0;
  const hasCustomMap = !!customMap;

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden border border-gray-700/60" style={{ position: 'relative' }}>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" />
      <style>{`
        .powderiq-popup .leaflet-popup-content-wrapper {
          background:#0f172a !important; border:1px solid #334155 !important;
          border-radius:10px !important; box-shadow:0 8px 32px rgba(0,0,0,0.6) !important; padding:0 !important;
        }
        .powderiq-popup .leaflet-popup-content { margin:10px 12px !important; color:#f1f5f9 !important; }
        .powderiq-popup .leaflet-popup-tip { background:#0f172a !important; }
        .powderiq-popup .leaflet-popup-close-button { color:#64748b !important; }
      `}</style>

      {/* ── Toolbar ── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">

          {/* Base mode toggle — only shown when custom map is set */}
          {hasCustomMap && (
            <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
              {[{ key:'osm', label:'Satellite' }, { key:'custom', label:'Trail Map' }].map(m => (
                <button key={m.key} onClick={() => setMapMode(m.key as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    mapMode === m.key ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-gray-200'
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          )}

          {/* Status filter */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
            {([{ key:'all',label:'All' },{ key:'open',label:'Open' },{ key:'groomed',label:'Groomed' }] as const).map(f => (
              <button key={f.key} onClick={() => setActiveFilter(f.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeFilter === f.key ? 'bg-sky-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>
              <span className="text-emerald-400 font-semibold">{summary?.lifts.open ?? 0}</span>/{summary?.lifts.total ?? 0} lifts
              {(summary?.lifts.on_hold ?? 0) > 0 && <span className="text-amber-400 ml-1">({summary?.lifts.on_hold} hold)</span>}
            </span>
            <span>
              <span className="text-sky-400 font-semibold">{(summary?.trails.open ?? 0) + (summary?.trails.groomed ?? 0)}</span>/{summary?.trails.total ?? 0} trails
              {(summary?.trails.groomed ?? 0) > 0 && <span className="text-teal-400 ml-1">({summary?.trails.groomed} groomed)</span>}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Progress bars */}
          <div className="hidden sm:flex gap-3 items-center">
            {[
              { label:'Lifts',  pct: liftPct,  color:'bg-emerald-500' },
              { label:'Trails', pct: trailPct, color:'bg-sky-500'     },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-1.5">
                <span className="text-gray-600 text-xs">{r.label}</span>
                <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full`} style={{ width:`${r.pct}%` }} />
                </div>
                <span className={`text-xs font-medium tabular-nums ${r.color.replace('bg-','text-')}`}>{r.pct}%</span>
              </div>
            ))}
          </div>

          {/* Operator: settings gear */}
          {!readOnly && (
            <button onClick={() => setShowSettings(true)}
              title={hasCustomMap ? 'Custom trail map active — click to edit' : 'Upload custom trail map'}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                hasCustomMap
                  ? 'border-sky-600 text-sky-400 bg-sky-950/30 hover:bg-sky-950/50'
                  : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'
              }`}>
              {hasCustomMap ? '🗺 Custom Map ✓' : '⚙ Map Settings'}
            </button>
          )}
        </div>
      </div>

      {/* ── Map canvas ── */}
      <div className="relative" style={{ height }}>
        <div ref={mapRef} className="w-full h-full" />

        {/* Settings panel modal */}
        {showSettings && !readOnly && (
          <MapSettingsPanel
            resortId={mapData!.resort.id}
            token={token}
            currentMap={customMap}
            suggestedBounds={suggestedBounds}
            onSave={handleSettingsSave}
            onClose={() => setShowSettings(false)}
          />
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-[1000] bg-gray-950/92 backdrop-blur-sm border border-gray-700/60 rounded-xl p-3 text-xs space-y-1.5">
          <p className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-1">Trails</p>
          {[
            { color: TRAIL_COLORS.green,        label: 'Green · Beginner'    },
            { color: TRAIL_COLORS.blue,         label: 'Blue · Intermediate' },
            { color: TRAIL_COLORS.black,        label: 'Black Diamond'       },
            { color: TRAIL_COLORS.double_black, label: 'Double Black'        },
            { color: TRAIL_COLORS.terrain_park, label: 'Terrain Park'        },
            { color: '#ef4444',                 label: 'Closed (any)'        },
          ].map(d => (
            <div key={d.label} className="flex items-center gap-2">
              <div className="w-5 h-1.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
              <span className="text-gray-400">{d.label}</span>
            </div>
          ))}
          <div className="border-t border-gray-700/60 pt-1.5 mt-1">
            <p className="text-gray-500 font-semibold uppercase tracking-wider text-[10px] mb-1">Lifts</p>
            {[
              { color: LIFT_COLORS.open,      label: 'Open'       },
              { color: LIFT_COLORS.on_hold,   label: 'Wind Hold'  },
              { color: LIFT_COLORS.scheduled, label: 'Scheduled'  },
              { color: LIFT_COLORS.closed,    label: 'Closed'     },
            ].map(d => (
              <div key={d.label} className="flex items-center gap-2">
                <div className="w-5 h-1.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                <span className="text-gray-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* OSM / custom mode badge */}
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col items-end gap-1.5 pointer-events-none">
          {hasCustomMap && mapMode === 'custom' && (
            <div className="bg-sky-950/80 border border-sky-700/40 rounded-lg px-2 py-1 text-[10px] text-sky-400">
              Official Trail Map
            </div>
          )}
          <div className="bg-gray-950/80 border border-gray-700/60 rounded-lg px-2 py-1 text-[10px] text-gray-500">
            {summary?.osmSource === 'osm' ? 'Geometry © OpenStreetMap' : 'Status from PowderIQ'}
          </div>
        </div>

        {/* No OSM data warning */}
        {summary?.osmSource === 'empty' && !hasCustomMap && (
          <div className="absolute top-4 right-4 z-[1000] bg-amber-950/80 border border-amber-700/40 rounded-xl px-3 py-2 text-xs text-amber-400 max-w-[220px]">
            <p className="font-semibold">No trail geometry found</p>
            <p className="text-amber-500 text-[10px] mt-0.5">
              {readOnly
                ? 'This resort has not configured their trail map yet.'
                : 'Upload a custom trail map in ⚙ Map Settings to show trail shapes.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
