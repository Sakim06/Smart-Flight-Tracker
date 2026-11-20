import React from 'react';
import { WifiOff, RefreshCw, ArrowLeft } from 'lucide-react';

interface FlightErrorStateProps {
  searchedQuery: string;
  onRetry: () => void;
  onReset: () => void;
  isRetrying: boolean;
  errorMessage?: string;
}

export const FlightErrorState: React.FC<FlightErrorStateProps> = ({
  searchedQuery,
  onRetry,
  onReset,
  isRetrying,
  errorMessage,
}) => {
  return (
    <div
      className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10 text-center animate-fadeIn"
      role="alert"
    >
      <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 border border-amber-100 rounded-full flex items-center justify-center text-amber-600">
        <WifiOff className="w-8 h-8" />
      </div>

      <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
        Flight information service is temporarily unavailable
      </h2>

      <p className="mt-2 text-sm text-slate-600 max-w-md mx-auto">
        {errorMessage ||
          'Our air traffic schedule provider did not respond within the allocated timeframe. No flight changes were recorded.'}
      </p>

      <div className="mt-4 inline-block px-3 py-1 bg-slate-100 rounded text-xs font-mono text-slate-700">
        Attempted Query: <span className="font-bold">{searchedQuery.toUpperCase()}</span>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="button"
          onClick={onRetry}
          disabled={isRetrying}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-lg shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
          <span>{isRetrying ? 'Re-establishing Connection...' : 'Try Again'}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Return to Search</span>
        </button>
      </div>

      <p className="mt-6 text-xs text-slate-400">
        If the issue persists, verify your local internet connection or try checking again shortly.
      </p>
    </div>
  );
};
