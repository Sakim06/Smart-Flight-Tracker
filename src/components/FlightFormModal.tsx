import React, { useState, useEffect } from 'react';
import { X, Plane, AlertCircle, Save } from 'lucide-react';
import {
  FirestoreFlightDoc,
  FlightFormPayload,
  FlightStatusOverride,
} from '../types/flight';
import { createFlight, updateFlight } from '../services/firestoreService';

interface FlightFormModalProps {
  isOpen: boolean;
  editingFlight: FirestoreFlightDoc | null;
  adminUid: string;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const DEFAULT_FORM: FlightFormPayload = {
  flightNumber: '',
  airlineName: '',
  airlineIata: '',
  airlineIcao: '',
  airlineCallsign: '',
  airlineAccentColor: '#1E40AF',
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
  durationMinutes: 90,
  routeType: 'international',
  distanceKm: 1200,
  statusOverride: 'AUTO',
  delayMinutes: 0,
  disruptionReason: '',
};

function toTimeInputValue(hour: number, minute: number): string {
  const h = String(Math.min(23, Math.max(0, hour))).padStart(2, '0');
  const m = String(Math.min(59, Math.max(0, minute))).padStart(2, '0');
  return `${h}:${m}`;
}

function formatComputedClockTime(totalMinutesFromMidnight: number): string {
  const wrapped = ((totalMinutesFromMidnight % 1440) + 1440) % 1440;
  const h24 = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const dayOverflow = Math.floor(totalMinutesFromMidnight / 1440);
  return `${h12}:${String(mins).padStart(2, '0')} ${period}${dayOverflow > 0 ? ` (+${dayOverflow}d)` : ''}`;
}

export const FlightFormModal: React.FC<FlightFormModalProps> = ({
  isOpen,
  editingFlight,
  adminUid,
  onClose,
  onSaved,
}) => {
  const [form, setForm] = useState<FlightFormPayload>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (editingFlight) {
      setForm({
        flightNumber: editingFlight.flightNumber,
        airlineName: editingFlight.airlineName,
        airlineIata: editingFlight.airlineIata,
        airlineIcao: editingFlight.airlineIcao,
        airlineCallsign: editingFlight.airlineCallsign,
        airlineAccentColor: editingFlight.airlineAccentColor || '#1E40AF',
        originIata: editingFlight.originIata,
        originIcao: editingFlight.originIcao,
        originName: editingFlight.originName,
        originCity: editingFlight.originCity,
        originCountry: editingFlight.originCountry,
        originTerminal: editingFlight.originTerminal,
        originGate: editingFlight.originGate,
        destinationIata: editingFlight.destinationIata,
        destinationIcao: editingFlight.destinationIcao,
        destinationName: editingFlight.destinationName,
        destinationCity: editingFlight.destinationCity,
        destinationCountry: editingFlight.destinationCountry,
        destinationTerminal: editingFlight.destinationTerminal,
        destinationGate: editingFlight.destinationGate,
        aircraftModel: editingFlight.aircraftModel,
        registration: editingFlight.registration,
        departureHour: editingFlight.departureHour,
        departureMinute: editingFlight.departureMinute,
        durationMinutes: editingFlight.durationMinutes,
        routeType: editingFlight.routeType,
        distanceKm: editingFlight.distanceKm,
        statusOverride: editingFlight.statusOverride || 'AUTO',
        delayMinutes: editingFlight.delayMinutes || 0,
        disruptionReason: editingFlight.disruptionReason || '',
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [isOpen, editingFlight]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, isSaving, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.flightNumber.trim() || !form.airlineName.trim()) {
      setError('Flight Number and Airline Name are required.');
      return;
    }
    if (!form.originIata.trim() || !form.destinationIata.trim()) {
      setError('Origin and Destination IATA airport codes are required.');
      return;
    }

    setIsSaving(true);
    try {
      const prepared: FlightFormPayload = {
        ...form,
        airlineIata:
          form.airlineIata.trim().toUpperCase() ||
          form.flightNumber.trim().replace(/\s+/g, '').slice(0, 2).toUpperCase(),
        airlineIcao: form.airlineIcao.trim().toUpperCase() || 'XXX',
        originIcao: form.originIcao.trim().toUpperCase() || form.originIata.trim().toUpperCase(),
        originName: form.originName.trim() || `${form.originCity.trim() || form.originIata.toUpperCase()} Airport`,
        originCity: form.originCity.trim() || form.originIata.toUpperCase(),
        originCountry: form.originCountry.trim() || 'International',
        destinationIcao:
          form.destinationIcao.trim().toUpperCase() || form.destinationIata.trim().toUpperCase(),
        destinationName:
          form.destinationName.trim() ||
          `${form.destinationCity.trim() || form.destinationIata.toUpperCase()} Airport`,
        destinationCity: form.destinationCity.trim() || form.destinationIata.toUpperCase(),
        destinationCountry: form.destinationCountry.trim() || 'International',
      };

      if (editingFlight) {
        await updateFlight(editingFlight.id, prepared);
        onSaved(`Updated flight ${prepared.flightNumber.toUpperCase()} in Cloud Firestore.`);
      } else {
        await createFlight(prepared, adminUid);
        onSaved(`Created flight ${prepared.flightNumber.toUpperCase()} in Cloud Firestore.`);
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save flight record.';
      setError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="flight-form-modal-title"
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Plane className="w-4 h-4 transform -rotate-45" />
            </div>
            <div>
              <h2 id="flight-form-modal-title" className="text-base font-extrabold tracking-tight">
                {editingFlight ? `Edit Flight ${editingFlight.flightNumber}` : 'Add New Flight Schedule'}
              </h2>
              <p className="text-2xs text-slate-300">
                Changes sync immediately to Cloud Firestore for all connected users.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto">
          <div className="p-5 space-y-5">
            {error && (
              <div
                role="alert"
                className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-start gap-2 text-xs font-medium"
              >
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Section 1: Identity & Airline */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Flight &amp; Carrier Details
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Flight Number *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingFlight) || isSaving}
                    value={form.flightNumber}
                    onChange={(e) => setForm({ ...form, flightNumber: e.target.value.toUpperCase() })}
                    placeholder="e.g. EK 585"
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none disabled:opacity-60"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Airline Name *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={isSaving}
                    value={form.airlineName}
                    onChange={(e) => setForm({ ...form, airlineName: e.target.value })}
                    placeholder="e.g. Emirates"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Airline IATA
                  </label>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={form.airlineIata}
                    onChange={(e) => setForm({ ...form, airlineIata: e.target.value.toUpperCase() })}
                    placeholder="EK"
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Route Type
                  </label>
                  <select
                    disabled={isSaving}
                    value={form.routeType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        routeType: e.target.value === 'domestic' ? 'domestic' : 'international',
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="international">International</option>
                    <option value="domestic">Bangladesh Domestic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Aircraft Model
                  </label>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={form.aircraftModel}
                    onChange={(e) => setForm({ ...form, aircraftModel: e.target.value })}
                    placeholder="Boeing 777-300ER"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Origin & Destination */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Origin (Departure)
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      IATA Code *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={form.originIata}
                      onChange={(e) => setForm({ ...form, originIata: e.target.value.toUpperCase() })}
                      placeholder="DAC"
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={form.originCity}
                      onChange={(e) => setForm({ ...form, originCity: e.target.value })}
                      placeholder="Dhaka"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Airport Name
                  </label>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={form.originName}
                    onChange={(e) => setForm({ ...form, originName: e.target.value })}
                    placeholder="Hazrat Shahjalal International Airport"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      Terminal
                    </label>
                    <input
                      type="text"
                      disabled={isSaving}
                      value={form.originTerminal}
                      onChange={(e) => setForm({ ...form, originTerminal: e.target.value })}
                      placeholder="Terminal 1"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      Gate
                    </label>
                    <input
                      type="text"
                      disabled={isSaving}
                      value={form.originGate}
                      onChange={(e) => setForm({ ...form, originGate: e.target.value })}
                      placeholder="Gate 3"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Destination (Arrival)
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      IATA Code *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={form.destinationIata}
                      onChange={(e) =>
                        setForm({ ...form, destinationIata: e.target.value.toUpperCase() })
                      }
                      placeholder="DXB"
                      className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      disabled={isSaving}
                      value={form.destinationCity}
                      onChange={(e) => setForm({ ...form, destinationCity: e.target.value })}
                      placeholder="Dubai"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Airport Name
                  </label>
                  <input
                    type="text"
                    disabled={isSaving}
                    value={form.destinationName}
                    onChange={(e) => setForm({ ...form, destinationName: e.target.value })}
                    placeholder="Dubai International Airport"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      Terminal
                    </label>
                    <input
                      type="text"
                      disabled={isSaving}
                      value={form.destinationTerminal}
                      onChange={(e) => setForm({ ...form, destinationTerminal: e.target.value })}
                      placeholder="Terminal 3"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                      Gate
                    </label>
                    <input
                      type="text"
                      disabled={isSaving}
                      value={form.destinationGate}
                      onChange={(e) => setForm({ ...form, destinationGate: e.target.value })}
                      placeholder="Gate B12"
                      className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Timing & Operational Status */}
            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                Schedule Timing &amp; Operational Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Scheduled Dep
                  </label>
                  <input
                    type="time"
                    disabled={isSaving}
                    value={toTimeInputValue(form.departureHour, form.departureMinute)}
                    onChange={(e) => {
                      const [hStr, mStr] = e.target.value.split(':');
                      setForm({
                        ...form,
                        departureHour: Number(hStr) || 0,
                        departureMinute: Number(mStr) || 0,
                      });
                    }}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    disabled={isSaving}
                    value={form.durationMinutes}
                    onChange={(e) =>
                      setForm({ ...form, durationMinutes: Number(e.target.value) || 60 })
                    }
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Status
                  </label>
                  <select
                    disabled={isSaving}
                    value={form.statusOverride}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        statusOverride: e.target.value as FlightStatusOverride,
                      })
                    }
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  >
                    <option value="AUTO">Auto (Schedule)</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ON_TIME">On Time</option>
                    <option value="DEPARTED">Departed</option>
                    <option value="DELAYED">Delayed</option>
                    <option value="ARRIVED">Arrived</option>
                    <option value="CANCELLED">Cancelled</option>
                  </select>
                </div>
                <div>
                  <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                    Delay (mins)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={1440}
                    disabled={isSaving}
                    value={form.delayMinutes}
                    onChange={(e) => setForm({ ...form, delayMinutes: Number(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Live Calculated Timing Preview */}
              {(() => {
                const depMin = (Number(form.departureHour) || 0) * 60 + (Number(form.departureMinute) || 0);
                const delay = Math.max(0, Number(form.delayMinutes) || 0);
                const duration = Math.max(15, Number(form.durationMinutes) || 60);
                const estDepMin = depMin + delay;
                const schedArrMin = depMin + duration;
                const estArrMin = estDepMin + duration;

                return (
                  <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-2 text-2xs">
                    <div>
                      <span className="text-slate-500 uppercase font-bold block">Sched. Dep</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatComputedClockTime(depMin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-bold block">Est. Dep</span>
                      <span className={`font-mono font-bold ${delay > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                        {formatComputedClockTime(estDepMin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-bold block">Sched. Arr</span>
                      <span className="font-mono font-bold text-slate-900">
                        {formatComputedClockTime(schedArrMin)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase font-bold block">Est. Arr</span>
                      <span className={`font-mono font-bold ${delay > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                        {formatComputedClockTime(estArrMin)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div className="mt-3">
                <label className="block text-2xs font-bold text-slate-700 uppercase mb-1">
                  Disruption / Delay Reason (Optional)
                </label>
                <input
                  type="text"
                  disabled={isSaving}
                  value={form.disruptionReason}
                  onChange={(e) => setForm({ ...form, disruptionReason: e.target.value })}
                  placeholder="e.g. Air traffic congestion at departure hub"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : editingFlight ? 'Save Changes' : 'Create Flight'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
