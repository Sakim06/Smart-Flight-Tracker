import {
  AviationstackFlightItem,
  AviationstackLookupResponse,
  FlightFormPayload,
  FlightRecord,
  FlightStatus,
  IntegrationsStatus,
  OpenSkyStatesResponse,
} from '../types/flight';
import { formatDateString, normalizeFlightCode } from './flightMockService';

export interface MapBoundingBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export async function fetchIntegrationsStatus(): Promise<IntegrationsStatus> {
  try {
    const res = await fetch('/api/integrations/status');
    if (!res.ok) {
      return { openskyConfigured: false, aviationstackConfigured: false };
    }
    return (await res.json()) as IntegrationsStatus;
  } catch {
    return { openskyConfigured: false, aviationstackConfigured: false };
  }
}

export async function fetchOpenSkyStates(
  bbox?: MapBoundingBox,
  limit = 350,
  forceRefresh = false
): Promise<OpenSkyStatesResponse> {
  const params = new URLSearchParams();
  if (bbox) {
    params.set('lamin', bbox.lamin.toFixed(4));
    params.set('lomin', bbox.lomin.toFixed(4));
    params.set('lamax', bbox.lamax.toFixed(4));
    params.set('lomax', bbox.lomax.toFixed(4));
  }
  params.set('limit', String(limit));
  if (forceRefresh) {
    params.set('force', '1');
  }

  const res = await fetch(`/api/opensky/states?${params.toString()}`);
  const payload = (await res.json().catch(() => null)) as OpenSkyStatesResponse | null;

  if (payload) {
    return payload;
  }

  return {
    configured: false,
    cached: false,
    fetchedAt: Date.now(),
    totalInBounds: 0,
    returnedCount: 0,
    remainingCredits: null,
    retryAfterSeconds: null,
    code: 'NETWORK_ERROR',
    error: `Server returned HTTP ${res.status}`,
    aircraft: [],
  };
}

export async function fetchAviationstackFlight(
  query: string
): Promise<AviationstackLookupResponse> {
  const normalized = normalizeFlightCode(query);
  const params = new URLSearchParams({ flight_iata: normalized });

  const res = await fetch(`/api/aviationstack/flights?${params.toString()}`);
  const payload = (await res.json().catch(() => null)) as AviationstackLookupResponse | null;

  if (payload) {
    return payload;
  }

  return {
    configured: false,
    cached: false,
    fetchedAt: Date.now(),
    flightCode: normalized,
    code: 'NETWORK_ERROR',
    error: `Server returned HTTP ${res.status}`,
    data: [],
  };
}

function formatIsoTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatIsoDate(iso: string | null | undefined, fallbackDateStr?: string | null): string {
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      return formatDateString(d);
    }
  }
  if (fallbackDateStr) {
    const d = new Date(`${fallbackDateStr}T12:00:00Z`);
    if (!Number.isNaN(d.getTime())) {
      return formatDateString(d);
    }
  }
  return 'Not available';
}

function computeDurationMinutes(startIso: string | null | undefined, endIso: string | null | undefined): number | null {
  if (!startIso || !endIso) return null;
  const s = new Date(startIso).getTime();
  const e = new Date(endIso).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e <= s) return null;
  return Math.round((e - s) / 60000);
}

function formatDurationLabel(minutes: number | null): string {
  if (!minutes || minutes <= 0) return 'Not available';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function mapAviationstackStatus(
  rawStatus: string | null | undefined,
  delayMinutes: number
): { status: FlightStatus; statusLabel: string; progressPercent: number } {
  const s = (rawStatus || '').toLowerCase();
  if (s === 'cancelled') {
    return { status: 'CANCELLED', statusLabel: 'Cancelled', progressPercent: 0 };
  }
  if (s === 'landed') {
    return { status: 'ARRIVED', statusLabel: 'Landed · Arrived', progressPercent: 100 };
  }
  if (s === 'active') {
    return {
      status: delayMinutes > 0 ? 'DELAYED' : 'DEPARTED',
      statusLabel: delayMinutes > 0 ? `In Air · Delayed (+${delayMinutes}m)` : 'En Route · Active',
      progressPercent: 50,
    };
  }
  if (s === 'diverted' || s === 'incident') {
    return {
      status: 'DELAYED',
      statusLabel: s === 'diverted' ? 'Diverted' : 'Operational Incident',
      progressPercent: 50,
    };
  }
  if (delayMinutes > 0) {
    return {
      status: 'DELAYED',
      statusLabel: `Delayed (+${delayMinutes}m)`,
      progressPercent: 0,
    };
  }
  return { status: 'SCHEDULED', statusLabel: 'Scheduled', progressPercent: 0 };
}

/**
 * Converts a real Aviationstack API flight item into the app's FlightRecord view model.
 * Never fabricates missing fields—unavailable upstream data remains null ("Not available").
 */
export function mapAviationstackToFlightRecord(item: AviationstackFlightItem): FlightRecord {
  const airlineIata = item.airline?.iata?.trim().toUpperCase() || '';
  const flightNum = item.flight?.number?.trim() || '';
  const iataCombined = item.flight?.iata?.trim().toUpperCase() || `${airlineIata}${flightNum}`;
  const formattedNumber =
    airlineIata && flightNum ? `${airlineIata} ${flightNum}` : iataCombined || 'Unknown';
  const normalizedCode = normalizeFlightCode(iataCombined || formattedNumber);

  const depDelay = typeof item.departure?.delay === 'number' && item.departure.delay > 0 ? item.departure.delay : 0;
  const arrDelay = typeof item.arrival?.delay === 'number' && item.arrival.delay > 0 ? item.arrival.delay : 0;
  const delayMinutes = Math.max(depDelay, arrDelay);

  const { status, statusLabel, progressPercent } = mapAviationstackStatus(
    item.flight_status,
    delayMinutes
  );

  const durationMinutes = computeDurationMinutes(
    item.departure?.scheduled,
    item.arrival?.scheduled
  );

  const depTz = item.departure?.timezone || 'UTC';
  const arrTz = item.arrival?.timezone || 'UTC';

  const liveAltFt =
    typeof item.live?.altitude === 'number' && Number.isFinite(item.live.altitude)
      ? Math.round(item.live.altitude * 3.28084)
      : null;
  const liveSpeedKts =
    typeof item.live?.speed_horizontal === 'number' && Number.isFinite(item.live.speed_horizontal)
      ? Math.round(item.live.speed_horizontal * 0.539957)
      : null;
  const hasLiveCoords =
    typeof item.live?.latitude === 'number' && typeof item.live?.longitude === 'number';

  const currentLocationDesc = hasLiveCoords
    ? `Live Fix: ${item.live!.latitude!.toFixed(3)}°, ${item.live!.longitude!.toFixed(3)}°${
        typeof item.live?.direction === 'number' ? ` · HDG ${Math.round(item.live.direction)}°` : ''
      }`
    : null;

  const bdAirports = new Set(['DAC', 'CGP', 'ZYL', 'CXB', 'RJH', 'JSR', 'SPD', 'BZL']);
  const originIata = item.departure?.iata?.toUpperCase() || 'N/A';
  const destIata = item.arrival?.iata?.toUpperCase() || 'N/A';
  const routeType: 'domestic' | 'international' =
    bdAirports.has(originIata) && bdAirports.has(destIata) ? 'domestic' : 'international';

  return {
    flightNumber: formattedNumber,
    normalizedCode,
    airline: {
      name: item.airline?.name || 'Commercial Airline',
      iata: airlineIata || 'N/A',
      icao: item.airline?.icao?.toUpperCase() || 'N/A',
      callsign: item.flight?.icao?.toUpperCase() || item.airline?.icao?.toUpperCase() || 'N/A',
      accentColor: '#1E40AF',
    },
    status,
    statusLabel,
    progressPercent,
    origin: {
      iata: originIata,
      icao: item.departure?.icao?.toUpperCase() || 'N/A',
      name: item.departure?.airport || 'Departure Airport',
      city: item.departure?.timezone?.split('/').pop()?.replace(/_/g, ' ') || originIata,
      country: item.departure?.timezone?.split('/')[0]?.replace(/_/g, ' ') || '',
      terminal: item.departure?.terminal || null,
      gate: item.departure?.gate || null,
      baggageClaim: null,
      weather: null,
    },
    destination: {
      iata: destIata,
      icao: item.arrival?.icao?.toUpperCase() || 'N/A',
      name: item.arrival?.airport || 'Arrival Airport',
      city: item.arrival?.timezone?.split('/').pop()?.replace(/_/g, ' ') || destIata,
      country: item.arrival?.timezone?.split('/')[0]?.replace(/_/g, ' ') || '',
      terminal: item.arrival?.terminal || null,
      gate: item.arrival?.gate || null,
      baggageClaim: item.arrival?.baggage || null,
      weather: null,
    },
    departure: {
      scheduledTime: formatIsoTime(item.departure?.scheduled) || 'Not available',
      estimatedTime: formatIsoTime(item.departure?.estimated),
      actualTime: formatIsoTime(item.departure?.actual),
      timezone: depTz,
      date: formatIsoDate(item.departure?.scheduled, item.flight_date),
      gateCloseTime: null,
    },
    arrival: {
      scheduledTime: formatIsoTime(item.arrival?.scheduled) || 'Not available',
      estimatedTime: formatIsoTime(item.arrival?.estimated),
      actualTime: formatIsoTime(item.arrival?.actual),
      timezone: arrTz,
      date: formatIsoDate(item.arrival?.scheduled, item.flight_date),
      gateCloseTime: null,
    },
    flightDuration: formatDurationLabel(durationMinutes),
    elapsedDuration: null,
    remainingDuration: null,
    aircraft: {
      model: item.aircraft?.icao || item.aircraft?.iata || null,
      registration: item.aircraft?.registration || null,
      operator: item.airline?.name || 'Commercial Airline',
      cruisingAltitudeFt: liveAltFt,
      groundSpeedKnots: liveSpeedKts,
      currentLocationDesc,
      totalDistanceKm: null,
      elapsedDistanceKm: null,
    },
    disruption: {
      isDelayed: delayMinutes > 0 && status !== 'CANCELLED',
      delayMinutes,
      isCancelled: status === 'CANCELLED',
      reason:
        status === 'CANCELLED'
          ? 'Reported cancelled by Aviationstack live feed.'
          : delayMinutes > 0
          ? `Reported delayed by ${delayMinutes} minutes by Aviationstack live feed.`
          : null,
      disruptionType: null,
    },
    lastUpdated: Date.now(),
    dayOffset: 0,
    dateTag: item.flight_date || 'today',
    scheduledDepartureIso: item.departure?.scheduled || 'Not available',
    estimatedDepartureIso: item.departure?.estimated || null,
    scheduledArrivalIso: item.arrival?.scheduled || 'Not available',
    estimatedArrivalIso: item.arrival?.estimated || null,
    routeType,
    dataSource: 'aviationstack',
    liveTelemetry: hasLiveCoords
      ? {
          latitude: item.live!.latitude!,
          longitude: item.live!.longitude!,
          altitudeM: typeof item.live?.altitude === 'number' ? item.live.altitude : null,
          heading: typeof item.live?.direction === 'number' ? item.live.direction : null,
          speedKmh:
            typeof item.live?.speed_horizontal === 'number' ? item.live.speed_horizontal : null,
          isGround: Boolean(item.live?.is_ground),
          updated: item.live?.updated ?? null,
        }
      : null,
  };
}

/**
 * Converts a live Aviationstack flight result into a validated FirestoreFlightDoc payload
 * strictly matching the existing Cloud Firestore /flights schema & security rules.
 */
export function mapAviationstackToFirestorePayload(
  item: AviationstackFlightItem
): FlightFormPayload {
  const airlineIata = (item.airline?.iata || '').trim().toUpperCase();
  const flightNum = (item.flight?.number || '').trim();
  const flightNumber =
    airlineIata && flightNum
      ? `${airlineIata} ${flightNum}`
      : (item.flight?.iata || 'FL 000').trim().toUpperCase();

  const depDate = item.departure?.scheduled ? new Date(item.departure.scheduled) : null;
  const departureHour = depDate && !Number.isNaN(depDate.getTime()) ? depDate.getHours() : 12;
  const departureMinute = depDate && !Number.isNaN(depDate.getTime()) ? depDate.getMinutes() : 0;

  const computedDuration = computeDurationMinutes(
    item.departure?.scheduled,
    item.arrival?.scheduled
  );
  const durationMinutes =
    computedDuration && computedDuration > 0 && computedDuration <= 1440 ? computedDuration : 120;

  const delayMinutes = Math.max(
    typeof item.departure?.delay === 'number' ? item.departure.delay : 0,
    typeof item.arrival?.delay === 'number' ? item.arrival.delay : 0,
    0
  );

  const mappedStatus = mapAviationstackStatus(item.flight_status, delayMinutes).status;

  const originIata = (item.departure?.iata || 'UNK').trim().toUpperCase().slice(0, 10);
  const originIcao = (item.departure?.icao || originIata || 'XXXX').trim().toUpperCase().slice(0, 10);
  const destIata = (item.arrival?.iata || 'UNK').trim().toUpperCase().slice(0, 10);
  const destIcao = (item.arrival?.icao || destIata || 'XXXX').trim().toUpperCase().slice(0, 10);

  const bdAirports = new Set(['DAC', 'CGP', 'ZYL', 'CXB', 'RJH', 'JSR', 'SPD', 'BZL']);
  const routeType =
    bdAirports.has(originIata) && bdAirports.has(destIata) ? 'domestic' : 'international';

  return {
    flightNumber,
    airlineName: (item.airline?.name || 'Commercial Airline').trim().slice(0, 100),
    airlineIata: airlineIata || flightNumber.slice(0, 2) || 'XX',
    airlineIcao: (item.airline?.icao || 'XXX').trim().toUpperCase().slice(0, 10),
    airlineCallsign: (item.flight?.icao || item.airline?.icao || '').trim().toUpperCase().slice(0, 40),
    airlineAccentColor: '#1E40AF',
    originIata: originIata.length >= 2 ? originIata : 'XX',
    originIcao: originIcao.length >= 2 ? originIcao : 'XXXX',
    originName: (item.departure?.airport || `${originIata} Airport`).trim().slice(0, 120),
    originCity:
      (item.departure?.timezone?.split('/').pop()?.replace(/_/g, ' ') || originIata)
        .trim()
        .slice(0, 80),
    originCountry:
      (item.departure?.timezone?.split('/')[0]?.replace(/_/g, ' ') || 'International')
        .trim()
        .slice(0, 80),
    originTerminal: (item.departure?.terminal || '').trim().slice(0, 60),
    originGate: (item.departure?.gate || '').trim().slice(0, 30),
    destinationIata: destIata.length >= 2 ? destIata : 'XX',
    destinationIcao: destIcao.length >= 2 ? destIcao : 'XXXX',
    destinationName: (item.arrival?.airport || `${destIata} Airport`).trim().slice(0, 120),
    destinationCity:
      (item.arrival?.timezone?.split('/').pop()?.replace(/_/g, ' ') || destIata)
        .trim()
        .slice(0, 80),
    destinationCountry:
      (item.arrival?.timezone?.split('/')[0]?.replace(/_/g, ' ') || 'International')
        .trim()
        .slice(0, 80),
    destinationTerminal: (item.arrival?.terminal || '').trim().slice(0, 60),
    destinationGate: (item.arrival?.gate || '').trim().slice(0, 30),
    aircraftModel: (item.aircraft?.icao || item.aircraft?.iata || '').trim().slice(0, 80),
    registration: (item.aircraft?.registration || '').trim().toUpperCase().slice(0, 30),
    departureHour,
    departureMinute,
    durationMinutes,
    routeType,
    distanceKm: Math.max(100, Math.round(durationMinutes * 12)),
    statusOverride: mappedStatus,
    delayMinutes: Math.min(1440, delayMinutes),
    disruptionReason:
      mappedStatus === 'CANCELLED'
        ? 'Cancelled (imported from Aviationstack)'
        : delayMinutes > 0
        ? `Delayed +${delayMinutes}m (imported from Aviationstack)`
        : '',
  };
}
