import {
  SimulatedAircraftState,
  SimulatedAirport,
  SimulatedFlightStatus,
} from '../types/flight';

// =============================================================================
// Deterministic Global Fictional Aircraft Simulation Engine
// - Zero external API dependency
// - 160 fictional aircraft distributed across all 6 inhabited continents
// - Spherical great-circle interpolation with curved takeoff/approach turns
// - Continuous round-trip flight cycles (Origin -> Destination -> Turnaround -> Return)
//   so aircraft never teleport randomly
// =============================================================================

export const SIMULATED_AIRCRAFT_COUNT = 160;

/**
 * Time-acceleration factor so aircraft visibly glide across both global and regional
 * zoom levels while still displaying realistic airspeeds, climb rates, and ETAs.
 */
const SIM_TIME_SCALE = 18;

/** Brief ground turnaround time (in simulated seconds) between outbound & return legs */
const TURNAROUND_SIM_SECONDS = 360; // ~20 real seconds at 18x

const EARTH_RADIUS_KM = 6371.0088;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const KM_PER_NM = 1.852;
const FEET_PER_METER = 3.28084;

const COMPASS_POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export function getCompassFromHeading(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  const idx = Math.round(normalized / 22.5) % 16;
  return COMPASS_POINTS[idx];
}

// Geographically accurate global airport coordinates across all 6 continents
const SIM_AIRPORTS: SimulatedAirport[] = [
  // North America
  { iata: 'JFK', icao: 'KJFK', name: 'John F. Kennedy International', city: 'New York', country: 'United States', continent: 'North America', latitude: 40.6413, longitude: -73.7781 },
  { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles International', city: 'Los Angeles', country: 'United States', continent: 'North America', latitude: 33.9416, longitude: -118.4085 },
  { iata: 'ORD', icao: 'KORD', name: "O'Hare International", city: 'Chicago', country: 'United States', continent: 'North America', latitude: 41.9742, longitude: -87.9073 },
  { iata: 'ATL', icao: 'KATL', name: 'Hartsfield-Jackson International', city: 'Atlanta', country: 'United States', continent: 'North America', latitude: 33.6407, longitude: -84.4277 },
  { iata: 'DFW', icao: 'KDFW', name: 'Dallas/Fort Worth International', city: 'Dallas', country: 'United States', continent: 'North America', latitude: 32.8998, longitude: -97.0403 },
  { iata: 'SFO', icao: 'KSFO', name: 'San Francisco International', city: 'San Francisco', country: 'United States', continent: 'North America', latitude: 37.6213, longitude: -122.379 },
  { iata: 'MIA', icao: 'KMIA', name: 'Miami International', city: 'Miami', country: 'United States', continent: 'North America', latitude: 25.7959, longitude: -80.287 },
  { iata: 'YYZ', icao: 'CYYZ', name: 'Toronto Pearson International', city: 'Toronto', country: 'Canada', continent: 'North America', latitude: 43.6777, longitude: -79.6248 },
  { iata: 'YVR', icao: 'CYVR', name: 'Vancouver International', city: 'Vancouver', country: 'Canada', continent: 'North America', latitude: 49.1967, longitude: -123.1815 },
  { iata: 'MEX', icao: 'MMMX', name: 'Mexico City International', city: 'Mexico City', country: 'Mexico', continent: 'North America', latitude: 19.4361, longitude: -99.0719 },

  // South America
  { iata: 'GRU', icao: 'SBGR', name: 'São Paulo/Guarulhos International', city: 'São Paulo', country: 'Brazil', continent: 'South America', latitude: -23.4356, longitude: -46.4731 },
  { iata: 'EZE', icao: 'SAEZ', name: 'Ministro Pistarini International', city: 'Buenos Aires', country: 'Argentina', continent: 'South America', latitude: -34.8222, longitude: -58.5358 },
  { iata: 'BOG', icao: 'SKBO', name: 'El Dorado International', city: 'Bogotá', country: 'Colombia', continent: 'South America', latitude: 4.7016, longitude: -74.1469 },
  { iata: 'LIM', icao: 'SPJC', name: 'Jorge Chávez International', city: 'Lima', country: 'Peru', continent: 'South America', latitude: -12.0219, longitude: -77.1143 },
  { iata: 'SCL', icao: 'SCEL', name: 'Arturo Merino Benítez International', city: 'Santiago', country: 'Chile', continent: 'South America', latitude: -33.393, longitude: -70.7858 },
  { iata: 'GIG', icao: 'SBGL', name: 'Rio de Janeiro/Galeão International', city: 'Rio de Janeiro', country: 'Brazil', continent: 'South America', latitude: -22.8099, longitude: -43.2505 },

  // Europe
  { iata: 'LHR', icao: 'EGLL', name: 'London Heathrow', city: 'London', country: 'United Kingdom', continent: 'Europe', latitude: 51.47, longitude: -0.4543 },
  { iata: 'CDG', icao: 'LFPG', name: 'Paris Charles de Gaulle', city: 'Paris', country: 'France', continent: 'Europe', latitude: 49.0097, longitude: 2.5479 },
  { iata: 'FRA', icao: 'EDDF', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', continent: 'Europe', latitude: 50.0379, longitude: 8.5622 },
  { iata: 'AMS', icao: 'EHAM', name: 'Amsterdam Airport Schiphol', city: 'Amsterdam', country: 'Netherlands', continent: 'Europe', latitude: 52.3105, longitude: 4.7683 },
  { iata: 'MAD', icao: 'LEMD', name: 'Adolfo Suárez Madrid–Barajas', city: 'Madrid', country: 'Spain', continent: 'Europe', latitude: 40.4983, longitude: -3.5676 },
  { iata: 'FCO', icao: 'LIRF', name: 'Rome Fiumicino', city: 'Rome', country: 'Italy', continent: 'Europe', latitude: 41.8003, longitude: 12.2389 },
  { iata: 'IST', icao: 'LTFM', name: 'Istanbul Airport', city: 'Istanbul', country: 'Turkey', continent: 'Europe', latitude: 41.2753, longitude: 28.7519 },
  { iata: 'ZRH', icao: 'LSZH', name: 'Zurich Airport', city: 'Zurich', country: 'Switzerland', continent: 'Europe', latitude: 47.4647, longitude: 8.5492 },
  { iata: 'ARN', icao: 'ESSA', name: 'Stockholm Arlanda', city: 'Stockholm', country: 'Sweden', continent: 'Europe', latitude: 59.6519, longitude: 17.9186 },
  { iata: 'ATH', icao: 'LGAV', name: 'Athens International', city: 'Athens', country: 'Greece', continent: 'Europe', latitude: 37.9364, longitude: 23.9445 },

  // Africa
  { iata: 'CAI', icao: 'HECA', name: 'Cairo International', city: 'Cairo', country: 'Egypt', continent: 'Africa', latitude: 30.1219, longitude: 31.4056 },
  { iata: 'JNB', icao: 'FAOR', name: 'O. R. Tambo International', city: 'Johannesburg', country: 'South Africa', continent: 'Africa', latitude: -26.1367, longitude: 28.2411 },
  { iata: 'ADD', icao: 'HAAB', name: 'Addis Ababa Bole International', city: 'Addis Ababa', country: 'Ethiopia', continent: 'Africa', latitude: 8.9779, longitude: 38.7993 },
  { iata: 'LOS', icao: 'DNMM', name: 'Murtala Muhammed International', city: 'Lagos', country: 'Nigeria', continent: 'Africa', latitude: 6.5774, longitude: 3.3212 },
  { iata: 'CMN', icao: 'GMMN', name: 'Mohammed V International', city: 'Casablanca', country: 'Morocco', continent: 'Africa', latitude: 33.3675, longitude: -7.5899 },
  { iata: 'NBO', icao: 'HKJK', name: 'Jomo Kenyatta International', city: 'Nairobi', country: 'Kenya', continent: 'Africa', latitude: -1.3192, longitude: 36.9278 },
  { iata: 'CPT', icao: 'FACT', name: 'Cape Town International', city: 'Cape Town', country: 'South Africa', continent: 'Africa', latitude: -33.9715, longitude: 18.6021 },

  // Asia & Middle East
  { iata: 'DAC', icao: 'VGHS', name: 'Hazrat Shahjalal International', city: 'Dhaka', country: 'Bangladesh', continent: 'Asia', latitude: 23.8433, longitude: 90.3978 },
  { iata: 'CGP', icao: 'VGEG', name: 'Shah Amanat International', city: 'Chattogram', country: 'Bangladesh', continent: 'Asia', latitude: 22.2496, longitude: 91.8133 },
  { iata: 'DEL', icao: 'VIDP', name: 'Indira Gandhi International', city: 'New Delhi', country: 'India', continent: 'Asia', latitude: 28.5562, longitude: 77.1 },
  { iata: 'BOM', icao: 'VABB', name: 'Chhatrapati Shivaji Maharaj', city: 'Mumbai', country: 'India', continent: 'Asia', latitude: 19.0896, longitude: 72.8656 },
  { iata: 'DXB', icao: 'OMDB', name: 'Dubai International', city: 'Dubai', country: 'United Arab Emirates', continent: 'Asia', latitude: 25.2532, longitude: 55.3657 },
  { iata: 'DOH', icao: 'OTHH', name: 'Hamad International', city: 'Doha', country: 'Qatar', continent: 'Asia', latitude: 25.2731, longitude: 51.6081 },
  { iata: 'SIN', icao: 'WSSS', name: 'Singapore Changi', city: 'Singapore', country: 'Singapore', continent: 'Asia', latitude: 1.3644, longitude: 103.9915 },
  { iata: 'BKK', icao: 'VTBS', name: 'Suvarnabhumi Airport', city: 'Bangkok', country: 'Thailand', continent: 'Asia', latitude: 13.69, longitude: 100.7501 },
  { iata: 'HKG', icao: 'VHHH', name: 'Hong Kong International', city: 'Hong Kong', country: 'China', continent: 'Asia', latitude: 22.308, longitude: 113.9185 },
  { iata: 'HND', icao: 'RJTT', name: 'Tokyo Haneda', city: 'Tokyo', country: 'Japan', continent: 'Asia', latitude: 35.5494, longitude: 139.7798 },
  { iata: 'ICN', icao: 'RKSI', name: 'Incheon International', city: 'Seoul', country: 'South Korea', continent: 'Asia', latitude: 37.4602, longitude: 126.4407 },
  { iata: 'PVG', icao: 'ZSPD', name: 'Shanghai Pudong International', city: 'Shanghai', country: 'China', continent: 'Asia', latitude: 31.1443, longitude: 121.8083 },
  { iata: 'KUL', icao: 'WMKK', name: 'Kuala Lumpur International', city: 'Kuala Lumpur', country: 'Malaysia', continent: 'Asia', latitude: 2.7456, longitude: 101.7072 },
  { iata: 'TPE', icao: 'RCTP', name: 'Taiwan Taoyuan International', city: 'Taipei', country: 'Taiwan', continent: 'Asia', latitude: 25.0797, longitude: 121.2342 },

  // Oceania
  { iata: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'Australia', continent: 'Oceania', latitude: -33.9399, longitude: 151.1753 },
  { iata: 'MEL', icao: 'YMML', name: 'Melbourne Airport', city: 'Melbourne', country: 'Australia', continent: 'Oceania', latitude: -37.669, longitude: 144.841 },
  { iata: 'AKL', icao: 'NZAA', name: 'Auckland Airport', city: 'Auckland', country: 'New Zealand', continent: 'Oceania', latitude: -37.0082, longitude: 174.785 },
  { iata: 'BNE', icao: 'YBBN', name: 'Brisbane Airport', city: 'Brisbane', country: 'Australia', continent: 'Oceania', latitude: -27.3942, longitude: 153.1218 },
  { iata: 'PER', icao: 'YPPH', name: 'Perth Airport', city: 'Perth', country: 'Australia', continent: 'Oceania', latitude: -31.9385, longitude: 115.9672 },
];

const AIRPORT_BY_IATA = new Map<string, SimulatedAirport>(
  SIM_AIRPORTS.map((airport) => [airport.iata, airport])
);

interface FictionalCarrier {
  code: string;
  callsignPrefix: string;
  name: string;
  regPrefix: string;
}

// Strictly fictional airline brands & callsigns
const FICTIONAL_CARRIERS: FictionalCarrier[] = [
  { code: 'AV', callsignPrefix: 'AVS', name: 'Aerovista Global (Sim)', regPrefix: 'SIM-AV' },
  { code: 'MR', callsignPrefix: 'MRD', name: 'Meridian Skyways (Sim)', regPrefix: 'SIM-MR' },
  { code: 'SL', callsignPrefix: 'SLS', name: 'Solstice Air (Sim)', regPrefix: 'SIM-SL' },
  { code: 'PH', callsignPrefix: 'PHZ', name: 'Pacific Horizon (Sim)', regPrefix: 'SIM-PH' },
  { code: 'NC', callsignPrefix: 'NCR', name: 'Nordic Crest Airways (Sim)', regPrefix: 'SIM-NC' },
  { code: 'SH', callsignPrefix: 'SHW', name: 'Sahara Wings (Sim)', regPrefix: 'SIM-SH' },
  { code: 'AD', callsignPrefix: 'ADJ', name: 'Andes Jet Lines (Sim)', regPrefix: 'SIM-AD' },
  { code: 'AU', callsignPrefix: 'AUR', name: 'Aurora Transcontinental (Sim)', regPrefix: 'SIM-AU' },
  { code: 'BK', callsignPrefix: 'BSK', name: 'Bengal Sky Express (Sim)', regPrefix: 'SIM-BK' },
  { code: 'SC', callsignPrefix: 'SCR', name: 'Southern Cross Air (Sim)', regPrefix: 'SIM-SC' },
  { code: 'CS', callsignPrefix: 'CST', name: 'Caspian Star Aviation (Sim)', regPrefix: 'SIM-CS' },
  { code: 'VX', callsignPrefix: 'VXR', name: 'Vertex Intercontinental (Sim)', regPrefix: 'SIM-VX' },
];

interface AircraftModelSpec {
  model: string;
  minRangeKm: number;
  maxRangeKm: number;
  cruiseAltMinFt: number;
  cruiseAltMaxFt: number;
  cruiseSpeedMinKts: number;
  cruiseSpeedMaxKts: number;
}

const AIRCRAFT_MODELS: AircraftModelSpec[] = [
  {
    model: 'Boeing 737',
    minRangeKm: 200,
    maxRangeKm: 4200,
    cruiseAltMinFt: 33000,
    cruiseAltMaxFt: 37000,
    cruiseSpeedMinKts: 438,
    cruiseSpeedMaxKts: 462,
  },
  {
    model: 'Airbus A320',
    minRangeKm: 200,
    maxRangeKm: 4400,
    cruiseAltMinFt: 33000,
    cruiseAltMaxFt: 36000,
    cruiseSpeedMinKts: 435,
    cruiseSpeedMaxKts: 455,
  },
  {
    model: 'Airbus A321',
    minRangeKm: 400,
    maxRangeKm: 6200,
    cruiseAltMinFt: 34000,
    cruiseAltMaxFt: 38000,
    cruiseSpeedMinKts: 445,
    cruiseSpeedMaxKts: 470,
  },
  {
    model: 'Boeing 787',
    minRangeKm: 1800,
    maxRangeKm: 15000,
    cruiseAltMinFt: 37000,
    cruiseAltMaxFt: 41000,
    cruiseSpeedMinKts: 482,
    cruiseSpeedMaxKts: 506,
  },
  {
    model: 'Boeing 777',
    minRangeKm: 2000,
    maxRangeKm: 16500,
    cruiseAltMinFt: 36000,
    cruiseAltMaxFt: 39000,
    cruiseSpeedMinKts: 485,
    cruiseSpeedMaxKts: 512,
  },
  {
    model: 'Airbus A350',
    minRangeKm: 2200,
    maxRangeKm: 17500,
    cruiseAltMinFt: 38000,
    cruiseAltMaxFt: 41000,
    cruiseSpeedMinKts: 488,
    cruiseSpeedMaxKts: 515,
  },
];

// Curated global corridor pairs covering all 6 continents + intercontinental bridges
const GLOBAL_ROUTE_CORRIDORS: ReadonlyArray<[string, string]> = [
  // Asia & South Asia
  ['DAC', 'DXB'], ['DAC', 'SIN'], ['DAC', 'BKK'], ['DAC', 'DEL'], ['DAC', 'DOH'],
  ['DAC', 'KUL'], ['DAC', 'HKG'], ['DAC', 'CGP'], ['DAC', 'LHR'], ['DAC', 'IST'],
  ['DEL', 'BOM'], ['DEL', 'SIN'], ['DEL', 'DXB'], ['DEL', 'HND'], ['DEL', 'FRA'],
  ['BOM', 'DXB'], ['BOM', 'SIN'], ['BOM', 'LHR'], ['BOM', 'DOH'], ['BOM', 'HKG'],
  ['DXB', 'LHR'], ['DXB', 'SIN'], ['DXB', 'SYD'], ['DXB', 'JFK'], ['DXB', 'JNB'],
  ['DXB', 'CDG'], ['DXB', 'HND'], ['DXB', 'CAI'], ['DOH', 'LHR'], ['DOH', 'BKK'],
  ['DOH', 'MEL'], ['DOH', 'ORD'], ['DOH', 'NBO'], ['SIN', 'HND'], ['SIN', 'SYD'],
  ['SIN', 'LHR'], ['SIN', 'HKG'], ['SIN', 'ICN'], ['SIN', 'BKK'], ['SIN', 'PER'],
  ['BKK', 'HND'], ['BKK', 'ICN'], ['BKK', 'HKG'], ['BKK', 'KUL'], ['BKK', 'TPE'],
  ['HKG', 'HND'], ['HKG', 'PVG'], ['HKG', 'SYD'], ['HKG', 'SFO'], ['HKG', 'TPE'],
  ['HND', 'ICN'], ['HND', 'PVG'], ['HND', 'LAX'], ['HND', 'SFO'], ['HND', 'SYD'],
  ['ICN', 'PVG'], ['ICN', 'TPE'], ['ICN', 'YVR'], ['ICN', 'FRA'], ['PVG', 'LAX'],
  ['KUL', 'SYD'], ['KUL', 'DEL'], ['KUL', 'TPE'], ['TPE', 'SFO'],

  // Europe
  ['LHR', 'JFK'], ['LHR', 'CDG'], ['LHR', 'FRA'], ['LHR', 'MAD'], ['LHR', 'IST'],
  ['LHR', 'LAX'], ['LHR', 'YYZ'], ['LHR', 'JNB'], ['LHR', 'GRU'], ['LHR', 'ATH'],
  ['CDG', 'JFK'], ['CDG', 'FCO'], ['CDG', 'AMS'], ['CDG', 'CMN'], ['CDG', 'HND'],
  ['CDG', 'GRU'], ['CDG', 'CAI'], ['FRA', 'ORD'], ['FRA', 'ZRH'], ['FRA', 'ARN'],
  ['FRA', 'IST'], ['FRA', 'JNB'], ['FRA', 'SIN'], ['AMS', 'ATL'], ['AMS', 'MAD'],
  ['AMS', 'NBO'], ['AMS', 'LIM'], ['MAD', 'BOG'], ['MAD', 'EZE'], ['MAD', 'MEX'],
  ['MAD', 'MIA'], ['MAD', 'FCO'], ['FCO', 'ATH'], ['FCO', 'CAI'], ['FCO', 'JFK'],
  ['IST', 'CAI'], ['IST', 'ADD'], ['IST', 'DEL'], ['IST', 'ARN'], ['IST', 'JFK'],
  ['ZRH', 'ARN'], ['ZRH', 'ATH'], ['ZRH', 'JFK'], ['ZRH', 'DXB'],

  // North America
  ['JFK', 'LAX'], ['JFK', 'ORD'], ['JFK', 'MIA'], ['JFK', 'SFO'], ['JFK', 'YYZ'],
  ['JFK', 'ATL'], ['JFK', 'GRU'], ['JFK', 'BOG'], ['JFK', 'MEX'], ['LAX', 'SFO'],
  ['LAX', 'DFW'], ['LAX', 'ORD'], ['LAX', 'ATL'], ['LAX', 'YVR'], ['LAX', 'MEX'],
  ['LAX', 'SYD'], ['LAX', 'AKL'], ['LAX', 'LIM'], ['ORD', 'DFW'], ['ORD', 'ATL'],
  ['ORD', 'SFO'], ['ORD', 'YYZ'], ['ORD', 'MEX'], ['ATL', 'MIA'], ['ATL', 'DFW'],
  ['ATL', 'BOG'], ['ATL', 'LIM'], ['DFW', 'MIA'], ['DFW', 'MEX'], ['DFW', 'SCL'],
  ['SFO', 'YVR'], ['SFO', 'AKL'], ['MIA', 'BOG'], ['MIA', 'GRU'], ['MIA', 'EZE'],
  ['MIA', 'SCL'], ['YYZ', 'YVR'], ['YYZ', 'MEX'],

  // South America
  ['GRU', 'EZE'], ['GRU', 'SCL'], ['GRU', 'BOG'], ['GRU', 'LIM'], ['GRU', 'GIG'],
  ['GRU', 'JNB'], ['EZE', 'SCL'], ['EZE', 'LIM'], ['EZE', 'BOG'], ['EZE', 'GIG'],
  ['BOG', 'LIM'], ['BOG', 'MEX'], ['LIM', 'SCL'], ['SCL', 'AKL'], ['GIG', 'MAD'],

  // Africa
  ['CAI', 'JNB'], ['CAI', 'ADD'], ['CAI', 'LOS'], ['CAI', 'CMN'], ['CAI', 'NBO'],
  ['JNB', 'CPT'], ['JNB', 'NBO'], ['JNB', 'ADD'], ['JNB', 'LOS'], ['JNB', 'PER'],
  ['ADD', 'NBO'], ['ADD', 'LOS'], ['ADD', 'DXB'], ['ADD', 'BOM'], ['LOS', 'CMN'],
  ['LOS', 'LHR'], ['CMN', 'MAD'], ['CMN', 'JFK'], ['CPT', 'LHR'], ['CPT', 'DXB'],

  // Oceania
  ['SYD', 'MEL'], ['SYD', 'AKL'], ['SYD', 'BNE'], ['SYD', 'PER'], ['MEL', 'AKL'],
  ['MEL', 'BNE'], ['MEL', 'PER'], ['MEL', 'SIN'], ['BNE', 'AKL'], ['BNE', 'PER'],
  ['AKL', 'SIN'], ['PER', 'SIN'], ['PER', 'DXB'],
];

interface SimulatedAircraftDefinition {
  id: string;
  flightNumber: string;
  callsign: string;
  airlineName: string;
  aircraftModel: string;
  registration: string;
  airportA: SimulatedAirport;
  airportB: SimulatedAirport;
  distanceKm: number;
  cruiseAltitudeFt: number;
  cruiseSpeedKts: number;
  legDurationSimSec: number;
  initialOffsetSimSec: number;
  turnSign: 1 | -1;
  microPhaseRad: number;
}

// Deterministic Mulberry32 PRNG so aircraft never change identity/route on refresh
function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dPhi = (lat2 - lat1) * DEG_TO_RAD;
  const dLambda = (lon2 - lon1) * DEG_TO_RAD;

  const sinHalfPhi = Math.sin(dPhi / 2);
  const sinHalfLambda = Math.sin(dLambda / 2);
  const a =
    sinHalfPhi * sinHalfPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfLambda * sinHalfLambda;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return EARTH_RADIUS_KM * c;
}

function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lon2 - lon1) * DEG_TO_RAD;

  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * RAD_TO_DEG) + 360) % 360;
}

function interpolateGreatCircle(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number
): { latitude: number; longitude: number } {
  const f = Math.min(1, Math.max(0, fraction));
  if (f <= 0) return { latitude: lat1, longitude: lon1 };
  if (f >= 1) return { latitude: lat2, longitude: lon2 };

  const phi1 = lat1 * DEG_TO_RAD;
  const lam1 = lon1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const lam2 = lon2 * DEG_TO_RAD;

  const x1 = Math.cos(phi1) * Math.cos(lam1);
  const y1 = Math.cos(phi1) * Math.sin(lam1);
  const z1 = Math.sin(phi1);

  const x2 = Math.cos(phi2) * Math.cos(lam2);
  const y2 = Math.cos(phi2) * Math.sin(lam2);
  const z2 = Math.sin(phi2);

  const dot = Math.min(1, Math.max(-1, x1 * x2 + y1 * y2 + z1 * z2));
  const omega = Math.acos(dot);

  if (omega < 1e-6) {
    return {
      latitude: lat1 + (lat2 - lat1) * f,
      longitude: lon1 + (lon2 - lon1) * f,
    };
  }

  const sinOmega = Math.sin(omega);
  const w1 = Math.sin((1 - f) * omega) / sinOmega;
  const w2 = Math.sin(f * omega) / sinOmega;

  const x = w1 * x1 + w2 * x2;
  const y = w1 * y1 + w2 * y2;
  const z = w1 * z1 + w2 * z2;

  const lat = Math.atan2(z, Math.sqrt(x * x + y * y)) * RAD_TO_DEG;
  const lon = Math.atan2(y, x) * RAD_TO_DEG;
  return { latitude: lat, longitude: lon };
}

/**
 * Computes aircraft coordinates along its great-circle route with smooth curved
 * departure climb-out and arrival vector turns near the endpoints.
 */
function computeRoutePointWithTurns(
  origin: SimulatedAirport,
  destination: SimulatedAirport,
  fraction: number,
  turnSign: 1 | -1,
  distanceKm: number
): { latitude: number; longitude: number } {
  const f = Math.min(1, Math.max(0, fraction));
  const base = interpolateGreatCircle(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
    f
  );

  // Subtle lateral S-curve during departure (0..0.14) and arrival (0.86..1.0)
  // scaled safely to route distance so aircraft exhibit smooth banking turns.
  let lateralKm = 0;
  const maxTurnKm = Math.min(28, Math.max(4, distanceKm * 0.012));

  if (f > 0.002 && f < 0.14) {
    const u = f / 0.14;
    lateralKm = Math.sin(u * Math.PI) * maxTurnKm * turnSign;
  } else if (f > 0.86 && f < 0.998) {
    const u = (f - 0.86) / 0.14;
    lateralKm = -Math.sin(u * Math.PI) * maxTurnKm * turnSign;
  }

  if (Math.abs(lateralKm) < 0.05) {
    return base;
  }

  const nextSample = interpolateGreatCircle(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
    Math.min(1, f + 0.005)
  );
  const trackRad =
    initialBearingDeg(base.latitude, base.longitude, nextSample.latitude, nextSample.longitude) *
    DEG_TO_RAD;
  const perpRad = trackRad + Math.PI / 2;

  const dLatDeg = ((lateralKm * Math.cos(perpRad)) / EARTH_RADIUS_KM) * RAD_TO_DEG;
  const cosLat = Math.max(0.2, Math.cos(base.latitude * DEG_TO_RAD));
  const dLonDeg = ((lateralKm * Math.sin(perpRad)) / (EARTH_RADIUS_KM * cosLat)) * RAD_TO_DEG;

  let lon = base.longitude + dLonDeg;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;

  return {
    latitude: Math.max(-84, Math.min(84, base.latitude + dLatDeg)),
    longitude: lon,
  };
}

function buildDeterministicFleet(): SimulatedAircraftDefinition[] {
  const rng = createSeededRandom(20261119);
  const fleet: SimulatedAircraftDefinition[] = [];
  const usedNumbers = new Set<string>();

  for (let i = 0; i < SIMULATED_AIRCRAFT_COUNT; i++) {
    const pair = GLOBAL_ROUTE_CORRIDORS[i % GLOBAL_ROUTE_CORRIDORS.length];
    const reverseInitial = i >= GLOBAL_ROUTE_CORRIDORS.length && i % 2 === 1;
    const airportA = AIRPORT_BY_IATA.get(reverseInitial ? pair[1] : pair[0])!;
    const airportB = AIRPORT_BY_IATA.get(reverseInitial ? pair[0] : pair[1])!;

    const distanceKm = Math.max(
      180,
      Math.round(
        haversineDistanceKm(
          airportA.latitude,
          airportA.longitude,
          airportB.latitude,
          airportB.longitude
        )
      )
    );

    // Choose a realistic aircraft model suited to the route range
    const suitableModels = AIRCRAFT_MODELS.filter(
      (m) => distanceKm >= m.minRangeKm && distanceKm <= m.maxRangeKm
    );
    const modelPool = suitableModels.length > 0 ? suitableModels : AIRCRAFT_MODELS;
    const modelSpec = modelPool[Math.floor(rng() * modelPool.length)];

    const carrier = FICTIONAL_CARRIERS[(i + Math.floor(rng() * 3)) % FICTIONAL_CARRIERS.length];

    let num = 100 + Math.floor(rng() * 880);
    while (usedNumbers.has(`${carrier.code}${num}`)) {
      num = ((num + 7) % 880) + 100;
    }
    usedNumbers.add(`${carrier.code}${num}`);

    const flightNumber = `${carrier.code} ${num}`;
    const callsign = `${carrier.callsignPrefix}${num}`;
    const regSuffix = String(100 + i).slice(-3);
    const regLetter = String.fromCharCode(65 + (i % 26));
    const registration = `${carrier.regPrefix}${regSuffix}${regLetter}`;

    const cruiseAltitudeFt =
      Math.round(
        (modelSpec.cruiseAltMinFt +
          rng() * (modelSpec.cruiseAltMaxFt - modelSpec.cruiseAltMinFt)) /
          1000
      ) * 1000;
    const cruiseSpeedKts = Math.round(
      modelSpec.cruiseSpeedMinKts +
        rng() * (modelSpec.cruiseSpeedMaxKts - modelSpec.cruiseSpeedMinKts)
    );

    // Realistic block flight time in simulated seconds (avg speed ~88% of cruise to account for climb/descent)
    const avgGroundSpeedKmh = cruiseSpeedKts * KM_PER_NM * 0.88;
    const legDurationSimSec = Math.max(
      1800,
      Math.round((distanceKm / avgGroundSpeedKmh) * 3600)
    );
    const fullCycleSimSec = 2 * (legDurationSimSec + TURNAROUND_SIM_SECONDS);

    // Distribute initial flight progress smoothly across the globe (biased airborne so map starts lively)
    const initialOffsetSimSec = Math.floor(rng() * fullCycleSimSec);

    fleet.push({
      id: `sim-${String(i + 1).padStart(3, '0')}`,
      flightNumber,
      callsign,
      airlineName: carrier.name,
      aircraftModel: modelSpec.model,
      registration,
      airportA,
      airportB,
      distanceKm,
      cruiseAltitudeFt,
      cruiseSpeedKts,
      legDurationSimSec,
      initialOffsetSimSec,
      turnSign: i % 2 === 0 ? 1 : -1,
      microPhaseRad: rng() * Math.PI * 2,
    });
  }

  return fleet;
}

const SIMULATED_FLEET: SimulatedAircraftDefinition[] = buildDeterministicFleet();

function formatEtaTime(etaDate: Date): string {
  return etaDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function evaluateAircraftAtTime(
  def: SimulatedAircraftDefinition,
  nowMs: number
): SimulatedAircraftState {
  const simElapsedSec = (nowMs / 1000) * SIM_TIME_SCALE + def.initialOffsetSimSec;
  const halfCycleSec = def.legDurationSimSec + TURNAROUND_SIM_SECONDS;
  const fullCycleSec = halfCycleSec * 2;
  const cyclePosSec = ((simElapsedSec % fullCycleSec) + fullCycleSec) % fullCycleSec;

  const isReturnLeg = cyclePosSec >= halfCycleSec;
  const legPosSec = isReturnLeg ? cyclePosSec - halfCycleSec : cyclePosSec;

  const origin = isReturnLeg ? def.airportB : def.airportA;
  const destination = isReturnLeg ? def.airportA : def.airportB;

  // Ground turnaround at destination airport before next departure (no teleportation)
  if (legPosSec >= def.legDurationSimSec) {
    const nextOrigin = destination;
    const nextDestination = origin;
    const headingDeg = Math.round(
      initialBearingDeg(
        nextOrigin.latitude,
        nextOrigin.longitude,
        nextDestination.latitude,
        nextDestination.longitude
      )
    );
    const etaDate = new Date(
      nowMs + ((halfCycleSec - legPosSec + def.legDurationSimSec) / SIM_TIME_SCALE) * 1000
    );

    return {
      id: def.id,
      flightNumber: def.flightNumber,
      callsign: def.callsign,
      airlineName: def.airlineName,
      aircraftModel: def.aircraftModel,
      registration: def.registration,
      origin,
      destination,
      flightStatus: 'On Ground',
      onGround: true,
      latitude: destination.latitude,
      longitude: destination.longitude,
      altitudeFt: 0,
      altitudeM: 0,
      groundSpeedKts: 0,
      groundSpeedKmh: 0,
      headingDeg,
      compassDirection: getCompassFromHeading(headingDeg),
      verticalSpeedFpm: 0,
      progressPercent: 100,
      totalDistanceKm: def.distanceKm,
      remainingDistanceKm: 0,
      remainingDistanceNm: 0,
      estimatedArrivalTimeIso: etaDate.toISOString(),
      estimatedArrivalLabel: 'Arrived · Turnaround',
      legFraction: 1,
      lastUpdated: nowMs,
    };
  }

  const f = Math.min(0.9999, Math.max(0.0001, legPosSec / def.legDurationSimSec));
  const pos = computeRoutePointWithTurns(origin, destination, f, def.turnSign, def.distanceKm);

  // Instantaneous heading computed directly along actual curved path
  const df = 0.0015;
  const aheadPos = computeRoutePointWithTurns(
    origin,
    destination,
    Math.min(1, f + df),
    def.turnSign,
    def.distanceKm
  );
  const headingDeg = Math.round(
    initialBearingDeg(pos.latitude, pos.longitude, aheadPos.latitude, aheadPos.longitude)
  );

  // Flight Phase Physics: Takeoff -> Climbing -> Cruising -> Descending -> Approach
  const microWave = Math.sin((nowMs / 1000) * 0.25 + def.microPhaseRad);
  const microWaveSlow = Math.cos((nowMs / 1000) * 0.11 + def.microPhaseRad);

  let flightStatus: SimulatedFlightStatus;
  let altitudeFt: number;
  let groundSpeedKts: number;
  let verticalSpeedFpm: number;

  if (f < 0.03) {
    // Takeoff & initial climb-out
    const u = f / 0.03;
    flightStatus = 'Takeoff';
    altitudeFt = Math.round(250 + u * 4750);
    groundSpeedKts = Math.round(145 + u * 105);
    verticalSpeedFpm = Math.round(2100 + microWave * 350);
  } else if (f < 0.14) {
    // Climb to cruise flight level
    const u = (f - 0.03) / 0.11;
    const eased = 1 - Math.pow(1 - u, 1.8);
    flightStatus = 'Climbing';
    altitudeFt = Math.round(5000 + eased * (def.cruiseAltitudeFt - 5000));
    groundSpeedKts = Math.round(250 + eased * (def.cruiseSpeedKts - 250));
    verticalSpeedFpm = Math.round(1850 * (1 - u * 0.45) + microWave * 180);
  } else if (f < 0.85) {
    // High-altitude cruise with realistic slight step-climb/turbulence variation
    flightStatus = 'Cruising';
    altitudeFt = Math.round(def.cruiseAltitudeFt + microWaveSlow * 240 + microWave * 60);
    groundSpeedKts = Math.round(def.cruiseSpeedKts + microWaveSlow * 12 + microWave * 4);
    verticalSpeedFpm = Math.round(microWave * 95);
  } else if (f < 0.96) {
    // Controlled descent
    const u = (f - 0.85) / 0.11;
    const eased = Math.pow(u, 1.3);
    flightStatus = 'Descending';
    altitudeFt = Math.round(def.cruiseAltitudeFt - eased * (def.cruiseAltitudeFt - 3600));
    groundSpeedKts = Math.round(def.cruiseSpeedKts - eased * (def.cruiseSpeedKts - 235));
    verticalSpeedFpm = Math.round(-1650 + microWave * 210);
  } else {
    // Final approach
    const u = (f - 0.96) / 0.04;
    flightStatus = 'Approach';
    altitudeFt = Math.round(Math.max(150, 3600 * (1 - u)));
    groundSpeedKts = Math.round(235 - u * 90);
    verticalSpeedFpm = Math.round(-820 + microWave * 110);
  }

  const remainingDistanceKm = Math.max(0, Math.round(def.distanceKm * (1 - f)));
  const remainingDistanceNm = Math.max(0, Math.round(remainingDistanceKm / KM_PER_NM));
  const progressPercent = Math.min(99, Math.max(1, Math.round(f * 100)));

  // Realistic wall-clock ETA based on real remaining distance & current airspeed
  const effectiveSpeedKmh = Math.max(260, groundSpeedKts * KM_PER_NM);
  const remainingRealHours = remainingDistanceKm / effectiveSpeedKmh;
  const etaDate = new Date(nowMs + remainingRealHours * 3600 * 1000);

  return {
    id: def.id,
    flightNumber: def.flightNumber,
    callsign: def.callsign,
    airlineName: def.airlineName,
    aircraftModel: def.aircraftModel,
    registration: def.registration,
    origin,
    destination,
    flightStatus,
    onGround: false,
    latitude: pos.latitude,
    longitude: pos.longitude,
    altitudeFt,
    altitudeM: Math.round(altitudeFt / FEET_PER_METER),
    groundSpeedKts,
    groundSpeedKmh: Math.round(groundSpeedKts * KM_PER_NM),
    headingDeg,
    compassDirection: getCompassFromHeading(headingDeg),
    verticalSpeedFpm,
    progressPercent,
    totalDistanceKm: def.distanceKm,
    remainingDistanceKm,
    remainingDistanceNm,
    estimatedArrivalTimeIso: etaDate.toISOString(),
    estimatedArrivalLabel: formatEtaTime(etaDate),
    legFraction: f,
    lastUpdated: nowMs,
  };
}

/**
 * Evaluates all 160 deterministic simulated aircraft at the given epoch timestamp.
 */
export function getSimulatedAircraftSnapshot(nowMs = Date.now()): SimulatedAircraftState[] {
  return SIMULATED_FLEET.map((def) => evaluateAircraftAtTime(def, nowMs));
}

/**
 * Splits a polyline wherever consecutive points cross the antimeridian (±180° longitude)
 * so Leaflet renders trans-Pacific paths cleanly without horizontal wrap-around artifacts.
 */
function splitAcrossAntimeridian(points: [number, number][]): [number, number][][] {
  if (points.length === 0) return [];
  const segments: [number, number][][] = [];
  let current: [number, number][] = [points[0]];

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (Math.abs(curr[1] - prev[1]) > 180) {
      if (current.length > 1) segments.push(current);
      current = [curr];
    } else {
      current.push(curr);
    }
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

export interface SimulatedFlightPathSegments {
  completedSegments: [number, number][][];
  remainingSegments: [number, number][][];
}

/**
 * Builds completed and remaining fictional route polylines for a selected aircraft.
 */
export function getSimulatedFlightPath(
  aircraft: SimulatedAircraftState
): SimulatedFlightPathSegments {
  const def = SIMULATED_FLEET.find((item) => item.id === aircraft.id);
  const turnSign: 1 | -1 = def?.turnSign ?? 1;
  const steps = 48;
  const fCurrent = Math.min(1, Math.max(0, aircraft.legFraction));

  const completedPoints: [number, number][] = [];
  const remainingPoints: [number, number][] = [];

  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const pt = computeRoutePointWithTurns(
      aircraft.origin,
      aircraft.destination,
      f,
      turnSign,
      aircraft.totalDistanceKm
    );
    const tuple: [number, number] = [pt.latitude, pt.longitude];

    if (f < fCurrent) {
      completedPoints.push(tuple);
    } else {
      remainingPoints.push(tuple);
    }
  }

  const currentTuple: [number, number] = [aircraft.latitude, aircraft.longitude];
  completedPoints.push(currentTuple);
  remainingPoints.unshift(currentTuple);

  return {
    completedSegments: splitAcrossAntimeridian(completedPoints),
    remainingSegments: splitAcrossAntimeridian(remainingPoints),
  };
}
