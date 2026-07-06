# EQIP — API Contract

The single source of truth for the HTTP interface between the Vite+React frontend and
the FastAPI backend. Both tiers MUST read this file before generating any API call or
route handler. All enum values referenced below are defined in `contract/enums.md`.

---

## 1. Global Conventions

### 1.1 Base Path

All **business** routes live under `/api/v1`. Health/liveness routes are the sole
exception (see §3.2).

```
VITE_API_URL  →  defaults to '' (empty string, same-origin)
Frontend base →  `${VITE_API_URL}/api/v1`
```

The `VITE_API_URL` env var is the **origin only** (no `/api` suffix). The `/api/v1`
prefix is added by the request-path builder. In dev the Vite proxy forwards `/api` to
the backend; in prod CloudFront→ALB routes `/api*` to the backend container.

### 1.2 Trailing Slashes

**No trailing slash on any endpoint.** Backend routes are declared with empty-string
collection paths (`@router.get("")`) so the canonical URL has no trailing slash.
The frontend never appends a trailing slash.

### 1.3 Authentication

| Item              | Value                                      |
| ----------------- | ------------------------------------------ |
| Scheme            | `Authorization: Bearer <access_token>`     |
| Token format      | Signed JWT (HS256), issued by the backend  |
| Storage key (FE)  | `localStorage.getItem('authToken')`        |
| Refresh mechanism | `POST /api/v1/auth/refresh` with refresh token |

Public (no-auth) endpoints: `POST /api/v1/auth/login`, `GET /api/health`,
`GET /api/health/ready`.

All other endpoints require a valid Bearer token. A missing or invalid token returns
`401`. Insufficient permissions return `403`.

### 1.4 Pagination (List Endpoints)

Every list endpoint returns a **wrapper object**, never a bare array:

```jsonc
{
  "items": [],        // T[] — the page of results
  "total": 0,         // number — total matching records
  "page": 1,          // number — current page (1-based)
  "page_size": 20     // number — items per page
}
```

| Parameter   | Query key    | Type   | Default | Min | Max |
| ----------- | ------------ | ------ | ------- | --- | --- |
| Page number | `page`       | int    | 1       | 1   | —   |
| Page size   | `page_size`  | int    | 20      | 1   | 100 |

The backend enforces `page_size ≤ 100`. A request exceeding the cap returns `422`.
The frontend MUST NOT request a `page_size` greater than 100.

### 1.5 Sorting

List endpoints accept optional sorting parameters:

| Parameter | Query key | Type   | Default          |
| --------- | --------- | ------ | ---------------- |
| Sort field | `sort`   | string | endpoint-specific |
| Sort order | `order`  | string | `desc`           |

Valid `order` values: `asc`, `desc`.

### 1.6 Error Format (RFC 7807)

All error responses use the RFC 7807 Problem Details shape:

```jsonc
{
  "type": "https://eqip.example.com/errors/<error-type>",
  "title": "Human-readable summary",
  "status": 400,       // HTTP status code (number)
  "detail": "Specific explanation of what went wrong."
}
```

Standard status codes used:

| Code | Meaning                                |
| ---- | -------------------------------------- |
| 400  | Bad request / malformed input          |
| 401  | Missing or invalid authentication      |
| 403  | Authenticated but insufficient permissions |
| 404  | Resource not found                     |
| 409  | Conflict (duplicate, version mismatch) |
| 413  | Payload too large (evidence uploads)   |
| 422  | Validation error (field-level details) |
| 429  | Rate limit exceeded / circuit breaker open |
| 500  | Internal server error                  |
| 503  | Service unavailable (AI degraded)      |

### 1.7 Common Field Types

| Field pattern     | Type              | Format / Notes                    |
| ----------------- | ----------------- | --------------------------------- |
| `*_id`, `id`      | `string`          | UUID v4                           |
| `*_at` timestamps | `string`          | ISO 8601 UTC (`2024-06-01T12:00:00Z`) |
| Scores            | `number`          | Float 0–100                       |
| Enums             | `string`          | Exact values from `enums.md`      |
| Booleans          | `boolean`         |                                   |
| Lists             | `T[]`             |                                   |

### 1.8 Audit Fields (on all mutable entities)

Every entity includes:

```jsonc
{
  "created_by": "string",   // user id
  "created_at": "string",   // ISO 8601
  "updated_by": "string",   // user id
  "updated_at": "string",   // ISO 8601
  "version": 1              // number — optimistic concurrency
}
```

---

## 2. Shared Response Types

### 2.1 UserSummary

Embedded in auth responses and user listings:

```jsonc
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": "RoleEnum",
  "permissions": ["string"],
  "segment_ids": ["string"],
  "application_ids": ["string"],
  "status": "UserStatus",
  "avatar_url": "string | null",
  "last_login": "string | null"
}
```

### 2.2 PaginatedResponse\<T\>

```jsonc
{
  "items": "T[]",
  "total": "number",
  "page": "number",
  "page_size": "number"
}
```

---

## 3. Endpoint Reference

### 3.1 Auth — `/api/v1/auth`

#### POST `/api/v1/auth/login`

> **Auth required:** No

Login with email/password (demo/dev) or SSO token.

**Request body:**

```jsonc
{
  "email": "string",
  "password": "string"
}
```

**Response `200`:**

```jsonc
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 1800,          // number — seconds until access_token expires
  "user": "UserSummary"
}
```

**Error `401`:** Invalid credentials.

---

#### POST `/api/v1/auth/logout`

> **Auth required:** Yes

Invalidate the current session/token.

**Request body:**

```jsonc
{
  "refresh_token": "string"
}
```

**Response `204`:** No content.

---

#### POST `/api/v1/auth/refresh`

> **Auth required:** No (uses refresh token)

Exchange a valid refresh token for a new access token.

**Request body:**

```jsonc
{
  "refresh_token": "string"
}
```

**Response `200`:**

```jsonc
{
  "access_token": "string",
  "refresh_token": "string",
  "expires_in": 1800
}
```

**Error `401`:** Invalid or expired refresh token.

---

### 3.2 Health — `/api/health` (NOT under `/api/v1`)

#### GET `/api/health`

> **Auth required:** No

Liveness probe. No DB or external dependency.

**Response `200`:**

```jsonc
{
  "status": "ok"
}
```

---

#### GET `/api/health/ready`

> **Auth required:** No

Readiness probe. Checks DB and cache connectivity.

**Response `200`:**

```jsonc
{
  "status": "ok",
  "database": "connected",
  "cache": "connected"
}
```

**Response `503`:** One or more dependencies unhealthy.

---

### 3.3 Users — `/api/v1/users`

#### GET `/api/v1/users`

> **Auth required:** Yes — `admin` role

List users with pagination and optional filters.

**Query parameters:**

| Key       | Type   | Required | Description                  |
| --------- | ------ | -------- | ---------------------------- |
| `page`    | int    | No       | Page number (default 1)      |
| `page_size` | int  | No       | Items per page (default 20, max 100) |
| `status`  | string | No       | Filter by `UserStatus`       |
| `role`    | string | No       | Filter by `RoleEnum`         |
| `search`  | string | No       | Full-text search on name/email |

**Response `200`:** `PaginatedResponse<UserSummary>`

---

#### GET `/api/v1/users/{id}`

> **Auth required:** Yes

Get a single user by ID.

**Response `200`:**

```jsonc
{
  "id": "string",
  "name": "string",
  "email": "string",
  "role": "RoleEnum",
  "permissions": ["string"],
  "segment_ids": ["string"],
  "application_ids": ["string"],
  "status": "UserStatus",
  "avatar_url": "string | null",
  "last_login": "string | null",
  "auth_source": "string",
  "vendor": false,
  "manager": "string | null",
  "created_by": "string",
  "created_at": "string",
  "updated_by": "string",
  "updated_at": "string",
  "version": 1
}
```

**Error `404`:** User not found.

---

#### POST `/api/v1/users`

> **Auth required:** Yes — `admin` role

Create a new user.

**Request body:**

```jsonc
{
  "name": "string",
  "email": "string",
  "role": "RoleEnum",
  "segment_ids": ["string"],
  "application_ids": ["string"],
  "status": "UserStatus",          // optional, default "active"
  "vendor": false,                 // optional, default false
  "manager": "string | null",     // optional
  "password": "string"            // required for local auth
}
```

**Response `201`:** Full user object (same shape as GET `/users/{id}`).

**Error `409`:** Duplicate email.

---

#### PUT `/api/v1/users/{id}`

> **Auth required:** Yes — `admin` role

Update an existing user.

**Request body:** Same fields as POST (all optional for partial update). Include
`version` for optimistic concurrency.

**Response `200`:** Updated user object.

**Error `404`:** User not found.
**Error `409`:** Version conflict.

---

### 3.4 Roles — `/api/v1/roles`

#### GET `/api/v1/roles`

> **Auth required:** Yes

List all roles with their permissions.

**Response `200`:**

```jsonc
[
  {
    "id": "string",
    "name": "RoleEnum",
    "description": "string",
    "permissions": ["string"],
    "scope": {
      "segments": ["string"],
      "applications": ["string"]
    },
    "created_by": "string",
    "created_at": "string",
    "updated_by": "string",
    "updated_at": "string",
    "version": 1
  }
]
```

> Note: Roles are a small, bounded set — returned as a plain array, not paginated.

---

#### POST `/api/v1/roles`

> **Auth required:** Yes — `admin` role

Create a new role.

**Request body:**

```jsonc
{
  "name": "string",
  "description": "string",
  "permissions": ["string"],
  "scope": {
    "segments": ["string"],
    "applications": ["string"]
  }
}
```

**Response `201`:** Full role object.

**Error `409`:** Duplicate role name.

---

#### PUT `/api/v1/roles/{id}`

> **Auth required:** Yes — `admin` role

Update an existing role.

**Request body:** Same fields as POST (all optional). Include `version`.

**Response `200`:** Updated role object.

**Error `404`:** Role not found.
**Error `409`:** Version conflict.

---

### 3.5 Permissions — `/api/v1/permissions`

#### GET `/api/v1/permissions`

> **Auth required:** Yes

List all available permission types.

**Response `200`:**

```jsonc
[
  {
    "id": "string",
    "name": "string",
    "description": "string"
  }
]
```

> Note: Permissions are a small, bounded set — returned as a plain array, not paginated.

---

### 3.6 Audit Logs — `/api/v1/audit-logs`

#### GET `/api/v1/audit-logs`

> **Auth required:** Yes

List audit log entries with pagination and filters. Read-only — no create/update/delete.

**Query parameters:**

| Key         | Type   | Required | Description                          |
| ----------- | ------ | -------- | ------------------------------------ |
| `page`      | int    | No       | Page number (default 1)              |
| `page_size` | int    | No       | Items per page (default 20, max 100) |
| `user_id`   | string | No       | Filter by acting user                |
| `action`    | string | No       | Filter by action type                |
| `from_date` | string | No       | ISO 8601 start date                  |
| `to_date`   | string | No       | ISO 8601 end date                    |
| `entity_type` | string | No     | Filter by entity type                |
| `entity_id` | string | No       | Filter by entity ID                  |

**Response `200`:** `PaginatedResponse<AuditLogEntry>`

```jsonc
// AuditLogEntry
{
  "id": "string",
  "timestamp": "string",
  "user_id": "string",
  "user_name": "string",
  "action": "string",
  "entity_type": "string",
  "entity_id": "string",
  "before": {},            // object | null — previous state
  "after": {},             // object | null — new state
  "ip_address": "string"
}
```

---

### 3.7 Test Cases — `/api/v1/test-cases`

#### GET `/api/v1/test-cases`

> **Auth required:** Yes

List test cases with pagination and filters.

**Query parameters:**

| Key                 | Type   | Required | Description                          |
| ------------------- | ------ | -------- | ------------------------------------ |
| `page`              | int    | No       | Page number (default 1)              |
| `page_size`         | int    | No       | Items per page (default 20, max 100) |
| `status`            | string | No       | Filter by `TestCaseStatus`           |
| `priority`          | string | No       | Filter by `Priority`                 |
| `automation_status` | string | No       | Filter by `AutomationStatus`         |
| `application_id`    | string | No       | Filter by application                |
| `owner`             | string | No       | Filter by owner user ID              |
| `search`            | string | No       | Full-text search on name/tags        |
| `sort`              | string | No       | Sort field (default `updated_at`)    |
| `order`             | string | No       | `asc` or `desc` (default `desc`)     |

**Response `200`:** `PaginatedResponse<TestCaseSummary>`

```jsonc
// TestCaseSummary
{
  "id": "string",
  "name": "string",
  "type": "string",
  "application_id": "string",
  "segment_id": "string",
  "owner": "string",
  "priority": "Priority",
  "status": "TestCaseStatus",
  "automation_status": "AutomationStatus",
  "framework": "string | null",
  "tags": ["string"],
  "last_execution_date": "string | null",
  "last_execution_result": "ExecutionStatus | null",
  "created_at": "string",
  "updated_at": "string"
}
```

---

#### GET `/api/v1/test-cases/{id}`

> **Auth required:** Yes

Get full test case details.

**Response `200`:**

```jsonc
{
  "id": "string",
  "name": "string",
  "type": "string",
  "application_id": "string",
  "segment_id": "string",
  "owner": "string",
  "priority": "Priority",
  "status": "TestCaseStatus",
  "automation_status": "AutomationStatus",
  "framework": "string | null",
  "version_label": "string",
  "linked_requirement": "string | null",
  "linked_release": "string | null",
  "tags": ["string"],
  "evidence_requirements": ["string"],
  "description": "string | null",
  "steps": [
    {
      "step_number": 1,
      "action": "string",
      "expected_result": "string"
    }
  ],
  "last_execution_date": "string | null",
  "last_execution_result": "ExecutionStatus | null",
  "created_by": "string",
  "created_at": "string",
  "updated_by": "string",
  "updated_at": "string",
  "version": 1
}
```

**Error `404`:** Test case not found.

---

#### POST `/api/v1/test-cases`

> **Auth required:** Yes

Create a new test case.

**Request body:**

```jsonc
{
  "name": "string",
  "type": "string",
  "application_id": "string",
  "segment_id": "string",
  "owner": "string",
  "priority": "Priority",
  "status": "TestCaseStatus",             // optional, default "draft"
  "automation_status": "AutomationStatus", // optional, default "manual"
  "framework": "string | null",
  "version_label": "string",              // optional, default "1.0"
  "linked_requirement": "string | null",
  "linked_release": "string | null",
  "tags": ["string"],
  "evidence_requirements": ["string"],
  "description": "string | null",
  "steps": [
    {
      "step_number": 1,
      "action": "string",
      "expected_result": "string"
    }
  ]
}
```

**Response `201`:** Full test case object.

---

#### PUT `/api/v1/test-cases/{id}`

> **Auth required:** Yes

Update an existing test case.

**Request body:** Same fields as POST (all optional). Include `version` for optimistic
concurrency.

**Response `200`:** Updated test case object.

**Error `404`:** Test case not found.
**Error `409`:** Version conflict.

---

#### POST `/api/v1/test-cases/{id}/clone`

> **Auth required:** Yes

Clone an existing test case. Creates a new test case with a new ID, copying all fields
from the source. The clone starts in `draft` status.

**Request body:**

```jsonc
{
  "name": "string"    // optional — override the cloned name
}
```

**Response `201`:** Full test case object (the new clone).

**Error `404`:** Source test case not found.

---

### 3.8 Test Suites — `/api/v1/test-suites`

#### GET `/api/v1/test-suites`

> **Auth required:** Yes

List test suites with pagination.

**Query parameters:**

| Key             | Type   | Required | Description                          |
| --------------- | ------ | -------- | ------------------------------------ |
| `page`          | int    | No       | Page number (default 1)              |
| `page_size`     | int    | No       | Items per page (default 20, max 100) |
| `application_id`| string | No       | Filter by application                |
| `search`        | string | No       | Full-text search on name             |

**Response `200`:** `PaginatedResponse<TestSuiteSummary>`

```jsonc
// TestSuiteSummary
{
  "id": "string",
  "name": "string",
  "application_id": "string",
  "segment_id": "string",
  "owner": "string",
  "test_case_count": 0,
  "automation_coverage": 0.0,
  "last_execution_result": "ExecutionStatus | null",
  "pass_rate": 0.0,
  "created_at": "string",
  "updated_at": "string"
}
```

---

#### POST `/api/v1/test-suites`

> **Auth required:** Yes

Create a new test suite.

**Request body:**

```jsonc
{
  "name": "string",
  "application_id": "string",
  "segment_id": "string",
  "owner": "string",
  "test_case_ids": ["string"],
  "description": "string | null",
  "execution_frequency": "string | null",
  "environment_requirements": ["string"],
  "test_data_requirements": ["string"]
}
```

**Response `201`:** Full test suite object.

---

#### PUT `/api/v1/test-suites/{id}`

> **Auth required:** Yes

Update an existing test suite.

**Request body:** Same fields as POST (all optional). Include `version`.

**Response `200`:** Updated test suite object.

**Error `404`:** Test suite not found.
**Error `409`:** Version conflict.

---

### 3.9 Test Executions — `/api/v1/test-executions`

#### GET `/api/v1/test-executions`

> **Auth required:** Yes

List test executions with pagination and filters.

**Query parameters:**

| Key              | Type   | Required | Description                          |
| ---------------- | ------ | -------- | ------------------------------------ |
| `page`           | int    | No       | Page number (default 1)              |
| `page_size`      | int    | No       | Items per page (default 20, max 100) |
| `status`         | string | No       | Filter by `ExecutionStatus`          |
| `application_id` | string | No       | Filter by application                |
| `release_id`     | string | No       | Filter by release                    |
| `test_suite_id`  | string | No       | Filter by test suite                 |
| `from_date`      | string | No       | ISO 8601 start date                  |
| `to_date`        | string | No       | ISO 8601 end date                    |
| `sort`           | string | No       | Sort field (default `start_time`)    |
| `order`          | string | No       | `asc` or `desc` (default `desc`)     |

**Response `200`:** `PaginatedResponse<TestExecutionSummary>`

```jsonc
// TestExecutionSummary
{
  "id": "string",
  "test_suite_id": "string",
  "test_suite_name": "string",
  "application_id": "string",
  "release_id": "string | null",
  "environment_id": "string",
  "trigger_type": "string",
  "start_time": "string",
  "end_time": "string | null",
  "duration": 0,                  // number — seconds
  "status": "ExecutionStatus",
  "executed_by": "string",
  "pass_count": 0,
  "fail_count": 0,
  "total_count": 0,
  "created_at": "string"
}
```

---

#### GET `/api/v1/test-executions/{id}`

> **Auth required:** Yes

Get full test execution details.

**Response `200`:**

```jsonc
{
  "id": "string",
  "test_suite_id": "string",
  "test_suite_name": "string",
  "application_id": "string",
  "release_id": "string | null",
  "environment_id": "string",
  "trigger_type": "string",
  "start_time": "string",
  "end_time": "string | null",
  "duration": 0,
  "status": "ExecutionStatus",
  "executed_by": "string",
  "pipeline_reference": "string | null",
  "build_number": "string | null",
  "commit_id": "string | null",
  "logs_url": "string | null",
  "screenshots_url": ["string"],
  "video_url": "string | null",
  "defects_created": ["string"],
  "failure_reason": "string | null",
  "ai_failure_analysis": "string | null",
  "recommended_remediation": "string | null",
  "pass_count": 0,
  "fail_count": 0,
  "blocked_count": 0,
  "skipped_count": 0,
  "total_count": 0,
  "evidence_ids": ["string"],
  "created_by": "string",
  "created_at": "string",
  "updated_by": "string",
  "updated_at": "string",
  "version": 1
}
```

**Error `404`:** Test execution not found.

---

#### POST `/api/v1/test-executions`

> **Auth required:** Yes

Create (start) a new test execution.

**Request body:**

```jsonc
{
  "test_suite_id": "string",
  "application_id": "string",
  "release_id": "string | null",
  "environment_id": "string",
  "trigger_type": "string"
}
```

**Response `201`:** Full test execution object (status defaults to `pending`).

---

#### PUT `/api/v1/test-executions/{id}`

> **Auth required:** Yes

Update a test execution (status transitions, results, evidence links).

**Request body:** Partial update fields. Include `version`.

```jsonc
{
  "status": "ExecutionStatus",
  "end_time": "string | null",
  "failure_reason": "string | null",
  "defects_created": ["string"],
  "pass_count": 0,
  "fail_count": 0,
  "blocked_count": 0,
  "skipped_count": 0,
  "version": 1
}
```

**Response `200`:** Updated test execution object.

**Error `404`:** Test execution not found.
**Error `409`:** Version conflict.

---

### 3.10 Releases — `/api/v1/releases`

#### GET `/api/v1/releases/{id}/readiness`

> **Auth required:** Yes

Get computed release readiness data.

**Response `200`:**

```jsonc
{
  "release_id": "string",
  "release_name": "string",
  "application_id": "string",
  "overall_readiness_score": 0.0,
  "quality_gate_status": "QualityGateResult",
  "test_completion_percent": 0.0,
  "automation_execution_percent": 0.0,
  "open_critical_defects": 0,
  "risk_rating": "Priority",
  "recommendation": "string",
  "computed_at": "string"
}
```

**Error `404`:** Release not found.

---

#### GET `/api/v1/releases/{id}/gate-results`

> **Auth required:** Yes

Get quality gate results for a release.

**Response `200`:**

```jsonc
{
  "release_id": "string",
  "gates": [
    {
      "gate_id": "string",
      "gate_name": "string",
      "result": "QualityGateResult",
      "threshold": 0,
      "actual_value": 0,
      "evaluated_at": "string",
      "waiver_justification": "string | null",
      "waiver_approved_by": "string | null"
    }
  ],
  "overall_result": "QualityGateResult",
  "computed_at": "string"
}
```

**Error `404`:** Release not found.

---

#### PUT `/api/v1/releases/{id}/gate-results`

> **Auth required:** Yes — `release_manager` or `admin` role

Update quality gate results (e.g., waive a gate).

**Request body:**

```jsonc
{
  "gates": [
    {
      "gate_id": "string",
      "result": "QualityGateResult",
      "waiver_justification": "string | null"
    }
  ]
}
```

**Response `200`:** Updated gate results object.

**Error `404`:** Release not found.

---

### 3.11 Quality Gates — `/api/v1/quality-gates`

#### GET `/api/v1/quality-gates`

> **Auth required:** Yes

List all quality gate definitions.

**Response `200`:**

```jsonc
[
  {
    "id": "string",
    "name": "string",
    "description": "string",
    "applicability": {
      "tier": [1, 2, 3],
      "release_type": ["string"]
    },
    "threshold": 0,
    "status": "GovernanceStatus",
    "owner": "string",
    "created_at": "string",
    "updated_at": "string"
  }
]
```

> Note: Quality gates are a bounded set — returned as a plain array, not paginated.

---

### 3.12 Governance Procedures — `/api/v1/governance-procedures`

#### GET `/api/v1/governance-procedures`

> **Auth required:** Yes

List governance procedures with pagination.

**Query parameters:**

| Key         | Type   | Required | Description                          |
| ----------- | ------ | -------- | ------------------------------------ |
| `page`      | int    | No       | Page number (default 1)              |
| `page_size` | int    | No       | Items per page (default 20, max 100) |
| `status`    | string | No       | Filter by `GovernanceStatus`         |
| `search`    | string | No       | Full-text search on name/description |

**Response `200`:** `PaginatedResponse<GovernanceProcedureSummary>`

```jsonc
// GovernanceProcedureSummary
{
  "id": "string",
  "name": "string",
  "description": "string",
  "status": "GovernanceStatus",
  "owner": "string",
  "applicability": {
    "tier": [1, 2, 3],
    "release_type": ["string"]
  },
  "required_evidence": ["EvidenceType"],
  "compliance_rule": "string",
  "created_at": "string",
  "updated_at": "string"
}
```

---

#### GET `/api/v1/governance-procedures/{id}`

> **Auth required:** Yes

Get full governance procedure details.

**Response `200`:**

```jsonc
{
  "id": "string",
  "name": "string",
  "description": "string",
  "status": "GovernanceStatus",
  "owner": "string",
  "applicability": {
    "tier": [1, 2, 3],
    "release_type": ["string"]
  },
  "required_evidence": ["EvidenceType"],
  "required_approval": ["string"],
  "applicable_test_types": ["string"],
  "compliance_rule": "string",
  "audit_history": [
    {
      "timestamp": "string",
      "user_id": "string",
      "action": "string",
      "changes": {}
    }
  ],
  "created_by": "string",
  "created_at": "string",
  "updated_by": "string",
  "updated_at": "string",
  "version": 1
}
```

**Error `404`:** Governance procedure not found.

---

#### POST `/api/v1/governance-procedures`

> **Auth required:** Yes

Create a new governance procedure.

**Request body:**

```jsonc
{
  "name": "string",
  "description": "string",
  "status": "GovernanceStatus",            // optional, default "draft"
  "applicability": {
    "tier": [1, 2, 3],
    "release_type": ["string"]
  },
  "required_evidence": ["EvidenceType"],
  "required_approval": ["string"],
  "applicable_test_types": ["string"],
  "compliance_rule": "string",
  "owner": "string"
}
```

**Response `201`:** Full governance procedure object.

---

#### PUT `/api/v1/governance-procedures/{id}`

> **Auth required:** Yes

Update an existing governance procedure.

**Request body:** Same fields as POST (all optional). Include `version`.

**Response `200`:** Updated governance procedure object.

**Error `404`:** Governance procedure not found.
**Error `409`:** Version conflict.

---

### 3.13 Evidence — `/api/v1/evidence`

#### POST `/api/v1/evidence`

> **Auth required:** Yes

Upload evidence file (multipart form data).

**Request (multipart/form-data):**

| Field                | Type   | Required | Description                          |
| -------------------- | ------ | -------- | ------------------------------------ |
| `file`               | binary | Yes      | The evidence file                    |
| `test_execution_id`  | string | Yes      | Associated test execution            |
| `evidence_type`      | string | Yes      | `EvidenceType` enum value            |
| `description`        | string | No       | Optional description                 |

**File size limits:**

| Evidence type | Max size |
| ------------- | -------- |
| `log`         | 50 MB    |
| `screenshot`  | 10 MB    |
| `video`       | 500 MB   |
| `document`    | 50 MB    |
| `report`      | 50 MB    |

**Response `201`:**

```jsonc
{
  "id": "string",
  "test_execution_id": "string",
  "evidence_type": "EvidenceType",
  "file_name": "string",
  "file_size": 0,
  "file_url": "string",
  "description": "string | null",
  "uploaded_by": "string",
  "uploaded_at": "string"
}
```

**Error `413`:** File exceeds size limit.

---

#### GET `/api/v1/evidence/{id}/download`

> **Auth required:** Yes

Download an evidence file. Returns the binary file with appropriate `Content-Type` and
`Content-Disposition` headers.

**Response `200`:** Binary file stream.

**Error `404`:** Evidence not found.

---

### 3.14 Integrations — `/api/v1/integrations`

#### GET `/api/v1/integrations`

> **Auth required:** Yes

List integrations with pagination.

**Query parameters:**

| Key         | Type   | Required | Description                          |
| ----------- | ------ | -------- | ------------------------------------ |
| `page`      | int    | No       | Page number (default 1)              |
| `page_size` | int    | No       | Items per page (default 20, max 100) |
| `status`    | string | No       | Filter by `IntegrationStatus`        |

**Response `200`:** `PaginatedResponse<IntegrationSummary>`

```jsonc
// IntegrationSummary
{
  "id": "string",
  "name": "string",
  "system_type": "string",
  "owner": "string",
  "connection_status": "IntegrationStatus",
  "last_sync": "string | null",
  "sync_frequency": "string",
  "error_count": 0,
  "authentication_method": "string",
  "data_objects_synced": ["string"],
  "created_at": "string",
  "updated_at": "string"
}
```

---

#### POST `/api/v1/integrations`

> **Auth required:** Yes

Create a new integration configuration.

**Request body:**

```jsonc
{
  "name": "string",
  "system_type": "string",
  "owner": "string",
  "sync_frequency": "string",
  "authentication_method": "string",
  "connection_config": {},          // object — connection-specific config
  "data_objects_synced": ["string"],
  "retry_rules": {
    "max_retries": 3,
    "backoff": 2
  }
}
```

**Response `201`:** Full integration object.

---

#### PUT `/api/v1/integrations/{id}`

> **Auth required:** Yes

Update an existing integration.

**Request body:** Same fields as POST (all optional). Include `version`.

**Response `200`:** Updated integration object.

**Error `404`:** Integration not found.
**Error `409`:** Version conflict.

---

#### POST `/api/v1/integrations/{id}/sync`

> **Auth required:** Yes

Trigger a manual sync for an integration.

**Request body:**

```jsonc
{
  "sync_type": "string"    // "full" or "incremental"
}
```

**Response `202`:**

```jsonc
{
  "integration_id": "string",
  "status": "sync_started",
  "timestamp": "string"
}
```

**Error `404`:** Integration not found.
**Error `429`:** Circuit breaker open — too many recent failures.

---

### 3.15 Metrics — `/api/v1/metrics`

#### GET `/api/v1/metrics/{category}`

> **Auth required:** Yes

Get metrics for a given category.

**Path parameters:**

| Key        | Type   | Description                    |
| ---------- | ------ | ------------------------------ |
| `category` | string | `MetricCategory` enum value    |

**Query parameters:**

| Key              | Type   | Required | Description                |
| ---------------- | ------ | -------- | -------------------------- |
| `application_id` | string | No       | Filter by application      |
| `segment_id`     | string | No       | Filter by segment          |
| `release_id`     | string | No       | Filter by release          |
| `from_date`      | string | No       | ISO 8601 start date        |
| `to_date`        | string | No       | ISO 8601 end date          |

**Response `200`:**

```jsonc
{
  "category": "MetricCategory",
  "metrics": [
    {
      "metric_name": "string",
      "value": 0.0,
      "trend": [0.0],           // number[] — historical values
      "inputs": {},             // object — calculation inputs
      "computed_at": "string"
    }
  ],
  "filters_applied": {},
  "cached": false
}
```

---

### 3.16 AI — `/api/v1/ai`

#### POST `/api/v1/ai/search`

> **Auth required:** Yes

Natural language search across platform data.

**Request body:**

```jsonc
{
  "query": "string",
  "filters": {
    "application_id": "string | null",
    "segment_id": "string | null"
  },
  "limit": 20                  // optional, max 100
}
```

**Response `200`:**

```jsonc
{
  "results": [
    {
      "entity_type": "string",
      "entity_id": "string",
      "title": "string",
      "snippet": "string",
      "relevance_score": 0.0
    }
  ],
  "total": 0,
  "cached": false,
  "timestamp": "string"
}
```

**Error `503`:** AI service unavailable (cached results may be returned with a
`cached: true` flag).

---

#### POST `/api/v1/ai/ask`

> **Auth required:** Yes

Conversational AI assistant — ask EQIP a quality-related question.

**Request body:**

```jsonc
{
  "question": "string",        // max 500 characters
  "filters": {
    "application_id": "string | null",
    "segment_id": "string | null"
  }
}
```

**Response `200`:**

```jsonc
{
  "answer": "string",
  "confidence": 0.0,           // 0.0–1.0
  "data_sources": ["string"],
  "cached": false,
  "timestamp": "string"
}
```

**Error `503`:** AI service unavailable.

---

#### POST `/api/v1/ai/predictions/{type}`

> **Auth required:** Yes

Get AI-powered predictions.

**Path parameters:**

| Key    | Type   | Description                                                    |
| ------ | ------ | -------------------------------------------------------------- |
| `type` | string | Prediction type: `release_risk`, `defect_escape`, `regression`, `coverage_gap`, `flaky_test` |

**Request body:**

```jsonc
{
  "entity_id": "string",       // release_id, application_id, etc.
  "filters": {}
}
```

**Response `200`:**

```jsonc
{
  "prediction_type": "string",
  "entity_id": "string",
  "risk_score": 0.0,
  "confidence": 0.0,
  "factors": [
    {
      "factor": "string",
      "impact": "string",
      "value": "string"
    }
  ],
  "recommendations": ["string"],
  "data_sources": ["string"],
  "cached": false,
  "timestamp": "string"
}
```

**Error `503`:** AI service unavailable.

---

### 3.17 Reports — `/api/v1/reports`

#### GET `/api/v1/reports/{type}`

> **Auth required:** Yes

Get report data for a given report type.

**Path parameters:**

| Key    | Type   | Description                  |
| ------ | ------ | ---------------------------- |
| `type` | string | `ReportType` enum value      |

**Query parameters:**

| Key              | Type   | Required | Description                |
| ---------------- | ------ | -------- | -------------------------- |
| `application_id` | string | No       | Filter by application      |
| `segment_id`     | string | No       | Filter by segment          |
| `release_id`     | string | No       | Filter by release          |
| `from_date`      | string | No       | ISO 8601 start date        |
| `to_date`        | string | No       | ISO 8601 end date          |

**Response `200`:**

```jsonc
{
  "report_type": "ReportType",
  "title": "string",
  "generated_at": "string",
  "filters_applied": {},
  "sections": [
    {
      "title": "string",
      "data": {},
      "charts": [
        {
          "chart_type": "string",
          "title": "string",
          "data": []
        }
      ]
    }
  ],
  "summary": "string"
}
```

---

#### POST `/api/v1/reports/{type}/export`

> **Auth required:** Yes — requires `export` permission

Export a report to a file format.

**Request body:**

```jsonc
{
  "format": "string",          // "xlsx", "csv", "pdf", "pptx"
  "filters": {
    "application_id": "string | null",
    "segment_id": "string | null",
    "release_id": "string | null",
    "from_date": "string | null",
    "to_date": "string | null"
  }
}
```

**Response `202`:**

```jsonc
{
  "export_id": "string",
  "status": "processing",
  "report_type": "ReportType",
  "format": "string",
  "estimated_completion": "string"
}
```

> The export runs asynchronously. Poll or receive a notification when complete.

---

### 3.18 Adoption & Impact — `/api/v1/adoption-impact`

#### GET `/api/v1/adoption-impact`

> **Auth required:** Yes

Get adoption and impact metrics.

**Query parameters:**

| Key         | Type   | Required | Description                |
| ----------- | ------ | -------- | -------------------------- |
| `from_date` | string | No       | ISO 8601 start date        |
| `to_date`   | string | No       | ISO 8601 end date          |

**Response `200`:**

```jsonc
{
  "active_users": 0,
  "active_users_trend": [0],
  "segment_adoption_percent": 0.0,
  "application_adoption_percent": 0.0,
  "feature_usage": {
    "test_repository": 0,
    "test_execution": 0,
    "ai_insights": 0,
    "reporting": 0,
    "governance": 0
  },
  "execution_volume": 0,
  "execution_volume_trend": [0],
  "automation_growth": 0,
  "ai_copilot_usage": 0,
  "ai_generated_tests": 0,
  "ai_recommendation_adoption_percent": 0.0,
  "manual_effort_reduction_hours": 0.0,
  "testing_cycle_time_improvement_percent": 0.0,
  "defect_reduction_percent": 0.0,
  "cost_avoidance_dollars": 0.0,
  "productivity_gain_percent": 0.0,
  "business_value_score": 0.0,
  "computed_at": "string"
}
```

---

## 4. Rate Limiting

| Tier             | Limit              |
| ---------------- | ------------------ |
| Standard user    | 100 requests/min   |
| Export endpoints  | 10 requests/min    |
| Service accounts | 1,000 requests/min |

Rate limit exceeded returns `429` with RFC 7807 body and `Retry-After` header.

---

## 5. Frontend Integration Notes

1. **API base URL:** `const BASE_URL = import.meta.env.VITE_API_URL ?? '';`
   Path builder: `` `${BASE_URL}/api/v1${path}` ``
2. **Token storage:** `localStorage.getItem('authToken')` / `localStorage.setItem('authToken', token)`
3. **Auth header:** `Authorization: Bearer ${token}` on every non-public request.
4. **Global 401 handler:** Intercept 401 responses, clear token, redirect to `/login` —
   but **exclude** auth endpoints (`/auth/login`, `/auth/refresh`) from this interceptor
   so a failed login shows an inline error, not a redirect.
5. **List state default:** Always initialize list state to `[]` and guard with
   `items?.length` / `items?.map(...)` so a shape mismatch degrades to empty state.
6. **Page size:** Never request `page_size > 100`.
7. **Dev proxy (Vite):** `server.proxy['/api'] → { target: 'http://localhost:8000' }` —
   the proxy target is the backend's actual listen port, never bundled into production.
