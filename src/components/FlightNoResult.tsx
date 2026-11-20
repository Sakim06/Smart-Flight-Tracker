import React from 'react';
import { SearchX, HelpCircle, ArrowRight } from 'lucide-react';

interface FlightNoResultProps {
  searchedQuery: string;
  onTrySample: (flightNumber: string) => void;
  onNewSearch: () => void;
}

export const FlightNoResult: React.FC<FlightNoResultProps> = ({
  searchedQuery,
  onTrySample,
  onNewSearch,
}) => {
  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 text-center animate-fadeIn">
      <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
        <SearchX className="w-8 h-8" />
      </div>

      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
        No flight matching &apos;{searchedQuery.toUpperCase()}&apos; was found.
      </h2>

      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
        Please verify the flight number, scheduled date, or check directly with the operating airline.
      </p>

      {/* Helpful Guidance */}
      <div className="mt-6 p-4 max-w-lg mx-auto bg-slate-50 rounded-xl border border-slate-200/80 text-left">
        <div className="flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-slate-700 space-y-1.5">
            <p className="font-semibold text-slate-900">Verification tips:</p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>Confirm the 2- or 3-character carrier code (e.g., <strong>BG</strong>, <strong>EK</strong>, <strong>SQ</strong>).</li>
              <li>Ensure the flight number has 1 to 4 digits (e.g., <strong>001</strong>, <strong>585</strong>, <strong>308</strong>).</li>
              <li>Codeshare flights may be filed under the partner or operating airline.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onNewSearch}
          className="w-full sm:w-auto px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          Clear and Search Again
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">or try active sample:</span>
          <button
            type="button"
            onClick={() => onTrySample('BG 001')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <span>BG 001</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </button>
          <button
            type="button"
            onClick={() => onTrySample('EK 585')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
          >
            <span>EK 585</span>
            <ArrowRight className="w-3 h-3 text-slate-500" />
          </button>
        </div>
      </div>
    </div>
  );
};
