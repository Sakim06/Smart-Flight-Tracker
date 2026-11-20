import React, { useState, useEffect, useMemo } from 'react';
import {
  Plane,
  Users,
  Plus,
  Pencil,
  Trash2,
  Database,
  ShieldCheck,
  Search,
  X,
  CheckCircle2,
  Clock,
  Ban,
  History,
  AlertCircle,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  AuthLogEntry,
  AuthSettings,
  FirestoreFlightDoc,
  FlightFormPayload,
  FlightStatusOverride,
  SignupStatus,
  UserProfile,
} from '../types/flight';
import {
  createFlight,
  updateFlight,
  deleteFlight,
  seedMissingDefaultFlights,
  subscribeToAllUsers,
  subscribeToAuthLogs,
  subscribeToAuthSettings,
  updateAuthSettings,
  updateUserPermissions,
  deleteUserRecord,
  isVerifiedBootstrappedAdmin,
} from '../services/firestoreService';
import { useAuth } from '../context/AuthContext';
import { formatTimeString } from '../services/flightMockService';

interface AdminConsoleProps {
  flights: FirestoreFlightDoc[];
}

const EMPTY_FLIGHT_FORM: FlightFormPayload = {
  flightNumber: '',
  airlineName: '',
  airlineIata: '',
  airlineIcao: '',
  airlineCallsign: '',
  airlineAccentColor: '#174A84',
  originIata: 'DAC',
  originIcao: 'VGHS',
  originName: 'Hazrat Shahjalal International Airport',
  originCity: 'Dhaka',
  originCountry: 'Bangladesh',
  originTerminal: 'International Terminal 1',
  originGate: 'Gate 3',
  destinationIata: '',
  destinationIcao: '',
  destinationName: '',
  destinationCity: '',
  destinationCountry: '',
  destinationTerminal: 'Main Terminal',
  destinationGate: 'Gate 1',
  aircraftModel: 'Boeing 737-800',
  registration: 'S2-AJA',
  departureHour: 10,
  departureMinute: 30,
  durationMinutes: 60,
  routeType: 'domestic',
  distanceKm: 250,
  statusOverride: 'AUTO',
  delayMinutes: 0,
  disruptionReason: '',
};

function formatFirestoreTimestamp(ts: unknown): string {
  if (!ts) return '—';
  try {
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      const d = (ts as { toDate: () => Date }).toDate();
      return d.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    if (ts instanceof Date) {
      return ts.toLocaleString();
    }
  } catch {
    // Fallback
  }
  return '—';
}

export const AdminConsole: React.FC<AdminConsoleProps> = ({ flights }) => {
  const { user } = useAuth();
  const isPrimaryAdmin = isVerifiedBootstrappedAdmin(user);

  const [subTab, setSubTab] = useState<'flights' | 'users' | 'logs'>('flights');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  // Flights CRUD State
  const [flightFilter, setFlightFilter] = useState('');
  const [editingFlight, setEditingFlight] = useState<FirestoreFlightDoc | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [flightForm, setFlightForm] = useState<FlightFormPayload>(EMPTY_FLIGHT_FORM);
  const [confirmDeleteFlight, setConfirmDeleteFlight] = useState<FirestoreFlightDoc | null>(null);

  // Users, Settings & Logs State
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [authLogs, setAuthLogs] = useState<AuthLogEntry[]>([]);
  const [authSettings, setAuthSettings] = useState<AuthSettings>({
    allowSignup: true,
    requireApproval: false,
    updatedBy: 'system',
    updatedAt: null,
  });
  const [userFilter, setUserFilter] = useState('');
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubSettings = subscribeToAuthSettings(setAuthSettings);
    let unsubUsers = () => {};
    let unsubLogs = () => {};

    if (isPrimaryAdmin) {
      unsubUsers = subscribeToAllUsers(setUsersList);
      unsubLogs = subscribeToAuthLogs(setAuthLogs);
    }

    return () => {
      unsubSettings();
      unsubUsers();
      unsubLogs();
    };
  }, [isPrimaryAdmin]);

  const filteredFlights = useMemo(() => {
    const q = flightFilter.trim().toLowerCase();
    if (!q) return flights;
    return flights.filter(
      (f) =>
        f.flightNumber.toLowerCase().includes(q) ||
        f.airlineName.toLowerCase().includes(q) ||
        f.originCity.toLowerCase().includes(q) ||
        f.originIata.toLowerCase().includes(q) ||
        f.destinationCity.toLowerCase().includes(q) ||
        f.destinationIata.toLowerCase().includes(q)
    );
  }, [flights, flightFilter]);

  const filteredUsers = useMemo(() => {
    const q = userFilter.trim().toLowerCase();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.signupStatus.toLowerCase().includes(q)
    );
  }, [usersList, userFilter]);

  const showSuccess = (message: string) => {
    setFeedback({ type: 'success', message });
  };

  const showError = (err: unknown) => {
    let msg = err instanceof Error ? err.message : String(err);
    try {
      const parsed = JSON.parse(msg);
      if (parsed?.error) msg = parsed.error;
    } catch {
      // keep raw
    }
    setFeedback({ type: 'error', message: msg });
  };

  // ===========================================================================
  // Flight CRUD Handlers
  // ===========================================================================

  const openCreateModal = () => {
    setEditingFlight(null);
    setFlightForm(EMPTY_FLIGHT_FORM);
    setIsCreateOpen(true);
    setFeedback(null);
  };

  const openEditModal = (flight: FirestoreFlightDoc) => {
    setEditingFlight(flight);
    setFlightForm({
      flightNumber: flight.flightNumber,
      airlineName: flight.airlineName,
      airlineIata: flight.airlineIata,
      airlineIcao: flight.airlineIcao,
      airlineCallsign: flight.airlineCallsign,
      airlineAccentColor: flight.airlineAccentColor,
      originIata: flight.originIata,
      originIcao: flight.originIcao,
      originName: flight.originName,
      originCity: flight.originCity,
      originCountry: flight.originCountry,
      originTerminal: flight.originTerminal,
      originGate: flight.originGate,
      destinationIata: flight.destinationIata,
      destinationIcao: flight.destinationIcao,
      destinationName: flight.destinationName,
      destinationCity: flight.destinationCity,
      destinationCountry: flight.destinationCountry,
      destinationTerminal: flight.destinationTerminal,
      destinationGate: flight.destinationGate,
      aircraftModel: flight.aircraftModel,
      registration: flight.registration,
      departureHour: flight.departureHour,
      departureMinute: flight.departureMinute,
      durationMinutes: flight.durationMinutes,
      routeType: flight.routeType,
      distanceKm: flight.distanceKm,
      statusOverride: flight.statusOverride,
      delayMinutes: flight.delayMinutes,
      disruptionReason: flight.disruptionReason,
    });
    setIsCreateOpen(true);
    setFeedback(null);
  };

  const handleSaveFlight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!flightForm.flightNumber.trim() || !flightForm.airlineName.trim() || !flightForm.destinationIata.trim()) {
      setFeedback({ type: 'error', message: 'Flight number, airline name, and destination IATA are required.' });
      return;
    }

    setIsBusy(true);
    try {
      if (editingFlight) {
        await updateFlight(editingFlight.id, flightForm);
        showSuccess(`Updated flight ${flightForm.flightNumber.toUpperCase()}.`);
      } else {
        await createFlight(flightForm, user.uid);
        showSuccess(`Created flight ${flightForm.flightNumber.toUpperCase()} in Firestore.`);
      }
      setIsCreateOpen(false);
      setEditingFlight(null);
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteFlightConfirm = async () => {
    if (!confirmDeleteFlight) return;
    setIsBusy(true);
    try {
      await deleteFlight(confirmDeleteFlight.id);
      showSuccess(`Deleted flight ${confirmDeleteFlight.flightNumber} from Firestore.`);
      setConfirmDeleteFlight(null);
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSeedDefaults = async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      const added = await seedMissingDefaultFlights(user.uid);
      if (added === 0) {
        showSuccess('All default flights are already present in Firestore.');
      } else {
        showSuccess(`Seeded ${added} default flight records into Firestore.`);
      }
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  // ===========================================================================
  // User Permissions & Auth Settings Handlers
  // ===========================================================================

  const handleToggleAllowSignup = async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      const next = !authSettings.allowSignup;
      await updateAuthSettings(next, authSettings.requireApproval, user.uid);
      showSuccess(next ? 'New user signups enabled globally.' : 'New user signups disabled globally.');
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleRequireApproval = async () => {
    if (!user) return;
    setIsBusy(true);
    try {
      const next = !authSettings.requireApproval;
      await updateAuthSettings(authSettings.allowSignup, next, user.uid);
      showSuccess(
        next
          ? 'New signups will wait in Pending status until approved by Admin.'
          : 'New signups will be auto-approved immediately.'
      );
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleSetUserStatus = async (target: UserProfile, signupStatus: SignupStatus) => {
    if (!user) return;
    setIsBusy(true);
    try {
      await updateUserPermissions(target, { signupStatus }, user.uid);
      showSuccess(`Set ${target.email} signup permission to ${signupStatus.toUpperCase()}.`);
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleToggleUserRole = async (target: UserProfile) => {
    if (!user) return;
    const nextRole = target.role === 'admin' ? 'user' : 'admin';
    setIsBusy(true);
    try {
      await updateUserPermissions(target, { role: nextRole }, user.uid);
      showSuccess(`Updated ${target.email} role to ${nextRole.toUpperCase()}.`);
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!confirmDeleteUser) return;
    setIsBusy(true);
    try {
      await deleteUserRecord(confirmDeleteUser);
      showSuccess(`Deleted user record for ${confirmDeleteUser.email}.`);
      setConfirmDeleteUser(null);
    } catch (err) {
      showError(err);
    } finally {
      setIsBusy(false);
    }
  };

  const pendingUsersCount = useMemo(
    () => usersList.filter((u) => u.signupStatus === 'pending').length,
    [usersList]
  );

  return (
    <div className="w-full space-y-6 animate-fadeIn">
      {/* Admin Header & Summary Strip */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Administrator Operations Console
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Full Firestore CRUD for flight schedules, global signup controls, user approval permissions, and login audit logs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs tabular-nums">
            <div>
              <span className="text-slate-500 block">Flights in DB</span>
              <span className="font-mono font-bold text-base text-slate-900">{flights.length}</span>
            </div>
            {isPrimaryAdmin && (
              <>
                <div className="h-7 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-500 block">Registered Users</span>
                  <span className="font-mono font-bold text-base text-slate-900">{usersList.length}</span>
                </div>
                <div className="h-7 w-px bg-slate-200" />
                <div>
                  <span className="text-slate-500 block">Pending Approval</span>
                  <span className={`font-mono font-bold text-base ${pendingUsersCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {pendingUsersCount}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Admin Sub-Navigation */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1">
            <button
              type="button"
              onClick={() => setSubTab('flights')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                subTab === 'flights'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>Flight Inventory (CRUD)</span>
            </button>

            {isPrimaryAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => setSubTab('users')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    subTab === 'users'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Users &amp; Signup Permissions</span>
                  {pendingUsersCount > 0 && (
                    <span className="ml-1 font-mono text-2xs font-bold text-amber-700">
                      ({pendingUsersCount})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSubTab('logs')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    subTab === 'logs'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <History className="w-3.5 h-3.5" />
                  <span>Login &amp; Signup Logs</span>
                </button>
              </>
            )}
          </div>

          {subTab === 'flights' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSeedDefaults}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Seed Default Flights</span>
              </button>
              <button
                type="button"
                onClick={openCreateModal}
                disabled={isBusy}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add New Flight</span>
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Feedback Banner */}
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs sm:text-sm ${
            feedback.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2 font-medium">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 p-1"
            aria-label="Dismiss message"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: FLIGHT INVENTORY CRUD */}
      {subTab === 'flights' && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={flightFilter}
                onChange={(e) => setFlightFilter(e.target.value)}
                placeholder="Filter by flight #, airline, origin, or destination..."
                className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
              />
            </div>
            <span className="text-xs text-slate-500 tabular-nums">
              Showing <strong className="text-slate-900">{filteredFlights.length}</strong> of {flights.length} flights
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider font-bold text-slate-500">
                  <th className="py-3 px-4">Flight &amp; Airline</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Departure</th>
                  <th className="py-3 px-4">Gates / Aircraft</th>
                  <th className="py-3 px-4">Status Control</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm tabular-nums">
                {filteredFlights.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-500">
                      No flights found. Click &ldquo;Seed Default Flights&rdquo; or &ldquo;Add New Flight&rdquo; to populate Firestore.
                    </td>
                  </tr>
                ) : (
                  filteredFlights.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900">{f.flightNumber}</div>
                        <div className="text-2xs text-slate-500">{f.airlineName} · {f.routeType}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-slate-900">
                          {f.originIata} → {f.destinationIata}
                        </div>
                        <div className="text-2xs text-slate-500">
                          {f.originCity} to {f.destinationCity}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono">
                        <div className="font-semibold text-slate-900">
                          {formatTimeString(f.departureHour, f.departureMinute)}
                        </div>
                        <div className="text-2xs text-slate-500">
                          {f.durationMinutes}m · {f.distanceKm} km
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-800 font-medium">
                          {f.originGate || '—'} → {f.destinationGate || '—'}
                        </div>
                        <div className="text-2xs text-slate-500">
                          {f.aircraftModel} · {f.registration}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-semibold border ${
                            f.statusOverride === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : f.statusOverride === 'DELAYED'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : f.statusOverride === 'ARRIVED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : f.statusOverride === 'DEPARTED'
                              ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {f.statusOverride === 'AUTO'
                            ? 'AUTO (Dynamic)'
                            : f.statusOverride === 'DELAYED'
                            ? `DELAYED (+${f.delayMinutes}m)`
                            : f.statusOverride}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(f)}
                            className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                            title={`Edit ${f.flightNumber}`}
                            aria-label={`Edit ${f.flightNumber}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteFlight(f)}
                            className="p-1.5 text-slate-600 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                            title={`Delete ${f.flightNumber}`}
                            aria-label={`Delete ${f.flightNumber}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: USERS & SIGNUP PERMISSIONS */}
      {subTab === 'users' && isPrimaryAdmin && (
        <div className="space-y-6">
          {/* Global Signup Policy Controls */}
          <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">
              Global User Signup Permissions
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    {authSettings.allowSignup ? (
                      <Unlock className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Lock className="w-4 h-4 text-rose-600" />
                    )}
                    <span>Allow New User Signups</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    When disabled, new Google or Email/Password registrations are blocked at creation time.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleAllowSignup}
                  disabled={isBusy}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    authSettings.allowSignup
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {authSettings.allowSignup ? 'Open' : 'Closed'}
                </button>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 font-semibold text-sm text-slate-900">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span>Require Admin Approval</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    When enabled, newly registered users wait in Pending status until you approve them below.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleRequireApproval}
                  disabled={isBusy}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                    authSettings.requireApproval
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                  }`}
                >
                  {authSettings.requireApproval ? 'Required' : 'Auto-Approve'}
                </button>
              </div>
            </div>
          </section>

          {/* User Directory Table */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                  placeholder="Search users by name, email, or status..."
                  className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-600"
                />
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {filteredUsers.length} registered accounts
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider font-bold text-slate-500">
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role &amp; Provider</th>
                    <th className="py-3 px-4">Signup Permission</th>
                    <th className="py-3 px-4">Logins &amp; Activity</th>
                    <th className="py-3 px-4 text-right">Manage User</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm tabular-nums">
                  {filteredUsers.map((u) => {
                    const isSelf = u.uid === user?.uid;
                    const isPrimary = u.email === 'neymarsakim@gmail.com';
                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{u.fullName}</div>
                          <div className="text-2xs text-slate-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-800 uppercase text-2xs">
                            {u.role} · {u.authProvider}
                          </div>
                          <div className="text-2xs text-slate-400">
                            Joined {formatFirestoreTimestamp(u.createdAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-2xs font-semibold border ${
                              u.signupStatus === 'approved'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : u.signupStatus === 'pending'
                                ? 'bg-amber-50 text-amber-800 border-amber-300'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {u.signupStatus === 'approved' && <CheckCircle2 className="w-3 h-3" />}
                            {u.signupStatus === 'pending' && <Clock className="w-3 h-3" />}
                            {u.signupStatus === 'blocked' && <Ban className="w-3 h-3" />}
                            <span className="uppercase">{u.signupStatus}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-semibold text-slate-900">
                            {u.loginCount} {u.loginCount === 1 ? 'login' : 'logins'}
                          </div>
                          <div className="text-2xs text-slate-500">
                            Last: {formatFirestoreTimestamp(u.lastLoginAt)}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {isSelf || isPrimary ? (
                            <span className="text-2xs text-slate-400 font-medium">Primary Admin</span>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              {u.signupStatus !== 'approved' && (
                                <button
                                  type="button"
                                  onClick={() => handleSetUserStatus(u, 'approved')}
                                  disabled={isBusy}
                                  className="px-2.5 py-1 text-2xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
                                >
                                  Approve
                                </button>
                              )}
                              {u.signupStatus !== 'blocked' && (
                                <button
                                  type="button"
                                  onClick={() => handleSetUserStatus(u, 'blocked')}
                                  disabled={isBusy}
                                  className="px-2.5 py-1 text-2xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md transition-colors"
                                >
                                  Block
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleToggleUserRole(u)}
                                disabled={isBusy}
                                className="px-2.5 py-1 text-2xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition-colors"
                              >
                                {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteUser(u)}
                                disabled={isBusy}
                                className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-colors"
                                title={`Delete ${u.email}`}
                                aria-label={`Delete ${u.email}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 3: AUTHENTICATION LOGS */}
      {subTab === 'logs' && isPrimaryAdmin && (
        <section className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Recent User Sign-Up &amp; Login History (Firestore Audit Log)
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              Latest {authLogs.length} events
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider font-bold text-slate-500">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Event</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Provider</th>
                  <th className="py-3 px-4">Permission State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm tabular-nums">
                {authLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No authentication events recorded yet.
                    </td>
                  </tr>
                ) : (
                  authLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-mono text-xs text-slate-600">
                        {formatFirestoreTimestamp(log.createdAt)}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-2xs font-bold border ${
                            log.eventType === 'SIGNUP'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {log.eventType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-slate-900">{log.fullName}</div>
                        <div className="text-2xs font-mono text-slate-500">{log.email}</div>
                      </td>
                      <td className="py-2.5 px-4 uppercase text-2xs font-semibold text-slate-600">
                        {log.authProvider}
                      </td>
                      <td className="py-2.5 px-4 uppercase text-2xs font-semibold text-slate-700">
                        {log.signupStatusAtEvent}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* CREATE / EDIT FLIGHT MODAL */}
      {isCreateOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
            <div className="px-6 py-4 bg-slate-950 text-white flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingFlight ? `Edit Flight ${editingFlight.flightNumber}` : 'Create New Flight Schedule'}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFlight} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {/* Row 1: Flight # & Airline */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">
                    Flight Number *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!!editingFlight}
                    value={flightForm.flightNumber}
                    onChange={(e) => setFlightForm({ ...flightForm, flightNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. BG 205"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg disabled:opacity-60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">
                    Airline Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={flightForm.airlineName}
                    onChange={(e) => setFlightForm({ ...flightForm, airlineName: e.target.value })}
                    placeholder="e.g. Biman Bangladesh Airlines"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Airline IATA</label>
                  <input
                    type="text"
                    value={flightForm.airlineIata}
                    onChange={(e) => setFlightForm({ ...flightForm, airlineIata: e.target.value.toUpperCase() })}
                    placeholder="BG"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Airline ICAO</label>
                  <input
                    type="text"
                    value={flightForm.airlineIcao}
                    onChange={(e) => setFlightForm({ ...flightForm, airlineIcao: e.target.value.toUpperCase() })}
                    placeholder="BBC"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Route Type</label>
                  <select
                    value={flightForm.routeType}
                    onChange={(e) =>
                      setFlightForm({
                        ...flightForm,
                        routeType: e.target.value as 'domestic' | 'international',
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="domestic">Domestic</option>
                    <option value="international">International</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Accent Color</label>
                  <input
                    type="text"
                    value={flightForm.airlineAccentColor}
                    onChange={(e) => setFlightForm({ ...flightForm, airlineAccentColor: e.target.value })}
                    placeholder="#174A84"
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {/* Origin & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-800">Origin Airport</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={flightForm.originIata}
                      onChange={(e) => setFlightForm({ ...flightForm, originIata: e.target.value.toUpperCase() })}
                      placeholder="IATA (DAC)"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={flightForm.originIcao}
                      onChange={(e) => setFlightForm({ ...flightForm, originIcao: e.target.value.toUpperCase() })}
                      placeholder="ICAO (VGHS)"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={flightForm.originName}
                    onChange={(e) => setFlightForm({ ...flightForm, originName: e.target.value })}
                    placeholder="Airport Full Name"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={flightForm.originCity}
                      onChange={(e) => setFlightForm({ ...flightForm, originCity: e.target.value })}
                      placeholder="City"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={flightForm.originCountry}
                      onChange={(e) => setFlightForm({ ...flightForm, originCountry: e.target.value })}
                      placeholder="Country"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={flightForm.originTerminal}
                      onChange={(e) => setFlightForm({ ...flightForm, originTerminal: e.target.value })}
                      placeholder="Terminal"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={flightForm.originGate}
                      onChange={(e) => setFlightForm({ ...flightForm, originGate: e.target.value })}
                      placeholder="Gate"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="text-xs font-bold text-slate-800">Destination Airport</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={flightForm.destinationIata}
                      onChange={(e) => setFlightForm({ ...flightForm, destinationIata: e.target.value.toUpperCase() })}
                      placeholder="IATA (DXB)"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={flightForm.destinationIcao}
                      onChange={(e) => setFlightForm({ ...flightForm, destinationIcao: e.target.value.toUpperCase() })}
                      placeholder="ICAO (OMDB)"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    value={flightForm.destinationName}
                    onChange={(e) => setFlightForm({ ...flightForm, destinationName: e.target.value })}
                    placeholder="Airport Full Name"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      required
                      value={flightForm.destinationCity}
                      onChange={(e) => setFlightForm({ ...flightForm, destinationCity: e.target.value })}
                      placeholder="City"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      required
                      value={flightForm.destinationCountry}
                      onChange={(e) => setFlightForm({ ...flightForm, destinationCountry: e.target.value })}
                      placeholder="Country"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={flightForm.destinationTerminal}
                      onChange={(e) => setFlightForm({ ...flightForm, destinationTerminal: e.target.value })}
                      placeholder="Terminal"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                    <input
                      type="text"
                      value={flightForm.destinationGate}
                      onChange={(e) => setFlightForm({ ...flightForm, destinationGate: e.target.value })}
                      placeholder="Gate"
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Schedule & Status Control */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Dep Hour (0-23)</label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={flightForm.departureHour}
                    onChange={(e) => setFlightForm({ ...flightForm, departureHour: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Dep Min (0-59)</label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={flightForm.departureMinute}
                    onChange={(e) => setFlightForm({ ...flightForm, departureMinute: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={flightForm.durationMinutes}
                    onChange={(e) => setFlightForm({ ...flightForm, durationMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Distance (km)</label>
                  <input
                    type="number"
                    min={1}
                    max={25000}
                    value={flightForm.distanceKm}
                    onChange={(e) => setFlightForm({ ...flightForm, distanceKm: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Aircraft Model</label>
                  <input
                    type="text"
                    value={flightForm.aircraftModel}
                    onChange={(e) => setFlightForm({ ...flightForm, aircraftModel: e.target.value })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Tail Registration</label>
                  <input
                    type="text"
                    value={flightForm.registration}
                    onChange={(e) => setFlightForm({ ...flightForm, registration: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Status Override</label>
                  <select
                    value={flightForm.statusOverride}
                    onChange={(e) =>
                      setFlightForm({
                        ...flightForm,
                        statusOverride: e.target.value as FlightStatusOverride,
                      })
                    }
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <option value="AUTO">AUTO (Time-Based)</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="ON_TIME">ON_TIME</option>
                    <option value="DEPARTED">DEPARTED</option>
                    <option value="DELAYED">DELAYED</option>
                    <option value="ARRIVED">ARRIVED</option>
                    <option value="CANCELLED">CANCELLED</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Delay Minutes</label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    value={flightForm.delayMinutes}
                    onChange={(e) => setFlightForm({ ...flightForm, delayMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold uppercase text-slate-600 mb-1">Disruption Reason</label>
                  <input
                    type="text"
                    value={flightForm.disruptionReason}
                    onChange={(e) => setFlightForm({ ...flightForm, disruptionReason: e.target.value })}
                    placeholder="Optional note"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBusy}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                >
                  {isBusy ? 'Saving...' : editingFlight ? 'Save Changes' : 'Create Flight'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE FLIGHT CONFIRMATION MODAL */}
      {confirmDeleteFlight && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete Flight Schedule?</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Permanently remove <strong>{confirmDeleteFlight.flightNumber}</strong> ({confirmDeleteFlight.originIata} → {confirmDeleteFlight.destinationIata}) from Firestore?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteFlight(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteFlightConfirm}
                disabled={isBusy}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {isBusy ? 'Deleting...' : 'Delete Flight'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE USER CONFIRMATION MODAL */}
      {confirmDeleteUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="max-w-sm w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Delete User Record?</h3>
            <p className="text-xs sm:text-sm text-slate-600">
              Permanently remove user <strong>{confirmDeleteUser.fullName}</strong> (<span className="font-mono">{confirmDeleteUser.email}</span>) from Firestore and revoke their app access?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteUser(null)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUserConfirm}
                disabled={isBusy}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                {isBusy ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
