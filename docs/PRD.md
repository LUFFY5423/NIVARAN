# Nivaran — Product Requirements (prototype)

## Problem
Students report hostel faults verbally or via unlogged channels; issues stall, are "closed" without being fixed, and
administrators lack data to see where the process fails.

## Goals
1. One accountable record per complaint, from report to student-verified fix.
2. Clear ownership + deadlines (SLA) with automatic escalation.
3. Evidence (photos, timeline, audit) to resolve disputes.
4. Management analytics and a public, anonymized performance view.

## Users
| Role | Needs |
| --- | --- |
| Student | Report quickly, see status, confirm/reopen, rate |
| Technician | Clear queue with location/priority/deadline; record work + evidence |
| Administrator | Triage, assign, configure SLA, monitor, audit, export |

## Functional requirements (all implemented unless noted)
* FR1 Register/login, three roles, protected routes, server-side authorization.
* FR2 Complaint with title, description, category, subcategory, location (hostel/block/floor/room), priority, attachments.
* FR3 Lifecycle of 10 statuses with recorded user/previous/new/time/comment; admin-only rejection with reason.
* FR4 Students may reopen after Resolved; no closing without student confirmation **or** admin override with recorded reason.
* FR5 SLA hours per category × priority; deadline set at creation; overdue badge; manual escalation run.
* FR6 In-app notifications for the 8 event types; abstraction for future email.
* FR7 Admin: filters, assignment, priority change, users, locations, categories/SLA, analytics, audit log, CSV export.
* FR8 Technician: accept/decline, status updates, notes, resolution evidence, availability.
* FR9 Public anonymized stats page.
* FR10 Demo seed data (fictional).

## Non-functional
Responsive, keyboard-accessible, safe error messages, no secrets in repo, modular data layer.

## Out of scope / not done
Email delivery, scheduled jobs, password reset, rate limiting, editing/deleting reference data, multi-tenant.

## Success metrics (for a real rollout)
Resolution rate, average resolution hours, % within SLA, reopen rate, satisfaction score (all on the admin dashboard).
