# High-Level Backend Architecture

Outlines a scalable backend architecture for the
infringement detection pipeline for **hundreds of clients**.

## Goals

- Multiple client isolation
- Reliable long-lived and -running execution for scan
- Controlled concurrency
- Persisted and reviewable results
- Real-time progress updates during scanning

---

## Top-level Summary

Scaling this pipeline to hundreds of clients will involve:
- Moving scans into durable background jobs
- Isolating clients via configuration, quotas, and rate limits
- Persisting client input, scan state, and results
- Using workers and pub/sub instead of a single server process for high throughput

The core scoring logic is roughly the same; however, the surrounding
infrastructure would enable scale and reliability.

## 1. RESTFUL API Layer

- Handles AuthZ, AuthN, and isolating clients
- Exposes endpoints to:
  - Manage client config. (brands, keywords, thresholds, names, images, etc.)
  - Trigger scans and other new actons
  - Query scan status and results
- Stateless and horizontally scalable

---

## 2. Client Config

Each client maintains its own configuration, including:
- Brand names, knwon common fraud, misspellings, etc.
- Reference product images provided by the customer
- Search keywords and categories
- Scoring weightage attributed and thresholds (text/image/bonus scoring)
- Scheduled runs (manual, daily, weekly)

---

## 3. Job Orchestration

Scans are executed asynchronously using a job orchestrator that will:
- Break a scan into background tasks (corres. to search, image hashing, scoring)
- Handle retries, timeouts and partial failures
- Allow scans to run for several minutes without impeding the API

---

## 4. Workers

Workers perform the pipeline steps:

- **Search workers**
  - Call ScraperAPI to retrieve Amazon (or other providers) listings
- **Image workers**
  - Fetch listing images
  - Compute perceptual hashes (aHash in this case but can expand to others)
- **Scoring workers**
  - Combine text similarity and image similarity
  - Produce a final infringement probability score

Workers should be:
- Horizontally scalable
- Rate-limited per client and per external provider
- Idempotent and safe to retry

---

## 5. Data Storage

### Relational Database
Stores (postgres):
- Client info
- Users
- Client configs
- Scan runs, state, statuses
- Retrieved listings and corresponding metadata

### Object Storage
Stores (s3):
- Reference brand images
- Evidence snapshots for review
- Other non-changing objects

---

## 6. Streaming Progress & Results

- Workers emit progress and result events to a pub/sub system
- A streaming gateway forwards updates to clients via SSE (or possibly Websockets)
- Scan states is persisted so clients can reconnect without losing progress

---

## 7. Multi-Client Controls

- All data and jobs are scoped by client id
- Per-client limits on:
  - Concurrent scans
  - Requests to external providers
  - Daily or monthly usage
- Prevents any single client from impacting other clients throughout the system

---

## 8. Scheduling & Automation

- Clients can run scans manually or on a configred schedule
- A scheduler triggers scan jobs based on client configuration

---

