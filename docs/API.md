# Server actions & routes

All mutations are Next.js server actions (`"use server"`). Each returns `{ ok: true } | { ok: false, error }`.
Errors are user-safe messages; authorization is always checked server-side.

## Auth — `src/server/actions/auth.ts`
| Action | Who | Notes |
| --- | --- | --- |
| `registerStudentAction(FormData)` | public | Always creates a STUDENT; bcrypt hash; sets session |
| `loginAction(FormData)` | public | Generic error for bad email/password/inactive |
| `logoutAction()` | any | Clears cookie, redirects to /login |

## Complaints — `src/server/actions/complaints.ts`
| Action | Who | Effect |
| --- | --- | --- |
| `submitComplaintAction` | student | Create + SLA deadline + optional photo (JPEG/PNG/WEBP/GIF ≤ 5 MB) |
| `addCommentAction` | anyone who can view it | Staff may mark internal (hidden from student) |
| `assignComplaintAction` | admin | SUBMITTED/ASSIGNED → UNDER_REVIEW → ASSIGNED; notifies technician |
| `technicianRespondAssignmentAction(id, accept)` | assigned technician | Accept → ACCEPTED; decline → UNDER_REVIEW, unassigned |
| `startWorkAction(id)` | assigned technician | ACCEPTED → IN_PROGRESS |
| `markReadyForVerificationAction` | assigned technician | Notes required, optional resolution photo → READY_FOR_VERIFICATION |
| `studentConfirmResolutionAction(id)` | reporter | READY_FOR_VERIFICATION → RESOLVED |
| `studentReopenAction` | reporter | READY → IN_PROGRESS ("not fixed"); RESOLVED/CLOSED → REOPENED |
| `rateComplaintAction` | reporter | 1–5, once per complaint, only when resolved/closed |
| `adminCloseComplaintAction` | admin | RESOLVED → CLOSED |
| `adminRejectComplaintAction` | admin | Reason (≥5 chars) required |
| `adminOverrideCloseAction` | admin | Close from any non-final state; reason recorded in timeline + audit |
| `adminChangePriorityAction` | admin | Audit-logged (does not recompute the existing SLA deadline) |
| `runSlaCheckAction()` | admin | Escalates overdue active complaints once; "nearing" notifications |

## Admin — `src/server/actions/admin.ts`
`createHostelAction`, `createBlockAction`, `createRoomAction`, `createDepartmentAction`, `createCategoryAction`,
`upsertSLAConfigAction`, `createStaffUserAction`, `toggleUserActiveAction` (admin only, audit-logged);
`toggleTechnicianAvailabilityAction(available)` (technician).

## Notifications — `src/server/actions/notifications.ts`
`markNotificationReadAction(id)`, `markAllNotificationsReadAction()` (own notifications only).

## Route handlers
| Route | Access | Notes |
| --- | --- | --- |
| `GET /api/export/complaints?status=&category=&priority=&block=&assignee=&from=&to=` | admin (401/403 otherwise) | CSV, formula-injection safe, audit-logged |
| `GET /api/uploads/:name` | users who may view the parent complaint (404 otherwise) | Streams the image; `nosniff`, private cache |
