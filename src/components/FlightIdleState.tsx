import React from 'react';
import { Plane, Compass, Clock, ShieldCheck, ArrowRight } from 'lucide-react';

interface FlightIdleStateProps {
  onSelectSample: (flightNumber: string) => void;
}

export const FlightIdleState: React.FC<FlightIdleStateProps> = ({ onSelectSample }) => {
  const featuredRoutes = [
    {
      flightNumber: 'BS 161',
      airline: 'US-Bangla Airlines',
      route: 'DAC → RJH',
      fromCity: 'Dhaka',
      toCity: 'Rajshahi',
      category: 'Domestic',
      status: 'On Time',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      flightNumber: 'BS 105',
      airline: 'US-Bangla Airlines',
      route: 'DAC → CGP',
      fromCity: 'Dhaka',
      toCity: 'Chattogram',
      category: 'Domestic',
      status: 'Departed',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      flightNumber: 'BG 601',
      airline: 'Biman Bangladesh Airlines',
      route: 'DAC → ZYL',
      fromCity: 'Dhaka',
      toCity: 'Sylhet',
      category: 'Domestic',
      status: 'Scheduled',
      badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      flightNumber: 'BS 143',
      airline: 'US-Bangla Airlines',
      route: 'DAC → CXB',
      fromCity: 'Dhaka',
      toCity: "Cox's Bazar",
      category: 'Domestic',
      status: 'On Time',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      flightNumber: 'EK 585',
      airline: 'Emirates',
      route: 'DAC → DXB',
      fromCity: 'Dhaka',
      toCity: 'Dubai',
      category: 'International',
      status: 'Delayed (+75m)',
      badgeClass: 'text-amber-700 bg-amber-50 border-amber-200',
    },
    {
      flightNumber: 'SQ 447',
      airline: 'Singapore Airlines',
      route: 'DAC → SIN',
      fromCity: 'Dhaka',
      toCity: 'Singapore',
      category: 'International',
      status: 'En Route',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      flightNumber: 'BG 201',
      airline: 'Biman Bangladesh Airlines',
      route: 'DAC → LHR',
      fromCity: 'Dhaka',
      toCity: 'London Heathrow',
      category: 'International',
      status: 'Scheduled',
      badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
    },
    {
      flightNumber: 'QR 643',
      airline: 'Qatar Airways',
      route: 'DAC → DOH',
      fromCity: 'Dhaka',
      toCity: 'Doha Hamad',
      category: 'International',
      status: 'Scheduled',
      badgeClass: 'text-blue-700 bg-blue-50 border-blue-200',
    },
  ];

  return (
    <div className="w-full space-y-8 animate-fadeIn">
      {/* Informative Guidance Strip */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight mb-2">
          How to Look Up Flight Status
        </h2>
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-6">
          Locate your 2- or 3-character airline code followed by the flight number on your ticket,
          boarding pass, or confirmation itinerary (for instance, <strong className="font-mono text-slate-800">BG 001</strong> for Biman or <strong className="font-mono text-slate-800">EK 585</strong> for Emirates).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Scheduled vs. Estimated</h3>
              <p className="mt-1 text-xs text-slate-500">
                Instantly compare scheduled departure/arrival with live air traffic radar estimates and delay times.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Route Progress Tracking</h3>
              <p className="mt-1 text-xs text-slate-500">
                Visual progress connector displaying origin, destination, elapsed duration, and remaining flight time.
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-start gap-3">
            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Strict Data Integrity</h3>
              <p className="mt-1 text-xs text-slate-500">
                Verified gates, terminals, and baggage carousels. Missing fields are explicitly marked as "Not available".
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Popular Sample Flights to Explore */}
      <section className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Explore Active Flight Status Samples
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any active route below to preview realistic telemetry, delay states, or gate assignments.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featuredRoutes.map((f) => (
            <button
              key={f.flightNumber}
              type="button"
              onClick={() => onSelectSample(f.flightNumber)}
              className="group p-4 bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer shadow-2xs"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono font-extrabold text-slate-900 text-base">
                  {f.flightNumber}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-md font-semibold border ${f.badgeClass}`}>
                  {f.status}
                </span>
              </div>

              <div className="flex items-center justify-between gap-1 mb-3">
                <p className="text-xs text-slate-500 truncate">
                  {f.airline}
                </p>
                <span className={`text-2xs font-semibold px-1.5 py-0.5 rounded shrink-0 ${
                  f.category === 'Domestic'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                    : 'bg-blue-50 text-blue-700 border border-blue-200/60'
                }`}>
                  {f.category}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="font-semibold text-slate-800">
                  <span>{f.fromCity}</span>
                  <span className="mx-1 text-slate-400">→</span>
                  <span>{f.toCity}</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
