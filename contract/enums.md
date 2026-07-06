# EQIP — Shared Enums

All enumerations used across both the frontend (TypeScript) and backend (Python) tiers.
Values are **lowercase snake_case strings** — use these exact literals in API payloads,
database documents, seed data, and frontend type definitions. Both tiers MUST reference
this file as the single source of truth; do not invent synonyms or alternate casing.

---

## RoleEnum

Identifies the RBAC role assigned to a user.

| Value                | Description                                              |
| -------------------- | -------------------------------------------------------- |
| `admin`              | Full platform configuration, user management, system health |
| `qa_manager`         | Application/team-scoped quality management, approvals    |
| `qa_lead`            | Cross-segment quality oversight, approval, governance    |
| `qa_engineer`        | Test asset CRUD, execution, evidence capture, defect linking |
| `developer`          | Code quality, unit test focus, application detail access |
| `release_manager`    | Release readiness, quality gate management, deployment approval |
| `compliance_officer` | Governance oversight, compliance scoring, procedure management |
| `auditor`            | Read-only access to governance, compliance, audit logs, evidence |
| `viewer`             | View-only access to permitted dashboards and reports     |
| `api_consumer`       | Scoped programmatic access for service accounts          |

---

## UserStatus

Lifecycle status of a user account.

| Value      | Description                        |
| ---------- | ---------------------------------- |
| `active`   | User can log in and use the platform |
| `inactive` | Account disabled by admin          |
| `locked`   | Account locked due to policy violation or security event |

---

## TestCaseStatus

Lifecycle status of a test case asset.

| Value        | Description                                    |
| ------------ | ---------------------------------------------- |
| `draft`      | Under creation, not yet approved for execution |
| `active`     | Approved and available for execution           |
| `deprecated` | Superseded, kept for historical reference      |
| `archived`   | Soft-deleted, retained per retention policy    |

---

## AutomationStatus

Automation classification of a test case.

| Value       | Description                                         |
| ----------- | --------------------------------------------------- |
| `manual`    | Executed manually by a tester                       |
| `automated` | Fully automated execution                           |
| `hybrid`    | Partially automated, requires manual steps          |
| `planned`   | Identified as an automation candidate, not yet automated |

---

## Priority

Priority level for test cases, defects, and demand items.

| Value      | Description                              |
| ---------- | ---------------------------------------- |
| `critical` | Must be addressed immediately            |
| `high`     | High business impact, address in current cycle |
| `medium`   | Moderate impact, plan for upcoming cycle |
| `low`      | Low impact, address when capacity allows |

---

## ExecutionStatus

Status of a test execution run.

| Value         | Description                                      |
| ------------- | ------------------------------------------------ |
| `pending`     | Queued, not yet started                          |
| `in_progress` | Currently executing                              |
| `passed`      | All assertions passed                            |
| `failed`      | One or more assertions failed                    |
| `blocked`     | Cannot execute due to environment or dependency issue |
| `skipped`     | Intentionally skipped for this run               |
| `error`       | Execution aborted due to infrastructure or system error |

---

## QualityGateResult

Outcome of a quality gate evaluation for a release.

| Value            | Description                                       |
| ---------------- | ------------------------------------------------- |
| `pass`           | Gate criteria fully met                           |
| `warning`        | Gate criteria partially met, review recommended   |
| `fail`           | Gate criteria not met, release blocked             |
| `waived`         | Gate requirement waived with justification and approval |
| `not_applicable` | Gate does not apply to this release type or tier  |

---

## IntegrationStatus

Connection status of an external system integration.

| Value      | Description                                  |
| ---------- | -------------------------------------------- |
| `active`   | Integration connected and syncing normally   |
| `inactive` | Integration disabled or not yet configured   |
| `error`    | Integration experiencing failures or circuit breaker open |

---

## GovernanceStatus

Lifecycle status of a governance procedure.

| Value        | Description                                    |
| ------------ | ---------------------------------------------- |
| `draft`      | Procedure under development, not yet enforced  |
| `active`     | Procedure enforced for applicable entities     |
| `deprecated` | Procedure retired, kept for historical reference |

---

## EvidenceType

Classification of evidence artifacts attached to test executions.

| Value        | Description                                |
| ------------ | ------------------------------------------ |
| `log`        | Execution log file (text/structured)       |
| `screenshot` | Screenshot image (PNG, JPG)                |
| `video`      | Video recording (MP4, WebM)                |
| `document`   | Supporting document (PDF, DOCX)            |
| `report`     | Generated report artifact                  |

---

## ReportType

Category of report that can be generated or exported.

| Value               | Description                                      |
| ------------------- | ------------------------------------------------ |
| `quality_summary`   | Overall quality status across the enterprise     |
| `test_coverage`     | Test coverage analysis by application/segment    |
| `release_readiness` | Release readiness assessment with gate results   |
| `compliance`        | Governance and compliance adherence report       |
| `trend_analysis`    | Quality trend analysis over time                 |

---

## MetricCategory

Category grouping for the core metrics engine.

| Value        | Description                                          |
| ------------ | ---------------------------------------------------- |
| `quality`    | Enterprise quality scores and application health     |
| `performance`| Performance testing and system performance metrics   |
| `coverage`   | Test coverage, automation coverage metrics           |
| `compliance` | EQE compliance, governance adherence metrics         |
| `adoption`   | Platform adoption, usage, and value realization metrics |
