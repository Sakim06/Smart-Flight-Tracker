import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  Plane,
  Search,
  Filter,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  LayoutGrid,
  List,
  Sparkles,
  MapPin,
  ChevronRight,
  ChevronLeft,
  Info,
  Plus,
  Pencil,
  Trash2,
  Database,
} from 'lucide-react';
import {
  FlightRecord,
  FirestoreFlightDoc,
  FlightStatusOverride,
} from '../types/flight';
import {
  generateDailyScheduleFromFlights,
  toIsoDateString,
  getRelativeDate,
} from '../services/flightMockService';

interface DailyScheduleExplorerProps {
  firestoreFlights: FirestoreFlightDoc[];
  onSelectFlight: (flight: FlightRecord) => void;
  isAdmin?: boolean;
  onAddFlight?: () => void;
  onSeedFlights?: () => void;
  isSeedingFlights?: boolean;
  onQuickStatusChange?: (flightDoc: FirestoreFlightDoc, statusOverride: FlightStatusOverride) => Promise<void>;
  onEditFlight?: (flightDoc: FirestoreFlightDoc) => void;
  onDeleteFlight?: (flightDoc: FirestoreFlightDoc) => void;
}

type TimeSlot = 'all' | 'morning' | 'afternoon' | 'evening';
type StatusFilter = 'all' | 'scheduled' | 'active' | 'arrived' | 'delayed' | 'cancelled';
type RouteTypeFilter = 'all' | 'domestic' | 'international';
type ViewMode = 'table' | 'cards';

export const DailyScheduleExplorer: React.FC<DailyScheduleExplorerProps> = ({
  firestoreFlights,
  onSelectFlight,
  isAdmin = false,
  onAddFlight,
  onSeedFlights,
  isSeedingFlights = false,
  onQuickStatusChange,
  onEditFlight,
  onDeleteFlight,
}) => {
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const flightDocMap = useMemo(() => {
    const map = new Map<string, FirestoreFlightDoc>();
    for (const doc of firestoreFlights) {
      map.set(doc.id, doc);
      map.set(doc.normalizedCode, doc);
    }
    return map;
  }, [firestoreFlights]);

  const handleInlineStatusChange = async (
    flightDoc: FirestoreFlightDoc,
    nextStatus: FlightStatusOverride
  ) => {
    if (!onQuickStatusChange) return;
    setUpdatingStatusId(flightDoc.id);
    try {
      await onQuickStatusChange(flightDoc, nextStatus);
    } finally {
      setUpdatingStatusId(null);
    }
  };
  // Calendar date state: starts today
  const todayIso = useMemo(() => toIsoDateString(new Date()), []);
  const [selectedIsoDate, setSelectedIsoDate] = useState<string>(todayIso);

  // Filters
  const [timeSlot, setTimeSlot] = useState<TimeSlot>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [routeTypeFilter, setRouteTypeFilter] = useState<RouteTypeFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('table');

  // Load schedule for selected date from live Firestore flight documents
  const scheduleData = useMemo(() => {
    return generateDailyScheduleFromFlights(firestoreFlights, selectedIsoDate);
  }, [firestoreFlights, selectedIsoDate]);

  // Presets dates
  const presets = useMemo(() => {
    const today = new Date();
    const tomorrow = getRelativeDate(1);
    const dayAfter = getRelativeDate(2);
    return [
      { label: 'Today', iso: toIsoDateString(today), date: today },
      { label: 'Tomorrow', iso: toIsoDateString(tomorrow), date: tomorrow },
      { label: 'Day After Tomorrow', iso: toIsoDateString(dayAfter), date: dayAfter },
    ];
  }, []);

  // Day Stepper navigation: step day by delta (-1 for prev, +1 for next)
  const handleStepDay = (step: number) => {
    const parts = selectedIsoDate.split('-').map(Number);
    const curr = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    curr.setDate(curr.getDate() + step);
    setSelectedIsoDate(toIsoDateString(curr));
  };

  // Filtered flights
  const filteredFlights = useMemo(() => {
    if (scheduleData.isOutOfRange) return [];

    return scheduleData.flights.filter((f) => {
      // 1. Time Slot Filter (based on scheduled departure hour)
      if (timeSlot !== 'all') {
        const depIso = f.scheduledDepartureIso;
        if (depIso) {
          const hour = new Date(depIso).getHours();
          if (timeSlot === 'morning' && !(hour >= 0 && hour < 12)) return false;
          if (timeSlot === 'afternoon' && !(hour >= 12 && hour < 18)) return false;
          if (timeSlot === 'evening' && !(hour >= 18 && hour < 24)) return false;
        }
      }

      // 2. Status Filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'scheduled') {
          if (f.status !== 'SCHEDULED' && f.status !== 'ON_TIME') return false;
          if (f.disruption.isDelayed || f.disruption.isCancelled) return false;
        } else if (statusFilter === 'active') {
          if (f.status !== 'DEPARTED') return false;
        } else if (statusFilter === 'arrived') {
          if (f.status !== 'ARRIVED') return false;
        } else if (statusFilter === 'delayed') {
          if (!f.disruption.isDelayed && f.status !== 'DELAYED') return false;
        } else if (statusFilter === 'cancelled') {
          if (!f.disruption.isCancelled && f.status !== 'CANCELLED') return false;
        }
      }

      // 3. Route Type Filter
      if (routeTypeFilter !== 'all') {
        if (f.routeType !== routeTypeFilter) return false;
      }

      // 4. In-Day Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesFlightNumber = f.flightNumber.toLowerCase().includes(q);
        const matchesAirline = f.airline.name.toLowerCase().includes(q);
        const matchesOriginCity = f.origin.city.toLowerCase().includes(q);
        const matchesOriginIata = f.origin.iata.toLowerCase().includes(q);
        const matchesDestCity = f.destination.city.toLowerCase().includes(q);
        const matchesDestIata = f.destination.iata.toLowerCase().includes(q);

        if (
          !matchesFlightNumber &&
          !matchesAirline &&
          !matchesOriginCity &&
          !matchesOriginIata &&
          !matchesDestCity &&
          !matchesDestIata
        ) {
          return false;
        }
      }

      return true;
    });
  }, [scheduleData, timeSlot, statusFilter, routeTypeFilter, searchQuery]);

  // Compute status counts for the selected date (before status filter)
  const statusCounts = useMemo(() => {
    if (scheduleData.isOutOfRange) return { all: 0, scheduled: 0, active: 0, arrived: 0, delayed: 0, cancelled: 0 };
    const counts = { all: scheduleData.flights.length, scheduled: 0, active: 0, arrived: 0, delayed: 0, cancelled: 0 };
    scheduleData.flights.forEach((f) => {
      if (f.disruption.isCancelled || f.status === 'CANCELLED') {
        counts.cancelled++;
      } else if (f.disruption.isDelayed || f.status === 'DELAYED') {
        counts.delayed++;
      } else if (f.status === 'DEPARTED') {
        counts.active++;
      } else if (f.status === 'ARRIVED') {
        counts.arrived++;
      } else if (f.status === 'SCHEDULED' || f.status === 'ON_TIME') {
        counts.scheduled++;
      }
    });
    return counts;
  }, [scheduleData]);

  // Reset all filters except date
  const handleResetFilters = () => {
    setTimeSlot('all');
    setStatusFilter('all');
    setRouteTypeFilter('all');
    setSearchQuery('');
  };

  // Jump to today
  const handleJumpToToday = () => {
    setSelectedIsoDate(todayIso);
    handleResetFilters();
  };

  return (
    <div className="w-full space-y-6 animate-fadeIn" aria-label="Daily Flight Schedule Explorer">
      {/* 1. Header & Date Selection Console */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <CalendarIcon className="w-5 h-5" />
              </span>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Daily Flight Schedule Board
              </h2>
            </div>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 pl-9">
              Explore all commercial departures and arrivals by calendar date, departure time slot, and operational status.
            </p>
          </div>

          {/* Active Date Tag + Admin Inline Create/Seed Controls */}
          <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold text-slate-800">
                {scheduleData.dateString}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-2xs font-mono text-slate-500 uppercase">
                {scheduleData.dayOffset === 0
                  ? 'Today'
                  : scheduleData.dayOffset === 1
                  ? 'Tomorrow'
                  : scheduleData.dayOffset > 0
                  ? `Day +${scheduleData.dayOffset}`
                  : 'Historical'}
              </span>
            </div>

            {isAdmin && onSeedFlights && (
              <button
                type="button"
                onClick={onSeedFlights}
                disabled={isSeedingFlights}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl transition-colors disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5 text-amber-700" />
                <span>{isSeedingFlights ? 'Seeding...' : 'Seed Sample Flights'}</span>
              </button>
            )}

            {isAdmin && onAddFlight && (
              <button
                type="button"
                onClick={onAddFlight}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Flight</span>
              </button>
            )}
          </div>
        </div>

        {/* Date Selector Row: Quick Presets + Interactive Calendar Picker */}
        <div className="mt-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider mr-1">
              Select Day:
            </span>
            {presets.map((p) => {
              const isSelected = selectedIsoDate === p.iso;
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setSelectedIsoDate(p.iso)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  aria-pressed={isSelected}
                >
                  <span>{p.label}</span>
                  <span className="ml-1.5 opacity-80 font-mono text-2xs">
                    ({p.date.getDate()} {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][p.date.getMonth()]})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Day Stepper + Native HTML5 Calendar Date Picker */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            <label htmlFor="calendar-date-input" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Pick Date:
            </label>
            <div className="inline-flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => handleStepDay(-1)}
                className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Previous day (← 1 day)"
                aria-label="Previous day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <input
                id="calendar-date-input"
                type="date"
                value={selectedIsoDate}
                onChange={(e) => {
                  if (e.target.value) {
                    setSelectedIsoDate(e.target.value);
                  }
                }}
                className="px-2 py-1 text-xs font-medium text-slate-900 bg-transparent border-0 focus:outline-none cursor-pointer"
              />

              <button
                type="button"
                onClick={() => handleStepDay(1)}
                className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Next day (1 day →)"
                aria-label="Next day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {selectedIsoDate !== todayIso && (
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 border border-blue-200/80 rounded-lg transition-colors whitespace-nowrap"
                title="Return to today's schedule"
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Filters Grid: Time Slots + Route Type + Status */}
        <div className="mt-5 pt-5 border-t border-slate-100 space-y-3.5">
          {/* Time Slot Interval Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 w-24">
              Time Slot:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Day (24h)' },
                { id: 'morning', label: 'Morning (00:00 - 12:00)' },
                { id: 'afternoon', label: 'Afternoon (12:00 - 18:00)' },
                { id: 'evening', label: 'Evening / Night (18:00 - 23:59)' },
              ].map((slot) => {
                const isActive = timeSlot === slot.id;
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => setTimeSlot(slot.id as TimeSlot)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-slate-100/90 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {slot.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route Type Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 w-24">
              Route Type:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Routes' },
                { id: 'domestic', label: 'Domestic (Bangladesh)' },
                { id: 'international', label: 'International' },
              ].map((rt) => {
                const isActive = routeTypeFilter === rt.id;
                return (
                  <button
                    key={rt.id}
                    type="button"
                    onClick={() => setRouteTypeFilter(rt.id as RouteTypeFilter)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isActive
                        ? 'bg-slate-800 text-white shadow-2xs'
                        : 'bg-slate-100/90 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {rt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Flight Status Filter Chips */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider shrink-0 w-24">
              Live Status:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: 'all', label: 'All Flights', count: statusCounts.all, dotColor: '' },
                { id: 'scheduled', label: 'On Time / Scheduled', count: statusCounts.scheduled, dotColor: 'bg-blue-500' },
                { id: 'active', label: 'Active / Departed', count: statusCounts.active, dotColor: 'bg-cyan-500' },
                { id: 'arrived', label: 'Arrived / Landed', count: statusCounts.arrived, dotColor: 'bg-emerald-500' },
                { id: 'delayed', label: 'Delayed', count: statusCounts.delayed, dotColor: 'bg-amber-500' },
                { id: 'cancelled', label: 'Cancelled', count: statusCounts.cancelled, dotColor: 'bg-rose-500' },
              ].map((item) => {
                const isActive = statusFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStatusFilter(item.id as StatusFilter)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-slate-100/90 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {item.dotColor && (
                      <span className={`w-2 h-2 rounded-full ${item.dotColor} ${isActive ? 'ring-1 ring-white' : ''}`} />
                    )}
                    <span>{item.label}</span>
                    <span className={`text-2xs font-mono px-1.5 py-0.2 rounded ${
                      isActive ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-600'
                    }`}>
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* 2. In-Day Quick Search & View Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-2xs">
        {/* Search Input within Day */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by city (e.g. Rajshahi, Dubai), code (RJH), or airline..."
            className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              aria-label="Clear filter query"
            >
              ✕
            </button>
          )}
        </div>

        {/* View Switcher & Result Count */}
        <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-slate-500">
          <span>
            Showing <strong className="font-mono text-slate-900">{filteredFlights.length}</strong> of{' '}
            <span className="font-mono">{scheduleData.flights.length}</span> flights
          </span>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Table view"
              aria-label="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'cards' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Card grid view"
              aria-label="Card grid view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Prominent Date Header Banner with Contextual Operational Mode Badge */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xs uppercase tracking-wider font-mono text-blue-400 font-bold bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800/60">
              Active Schedule
            </span>
            <span className="text-xs text-slate-300 font-medium">
              {scheduleData.dayOffset === 0
                ? 'Today'
                : scheduleData.dayOffset === 1
                ? 'Tomorrow'
                : scheduleData.dayOffset === 2
                ? 'Day After Tomorrow'
                : scheduleData.dayOffset === -1
                ? 'Yesterday'
                : scheduleData.dayOffset > 0
                ? `In ${scheduleData.dayOffset} days`
                : `${Math.abs(scheduleData.dayOffset)} days ago`}
            </span>
          </div>
          <h3 className="text-base sm:text-lg lg:text-xl font-bold tracking-tight text-white flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Showing <span className="text-blue-400 font-mono font-extrabold">{filteredFlights.length}</span> Flights for:</span>
            <span className="text-white underline decoration-blue-500/60 underline-offset-4">{scheduleData.fullDateString}</span>
          </h3>
          <p className="text-xs text-slate-400">
            All departure and arrival timestamps are synchronized to {scheduleData.dateString} (Bangladesh Standard Time UTC+6 / Destination Local Time).
          </p>
        </div>

        <div className="self-start md:self-center shrink-0">
          {scheduleData.isToday ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <span className="inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              <span>Today&apos;s Live Radar Telemetry</span>
            </span>
          ) : scheduleData.isPast ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-700/80 text-slate-200 border border-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-300" />
              <span>Historical Archive · Recorded Flight Telemetry</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-500/20 text-blue-200 border border-blue-400/30">
              <CalendarIcon className="w-3.5 h-3.5 text-blue-300" />
              <span>Upcoming Scheduled Timetable</span>
            </span>
          )}
        </div>
      </div>

      {/* 3. Schedule Board Render: Empty / Table / Cards */}
      {filteredFlights.length === 0 ? (
        /* Filter Zero Match Empty State */
        <div className="p-8 sm:p-10 bg-white rounded-2xl border border-slate-200 text-center space-y-4 shadow-sm animate-fadeIn">
          <div className="w-12 h-12 bg-slate-100 text-slate-500 rounded-2xl flex items-center justify-center mx-auto">
            <Search className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base font-bold text-slate-900">
              No flights match your filter criteria for {scheduleData.dateString}
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
              Try adjusting your time slot, status filter, or clearing the search text to see more scheduled departures.
            </p>
          </div>
          <div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 rounded-xl transition-colors"
            >
              Reset Filters
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-2xs uppercase tracking-wider font-bold text-slate-500">
                  <th className="py-3 px-4 sm:px-6">Flight & Carrier</th>
                  <th className="py-3 px-4">Route</th>
                  <th className="py-3 px-4">Scheduled Times</th>
                  <th className="py-3 px-4">Status & Telemetry</th>
                  <th className="py-3 px-4 text-right">{isAdmin ? 'Actions' : 'Details'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                {filteredFlights.map((flight) => {
                  const isDelayed = flight.disruption.isDelayed;
                  const isCancelled = flight.disruption.isCancelled;
                  const flightDoc =
                    (flight.id && flightDocMap.get(flight.id)) ||
                    flightDocMap.get(flight.normalizedCode) ||
                    null;

                  return (
                    <tr
                      key={flight.flightNumber}
                      onClick={() => onSelectFlight(flight)}
                      className="hover:bg-blue-50/50 transition-colors cursor-pointer group focus-within:bg-blue-50/60"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectFlight(flight);
                        }
                      }}
                      role="button"
                      aria-label={`View flight ${flight.flightNumber} from ${flight.origin.iata} to ${flight.destination.iata}`}
                    >
                      {/* Carrier & Flight No. */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                            style={{ backgroundColor: flight.airline.accentColor || '#1E293B' }}
                            aria-hidden="true"
                          >
                            <Plane className="w-4 h-4 transform -rotate-45" />
                          </div>
                          <div>
                            <div className="font-mono font-extrabold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {flight.flightNumber}
                            </div>
                            <div className="text-2xs text-slate-500 truncate max-w-[150px]">
                              {flight.airline.name}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Route */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div>
                            <span className="font-mono font-bold text-slate-900">{flight.origin.iata}</span>
                            <span className="text-2xs text-slate-500 block">{flight.origin.city}</span>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-blue-600 transition-all" />
                          <div>
                            <span className="font-mono font-bold text-slate-900">{flight.destination.iata}</span>
                            <span className="text-2xs text-slate-500 block">{flight.destination.city}</span>
                          </div>
                        </div>
                      </td>

                      {/* Scheduled Times, Estimated Times & Terminal/Gate */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5 font-mono text-xs">
                          <div>
                            <span className="text-2xs uppercase text-slate-400 mr-1.5 font-sans">DEP:</span>
                            <span className="font-semibold text-slate-900">{flight.departure.scheduledTime}</span>
                            {isDelayed && flight.departure.estimatedTime && (
                              <span className="ml-1.5 text-2xs font-semibold text-amber-700 font-sans">
                                (Est: {flight.departure.estimatedTime})
                              </span>
                            )}
                          </div>
                          <div>
                            <span className="text-2xs uppercase text-slate-400 mr-1.5 font-sans">ARR:</span>
                            <span className="text-slate-600">{flight.arrival.scheduledTime}</span>
                            {isDelayed && flight.arrival.estimatedTime && (
                              <span className="ml-1.5 text-2xs font-semibold text-amber-700 font-sans">
                                (Est: {flight.arrival.estimatedTime})
                              </span>
                            )}
                          </div>
                          <div className="text-2xs text-slate-500 font-sans pt-0.5 flex items-center gap-1.5">
                            <span className="font-semibold text-slate-700">{flight.origin.gate}</span>
                            <span className="text-slate-300">·</span>
                            <span className="truncate max-w-[140px]" title={flight.origin.terminal || ''}>{flight.origin.terminal}</span>
                          </div>
                        </div>
                      </td>

                      {/* Status (with inline Admin Quick Status Selector when isAdmin === true) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1.5">
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-50 border border-rose-200 text-rose-800">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cancelled</span>
                            </span>
                          ) : isDelayed ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-900">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Delayed (+{flight.disruption.delayMinutes}m)</span>
                            </div>
                          ) : flight.status === 'ARRIVED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Arrived</span>
                            </span>
                          ) : flight.status === 'DEPARTED' ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-cyan-50 border border-cyan-200 text-cyan-800">
                              <span className="inline-flex rounded-full h-2 w-2 bg-cyan-600"></span>
                              <span>En Route ({flight.progressPercent}%)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 border border-slate-200 text-slate-700">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>Scheduled · On Time</span>
                            </span>
                          )}

                          {isAdmin && flightDoc && onQuickStatusChange && (
                            <select
                              aria-label={`Quick status for ${flight.flightNumber}`}
                              value={flightDoc.statusOverride || 'AUTO'}
                              disabled={updatingStatusId === flightDoc.id}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                e.stopPropagation();
                                void handleInlineStatusChange(
                                  flightDoc,
                                  e.target.value as FlightStatusOverride
                                );
                              }}
                              className="px-2 py-1 text-2xs font-semibold bg-white border border-slate-300 hover:border-blue-500 rounded-md text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {isAdmin && flightDoc && onEditFlight && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditFlight(flightDoc);
                              }}
                              title={`Edit ${flight.flightNumber}`}
                              aria-label={`Edit flight ${flight.flightNumber}`}
                              className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {isAdmin && flightDoc && onDeleteFlight && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFlight(flightDoc);
                              }}
                              title={`Delete ${flight.flightNumber}`}
                              aria-label={`Delete flight ${flight.flightNumber}`}
                              className="p-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:text-blue-800 pl-1">
                            <span>Track</span>
                            <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Card Grid View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
          {filteredFlights.map((flight) => {
            const isDelayed = flight.disruption.isDelayed;
            const isCancelled = flight.disruption.isCancelled;
            const flightDoc =
              (flight.id && flightDocMap.get(flight.id)) ||
              flightDocMap.get(flight.normalizedCode) ||
              null;

            return (
              <div
                key={flight.flightNumber}
                role="button"
                tabIndex={0}
                onClick={() => onSelectFlight(flight)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectFlight(flight);
                  }
                }}
                className="group p-4 bg-white hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-2xl text-left transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Flight Number, Airline, Category Tag */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-xs shrink-0 shadow-2xs"
                        style={{ backgroundColor: flight.airline.accentColor || '#1E293B' }}
                        aria-hidden="true"
                      >
                        <Plane className="w-4 h-4 transform -rotate-45" />
                      </div>
                      <div>
                        <div className="font-mono font-extrabold text-slate-900 text-base leading-none">
                          {flight.flightNumber}
                        </div>
                        <div className="text-2xs text-slate-500 truncate max-w-[140px] mt-0.5">
                          {flight.airline.name}
                        </div>
                      </div>
                    </div>

                    <span className={`text-2xs font-semibold px-2 py-0.5 rounded ${
                      flight.routeType === 'domestic'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                        : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                    }`}>
                      {flight.routeType === 'domestic' ? 'Domestic' : 'International'}
                    </span>
                  </div>

                  {/* Route Display */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono font-extrabold text-slate-900 text-base">{flight.origin.iata}</span>
                      <span className="text-2xs text-slate-500 block truncate max-w-[80px]">{flight.origin.city}</span>
                    </div>

                    <div className="flex flex-col items-center px-2">
                      <span className="text-2xs font-mono text-slate-400">{flight.flightDuration}</span>
                      <div className="flex items-center gap-1 text-slate-300 w-16 my-0.5">
                        <div className="h-0.5 bg-slate-200 flex-1"></div>
                        <Plane className="w-3 h-3 text-slate-400 rotate-90 shrink-0" />
                        <div className="h-0.5 bg-slate-200 flex-1"></div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-extrabold text-slate-900 text-base">{flight.destination.iata}</span>
                      <span className="text-2xs text-slate-500 block truncate max-w-[80px]">{flight.destination.city}</span>
                    </div>
                  </div>

                  {/* Timing Breakdown & Gates */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono mb-3">
                    <div className="bg-slate-50/70 p-2 rounded-lg">
                      <div className="flex items-center justify-between text-2xs uppercase text-slate-400 font-sans">
                        <span>Scheduled Dep</span>
                        <span className="text-slate-700 font-semibold">{flight.origin.gate}</span>
                      </div>
                      <span className="font-bold text-slate-900 block mt-0.5">{flight.departure.scheduledTime}</span>
                      {isDelayed && flight.departure.estimatedTime ? (
                        <span className="text-2xs text-amber-700 font-semibold block mt-0.5">
                          Est: {flight.departure.estimatedTime}
                        </span>
                      ) : (
                        <span className="text-2xs text-slate-400 font-sans block mt-0.5 truncate" title={flight.origin.terminal || ''}>
                          {flight.origin.terminal}
                        </span>
                      )}
                    </div>
                    <div className="bg-slate-50/70 p-2 rounded-lg">
                      <div className="flex items-center justify-between text-2xs uppercase text-slate-400 font-sans">
                        <span>Scheduled Arr</span>
                        <span className="text-slate-700 font-semibold">{flight.destination.gate}</span>
                      </div>
                      <span className="font-bold text-slate-900 block mt-0.5">{flight.arrival.scheduledTime}</span>
                      {isDelayed && flight.arrival.estimatedTime ? (
                        <span className="text-2xs text-amber-700 font-semibold block mt-0.5">
                          Est: {flight.arrival.estimatedTime}
                        </span>
                      ) : (
                        <span className="text-2xs text-slate-400 font-sans block mt-0.5 truncate" title={flight.destination.terminal || ''}>
                          {flight.destination.terminal}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Admin Controls Strip (Zero DOM output for regular users) */}
                {isAdmin && flightDoc && (
                  <div
                    className="mb-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onQuickStatusChange && (
                      <select
                        aria-label={`Quick status for ${flight.flightNumber}`}
                        value={flightDoc.statusOverride || 'AUTO'}
                        disabled={updatingStatusId === flightDoc.id}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          e.stopPropagation();
                          void handleInlineStatusChange(
                            flightDoc,
                            e.target.value as FlightStatusOverride
                          );
                        }}
                        className="flex-1 px-2 py-1 text-2xs font-semibold bg-slate-50 border border-slate-300 hover:border-blue-500 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                      >
                        <option value="AUTO">Status: Auto</option>
                        <option value="SCHEDULED">Scheduled</option>
                        <option value="ON_TIME">On Time</option>
                        <option value="DEPARTED">Departed</option>
                        <option value="DELAYED">Delayed</option>
                        <option value="ARRIVED">Arrived</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    )}

                    <div className="inline-flex items-center gap-1 shrink-0">
                      {onEditFlight && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditFlight(flightDoc);
                          }}
                          title={`Edit ${flight.flightNumber}`}
                          aria-label={`Edit flight ${flight.flightNumber}`}
                          className="p-1.5 text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {onDeleteFlight && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteFlight(flightDoc);
                          }}
                          title={`Delete ${flight.flightNumber}`}
                          aria-label={`Delete flight ${flight.flightNumber}`}
                          className="p-1.5 text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer: Live Status & Track Action */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  {isCancelled ? (
                    <span className="text-2xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                      Cancelled
                    </span>
                  ) : isDelayed ? (
                    <span className="text-2xs font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-300">
                      Delayed (+{flight.disruption.delayMinutes}m)
                    </span>
                  ) : flight.status === 'ARRIVED' ? (
                    <span className="text-2xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      Arrived
                    </span>
                  ) : flight.status === 'DEPARTED' ? (
                    <span className="text-2xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-600 animate-pulse"></span>
                      <span>En Route ({flight.progressPercent}%)</span>
                    </span>
                  ) : (
                    <span className="text-2xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      Scheduled
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform">
                    <span>View Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
