import { FlightRecord, FlightStatus, FirestoreFlightDoc } from '../types/flight';

/**
 * Strict Airline Flight Number Regex:
 * 2 to 3 alphabetical characters for the carrier code, optional single space,
 * followed by 1 to 4 digits, and optional single letter suffix.
 */
export const FLIGHT_FORMAT_REGEX = /^[A-Z]{2,3}\s?[0-9]{1,4}[A-Z]?$/i;

/**
 * Helper to compute dynamic target Date objects relative to now:
 * dayOffset 0 = Today, 1 = Tomorrow, 2 = Day After Tomorrow
 */
export function getRelativeDate(dayOffset: number, hours = 0, minutes = 0): Date {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hours, minutes, 0, 0);
  return d;
}

export function formatDateString(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatFullDateString(date: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

/**
 * Deterministic hash algorithm (djb2 variant) for date and flight-based variations
 */
export function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

export function formatTimeString(hours: number, minutes: number): string {
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${displayHours}:${displayMinutes} ${period}`;
}

export interface RawFlightBlueprint {
  flightNumber: string;
  airlineName: string;
  iata: string;
  icao: string;
  callsign: string;
  accentColor: string;
  origin: {
    iata: string;
    icao: string;
    name: string;
    city: string;
    country: string;
    terminal: string;
    gate: string;
  };
  destination: {
    iata: string;
    icao: string;
    name: string;
    city: string;
    country: string;
    terminal: string;
    gate: string;
  };
  aircraftModel: string;
  registration: string;
  departureHour: number;
  departureMinute: number;
  durationMinutes: number;
  routeType: 'domestic' | 'international';
  distanceKm: number;
  typicalDelayMinutes?: number;
  cancelledOnDay?: number; // e.g. 1 for tomorrow
}

export const BLUEPRINTS: RawFlightBlueprint[] = [
  // --- A. Bangladesh Domestic Routes (DAC Hub) ---
  {
    flightNumber: 'BS 161',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 6',
    },
    destination: {
      iata: 'RJH',
      icao: 'VGRJ',
      name: 'Shah Makhdum Airport',
      city: 'Rajshahi',
      country: 'Bangladesh',
      terminal: 'Main Terminal',
      gate: 'Gate 1',
    },
    aircraftModel: 'ATR 72-600',
    registration: 'S2-AKG',
    departureHour: 10,
    departureMinute: 0,
    durationMinutes: 50,
    routeType: 'domestic',
    distanceKm: 210,
  },
  {
    flightNumber: 'BS 105',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 8',
    },
    destination: {
      iata: 'CGP',
      icao: 'VGEG',
      name: 'Shah Amanat International Airport',
      city: 'Chattogram',
      country: 'Bangladesh',
      terminal: 'Domestic Arrivals',
      gate: 'Gate 2',
    },
    aircraftModel: 'Boeing 737-800',
    registration: 'S2-AJA',
    departureHour: 10,
    departureMinute: 30,
    durationMinutes: 50,
    routeType: 'domestic',
    distanceKm: 228,
  },
  {
    flightNumber: 'BG 601',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 11',
    },
    destination: {
      iata: 'ZYL',
      icao: 'VGSY',
      name: 'Osmani International Airport',
      city: 'Sylhet',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal',
      gate: 'Gate 3',
    },
    aircraftModel: 'De Havilland Dash 8-400',
    registration: 'S2-AJU',
    departureHour: 10,
    departureMinute: 50,
    durationMinutes: 55,
    routeType: 'domestic',
    distanceKm: 200,
  },
  {
    flightNumber: 'BG 591',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 12',
    },
    destination: {
      iata: 'SPD',
      icao: 'VGSD',
      name: 'Saidpur Airport',
      city: 'Saidpur',
      country: 'Bangladesh',
      terminal: 'Passenger Terminal',
      gate: 'Gate 1',
    },
    aircraftModel: 'De Havilland Dash 8-400',
    registration: 'S2-AKD',
    departureHour: 11,
    departureMinute: 0,
    durationMinutes: 60,
    routeType: 'domestic',
    distanceKm: 310,
  },
  {
    flightNumber: 'BS 107',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 7',
    },
    destination: {
      iata: 'CGP',
      icao: 'VGEG',
      name: 'Shah Amanat International Airport',
      city: 'Chattogram',
      country: 'Bangladesh',
      terminal: 'Domestic Arrivals',
      gate: 'Gate 4',
    },
    aircraftModel: 'Boeing 737-800',
    registration: 'S2-AJB',
    departureHour: 12,
    departureMinute: 0,
    durationMinutes: 50,
    routeType: 'domestic',
    distanceKm: 228,
  },
  {
    flightNumber: 'BS 143',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 9',
    },
    destination: {
      iata: 'CXB',
      icao: 'VGCB',
      name: "Cox's Bazar Airport",
      city: "Cox's Bazar",
      country: 'Bangladesh',
      terminal: 'Arrivals Concourse',
      gate: 'Gate 2',
    },
    aircraftModel: 'Boeing 737-800',
    registration: 'S2-AKB',
    departureHour: 13,
    departureMinute: 15,
    durationMinutes: 65,
    routeType: 'domestic',
    distanceKm: 300,
  },
  {
    flightNumber: 'VQ 925',
    airlineName: 'Novoair',
    iata: 'VQ',
    icao: 'NVQ',
    callsign: 'NOVO AIR',
    accentColor: '#E65100',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 5',
    },
    destination: {
      iata: 'JSR',
      icao: 'VGJR',
      name: 'Jashore Airport',
      city: 'Jashore',
      country: 'Bangladesh',
      terminal: 'Main Terminal',
      gate: 'Gate 1',
    },
    aircraftModel: 'ATR 72-500',
    registration: 'S2-AHL',
    departureHour: 14,
    departureMinute: 30,
    durationMinutes: 45,
    routeType: 'domestic',
    distanceKm: 140,
  },
  {
    flightNumber: '2A 411',
    airlineName: 'Air Astra',
    iata: '2A',
    icao: 'AWA',
    callsign: 'AIR ASTRA',
    accentColor: '#00838F',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 4',
    },
    destination: {
      iata: 'BZL',
      icao: 'VGBR',
      name: 'Barishal Airport',
      city: 'Barishal',
      country: 'Bangladesh',
      terminal: 'Domestic Concourse',
      gate: 'Gate 1',
    },
    aircraftModel: 'ATR 72-600',
    registration: 'S2-STB',
    departureHour: 16,
    departureMinute: 0,
    durationMinutes: 40,
    routeType: 'domestic',
    distanceKm: 120,
  },

  // --- B. Major International Routes (DAC Hub) ---
  {
    flightNumber: 'EK 585',
    airlineName: 'Emirates',
    iata: 'EK',
    icao: 'UAE',
    callsign: 'EMIRATES',
    accentColor: '#D71921',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 3',
    },
    destination: {
      iata: 'DXB',
      icao: 'OMDB',
      name: 'Dubai International Airport',
      city: 'Dubai',
      country: 'United Arab Emirates',
      terminal: 'Terminal 3',
      gate: 'Gate B12',
    },
    aircraftModel: 'Boeing 777-300ER',
    registration: 'A6-EPU',
    departureHour: 1,
    departureMinute: 40,
    durationMinutes: 285, // 4h 45m
    routeType: 'international',
    distanceKm: 3540,
    typicalDelayMinutes: 45,
  },
  {
    flightNumber: 'SQ 447',
    airlineName: 'Singapore Airlines',
    iata: 'SQ',
    icao: 'SIA',
    callsign: 'SINGAPORE',
    accentColor: '#1A365D',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 4',
    },
    destination: {
      iata: 'SIN',
      icao: 'WSSS',
      name: 'Singapore Changi Airport',
      city: 'Singapore',
      country: 'Singapore',
      terminal: 'Terminal 3',
      gate: 'Gate B2',
    },
    aircraftModel: 'Airbus A350-900',
    registration: '9V-SMG',
    departureHour: 0,
    departureMinute: 5,
    durationMinutes: 255, // 4h 15m
    routeType: 'international',
    distanceKm: 2890,
  },
  {
    flightNumber: 'MH 197',
    airlineName: 'Malaysia Airlines',
    iata: 'MH',
    icao: 'MAS',
    callsign: 'MALAYSIAN',
    accentColor: '#002970',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 2',
    },
    destination: {
      iata: 'KUL',
      icao: 'WMKK',
      name: 'Kuala Lumpur International Airport',
      city: 'Kuala Lumpur',
      country: 'Malaysia',
      terminal: 'Terminal 1',
      gate: 'Gate G4',
    },
    aircraftModel: 'Boeing 737-800',
    registration: '9M-MXB',
    departureHour: 12,
    departureMinute: 15,
    durationMinutes: 230, // 3h 50m
    routeType: 'international',
    distanceKm: 2630,
  },
  {
    flightNumber: 'QR 643',
    airlineName: 'Qatar Airways',
    iata: 'QR',
    icao: 'QTR',
    callsign: 'QATARI',
    accentColor: '#5C0632',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 5',
    },
    destination: {
      iata: 'DOH',
      icao: 'OTHH',
      name: 'Hamad International Airport',
      city: 'Doha',
      country: 'Qatar',
      terminal: 'Main Terminal',
      gate: 'Concourse C',
    },
    aircraftModel: 'Boeing 787-8 Dreamliner',
    registration: 'A7-BCX',
    departureHour: 20,
    departureMinute: 0,
    durationMinutes: 315, // 5h 15m
    routeType: 'international',
    distanceKm: 3910,
  },
  {
    flightNumber: 'BG 201',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 6',
    },
    destination: {
      iata: 'LHR',
      icao: 'EGLL',
      name: 'London Heathrow Airport',
      city: 'London',
      country: 'United Kingdom',
      terminal: 'Terminal 4',
      gate: 'Gate 22',
    },
    aircraftModel: 'Boeing 787-9 Dreamliner',
    registration: 'S2-AJX',
    departureHour: 9,
    departureMinute: 30,
    durationMinutes: 670, // 11h 10m
    routeType: 'international',
    distanceKm: 7990,
  },
  {
    flightNumber: 'TG 322',
    airlineName: 'Thai Airways',
    iata: 'TG',
    icao: 'THA',
    callsign: 'THAI',
    accentColor: '#4A148C',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 1',
    },
    destination: {
      iata: 'BKK',
      icao: 'VTBS',
      name: 'Suvarnabhumi Airport',
      city: 'Bangkok',
      country: 'Thailand',
      terminal: 'Main Terminal',
      gate: 'Concourse D',
    },
    aircraftModel: 'Boeing 777-200ER',
    registration: 'HS-TJW',
    departureHour: 13,
    departureMinute: 35,
    durationMinutes: 150, // 2h 30m
    routeType: 'international',
    distanceKm: 1550,
  },

  // --- C. Legacy & Cross-Continent Flagship Routes ---
  {
    flightNumber: 'BG 001',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Terminal 2',
      gate: 'Gate 14',
    },
    destination: {
      iata: 'LHR',
      icao: 'EGLL',
      name: 'London Heathrow Airport',
      city: 'London',
      country: 'United Kingdom',
      terminal: 'Terminal 4',
      gate: 'Gate B32',
    },
    aircraftModel: 'Boeing 787-9 Dreamliner',
    registration: 'S2-AJX',
    departureHour: 10,
    departureMinute: 30,
    durationMinutes: 645, // 10h 45m
    routeType: 'international',
    distanceKm: 7990,
  },
  {
    flightNumber: 'SQ 308',
    airlineName: 'Singapore Airlines',
    iata: 'SQ',
    icao: 'SIA',
    callsign: 'SINGAPORE',
    accentColor: '#1A365D',
    origin: {
      iata: 'SIN',
      icao: 'WSSS',
      name: 'Singapore Changi Airport',
      city: 'Singapore',
      country: 'Singapore',
      terminal: 'Terminal 3',
      gate: 'Gate B2',
    },
    destination: {
      iata: 'LHR',
      icao: 'EGLL',
      name: 'London Heathrow Airport',
      city: 'London',
      country: 'United Kingdom',
      terminal: 'Terminal 2',
      gate: 'Gate B42',
    },
    aircraftModel: 'Boeing 777-300ER',
    registration: '9V-SWB',
    departureHour: 9,
    departureMinute: 0,
    durationMinutes: 875,
    routeType: 'international',
    distanceKm: 10880,
  },
  {
    flightNumber: 'AA 100',
    airlineName: 'American Airlines',
    iata: 'AA',
    icao: 'AAL',
    callsign: 'AMERICAN',
    accentColor: '#0078D2',
    origin: {
      iata: 'JFK',
      icao: 'KJFK',
      name: 'John F. Kennedy International Airport',
      city: 'New York',
      country: 'United States',
      terminal: 'Terminal 8',
      gate: 'Gate 12',
    },
    destination: {
      iata: 'LHR',
      icao: 'EGLL',
      name: 'London Heathrow Airport',
      city: 'London',
      country: 'United Kingdom',
      terminal: 'Terminal 3',
      gate: 'Gate 18',
    },
    aircraftModel: 'Boeing 777-300ER',
    registration: 'N718AN',
    departureHour: 18,
    departureMinute: 25,
    durationMinutes: 425,
    routeType: 'international',
    distanceKm: 5540,
  },
  {
    flightNumber: 'BA 117',
    airlineName: 'British Airways',
    iata: 'BA',
    icao: 'BAW',
    callsign: 'SPEEDBIRD',
    accentColor: '#075AAA',
    origin: {
      iata: 'LHR',
      icao: 'EGLL',
      name: 'London Heathrow Airport',
      city: 'London',
      country: 'United Kingdom',
      terminal: 'Terminal 5',
      gate: 'Gate A10',
    },
    destination: {
      iata: 'JFK',
      icao: 'KJFK',
      name: 'John F. Kennedy International Airport',
      city: 'New York',
      country: 'United States',
      terminal: 'Terminal 8',
      gate: 'Gate 4',
    },
    aircraftModel: 'Boeing 777-200ER',
    registration: 'G-YMMB',
    departureHour: 8,
    departureMinute: 30,
    durationMinutes: 475,
    routeType: 'international',
    distanceKm: 5540,
  },
  {
    flightNumber: 'DL 890',
    airlineName: 'Delta Air Lines',
    iata: 'DL',
    icao: 'DAL',
    callsign: 'DELTA',
    accentColor: '#E01933',
    origin: {
      iata: 'ATL',
      icao: 'KATL',
      name: 'Hartsfield-Jackson Atlanta International Airport',
      city: 'Atlanta',
      country: 'United States',
      terminal: 'Terminal S',
      gate: 'Gate F4',
    },
    destination: {
      iata: 'CDG',
      icao: 'LFPG',
      name: 'Paris Charles de Gaulle Airport',
      city: 'Paris',
      country: 'France',
      terminal: 'Terminal 2E',
      gate: 'Gate K32',
    },
    aircraftModel: 'Airbus A350-900',
    registration: 'N502DN',
    departureHour: 19,
    departureMinute: 40,
    durationMinutes: 515,
    routeType: 'international',
    distanceKm: 7060,
    cancelledOnDay: 0,
  },
  {
    flightNumber: 'BS 147',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 9',
    },
    destination: {
      iata: 'CXB',
      icao: 'VGCB',
      name: "Cox's Bazar Airport",
      city: "Cox's Bazar",
      country: 'Bangladesh',
      terminal: 'Arrivals Concourse',
      gate: 'Gate 1',
    },
    aircraftModel: 'Boeing 737-800',
    registration: 'S2-AJC',
    departureHour: 17,
    departureMinute: 30,
    durationMinutes: 65,
    routeType: 'domestic',
    distanceKm: 300,
  },
  {
    flightNumber: 'BS 111',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 5',
    },
    destination: {
      iata: 'SPD',
      icao: 'VGSD',
      name: 'Saidpur Airport',
      city: 'Saidpur',
      country: 'Bangladesh',
      terminal: 'Passenger Terminal',
      gate: 'Gate 2',
    },
    aircraftModel: 'ATR 72-600',
    registration: 'S2-AKH',
    departureHour: 8,
    departureMinute: 30,
    durationMinutes: 55,
    routeType: 'domestic',
    distanceKm: 310,
  },
  {
    flightNumber: 'BS 121',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 7',
    },
    destination: {
      iata: 'JSR',
      icao: 'VGJR',
      name: 'Jashore Airport',
      city: 'Jashore',
      country: 'Bangladesh',
      terminal: 'Main Terminal',
      gate: 'Gate 2',
    },
    aircraftModel: 'ATR 72-600',
    registration: 'S2-AKE',
    departureHour: 11,
    departureMinute: 30,
    durationMinutes: 45,
    routeType: 'domestic',
    distanceKm: 140,
  },
  {
    flightNumber: 'BS 131',
    airlineName: 'US-Bangla Airlines',
    iata: 'BS',
    icao: 'UBG',
    callsign: 'BANGLASTAR',
    accentColor: '#174A84',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 6',
    },
    destination: {
      iata: 'BZL',
      icao: 'VGBR',
      name: 'Barishal Airport',
      city: 'Barishal',
      country: 'Bangladesh',
      terminal: 'Domestic Concourse',
      gate: 'Gate 2',
    },
    aircraftModel: 'ATR 72-600',
    registration: 'S2-AKF',
    departureHour: 15,
    departureMinute: 15,
    durationMinutes: 40,
    routeType: 'domestic',
    distanceKm: 120,
  },
  {
    flightNumber: 'BG 603',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 10',
    },
    destination: {
      iata: 'ZYL',
      icao: 'VGSY',
      name: 'Osmani International Airport',
      city: 'Sylhet',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal',
      gate: 'Gate 1',
    },
    aircraftModel: 'De Havilland Dash 8-400',
    registration: 'S2-AKC',
    departureHour: 16,
    departureMinute: 45,
    durationMinutes: 55,
    routeType: 'domestic',
    distanceKm: 200,
  },
  {
    flightNumber: 'BG 433',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 12',
    },
    destination: {
      iata: 'CXB',
      icao: 'VGCB',
      name: "Cox's Bazar Airport",
      city: "Cox's Bazar",
      country: 'Bangladesh',
      terminal: 'Arrivals Concourse',
      gate: 'Gate 3',
    },
    aircraftModel: 'Boeing 737-800',
    registration: 'S2-AHV',
    departureHour: 9,
    departureMinute: 15,
    durationMinutes: 65,
    routeType: 'domestic',
    distanceKm: 300,
  },
  {
    flightNumber: 'BG 411',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 11',
    },
    destination: {
      iata: 'CGP',
      icao: 'VGEG',
      name: 'Shah Amanat International Airport',
      city: 'Chattogram',
      country: 'Bangladesh',
      terminal: 'Domestic Arrivals',
      gate: 'Gate 1',
    },
    aircraftModel: 'Boeing 737-800',
    registration: 'S2-AHW',
    departureHour: 14,
    departureMinute: 30,
    durationMinutes: 50,
    routeType: 'domestic',
    distanceKm: 228,
  },
  {
    flightNumber: 'BG 491',
    airlineName: 'Biman Bangladesh Airlines',
    iata: 'BG',
    icao: 'BBC',
    callsign: 'BANGLADESH',
    accentColor: '#006A4E',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 8',
    },
    destination: {
      iata: 'RJH',
      icao: 'VGRJ',
      name: 'Shah Makhdum Airport',
      city: 'Rajshahi',
      country: 'Bangladesh',
      terminal: 'Main Terminal',
      gate: 'Gate 2',
    },
    aircraftModel: 'De Havilland Dash 8-400',
    registration: 'S2-AKB',
    departureHour: 19,
    departureMinute: 15,
    durationMinutes: 50,
    routeType: 'domestic',
    distanceKm: 210,
  },
  {
    flightNumber: 'VQ 931',
    airlineName: 'Novoair',
    iata: 'VQ',
    icao: 'NVQ',
    callsign: 'NOVO AIR',
    accentColor: '#E65100',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 3',
    },
    destination: {
      iata: 'CXB',
      icao: 'VGCB',
      name: "Cox's Bazar Airport",
      city: "Cox's Bazar",
      country: 'Bangladesh',
      terminal: 'Arrivals Concourse',
      gate: 'Gate 2',
    },
    aircraftModel: 'ATR 72-500',
    registration: 'S2-AHM',
    departureHour: 10,
    departureMinute: 30,
    durationMinutes: 65,
    routeType: 'domestic',
    distanceKm: 300,
  },
  {
    flightNumber: 'VQ 907',
    airlineName: 'Novoair',
    iata: 'VQ',
    icao: 'NVQ',
    callsign: 'NOVO AIR',
    accentColor: '#E65100',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 5',
    },
    destination: {
      iata: 'CGP',
      icao: 'VGEG',
      name: 'Shah Amanat International Airport',
      city: 'Chattogram',
      country: 'Bangladesh',
      terminal: 'Domestic Arrivals',
      gate: 'Gate 3',
    },
    aircraftModel: 'ATR 72-500',
    registration: 'S2-AHN',
    departureHour: 18,
    departureMinute: 25,
    durationMinutes: 50,
    routeType: 'domestic',
    distanceKm: 228,
  },
  {
    flightNumber: '2A 441',
    airlineName: 'Air Astra',
    iata: '2A',
    icao: 'AWA',
    callsign: 'AIR ASTRA',
    accentColor: '#00838F',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'Domestic Terminal 2',
      gate: 'Gate 4',
    },
    destination: {
      iata: 'CXB',
      icao: 'VGCB',
      name: "Cox's Bazar Airport",
      city: "Cox's Bazar",
      country: 'Bangladesh',
      terminal: 'Arrivals Concourse',
      gate: 'Gate 4',
    },
    aircraftModel: 'ATR 72-600',
    registration: 'S2-STA',
    departureHour: 8,
    departureMinute: 30,
    durationMinutes: 65,
    routeType: 'domestic',
    distanceKm: 300,
  },
  {
    flightNumber: 'EK 587',
    airlineName: 'Emirates',
    iata: 'EK',
    icao: 'UAE',
    callsign: 'EMIRATES',
    accentColor: '#D71921',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 3',
    },
    destination: {
      iata: 'DXB',
      icao: 'OMDB',
      name: 'Dubai International Airport',
      city: 'Dubai',
      country: 'United Arab Emirates',
      terminal: 'Terminal 3',
      gate: 'Gate B18',
    },
    aircraftModel: 'Boeing 777-300ER',
    registration: 'A6-ENQ',
    departureHour: 22,
    departureMinute: 15,
    durationMinutes: 285,
    routeType: 'international',
    distanceKm: 3540,
  },
  {
    flightNumber: 'QR 639',
    airlineName: 'Qatar Airways',
    iata: 'QR',
    icao: 'QTR',
    callsign: 'QATARI',
    accentColor: '#5C0632',
    origin: {
      iata: 'DAC',
      icao: 'VGHS',
      name: 'Hazrat Shahjalal International Airport',
      city: 'Dhaka',
      country: 'Bangladesh',
      terminal: 'International Terminal 1',
      gate: 'Gate 5',
    },
    destination: {
      iata: 'DOH',
      icao: 'OTHH',
      name: 'Hamad International Airport',
      city: 'Doha',
      country: 'Qatar',
      terminal: 'Main Terminal',
      gate: 'Concourse B',
    },
    aircraftModel: 'Boeing 787-8 Dreamliner',
    registration: 'A7-BDH',
    departureHour: 6,
    departureMinute: 30,
    durationMinutes: 315,
    routeType: 'international',
    distanceKm: 3910,
  },
];

/**
 * Generate a dynamic flight record strictly bound to an exact calendar date.
 * Features realistic date-sensitive status determination and deterministic daily variations.
 */
export function buildFlightRecordForDate(bp: RawFlightBlueprint, targetDateInput: Date | string): FlightRecord {
  let targetDate: Date;
  if (typeof targetDateInput === 'string') {
    const parts = targetDateInput.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      targetDate = new Date(targetDateInput);
    }
  } else {
    targetDate = new Date(targetDateInput.getFullYear(), targetDateInput.getMonth(), targetDateInput.getDate(), 0, 0, 0, 0);
  }

  const targetYear = targetDate.getFullYear();
  const targetMonth = targetDate.getMonth();
  const targetDay = targetDate.getDate();
  const isoDateStr = toIsoDateString(targetDate);

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const targetMidnight = new Date(targetYear, targetMonth, targetDay, 0, 0, 0, 0);
  const diffMs = targetMidnight.getTime() - todayMidnight.getTime();
  const dayOffset = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const isPast = dayOffset < 0;
  const isToday = dayOffset === 0;
  const isFuture = dayOffset > 0;

  // Deterministic seed for this flight on this specific date
  const seed = hashString(`${isoDateStr}_${bp.flightNumber}`);

  // Noticeable deterministic departure minute variation per day (-20m to +25m in 5m steps)
  // Ensures different dates produce noticeably different departure/arrival times (e.g. 10:05 vs 10:25)
  const minuteVariation = ((seed % 10) - 4) * 5;
  let depHour = bp.departureHour;
  let depMin = bp.departureMinute + minuteVariation;
  if (depMin < 0) {
    depMin += 60;
    depHour = (depHour - 1 + 24) % 24;
  } else if (depMin >= 60) {
    depMin -= 60;
    depHour = (depHour + 1) % 24;
  }

  // Exact departure and arrival Date objects bound to the user's picked day
  const depDate = new Date(targetYear, targetMonth, targetDay, depHour, depMin, 0, 0);
  const arrDate = new Date(depDate.getTime() + bp.durationMinutes * 60000);

  const depTimeMs = depDate.getTime();
  const arrTimeMs = arrDate.getTime();
  const nowMs = now.getTime();

  let status: FlightStatus = 'SCHEDULED';
  let statusLabel = 'Scheduled · On Time';
  let progressPercent = 0;
  let elapsedDuration: string | null = null;
  let remainingDuration: string | null = null;
  let actualDepTime: string | null = null;
  let estimatedDepTime: string | null = null;
  let actualArrTime: string | null = null;
  let estimatedArrTime: string | null = null;
  let delayMinutes = 0;
  let isCancelled = false;
  let reason: string | null = null;

  const hoursDuration = Math.floor(bp.durationMinutes / 60);
  const minsDuration = bp.durationMinutes % 60;
  const flightDurationFormatted = `${hoursDuration}h ${minsDuration < 10 ? '0' : ''}${minsDuration}m`;

  // Realistic, Date-Sensitive Status Logic
  if (isPast) {
    // 1. Past Dates (Before Today)
    // ~85% Arrived / Landed, ~10% historical Delayed, ~5% Cancelled.
    // Zero "Scheduled" and zero "Active / Departed"!
    const mod = seed % 100;
    if (mod < 5) {
      // ~5% Cancelled
      status = 'CANCELLED';
      statusLabel = 'Cancelled';
      isCancelled = true;
      delayMinutes = 0;
      reason = 'Historical schedule cancellation due to severe adverse weather & airspace limits';
      progressPercent = 0;
    } else if (mod < 15) {
      // ~10% Historical Delayed
      status = 'DELAYED';
      delayMinutes = 20 + (seed % 4) * 10; // +20m, +30m, +40m, +50m
      statusLabel = `Delayed (+${delayMinutes}m)`;
      isCancelled = false;
      reason = 'Historical arrival delay: Late inbound aircraft turnaround';
      progressPercent = 100;
      actualDepTime = formatTimeString(depHour, depMin);
      const adjustedArr = new Date(arrTimeMs + delayMinutes * 60000);
      actualArrTime = formatTimeString(adjustedArr.getHours(), adjustedArr.getMinutes());
      estimatedArrTime = actualArrTime;
      elapsedDuration = flightDurationFormatted;
      remainingDuration = '0m';
    } else {
      // ~85% Arrived / Landed
      status = 'ARRIVED';
      statusLabel = 'Landed · Arrived';
      progressPercent = 100;
      isCancelled = false;
      delayMinutes = 0;
      actualDepTime = formatTimeString(depHour, depMin);
      actualArrTime = formatTimeString(arrDate.getHours(), arrDate.getMinutes());
      elapsedDuration = flightDurationFormatted;
      remainingDuration = '0m';
    }
  } else if (isToday) {
    // 2. Current Date (Today)
    // Dynamic distribution based on flight departure relative to current real-time clock:
    // Past departure hours: Arrived / Landed (~40%) or Active / Departed (~20%)
    // Near current hour: Delayed (~15%) or Boarding (~20%)
    // Later in the day: Scheduled / On Time (~20%) or Cancelled (~5%)
    if (nowMs > arrTimeMs) {
      // Flights completed earlier today: Arrived / Landed
      status = 'ARRIVED';
      statusLabel = 'Landed · Arrived';
      progressPercent = 100;
      isCancelled = false;
      delayMinutes = 0;
      actualDepTime = formatTimeString(depHour, depMin);
      actualArrTime = formatTimeString(arrDate.getHours(), arrDate.getMinutes());
      elapsedDuration = flightDurationFormatted;
      remainingDuration = '0m';
    } else if (nowMs >= depTimeMs && nowMs <= arrTimeMs) {
      // Flights currently airborne: Active / Departed
      status = 'DEPARTED';
      statusLabel = 'En Route · In Flight';
      isCancelled = false;
      delayMinutes = 0;
      const elapsedMs = nowMs - depTimeMs;
      progressPercent = Math.min(96, Math.max(8, Math.round((elapsedMs / (arrTimeMs - depTimeMs)) * 100)));
      actualDepTime = formatTimeString(depHour, depMin);
      estimatedArrTime = formatTimeString(arrDate.getHours(), arrDate.getMinutes());
      const elHours = Math.floor(elapsedMs / 3600000);
      const elMins = Math.floor((elapsedMs % 3600000) / 60000);
      elapsedDuration = `${elHours}h ${elMins < 10 ? '0' : ''}${elMins}m`;
      const remMs = arrTimeMs - nowMs;
      const remHours = Math.floor(remMs / 3600000);
      const remMins = Math.floor((remMs % 3600000) / 60000);
      remainingDuration = `${remHours}h ${remMins < 10 ? '0' : ''}${remMins}m`;
    } else {
      // Flights not yet departed today
      const minsUntilDep = Math.round((depTimeMs - nowMs) / 60000);
      progressPercent = 0;
      remainingDuration = flightDurationFormatted;

      if (minsUntilDep >= 0 && minsUntilDep <= 90) {
        // Within 0-90 minutes of departure: Delayed (~15%) or Boarding (~20%)
        if ((seed % 10) < 4) {
          status = 'DELAYED';
          delayMinutes = 20 + (seed % 4) * 10;
          statusLabel = `Delayed (+${delayMinutes}m)`;
          isCancelled = false;
          const adjustedDep = new Date(depTimeMs + delayMinutes * 60000);
          const adjustedArr = new Date(arrTimeMs + delayMinutes * 60000);
          estimatedDepTime = formatTimeString(adjustedDep.getHours(), adjustedDep.getMinutes());
          estimatedArrTime = formatTimeString(adjustedArr.getHours(), adjustedArr.getMinutes());
          reason = 'Late inbound aircraft turnaround due to air traffic control congestion';
        } else {
          status = 'SCHEDULED';
          statusLabel = 'Boarding · Gate Closing';
          isCancelled = false;
          delayMinutes = 0;
          estimatedDepTime = formatTimeString(depHour, depMin);
          estimatedArrTime = formatTimeString(arrDate.getHours(), arrDate.getMinutes());
        }
      } else {
        // Later departures today
        if ((seed % 20) === 0) {
          status = 'CANCELLED';
          statusLabel = 'Cancelled';
          isCancelled = true;
          delayMinutes = 0;
          reason = 'Carrier schedule cancellation due to severe adverse weather';
        } else {
          status = 'SCHEDULED';
          statusLabel = 'Scheduled · On Time';
          isCancelled = false;
          delayMinutes = 0;
          estimatedDepTime = formatTimeString(depHour, depMin);
          estimatedArrTime = formatTimeString(arrDate.getHours(), arrDate.getMinutes());
        }
      }
    }
  } else {
    // 3. Future Dates (Tomorrow and beyond)
    // The majority (~85%) are On Time / Scheduled
    // ~10% advance notice Delayed
    // ~5% advance Cancelled
    // Strictly ZERO "Active / Departed" and ZERO "Arrived / Landed"!
    const mod = seed % 100;
    if (mod < 5) {
      status = 'CANCELLED';
      statusLabel = 'Cancelled (Advance Notice)';
      isCancelled = true;
      delayMinutes = 0;
      reason = 'Advance operational cancellation due to carrier network schedule change';
      progressPercent = 0;
    } else if (mod < 15) {
      status = 'DELAYED';
      delayMinutes = 25 + (seed % 3) * 10; // +25m, +35m, +45m
      statusLabel = `Delayed (+${delayMinutes}m Notice)`;
      isCancelled = false;
      reason = 'Anticipated slot congestion delay notice';
      progressPercent = 0;
      const adjustedDep = new Date(depTimeMs + delayMinutes * 60000);
      const adjustedArr = new Date(arrTimeMs + delayMinutes * 60000);
      estimatedDepTime = formatTimeString(adjustedDep.getHours(), adjustedDep.getMinutes());
      estimatedArrTime = formatTimeString(adjustedArr.getHours(), adjustedArr.getMinutes());
    } else {
      status = 'SCHEDULED';
      statusLabel = 'Scheduled · On Time';
      isCancelled = false;
      delayMinutes = 0;
      progressPercent = 0;
      estimatedDepTime = formatTimeString(depHour, depMin);
      estimatedArrTime = formatTimeString(arrDate.getHours(), arrDate.getMinutes());
    }
    actualDepTime = null;
    actualArrTime = null;
    remainingDuration = flightDurationFormatted;
  }

  // Varied gates and registrations per day based on deterministic seed
  const originGateNum = bp.routeType === 'domestic' ? ((seed % 10) + 1) : ((seed % 14) + 1);
  const destGateNum = (((seed * 3) % 18) + 1);
  const originGate = `Gate ${originGateNum}`;
  const destGate = `Gate ${destGateNum}`;
  const regSuffixList = ['A', 'B', 'C', 'G', 'K', 'J', 'M', 'R', 'T', 'V'];
  const regSuffix = regSuffixList[seed % regSuffixList.length];
  const registration = bp.registration.slice(0, -1) + regSuffix;

  const dateTag = dayOffset === 0 ? 'today' : dayOffset === 1 ? 'tomorrow' : dayOffset === 2 ? 'day_after' : isoDateStr;

  return {
    flightNumber: bp.flightNumber,
    normalizedCode: bp.flightNumber.toUpperCase().replace(/\s+/g, ''),
    airline: {
      name: bp.airlineName,
      iata: bp.iata,
      icao: bp.icao,
      callsign: bp.callsign,
      accentColor: bp.accentColor,
    },
    status,
    statusLabel,
    progressPercent,
    origin: {
      ...bp.origin,
      gate: originGate,
      baggageClaim: null,
      weather: {
        condition: isPast ? 'Clear, Vis 10km' : 'Fair, Vis 10km',
        temperatureC: 28,
        windKmh: 14,
      },
    },
    destination: {
      ...bp.destination,
      gate: destGate,
      baggageClaim: status === 'ARRIVED' ? `Belt ${((seed % 6) + 1)}` : null,
      weather: {
        condition: 'Clear Sky',
        temperatureC: 22,
        windKmh: 12,
      },
    },
    departure: {
      scheduledTime: formatTimeString(depHour, depMin),
      estimatedTime: estimatedDepTime,
      actualTime: actualDepTime,
      timezone: bp.origin.iata === 'DAC' ? 'BST (UTC+6)' : 'Local Time',
      date: formatDateString(depDate),
      gateCloseTime: formatTimeString(
        depMin >= 20 ? depHour : (depHour - 1 + 24) % 24,
        (depMin - 20 + 60) % 60
      ),
    },
    arrival: {
      scheduledTime: formatTimeString(arrDate.getHours(), arrDate.getMinutes()),
      estimatedTime: estimatedArrTime,
      actualTime: actualArrTime,
      timezone: bp.destination.country === 'Bangladesh' ? 'BST (UTC+6)' : 'Local Time',
      date: formatDateString(arrDate),
      gateCloseTime: null,
    },
    flightDuration: flightDurationFormatted,
    elapsedDuration,
    remainingDuration,
    aircraft: {
      model: bp.aircraftModel,
      registration,
      operator: bp.airlineName,
      cruisingAltitudeFt: status === 'DEPARTED' ? (bp.routeType === 'domestic' ? 24000 : 38000) : null,
      groundSpeedKnots: status === 'DEPARTED' ? (bp.routeType === 'domestic' ? 320 : 495) : null,
      currentLocationDesc:
        status === 'DEPARTED'
          ? `Airborne along ${bp.origin.iata} → ${bp.destination.iata} air corridor`
          : status === 'ARRIVED'
          ? `Arrived at ${bp.destination.name}`
          : `At ${bp.origin.iata} ${originGate}`,
      totalDistanceKm: bp.distanceKm,
      elapsedDistanceKm: Math.round((bp.distanceKm * progressPercent) / 100),
    },
    disruption: {
      isDelayed: delayMinutes > 0,
      delayMinutes,
      isCancelled,
      reason,
      disruptionType: isCancelled ? 'weather' : delayMinutes > 0 ? 'air_traffic' : null,
    },
    lastUpdated: Date.now() - 30000,
    dayOffset,
    dateTag,
    scheduledDepartureIso: depDate.toISOString(),
    estimatedDepartureIso: estimatedDepTime
      ? new Date(depDate.getTime() + delayMinutes * 60000).toISOString()
      : depDate.toISOString(),
    scheduledArrivalIso: arrDate.toISOString(),
    estimatedArrivalIso: estimatedArrTime
      ? new Date(arrDate.getTime() + delayMinutes * 60000).toISOString()
      : arrDate.toISOString(),
    routeType: bp.routeType,
  };
}

function buildFlightRecord(bp: RawFlightBlueprint, dayOffset: number): FlightRecord {
  return buildFlightRecordForDate(bp, getRelativeDate(dayOffset));
}

/**
 * Generate the master schedule dataset:
 * Keyed by normalized flight code (e.g. "BS161", "BG601", "EK585").
 * Each entry has multiDaySchedules for days 0, 1, and 2.
 */
function generateMasterCatalog(): Record<string, FlightRecord> {
  const catalog: Record<string, FlightRecord> = {};

  BLUEPRINTS.forEach((bp) => {
    const code = bp.flightNumber.toUpperCase().replace(/\s+/g, '');
    const day0 = buildFlightRecord(bp, 0);
    const day1 = buildFlightRecord(bp, 1);
    const day2 = buildFlightRecord(bp, 2);

    // Multi-day schedules dictionary attached to each day's record
    const multiDayMap: Record<number, FlightRecord> = {
      0: day0,
      1: day1,
      2: day2,
    };

    day0.multiDaySchedules = multiDayMap;
    day1.multiDaySchedules = multiDayMap;
    day2.multiDaySchedules = multiDayMap;

    // Default active entry is today (day 0)
    catalog[code] = day0;
  });

  return catalog;
}

export function normalizeFlightCode(input: string): string {
  return input.toUpperCase().replace(/\s+/g, '');
}

export function validateFlightQuery(rawInput: string): { isValid: boolean; error: string | null } {
  const trimmed = rawInput.trim();

  if (!trimmed) {
    return {
      isValid: false,
      error: 'Invalid flight number format. Please enter a valid airline code and number (e.g., BG 001, EK 585, SQ 308).',
    };
  }

  if (trimmed.toUpperCase() === 'ERROR_TEST') {
    return { isValid: true, error: null };
  }

  if (!FLIGHT_FORMAT_REGEX.test(trimmed)) {
    return {
      isValid: false,
      error: 'Invalid flight number format. Please enter a valid airline code and number (e.g., BG 001, EK 585, SQ 308).',
    };
  }

  return { isValid: true, error: null };
}

export interface FetchFlightResult {
  status: 'success' | 'not-found' | 'error';
  data?: FlightRecord;
  errorMessage?: string;
}

/**
 * Query flight database strictly by normalized code.
 * Accepts optional dayOffset or explicit calendar date.
 */
export async function searchFlightStatus(
  rawInput: string,
  dayOffset = 0,
  targetDateInput?: Date | string
): Promise<FetchFlightResult> {
  const normalized = normalizeFlightCode(rawInput);

  // Simulated radar query delay (200ms - 400ms)
  const delay = Math.floor(Math.random() * 200) + 200;
  await new Promise((resolve) => setTimeout(resolve, delay));

  if (normalized === 'ERROR_TEST') {
    return {
      status: 'error',
      errorMessage: 'Flight information service is temporarily unavailable. Upstream air traffic data gateway timed out after multiple attempts.',
    };
  }

  const bp = BLUEPRINTS.find((b) => b.flightNumber.toUpperCase().replace(/\s+/g, '') === normalized);

  if (!bp) {
    // Strictly No Fallback!
    return {
      status: 'not-found',
    };
  }

  const targetDate = targetDateInput
    ? (typeof targetDateInput === 'string'
        ? new Date(targetDateInput + 'T00:00:00')
        : targetDateInput)
    : getRelativeDate(dayOffset);

  const targetFlight = buildFlightRecordForDate(bp, targetDate);

  // Provide multiDay map
  const multiDayMap: Record<number, FlightRecord> = {
    0: buildFlightRecordForDate(bp, getRelativeDate(0)),
    1: buildFlightRecordForDate(bp, getRelativeDate(1)),
    2: buildFlightRecordForDate(bp, getRelativeDate(2)),
  };
  if (targetFlight.dayOffset !== undefined) {
    multiDayMap[targetFlight.dayOffset] = targetFlight;
  }
  targetFlight.multiDaySchedules = multiDayMap;
  targetFlight.lastUpdated = Date.now();

  return {
    status: 'success',
    data: targetFlight,
  };
}

/**
 * Returns all available flights for reference or quick inspection
 */
export function getAllAvailableFlights(): FlightRecord[] {
  const catalog = generateMasterCatalog();
  return Object.values(catalog);
}

export function toIsoDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface DailyScheduleResponse {
  date: Date;
  dateString: string;
  fullDateString: string;
  isoDateString: string;
  dayOffset: number;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isOutOfRange: boolean;
  flights: FlightRecord[];
  totalAvailable: number;
}

/**
 * Deterministically selects a realistic subset of flights (between 8 and 16 flights)
 * for a specific calendar date, balanced between domestic and international routes.
 * Re-selecting a previously chosen date returns the identical subset.
 */
export function getFlightSubsetForDate(targetDateInput: Date | string): RawFlightBlueprint[] {
  let targetDate: Date;
  if (typeof targetDateInput === 'string') {
    const parts = targetDateInput.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      targetDate = new Date(targetDateInput);
    }
  } else {
    targetDate = new Date(targetDateInput.getFullYear(), targetDateInput.getMonth(), targetDateInput.getDate(), 0, 0, 0, 0);
  }

  const isoDateStr = toIsoDateString(targetDate);
  const dateHash = hashString(`schedule_roster_date_${isoDateStr}`);

  // Determine daily flight count: strictly between 8 and 16 (e.g. 9, 11, 14)
  const targetCount = 8 + (dateHash % 9);

  const domesticPool = BLUEPRINTS.filter((bp) => bp.routeType === 'domestic');
  const internationalPool = BLUEPRINTS.filter((bp) => bp.routeType === 'international');

  // Ensure balance: roughly half domestic and half international, minimum 4 each
  let targetDomestic = Math.floor(targetCount / 2);
  let targetInternational = targetCount - targetDomestic;

  if (targetDomestic < 4) {
    targetDomestic = 4;
    targetInternational = targetCount - 4;
  } else if (targetInternational < 4) {
    targetInternational = 4;
    targetDomestic = targetCount - 4;
  }

  // Deterministically rank and pick flights from each pool using date-seeded score
  const scoredDomestic = domesticPool
    .map((bp) => ({ bp, score: hashString(`${isoDateStr}_dom_${bp.flightNumber}`) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, targetDomestic)
    .map((item) => item.bp);

  const scoredInternational = internationalPool
    .map((bp) => ({ bp, score: hashString(`${isoDateStr}_intl_${bp.flightNumber}`) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, targetInternational)
    .map((item) => item.bp);

  return [...scoredDomestic, ...scoredInternational];
}

/**
 * Generates all flights operating on an exact chosen calendar date (YYYY-MM-DD or Date object).
 * Fully dynamic, date-bound timestamps with realistic statuses and seeded flight variations.
 * Returns a date-specific dynamic subset (8-16 flights) with deterministic reproducibility.
 */
export function getFlightsForDate(dateInput: Date | string): FlightRecord[] {
  let targetDate: Date;
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      targetDate = new Date(dateInput);
    }
  } else {
    targetDate = new Date(dateInput.getFullYear(), dateInput.getMonth(), dateInput.getDate(), 0, 0, 0, 0);
  }

  const subset = getFlightSubsetForDate(targetDate);

  const flights = subset.map((bp) => {
    const flight = buildFlightRecordForDate(bp, targetDate);

    // Multi-day mapping around today and this date
    const multiDayMap: Record<number, FlightRecord> = {
      0: buildFlightRecordForDate(bp, getRelativeDate(0)),
      1: buildFlightRecordForDate(bp, getRelativeDate(1)),
      2: buildFlightRecordForDate(bp, getRelativeDate(2)),
    };
    if (flight.dayOffset !== undefined) {
      multiDayMap[flight.dayOffset] = flight;
    }
    flight.multiDaySchedules = multiDayMap;
    return flight;
  });

  // Sort chronologically by scheduled departure time
  flights.sort((a, b) => {
    const aTime = a.scheduledDepartureIso ? new Date(a.scheduledDepartureIso).getTime() : 0;
    const bTime = b.scheduledDepartureIso ? new Date(b.scheduledDepartureIso).getTime() : 0;
    return aTime - bTime;
  });

  return flights;
}

/**
 * Retrieve the complete daily flight schedule for any given Date or ISO string (YYYY-MM-DD).
 * Dynamically generates date-bound flight records with full timestamp synchronization.
 */
export function getDailySchedule(targetDateInput: Date | string): DailyScheduleResponse {
  let targetDate: Date;
  if (typeof targetDateInput === 'string') {
    const parts = targetDateInput.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      targetDate = new Date(targetDateInput);
    }
  } else {
    targetDate = new Date(targetDateInput.getFullYear(), targetDateInput.getMonth(), targetDateInput.getDate(), 0, 0, 0, 0);
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
  const diffMs = targetMidnight.getTime() - todayMidnight.getTime();
  const dayOffset = Math.round(diffMs / (1000 * 60 * 60 * 24));

  const isoDateString = toIsoDateString(targetDate);
  const formattedDate = formatDateString(targetDate);
  const fullDateString = formatFullDateString(targetDate);

  const flights = getFlightsForDate(targetDate);

  return {
    date: targetDate,
    dateString: formattedDate,
    fullDateString,
    isoDateString,
    dayOffset,
    isToday: dayOffset === 0,
    isPast: dayOffset < 0,
    isFuture: dayOffset > 0,
    isOutOfRange: false,
    flights,
    totalAvailable: flights.length,
  };
}

/**
 * Dedicated Seeded / Dynamic Date-Aware Schedule Generator.
 * Takes the selected date (YYYY-MM-DD or Date) and produces a unique, realistic flight roster for that day.
 */
export function generateDailySchedule(dateString: string): DailyScheduleResponse {
  return getDailySchedule(dateString);
}

/**
 * Deterministic schedule accessor alias conforming to SRS specifications.
 */
export function getScheduleForDate(selectedDateStr: string): DailyScheduleResponse {
  return getDailySchedule(selectedDateStr);
}

/**
 * Convert a FirestoreFlightDoc into a full FlightRecord bound to targetDateInput,
 * honoring Admin statusOverride, delayMinutes, gates, terminals, and disruptionReason.
 */
export function buildFlightRecordFromDoc(
  docData: FirestoreFlightDoc,
  targetDateInput: Date | string
): FlightRecord {
  const bp: RawFlightBlueprint = {
    flightNumber: docData.flightNumber,
    airlineName: docData.airlineName,
    iata: docData.airlineIata,
    icao: docData.airlineIcao,
    callsign: docData.airlineCallsign || docData.airlineIata,
    accentColor: docData.airlineAccentColor || '#1E293B',
    origin: {
      iata: docData.originIata,
      icao: docData.originIcao,
      name: docData.originName,
      city: docData.originCity,
      country: docData.originCountry,
      terminal: docData.originTerminal || 'Main Terminal',
      gate: docData.originGate || 'Gate 1',
    },
    destination: {
      iata: docData.destinationIata,
      icao: docData.destinationIcao,
      name: docData.destinationName,
      city: docData.destinationCity,
      country: docData.destinationCountry,
      terminal: docData.destinationTerminal || 'Main Terminal',
      gate: docData.destinationGate || 'Gate 1',
    },
    aircraftModel: docData.aircraftModel || 'Commercial Jet',
    registration: docData.registration || 'N/A',
    departureHour: docData.departureHour,
    departureMinute: docData.departureMinute,
    durationMinutes: docData.durationMinutes,
    routeType: docData.routeType,
    distanceKm: docData.distanceKm,
  };

  const base = buildFlightRecordForDate(bp, targetDateInput);
  base.id = docData.id;
  base.statusOverride = docData.statusOverride;

  // Preserve Admin-configured gates, terminals, aircraft details & registration
  base.origin.terminal = docData.originTerminal || base.origin.terminal;
  base.origin.gate = docData.originGate || base.origin.gate;
  base.destination.terminal = docData.destinationTerminal || base.destination.terminal;
  base.destination.gate = docData.destinationGate || base.destination.gate;
  base.aircraft.model = docData.aircraftModel || base.aircraft.model;
  base.aircraft.registration = docData.registration || base.aircraft.registration;

  // Apply explicit Admin status override when configured
  if (docData.statusOverride && docData.statusOverride !== 'AUTO') {
    const depBase = new Date(base.scheduledDepartureIso);
    const arrBase = new Date(base.scheduledArrivalIso);
    const hoursDur = Math.floor(docData.durationMinutes / 60);
    const minsDur = docData.durationMinutes % 60;
    const formattedDuration = `${hoursDur}h ${minsDur < 10 ? '0' : ''}${minsDur}m`;

    if (docData.statusOverride === 'CANCELLED') {
      base.status = 'CANCELLED';
      base.statusLabel = 'Cancelled';
      base.progressPercent = 0;
      base.elapsedDuration = null;
      base.remainingDuration = null;
      base.departure.actualTime = null;
      base.departure.estimatedTime = null;
      base.arrival.actualTime = null;
      base.arrival.estimatedTime = null;
      base.disruption = {
        isDelayed: false,
        delayMinutes: 0,
        isCancelled: true,
        reason: docData.disruptionReason || 'Flight cancelled by operations control.',
        disruptionType: 'carrier',
      };
    } else if (docData.statusOverride === 'DELAYED') {
      const delayMins = Math.max(15, docData.delayMinutes || 30);
      const adjDep = new Date(depBase.getTime() + delayMins * 60000);
      const adjArr = new Date(arrBase.getTime() + delayMins * 60000);
      base.status = 'DELAYED';
      base.statusLabel = `Delayed (+${delayMins}m)`;
      base.progressPercent = 0;
      base.departure.actualTime = null;
      base.departure.estimatedTime = formatTimeString(adjDep.getHours(), adjDep.getMinutes());
      base.arrival.actualTime = null;
      base.arrival.estimatedTime = formatTimeString(adjArr.getHours(), adjArr.getMinutes());
      base.estimatedDepartureIso = adjDep.toISOString();
      base.estimatedArrivalIso = adjArr.toISOString();
      base.disruption = {
        isDelayed: true,
        delayMinutes: delayMins,
        isCancelled: false,
        reason: docData.disruptionReason || 'Schedule delay updated by flight operations.',
        disruptionType: 'air_traffic',
      };
    } else if (docData.statusOverride === 'DEPARTED') {
      base.status = 'DEPARTED';
      base.statusLabel = 'En Route · In Flight';
      base.progressPercent = 54;
      base.departure.actualTime = base.departure.scheduledTime;
      base.arrival.estimatedTime = base.arrival.scheduledTime;
      base.elapsedDuration = `${Math.floor((docData.durationMinutes * 0.54) / 60)}h ${Math.round((docData.durationMinutes * 0.54) % 60).toString().padStart(2, '0')}m`;
      base.remainingDuration = `${Math.floor((docData.durationMinutes * 0.46) / 60)}h ${Math.round((docData.durationMinutes * 0.46) % 60).toString().padStart(2, '0')}m`;
      base.aircraft.cruisingAltitudeFt = docData.routeType === 'domestic' ? 24000 : 38000;
      base.aircraft.groundSpeedKnots = docData.routeType === 'domestic' ? 320 : 495;
      base.aircraft.currentLocationDesc = `Airborne along ${docData.originIata} → ${docData.destinationIata} air corridor`;
      base.aircraft.elapsedDistanceKm = Math.round(docData.distanceKm * 0.54);
      base.disruption = { isDelayed: false, delayMinutes: 0, isCancelled: false, reason: null, disruptionType: null };
    } else if (docData.statusOverride === 'ARRIVED') {
      base.status = 'ARRIVED';
      base.statusLabel = 'Landed · Arrived';
      base.progressPercent = 100;
      base.departure.actualTime = base.departure.scheduledTime;
      base.arrival.actualTime = base.arrival.scheduledTime;
      base.elapsedDuration = formattedDuration;
      base.remainingDuration = '0m';
      base.destination.baggageClaim = base.destination.baggageClaim || 'Belt 2';
      base.aircraft.elapsedDistanceKm = docData.distanceKm;
      base.aircraft.currentLocationDesc = `Arrived at ${docData.destinationName}`;
      base.disruption = { isDelayed: false, delayMinutes: 0, isCancelled: false, reason: null, disruptionType: null };
    } else {
      base.status = docData.statusOverride;
      base.statusLabel = 'Scheduled · On Time';
      base.progressPercent = 0;
      base.departure.actualTime = null;
      base.departure.estimatedTime = base.departure.scheduledTime;
      base.arrival.actualTime = null;
      base.arrival.estimatedTime = base.arrival.scheduledTime;
      base.disruption = { isDelayed: false, delayMinutes: 0, isCancelled: false, reason: null, disruptionType: null };
    }
  }

  return base;
}

/**
 * Search Firestore-backed flights strictly by normalized code.
 */
export function searchFirestoreFlights(
  docs: FirestoreFlightDoc[],
  rawInput: string,
  dayOffset = 0,
  targetDateInput?: Date | string
): FetchFlightResult {
  const normalized = normalizeFlightCode(rawInput);

  if (normalized === 'ERROR_TEST') {
    return {
      status: 'error',
      errorMessage: 'Flight information service is temporarily unavailable. Upstream air traffic data gateway timed out after multiple attempts.',
    };
  }

  const matchedDoc = docs.find((d) => d.normalizedCode === normalized);
  if (!matchedDoc) {
    return { status: 'not-found' };
  }

  const targetDate = targetDateInput
    ? typeof targetDateInput === 'string'
      ? new Date(`${targetDateInput}T00:00:00`)
      : targetDateInput
    : getRelativeDate(dayOffset);

  const targetFlight = buildFlightRecordFromDoc(matchedDoc, targetDate);

  const multiDayMap: Record<number, FlightRecord> = {
    0: buildFlightRecordFromDoc(matchedDoc, getRelativeDate(0)),
    1: buildFlightRecordFromDoc(matchedDoc, getRelativeDate(1)),
    2: buildFlightRecordFromDoc(matchedDoc, getRelativeDate(2)),
  };
  if (targetFlight.dayOffset !== undefined) {
    multiDayMap[targetFlight.dayOffset] = targetFlight;
  }
  targetFlight.multiDaySchedules = multiDayMap;
  targetFlight.lastUpdated = Date.now();

  return {
    status: 'success',
    data: targetFlight,
  };
}

/**
 * Generate a daily flight schedule directly from Firestore flight records.
 */
export function generateDailyScheduleFromFlights(
  docs: FirestoreFlightDoc[],
  targetDateInput: Date | string
): DailyScheduleResponse {
  let targetDate: Date;
  if (typeof targetDateInput === 'string') {
    const parts = targetDateInput.split('-').map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      targetDate = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
    } else {
      targetDate = new Date(targetDateInput);
    }
  } else {
    targetDate = new Date(
      targetDateInput.getFullYear(),
      targetDateInput.getMonth(),
      targetDateInput.getDate(),
      0,
      0,
      0,
      0
    );
  }

  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
  const dayOffset = Math.round((targetMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

  const flights = docs.map((docItem) => {
    const flight = buildFlightRecordFromDoc(docItem, targetDate);
    const multiDayMap: Record<number, FlightRecord> = {
      0: buildFlightRecordFromDoc(docItem, getRelativeDate(0)),
      1: buildFlightRecordFromDoc(docItem, getRelativeDate(1)),
      2: buildFlightRecordFromDoc(docItem, getRelativeDate(2)),
    };
    if (flight.dayOffset !== undefined) {
      multiDayMap[flight.dayOffset] = flight;
    }
    flight.multiDaySchedules = multiDayMap;
    return flight;
  });

  flights.sort((a, b) => {
    const aTime = a.scheduledDepartureIso ? new Date(a.scheduledDepartureIso).getTime() : 0;
    const bTime = b.scheduledDepartureIso ? new Date(b.scheduledDepartureIso).getTime() : 0;
    return aTime - bTime;
  });

  return {
    date: targetDate,
    dateString: formatDateString(targetDate),
    fullDateString: formatFullDateString(targetDate),
    isoDateString: toIsoDateString(targetDate),
    dayOffset,
    isToday: dayOffset === 0,
    isPast: dayOffset < 0,
    isFuture: dayOffset > 0,
    isOutOfRange: false,
    flights,
    totalAvailable: flights.length,
  };
}


