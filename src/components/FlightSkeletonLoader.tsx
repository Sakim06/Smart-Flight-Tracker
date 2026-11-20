import React from 'react';
import { Plane } from 'lucide-react';

export const FlightSkeletonLoader: React.FC = () => {
  return (
    <div
      className="w-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-pulse"
      aria-label="Loading flight information"
      aria-busy="true"
    >
      {/* Header Skeleton */}
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
            <div className="space-y-2">
              <div className="h-6 w-32 bg-slate-200 rounded" />
              <div className="h-3 w-48 bg-slate-200 rounded" />
            </div>
          </div>
          <div className="h-8 w-28 bg-slate-200 rounded-lg" />
        </div>
      </div>

      {/* Route & Progress Skeleton */}
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-4 space-y-2.5">
            <div className="h-8 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-44 bg-slate-200 rounded" />
          </div>

          <div className="md:col-span-4 space-y-3">
            <div className="h-3 w-full bg-slate-200 rounded-full" />
            <div className="flex justify-between">
              <div className="h-3 w-16 bg-slate-200 rounded" />
              <div className="h-3 w-16 bg-slate-200 rounded" />
            </div>
          </div>

          <div className="md:col-span-4 space-y-2.5 md:text-right flex flex-col md:items-end">
            <div className="h-8 w-20 bg-slate-200 rounded" />
            <div className="h-4 w-36 bg-slate-200 rounded" />
            <div className="h-3 w-44 bg-slate-200 rounded" />
          </div>
        </div>
      </div>

      {/* Timing Grid Skeleton */}
      <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/40">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-7 w-24 bg-slate-200 rounded" />
            <div className="h-3 w-40 bg-slate-200 rounded" />
          </div>
          <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-4">
            <div className="h-4 w-32 bg-slate-200 rounded" />
            <div className="h-7 w-24 bg-slate-200 rounded" />
            <div className="h-3 w-40 bg-slate-200 rounded" />
          </div>
        </div>
      </div>

      {/* Telemetry Row Skeleton */}
      <div className="p-4 sm:p-6 border-b border-slate-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
          <div className="h-16 bg-slate-100 rounded-lg" />
        </div>
      </div>

      {/* Footer message */}
      <div className="p-4 bg-slate-50 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
        <Plane className="w-4 h-4 animate-bounce text-blue-600" />
        <span>Querying global air traffic telemetry radar...</span>
      </div>
    </div>
  );
};
