# Security Specification: Smart Flight Tracker (Firestore RBAC)

## 1. Data Invariants
1. **Default Deny:** All Firestore paths are denied by default via `match /{document=**} { allow read, write: if false; }`.
2. **Flight Catalog Authority:** Authenticated users can search and read `flights/{flightId}`, but only verified Admins (`neymarsakim@gmail.com` or trusted `/admins/{uid}`) may create, update, or delete flights.
3. **Privilege Escalation Prevention:** Normal users creating their `/users/{userId}` document are strictly constrained to `role == 'user'` and cannot self-assign `role == 'admin'` or alter their own `signupStatus` (`approved` / `pending` / `blocked`).
4. **Signup Permission Enforcement:** Creating `/users/{userId}` for non-admin accounts verifies `/settings/auth_config`: if `allowSignup == false`, registration is rejected at the rule layer; if `requireApproval == true`, `signupStatus` must start as `'pending'`.
5. **Email Spoofing Guard:** Admin email bootstrapping (`neymarsakim@gmail.com`) strictly requires `request.auth.token.email_verified == true`.
6. **PII Isolation:** `/users/{userId}` and `/auth_logs/{logId}` restrict `get` and `list` access strictly to the record owner (`uid == request.auth.uid`) or verified Admin (`neymarsakim@gmail.com`).
7. **Temporal & Structural Integrity:** All `createdAt`, `lastLoginAt`, and `updatedAt` timestamps must equal `request.time`, all string fields enforce `.size()` bounds, and all IDs match `^[a-zA-Z0-9_\-]+$`.
8. **Immutable Audit Trail:** `/auth_logs/{logId}` documents cannot be updated (`allow update: if false;`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated Flight Read:** Anonymous request to `get /flights/BS161` -> `PERMISSION_DENIED`.
2. **Normal User Flight Creation:** Authenticated `role: 'user'` attempts `create /flights/TEST999` -> `PERMISSION_DENIED`.
3. **Normal User Flight Update:** Authenticated `role: 'user'` attempts `update /flights/BS161` (`statusOverride: 'CANCELLED'`) -> `PERMISSION_DENIED`.
4. **Normal User Flight Deletion:** Authenticated `role: 'user'` attempts `delete /flights/BS161` -> `PERMISSION_DENIED`.
5. **Self-Assigned Admin Role:** Normal user attempts `create /users/{uid}` with `role: 'admin'` -> `PERMISSION_DENIED`.
6. **Admin Doc Forgery:** Normal user attempts `create /admins/{uid}` -> `PERMISSION_DENIED`.
7. **Shadow Ghost Field Injection:** Authenticated user sends `create /users/{uid}` with extra field `isSuperUser: true` -> `PERMISSION_DENIED`.
8. **Pending Approval Bypass:** When `settings/auth_config.requireApproval == true`, new user attempts `create /users/{uid}` with `signupStatus: 'approved'` -> `PERMISSION_DENIED`.
9. **Closed Signup Bypass:** When `settings/auth_config.allowSignup == false`, new user attempts `create /users/{uid}` -> `PERMISSION_DENIED`.
10. **PII Cross-User Read / Scrape:** Normal user attempts `get /users/{otherUid}` or `list /users` without owning records -> `PERMISSION_DENIED`.
11. **Blocked User Profile Mutation:** Blocked user (`signupStatus: 'blocked'`) attempts `update /users/{uid}` to flip `signupStatus: 'approved'` -> `PERMISSION_DENIED`.
12. **Email Spoofing Attack & Self-Delete Guard:** Unverified user claiming `email: 'neymarsakim@gmail.com'` (`email_verified: false`) attempts Admin write, OR Admin attempts `delete /users/{adminUid}` -> `PERMISSION_DENIED`.
