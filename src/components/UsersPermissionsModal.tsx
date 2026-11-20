import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  ShieldCheck,
  History,
  Lock,
  Unlock,
  CheckCircle2,
  Clock,
  Ban,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { AuthLogEntry, AuthSettings, UserProfile } from '../types/flight';
import {
  subscribeToAllUsers,
  subscribeToAuthLogs,
  subscribeToAuthSettings,
  updateAuthSettings,
  updateUserPermissions,
  deleteUserRecord,
} from '../services/firestoreService';
import { isDesignatedAdminEmail } from '../lib/firebase';

interface UsersPermissionsModalProps {
  isOpen: boolean;
  adminUid: string;
  onClose: () => void;
}

function formatTimestamp(ts: unknown): string {
  if (!ts) return '—';
  const maybeTs = ts as { toDate?: () => Date; seconds?: number };
  const date =
    typeof maybeTs.toDate === 'function'
      ? maybeTs.toDate()
      : typeof maybeTs.seconds === 'number'
      ? new Date(maybeTs.seconds * 1000)
      : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const UsersPermissionsModal: React.FC<UsersPermissionsModalProps> = ({
  isOpen,
  adminUid,
  onClose,
}) => {
  const [subTab, setSubTab] = useState<'users' | 'logs'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [authLogs, setAuthLogs] = useState<AuthLogEntry[]>([]);
  const [authSettings, setAuthSettings] = useState<AuthSettings>({
    allowSignup: true,
    requireApproval: false,
    updatedBy: 'system',
    updatedAt: null,
  });
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [confirmDeleteUid, setConfirmDeleteUid] = useState<string | null>(null);
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const unsubUsers = subscribeToAllUsers(setUsers);
    const unsubLogs = subscribeToAuthLogs(setAuthLogs);
    const unsubSettings = subscribeToAuthSettings(setAuthSettings);
    return () => {
      unsubUsers();
      unsubLogs();
      unsubSettings();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleToggleSetting = async (field: 'allowSignup' | 'requireApproval') => {
    setIsUpdatingSettings(true);
    setFeedback(null);
    try {
      const nextAllow = field === 'allowSignup' ? !authSettings.allowSignup : authSettings.allowSignup;
      const nextRequire =
        field === 'requireApproval' ? !authSettings.requireApproval : authSettings.requireApproval;
      await updateAuthSettings(nextAllow, nextRequire, adminUid);
      setFeedback({ type: 'success', message: 'Global signup permission settings updated.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update settings.',
      });
    } finally {
      setIsUpdatingSettings(false);
    }
  };

  const handleUpdateUser = async (
    target: UserProfile,
    updates: { role?: 'admin' | 'user'; signupStatus?: 'approved' | 'pending' | 'blocked' }
  ) => {
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await updateUserPermissions(target, updates, adminUid);
      setFeedback({ type: 'success', message: `Updated permissions for ${target.email}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to update user.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleDeleteUser = async (target: UserProfile) => {
    setBusyUid(target.uid);
    setFeedback(null);
    try {
      await deleteUserRecord(target);
      setConfirmDeleteUid(null);
      setFeedback({ type: 'success', message: `Deleted user profile for ${target.email}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Unable to delete user.',
      });
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="users-permissions-modal-title"
    >
      <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto animate-scaleUp">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h2 id="users-permissions-modal-title" className="text-base font-extrabold tracking-tight">
                Users &amp; Signup Permissions
              </h2>
              <p className="text-2xs text-slate-300">
                Manage global signup toggles, approve/suspend accounts, roles, and audit logs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Users and Permissions modal"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[78vh] overflow-y-auto p-5 space-y-5">
          {feedback && (
            <div
              role="status"
              className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-800'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* Global Signup Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  {authSettings.allowSignup ? (
                    <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  <span>Allow New User Signups</span>
                </div>
                <p className="text-2xs text-slate-500 mt-0.5">
                  Block or allow new account registration across Email &amp; Google.
                </p>
              </div>
              <button
                type="button"
                disabled={isUpdatingSettings}
                onClick={() => void handleToggleSetting('allowSignup')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  authSettings.allowSignup
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {authSettings.allowSignup ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Require Admin Approval</span>
                </div>
                <p className="text-2xs text-slate-500 mt-0.5">
                  New accounts wait in pending state until approved by an Admin.
                </p>
              </div>
              <button
                type="button"
                disabled={isUpdatingSettings}
                onClick={() => void handleToggleSetting('requireApproval')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                  authSettings.requireApproval
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
              >
                {authSettings.requireApproval ? 'Required' : 'Instant'}
              </button>
            </div>
          </div>

          {/* Sub-Tabs */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
            <button
              type="button"
              onClick={() => setSubTab('users')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                subTab === 'users'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Registered Users ({users.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('logs')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                subTab === 'logs'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Login &amp; Signup Logs ({authLogs.length})</span>
            </button>
          </div>

          {subTab === 'users' ? (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[620px] text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider font-bold text-slate-500">
                    <th className="py-2.5 px-3.5">User</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Last Login</th>
                    <th className="py-2.5 px-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => {
                    const isPrimary = isDesignatedAdminEmail(u.email);
                    const isSelf = u.uid === adminUid;
                    const isBusy = busyUid === u.uid;

                    return (
                      <tr key={u.uid} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-3.5">
                          <div className="font-bold text-slate-900">{u.fullName}</div>
                          <div className="text-2xs text-slate-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-2xs font-bold ${
                              u.role === 'admin'
                                ? 'bg-slate-900 text-white'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {u.role === 'admin' ? 'Admin' : 'User'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {u.signupStatus === 'approved' ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                              <CheckCircle2 className="w-3 h-3" /> Active
                            </span>
                          ) : u.signupStatus === 'pending' ? (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                              <Clock className="w-3 h-3" /> Pending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-2xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                              <Ban className="w-3 h-3" /> Suspended
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-mono text-2xs">
                          {formatTimestamp(u.lastLoginAt)} ({u.loginCount || 1}x)
                        </td>
                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                          {isPrimary ? (
                            <span className="text-2xs font-semibold text-slate-400">Primary Admin</span>
                          ) : confirmDeleteUid === u.uid ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleDeleteUser(u)}
                                className="px-2 py-1 text-2xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-md"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => setConfirmDeleteUid(null)}
                                className="px-2 py-1 text-2xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-md"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              {u.signupStatus !== 'approved' ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleUpdateUser(u, { signupStatus: 'approved' })}
                                  className="px-2 py-1 text-2xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md"
                                >
                                  Approve
                                </button>
                              ) : (
                                !isSelf && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => void handleUpdateUser(u, { signupStatus: 'blocked' })}
                                    className="px-2 py-1 text-2xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md"
                                  >
                                    Suspend
                                  </button>
                                )
                              )}

                              {!isSelf && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => setConfirmDeleteUid(u.uid)}
                                  title="Delete user profile"
                                  aria-label={`Delete ${u.email}`}
                                  className="p-1 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md border border-transparent hover:border-rose-200"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No registered user records found in Cloud Firestore yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse min-w-[540px] text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-2xs uppercase tracking-wider font-bold text-slate-500">
                    <th className="py-2.5 px-3.5">Event</th>
                    <th className="py-2.5 px-3">User</th>
                    <th className="py-2.5 px-3">Provider</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {authLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="py-2 px-3.5 font-mono font-bold text-slate-800">
                        {log.eventType}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-semibold text-slate-900">{log.fullName}</div>
                        <div className="text-2xs text-slate-500 font-mono">{log.email}</div>
                      </td>
                      <td className="py-2 px-3 capitalize text-slate-600">{log.authProvider}</td>
                      <td className="py-2 px-3 capitalize text-slate-600">
                        {log.signupStatusAtEvent}
                      </td>
                      <td className="py-2 px-3.5 text-right font-mono text-2xs text-slate-500">
                        {formatTimestamp(log.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {authLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500">
                        No login or signup events recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
