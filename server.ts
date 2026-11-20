import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// =============================================================================
// OpenSky Network OAuth2 Token Manager & Rate-Limit State
// =============================================================================
const OPENSKY_TOKEN_URL =
  'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';
const OPENSKY_STATES_URL = 'https://opensky-network.org/api/states/all';
const OPENSKY_REQUEST_TIMEOUT_MS = 12_000;
const OPENSKY_USER_AGENT = 'SmartFlightTracker/1.0 (+https://opensky-network.org)';

interface OpenSkyTokenCache {
  accessToken: string;
  expiresAtMs: number;
  expiresInSec: number;
}

class OpenSkyApiError extends Error {
  readonly code:
    | 'NOT_CONFIGURED'
    | 'AUTH_ERROR'
    | 'RATE_LIMITED'
    | 'UPSTREAM_TIMEOUT'
    | 'UPSTREAM_ERROR'
    | 'NETWORK_ERROR';
  readonly httpStatus: number;
  readonly stage: 'config' | 'oauth2_token' | 'states_api';
  readonly retryAfterSeconds: number | null;

  constructor(options: {
    code:
      | 'NOT_CONFIGURED'
      | 'AUTH_ERROR'
      | 'RATE_LIMITED'
      | 'UPSTREAM_TIMEOUT'
      | 'UPSTREAM_ERROR'
      | 'NETWORK_ERROR';
    httpStatus: number;
    stage: 'config' | 'oauth2_token' | 'states_api';
    message: string;
    retryAfterSeconds?: number | null;
  }) {
    super(options.message);
    this.name = 'OpenSkyApiError';
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.stage = options.stage;
    this.retryAfterSeconds = options.retryAfterSeconds ?? null;
  }
}

function classifyFetchError(
  err: unknown,
  stage: 'oauth2_token' | 'states_api',
  targetHost: string
): OpenSkyApiError {
  if (err instanceof OpenSkyApiError) {
    return err;
  }

  const errObj = err as {
    name?: string;
    message?: string;
    code?: string;
    cause?: { code?: string; message?: string; errno?: number };
  };

  const causeCode = errObj?.cause?.code || errObj?.code || '';
  const rawMsg = errObj?.cause?.message || errObj?.message || 'Unknown network error';
  const isTimeout =
    errObj?.name === 'TimeoutError' ||
    errObj?.name === 'AbortError' ||
    causeCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    causeCode === 'ETIMEDOUT' ||
    /timed?\s*out|aborted/i.test(rawMsg);

  if (isTimeout) {
    const stageLabel =
      stage === 'oauth2_token'
        ? 'OpenSky OAuth2 authentication server'
        : 'OpenSky Network radar API';
    return new OpenSkyApiError({
      code: 'UPSTREAM_TIMEOUT',
      httpStatus: 504,
      stage,
      message: `Connection to ${stageLabel} (${targetHost}) timed out after ${Math.round(
        OPENSKY_REQUEST_TIMEOUT_MS / 1000
      )}s. OpenSky servers may be temporarily unreachable or blocking requests from this cloud hosting network.`,
    });
  }

  const detail = causeCode ? `${causeCode}: ${rawMsg}` : rawMsg;
  return new OpenSkyApiError({
    code: 'NETWORK_ERROR',
    httpStatus: 502,
    stage,
    message: `Unable to reach ${targetHost} (${detail}).`,
  });
}

interface ParsedOpenSkyAircraft {
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

interface OpenSkyCacheEntry {
  fetchedAt: number;
  totalInBounds: number;
  remainingCredits: number | null;
  aircraft: ParsedOpenSkyAircraft[];
}

let openskyTokenCache: OpenSkyTokenCache | null = null;
let openskyTokenInFlight: Promise<OpenSkyTokenCache> | null = null;
let openskyCooldownUntilMs = 0;
let openskyLastRemainingCredits: number | null = null;
const openskyStatesCache = new Map<string, OpenSkyCacheEntry>();
const OPENSKY_CACHE_TTL_MS = 12_000;
const OPENSKY_MIN_FORCE_REFRESH_MS = 5_000;

function isOpenSkyConfigured(): boolean {
  return Boolean(
    process.env.OPENSKY_CLIENT_ID?.trim() && process.env.OPENSKY_CLIENT_SECRET?.trim()
  );
}

function isAviationstackConfigured(): boolean {
  return Boolean(process.env.AVIATIONSTACK_API_KEY?.trim());
}

async function fetchOpenSkyTokenEntry(forceRefresh = false): Promise<OpenSkyTokenCache> {
  const clientId = process.env.OPENSKY_CLIENT_ID?.trim();
  const clientSecret = process.env.OPENSKY_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new OpenSkyApiError({
      code: 'NOT_CONFIGURED',
      httpStatus: 503,
      stage: 'config',
      message:
        'OpenSky Network OAuth2 credentials (OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET) are not configured in server secrets.',
    });
  }

  const now = Date.now();
  if (!forceRefresh && openskyTokenCache && openskyTokenCache.expiresAtMs - 120_000 > now) {
    return openskyTokenCache;
  }

  if (openskyTokenInFlight && !forceRefresh) {
    return openskyTokenInFlight;
  }

  openskyTokenInFlight = (async () => {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    let tokenRes: globalThis.Response;
    try {
      tokenRes = await fetch(OPENSKY_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': OPENSKY_USER_AGENT,
        },
        body: body.toString(),
        signal: AbortSignal.timeout(OPENSKY_REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw classifyFetchError(err, 'oauth2_token', 'auth.opensky-network.org');
    }

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      let oauthDetail = '';
      try {
        const parsedErr = JSON.parse(errText) as {
          error?: string;
          error_description?: string;
        };
        oauthDetail = parsedErr.error_description || parsedErr.error || '';
      } catch {
        oauthDetail = errText.slice(0, 140);
      }

      const isAuthFailure = tokenRes.status === 400 || tokenRes.status === 401 || tokenRes.status === 403;
      throw new OpenSkyApiError({
        code: isAuthFailure ? 'AUTH_ERROR' : 'UPSTREAM_ERROR',
        httpStatus: isAuthFailure ? 401 : 502,
        stage: 'oauth2_token',
        message: isAuthFailure
          ? `OpenSky OAuth2 authentication failed (HTTP ${tokenRes.status}${
              oauthDetail ? `: ${oauthDetail}` : ''
            }). Verify OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET in Secrets.`
          : `OpenSky OAuth2 server returned HTTP ${tokenRes.status}${
              oauthDetail ? `: ${oauthDetail}` : ''
            }.`,
      });
    }

    const tokenJson = (await tokenRes.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!tokenJson.access_token) {
      throw new OpenSkyApiError({
        code: 'AUTH_ERROR',
        httpStatus: 502,
        stage: 'oauth2_token',
        message: 'OpenSky OAuth2 token response did not include an access_token.',
      });
    }

    const expiresInSec =
      typeof tokenJson.expires_in === 'number' && tokenJson.expires_in > 0
        ? tokenJson.expires_in
        : 1800;

    const entry: OpenSkyTokenCache = {
      accessToken: tokenJson.access_token,
      expiresAtMs: Date.now() + expiresInSec * 1000,
      expiresInSec,
    };
    openskyTokenCache = entry;
    return entry;
  })();

  try {
    return await openskyTokenInFlight;
  } finally {
    openskyTokenInFlight = null;
  }
}

async function fetchOpenSkyAccessToken(forceRefresh = false): Promise<string> {
  const entry = await fetchOpenSkyTokenEntry(forceRefresh);
  return entry.accessToken;
}

function parseNumberParam(raw: unknown, min: number, max: number): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const num = Number(raw);
  if (!Number.isFinite(num)) return null;
  return Math.min(max, Math.max(min, num));
}

function parseOpenSkyStateVector(row: unknown[]): ParsedOpenSkyAircraft | null {
  const icao24 = typeof row[0] === 'string' ? row[0].trim().toLowerCase() : '';
  const lon = typeof row[5] === 'number' && Number.isFinite(row[5]) ? row[5] : null;
  const lat = typeof row[6] === 'number' && Number.isFinite(row[6]) ? row[6] : null;
  if (!icao24 || lat === null || lon === null) return null;

  const callsignRaw = typeof row[1] === 'string' ? row[1].trim() : '';
  const originCountry = typeof row[2] === 'string' ? row[2].trim() : 'Unknown';
  const timePosition = typeof row[3] === 'number' ? row[3] : null;
  const lastContact = typeof row[4] === 'number' ? row[4] : Math.floor(Date.now() / 1000);
  const baroAltitudeM = typeof row[7] === 'number' && Number.isFinite(row[7]) ? row[7] : null;
  const onGround = Boolean(row[8]);
  const velocityMs = typeof row[9] === 'number' && Number.isFinite(row[9]) ? row[9] : null;
  const trueTrack = typeof row[10] === 'number' && Number.isFinite(row[10]) ? row[10] : null;
  const verticalRateMs = typeof row[11] === 'number' && Number.isFinite(row[11]) ? row[11] : null;
  const geoAltitudeM = typeof row[13] === 'number' && Number.isFinite(row[13]) ? row[13] : null;
  const squawk = typeof row[14] === 'string' && row[14].trim() ? row[14].trim() : null;
  const category = typeof row[17] === 'number' ? row[17] : null;

  const effectiveAltM = baroAltitudeM ?? geoAltitudeM;
  const altitudeFt = effectiveAltM !== null ? Math.round(effectiveAltM * 3.28084) : null;
  const velocityKts = velocityMs !== null ? Math.round(velocityMs * 1.94384) : null;
  const velocityKmh = velocityMs !== null ? Math.round(velocityMs * 3.6) : null;
  const verticalRateFpm = verticalRateMs !== null ? Math.round(verticalRateMs * 196.8504) : null;

  return {
    icao24,
    callsign: callsignRaw || null,
    originCountry,
    timePosition,
    lastContact,
    longitude: lon,
    latitude: lat,
    baroAltitudeM,
    geoAltitudeM,
    altitudeFt,
    onGround,
    velocityMs,
    velocityKts,
    velocityKmh,
    trueTrack,
    verticalRateMs,
    verticalRateFpm,
    squawk,
    category,
  };
}

// =============================================================================
// Aviationstack Cache & Proxy Helpers
// =============================================================================
interface AviationstackCacheEntry {
  fetchedAt: number;
  data: unknown[];
}

const aviationstackCache = new Map<string, AviationstackCacheEntry>();
const AVIATIONSTACK_CACHE_TTL_MS = 60_000;

async function fetchAviationstackUpstream(
  protocol: 'https' | 'http',
  apiKey: string,
  normalizedFlightCode: string
): Promise<{ ok: boolean; status: number; payload: Record<string, unknown> }> {
  const url = new URL(`${protocol}://api.aviationstack.com/v1/flights`);
  url.searchParams.set('access_key', apiKey);
  url.searchParams.set('flight_iata', normalizedFlightCode);
  url.searchParams.set('limit', '5');

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(12_000),
  });

  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, payload };
}

// =============================================================================
// Express App & API Routes
// =============================================================================
async function startServer() {
  const app = express();
  app.use(express.json());

  // 1. Safe Integration Configuration Status (booleans only, never exposes secrets)
  app.get('/api/integrations/status', (_req: Request, res: Response) => {
    res.json({
      openskyConfigured: isOpenSkyConfigured(),
      aviationstackConfigured: isAviationstackConfigured(),
    });
  });

  // 2a. OpenSky Live Connection Test (OAuth2 + Small Bounded States Check — zero secret leakage)
  app.get('/api/opensky/test', async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const configured = isOpenSkyConfigured();

    if (!configured) {
      res.status(503).json({
        ok: false,
        configured: false,
        stage: 'config',
        code: 'NOT_CONFIGURED',
        error:
          'OPENSKY_CLIENT_ID and/or OPENSKY_CLIENT_SECRET were not found in the backend environment.',
        oauthAuthenticated: false,
        statesFetchOk: false,
        aircraftCount: 0,
        remainingCredits: null,
        latencyMs: Date.now() - startedAt,
      });
      return;
    }

    let oauthLatencyMs = 0;
    let tokenExpiresInSeconds: number | null = null;
    let accessToken = '';

    try {
      const oauthStart = Date.now();
      const tokenEntry = await fetchOpenSkyTokenEntry(false);
      oauthLatencyMs = Date.now() - oauthStart;
      tokenExpiresInSeconds = Math.max(
        0,
        Math.round((tokenEntry.expiresAtMs - Date.now()) / 1000)
      );
      accessToken = tokenEntry.accessToken;
    } catch (err) {
      const apiErr = classifyFetchError(err, 'oauth2_token', 'auth.opensky-network.org');
      res.status(apiErr.httpStatus).json({
        ok: false,
        configured: true,
        stage: apiErr.stage,
        code: apiErr.code,
        error: apiErr.message,
        oauthAuthenticated: false,
        statesFetchOk: false,
        aircraftCount: 0,
        remainingCredits: openskyLastRemainingCredits,
        latencyMs: Date.now() - startedAt,
      });
      return;
    }

    // Small Central Europe bbox (Switzerland/Alps) or caller-supplied bbox
    const lamin = parseNumberParam(req.query.lamin, -90, 90) ?? 45.8;
    const lomin = parseNumberParam(req.query.lomin, -180, 180) ?? 5.9;
    const lamax = parseNumberParam(req.query.lamax, -90, 90) ?? 47.8;
    const lomax = parseNumberParam(req.query.lomax, -180, 180) ?? 10.5;

    try {
      const statesStart = Date.now();
      const targetUrl = new URL(OPENSKY_STATES_URL);
      targetUrl.searchParams.set('lamin', lamin.toFixed(4));
      targetUrl.searchParams.set('lomin', lomin.toFixed(4));
      targetUrl.searchParams.set('lamax', lamax.toFixed(4));
      targetUrl.searchParams.set('lomax', lomax.toFixed(4));

      let upstreamRes: globalThis.Response;
      try {
        upstreamRes = await fetch(targetUrl.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': OPENSKY_USER_AGENT,
          },
          signal: AbortSignal.timeout(OPENSKY_REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw classifyFetchError(err, 'states_api', 'opensky-network.org');
      }

      const statesLatencyMs = Date.now() - statesStart;
      const remainingHeader = upstreamRes.headers.get('x-rate-limit-remaining');
      const remainingCredits =
        remainingHeader !== null && Number.isFinite(Number(remainingHeader))
          ? Number(remainingHeader)
          : null;
      if (remainingCredits !== null) {
        openskyLastRemainingCredits = remainingCredits;
      }

      if (upstreamRes.status === 429) {
        const retryHeader =
          upstreamRes.headers.get('x-rate-limit-retry-after-seconds') ||
          upstreamRes.headers.get('retry-after');
        const retryAfterSeconds =
          retryHeader && Number.isFinite(Number(retryHeader)) && Number(retryHeader) > 0
            ? Math.ceil(Number(retryHeader))
            : 60;
        openskyCooldownUntilMs = Date.now() + retryAfterSeconds * 1000;

        res.status(429).json({
          ok: false,
          configured: true,
          stage: 'states_api',
          code: 'RATE_LIMITED',
          error: `OpenSky OAuth2 succeeded, but /api/states/all returned HTTP 429. Retry after ${retryAfterSeconds}s.`,
          oauthAuthenticated: true,
          oauthLatencyMs,
          tokenExpiresInSeconds,
          statesFetchOk: false,
          statesLatencyMs,
          aircraftCount: 0,
          remainingCredits,
          retryAfterSeconds,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }

      if (!upstreamRes.ok) {
        const errBody = await upstreamRes.text().catch(() => '');
        res.status(upstreamRes.status >= 500 ? 502 : upstreamRes.status).json({
          ok: false,
          configured: true,
          stage: 'states_api',
          code: upstreamRes.status === 401 ? 'AUTH_ERROR' : 'UPSTREAM_ERROR',
          error: `OpenSky /api/states/all returned HTTP ${upstreamRes.status}${
            errBody ? `: ${errBody.slice(0, 140)}` : ''
          }`,
          oauthAuthenticated: true,
          oauthLatencyMs,
          tokenExpiresInSeconds,
          statesFetchOk: false,
          statesLatencyMs,
          aircraftCount: 0,
          remainingCredits,
          latencyMs: Date.now() - startedAt,
        });
        return;
      }

      const json = (await upstreamRes.json()) as { time?: number; states?: unknown[][] | null };
      const rawStates = Array.isArray(json.states) ? json.states : [];
      const parsed = rawStates
        .map((row) => (Array.isArray(row) ? parseOpenSkyStateVector(row) : null))
        .filter((item): item is ParsedOpenSkyAircraft => item !== null);

      res.json({
        ok: true,
        configured: true,
        stage: 'states_api',
        oauthAuthenticated: true,
        oauthLatencyMs,
        tokenExpiresInSeconds,
        statesFetchOk: true,
        statesLatencyMs,
        aircraftCount: parsed.length,
        remainingCredits,
        sampleAircraft: parsed.slice(0, 3).map((ac) => ({
          icao24: ac.icao24,
          callsign: ac.callsign,
          originCountry: ac.originCountry,
          latitude: ac.latitude,
          longitude: ac.longitude,
          altitudeFt: ac.altitudeFt,
          velocityKts: ac.velocityKts,
          trueTrack: ac.trueTrack,
        })),
        latencyMs: Date.now() - startedAt,
      });
    } catch (err) {
      const apiErr = classifyFetchError(err, 'states_api', 'opensky-network.org');
      res.status(apiErr.httpStatus).json({
        ok: false,
        configured: true,
        stage: apiErr.stage,
        code: apiErr.code,
        error: apiErr.message,
        oauthAuthenticated: true,
        oauthLatencyMs,
        tokenExpiresInSeconds,
        statesFetchOk: false,
        aircraftCount: 0,
        remainingCredits: openskyLastRemainingCredits,
        latencyMs: Date.now() - startedAt,
      });
    }
  });

  // 2b. OpenSky Network Real-Time Aircraft States (OAuth2 + BBox Cache + Rate-Limit Guard)
  app.get('/api/opensky/states', async (req: Request, res: Response) => {
    if (!isOpenSkyConfigured()) {
      res.status(503).json({
        configured: false,
        code: 'NOT_CONFIGURED',
        error:
          'OpenSky Network OAuth2 credentials (OPENSKY_CLIENT_ID and OPENSKY_CLIENT_SECRET) are not configured in server secrets.',
        cached: false,
        fetchedAt: Date.now(),
        totalInBounds: 0,
        returnedCount: 0,
        remainingCredits: null,
        retryAfterSeconds: null,
        aircraft: [],
      });
      return;
    }

    const lamin = parseNumberParam(req.query.lamin, -90, 90);
    const lomin = parseNumberParam(req.query.lomin, -180, 180);
    const lamax = parseNumberParam(req.query.lamax, -90, 90);
    const lomax = parseNumberParam(req.query.lomax, -180, 180);
    const maxAircraft = Math.min(600, Math.max(25, Number(req.query.limit) || 350));
    const forceRefresh = req.query.force === '1' || req.query.force === 'true';

    const hasValidBbox =
      lamin !== null && lomin !== null && lamax !== null && lomax !== null && lamax > lamin && lomax > lomin;

    const cacheKey = hasValidBbox
      ? `${lamin.toFixed(1)},${lomin.toFixed(1)},${lamax.toFixed(1)},${lomax.toFixed(1)}`
      : 'global';

    const now = Date.now();

    // Serve fresh cached snapshot if within TTL (manual Refresh Radar enforces a 5s floor)
    const cached = openskyStatesCache.get(cacheKey);
    const effectiveCacheTtl = forceRefresh ? OPENSKY_MIN_FORCE_REFRESH_MS : OPENSKY_CACHE_TTL_MS;
    if (cached && now - cached.fetchedAt < effectiveCacheTtl) {
      const sliced = cached.aircraft.slice(0, maxAircraft);
      res.json({
        configured: true,
        cached: true,
        fetchedAt: cached.fetchedAt,
        totalInBounds: cached.totalInBounds,
        returnedCount: sliced.length,
        remainingCredits: cached.remainingCredits,
        retryAfterSeconds: null,
        aircraft: sliced,
      });
      return;
    }

    // Respect active OpenSky 429 cooldown without calling upstream again
    if (now < openskyCooldownUntilMs) {
      const retryAfterSeconds = Math.max(1, Math.ceil((openskyCooldownUntilMs - now) / 1000));
      res.status(429).json({
        configured: true,
        code: 'RATE_LIMITED',
        error: `OpenSky Network rate limit active. Please wait ${retryAfterSeconds}s before requesting new positions.`,
        cached: false,
        fetchedAt: now,
        totalInBounds: 0,
        returnedCount: 0,
        remainingCredits: openskyLastRemainingCredits,
        retryAfterSeconds,
        aircraft: [],
      });
      return;
    }

    try {
      const targetUrl = new URL(OPENSKY_STATES_URL);
      if (hasValidBbox) {
        targetUrl.searchParams.set('lamin', lamin.toFixed(4));
        targetUrl.searchParams.set('lomin', lomin.toFixed(4));
        targetUrl.searchParams.set('lamax', lamax.toFixed(4));
        targetUrl.searchParams.set('lomax', lomax.toFixed(4));
      }

      let accessToken = await fetchOpenSkyAccessToken(false);
      let upstreamRes: globalThis.Response;
      try {
        upstreamRes = await fetch(targetUrl.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/json',
            'User-Agent': OPENSKY_USER_AGENT,
          },
          signal: AbortSignal.timeout(OPENSKY_REQUEST_TIMEOUT_MS),
        });
      } catch (err) {
        throw classifyFetchError(err, 'states_api', 'opensky-network.org');
      }

      // Retry once if token was revoked/expired early
      if (upstreamRes.status === 401) {
        openskyTokenCache = null;
        accessToken = await fetchOpenSkyAccessToken(true);
        try {
          upstreamRes = await fetch(targetUrl.toString(), {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: 'application/json',
              'User-Agent': OPENSKY_USER_AGENT,
            },
            signal: AbortSignal.timeout(OPENSKY_REQUEST_TIMEOUT_MS),
          });
        } catch (err) {
          throw classifyFetchError(err, 'states_api', 'opensky-network.org');
        }
      }

      const remainingHeader = upstreamRes.headers.get('x-rate-limit-remaining');
      const remainingCredits =
        remainingHeader !== null && Number.isFinite(Number(remainingHeader))
          ? Number(remainingHeader)
          : null;
      if (remainingCredits !== null) {
        openskyLastRemainingCredits = remainingCredits;
      }

      if (upstreamRes.status === 429) {
        const retryHeader =
          upstreamRes.headers.get('x-rate-limit-retry-after-seconds') ||
          upstreamRes.headers.get('retry-after');
        const retryAfterSeconds =
          retryHeader && Number.isFinite(Number(retryHeader)) && Number(retryHeader) > 0
            ? Math.ceil(Number(retryHeader))
            : 60;
        openskyCooldownUntilMs = Date.now() + retryAfterSeconds * 1000;

        res.status(429).json({
          configured: true,
          code: 'RATE_LIMITED',
          error: `OpenSky Network API rate limit reached. Retry after ${retryAfterSeconds} seconds.`,
          cached: false,
          fetchedAt: Date.now(),
          totalInBounds: 0,
          returnedCount: 0,
          remainingCredits,
          retryAfterSeconds,
          aircraft: [],
        });
        return;
      }

      if (!upstreamRes.ok) {
        const errBody = await upstreamRes.text().catch(() => '');
        const isAuthErr = upstreamRes.status === 401 || upstreamRes.status === 403;
        res.status(upstreamRes.status >= 500 ? 502 : upstreamRes.status).json({
          configured: true,
          code: isAuthErr ? 'AUTH_ERROR' : 'UPSTREAM_ERROR',
          error: isAuthErr
            ? `OpenSky Network rejected the Bearer token (HTTP ${upstreamRes.status}). Verify your OAuth2 client credentials.`
            : `OpenSky Network returned HTTP ${upstreamRes.status}${errBody ? `: ${errBody.slice(0, 140)}` : ''}`,
          cached: false,
          fetchedAt: Date.now(),
          totalInBounds: 0,
          returnedCount: 0,
          remainingCredits,
          retryAfterSeconds: null,
          aircraft: [],
        });
        return;
      }

      const json = (await upstreamRes.json()) as {
        time?: number;
        states?: unknown[][] | null;
      };

      const rawStates = Array.isArray(json.states) ? json.states : [];
      const parsed: ParsedOpenSkyAircraft[] = [];
      for (const row of rawStates) {
        if (Array.isArray(row)) {
          const item = parseOpenSkyStateVector(row);
          if (item) parsed.push(item);
        }
      }

      // Prioritize airborne aircraft with callsigns, then sort closest to viewport center
      if (hasValidBbox) {
        const centerLat = (lamin + lamax) / 2;
        const centerLon = (lomin + lomax) / 2;
        parsed.sort((a, b) => {
          if (a.onGround !== b.onGround) return a.onGround ? 1 : -1;
          const distA = (a.latitude - centerLat) ** 2 + (a.longitude - centerLon) ** 2;
          const distB = (b.latitude - centerLat) ** 2 + (b.longitude - centerLon) ** 2;
          return distA - distB;
        });
      }

      const fetchedAt = Date.now();
      // Keep cache map bounded
      if (openskyStatesCache.size > 40) {
        const oldestKey = openskyStatesCache.keys().next().value;
        if (oldestKey) openskyStatesCache.delete(oldestKey);
      }
      openskyStatesCache.set(cacheKey, {
        fetchedAt,
        totalInBounds: parsed.length,
        remainingCredits,
        aircraft: parsed,
      });

      const sliced = parsed.slice(0, maxAircraft);
      res.json({
        configured: true,
        cached: false,
        fetchedAt,
        totalInBounds: parsed.length,
        returnedCount: sliced.length,
        remainingCredits,
        retryAfterSeconds: null,
        aircraft: sliced,
      });
    } catch (err) {
      const apiErr = classifyFetchError(err, 'states_api', 'opensky-network.org');
      res.status(apiErr.httpStatus).json({
        configured: apiErr.code !== 'NOT_CONFIGURED',
        code: apiErr.code,
        error: apiErr.message,
        cached: false,
        fetchedAt: Date.now(),
        totalInBounds: 0,
        returnedCount: 0,
        remainingCredits: openskyLastRemainingCredits,
        retryAfterSeconds: apiErr.retryAfterSeconds,
        aircraft: [],
      });
    }
  });

  // 3. Aviationstack Flight Search by Flight Number (Server-Side API Key)
  app.get('/api/aviationstack/flights', async (req: Request, res: Response) => {
    const apiKey = process.env.AVIATIONSTACK_API_KEY?.trim();
    if (!apiKey) {
      res.status(503).json({
        configured: false,
        code: 'NOT_CONFIGURED',
        error:
          'Aviationstack API key (AVIATIONSTACK_API_KEY) is not configured in server secrets.',
        cached: false,
        fetchedAt: Date.now(),
        data: [],
      });
      return;
    }

    const rawFlight = String(req.query.flight_iata || req.query.flight || '').trim();
    const normalizedFlightCode = rawFlight.replace(/\s+/g, '').toUpperCase();

    if (!/^[A-Z0-9]{2,3}[0-9]{1,4}[A-Z]?$/.test(normalizedFlightCode)) {
      res.status(400).json({
        configured: true,
        code: 'INVALID_FLIGHT_CODE',
        error: 'Please provide a valid airline flight code (e.g., EK585, BG001, UA2402).',
        cached: false,
        fetchedAt: Date.now(),
        data: [],
      });
      return;
    }

    const now = Date.now();
    const cached = aviationstackCache.get(normalizedFlightCode);
    if (cached && now - cached.fetchedAt < AVIATIONSTACK_CACHE_TTL_MS) {
      res.json({
        configured: true,
        cached: true,
        fetchedAt: cached.fetchedAt,
        flightCode: normalizedFlightCode,
        data: cached.data,
      });
      return;
    }

    try {
      // Try HTTPS first; if Aviationstack free tier returns https_access_restricted, retry via HTTP
      let result = await fetchAviationstackUpstream('https', apiKey, normalizedFlightCode);
      const errObj = result.payload.error as { code?: string; message?: string } | undefined;

      if (errObj?.code === 'https_access_restricted') {
        result = await fetchAviationstackUpstream('http', apiKey, normalizedFlightCode);
      }

      const finalErr = result.payload.error as { code?: string; message?: string } | undefined;
      if (finalErr) {
        const isRateOrQuota =
          result.status === 429 ||
          finalErr.code === 'usage_limit_reached' ||
          finalErr.code === 'rate_limit_reached';
        res.status(isRateOrQuota ? 429 : 502).json({
          configured: true,
          code: isRateOrQuota ? 'RATE_LIMITED' : finalErr.code || 'UPSTREAM_ERROR',
          error: finalErr.message || 'Aviationstack API returned an error.',
          cached: false,
          fetchedAt: Date.now(),
          flightCode: normalizedFlightCode,
          data: [],
        });
        return;
      }

      const data = Array.isArray(result.payload.data) ? result.payload.data : [];
      if (aviationstackCache.size > 100) {
        const oldestKey = aviationstackCache.keys().next().value;
        if (oldestKey) aviationstackCache.delete(oldestKey);
      }
      aviationstackCache.set(normalizedFlightCode, {
        fetchedAt: now,
        data,
      });

      res.json({
        configured: true,
        cached: false,
        fetchedAt: now,
        flightCode: normalizedFlightCode,
        data,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unable to reach Aviationstack API right now.';
      res.status(502).json({
        configured: true,
        code: 'NETWORK_ERROR',
        error: message,
        cached: false,
        fetchedAt: Date.now(),
        flightCode: normalizedFlightCode,
        data: [],
      });
    }
  });

  // 4. Mount Vite Dev Middleware OR Serve Built Production Assets
  if (!IS_PRODUCTION) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response, next) => {
      if (req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Smart Flight Tracker server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
