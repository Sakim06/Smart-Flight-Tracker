import React, { useState, useEffect } from 'react';
import {
  Plane,
  LogOut,
  ShieldCheck,
  AlertCircle,
  Calendar as CalendarIcon,
  Search,
  Clock,
  Ban,
  Map as MapIcon,
  Info,
  Plus,
  Users,
  Database,
  CheckCircle2,
  Trash2,
  X,
} from 'lucide-react';
import {
  AviationstackFlightItem,
  FlightRecord,
  FirestoreFlightDoc,
  FlightStatusOverride,
  AppState,
} from './types/flight';
import { searchFirestoreFlights, validateFlightQuery } from './services/flightMockService';
import {
  createFlight,
  deleteFlight,
  sanitizeFlightId,
  seedMissingDefaultFlights,
  subscribeToFlights,
  updateFlight,
  updateFlightQuickStatus,
} from './services/firestoreService';
import {
  fetchAviationstackFlight,
  mapAviationstackToFirestorePayload,
  mapAviationstackToFlightRecord,
} from './services/liveAviationService';
import { FlightSearchForm } from './components/FlightSearchForm';
import { FlightDetailsCard } from './components/FlightDetailsCard';
import { FlightSkeletonLoader } from './components/FlightSkeletonLoader';
import { FlightNoResult } from './components/FlightNoResult';
import { FlightIdleState } from './components/FlightIdleState';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthScreen } from './components/AuthScreen';
import { DailyScheduleExplorer } from './components/DailyScheduleExplorer';
import { LiveFlightMap, MapFocusPoint } from './components/LiveFlightMap';
import { FlightFormModal } from './components/FlightFormModal';
import { UsersPermissionsModal } from './components/UsersPermissionsModal';
import { ErrorBoundary } from './components/ErrorBoundary';

function SmartFlightTrackerContent() {
  const {
    user,
    userProfile,
    isAdmin,
    isApproved,
    isPendingApproval,
    isBlocked,
    signOut,
    isLoading: isAuthLoading,
  } = useAuth();

  const [appState, setAppState] = useState<AppState>('UNAUTHENTICATED');
  const [currentQuery, setCurrentQuery] = useState<string>('');
  const [flightData, setFlightData] = useState<FlightRecord | null>(null);
  const [firestoreFlights, setFirestoreFlights] = useState<FirestoreFlightDoc[]>([]);
  const [flightsLoaded, setFlightsLoaded] = useState<boolean>(false);
  const [formatErrorMessage, setFormatErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'search' | 'schedule' | 'map'>('search');
  const [liveLookupNotice, setLiveLookupNotice] = useState<string | null>(null);
  const [rawAviationstackItem, setRawAviationstackItem] = useState<AviationstackFlightItem | null>(null);
  const [isSavingToFirestore, setIsSavingToFirestore] = useState<boolean>(false);
  const [savedToFirestoreMessage, setSavedToFirestoreMessage] = useState<string | null>(null);
  const [mapFocusPoint, setMapFocusPoint] = useState<MapFocusPoint | null>(null);

  // Unified Inline Admin Modal & CRUD States (Active only when isAdmin === true)
  const [isFlightModalOpen, setIsFlightModalOpen] = useState<boolean>(false);
  const [editingFlightDoc, setEditingFlightDoc] = useState<FirestoreFlightDoc | null>(null);
  const [deletingFlightDoc, setDeletingFlightDoc] = useState<FirestoreFlightDoc | null>(null);
  const [isDeletingFlight, setIsDeletingFlight] = useState<boolean>(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);
  const [isSeedingFlights, setIsSeedingFlights] = useState<boolean>(false);
  const [adminFeedback, setAdminFeedback] = useState<string | null>(null);

  // Attach real-time Firestore flights listener only when authenticated and approved
  useEffect(() => {
    if (!user || !isApproved) {
      setFirestoreFlights([]);
      setFlightsLoaded(false);
      return;
    }

    const unsubscribe = subscribeToFlights((docs) => {
      setFirestoreFlights(docs);
      setFlightsLoaded(true);
    });

    return () => unsubscribe();
  }, [user, isApproved]);

  // Keep active selected Firestore flight updated if Admin modifies it in Firestore
  useEffect(() => {
    if (
      appState === 'RESULT_FOUND' &&
      currentQuery &&
      firestoreFlights.length > 0 &&
      flightData?.dataSource !== 'aviationstack'
    ) {
      const updated = searchFirestoreFlights(firestoreFlights, currentQuery);
      if (updated.status === 'success' && updated.data) {
        setFlightData({ ...updated.data, dataSource: 'firestore' });
      }
    }
  }, [firestoreFlights, appState, currentQuery, flightData?.dataSource]);

  // Sync auth state with appState
  useEffect(() => {
    if (isAuthLoading) return;

    if (!user) {
      setAppState('UNAUTHENTICATED');
      setFlightData(null);
      setCurrentQuery('');
      setFormatErrorMessage(null);
      setLiveLookupNotice(null);
      setRawAviationstackItem(null);
      setSavedToFirestoreMessage(null);
      setActiveTab('search');
    } else {
      setAppState((prev) => (prev === 'UNAUTHENTICATED' ? 'IDLE_SEARCH' : prev));
    }
  }, [user, isAuthLoading]);

  const handleSelectFlightFromSchedule = (flight: FlightRecord) => {
    setFlightData({ ...flight, dataSource: 'firestore' });
    setRawAviationstackItem(null);
    setLiveLookupNotice(null);
    setSavedToFirestoreMessage(null);
    setCurrentQuery(flight.flightNumber);
    setAppState('RESULT_FOUND');
  };

  // Search flights via Live Aviationstack Backend API + Cloud Firestore Schedule Catalog
  const handleSearch = async (query: string) => {
    setActiveTab('search');
    setSavedToFirestoreMessage(null);
    setLiveLookupNotice(null);
    setRawAviationstackItem(null);

    const validation = validateFlightQuery(query);
    if (!validation.isValid) {
      setFormatErrorMessage(
        validation.error || 'Invalid flight number format. Please enter a valid airline code and number (e.g., BG 001, EK 585, SQ 308).'
      );
      setAppState('INVALID_FORMAT');
      return;
    }

    setFormatErrorMessage(null);
    setCurrentQuery(query);
    setAppState('LOADING');

    const firestoreResult = searchFirestoreFlights(firestoreFlights, query);

    try {
      const liveRes = await fetchAviationstackFlight(query);

      if (liveRes.configured && !liveRes.error && liveRes.data.length > 0) {
        const primaryItem = liveRes.data[0];
        const liveRecord = mapAviationstackToFlightRecord(primaryItem);
        setRawAviationstackItem(primaryItem);
        setFlightData(liveRecord);
        setAppState('RESULT_FOUND');
        return;
      }

      // Live API returned an explicit status (not configured, rate limited, or no active live match)
      if (!liveRes.configured) {
        setLiveLookupNotice(
          'Live Aviationstack API key (AVIATIONSTACK_API_KEY) is not configured in server secrets yet. Showing matching Cloud Firestore schedules only.'
        );
      } else if (liveRes.error) {
        setLiveLookupNotice(`Aviationstack live feed notice: ${liveRes.error}`);
      } else if (firestoreResult.status === 'success') {
        setLiveLookupNotice(
          'No active live Aviationstack flight returned for this flight number right now. Showing stored schedule from Cloud Firestore.'
        );
      }
    } catch {
      setLiveLookupNotice(
        'Could not reach Aviationstack backend endpoint right now. Showing matching Cloud Firestore schedules if available.'
      );
    }

    if (firestoreResult.status === 'success' && firestoreResult.data) {
      setFlightData({ ...firestoreResult.data, dataSource: 'firestore' });
      setAppState('RESULT_FOUND');
    } else {
      setFlightData(null);
      setAppState('NOT_FOUND');
    }
  };

  const handleSaveLiveFlightToFirestore = async () => {
    if (!isAdmin || !user || !rawAviationstackItem) return;
    setIsSavingToFirestore(true);
    setSavedToFirestoreMessage(null);
    try {
      const payload = mapAviationstackToFirestorePayload(rawAviationstackItem);
      const docId = sanitizeFlightId(payload.flightNumber);
      const existsInCatalog = firestoreFlights.some((f) => f.id === docId);

      if (existsInCatalog) {
        await updateFlight(docId, payload);
        setSavedToFirestoreMessage(`Updated ${payload.flightNumber} in Firestore schedules.`);
      } else {
        await createFlight(payload, user.uid);
        setSavedToFirestoreMessage(`Saved ${payload.flightNumber} to Firestore schedules.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save schedule to Firestore.';
      setLiveLookupNotice(msg);
    } finally {
      setIsSavingToFirestore(false);
    }
  };

  // Resolve matching Firestore flight doc for currently viewed FlightDetailsCard
  const activeFirestoreFlightDoc: FirestoreFlightDoc | null = flightData
    ? firestoreFlights.find(
        (doc) =>
          (flightData.id && doc.id === flightData.id) ||
          doc.normalizedCode === flightData.normalizedCode
      ) || null
    : null;

  const showAdminFeedback = (msg: string) => {
    setAdminFeedback(msg);
    window.setTimeout(() => {
      setAdminFeedback((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

  const handleOpenAddFlight = () => {
    if (!isAdmin) return;
    setEditingFlightDoc(null);
    setIsFlightModalOpen(true);
  };

  const handleOpenEditFlight = (doc: FirestoreFlightDoc) => {
    if (!isAdmin) return;
    setEditingFlightDoc(doc);
    setIsFlightModalOpen(true);
  };

  const handleQuickStatusChange = async (
    doc: FirestoreFlightDoc,
    nextStatus: FlightStatusOverride
  ) => {
    if (!isAdmin) return;
    try {
      await updateFlightQuickStatus(doc.id, nextStatus, doc.delayMinutes);
      showAdminFeedback(`Updated ${doc.flightNumber} status to ${nextStatus.replace('_', ' ')}.`);
    } catch (err) {
      setLiveLookupNotice(err instanceof Error ? err.message : 'Unable to update flight status.');
    }
  };

  const handleConfirmDeleteFlight = async () => {
    if (!isAdmin || !deletingFlightDoc) return;
    setIsDeletingFlight(true);
    try {
      const removed = deletingFlightDoc;
      await deleteFlight(removed.id);
      setDeletingFlightDoc(null);
      if (
        flightData &&
        (flightData.id === removed.id || flightData.normalizedCode === removed.normalizedCode)
      ) {
        setFlightData(null);
        setAppState('IDLE_SEARCH');
        setCurrentQuery('');
      }
      showAdminFeedback(`Deleted flight ${removed.flightNumber} from Cloud Firestore.`);
    } catch (err) {
      setLiveLookupNotice(err instanceof Error ? err.message : 'Unable to delete flight.');
    } finally {
      setIsDeletingFlight(false);
    }
  };

  const handleSeedSampleFlights = async () => {
    if (!isAdmin || !user) return;
    setIsSeedingFlights(true);
    try {
      const count = await seedMissingDefaultFlights(user.uid);
      showAdminFeedback(
        count > 0
          ? `Seeded ${count} sample commercial flights into Cloud Firestore.`
          : 'All sample flights are already present in Cloud Firestore.'
      );
    } catch (err) {
      setLiveLookupNotice(err instanceof Error ? err.message : 'Unable to seed sample flights.');
    } finally {
      setIsSeedingFlights(false);
    }
  };

  const handleFormatError = (errorMessage: string) => {
    setFormatErrorMessage(errorMessage);
    setAppState('INVALID_FORMAT');
  };

  const handleRefresh = async () => {
    if (!currentQuery) return;
    setIsRefreshing(true);
    try {
      await handleSearch(currentQuery);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleResetSearch = () => {
    setActiveTab('search');
    setAppState('IDLE_SEARCH');
    setFlightData(null);
    setRawAviationstackItem(null);
    setLiveLookupNotice(null);
    setSavedToFirestoreMessage(null);
    setCurrentQuery('');
    setFormatErrorMessage(null);
  };

  const handleSignOut = async () => {
    await signOut();
    setAppState('UNAUTHENTICATED');
    setFlightData(null);
    setRawAviationstackItem(null);
    setLiveLookupNotice(null);
    setSavedToFirestoreMessage(null);
    setIsFlightModalOpen(false);
    setIsUsersModalOpen(false);
    setDeletingFlightDoc(null);
    setCurrentQuery('');
    setFormatErrorMessage(null);
    setActiveTab('search');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (appState === 'RESULT_FOUND' || appState === 'NOT_FOUND' || appState === 'INVALID_FORMAT')) {
        handleResetSearch();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appState]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <Plane className="w-10 h-10 text-blue-500 animate-bounce mb-4" />
        <p className="text-sm font-semibold tracking-wide text-slate-300">
          Connecting to Firebase Auth &amp; Cloud Firestore...
        </p>
      </div>
    );
  }

  if (appState === 'UNAUTHENTICATED' || !user) {
    return <AuthScreen />;
  }

  // Account Blocked Gate
  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Account Access Blocked</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Your signup/access permission for <strong className="text-slate-900">{user.email}</strong> has been blocked by the administrator.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Pending Admin Approval Gate
  if (isPendingApproval) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Awaiting Admin Approval</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Your registration for <strong className="text-slate-900">{user.email}</strong> has been saved in Firestore and is currently waiting for Administrator approval. Access will unlock automatically once approved.
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // Defensive fallback if user profile is transiently unavailable
  if (!userProfile && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 sm:p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto">
            <Plane className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-xl font-extrabold text-slate-900">Syncing User Profile</h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Verifying Cloud Firestore access permissions for <strong className="text-slate-900">{user.email}</strong>...
          </p>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full py-2.5 px-4 text-xs sm:text-sm font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  const userEmail = user.email || 'Authenticated User';
  const displayName =
    userProfile?.fullName ||
    user.displayName ||
    (isAdmin ? 'Sakim' : userEmail.split('@')[0]);
  const userInitials = (displayName || 'U')
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans selection:bg-blue-100 selection:text-blue-900">
      {/* 3-Zone Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand */}
          <button
            type="button"
            onClick={handleResetSearch}
            className="flex items-center gap-2.5 text-left text-slate-900 hover:text-blue-700 transition-colors whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-md p-1"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs group-hover:bg-blue-700 transition-colors">
              <Plane className="w-4 h-4 transform -rotate-45" />
            </div>
            <span className="text-lg font-extrabold tracking-tight">Smart Flight Tracker</span>
          </button>

          {/* Unified Navigation (Same Tabs for Both Admins & Passengers) */}
          <nav className="hidden md:flex items-center gap-5 text-sm font-medium text-slate-600" aria-label="Main Navigation">
            <button
              type="button"
              onClick={handleResetSearch}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${activeTab === 'search' ? 'text-blue-600 font-semibold' : ''}`}
            >
              Search Flights
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('schedule');
                setFlightData(null);
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${activeTab === 'schedule' ? 'text-blue-600 font-semibold' : ''}`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Daily Schedule</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('map');
                setMapFocusPoint(null);
              }}
              className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${activeTab === 'map' ? 'text-blue-600 font-semibold' : ''}`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Live Flight Map</span>
            </button>
          </nav>

          {/* User Profile, Role Pill, Compact Admin Users Modal Trigger & Sign Out */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setIsUsersModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-800 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Manage user accounts & signup permissions"
              >
                <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="hidden lg:inline">Manage Users</span>
                <span className="lg:hidden">Users</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-2 sm:px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-xl min-w-0">
              <div className="w-6 h-6 rounded-md bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              <div className="text-left hidden sm:block min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900 truncate max-w-28 leading-tight" title={displayName}>
                    {displayName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
                      isAdmin
                        ? 'bg-slate-900 text-white'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {isAdmin && <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />}
                    <span>{isAdmin ? 'Admin' : 'User'}</span>
                  </span>
                </div>
                <span className="block text-[11px] text-slate-500 truncate max-w-40 leading-tight" title={userEmail}>
                  {userEmail}
                </span>
              </div>
              {/* Compact role badge on narrow mobile screens (< 640px) */}
              <span
                className={`sm:hidden inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full shrink-0 ${
                  isAdmin ? 'bg-slate-900 text-white' : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isAdmin && <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />}
                <span>{isAdmin ? 'Admin' : 'User'}</span>
              </span>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
              title="Sign out of flight tracker"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">

        <div className="text-center max-w-2xl mx-auto mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight" style={{ textWrap: 'balance' }}>
            Real-Time Flight Status &amp; Route Tracker
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
            Cloud Firestore-backed flight telemetry, daily airport schedules, and role-based operations control.
          </p>
        </div>

        {/* Admin Action Confirmation Feedback */}
        {isAdmin && adminFeedback && (
          <div
            role="status"
            className="max-w-4xl mx-auto mb-5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 flex items-center justify-between gap-2 text-xs sm:text-sm font-semibold animate-fadeIn"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{adminFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setAdminFeedback(null)}
              aria-label="Dismiss notification"
              className="p-1 text-emerald-700 hover:text-emerald-900 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Unified Mode Switcher (No Separate Admin Page) */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <div className="inline-flex flex-wrap items-center justify-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('search')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                activeTab === 'search'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Search by Flight #</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('schedule');
                if (appState !== 'RESULT_FOUND') {
                  setFlightData(null);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                activeTab === 'schedule'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Daily Schedule</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('map');
                setMapFocusPoint(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                activeTab === 'map'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Live Flight Map</span>
            </button>
          </div>
        </div>

        {/* Unified Views */}
        {activeTab === 'map' ? (
          /* View 1: Live Flight Map (OpenSky Network + Leaflet + OpenStreetMap) */
          <LiveFlightMap
            focusPoint={mapFocusPoint}
            onLookupFlight={(code) => {
              void handleSearch(code);
            }}
          />
        ) : activeTab === 'schedule' ? (
          /* View 2: Daily Schedule Explorer (Inline Admin CRUD when isAdmin === true) */
          <div>
            {appState === 'RESULT_FOUND' && flightData ? (
              <div className="max-w-4xl mx-auto space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-2xs">
                  <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-slate-700">
                    <span className="font-bold text-slate-900">Flight Record:</span>
                    <span className="font-mono font-extrabold text-blue-700">{flightData.flightNumber}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 font-medium">{flightData.airline.name}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-semibold text-slate-800">{flightData.origin.iata} → {flightData.destination.iata}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setAppState('IDLE_SEARCH');
                      setFlightData(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors self-start sm:self-auto shrink-0"
                  >
                    <span>← Back to Daily Schedule Board</span>
                  </button>
                </div>

                <FlightDetailsCard
                  flight={flightData}
                  onRefresh={handleRefresh}
                  onNewSearch={() => {
                    setAppState('IDLE_SEARCH');
                    setFlightData(null);
                  }}
                  isRefreshing={isRefreshing}
                  isAdmin={isAdmin}
                  currentStatusOverride={activeFirestoreFlightDoc?.statusOverride}
                  onQuickStatusChange={
                    isAdmin && activeFirestoreFlightDoc
                      ? (nextStatus) => handleQuickStatusChange(activeFirestoreFlightDoc, nextStatus)
                      : undefined
                  }
                  onEditFlight={
                    isAdmin && activeFirestoreFlightDoc
                      ? () => handleOpenEditFlight(activeFirestoreFlightDoc)
                      : undefined
                  }
                  onDeleteFlight={
                    isAdmin && activeFirestoreFlightDoc
                      ? () => setDeletingFlightDoc(activeFirestoreFlightDoc)
                      : undefined
                  }
                />
              </div>
            ) : (
              <DailyScheduleExplorer
                firestoreFlights={firestoreFlights}
                onSelectFlight={handleSelectFlightFromSchedule}
                isAdmin={isAdmin}
                onAddFlight={isAdmin ? handleOpenAddFlight : undefined}
                onSeedFlights={isAdmin ? () => void handleSeedSampleFlights() : undefined}
                isSeedingFlights={isSeedingFlights}
                onQuickStatusChange={isAdmin ? handleQuickStatusChange : undefined}
                onEditFlight={isAdmin ? handleOpenEditFlight : undefined}
                onDeleteFlight={isAdmin ? (doc) => setDeletingFlightDoc(doc) : undefined}
              />
            )}
          </div>
        ) : (
          /* View 3: Unified Search Console (Read-only for Passengers, Inline CRUD for Admins) */
          <div>
            <section className="mb-8 max-w-2xl mx-auto" aria-label="Flight Search Console">
              {/* Inline Admin Toolbar above Search (Zero DOM elements rendered for regular users) */}
              {isAdmin && (
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                  <span className="text-xs font-semibold text-slate-600">
                    Firestore Catalog:{' '}
                    <strong className="font-mono text-slate-900">{firestoreFlights.length}</strong> flights
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleSeedSampleFlights()}
                      disabled={isSeedingFlights}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition-colors disabled:opacity-50"
                    >
                      <Database className="w-3.5 h-3.5 text-amber-700" />
                      <span>{isSeedingFlights ? 'Seeding...' : 'Seed Sample Flights'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenAddFlight}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Flight</span>
                    </button>
                  </div>
                </div>
              )}

              <FlightSearchForm
                onSearch={handleSearch}
                isLoading={appState === 'LOADING'}
                initialValue={currentQuery}
                autoFocus={appState === 'IDLE_SEARCH'}
                onFormatError={handleFormatError}
              />

              {appState === 'INVALID_FORMAT' && formatErrorMessage && (
                <div
                  role="alert"
                  className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2.5 text-xs sm:text-sm animate-fadeIn"
                >
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{formatErrorMessage}</div>
                </div>
              )}

              {liveLookupNotice && (
                <div
                  role="status"
                  className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex items-start gap-2.5 text-xs sm:text-sm animate-fadeIn"
                >
                  <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="flex-1 font-medium leading-relaxed">{liveLookupNotice}</div>
                </div>
              )}

              {flightsLoaded && firestoreFlights.length === 0 && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs sm:text-sm text-center">
                  The Firestore flight catalog is currently empty.{' '}
                  {isAdmin
                    ? 'Use "Seed Sample Flights" or "+ Add Flight" above to populate schedules.'
                    : 'An administrator needs to publish flight schedules.'}
                </div>
              )}
            </section>

            <section className="max-w-4xl mx-auto" aria-live="polite">
              {(appState === 'IDLE_SEARCH' || appState === 'INVALID_FORMAT') && (
                <FlightIdleState onSelectSample={handleSearch} />
              )}

              {appState === 'LOADING' && <FlightSkeletonLoader />}

              {appState === 'RESULT_FOUND' && flightData && (
                <div className="space-y-4">
                  <FlightDetailsCard
                    flight={flightData}
                    onRefresh={handleRefresh}
                    onNewSearch={handleResetSearch}
                    isRefreshing={isRefreshing}
                    isAdmin={isAdmin}
                    currentStatusOverride={activeFirestoreFlightDoc?.statusOverride}
                    onQuickStatusChange={
                      isAdmin && activeFirestoreFlightDoc
                        ? (nextStatus) => handleQuickStatusChange(activeFirestoreFlightDoc, nextStatus)
                        : undefined
                    }
                    onEditFlight={
                      isAdmin && activeFirestoreFlightDoc
                        ? () => handleOpenEditFlight(activeFirestoreFlightDoc)
                        : undefined
                    }
                    onDeleteFlight={
                      isAdmin && activeFirestoreFlightDoc
                        ? () => setDeletingFlightDoc(activeFirestoreFlightDoc)
                        : undefined
                    }
                    canSaveToFirestore={isAdmin && Boolean(rawAviationstackItem)}
                    onSaveToFirestore={handleSaveLiveFlightToFirestore}
                    isSavingToFirestore={isSavingToFirestore}
                    savedToFirestoreMessage={savedToFirestoreMessage}
                    onViewLiveOnMap={
                      flightData.liveTelemetry
                        ? () => {
                            setMapFocusPoint({
                              latitude: flightData.liveTelemetry!.latitude,
                              longitude: flightData.liveTelemetry!.longitude,
                              label: `${flightData.flightNumber} · ${flightData.airline.name}`,
                            });
                            setActiveTab('map');
                          }
                        : undefined
                    }
                  />
                </div>
              )}

              {appState === 'NOT_FOUND' && (
                <FlightNoResult
                  searchedQuery={currentQuery}
                  onTrySample={handleSearch}
                  onNewSearch={handleResetSearch}
                />
              )}
            </section>
          </div>
        )}
      </main>

      {/* Admin-Only Modals (Never rendered in DOM for regular users) */}
      {isAdmin && (
        <>
          <FlightFormModal
            isOpen={isFlightModalOpen}
            editingFlight={editingFlightDoc}
            adminUid={user.uid}
            onClose={() => {
              setIsFlightModalOpen(false);
              setEditingFlightDoc(null);
            }}
            onSaved={(msg) => showAdminFeedback(msg)}
          />

          <UsersPermissionsModal
            isOpen={isUsersModalOpen}
            adminUid={user.uid}
            onClose={() => setIsUsersModalOpen(false)}
          />

          {deletingFlightDoc && (
            <div
              className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-flight-modal-title"
            >
              <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-4 animate-scaleUp">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 id="delete-flight-modal-title" className="text-base font-extrabold text-slate-900">
                      Delete Flight {deletingFlightDoc.flightNumber}?
                    </h2>
                    <p className="mt-1 text-xs sm:text-sm text-slate-600 leading-relaxed">
                      This permanently removes{' '}
                      <strong className="text-slate-900">
                        {deletingFlightDoc.flightNumber} ({deletingFlightDoc.originIata} → {deletingFlightDoc.destinationIata})
                      </strong>{' '}
                      from Cloud Firestore for all users.
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    disabled={isDeletingFlight}
                    onClick={() => setDeletingFlightDoc(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isDeletingFlight}
                    onClick={() => void handleConfirmDeleteFlight()}
                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                  >
                    {isDeletingFlight ? 'Deleting...' : 'Delete Flight'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-700">Smart Flight Tracker</span>
              <span aria-hidden="true">·</span>
              <span>Cloud Firestore Flight Database</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Firebase RBAC Protected</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>{isAdmin ? 'Admin' : 'User'}: {userEmail}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SmartFlightTrackerContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}
