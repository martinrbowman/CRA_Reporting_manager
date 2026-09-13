# User Guide — PSIRT & Art. 14 Reporting

## The CRA Art. 14 deadline model

The Cyber Resilience Act's vulnerability-reporting obligation (Regulation
(EU) 2024/2847, Art. 14) applies from **11 September 2026**. Once a
manufacturer becomes aware of an actively exploited vulnerability in a
product with digital elements, three clocks start:

| Report | Deadline | Purpose |
|---|---|---|
| Early warning | 24 hours | Notify without undue delay that a vulnerability is being actively exploited |
| Notification | 72 hours | Fuller notification once available |
| Final report | 14 days | Full report after a corrective/mitigating measure is available |

These go to the national CSIRT designated as coordinator and to ENISA. The
platform tracks the clocks and produces a PDF you submit manually — there is
no automated API integration with any regulator portal (the `CRA_REPORTING_BASE_URL`
/ `CRA_ENISA_ENDPOINT` env vars are reserved for that if it becomes available
later, but currently unused).

Full application of the Regulation follows on **11 December 2027**. See the
CRA Timeline page in the app for the complete milestone list.

## PSIRT case workflow

1. **Intake** — PSIRT → New Case. Record the intake source, reporter
   category, and an initial summary. If the case relates to a specific
   product vulnerability already logged, link it by `vulnerabilityId`.
   Creating a case starts its SLA clock immediately (`slaClockStart = now`).
2. **Triage** — update the case with a severity/exploitation/reproducibility
   assessment, priority, and assigned owner as they're determined.
3. **SLA tracking** — the PSIRT list and Dashboard show each open case's
   status: `on_track`, `warning` (within 8 hours of any deadline),
   `breached` (past any deadline), or `closed`. `sla-summary` recomputes
   this live, no separate action needed.
4. **Resetting the clock** — if materially new information restarts the
   regulatory timeline (rare — use judgment), "Reset SLA" on the case detail
   page sets a fresh `slaClockStart` and recomputed deadlines.
5. **Marking submissions sent** — "Mark sent" buttons on the case detail
   page's Art. 14 panel stamp `earlyWarningSentAt` / `notificationSentAt` /
   `finalReportSentAt` once you've actually submitted each report externally
   (see Reporting below) — this is separate from the report queue's own
   `submittedAtUtc` and exists because a single case can span multiple
   linked reports over its life.
6. **Closure** — request closure via Approvals (see below); a case only
   closes once a second user approves it.

## Vulnerability cases

Vulnerabilities → New records the full technical record: affected product,
version range, discovery details, severity (initial and current), and
exploitation status. Events (Vulnerabilities → detail → timeline) log
discrete actions (`TriageStarted`, `PatchReleased`, `RegulatorNotified`,
etc.) as an append-only history — useful as the evidence trail for a report.

## Generating and submitting a report

1. Reporting → "Start report queue" against a vulnerability or incident —
   this creates all three draft reports (early warning, full notification,
   final report) at once, with deadlines computed from the case's discovery
   or detection date (clamped to not be in the past if you're starting late).
2. Edit each draft's content before submission — the `content` field is a
   free-form JSON blob rendered as a table in the exported PDF.
3. Route the report through Approvals (request approval, `objectType:
   cra_report`) — a different user than the requester must approve it before
   it can be submitted. Self-approval is blocked (403).
4. Once approved, PATCH the report to `status: submitted` with the
   regulator's reference number, if issued. **Submitted reports are
   immutable** — further edits are rejected (409).
5. Export PDF (report detail → "Export PDF") for the document you actually
   hand to the CSIRT/ENISA. It includes the report type, all key dates,
   product/manufacturer identification, and the content table.

## Approvals

Any of `psirt_case` (case closure), `vulnerability_severity` (severity
validation), `cra_report` (report submission), or `patch` (patch approval)
can be routed through Approvals. Submitting a new approval request
supersedes any existing pending one for the same object. The approver must
be a different user than the requester (segregation of duties) — this is
enforced server-side, not just a UI convention.

## Notifications, incidents, patches

- **Notifications** logs outbound communications (customer/regulator/
  internal/supplier) with delivery status. "Send" attempts real email if
  SMTP is configured, otherwise records a manual dispatch.
- **Incidents** is for broader security incidents that may or may not tie
  back to a specific vulnerability case — used as an alternate report-queue
  entry point alongside vulnerability cases.
- **Patches** tracks remediation delivery for a vulnerability (test plan,
  rollout, rollback plan, approval status) — linked to the vulnerability and
  product/version records.
