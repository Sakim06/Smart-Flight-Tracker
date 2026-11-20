import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Plane,
  RefreshCw,
  Search,
  AlertTriangle,
  Compass,
  Gauge,
  Navigation,
  MapPin,
  Clock,
  ZoomIn,
  ZoomOut,
  Crosshair,
  X,
  ArrowUpRight,
  Radio,
  ShieldAlert,
  Globe,
  Route,
  Activity,
} from 'lucide-react';
import {
  OpenSkyAircraft,
  SimulatedAircraftState,
  SimulatedFlightStatus,
  TrackingMode,
} from '../types/flight';
import { fetchOpenSkyStates, MapBoundingBox } from '../services/liveAviationService';
import {
  getSimulatedAircraftSnapshot,
  getSimulatedFlightPath,
  SIMULATED_AIRCRAFT_COUNT,
} from '../services/aircraftSimulationEngine';

interface MapRegionPreset {
  id: string;
  label: string;
  center: [number, number];
  zoom: number;
}

const REGION_PRESETS: MapRegionPreset[] = [
  { id: 'global', label: 'Global View', center: [20, 15], zoom: 2 },
  { id: 'south-asia', label: 'South Asia (DAC)', center: [23.8103, 90.4125], zoom: 6 },
  { id: 'middle-east', label: 'Middle East (DXB)', center: [25.2532, 55.3657], zoom: 6 },
  { id: 'europe', label: 'Europe', center: [49.0, 9.0], zoom: 5 },
  { id: 'north-america', label: 'North America', center: [39.5, -98.35], zoom: 4 },
  { id: 'east-asia', label: 'East Asia', center: [32.0, 121.0], zoom: 5 },
  { id: 'south-america', label: 'South America', center: [-15.0, -58.0], zoom: 4 },
  { id: 'africa', label: 'Africa', center: [2.0, 20.0], zoom: 4 },
  { id: 'oceania', label: 'Oceania', center: [-26.0, 140.0], zoom: 4 },
];

const SIM_POSITION_INTERVAL_MS = 120;
const SIM_UI_SYNC_INTERVAL_MS = 1000;

export interface MapFocusPoint {
  latitude: number;
  longitude: number;
  label: string;
}

interface LiveFlightMapProps {
  onLookupFlight?: (flightCode: string) => void;
  focusPoint?: MapFocusPoint | null;
}

interface TrackedSimMarker {
  marker: L.Marker;
  onGround: boolean;
  isSelected: boolean;
}

function getCompassDirection(deg: number | null): string {
  if (deg === null || !Number.isFinite(deg)) return 'N/A';
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
  return dirs[index];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createAirplaneDivIcon(
  headingDeg: number | null,
  onGround: boolean,
  isSelected: boolean
): L.DivIcon {
  const rotation = typeof headingDeg === 'number' && Number.isFinite(headingDeg) ? headingDeg : 0;
  const fillColor = isSelected ? '#DC2626' : onGround ? '#64748B' : '#2563EB';
  const strokeColor = '#FFFFFF';
  const size = isSelected ? 30 : 22;
  const ringMarkup = isSelected
    ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid rgba(220,38,38,0.45);background:rgba(220,38,38,0.12);"></span>`
    : '';

  return L.divIcon({
    className: 'opensky-plane-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;">
        ${ringMarkup}
        <svg
          data-plane-svg="true"
          width="${size}"
          height="${size}"
          viewBox="0 0 24 24"
          style="transform:rotate(${rotation.toFixed(1)}deg);filter:drop-shadow(0 1px 2px rgba(15,23,42,0.45));transition:transform 0.14s linear;"
          aria-hidden="true"
        >
          <path
            d="M12 2L14.2 8.8L21 12.2L21 14.3L14.2 12.4L14 17.5L16.8 19.6L16.8 21.3L12 20L7.2 21.3L7.2 19.6L10 17.5L9.8 12.4L3 14.3L3 12.2L9.8 8.8L12 2Z"
            fill="${fillColor}"
            stroke="${strokeColor}"
            stroke-width="1.1"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    `,
  });
}

function updateMarkerRotationInPlace(marker: L.Marker, headingDeg: number): void {
  const el = marker.getElement();
  if (!el) return;
  const svg = el.querySelector('svg[data-plane-svg="true"]') as SVGElement | null;
  if (svg) {
    svg.style.transform = `rotate(${headingDeg.toFixed(1)}deg)`;
  }
}

function buildRealPopupHtml(ac: OpenSkyAircraft): string {
  const title = escapeHtml(ac.callsign || ac.icao24.toUpperCase());
  const country = escapeHtml(ac.originCountry || 'Unknown');
  const altStr = ac.altitudeFt !== null ? `${ac.altitudeFt.toLocaleString()} ft` : 'N/A';
  const spdStr = ac.velocityKts !== null ? `${ac.velocityKts} kts` : 'N/A';
  const hdgStr = ac.trueTrack !== null ? `${Math.round(ac.trueTrack)}° ${getCompassDirection(ac.trueTrack)}` : 'N/A';
  const stateLabel = ac.onGround ? 'On Ground' : 'Airborne';

  return `
    <div style="min-width:175px;font-family:'Plus Jakarta Sans',sans-serif;color:#0F172A;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:4px;">
        <strong style="font-family:'JetBrains Mono',monospace;font-size:13px;">${title}</strong>
        <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:${ac.onGround ? '#F1F5F9' : '#EFF6FF'};color:${ac.onGround ? '#475569' : '#1D4ED8'};">${stateLabel}</span>
      </div>
      <div style="font-size:11px;color:#475569;margin-bottom:6px;">${country} · ICAO24 ${escapeHtml(ac.icao24.toUpperCase())}</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;font-family:'JetBrains Mono',monospace;">
        <div><span style="color:#64748B;">ALT</span> ${altStr}</div>
        <div><span style="color:#64748B;">SPD</span> ${spdStr}</div>
        <div><span style="color:#64748B;">HDG</span> ${hdgStr}</div>
        <div><span style="color:#64748B;">POS</span> ${ac.latitude.toFixed(2)}, ${ac.longitude.toFixed(2)}</div>
      </div>
    </div>
  `;
}

function buildSimPopupHtml(ac: SimulatedAircraftState): string {
  const badgeBg = ac.onGround ? '#F1F5F9' : '#EFF6FF';
  const badgeColor = ac.onGround ? '#475569' : '#1D4ED8';

  return `
    <div style="min-width:200px;font-family:'Plus Jakarta Sans',sans-serif;color:#0F172A;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:3px;">
        <strong style="font-family:'JetBrains Mono',monospace;font-size:13px;">${escapeHtml(ac.flightNumber)}</strong>
        <span style="font-size:10px;font-weight:700;padding:1px 6px;border-radius:4px;background:${badgeBg};color:${badgeColor};">${escapeHtml(ac.flightStatus)}</span>
      </div>
      <div style="font-size:11px;font-weight:700;color:#1E293B;margin-bottom:2px;">
        ${escapeHtml(ac.origin.iata)} → ${escapeHtml(ac.destination.iata)} · ${escapeHtml(ac.aircraftModel)}
      </div>
      <div style="font-size:10px;color:#64748B;margin-bottom:6px;">
        ${escapeHtml(ac.callsign)} · ${escapeHtml(ac.registration)}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px;font-size:11px;font-family:'JetBrains Mono',monospace;">
        <div><span style="color:#64748B;">ALT</span> ${ac.altitudeFt.toLocaleString()} ft</div>
        <div><span style="color:#64748B;">SPD</span> ${ac.groundSpeedKts} kts</div>
        <div><span style="color:#64748B;">HDG</span> ${Math.round(ac.headingDeg)}° ${escapeHtml(ac.compassDirection)}</div>
        <div><span style="color:#64748B;">PRG</span> ${ac.progressPercent}%</div>
      </div>
      <div style="margin-top:6px;padding-top:4px;border-top:1px solid #E2E8F0;font-size:9px;font-weight:700;letter-spacing:0.04em;color:#B45309;text-transform:uppercase;">
        Simulated · Fictional Data
      </div>
    </div>
  `;
}

function getSimStatusBadgeClass(status: SimulatedFlightStatus): string {
  switch (status) {
    case 'Takeoff':
    case 'Climbing':
      return 'bg-sky-600 text-white';
    case 'Cruising':
      return 'bg-blue-600 text-white';
    case 'Descending':
    case 'Approach':
      return 'bg-indigo-600 text-white';
    case 'On Ground':
    default:
      return 'bg-slate-700 text-slate-200';
  }
}

export const LiveFlightMap: React.FC<LiveFlightMapProps> = ({
  onLookupFlight,
  focusPoint,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const realMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const simMarkersRef = useRef<Map<string, TrackedSimMarker>>(new Map());
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const focusMarkerRef = useRef<L.CircleMarker | null>(null);

  // Dual-Mode State (Simulation Mode is Primary Default)
  const [trackingMode, setTrackingMode] = useState<TrackingMode>('simulation');
  const [activeRegionId, setActiveRegionId] = useState<string>('global');
  const [filterText, setFilterText] = useState<string>('');
  const [airborneOnly, setAirborneOnly] = useState<boolean>(false);

  // Simulation Mode State
  const [simAircraft, setSimAircraft] = useState<SimulatedAircraftState[]>(() =>
    getSimulatedAircraftSnapshot(Date.now())
  );
  const [selectedSimId, setSelectedSimId] = useState<string | null>(null);
  const [simUpdatedAt, setSimUpdatedAt] = useState<number>(() => Date.now());

  // Real Tracking Mode (OpenSky Network) State
  const [realAircraft, setRealAircraft] = useState<OpenSkyAircraft[]>([]);
  const [selectedIcao24, setSelectedIcao24] = useState<string | null>(null);
  const [autoRefreshSec, setAutoRefreshSec] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<{ code?: string; message: string } | null>(null);
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [retryCountdown, setRetryCountdown] = useState<number>(0);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [totalInBounds, setTotalInBounds] = useState<number>(0);
  const [remainingCredits, setRemainingCredits] = useState<number | null>(null);
  const [isCachedSnapshot, setIsCachedSnapshot] = useState<boolean>(false);
  const [boundsDirty, setBoundsDirty] = useState<boolean>(false);

  // Refs synced for the requestAnimationFrame simulation loop
  const trackingModeRef = useRef<TrackingMode>(trackingMode);
  const filterTextRef = useRef<string>(filterText);
  const airborneOnlyRef = useRef<boolean>(airborneOnly);
  const selectedSimIdRef = useRef<string | null>(selectedSimId);

  useEffect(() => {
    trackingModeRef.current = trackingMode;
  }, [trackingMode]);

  useEffect(() => {
    filterTextRef.current = filterText;
  }, [filterText]);

  useEffect(() => {
    airborneOnlyRef.current = airborneOnly;
  }, [airborneOnly]);

  useEffect(() => {
    selectedSimIdRef.current = selectedSimId;
  }, [selectedSimId]);

  const getMapBbox = useCallback((): MapBoundingBox | undefined => {
    const map = mapRef.current;
    if (!map) return undefined;
    const b = map.getBounds();
    return {
      lamin: Math.max(-85, b.getSouth()),
      lomin: Math.max(-180, b.getWest()),
      lamax: Math.min(85, b.getNorth()),
      lomax: Math.min(180, b.getEast()),
    };
  }, []);

  const matchesSimFilter = useCallback(
    (ac: SimulatedAircraftState, termRaw: string, onlyAirborne: boolean): boolean => {
      if (onlyAirborne && ac.onGround) return false;
      const term = termRaw.trim().toLowerCase();
      if (!term) return true;
      return (
        ac.flightNumber.toLowerCase().includes(term) ||
        ac.callsign.toLowerCase().includes(term) ||
        ac.aircraftModel.toLowerCase().includes(term) ||
        ac.registration.toLowerCase().includes(term) ||
        ac.airlineName.toLowerCase().includes(term) ||
        ac.origin.iata.toLowerCase().includes(term) ||
        ac.origin.city.toLowerCase().includes(term) ||
        ac.destination.iata.toLowerCase().includes(term) ||
        ac.destination.city.toLowerCase().includes(term)
      );
    },
    []
  );

  const clearRealMarkers = useCallback(() => {
    for (const marker of realMarkersRef.current.values()) {
      marker.remove();
    }
    realMarkersRef.current.clear();
  }, []);

  const clearSimMarkersAndPath = useCallback(() => {
    for (const entry of simMarkersRef.current.values()) {
      entry.marker.remove();
    }
    simMarkersRef.current.clear();
    routeLayerRef.current?.clearLayers();
  }, []);

  const loadAircraftInView = useCallback(
    async (overrideBbox?: MapBoundingBox, forceRefresh = false) => {
      // Strictly never query OpenSky while Simulation Mode is active
      if (trackingModeRef.current !== 'real') return;
      if (retryCountdown > 0) return;

      const bbox = overrideBbox || getMapBbox();
      setIsLoading(true);
      setBoundsDirty(false);

      try {
        const response = await fetchOpenSkyStates(bbox, 350, forceRefresh);
        // Ignore stale responses if user switched back to Simulation Mode while request was in flight
        if (trackingModeRef.current !== 'real') return;

        setIsConfigured(response.configured);
        setLastFetchedAt(response.fetchedAt);
        setRemainingCredits(response.remainingCredits);
        setIsCachedSnapshot(response.cached);

        if (!response.configured) {
          setRealAircraft([]);
          setTotalInBounds(0);
          setErrorBanner({
            code: 'NOT_CONFIGURED',
            message:
              response.error ||
              'OpenSky Network OAuth2 credentials (OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET) are not configured on the server.',
          });
          return;
        }

        if (response.code === 'RATE_LIMITED') {
          const waitSec =
            response.retryAfterSeconds && response.retryAfterSeconds > 0
              ? response.retryAfterSeconds
              : 60;
          setRetryCountdown(waitSec);
          setAutoRefreshSec(0);
          setErrorBanner({
            code: 'RATE_LIMITED',
            message:
              response.error || `OpenSky rate limit reached. Cooldown active (${waitSec}s).`,
          });
          return;
        }

        if (response.error) {
          setRealAircraft([]);
          setTotalInBounds(0);
          setErrorBanner({
            code: response.code,
            message: response.error,
          });
          return;
        }

        setErrorBanner(null);
        setRealAircraft(response.aircraft);
        setTotalInBounds(response.totalInBounds);
      } catch {
        if (trackingModeRef.current !== 'real') return;
        setRealAircraft([]);
        setTotalInBounds(0);
        setErrorBanner({
          code: 'NETWORK_ERROR',
          message: 'Unable to reach the OpenSky backend endpoint. Please try again.',
        });
      } finally {
        if (trackingModeRef.current === 'real') {
          setIsLoading(false);
        }
      }
    },
    [getMapBbox, retryCountdown]
  );

  // Countdown timer for HTTP 429 rate-limit recovery in Real Tracking Mode
  useEffect(() => {
    if (retryCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          setErrorBanner(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryCountdown]);

  // Initialize Leaflet + OpenStreetMap map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = focusPoint
      ? [focusPoint.latitude, focusPoint.longitude]
      : REGION_PRESETS[0].center;
    const initialZoom = focusPoint ? 7 : REGION_PRESETS[0].zoom;

    const map = L.map(mapContainerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      minZoom: 2,
      maxZoom: 15,
      zoomControl: false,
      worldCopyJump: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Smart Flight Tracker',
      maxZoom: 18,
    }).addTo(map);

    L.control.scale({ imperial: true, metric: true, position: 'bottomleft' }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);

    map.on('moveend', () => {
      if (trackingModeRef.current === 'real') {
        setBoundsDirty(true);
      }
    });

    mapRef.current = map;

    return () => {
      clearRealMarkers();
      clearSimMarkersAndPath();
      if (routeLayerRef.current) {
        routeLayerRef.current.remove();
        routeLayerRef.current = null;
      }
      if (focusMarkerRef.current) {
        focusMarkerRef.current.remove();
        focusMarkerRef.current = null;
      }
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Optional external focus point (e.g. from Aviationstack live coordinates)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (focusMarkerRef.current) {
      focusMarkerRef.current.remove();
      focusMarkerRef.current = null;
    }

    if (focusPoint) {
      map.setView([focusPoint.latitude, focusPoint.longitude], 7, { animate: true });
      focusMarkerRef.current = L.circleMarker([focusPoint.latitude, focusPoint.longitude], {
        radius: 10,
        color: '#059669',
        fillColor: '#10B981',
        fillOpacity: 0.3,
        weight: 2,
      })
        .bindPopup(`<strong>${escapeHtml(focusPoint.label)}</strong><br/>Live Position Fix`)
        .addTo(map)
        .openPopup();
    }
  }, [focusPoint]);

  // Helper to sync all simulated markers onto the Leaflet map with zero flicker
  const syncSimMarkers = useCallback(
    (snapshot: SimulatedAircraftState[], refreshOpenPopup: boolean) => {
      const map = mapRef.current;
      if (!map || trackingModeRef.current !== 'simulation') return;

      const currentMarkers = simMarkersRef.current;
      const nextIds = new Set<string>();
      const term = filterTextRef.current;
      const onlyAirborne = airborneOnlyRef.current;
      const currentSelectedId = selectedSimIdRef.current;

      for (const ac of snapshot) {
        if (!matchesSimFilter(ac, term, onlyAirborne)) continue;
        nextIds.add(ac.id);

        const isSelected = ac.id === currentSelectedId;
        const existing = currentMarkers.get(ac.id);

        if (existing) {
          existing.marker.setLatLng([ac.latitude, ac.longitude]);
          if (existing.isSelected !== isSelected || existing.onGround !== ac.onGround) {
            existing.marker.setIcon(createAirplaneDivIcon(ac.headingDeg, ac.onGround, isSelected));
            existing.marker.setZIndexOffset(isSelected ? 1000 : ac.onGround ? 0 : 200);
            existing.isSelected = isSelected;
            existing.onGround = ac.onGround;
          } else {
            updateMarkerRotationInPlace(existing.marker, ac.headingDeg);
          }

          if (refreshOpenPopup && existing.marker.isPopupOpen()) {
            existing.marker.setPopupContent(buildSimPopupHtml(ac));
          }
        } else {
          const icon = createAirplaneDivIcon(ac.headingDeg, ac.onGround, isSelected);
          const marker = L.marker([ac.latitude, ac.longitude], {
            icon,
            zIndexOffset: isSelected ? 1000 : ac.onGround ? 0 : 200,
          });
          marker.bindPopup(buildSimPopupHtml(ac));
          marker.on('click', () => {
            setSelectedSimId(ac.id);
            const latest = getSimulatedAircraftSnapshot(Date.now()).find((item) => item.id === ac.id);
            if (latest) {
              marker.setPopupContent(buildSimPopupHtml(latest));
            }
          });
          marker.addTo(map);
          currentMarkers.set(ac.id, {
            marker,
            onGround: ac.onGround,
            isSelected,
          });
        }
      }

      for (const [id, entry] of currentMarkers.entries()) {
        if (!nextIds.has(id)) {
          entry.marker.remove();
          currentMarkers.delete(id);
        }
      }
    },
    [matchesSimFilter]
  );

  // Simulation Mode Continuous Animation Loop (single clean rAF loop, zero duplicate timers)
  useEffect(() => {
    if (trackingMode !== 'simulation') {
      clearSimMarkersAndPath();
      return;
    }

    // Ensure zero real-mode markers remain on map while in Simulation Mode
    clearRealMarkers();

    let rafId = 0;
    let cancelled = false;
    let lastPosTick = 0;
    let lastUiTick = 0;

    // Immediate render on entering Simulation Mode
    const now0 = Date.now();
    const initialSnapshot = getSimulatedAircraftSnapshot(now0);
    setSimAircraft(initialSnapshot);
    setSimUpdatedAt(now0);
    syncSimMarkers(initialSnapshot, true);

    const frame = (perfNow: number) => {
      if (cancelled || trackingModeRef.current !== 'simulation') return;

      const shouldUpdatePos = perfNow - lastPosTick >= SIM_POSITION_INTERVAL_MS;
      const shouldUpdateUi = perfNow - lastUiTick >= SIM_UI_SYNC_INTERVAL_MS;

      if (shouldUpdatePos || shouldUpdateUi) {
        const nowMs = Date.now();
        const snapshot = getSimulatedAircraftSnapshot(nowMs);
        lastPosTick = perfNow;

        syncSimMarkers(snapshot, shouldUpdateUi);

        if (shouldUpdateUi) {
          lastUiTick = perfNow;
          setSimAircraft(snapshot);
          setSimUpdatedAt(nowMs);
        }
      }

      rafId = window.requestAnimationFrame(frame);
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [trackingMode, clearRealMarkers, clearSimMarkersAndPath, syncSimMarkers]);

  // Immediately re-sync simulation markers whenever filter or selection changes
  useEffect(() => {
    if (trackingMode !== 'simulation') return;
    const snapshot = getSimulatedAircraftSnapshot(Date.now());
    syncSimMarkers(snapshot, true);
  }, [trackingMode, filterText, airborneOnly, selectedSimId, syncSimMarkers]);

  // Filtered aircraft lists (strictly separated per mode)
  const visibleSimAircraft = useMemo(
    () => simAircraft.filter((ac) => matchesSimFilter(ac, filterText, airborneOnly)),
    [simAircraft, filterText, airborneOnly, matchesSimFilter]
  );

  const selectedSimAircraft = useMemo(
    () =>
      trackingMode === 'simulation' && selectedSimId
        ? simAircraft.find((ac) => ac.id === selectedSimId) || null
        : null,
    [trackingMode, simAircraft, selectedSimId]
  );

  // Draw selected simulated aircraft fictional flight path + origin/destination pins
  useEffect(() => {
    const layer = routeLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    if (trackingMode !== 'simulation' || !selectedSimAircraft) {
      return;
    }

    const { completedSegments, remainingSegments } = getSimulatedFlightPath(selectedSimAircraft);

    for (const seg of completedSegments) {
      if (seg.length > 1) {
        L.polyline(seg, {
          color: '#2563EB',
          weight: 2.8,
          opacity: 0.85,
          interactive: false,
        }).addTo(layer);
      }
    }

    for (const seg of remainingSegments) {
      if (seg.length > 1) {
        L.polyline(seg, {
          color: '#475569',
          weight: 2,
          opacity: 0.7,
          dashArray: '6 6',
          interactive: false,
        }).addTo(layer);
      }
    }

    // Origin airport marker
    L.circleMarker(
      [selectedSimAircraft.origin.latitude, selectedSimAircraft.origin.longitude],
      {
        radius: 5.5,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#059669',
        fillOpacity: 1,
        interactive: false,
      }
    )
      .bindTooltip(`${selectedSimAircraft.origin.iata} · Origin`, {
        permanent: true,
        direction: 'top',
        offset: [0, -6],
        className: 'text-[10px] font-bold font-mono',
      })
      .addTo(layer);

    // Destination airport marker
    L.circleMarker(
      [selectedSimAircraft.destination.latitude, selectedSimAircraft.destination.longitude],
      {
        radius: 5.5,
        color: '#FFFFFF',
        weight: 2,
        fillColor: '#DC2626',
        fillOpacity: 1,
        interactive: false,
      }
    )
      .bindTooltip(`${selectedSimAircraft.destination.iata} · Dest`, {
        permanent: true,
        direction: 'top',
        offset: [0, -6],
        className: 'text-[10px] font-bold font-mono',
      })
      .addTo(layer);
  }, [trackingMode, selectedSimAircraft]);

  // Controlled Auto-Refresh respecting rate limits (Real Tracking Mode ONLY)
  useEffect(() => {
    if (trackingMode !== 'real' || autoRefreshSec <= 0 || retryCountdown > 0 || !isConfigured) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadAircraftInView();
    }, autoRefreshSec * 1000);
    return () => window.clearInterval(interval);
  }, [trackingMode, autoRefreshSec, retryCountdown, isConfigured, loadAircraftInView]);

  // Filtered real OpenSky aircraft list
  const visibleRealAircraft = useMemo(() => {
    const term = filterText.trim().toLowerCase();
    return realAircraft.filter((ac) => {
      if (airborneOnly && ac.onGround) return false;
      if (!term) return true;
      return (
        (ac.callsign && ac.callsign.toLowerCase().includes(term)) ||
        ac.icao24.toLowerCase().includes(term) ||
        ac.originCountry.toLowerCase().includes(term)
      );
    });
  }, [realAircraft, filterText, airborneOnly]);

  const selectedRealAircraft = useMemo(
    () =>
      trackingMode === 'real' && selectedIcao24
        ? realAircraft.find((ac) => ac.icao24 === selectedIcao24) || null
        : null,
    [trackingMode, realAircraft, selectedIcao24]
  );

  // Sync real OpenSky rotated airplane markers onto Leaflet map (Real Tracking Mode ONLY)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trackingMode !== 'real') {
      clearRealMarkers();
      return;
    }

    const currentMarkers = realMarkersRef.current;
    const nextIds = new Set<string>();

    for (const ac of visibleRealAircraft) {
      nextIds.add(ac.icao24);
      const isSelected = ac.icao24 === selectedIcao24;
      const icon = createAirplaneDivIcon(ac.trueTrack, ac.onGround, isSelected);
      const existingMarker = currentMarkers.get(ac.icao24);

      if (existingMarker) {
        existingMarker.setLatLng([ac.latitude, ac.longitude]);
        existingMarker.setIcon(icon);
        existingMarker.setZIndexOffset(isSelected ? 1000 : ac.onGround ? 0 : 200);
        existingMarker.setPopupContent(buildRealPopupHtml(ac));
      } else {
        const marker = L.marker([ac.latitude, ac.longitude], {
          icon,
          zIndexOffset: isSelected ? 1000 : ac.onGround ? 0 : 200,
        });
        marker.bindPopup(buildRealPopupHtml(ac));
        marker.on('click', () => {
          setSelectedIcao24(ac.icao24);
        });
        marker.addTo(map);
        currentMarkers.set(ac.icao24, marker);
      }
    }

    for (const [icao24, marker] of currentMarkers.entries()) {
      if (!nextIds.has(icao24)) {
        marker.remove();
        currentMarkers.delete(icao24);
      }
    }
  }, [trackingMode, visibleRealAircraft, selectedIcao24, clearRealMarkers]);

  // Keep Leaflet viewport tiles crisp when side panel opens/closes
  const hasSelectedPanel = Boolean(selectedSimAircraft || selectedRealAircraft);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize({ animate: false });
    }, 180);
    return () => window.clearTimeout(timer);
  }, [hasSelectedPanel]);

  const handleModeSwitch = (nextMode: TrackingMode) => {
    if (nextMode === trackingMode) return;

    setTrackingMode(nextMode);
    trackingModeRef.current = nextMode;

    if (nextMode === 'simulation') {
      clearRealMarkers();
      setSelectedIcao24(null);
      setBoundsDirty(false);
      setIsLoading(false);
    } else {
      clearSimMarkersAndPath();
      setSelectedSimId(null);
      setErrorBanner(null);
      setBoundsDirty(false);

      const map = mapRef.current;
      if (map) {
        // Use a regional bounding box if user switches from world zoom so OpenSky credits stay low
        if (activeRegionId === 'global' || map.getZoom() < 4) {
          const defaultRealRegion = REGION_PRESETS[1]; // South Asia (DAC)
          setActiveRegionId(defaultRealRegion.id);
          map.setView(defaultRealRegion.center, defaultRealRegion.zoom, { animate: false });
        }
        const b = map.getBounds();
        void loadAircraftInView({
          lamin: Math.max(-85, b.getSouth()),
          lomin: Math.max(-180, b.getWest()),
          lamax: Math.min(85, b.getNorth()),
          lomax: Math.min(180, b.getEast()),
        });
      }
    }
  };

  const handleSelectRegion = (preset: MapRegionPreset) => {
    setActiveRegionId(preset.id);
    const map = mapRef.current;
    if (!map) return;
    map.setView(preset.center, preset.zoom, { animate: false });

    if (trackingMode === 'real') {
      const b = map.getBounds();
      void loadAircraftInView({
        lamin: Math.max(-85, b.getSouth()),
        lomin: Math.max(-180, b.getWest()),
        lamax: Math.min(85, b.getNorth()),
        lomax: Math.min(180, b.getEast()),
      });
    }
  };

  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleRecenter = () => {
    const preset = REGION_PRESETS.find((r) => r.id === activeRegionId) || REGION_PRESETS[0];
    handleSelectRegion(preset);
  };

  const formatLastContact = (unixSec: number) => {
    if (!unixSec) return 'Not available';
    return new Date(unixSec * 1000).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const activeCount =
    trackingMode === 'simulation' ? visibleSimAircraft.length : visibleRealAircraft.length;
  const activeTotal =
    trackingMode === 'simulation' ? SIMULATED_AIRCRAFT_COUNT : totalInBounds;

  return (
    <section className="space-y-4" aria-label="Live Flight Map">
      {/* Control Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              {trackingMode === 'simulation' ? (
                <Globe className="w-5 h-5" />
              ) : (
                <Radio className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                {trackingMode === 'simulation'
                  ? 'Live Radar Map · Global Aircraft Simulation'
                  : 'Live Radar Map · OpenSky Network'}
              </h2>
              <p className="text-xs text-slate-500">
                {trackingMode === 'simulation'
                  ? 'Continuous global fictional flight simulation rendered on OpenStreetMap with great-circle routes and live telemetry.'
                  : 'Real-time ADS-B aircraft positions rendered on OpenStreetMap with heading rotation.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Compact Dual-Mode Selector */}
            <div
              role="group"
              aria-label="Aircraft tracking mode"
              className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1"
            >
              <button
                type="button"
                onClick={() => handleModeSwitch('simulation')}
                aria-pressed={trackingMode === 'simulation'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  trackingMode === 'simulation'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Simulation Mode
              </button>
              <button
                type="button"
                onClick={() => handleModeSwitch('real')}
                aria-pressed={trackingMode === 'real'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  trackingMode === 'real'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Real Tracking Mode
              </button>
            </div>

            {/* Real Mode Only: Auto-Refresh & Refresh Radar Controls */}
            {trackingMode === 'real' && (
              <>
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <label htmlFor="map-auto-refresh" className="font-semibold text-slate-600">
                    Auto:
                  </label>
                  <select
                    id="map-auto-refresh"
                    value={autoRefreshSec}
                    onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
                    disabled={!isConfigured || retryCountdown > 0}
                    className="bg-transparent font-bold text-slate-900 focus:outline-none disabled:opacity-50"
                  >
                    <option value={0}>Manual</option>
                    <option value={20}>20s</option>
                    <option value={45}>45s</option>
                    <option value={60}>60s</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => void loadAircraftInView(undefined, true)}
                  disabled={isLoading || retryCountdown > 0}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 ${
                    boundsDirty
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {isLoading
                      ? 'Scanning...'
                      : retryCountdown > 0
                      ? `Cooldown (${retryCountdown}s)`
                      : boundsDirty
                      ? 'Scan This Area'
                      : 'Refresh Radar'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Explicit Mode Identity Strip */}
        {trackingMode === 'simulation' ? (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs"
          >
            <div className="flex items-center gap-2 font-extrabold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span>SIMULATION MODE — FICTIONAL AIRCRAFT DATA</span>
            </div>
            <span className="text-amber-800 font-medium">
              {SIMULATED_AIRCRAFT_COUNT} fictional aircraft moving continuously across 6 continents · No external API required
            </span>
          </div>
        ) : (
          <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs"
          >
            <div className="flex items-center gap-2 font-extrabold tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>REAL TRACKING MODE — OPENSKY NETWORK (SERVER-SIDE OAUTH2)</span>
            </div>
            <span className="text-slate-500 font-medium">
              Displays live ADS-B aircraft only · Never falls back to simulated aircraft
            </span>
          </div>
        )}

        {/* Region Presets + Search Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-1.5">
            {REGION_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectRegion(preset)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeRegionId === preset.id
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 sm:flex-none sm:w-56">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder={
                  trackingMode === 'simulation'
                    ? 'Filter flight, model, airport...'
                    : 'Filter callsign, ICAO24...'
                }
                aria-label="Filter aircraft on map"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600 focus:outline-none"
              />
            </div>

            <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={airborneOnly}
                onChange={(e) => setAirborneOnly(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Airborne only</span>
            </label>
          </div>
        </div>

        {/* Real Tracking Mode Only: Configuration / Rate Limit / Error Banner */}
        {trackingMode === 'real' && errorBanner && (
          <div
            role="alert"
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs sm:text-sm ${
              errorBanner.code === 'NOT_CONFIGURED' || errorBanner.code === 'RATE_LIMITED'
                ? 'bg-amber-50 border-amber-300 text-amber-950'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <div className="flex items-start gap-2.5 flex-1">
              {errorBanner.code === 'NOT_CONFIGURED' || errorBanner.code === 'RATE_LIMITED' ? (
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 leading-relaxed">
                <span className="font-bold">
                  {errorBanner.code === 'NOT_CONFIGURED'
                    ? 'OpenSky Network OAuth2 Credentials Required: '
                    : errorBanner.code === 'AUTH_ERROR'
                    ? 'OpenSky OAuth2 Authentication Failed: '
                    : errorBanner.code === 'RATE_LIMITED'
                    ? 'OpenSky Rate Limit Active: '
                    : errorBanner.code === 'UPSTREAM_TIMEOUT'
                    ? 'OpenSky Network Connection Timeout: '
                    : 'OpenSky Radar Feed Error: '}
                </span>
                <span>{errorBanner.message}</span>
                {errorBanner.code === 'NOT_CONFIGURED' && (
                  <p className="mt-1 text-xs text-amber-800">
                    Add <code className="font-mono font-semibold">OPENSKY_CLIENT_ID</code> and{' '}
                    <code className="font-mono font-semibold">OPENSKY_CLIENT_SECRET</code> in your
                    server environment secrets to load live aircraft positions. No simulated
                    aircraft are plotted in Real Tracking Mode.
                  </p>
                )}
                {errorBanner.code === 'UPSTREAM_TIMEOUT' && (
                  <p className="mt-1 text-xs text-rose-800">
                    This hosting environment cannot reach OpenSky Network servers directly. Switch
                    to <strong>Simulation Mode</strong> for immediate global aircraft tracking, or
                    deploy to a network that permits OpenSky API egress.
                  </p>
                )}
              </div>
            </div>
            {errorBanner.code !== 'NOT_CONFIGURED' && retryCountdown === 0 && (
              <button
                type="button"
                onClick={() => void loadAircraftInView(undefined, true)}
                disabled={isLoading}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold bg-white border border-rose-200 text-rose-800 hover:bg-rose-100 transition-colors disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Map + Telemetry Inspector Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Leaflet Map Frame */}
        <div
          className={`${
            hasSelectedPanel ? 'lg:col-span-8' : 'lg:col-span-12'
          } bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all`}
        >
          <div className="relative w-full h-[460px] sm:h-[560px]">
            <div
              ref={mapContainerRef}
              className="w-full h-full z-10"
              aria-label="Interactive OpenStreetMap live aircraft radar"
            />

            {/* Custom Map Zoom & Recenter Controls */}
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={handleZoomIn}
                title="Zoom in"
                aria-label="Zoom in"
                className="w-9 h-9 bg-white/95 hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-sm flex items-center justify-center transition-colors"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                title="Zoom out"
                aria-label="Zoom out"
                className="w-9 h-9 bg-white/95 hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-sm flex items-center justify-center transition-colors"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRecenter}
                title="Recenter map to selected region"
                aria-label="Recenter map"
                className="w-9 h-9 bg-white/95 hover:bg-slate-50 text-slate-700 border border-slate-300 rounded-lg shadow-sm flex items-center justify-center transition-colors"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>

            {/* Viewport Scan Prompt Overlay when Panned (Real Tracking Mode ONLY) */}
            {trackingMode === 'real' &&
              boundsDirty &&
              isConfigured &&
              retryCountdown === 0 &&
              !isLoading && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20">
                  <button
                    type="button"
                    onClick={() => void loadAircraftInView()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900/95 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-md border border-slate-700 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Scan Aircraft in This Area</span>
                  </button>
                </div>
              )}

            {/* Compact Live Telemetry Counter Footer Bar */}
            <div className="absolute bottom-3 right-3 z-20 bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm text-2xs sm:text-xs text-slate-700 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1 font-bold text-slate-900 font-mono">
                <Plane className="w-3.5 h-3.5 text-blue-600" />
                {activeCount}
                {activeTotal > activeCount ? ` / ${activeTotal}` : ''}{' '}
                {trackingMode === 'simulation' ? 'simulated aircraft' : 'aircraft'}
              </span>
              {trackingMode === 'simulation' ? (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-slate-500">
                    Live tick{' '}
                    {new Date(simUpdatedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </>
              ) : (
                <>
                  {lastFetchedAt && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="text-slate-500">
                        Updated{' '}
                        {new Date(lastFetchedAt).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                        {isCachedSnapshot ? ' (cached)' : ''}
                      </span>
                    </>
                  )}
                  {remainingCredits !== null && (
                    <>
                      <span className="text-slate-300">|</span>
                      <span className="font-mono text-slate-600">
                        OpenSky credits: {remainingCredits}
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Map Legend Bar */}
          <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                Airborne (heading-rotated)
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                On Ground
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                Selected Aircraft
              </span>
              {trackingMode === 'simulation' && selectedSimAircraft && (
                <span className="inline-flex items-center gap-1.5 font-medium text-blue-700">
                  <span className="w-4 h-0.5 bg-blue-600 inline-block" />
                  Fictional Flight Path
                </span>
              )}
            </div>
            <span className="text-slate-500">
              {trackingMode === 'simulation'
                ? 'Click any simulated aircraft to view its route path, altitude, speed, heading, and ETA.'
                : 'Click any airplane marker to inspect real-time altitude, velocity, and heading.'}
            </span>
          </div>
        </div>

        {/* Selected SIMULATED Aircraft Details Side Panel */}
        {trackingMode === 'simulation' && selectedSimAircraft && (
          <aside
            className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn"
            aria-label="Selected Simulated Aircraft Telemetry"
          >
            <div className="p-4 bg-slate-900 text-white flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-lg font-extrabold tracking-tight">
                    {selectedSimAircraft.flightNumber}
                  </span>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded uppercase ${getSimStatusBadgeClass(
                      selectedSimAircraft.flightStatus
                    )}`}
                  >
                    {selectedSimAircraft.flightStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedSimAircraft.airlineName} ·{' '}
                  <span className="font-mono">{selectedSimAircraft.callsign}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSimId(null)}
                aria-label="Close simulated aircraft details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3.5">
              {/* Flight Information */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1">
                    <Plane className="w-3.5 h-3.5 text-blue-600" />
                    Flight Information
                  </span>
                  <span className="text-amber-700 font-bold">FICTIONAL</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <div className="text-2xs text-slate-500">Flight / Callsign</div>
                    <div className="font-mono font-bold text-slate-900">
                      {selectedSimAircraft.flightNumber} / {selectedSimAircraft.callsign}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-slate-500">Aircraft Model</div>
                    <div className="font-semibold text-slate-900">
                      {selectedSimAircraft.aircraftModel}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-slate-500">Registration</div>
                    <div className="font-mono font-semibold text-slate-900">
                      {selectedSimAircraft.registration}
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-slate-500">Flight Status</div>
                    <div className="font-semibold text-slate-900">
                      {selectedSimAircraft.flightStatus}
                    </div>
                  </div>
                </div>
              </div>

              {/* Journey Information */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-2xs font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1">
                    <Route className="w-3.5 h-3.5 text-blue-600" />
                    Journey Information
                  </span>
                  <span className="font-mono text-slate-700">
                    {selectedSimAircraft.progressPercent}% Complete
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-mono text-base font-extrabold text-slate-900">
                      {selectedSimAircraft.origin.iata}
                    </div>
                    <div className="text-2xs text-slate-600 truncate">
                      {selectedSimAircraft.origin.city}, {selectedSimAircraft.origin.country}
                    </div>
                    <div className="text-2xs text-slate-400 truncate">
                      {selectedSimAircraft.origin.name}
                    </div>
                  </div>
                  <div className="text-slate-400 font-mono text-xs shrink-0 px-1">→</div>
                  <div className="min-w-0 text-right">
                    <div className="font-mono text-base font-extrabold text-slate-900">
                      {selectedSimAircraft.destination.iata}
                    </div>
                    <div className="text-2xs text-slate-600 truncate">
                      {selectedSimAircraft.destination.city},{' '}
                      {selectedSimAircraft.destination.country}
                    </div>
                    <div className="text-2xs text-slate-400 truncate">
                      {selectedSimAircraft.destination.name}
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${selectedSimAircraft.progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <div>
                    <div className="text-2xs text-slate-500">Est. Arrival Time</div>
                    <div className="font-mono font-bold text-slate-900">
                      {selectedSimAircraft.estimatedArrivalLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xs text-slate-500">Remaining Distance</div>
                    <div className="font-mono font-bold text-slate-900">
                      {selectedSimAircraft.remainingDistanceKm.toLocaleString()} km{' '}
                      <span className="text-2xs font-normal text-slate-500">
                        ({selectedSimAircraft.remainingDistanceNm.toLocaleString()} nm)
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Telemetry */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500 px-0.5">
                  <Activity className="w-3.5 h-3.5 text-blue-600" />
                  <span>Live Telemetry</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                      <Compass className="w-3.5 h-3.5 text-blue-600" />
                      <span>Altitude</span>
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {selectedSimAircraft.altitudeFt.toLocaleString()} ft
                    </div>
                    <div className="text-2xs font-mono text-slate-500">
                      {selectedSimAircraft.altitudeM.toLocaleString()} m
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                      <Gauge className="w-3.5 h-3.5 text-blue-600" />
                      <span>Ground Speed</span>
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {selectedSimAircraft.groundSpeedKts} kts
                    </div>
                    <div className="text-2xs font-mono text-slate-500">
                      {selectedSimAircraft.groundSpeedKmh} km/h
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                      <Navigation className="w-3.5 h-3.5 text-blue-600" />
                      <span>Heading</span>
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {Math.round(selectedSimAircraft.headingDeg)}°{' '}
                      {selectedSimAircraft.compassDirection}
                    </div>
                    <div className="text-2xs font-mono text-slate-500">True course</div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                      <Plane className="w-3.5 h-3.5 text-blue-600" />
                      <span>Vertical Speed</span>
                    </div>
                    <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                      {selectedSimAircraft.verticalSpeedFpm > 0 ? '+' : ''}
                      {selectedSimAircraft.verticalSpeedFpm} fpm
                    </div>
                    <div className="text-2xs text-slate-500">
                      {selectedSimAircraft.verticalSpeedFpm > 100
                        ? 'Climbing'
                        : selectedSimAircraft.verticalSpeedFpm < -100
                        ? 'Descending'
                        : selectedSimAircraft.onGround
                        ? 'On ground'
                        : 'Level flight'}
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Current Latitude
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {selectedSimAircraft.latitude.toFixed(4)}°
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> Current Longitude
                    </span>
                    <span className="font-mono font-semibold text-slate-900">
                      {selectedSimAircraft.longitude.toFixed(4)}°
                    </span>
                  </div>
                </div>
              </div>

              <div className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-2xs font-semibold text-amber-900 text-center">
                SIMULATION MODE — Fictional aircraft telemetry. Not a real flight.
              </div>
            </div>
          </aside>
        )}

        {/* Selected REAL OpenSky Aircraft Details Side Panel */}
        {trackingMode === 'real' && selectedRealAircraft && (
          <aside
            className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn"
            aria-label="Selected Aircraft Telemetry"
          >
            <div className="p-4 bg-slate-900 text-white flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-lg font-extrabold tracking-tight">
                    {selectedRealAircraft.callsign || selectedRealAircraft.icao24.toUpperCase()}
                  </span>
                  <span
                    className={`text-2xs font-bold px-2 py-0.5 rounded ${
                      selectedRealAircraft.onGround
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-blue-600 text-white'
                    }`}
                  >
                    {selectedRealAircraft.onGround ? 'ON GROUND' : 'AIRBORNE'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {selectedRealAircraft.originCountry} · ICAO24{' '}
                  <span className="font-mono uppercase">{selectedRealAircraft.icao24}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIcao24(null)}
                aria-label="Close aircraft details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                    <Compass className="w-3.5 h-3.5 text-blue-600" />
                    <span>Altitude</span>
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {selectedRealAircraft.altitudeFt !== null
                      ? `${selectedRealAircraft.altitudeFt.toLocaleString()} ft`
                      : 'Not available'}
                  </div>
                  <div className="text-2xs font-mono text-slate-500">
                    {selectedRealAircraft.baroAltitudeM !== null
                      ? `${Math.round(selectedRealAircraft.baroAltitudeM).toLocaleString()} m baro`
                      : selectedRealAircraft.geoAltitudeM !== null
                      ? `${Math.round(selectedRealAircraft.geoAltitudeM).toLocaleString()} m geo`
                      : '—'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                    <Gauge className="w-3.5 h-3.5 text-blue-600" />
                    <span>Velocity</span>
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {selectedRealAircraft.velocityKts !== null
                      ? `${selectedRealAircraft.velocityKts} kts`
                      : 'Not available'}
                  </div>
                  <div className="text-2xs font-mono text-slate-500">
                    {selectedRealAircraft.velocityKmh !== null
                      ? `${selectedRealAircraft.velocityKmh} km/h`
                      : '—'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                    <Navigation className="w-3.5 h-3.5 text-blue-600" />
                    <span>Heading</span>
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {selectedRealAircraft.trueTrack !== null
                      ? `${Math.round(selectedRealAircraft.trueTrack)}° ${getCompassDirection(
                          selectedRealAircraft.trueTrack
                        )}`
                      : 'Not available'}
                  </div>
                  <div className="text-2xs font-mono text-slate-500">True track</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1 text-2xs font-bold uppercase tracking-wider text-slate-500">
                    <Plane className="w-3.5 h-3.5 text-blue-600" />
                    <span>Vertical Rate</span>
                  </div>
                  <div className="mt-1 font-mono text-sm font-bold text-slate-900">
                    {selectedRealAircraft.verticalRateFpm !== null
                      ? `${selectedRealAircraft.verticalRateFpm > 0 ? '+' : ''}${
                          selectedRealAircraft.verticalRateFpm
                        } fpm`
                      : 'Not available'}
                  </div>
                  <div className="text-2xs text-slate-500">
                    {selectedRealAircraft.verticalRateFpm === null
                      ? '—'
                      : selectedRealAircraft.verticalRateFpm > 100
                      ? 'Climbing'
                      : selectedRealAircraft.verticalRateFpm < -100
                      ? 'Descending'
                      : 'Level flight'}
                  </div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> Coordinates
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedRealAircraft.latitude.toFixed(4)}°,{' '}
                    {selectedRealAircraft.longitude.toFixed(4)}°
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Transponder Squawk</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {selectedRealAircraft.squawk || 'Not available'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Last ADS-B Contact</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatLastContact(selectedRealAircraft.lastContact)}
                  </span>
                </div>
              </div>

              {selectedRealAircraft.callsign && onLookupFlight && (
                <button
                  type="button"
                  onClick={() => onLookupFlight(selectedRealAircraft.callsign!)}
                  className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>Search Schedule for {selectedRealAircraft.callsign}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </aside>
        )}
      </div>
    </section>
  );
};
