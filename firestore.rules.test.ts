/**
 * Security Rule Validation Specification (Dirty Dozen Test Matrix)
 * Verifies every attack payload defined in security_spec.md against DRAFT_firestore.rules invariants.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actor: 'anonymous' | 'user' | 'blocked_user' | 'spoofed_admin' | 'admin';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
}

export const DIRTY_DOZEN_TESTS: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated flight read is denied',
    actor: 'anonymous',
    operation: 'get',
    path: '/flights/BS161',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Normal user flight creation is denied',
    actor: 'user',
    operation: 'create',
    path: '/flights/TEST999',
    payload: { id: 'TEST999', flightNumber: 'TS 999', normalizedCode: 'TS999' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Normal user flight update is denied',
    actor: 'user',
    operation: 'update',
    path: '/flights/BS161',
    payload: { statusOverride: 'CANCELLED' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Normal user flight deletion is denied',
    actor: 'user',
    operation: 'delete',
    path: '/flights/BS161',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Self-assigned admin role on signup is denied',
    actor: 'user',
    operation: 'create',
    path: '/users/user123',
    payload: { uid: 'user123', role: 'admin', signupStatus: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Normal user forging admins/{uid} document is denied',
    actor: 'user',
    operation: 'create',
    path: '/admins/user123',
    payload: { uid: 'user123', email: 'attacker@example.com', grantedBy: 'user123' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Shadow ghost field injection in user profile is denied',
    actor: 'user',
    operation: 'create',
    path: '/users/user123',
    payload: { uid: 'user123', role: 'user', isSuperUser: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Pending approval bypass on signup is denied',
    actor: 'user',
    operation: 'create',
    path: '/users/user123',
    payload: { uid: 'user123', role: 'user', signupStatus: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Closed signup bypass is denied',
    actor: 'user',
    operation: 'create',
    path: '/users/user123',
    payload: { uid: 'user123', role: 'user', signupStatus: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Cross-user PII profile read is denied',
    actor: 'user',
    operation: 'get',
    path: '/users/otherUser456',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Blocked user self-unblocking update is denied',
    actor: 'blocked_user',
    operation: 'update',
    path: '/users/blockedUid',
    payload: { signupStatus: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unverified admin email spoofing is denied',
    actor: 'spoofed_admin',
    operation: 'create',
    path: '/flights/SPOOF1',
    payload: { id: 'SPOOF1', flightNumber: 'SP 001', normalizedCode: 'SP001' },
    expected: 'PERMISSION_DENIED',
  },
];
