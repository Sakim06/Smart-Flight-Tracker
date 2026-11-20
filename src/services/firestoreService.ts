import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  writeBatch,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import type { User as FirebaseUser } from 'firebase/auth';
import {
  db,
  isDesignatedAdminEmail,
  OperationType,
  handleFirestoreError,
} from '../lib/firebase';
import {
  AppRole,
  AuthLogEntry,
  AuthProviderType,
  AuthSettings,
  FirestoreFlightDoc,
  FlightFormPayload,
  SignupStatus,
  UserProfile,
} from '../types/flight';
import { BLUEPRINTS, normalizeFlightCode } from './flightMockService';

const FLIGHTS_COL = 'flights';
const USERS_COL = 'users';
const AUTH_LOGS_COL = 'auth_logs';
const SETTINGS_COL = 'settings';
const AUTH_CONFIG_ID = 'auth_config';
const ADMINS_COL = 'admins';

export function isDesignatedAdminUser(user: FirebaseUser | null): boolean {
  if (!user) return false;
  return isDesignatedAdminEmail(user.email);
}

// Legacy export alias kept for compatibility — does NOT require emailVerified
export const isVerifiedBootstrappedAdmin = isDesignatedAdminUser;

export function sanitizeFlightId(raw: string): string {
  const cleaned = normalizeFlightCode(raw)
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 64);
  return cleaned || `FLT${Date.now()}`;
}

export function buildValidatedFlightFields(input: FlightFormPayload): Omit<FirestoreFlightDoc, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'> {
  const flightNumber = (input.flightNumber || '').trim().toUpperCase().slice(0, 20);
  const normalizedCode = normalizeFlightCode(flightNumber)
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 20);

  return {
    flightNumber,
    normalizedCode: normalizedCode || 'FL000',
    airlineName: (input.airlineName || 'Commercial Airline').trim().slice(0, 100),
    airlineIata: (input.airlineIata || normalizedCode.slice(0, 2) || 'XX').trim().toUpperCase().slice(0, 10),
    airlineIcao: (input.airlineIcao || 'XXX').trim().toUpperCase().slice(0, 10),
    airlineCallsign: (input.airlineCallsign || '').trim().toUpperCase().slice(0, 40),
    airlineAccentColor: /^#[0-9A-Fa-f]{3,8}$/.test((input.airlineAccentColor || '').trim())
      ? input.airlineAccentColor.trim().slice(0, 20)
      : '#1E40AF',
    originIata: (input.originIata || 'DAC').trim().toUpperCase().slice(0, 10),
    originIcao: (input.originIcao || 'VGHS').trim().toUpperCase().slice(0, 10),
    originName: (input.originName || 'Origin Airport').trim().slice(0, 120),
    originCity: (input.originCity || 'Dhaka').trim().slice(0, 80),
    originCountry: (input.originCountry || 'Bangladesh').trim().slice(0, 80),
    originTerminal: (input.originTerminal || '').trim().slice(0, 60),
    originGate: (input.originGate || '').trim().slice(0, 30),
    destinationIata: (input.destinationIata || 'DXB').trim().toUpperCase().slice(0, 10),
    destinationIcao: (input.destinationIcao || 'OMDB').trim().toUpperCase().slice(0, 10),
    destinationName: (input.destinationName || 'Destination Airport').trim().slice(0, 120),
    destinationCity: (input.destinationCity || 'Dubai').trim().slice(0, 80),
    destinationCountry: (input.destinationCountry || 'United Arab Emirates').trim().slice(0, 80),
    destinationTerminal: (input.destinationTerminal || '').trim().slice(0, 60),
    destinationGate: (input.destinationGate || '').trim().slice(0, 30),
    aircraftModel: (input.aircraftModel || '').trim().slice(0, 80),
    registration: (input.registration || '').trim().toUpperCase().slice(0, 30),
    departureHour: Math.min(23, Math.max(0, Math.round(Number(input.departureHour) || 0))),
    departureMinute: Math.min(59, Math.max(0, Math.round(Number(input.departureMinute) || 0))),
    durationMinutes: Math.min(1440, Math.max(1, Math.round(Number(input.durationMinutes) || 60))),
    routeType: input.routeType === 'domestic' ? 'domestic' : 'international',
    distanceKm: Math.min(25000, Math.max(1, Math.round(Number(input.distanceKm) || 500))),
    statusOverride: input.statusOverride || 'AUTO',
    delayMinutes: Math.min(1440, Math.max(0, Math.round(Number(input.delayMinutes) || 0))),
    disruptionReason: (input.disruptionReason || '').trim().slice(0, 240),
  };
}

// =============================================================================
// Flights CRUD & Seeding
// =============================================================================

export function subscribeToFlights(
  onData: (flights: FirestoreFlightDoc[]) => void
): Unsubscribe {
  const path = FLIGHTS_COL;
  const q = query(collection(db, path), orderBy('departureHour', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items: FirestoreFlightDoc[] = snapshot.docs.map((d) => d.data() as FirestoreFlightDoc);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function seedDefaultFlightsIfEmpty(adminUid: string): Promise<number> {
  const path = FLIGHTS_COL;
  try {
    const existingSnap = await getDocs(query(collection(db, path), limit(1)));
    if (!existingSnap.empty) {
      return 0;
    }
    return await seedMissingDefaultFlights(adminUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function seedMissingDefaultFlights(adminUid: string): Promise<number> {
  const path = FLIGHTS_COL;
  try {
    const existingSnap = await getDocs(collection(db, path));
    const existingIds = new Set(existingSnap.docs.map((d) => d.id));
    const batch = writeBatch(db);
    let addedCount = 0;

    for (const bp of BLUEPRINTS) {
      const id = sanitizeFlightId(bp.flightNumber);
      if (existingIds.has(id)) continue;

      const fields = buildValidatedFlightFields({
        flightNumber: bp.flightNumber,
        airlineName: bp.airlineName,
        airlineIata: bp.iata,
        airlineIcao: bp.icao,
        airlineCallsign: bp.callsign,
        airlineAccentColor: bp.accentColor,
        originIata: bp.origin.iata,
        originIcao: bp.origin.icao,
        originName: bp.origin.name,
        originCity: bp.origin.city,
        originCountry: bp.origin.country,
        originTerminal: bp.origin.terminal,
        originGate: bp.origin.gate,
        destinationIata: bp.destination.iata,
        destinationIcao: bp.destination.icao,
        destinationName: bp.destination.name,
        destinationCity: bp.destination.city,
        destinationCountry: bp.destination.country,
        destinationTerminal: bp.destination.terminal,
        destinationGate: bp.destination.gate,
        aircraftModel: bp.aircraftModel,
        registration: bp.registration,
        departureHour: bp.departureHour,
        departureMinute: bp.departureMinute,
        durationMinutes: bp.durationMinutes,
        routeType: bp.routeType,
        distanceKm: bp.distanceKm,
        statusOverride: 'AUTO',
        delayMinutes: 0,
        disruptionReason: '',
      });

      batch.set(doc(db, path, id), {
        id,
        ...fields,
        createdBy: adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      addedCount++;
    }

    if (addedCount > 0) {
      await batch.commit();
    }
    return addedCount;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createFlight(
  input: FlightFormPayload,
  adminUid: string
): Promise<string> {
  const id = sanitizeFlightId(input.flightNumber);
  const path = `${FLIGHTS_COL}/${id}`;
  try {
    const existing = await getDoc(doc(db, FLIGHTS_COL, id));
    if (existing.exists()) {
      throw new Error(`Flight ${input.flightNumber.toUpperCase()} already exists in database.`);
    }

    const fields = buildValidatedFlightFields(input);
    await setDoc(doc(db, FLIGHTS_COL, id), {
      id,
      ...fields,
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists in database')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateFlight(
  flightId: string,
  input: FlightFormPayload
): Promise<void> {
  const path = `${FLIGHTS_COL}/${flightId}`;
  try {
    const fields = buildValidatedFlightFields(input);
    await updateDoc(doc(db, FLIGHTS_COL, flightId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateFlightQuickStatus(
  flightId: string,
  statusOverride: FirestoreFlightDoc['statusOverride'],
  currentDelayMinutes = 0
): Promise<void> {
  const path = `${FLIGHTS_COL}/${flightId}`;
  try {
    const nextDelayMinutes =
      statusOverride === 'DELAYED'
        ? Math.min(1440, Math.max(15, currentDelayMinutes || 30))
        : statusOverride === 'AUTO'
        ? Math.min(1440, Math.max(0, currentDelayMinutes || 0))
        : 0;

    await updateDoc(doc(db, FLIGHTS_COL, flightId), {
      statusOverride,
      delayMinutes: nextDelayMinutes,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteFlight(flightId: string): Promise<void> {
  const path = `${FLIGHTS_COL}/${flightId}`;
  try {
    await deleteDoc(doc(db, FLIGHTS_COL, flightId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// =============================================================================
// Global Auth Settings (/settings/auth_config)
// =============================================================================

export async function getAuthSettings(): Promise<AuthSettings> {
  const path = `${SETTINGS_COL}/${AUTH_CONFIG_ID}`;
  try {
    const snap = await getDoc(doc(db, SETTINGS_COL, AUTH_CONFIG_ID));
    if (!snap.exists()) {
      return {
        allowSignup: true,
        requireApproval: false,
        updatedBy: 'system',
        updatedAt: null,
      };
    }
    return snap.data() as AuthSettings;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeToAuthSettings(
  onData: (settings: AuthSettings) => void
): Unsubscribe {
  const path = `${SETTINGS_COL}/${AUTH_CONFIG_ID}`;
  return onSnapshot(
    doc(db, SETTINGS_COL, AUTH_CONFIG_ID),
    (snap) => {
      if (!snap.exists()) {
        onData({
          allowSignup: true,
          requireApproval: false,
          updatedBy: 'system',
          updatedAt: null,
        });
      } else {
        onData(snap.data() as AuthSettings);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function ensureAuthConfigExists(adminUid: string): Promise<void> {
  const path = `${SETTINGS_COL}/${AUTH_CONFIG_ID}`;
  try {
    const ref = doc(db, SETTINGS_COL, AUTH_CONFIG_ID);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        allowSignup: true,
        requireApproval: false,
        updatedBy: adminUid,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateAuthSettings(
  allowSignup: boolean,
  requireApproval: boolean,
  adminUid: string
): Promise<void> {
  const path = `${SETTINGS_COL}/${AUTH_CONFIG_ID}`;
  try {
    await setDoc(doc(db, SETTINGS_COL, AUTH_CONFIG_ID), {
      allowSignup,
      requireApproval,
      updatedBy: adminUid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// =============================================================================
// Users & Auth Logs
// =============================================================================

export async function ensureBootstrappedAdminRecord(user: FirebaseUser): Promise<void> {
  if (!isDesignatedAdminUser(user) || !user.email) return;
  const path = `${ADMINS_COL}/${user.uid}`;
  try {
    const ref = doc(db, ADMINS_COL, user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: user.email,
        grantedBy: user.uid,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserOnAuth(params: {
  firebaseUser: FirebaseUser;
  authProvider: AuthProviderType;
  mode: 'login' | 'signup';
  fullNameOverride?: string;
}): Promise<{
  profile: UserProfile | null;
  blockedReason: 'signup_disabled' | 'blocked' | 'deleted' | null;
}> {
  const { firebaseUser, authProvider, mode, fullNameOverride } = params;
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';
  const userPath = `${USERS_COL}/${uid}`;
  const isPrimaryAdmin = isDesignatedAdminUser(firebaseUser);

  try {
    const userRef = doc(db, USERS_COL, uid);
    const userSnap = await getDoc(userRef);

    // 1. New user registration (or account previously removed by admin)
    if (!userSnap.exists()) {
      if (mode === 'login' && authProvider === 'password' && !isPrimaryAdmin) {
        return { profile: null, blockedReason: 'deleted' };
      }

      const settings = await getAuthSettings();
      if (!isPrimaryAdmin && !settings.allowSignup) {
        return { profile: null, blockedReason: 'signup_disabled' };
      }

      const role: AppRole = isPrimaryAdmin ? 'admin' : 'user';
      const signupStatus: SignupStatus = isPrimaryAdmin
        ? 'approved'
        : settings.requireApproval
        ? 'pending'
        : 'approved';

      const fallbackName = isPrimaryAdmin ? 'Sakim' : email.split('@')[0] || 'Flight User';
      const fullName =
        (fullNameOverride || firebaseUser.displayName || fallbackName)
          .trim()
          .slice(0, 100) || fallbackName;

      await setDoc(userRef, {
        uid,
        fullName,
        email: email.slice(0, 160),
        role,
        signupStatus,
        authProvider,
        loginCount: 1,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      await addDoc(collection(db, AUTH_LOGS_COL), {
        uid,
        email: email.slice(0, 160),
        fullName,
        eventType: 'SIGNUP',
        authProvider,
        signupStatusAtEvent: signupStatus,
        createdAt: serverTimestamp(),
      });

      if (isPrimaryAdmin) {
        await ensureBootstrappedAdminRecord(firebaseUser);
        await ensureAuthConfigExists(uid);
        await seedDefaultFlightsIfEmpty(uid);
      }

      const createdSnap = await getDoc(userRef);
      return {
        profile: createdSnap.data() as UserProfile,
        blockedReason: null,
      };
    }

    // 2. Existing user login — unconditionally enforce role invariant in Firestore
    const existing = userSnap.data() as UserProfile;

    if (existing.signupStatus === 'blocked' && !isPrimaryAdmin) {
      await addDoc(collection(db, AUTH_LOGS_COL), {
        uid,
        email: email.slice(0, 160),
        fullName: existing.fullName,
        eventType: 'LOGIN',
        authProvider,
        signupStatusAtEvent: 'blocked',
        createdAt: serverTimestamp(),
      });
      return { profile: existing, blockedReason: 'blocked' };
    }

    const fallbackName = isPrimaryAdmin ? 'Sakim' : existing.fullName || 'Flight User';
    const nextFullName =
      (fullNameOverride || firebaseUser.displayName || existing.fullName || fallbackName)
        .trim()
        .slice(0, 100) || fallbackName;
    const nextLoginCount = Math.min(1000000, Math.max(1, (existing.loginCount || 0) + 1));

    if (isPrimaryAdmin) {
      // Unconditionally overwrite sakim@gmail.com to role: 'admin' & signupStatus: 'approved'
      await setDoc(
        userRef,
        {
          fullName: nextFullName,
          role: 'admin',
          signupStatus: 'approved',
          lastLoginAt: serverTimestamp(),
          loginCount: nextLoginCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } else {
      // Strictly overwrite any non-sakim@gmail.com account to role: 'user'
      await setDoc(
        userRef,
        {
          fullName: nextFullName,
          role: 'user',
          lastLoginAt: serverTimestamp(),
          loginCount: nextLoginCount,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }

    const effectiveStatus: SignupStatus = isPrimaryAdmin ? 'approved' : existing.signupStatus;

    await addDoc(collection(db, AUTH_LOGS_COL), {
      uid,
      email: email.slice(0, 160),
      fullName: nextFullName,
      eventType: 'LOGIN',
      authProvider,
      signupStatusAtEvent: effectiveStatus,
      createdAt: serverTimestamp(),
    });

    if (isPrimaryAdmin) {
      await ensureBootstrappedAdminRecord(firebaseUser);
      await ensureAuthConfigExists(uid);
      await seedDefaultFlightsIfEmpty(uid);
    }

    const updatedSnap = await getDoc(userRef);
    return {
      profile: updatedSnap.data() as UserProfile,
      blockedReason: null,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

export function subscribeToUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): Unsubscribe {
  const path = `${USERS_COL}/${uid}`;
  return onSnapshot(
    doc(db, USERS_COL, uid),
    (snap) => {
      onData(snap.exists() ? (snap.data() as UserProfile) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export function subscribeToAllUsers(
  onData: (users: UserProfile[]) => void
): Unsubscribe {
  const q = query(collection(db, USERS_COL), orderBy('lastLoginAt', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((d) => d.data() as UserProfile);
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, USERS_COL);
    }
  );
}

export function subscribeToAuthLogs(
  onData: (logs: AuthLogEntry[]) => void
): Unsubscribe {
  const q = query(collection(db, AUTH_LOGS_COL), orderBy('createdAt', 'desc'), limit(60));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AuthLogEntry[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AuthLogEntry, 'id'>),
      }));
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, AUTH_LOGS_COL);
    }
  );
}

export async function updateUserPermissions(
  targetUser: UserProfile,
  updates: { role?: AppRole; signupStatus?: SignupStatus },
  _adminUid: string
): Promise<void> {
  const path = `${USERS_COL}/${targetUser.uid}`;
  try {
    // Only sakim@gmail.com can ever hold the admin role; all other users stay 'user'
    const enforcedRole: AppRole = isDesignatedAdminEmail(targetUser.email) ? 'admin' : 'user';
    const payload: Record<string, unknown> = {
      role: enforcedRole,
      updatedAt: serverTimestamp(),
    };
    if (updates.signupStatus) {
      payload.signupStatus = updates.signupStatus;
    }

    await updateDoc(doc(db, USERS_COL, targetUser.uid), payload);

    if (!isDesignatedAdminEmail(targetUser.email)) {
      const adminDocRef = doc(db, ADMINS_COL, targetUser.uid);
      const adminSnap = await getDoc(adminDocRef);
      if (adminSnap.exists()) {
        await deleteDoc(adminDocRef);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteUserRecord(targetUser: UserProfile): Promise<void> {
  const path = `${USERS_COL}/${targetUser.uid}`;
  try {
    await deleteDoc(doc(db, USERS_COL, targetUser.uid));
    if (!isDesignatedAdminEmail(targetUser.email)) {
      const adminRef = doc(db, ADMINS_COL, targetUser.uid);
      const adminSnap = await getDoc(adminRef);
      if (adminSnap.exists()) {
        await deleteDoc(adminRef);
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
