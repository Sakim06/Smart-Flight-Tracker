export type FlightStatus =
  | 'SCHEDULED'
  | 'ON_TIME'
  | 'DEPARTED'
  | 'DELAYED'
  | 'ARRIVED'
  | 'CANCELLED';

export type FlightStatusOverride = 'AUTO' | FlightStatus;

export type AppRole = 'user' | 'admin';
export type SignupStatus = 'approved' | 'pending' | 'blocked';
export type AuthProviderType = 'google' | 'password';

export interface AirportInfo {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  terminal: string | null;
  gate: string | null;
  baggageClaim: string | null;
  weather?: {
    condition: string;
    temperatureC: number;
    windKmh: number;
  } | null;
}

export interface FlightTiming {
  scheduledTime: string; // e.g. "10:30 AM"
  estimatedTime: string | null; // e.g. "10:45 AM"
  actualTime: string | null; // e.g. "10:42 AM"
  timezone: string; // e.g. "BST (UTC+6)"
  date: string; // e.g. "Wed, 11 Nov 2026"
  gateCloseTime: string | null;
}

export interface AircraftDetails {
  model: string | null;
  registration: string | null;
  operator: string;
  cruisingAltitudeFt: number | null;
  groundSpeedKnots: number | null;
  currentLocationDesc: string | null;
  totalDistanceKm: number | null;
  elapsedDistanceKm: number | null;
}

export interface DisruptionInfo {
  isDelayed: boolean;
  delayMinutes: number;
  isCancelled: boolean;
  reason: string | null;
  disruptionType: 'weather' | 'air_traffic' | 'carrier' | 'maintenance' | null;
}

export interface FlightRecord {
  id?: string;
  flightNumber: string;
  normalizedCode: string;
  airline: {
    name: string;
    iata: string;
    icao: string;
    callsign: string;
    accentColor: string;
  };
  status: FlightStatus;
  statusOverride?: FlightStatusOverride;
  statusLabel: string;
  progressPercent: number;
  origin: AirportInfo;
  destination: AirportInfo;
  departure: FlightTiming;
  arrival: FlightTiming;
  flightDuration: string;
  elapsedDuration: string | null;
  remainingDuration: string | null;
  aircraft: AircraftDetails;
  disruption: DisruptionInfo;
  lastUpdated: number; // unix timestamp in ms
  dayOffset: number; // 0 = Today, 1 = Tomorrow, 2 = Day After Tomorrow, etc.
  dateTag: 'today' | 'tomorrow' | 'day_after' | string;
  scheduledDepartureIso: string;
  estimatedDepartureIso: string | null;
  scheduledArrivalIso: string;
  estimatedArrivalIso: string | null;
  routeType: 'domestic' | 'international';
  multiDaySchedules?: Record<number, FlightRecord>;
  dataSource?: FlightDataSource;
  liveTelemetry?: {
    latitude: number;
    longitude: number;
    altitudeM: number | null;
    heading: number | null;
    speedKmh: number | null;
    isGround: boolean;
    updated: string | number | null;
  } | null;
}

export type FlightDataSource = 'aviationstack' | 'firestore';

export interface FirestoreFlightDoc {
  id: string;
  flightNumber: string;
  normalizedCode: string;
  airlineName: string;
  airlineIata: string;
  airlineIcao: string;
  airlineCallsign: string;
  airlineAccentColor: string;
  originIata: string;
  originIcao: string;
  originName: string;
  originCity: string;
  originCountry: string;
  originTerminal: string;
  originGate: string;
  destinationIata: string;
  destinationIcao: string;
  destinationName: string;
  destinationCity: string;
  destinationCountry: string;
  destinationTerminal: string;
  destinationGate: string;
  aircraftModel: string;
  registration: string;
  departureHour: number;
  departureMinute: number;
  durationMinutes: number;
  routeType: 'domestic' | 'international';
  distanceKm: number;
  statusOverride: FlightStatusOverride;
  delayMinutes: number;
  disruptionReason: string;
  createdBy: string;
  createdAt: unknown;
  updatedAt: unknown;
}

export type FlightFormPayload = Omit<FirestoreFlightDoc, 'id' | 'normalizedCode' | 'createdBy' | 'createdAt' | 'updatedAt'>;

export interface UserProfile {
  uid: string;
  fullName: string;
  email: string;
  role: AppRole;
  signupStatus: SignupStatus;
  authProvider: AuthProviderType;
  loginCount: number;
  createdAt: unknown;
  lastLoginAt: unknown;
  updatedAt: unknown;
}

export interface AuthLogEntry {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  eventType: 'SIGNUP' | 'LOGIN';
  authProvider: AuthProviderType;
  signupStatusAtEvent: SignupStatus;
  createdAt: unknown;
}

export interface AuthSettings {
  allowSignup: boolean;
  requireApproval: boolean;
  updatedBy: string;
  updatedAt: unknown;
}

export interface OpenSkyAircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  timePosition: number | null;
  lastContact: number;
  longitude: number;
  latitude: number;
  baroAltitudeM: number | null;
  geoAltitudeM: number | null;
  altitudeFt: number | null;
  onGround: boolean;
  velocityMs: number | null;
  velocityKts: number | null;
  velocityKmh: number | null;
  trueTrack: number | null;
  verticalRateMs: number | null;
  verticalRateFpm: number | null;
  squawk: string | null;
  category: number | null;
}

export interface OpenSkyStatesResponse {
  configured: boolean;
  cached: boolean;
  fetchedAt: number;
  totalInBounds: number;
  returnedCount: number;
  remainingCredits: number | null;
  retryAfterSeconds: number | null;
  code?: string;
  error?: string;
  aircraft: OpenSkyAircraft[];
}

export type TrackingMode = 'simulation' | 'real';

export type SimulatedFlightStatus =
  | 'Takeoff'
  | 'Climbing'
  | 'Cruising'
  | 'Descending'
  | 'Approach'
  | 'On Ground';

export interface SimulatedAirport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  continent: 'North America' | 'South America' | 'Europe' | 'Africa' | 'Asia' | 'Oceania';
  latitude: number;
  longitude: number;
}

export interface SimulatedAircraftState {
  id: string;
  flightNumber: string;
  callsign: string;
  airlineName: string;
  aircraftModel: string;
  registration: string;
  origin: SimulatedAirport;
  destination: SimulatedAirport;
  flightStatus: SimulatedFlightStatus;
  onGround: boolean;
  latitude: number;
  longitude: number;
  altitudeFt: number;
  altitudeM: number;
  groundSpeedKts: number;
  groundSpeedKmh: number;
  headingDeg: number;
  compassDirection: string;
  verticalSpeedFpm: number;
  progressPercent: number;
  totalDistanceKm: number;
  remainingDistanceKm: number;
  remainingDistanceNm: number;
  estimatedArrivalTimeIso: string;
  estimatedArrivalLabel: string;
  legFraction: number;
  lastUpdated: number;
}

export interface AviationstackAirportEndpoint {
  airport: string | null;
  timezone: string | null;
  iata: string | null;
  icao: string | null;
  terminal: string | null;
  gate: string | null;
  baggage?: string | null;
  delay: number | null;
  scheduled: string | null;
  estimated: string | null;
  actual: string | null;
}

export interface AviationstackFlightItem {
  flight_date: string | null;
  flight_status: string | null;
  departure: AviationstackAirportEndpoint | null;
  arrival: AviationstackAirportEndpoint | null;
  airline: {
    name: string | null;
    iata: string | null;
    icao: string | null;
  } | null;
  flight: {
    number: string | null;
    iata: string | null;
    icao: string | null;
    codeshared?: {
      airline_name?: string | null;
      airline_iata?: string | null;
      flight_number?: string | null;
      flight_iata?: string | null;
    } | null;
  } | null;
  aircraft?: {
    registration?: string | null;
    iata?: string | null;
    icao?: string | null;
    icao24?: string | null;
  } | null;
  live?: {
    updated?: string | number | null;
    latitude?: number | null;
    longitude?: number | null;
    altitude?: number | null;
    direction?: number | null;
    speed_horizontal?: number | null;
    speed_vertical?: number | null;
    is_ground?: boolean | null;
  } | null;
}

export interface AviationstackLookupResponse {
  configured: boolean;
  cached: boolean;
  fetchedAt: number;
  flightCode?: string;
  code?: string;
  error?: string;
  data: AviationstackFlightItem[];
}

export interface IntegrationsStatus {
  openskyConfigured: boolean;
  aviationstackConfigured: boolean;
}

export type ViewState = 'idle' | 'loading' | 'success' | 'no-result' | 'provider-error';

export type AppState =
  | 'UNAUTHENTICATED'
  | 'IDLE_SEARCH'
  | 'LOADING'
  | 'RESULT_FOUND'
  | 'NOT_FOUND'
  | 'INVALID_FORMAT';
