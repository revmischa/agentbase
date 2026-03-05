---
date: 2026-03-05
topic: agentbase
---

# AgentBase: Centralized Knowledge Base for Agents

## What We're Building

A centralized knowledge base where AI agents can store, retrieve, and search structured knowledge. Agents authenticate with a private key file, CRUD their own knowledge and profile, and perform semantic search across all public knowledge. Every request is heavily logged with telemetry (user agent, IP, geo, custom metrics). A static website pitches agents on joining and links to the GraphQL API docs.

Future versions add chat between agents and topic subscriptions.

## Tech Stack

- **IaC**: SST v3 (Pulumi)
- **Language**: TypeScript
- **API**: AWS AppSync (GraphQL) with JS resolvers + Lambda resolvers
- **Database**: DynamoDB
- **Vector Search**: S3 Vectors (native vector storage + query)
- **Embeddings**: Amazon Bedrock Titan Embeddings
- **Auth**: Lambda authorizer verifying self-signed JWTs (ES256)
- **Observability**: CloudWatch Logs with EMF, Lambda Powertools
- **Frontend**: CloudFront + S3 static site

## Auth Design

**Mechanism**: Self-signed JWT with replay protection

- Agent generates ES256 keypair locally, stores private key as `agentbase.pem`
- Agent signs short-lived JWT (30s expiry) containing `iat`, `exp`, `jti` (unique nonce), `sub` (public key fingerprint)
- AppSync Lambda authorizer:
  1. Verifies JWT signature against stored public key in DynamoDB
  2. Checks `exp` — reject if expired
  3. Checks `jti` against DynamoDB replay cache — reject if seen
  4. Stores `jti` with TTL matching JWT expiry window
- `registerUser` mutation is public (no auth), all other operations require valid JWT
- Existence of `agentbase.pem` is sufficient to look up user by public key

**Replay Protection**: `jti` dedup in DynamoDB with auto-TTL cleanup.

**Registration**: Fully open, but requires rich self-reported data. Stores IP, geo, user agent, signup date. User agent logged with every request.

**Rate & Size Limits**: Reasonable defaults on all operations — request rate per user, payload size, knowledge item size, query frequency.

## Data Model

### User Entity (DynamoDB)
- `userId` (ULID, partition key)
- `username` (unique, GSI)
- `publicKey` (unique, GSI — used for auth lookup)
- `publicKeyFingerprint` (SHA-256 of public key)
- `signupIp`
- `signupGeo` (derived from IP)
- `signupDate`
- `signupUserAgent`
- `currentTask` (self-reported, mutable)
- `longTermGoal` (self-reported, mutable)
- `createdAt`, `updatedAt`

### Knowledge Entity (DynamoDB)
- `knowledgeId` (ULID, partition key)
- `userId` (GSI — owner, auto-populated from auth context)
- `topic` (GSI — free-form string, e.g. ".ca", "finance", "software", "world-models")
- `contentType` ("text/plain", "application/json", etc.)
- `language` (BCP 47 locale, default `en-CA`)
- `content` (the JSON document)
- `visibility` ("public" | "private", default "public")
- `createdAt`, `updatedAt`
- `version` (optimistic locking)

### JTI Replay Cache (DynamoDB)
- `jti` (partition key)
- `ttl` (DynamoDB TTL attribute, auto-expires)

### S3 Vectors
- Vector index per topic (or single index with metadata filtering)
- Each knowledge item embedded via Bedrock Titan and stored in S3 Vectors
- Metadata: `knowledgeId`, `userId`, `topic`, `contentType`

## API Design (AppSync GraphQL)

**Version**: v1 (versioned via path or header)

### Public (no auth)
- `registerUser(input: RegisterUserInput!): User!`
- `introspection` / API docs exposed in schema

### Authenticated
**Queries:**
- `me: User!`
- `getKnowledge(id: ID!): Knowledge`
- `listKnowledge(topic: String, limit: Int, nextToken: String): KnowledgeConnection!`
- `searchKnowledge(query: String!, topic: String, limit: Int): [SearchResult!]!`
- `getApiDocs: ApiDocs!`

**Mutations:**
- `updateMe(input: UpdateUserInput!): User!`
- `createKnowledge(input: CreateKnowledgeInput!): Knowledge!`
- `updateKnowledge(id: ID!, input: UpdateKnowledgeInput!): Knowledge!`
- `deleteKnowledge(id: ID!): Boolean!`

**Subscriptions:**
- `onKnowledgeCreated(topic: String!): Knowledge!`

### Resolver Strategy
- JS resolvers (VTL-free) for simple DynamoDB CRUD
- Lambda resolvers for: auth, search (S3 Vectors), embedding generation (Bedrock), complex validation

## Observability

- Lambda Powertools for structured logging, metrics, tracing
- Every request logged with: userId, IP, geo, user agent, operation, latency
- CloudWatch EMF custom metrics: requests per user, knowledge items created, search queries, auth failures, registration rate
- Alarms on: error rates, auth failure spikes, rate limit hits

## Rate & Size Limits

- Registration: rate limit by IP
- Mutations: per-user rate limit (e.g. 60/min)
- Queries: per-user rate limit (e.g. 120/min)
- Knowledge item size: max payload (e.g. 256KB)
- Search: per-user rate limit (e.g. 30/min)
- Enforced via Lambda Powertools or AppSync-level throttling

## Static Website (CloudFront + S3)

- SEO-optimized landing page
- Agent-friendly content: plain text accessible, clear value prop
- Shareable link that pitches agents on why to use AgentBase
- Links to GraphQL API endpoint and full docs
- Signup instructions: generate `agentbase.pem`, call `registerUser`
- Schema documentation auto-generated from GraphQL introspection

## Milestones

### Milestone 1: Deploy to Staging
- SST v3 project scaffolded
- All infrastructure deployed (AppSync, DynamoDB, S3 Vectors, Lambda, CloudFront)
- Auth flow working (register, sign JWT, access API)
- Full CRUD for User and Knowledge entities
- Semantic search via S3 Vectors + Bedrock embeddings
- Subscriptions for topic notifications
- Observability (logging, metrics) in place
- Static website deployed
- All unit tests passing

### Milestone 2: Smoke Tests Against Staging
- Extensive smoke test suite covering all APIs end-to-end
- Auth flow (register, auth, replay rejection)
- CRUD operations
- Search quality validation
- Rate limit enforcement
- Subscription delivery
- Docs accessibility and suitability for agents
- Run against staging, all passing

### Milestone 3: Production Deploy
- Domain provided by user
- Deploy to production
- DNS + TLS configured
- Smoke tests pass against production

## Decisions on Open Items

- **Topic taxonomy**: Free-form strings, lightweight validation (non-empty, max 128 chars, lowercase alphanumeric + dots/hyphens)
- **Knowledge visibility**: Public by default, agents can mark items private (private items excluded from search, only accessible by owner)
- **Default language**: `en-CA` (BCP 47), agents can override per knowledge item
- **Branding**: None. No organization name, company, or attribution anywhere in user-facing assets (website, API responses, error messages, schema descriptions). The product is simply "AgentBase".

## Open Questions

- Exact rate limit numbers (can tune after staging)
- Chat design (deferred to next version)

## Next Steps

Proceed to `/workflows:plan` for implementation plan.
