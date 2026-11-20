import React, { useState, useEffect } from 'react';
import {
  Plane,
  Clock,
  MapPin,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Compass,
  Gauge,
  Briefcase,
  Share2,
  Info,
  ShieldAlert,
  Database,
  Radio,
  Map as MapIcon,
  Pencil,
  Trash2,
} from 'lucide-react';
import { FlightRecord, FlightStatus, FlightStatusOverride } from '../types/flight';

interface FlightDetailsCardProps {
  flight: FlightRecord;
  onRefresh: () => void;
  onNewSearch: () => void;
  isRefreshing: boolean;
  isAdmin?: boolean;
  currentStatusOverride?: FlightStatusOverride;
  onQuickStatusChange?: (statusOverride: FlightStatusOverride) => Promise<void>;
  onEditFlight?: () => void;
  onDeleteFlight?: () => void;
  canSaveToFirestore?: boolean;
  onSaveToFirestore?: () => void;
  isSavingToFirestore?: boolean;
  savedToFirestoreMessage?: string | null;
  onViewLiveOnMap?: () => void;
}

/**
 * Data Integrity helper: explicitly renders "Not available" for missing or null values
 */
export const DataField: React.FC<{ value: string | number | null | undefined; suffix?: string; isMono?: boolean }> = ({
  value,
  suffix = '',
  isMono = false,
}) => {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-400 italic text-xs font-normal">Not available</span>;
  }
  return (
    <span className={isMono ? 'font-mono tabular-nums text-slate-900' : 'text-slate-900'}>
      {value}
      {suffix}
    </span>
  );
};

export const FlightDetailsCard: React.FC<FlightDetailsCardProps> = ({
  flight,
  onRefresh,
  onNewSearch,
  isRefreshing,
  isAdmin = false,
  currentStatusOverride,
  onQuickStatusChange,
  onEditFlight,
  onDeleteFlight,
  canSaveToFirestore = false,
  onSaveToFirestore,
  isSavingToFirestore = false,
  savedToFirestoreMessage = null,
  onViewLiveOnMap,
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(flight.dayOffset ?? 0);
  const [copied, setCopied] = useState(false);
  const [relativeTime, setRelativeTime] = useState<string>('Just now');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Sync selected day offset when new flight prop arrives
  useEffect(() => {
    setSelectedDayOffset(flight.dayOffset ?? 0);
  }, [flight.normalizedCode, flight.dayOffset]);

  // Active record based on selected day (0 = Today, 1 = Tomorrow, 2 = Day After Tomorrow)
  const currentRecord = flight.multiDaySchedules?.[selectedDayOffset] || flight;

  // Update relative time display every 15 seconds
  useEffect(() => {
    const updateRelative = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - currentRecord.lastUpdated) / 1000));
      if (diffSec < 15) {
        setRelativeTime('Just now');
      } else if (diffSec < 60) {
        setRelativeTime(`${diffSec} seconds ago`);
      } else {
        const mins = Math.floor(diffSec / 60);
        setRelativeTime(`${mins} ${mins === 1 ? 'min' : 'mins'} ago`);
      }
    };

    updateRelative();
    const interval = setInterval(updateRelative, 10000);
    return () => clearInterval(interval);
  }, [currentRecord.lastUpdated]);

  const handleShare = async () => {
    const textToCopy = `Flight Status: ${currentRecord.flightNumber} (${currentRecord.airline.name}) from ${currentRecord.origin.iata} to ${currentRecord.destination.iata} on ${currentRecord.departure.date} - Status: ${currentRecord.statusLabel}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {
      // Fallback
    }
  };

  const getStatusBadgeConfig = (status: FlightStatus, isDelayed: boolean, isCancelled: boolean) => {
    if (isCancelled) {
      return {
        bg: 'bg-rose-50 border-rose-200 text-rose-800',
        dot: 'bg-rose-600',
        icon: ShieldAlert,
        label: 'Cancelled',
      };
    }
    if (isDelayed) {
      return {
        bg: 'bg-amber-50 border-amber-300 text-amber-900',
        dot: 'bg-amber-600',
        icon: AlertTriangle,
        label: `Delayed (+${currentRecord.disruption.delayMinutes}m)`,
      };
    }
    switch (status) {
      case 'ARRIVED':
        return {
          bg: 'bg-teal-50 border-teal-200 text-teal-800',
          dot: 'bg-teal-600',
          icon: CheckCircle2,
          label: 'Landed · Arrived',
        };
      case 'DEPARTED':
      case 'ON_TIME':
        return {
          bg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
          dot: 'bg-emerald-600',
          icon: Plane,
          label: 'En Route · On Time',
        };
      case 'SCHEDULED':
      default:
        return {
          bg: 'bg-blue-50 border-blue-200 text-blue-800',
          dot: 'bg-blue-600',
          icon: Clock,
          label: 'Scheduled · On Time',
        };
    }
  };

  const statusConfig = getStatusBadgeConfig(
    currentRecord.status,
    currentRecord.disruption.isDelayed,
    currentRecord.disruption.isCancelled
  );
  const StatusIcon = statusConfig.icon;

  return (
    <article className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" aria-labelledby="flight-header-title">
      {/* 1. Header Bar: Flight Number, Airline, and Status Badge */}
      <header className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-sm shrink-0"
              style={{ backgroundColor: currentRecord.airline.accentColor || '#1E293B' }}
              aria-hidden="true"
            >
              <Plane className="w-6 h-6 transform -rotate-45" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 id="flight-header-title" className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 font-mono">
                  {currentRecord.flightNumber}
                </h2>
                <span className="text-slate-400 font-normal">/</span>
                <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-slate-600">
                  {currentRecord.airline.name}
                </span>
                <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                  currentRecord.routeType === 'domestic'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-800'
                }`}>
                  {currentRecord.routeType === 'domestic' ? 'Bangladesh Domestic' : 'International'}
                </span>
                {currentRecord.dataSource === 'aviationstack' ? (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <Radio className="w-3 h-3" />
                    Live · Aviationstack
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-2xs font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                    <Database className="w-3 h-3" />
                    Firestore Schedule
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                <span>Callsign: <span className="font-mono text-slate-700">{currentRecord.airline.callsign}</span></span>
                <span aria-hidden="true">·</span>
                <span>IATA: <span className="font-mono text-slate-700">{currentRecord.airline.iata}</span></span>
                <span aria-hidden="true">·</span>
                <span>ICAO: <span className="font-mono text-slate-700">{currentRecord.airline.icao}</span></span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {/* Accessible Status Badge */}
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-semibold tracking-wide ${statusConfig.bg}`}
              role="status"
              aria-live="polite"
            >
              <StatusIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{statusConfig.label}</span>
            </div>

            {/* Inline Admin Quick Status, Edit, and Delete Controls (Zero DOM for Regular Users) */}
            {isAdmin && onQuickStatusChange && (
              <select
                aria-label={`Quick status for ${currentRecord.flightNumber}`}
                value={currentStatusOverride || currentRecord.statusOverride || 'AUTO'}
                disabled={isUpdatingStatus}
                onChange={async (e) => {
                  setIsUpdatingStatus(true);
                  try {
                    await onQuickStatusChange(e.target.value as FlightStatusOverride);
                  } finally {
                    setIsUpdatingStatus(false);
                  }
                }}
                className="px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 hover:border-blue-500 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-50"
              >
                <option value="AUTO">Auto</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ON_TIME">On Time</option>
                <option value="DEPARTED">Departed</option>
                <option value="DELAYED">Delayed</option>
                <option value="ARRIVED">Arrived</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            )}

            {isAdmin && onEditFlight && (
              <button
                type="button"
                onClick={onEditFlight}
                className="p-2 text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Edit flight details"
                aria-label="Edit flight details"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}

            {isAdmin && onDeleteFlight && (
              <button
                type="button"
                onClick={onDeleteFlight}
                className="p-2 text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                title="Delete flight from Firestore"
                aria-label="Delete flight"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Quick Actions */}
            <button
              type="button"
              onClick={handleShare}
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg border border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              title="Copy flight summary to clipboard"
              aria-label="Copy flight summary"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onNewSearch}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg shadow-2xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 whitespace-nowrap"
            >
              New Search
            </button>
          </div>
        </div>

        {/* Delay / Disruption Banner */}
        {currentRecord.disruption.isCancelled && (
          <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Cancellation Alert: </span>
              <span>{currentRecord.disruption.reason || 'This flight has been cancelled by the operating carrier.'}</span>
              <p className="mt-1 text-xs text-rose-700 font-medium">
                Passengers are advised to contact {currentRecord.airline.name} customer support or their booking agent for rebooking options.
              </p>
            </div>
          </div>
        )}

        {currentRecord.disruption.isDelayed && !currentRecord.disruption.isCancelled && (
          <div className="mt-4 p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-xs sm:text-sm">
              <span className="font-bold">Flight Delay Notification (+{currentRecord.disruption.delayMinutes} mins): </span>
              <span>{currentRecord.disruption.reason || 'Delayed operational turnaround.'}</span>
              <p className="mt-0.5 text-xs text-amber-800">
                Departure and estimated arrival times below have been adjusted to reflect updated air traffic slots.
              </p>
            </div>
          </div>
        )}

        {copied && (
          <div className="mt-2 text-xs font-medium text-emerald-700 animate-fadeIn" role="status">
            Flight summary copied to clipboard!
          </div>
        )}
      </header>

      {/* Multi-Day Schedule Date Switcher */}
      {flight.multiDaySchedules && (
        <div className="px-4 py-3 sm:px-6 bg-slate-100/90 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span>Multi-Day Schedule Selection:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-2xs">
            {(() => {
              const base = [0, 1, 2];
              const offsets = (flight.dayOffset !== undefined && !base.includes(flight.dayOffset))
                ? [flight.dayOffset, ...base].sort((a, b) => a - b)
                : base;

              return offsets.map((offset) => {
                const dayRec = flight.multiDaySchedules?.[offset];
                if (!dayRec) return null;
                const isSelected = selectedDayOffset === offset;
                const label = offset === 0
                  ? 'Today'
                  : offset === 1
                  ? 'Tomorrow'
                  : offset === 2
                  ? 'Day After'
                  : offset === -1
                  ? 'Yesterday'
                  : offset > 0
                  ? `Day +${offset}`
                  : `Day ${offset}`;

                return (
                  <button
                    key={offset}
                    type="button"
                    onClick={() => setSelectedDayOffset(offset)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <span>{label}</span>
                    <span className="text-2xs font-mono opacity-85">
                      ({dayRec.departure.date.split(',')[1]?.trim() || dayRec.departure.date})
                    </span>
                  </button>
                );
              });
            })()}
          </div>
        </div>
      )}
      <section className="p-4 sm:p-6 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Origin Airport */}
          <div className="md:col-span-4 text-left">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900">
                {currentRecord.origin.iata}
              </span>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                {currentRecord.origin.icao}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {currentRecord.origin.city}, {currentRecord.origin.country}
            </p>
            <p className="text-xs text-slate-500 line-clamp-1" title={currentRecord.origin.name}>
              {currentRecord.origin.name}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
              <span>Terminal: <DataField value={currentRecord.origin.terminal} /></span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Gate: <DataField value={currentRecord.origin.gate} /></span>
            </div>
          </div>

          {/* Visual Route Connector / Progress Bar */}
          <div className="md:col-span-4 flex flex-col items-center justify-center px-2 py-3">
            <div className="w-full text-center mb-1.5 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Duration: <span className="font-mono font-semibold text-slate-800">{currentRecord.flightDuration}</span></span>
              <span>{currentRecord.status === 'ARRIVED' ? 'Completed' : currentRecord.status === 'CANCELLED' ? 'Suspended' : `${currentRecord.progressPercent}% along route`}</span>
            </div>

            {/* Graphic Bar */}
            <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-visible border border-slate-200">
              {/* Completed track */}
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  currentRecord.disruption.isCancelled
                    ? 'bg-rose-300'
                    : currentRecord.disruption.isDelayed
                    ? 'bg-amber-500'
                    : 'bg-blue-600'
                }`}
                style={{ width: `${Math.min(100, Math.max(4, currentRecord.progressPercent))}%` }}
              />

              {/* Dynamic Plane Icon on Track */}
              <div
                className="absolute top-1/2 transform -translate-y-1/2 -translate-x-1/2 transition-all duration-700 z-10"
                style={{ left: `${Math.min(95, Math.max(5, currentRecord.progressPercent))}%` }}
              >
                <div className={`p-1.5 rounded-full shadow-md text-white border-2 border-white ${
                  currentRecord.disruption.isCancelled ? 'bg-rose-600' : 'bg-slate-900'
                }`}>
                  <Plane className="w-3.5 h-3.5 transform rotate-45" />
                </div>
              </div>
            </div>

            {/* Elapsed / Remaining Times */}
            <div className="w-full flex items-center justify-between mt-2.5 text-xs text-slate-500">
              <div>
                Elapsed: <DataField value={currentRecord.elapsedDuration} isMono />
              </div>
              <div className="text-right">
                Remaining: <DataField value={currentRecord.remainingDuration} isMono />
              </div>
            </div>
          </div>

          {/* Destination Airport */}
          <div className="md:col-span-4 text-left md:text-right">
            <div className="flex items-baseline gap-2 md:justify-end">
              <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-900">
                {currentRecord.destination.iata}
              </span>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                {currentRecord.destination.icao}
              </span>
            </div>
            <p className="mt-1 text-sm font-bold text-slate-900">
              {currentRecord.destination.city}, {currentRecord.destination.country}
            </p>
            <p className="text-xs text-slate-500 line-clamp-1" title={currentRecord.destination.name}>
              {currentRecord.destination.name}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 md:justify-end">
              <span>Terminal: <DataField value={currentRecord.destination.terminal} /></span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span>Gate: <DataField value={currentRecord.destination.gate} /></span>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Timing Grid: Side-by-Side Departure & Arrival Times (Scheduled vs Estimated/Actual) */}
      <section className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/40">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Flight Timing & Schedule Breakdown</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {/* Departure Card */}
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departure (Origin)</span>
              <span className="text-xs font-mono font-medium text-slate-500">{currentRecord.departure.timezone}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentRecord.departure.date}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Scheduled Time</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-slate-900">
                  {currentRecord.departure.scheduledTime}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">
                  {currentRecord.departure.actualTime ? 'Actual Departure' : 'Estimated Time'}
                </span>
                <span className={`text-lg sm:text-xl font-bold font-mono ${
                  currentRecord.disruption.isDelayed ? 'text-amber-700' : 'text-slate-900'
                }`}>
                  <DataField value={currentRecord.departure.actualTime || currentRecord.departure.estimatedTime} isMono />
                </span>
              </div>
            </div>

            {/* ISO Timestamp schema details */}
            <div className="mt-3 pt-2 text-2xs font-mono text-slate-400 truncate" title={currentRecord.scheduledDepartureIso}>
              ISO: {currentRecord.scheduledDepartureIso}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Gate Closure:</span>
              <span className="font-mono font-medium text-slate-700">
                <DataField value={currentRecord.departure.gateCloseTime} />
              </span>
            </div>
          </div>

          {/* Arrival Card */}
          <div className="p-4 bg-white rounded-xl border border-slate-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Arrival (Destination)</span>
              <span className="text-xs font-mono font-medium text-slate-500">{currentRecord.arrival.timezone}</span>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentRecord.arrival.date}</span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <span className="text-xs text-slate-400 block font-medium">Scheduled Time</span>
                <span className="text-lg sm:text-xl font-bold font-mono text-slate-900">
                  {currentRecord.arrival.scheduledTime}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">
                  {currentRecord.arrival.actualTime ? 'Actual Touchdown' : 'Estimated Time'}
                </span>
                <span className={`text-lg sm:text-xl font-bold font-mono ${
                  currentRecord.disruption.isDelayed ? 'text-amber-700' : 'text-slate-900'
                }`}>
                  <DataField value={currentRecord.arrival.actualTime || currentRecord.arrival.estimatedTime} isMono />
                </span>
              </div>
            </div>

            {/* ISO Timestamp schema details */}
            <div className="mt-3 pt-2 text-2xs font-mono text-slate-400 truncate" title={currentRecord.scheduledArrivalIso}>
              ISO: {currentRecord.scheduledArrivalIso}
            </div>

            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Baggage Carousel:</span>
              <span className="font-mono font-bold text-slate-800 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <DataField value={currentRecord.destination.baggageClaim} />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Flight Telemetry & Aircraft Specifications (strictly applying Data Integrity Rule: "Not available" for missing fields) */}
      <section className="p-4 sm:p-6 border-b border-slate-200">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-1.5">
          <Plane className="w-3.5 h-3.5 text-slate-400" />
          <span>Aircraft Specifications & Flight Telemetry</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium">Aircraft Model</span>
            <span className="text-sm font-semibold text-slate-900 block mt-0.5 truncate">
              <DataField value={currentRecord.aircraft.model} />
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium">Tail Registration</span>
            <span className="text-sm font-mono font-semibold text-slate-900 block mt-0.5">
              <DataField value={currentRecord.aircraft.registration} isMono />
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium flex items-center gap-1">
              <Compass className="w-3 h-3 text-slate-400" />
              <span>Cruising Altitude</span>
            </span>
            <span className="text-sm font-mono font-semibold text-slate-900 block mt-0.5">
              {currentRecord.aircraft.cruisingAltitudeFt ? (
                <span>{currentRecord.aircraft.cruisingAltitudeFt.toLocaleString()} ft</span>
              ) : (
                <DataField value={null} />
              )}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-500 block font-medium flex items-center gap-1">
              <Gauge className="w-3 h-3 text-slate-400" />
              <span>Ground Speed</span>
            </span>
            <span className="text-sm font-mono font-semibold text-slate-900 block mt-0.5">
              {currentRecord.aircraft.groundSpeedKnots ? (
                <span>{currentRecord.aircraft.groundSpeedKnots} kts</span>
              ) : (
                <DataField value={null} />
              )}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2 sm:col-span-1">
            <span className="text-xs text-slate-500 block font-medium">Total Air Distance</span>
            <span className="text-sm font-mono font-semibold text-slate-900 block mt-0.5">
              {currentRecord.aircraft.totalDistanceKm ? (
                <span>{currentRecord.aircraft.totalDistanceKm.toLocaleString()} km</span>
              ) : (
                <DataField value={null} />
              )}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 col-span-2 sm:col-span-2 lg:col-span-3">
            <span className="text-xs text-slate-500 block font-medium flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span>Current Position / Radar Fix</span>
            </span>
            <span className="text-sm font-medium text-slate-800 block mt-0.5 truncate">
              <DataField value={currentRecord.aircraft.currentLocationDesc} />
            </span>
          </div>
        </div>
      </section>

      {/* 5. Footer: Data Freshness Timestamp, Live Actions, and Refresh Action */}
      <footer className="p-4 sm:p-5 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
            title="Refresh latest telemetry data"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500'}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>

          {currentRecord.liveTelemetry && onViewLiveOnMap && (
            <button
              type="button"
              onClick={onViewLiveOnMap}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Locate on Live Map</span>
            </button>
          )}

          {canSaveToFirestore && onSaveToFirestore && (
            <button
              type="button"
              onClick={onSaveToFirestore}
              disabled={isSavingToFirestore}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isSavingToFirestore ? 'Saving...' : 'Save Schedule to Firestore'}</span>
            </button>
          )}

          <span className="text-xs text-slate-500">
            Data updated: <span className="font-medium text-slate-700">{relativeTime}</span>
          </span>

          {savedToFirestoreMessage && (
            <span className="text-xs font-semibold text-emerald-700">
              {savedToFirestoreMessage}
            </span>
          )}
        </div>

        <div className="text-xs text-slate-400 font-mono hidden sm:block">
          {currentRecord.dataSource === 'aviationstack' ? 'Aviationstack Live API' : 'Cloud Firestore Catalog'}
        </div>
      </footer>
    </article>
  );
};
