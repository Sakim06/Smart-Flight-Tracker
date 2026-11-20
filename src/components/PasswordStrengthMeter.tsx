import React from 'react';
import { Check, X } from 'lucide-react';

interface PasswordStrengthMeterProps {
  password: string;
}

export interface PasswordRequirements {
  hasMinLength: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  score: number; // 0 to 3
}

export function evaluatePassword(password: string): PasswordRequirements {
  const hasMinLength = password.length >= 8;
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

  let score = 0;
  if (hasMinLength) score++;
  if (hasNumber) score++;
  if (hasSpecialChar) score++;

  return {
    hasMinLength,
    hasNumber,
    hasSpecialChar,
    score,
  };
}

export const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
  if (!password) return null;

  const { hasMinLength, hasNumber, hasSpecialChar, score } = evaluatePassword(password);

  const getLabel = () => {
    if (score === 1) return { text: 'Weak', color: 'text-rose-600', bar: 'bg-rose-500 w-1/3' };
    if (score === 2) return { text: 'Fair', color: 'text-amber-600', bar: 'bg-amber-500 w-2/3' };
    if (score === 3) return { text: 'Strong', color: 'text-emerald-600', bar: 'bg-emerald-500 w-full' };
    return { text: 'Too Weak', color: 'text-slate-400', bar: 'bg-slate-200 w-1/12' };
  };

  const label = getLabel();

  return (
    <div className="mt-2 space-y-2 text-xs" aria-live="polite">
      {/* Progress Bar */}
      <div className="flex items-center justify-between text-slate-500 font-medium">
        <span>Password strength:</span>
        <span className={`font-semibold ${label.color}`}>{label.text}</span>
      </div>

      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full transition-all duration-300 ${label.bar}`} />
      </div>

      {/* Checklist Rules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-1 pt-1 text-slate-600">
        <div className="flex items-center gap-1.5">
          {hasMinLength ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span className={hasMinLength ? 'text-slate-900 font-medium' : 'text-slate-400'}>
            8+ characters
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasNumber ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span className={hasNumber ? 'text-slate-900 font-medium' : 'text-slate-400'}>
            At least 1 number
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {hasSpecialChar ? (
            <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <X className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          )}
          <span className={hasSpecialChar ? 'text-slate-900 font-medium' : 'text-slate-400'}>
            Special character
          </span>
        </div>
      </div>
    </div>
  );
};
