import React, { useState } from 'react';
import { Search, X, AlertCircle } from 'lucide-react';
import { validateFlightQuery } from '../services/flightMockService';

interface FlightSearchFormProps {
  onSearch: (flightNumber: string) => void;
  isLoading: boolean;
  initialValue?: string;
  autoFocus?: boolean;
  onFormatError?: (errorMessage: string) => void;
}

export const FlightSearchForm: React.FC<FlightSearchFormProps> = ({
  onSearch,
  isLoading,
  initialValue = '',
  autoFocus = false,
  onFormatError,
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();

    const validation = validateFlightQuery(trimmed);
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Invalid flight number format. Please enter a valid airline code and number (e.g., BG 001, EK 585, SQ 308).';
      setValidationError(errorMsg);
      if (onFormatError) onFormatError(errorMsg);
      return;
    }

    setValidationError(null);
    onSearch(trimmed);
  };

  const handleClear = () => {
    setInputValue('');
    setValidationError(null);
  };

  const handleQuickFill = (code: string) => {
    setInputValue(code);
    const validation = validateFlightQuery(code);
    if (!validation.isValid) {
      const errorMsg = validation.error || 'Invalid flight number format. Please enter a valid airline code and number (e.g., BG 001, EK 585, SQ 308).';
      setValidationError(errorMsg);
      if (onFormatError) onFormatError(errorMsg);
      return;
    }
    setValidationError(null);
    onSearch(code);
  };

  const samples = [
    { label: 'BS 161', desc: 'DAC → Rajshahi', type: 'domestic' },
    { label: 'BS 105', desc: 'DAC → Chattogram', type: 'domestic' },
    { label: 'BG 601', desc: 'DAC → Sylhet', type: 'domestic' },
    { label: 'EK 585', desc: 'DAC → Dubai (Delayed)', type: 'delayed' },
    { label: 'SQ 447', desc: 'DAC → Singapore', type: 'active' },
    { label: 'BG 001', desc: 'DAC → London', type: 'active' },
    { label: 'DL 890', desc: 'Cancelled Test', type: 'cancelled' },
    { label: 'ABC 100', desc: 'Not Found Test', type: 'notfound' },
    { label: '100', desc: 'Invalid Format Test', type: 'invalid' },
  ];

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} noValidate className="w-full">
        <div className="relative">
          <label htmlFor="flight-search-input" className="sr-only">
            Flight Number (e.g. BG 001, EK 585, AA 100)
          </label>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-1.5 sm:p-2 bg-white rounded-xl border border-slate-200 shadow-sm focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <div className="relative flex-1 flex items-center">
              <div className="absolute left-3.5 text-slate-400 pointer-events-none" aria-hidden="true">
                <Search className="w-5 h-5" />
              </div>

              <input
                id="flight-search-input"
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (validationError) setValidationError(null);
                }}
                placeholder="Enter flight number, e.g. BG 001, EK 585, AA 100..."
                className="w-full pl-11 pr-9 py-2.5 sm:py-3 text-slate-900 placeholder:text-slate-400 text-base font-medium uppercase tracking-wide bg-transparent focus:outline-none"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck="false"
                autoFocus={autoFocus}
                aria-invalid={validationError ? 'true' : 'false'}
                aria-describedby={validationError ? 'search-validation-error' : undefined}
                disabled={isLoading}
              />

              {inputValue && !isLoading && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                  aria-label="Clear flight number input"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center justify-center px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Searching...</span>
                </span>
              ) : (
                'Search Flight'
              )}
            </button>
          </div>
        </div>

        {/* Inline Client Validation Error */}
        {validationError && (
          <div
            id="search-validation-error"
            role="alert"
            className="flex items-start gap-2 mt-2.5 px-3.5 py-2 text-xs sm:text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 text-rose-600 shrink-0" aria-hidden="true" />
            <p className="font-medium leading-relaxed">{validationError}</p>
          </div>
        )}
      </form>

      {/* Quick-fill sample demonstration buttons */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
          <span>Quick demonstration presets:</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {samples.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleQuickFill(item.label)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 border border-slate-200/80 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50"
              title={`Load sample flight ${item.label} (${item.desc})`}
            >
              <span className="font-mono font-semibold text-slate-900">{item.label}</span>
              <span className="text-slate-400 font-normal">/</span>
              <span className={
                item.type === 'delayed'
                  ? 'text-amber-700'
                  : item.type === 'cancelled'
                  ? 'text-rose-700'
                  : item.type === 'notfound'
                  ? 'text-purple-700'
                  : item.type === 'invalid'
                  ? 'text-red-700'
                  : item.type === 'arrived'
                  ? 'text-teal-700'
                  : item.type === 'domestic'
                  ? 'text-emerald-700'
                  : 'text-slate-600'
              }>
                {item.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
