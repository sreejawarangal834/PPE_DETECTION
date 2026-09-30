# Common Integration Platform — Use Case (UC) Compatibility Checklist

This checklist defines the mandatory technical requirements and verification rules for integrating any Use Case (UC) microservice (e.g., **UC3: PPE Detection**) with the **Common Integration Platform**.

Use this document to perform contract audits, architectural compliance reviews, and pre-deployment verification.

---

## 📋 1. AlertEvent Contract Compliance

Every alert published by a UC microservice must strictly adhere to the unified platform `AlertEvent` schema.

- [ ] **Mandatory Schema Fields**: Verify that every published alert payload contains all required fields:
  - `alert_id` *(UUID string, unique per alert event)*
  - `camera_id` *(UUID string, referencing valid camera registry entry)*
  - `timestamp` *(ISO 8601 UTC timestamp string, e.g. `2026-09-27T11:46:46Z`)*
  - `severity` *(Enum: `low` | `medium` | `high` | `critical`)*
  - `alert_type` *(String, must match UC vocabulary spec)*
  - `title` *(String, brief human-readable title)*
  - `description` *(String, detailed breakdown of breach)*
  - `source_event_id` *(UUID/String, internal tracking identifier)*
  - `source_uc` *(Enum: `uc1` | `uc2` | `uc3` | `uc4` | etc.)*
  - `status` *(Enum: `new` | `ongoing` | `resolved`)*

- [ ] **Field Length Constraints**:
  - `title`: Maximum **128 characters**.
  - `description`: Maximum **512 characters** (or **1024 characters** max where expanded details are required). Must be truncated gracefully if exceeded.

- [ ] **Snapshot Co-dependency Rule ("Both-or-Neither")**:
  - `frame_reference` and `frame_provider` must exist **together or not at all**.
  - If a snapshot image is captured:
    - `frame_reference` MUST be set to the MinIO object key (e.g. `uc3/alerts/2026-09-27/alt_8f91a3b.jpg`).
    - `frame_provider` MUST be set to `minio` (or `redis` if cached in RAM).
  - If no snapshot image is available:
    - BOTH `frame_reference` and `frame_provider` MUST be `null` / omitted.
    - Setting one while leaving the other empty violates the contract.

---

## 📢 2. Alert Publishing Mechanism

- [ ] **Shared Client Wrapper Usage**:
  - All alert events **MUST** be published using the shared platform client library: `shared/platform_client/alert_publisher.py` (`AlertPublisher`).

- [ ] **No Direct Redis Stream Writes**:
  - Microservices **MUST NOT** perform raw `redis.xadd("alerts:live", ...)` calls directly in business logic.
  - Using `AlertPublisher` ensures uniform JSON serialization, schema validation, correlation ID propagation, and telemetry instrumentation.

---

## 🏷️ 3. Source UC Identifier Correctness (`source_uc`)

- [ ] **Self-Identification Accuracy**:
  - Microservices must configure and self-identify using their explicitly assigned identifier (`source_uc`).
  - Example assignments:
    - `uc1`: Perimeter Intrusion Detection
    - `uc2`: Fire & Smoke Detection
    - `uc3`: PPE Detection
    - `uc4`: Spill & Leak Detection

- [ ] **Collision & Spoofing Prevention**:
  - A UC service must never emit events under another UC's identifier (e.g. UC3 emitting `source_uc = "uc1"`).
  - Identifier must be set via environment variable (`SOURCE_UC=uc3`) and validated at startup.

---

## 📖 4. Alert Type Vocabulary Alignment

- [ ] **Spec-Compliant Vocabulary**:
  - `alert_type` values must strictly match the platform specification vocabulary for that specific UC. Inventing arbitrary strings (e.g., `no_helmet_found`, `person_without_vest`) is strictly prohibited.

- [ ] **UC3 (PPE Detection) Approved Vocabulary**:
  - `ppe_violation`: Triggered when required PPE gear (helmet, vest, gloves, etc.) is missing.
  - `ppe_compliance_failure`: Triggered when an active worker breaches mandatory zone rules.
  - `ppe_resolved`: Triggered when a previously failing worker becomes compliant.

- [ ] **Vocabulary Mapping Table**:

| UC | Spec-Approved `alert_type` Values | Prohibited / Invalid Examples |
|---|---|---|
| **UC1** | `perimeter_breach`, `loitering_detected`, `zone_intrusion` | `someone_entered`, `person_near_gate` |
| **UC2** | `smoke_detected`, `fire_detected`, `thermal_anomaly` | `fire_alert`, `smoke_alarm` |
| **UC3** | `ppe_violation`, `ppe_compliance_failure`, `ppe_resolved` | `no_helmet`, `missing_vest`, `bad_ppe` |
| **UC4** | `chemical_spill`, `liquid_leak` | `leakage`, `spill_warn` |

---

## 🔒 5. Ownership & Storage Boundary Isolation

- [ ] **Platform Database Isolation**:
  - UC microservices **MUST NOT** perform direct SQL writes (`INSERT`, `UPDATE`, `DELETE`) to platform-owned database tables (`cameras`, `alerts`, `users`, `tenants`, `zones`).
  - Platform data must be consumed read-only or synchronized via platform APIs/pub-sub events.

- [ ] **Redis Stream Boundary**:
  - Microservices must only write to their assigned outputs (via `AlertPublisher`) and read from authorized input streams (`frames:{camera_id}`).
  - Cross-UC stream modification or publishing to foreign UC streams is prohibited.

- [ ] **MinIO Snapshot Storage Prefix**:
  - All snapshot image artifacts written to MinIO **MUST** follow the strict key hierarchy template:
    `{uc}/alerts/{date}/{alert_id}.jpg`
  - Example for UC3: `uc3/alerts/2026-09-27/c8d2a1b9-3e4f-4a12-8910-111213141516.jpg`
  - Writing outside the `{uc}/` bucket prefix is an ownership violation.

---

## 📹 6. FrameEvent Consumption & Storage Protocols

- [ ] **Redis Consumer Group Protocol**:
  - Microservices consuming live video streams must register a dedicated Redis Consumer Group (`XGROUP CREATE`) for stream `frames:{camera_id}`.
  - Must consume frames using `XREADGROUP` with unique consumer names.

- [ ] **Message Acknowledgement (`XACK`)**:
  - Must issue an explicit `XACK` to Redis upon finishing inference on a frame.
  - Failure to `XACK` causes memory leaks and Pending Entries List (PEL) bloating.

- [ ] **Dual Frame Provider Support**:
  - Service must seamlessly handle both frame delivery methods:
    1. `frame_provider = "redis"`: Raw image bytes included directly in stream payload.
    2. `frame_provider = "minio"`: Stream payload contains object path; service fetches raw frame from MinIO bucket.

---

## 🩺 7. Observability Standards (`/health` & `/metrics`)

- [ ] **Health Endpoint (`GET /health`)**:
  - Must expose HTTP `GET /health` returning `200 OK` when healthy.
  - Response JSON body format:
    ```json
    {
      "status": "healthy",
      "service": "uc3-ppe-detection",
      "version": "1.0.0",
      "checks": {
        "redis": "connected",
        "model_loaded": true
      }
    }
    ```
  - Must return `503 Service Unavailable` if critical dependencies (Redis, ML Model weights) are unreachable.

- [ ] **Metrics Endpoint (`GET /metrics`)**:
  - Must expose HTTP `GET /metrics` in standard Prometheus text format.
  - Required metric primitives:
    - `http_requests_total{method, endpoint, status}`
    - `inference_latency_seconds` *(Histogram / Summary)*
    - `frames_processed_total{camera_id}`
    - `alerts_published_total{source_uc, alert_type, severity}`

---

## 📹 8. Camera Registry Integration

- [ ] **Dynamic Camera Discovery (No Hardcoding)**:
  - Microservices **MUST NOT** hardcode camera IDs, RTSP URLs, or stream names in code or static config files.
  - Active camera lists must be fetched dynamically from the Platform Camera Registry service on startup.

- [ ] **Dynamic Lifecycle Pub/Sub Sync**:
  - Must subscribe to Redis Pub/Sub channels:
    - `camera:added`: Dynamically launch inference loop / worker task for new camera.
    - `camera:updated`: Refresh stream configuration, ROI polygons, or detection rules.
    - `camera:removed`: Gracefully stop worker task and release stream resources.

---

## 🐳 9. Dependency & Environment Compatibility

- [ ] **Python Runtime & Base Images**:
  - Target Python runtime: **Python 3.10** or **Python 3.11**.
  - Docker base image must align with platform standard: `python:3.11-slim` (or official GPU base: `nvidia/cuda:11.8.0-runtime-ubuntu22.04`).

- [ ] **Package Conflict Prevention**:
  - Shared dependencies (`pydantic`, `redis`, `minio`, `fastapi`, `prometheus-client`) must match version constraints defined in platform `shared/requirements.txt`.
  - Avoid pinning incompatible major package versions.

- [ ] **Network & Port Allocation**:
  - Microservice default port must not conflict with assigned platform services:
    - `8000`: Common API Gateway / UC Backend
    - `8001`: UC1 Intrusion Service
    - `8002`: UC2 Fire/Smoke Service
    - `8003`: UC3 PPE Detection Service
    - `9090`: Prometheus
    - `6379`: Redis

---

## ⚡ 10. Alert Quality & Lifecycle Rules

- [ ] **Alert Deduplication & Cooldown (Sliding Window)**:
  - Service **MUST NOT** re-emit an alert on every single video frame (e.g. 30 times/sec) for an ongoing violation.
  - Must implement a time-weighted sliding window or cooldown hysteresis (e.g. re-emit after 30 seconds if still ongoing, or emit status=`ongoing`).

- [ ] **Honest & Calibrated Severity**:
  - Severity must reflect actual risk:
    - `low`: Minor non-critical breach (e.g. missing safety gloves in low-risk area).
    - `medium`: Standard violation (e.g. missing vest near machinery).
    - `high`: High-risk breach (e.g. missing hard hat in heavy drop zone).
    - `critical`: Severe multi-point breach or dangerous zone entry.

- [ ] **Resolved Event Emission (`status = "resolved"`)**:
  - When an ongoing violation clears (e.g., worker puts on helmet or exits zone), the service **MUST** emit a final `AlertEvent` with `status = "resolved"` to update platform alert state and close active incidents.

---

## 📊 Summary Compliance Checklist Matrix

| # | Compliance Requirement | Verification Check | Status |
|---|---|---|---|
| 1.1 | Required AlertEvent Fields | All 10 fields present in JSON schema | [ ] Pass / Fail |
| 1.2 | String Length Limits | Title ≤128 chars, Desc ≤512/1024 chars | [ ] Pass / Fail |
| 1.3 | Both-or-Neither Snapshot Rule | `frame_reference` & `frame_provider` coupled | [ ] Pass / Fail |
| 2.1 | Shared AlertPublisher Client | Uses `shared/platform_client/alert_publisher.py` | [ ] Pass / Fail |
| 2.2 | No Raw Stream Writes | Zero direct `redis.xadd("alerts:live")` calls | [ ] Pass / Fail |
| 3.1 | `source_uc` Identifier | Self-identifies as `uc1`/`uc2`/`uc3`/`uc4` | [ ] Pass / Fail |
| 4.1 | Vocabulary Spec Alignment | `alert_type` matches official spec values | [ ] Pass / Fail |
| 5.1 | Platform DB Isolation | No direct SQL writes to platform tables | [ ] Pass / Fail |
| 5.2 | Object Storage Prefix | MinIO path matches `{uc}/alerts/{date}/{id}.jpg` | [ ] Pass / Fail |
| 6.1 | Stream Consumption | Uses `XREADGROUP` on `frames:{camera_id}` | [ ] Pass / Fail |
| 6.2 | Stream Acknowledgement | Issues explicit `XACK` per processed frame | [ ] Pass / Fail |
| 6.3 | Dual Provider Support | Handles both `redis` and `minio` providers | [ ] Pass / Fail |
| 7.1 | Observability - `/health` | `GET /health` returns HTTP 200 JSON | [ ] Pass / Fail |
| 7.2 | Observability - `/metrics` | `GET /metrics` returns Prometheus format | [ ] Pass / Fail |
| 8.1 | Dynamic Camera Discovery | Camera list loaded from registry API/DB | [ ] Pass / Fail |
| 8.2 | Pub/Sub Camera Sync | Subscribes to `camera:added|updated|removed` | [ ] Pass / Fail |
| 9.1 | Dependency Compatibility | Matches Python 3.10/3.11 & shared dependencies | [ ] Pass / Fail |
| 9.2 | No Port Collisions | Assigned distinct port (e.g. 8003 for UC3) | [ ] Pass / Fail |
| 10.1| Alert Deduplication | Cooldown hysteresis prevents frame-spamming | [ ] Pass / Fail |
| 10.2| Resolution Event Emission | Emits `status="resolved"` when breach clears | [ ] Pass / Fail |

---
*Created for Common Integration Platform Compatibility Verification.*
