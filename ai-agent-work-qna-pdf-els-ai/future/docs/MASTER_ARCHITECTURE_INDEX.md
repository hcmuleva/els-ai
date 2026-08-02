# Universal Learning Intelligence Platform

## Master Architecture Index

| Property | Value |
|---|---|
| Platform | Universal Learning Intelligence Platform (ULIP) |
| Status | Authoritative architecture baseline |
| Version | 1.0 |
| Baseline date | 2026-07-21 |
| Scope | Document intelligence, knowledge intelligence, retrieval, assessment, adaptive learning, and agentic workflows |

## 1. Purpose

This index is the navigation and governance entry point for the ULIP architecture. ULIP transforms PDF, EPUB, DOCX, PPT/PPTX, TXT, Markdown, and HTML into source-grounded knowledge repositories, knowledge graphs, semantic chunks, adaptive learning assets, competency models, assessment repositories, vector indexes, and retrieval-augmented generation services.

The documentation applies across Class 1-12, CBSE, ICSE, State Boards, JEE, NEET, UPSC, engineering, medical, commerce, arts, languages, computer science, life skills, DIY learning, creativity, and experiential learning. Domain-specific policy may strengthen these controls but must not weaken provenance, safety, tenant isolation, educational quality, or publication gates.

## 2. Document Authority

The documentation set has three complementary layers:

1. **Architecture documents** define system intent, boundaries, contracts, quality attributes, and operating models.
2. **Architecture Decision Records (ADRs)** capture accepted decisions, alternatives, consequences, and validation measures.
3. **Implementation epics** translate the architecture into testable outcomes, dependencies, deliverables, and definitions of done.

When documents appear inconsistent, the accepted ADR governs the decision, the architecture document governs the broader system context, and the epic must be corrected before implementation. Security, privacy, rights, child-safety, and source-grounding controls are mandatory cross-cutting constraints.

## 3. Architecture Documents

### 3.1 Foundation and content intelligence

| No. | Document | Architectural responsibility |
|---:|---|---|
| 01 | [System Vision](architecture/01_system_vision.md) | Product outcomes, scope, stakeholders, principles, trust model, and success measures |
| 02 | [Platform Architecture](architecture/02_platform_architecture.md) | Bounded contexts, control/content/learner planes, workflows, contracts, and system topology |
| 03 | [Document Intelligence](architecture/03_document_intelligence.md) | Multi-format parsing, OCR, canonical document model, integrity validation, and provenance |
| 04 | [Educational Ontology](architecture/04_educational_ontology.md) | Educational entity taxonomy, identifiers, semantic constraints, alignment, and lifecycle |
| 05 | [Knowledge Intelligence](architecture/05_knowledge_intelligence.md) | Concept extraction, normalization, evidence, confidence, validation, and publication |
| 06 | [Adaptive Chunking Engine](architecture/06_adaptive_chunking_engine.md) | Concept-complete chunk formation, context preservation, quality gates, and versioning |

### 3.2 Retrieval, graph, assessment, and learning intelligence

| No. | Document | Architectural responsibility |
|---:|---|---|
| 07 | [Contextual Retrieval](architecture/07_contextual_retrieval.md) | Query understanding, hybrid retrieval, reranking, policy filtering, and evaluation |
| 08 | [Multi-Resolution Chunks](architecture/08_multiresolution_chunks.md) | Atomic, concept, topic, chapter, and composite retrieval resolutions |
| 09 | [Knowledge Graph Architecture](architecture/09_knowledge_graph_architecture.md) | Typed nodes and edges, evidence, graph validation, traversal, and projection |
| 10 | [Assessment Intelligence](architecture/10_assessment_intelligence.md) | Assessment blueprints, suitability, psychometrics, review, and quality controls |
| 11 | [Competency Mapping](architecture/11_competency_mapping.md) | Concept-to-skill-to-competency alignment, evidence, proficiency, and standards mapping |
| 12 | [Learning Path Engine](architecture/12_learning_path_engine.md) | Prerequisite-aware sequencing, constraints, adaptation, explainability, and safety |

### 3.3 Persistence, RAG, agents, and generation

| No. | Document | Architectural responsibility |
|---:|---|---|
| 13 | [Vector Store Architecture](architecture/13_vector_store_architecture.md) | Vector projections, namespaces, model versions, indexing, consistency, and lifecycle |
| 14 | [Qdrant Design](architecture/14_qdrant_design.md) | Collections, payloads, filters, aliases, tenancy, scaling, backup, and migration |
| 15 | [Postgres Design](architecture/15_postgres_design.md) | Canonical relational model, integrity, row security, transactions, audit, and retention |
| 16 | [RAG Architecture](architecture/16_rag_architecture.md) | Grounded retrieval-generation flow, citations, abstention, evaluation, and guardrails |
| 17 | [Agentic Workflows](architecture/17_agentic_workflows.md) | Durable orchestration, bounded autonomy, approvals, tools, state, and recovery |
| 18 | [Question Generation](architecture/18_question_generation.md) | Blueprint-driven generation, distractors, solutions, validation, and publication |

### 3.4 Experience, quality, operations, and delivery

| No. | Document | Architectural responsibility |
|---:|---|---|
| 19 | [Adaptive Learning](architecture/19_adaptive_learning.md) | Learner models, mastery evidence, safe adaptation, recommendations, and explainability |
| 20 | [Testing Strategy](architecture/20_testing_strategy.md) | Test portfolio, AI evaluation, educational validation, release gates, and evidence |
| 21 | [Deployment Architecture](architecture/21_deployment_architecture.md) | Environments, regional topology, release patterns, capacity, resilience, and DR |
| 22 | [Security and Governance](architecture/22_security_and_governance.md) | STRIDE controls, privacy, rights, child safety, governance, retention, and audit |
| 23 | [Observability](architecture/23_observability.md) | Telemetry, SLOs, quality signals, lineage diagnostics, alerting, and runbooks |
| 24 | [Roadmap](architecture/24_roadmap.md) | Delivery phases, dependencies, measurable exit criteria, and release gates |

## 4. Architecture Decision Records

| ADR | Decision | Related architecture |
|---|---|---|
| [ADR-001: Document Parsing Strategy](adrs/ADR-001-document-parsing-strategy.md) | Use format adapters, a canonical document model, native extraction first, and selective OCR | [Document Intelligence](architecture/03_document_intelligence.md) |
| [ADR-002: Knowledge Graph Design](adrs/ADR-002-knowledge-graph-design.md) | Use an evidence-backed, typed, versioned graph projected from canonical records | [Knowledge Graph Architecture](architecture/09_knowledge_graph_architecture.md) |
| [ADR-003: Adaptive Chunking Strategy](adrs/ADR-003-adaptive-chunking-strategy.md) | Build concept-complete chunks before applying model packaging limits | [Adaptive Chunking Engine](architecture/06_adaptive_chunking_engine.md) |
| [ADR-004: Contextual Retrieval Strategy](adrs/ADR-004-contextual-retrieval-strategy.md) | Use policy-filtered hybrid retrieval, fusion, and reranking with evaluation gates | [Contextual Retrieval](architecture/07_contextual_retrieval.md) |
| [ADR-005: Multi-Resolution Retrieval](adrs/ADR-005-multi-resolution-retrieval.md) | Retrieve across linked semantic resolutions with explicit parent-child provenance | [Multi-Resolution Chunks](architecture/08_multiresolution_chunks.md) |
| [ADR-006: Qdrant Collection Design](adrs/ADR-006-qdrant-collection-design.md) | Use versioned Qdrant projections, payload filters, and alias-based promotion | [Qdrant Design](architecture/14_qdrant_design.md) |
| [ADR-007: Postgres Knowledge Model](adrs/ADR-007-postgres-knowledge-model.md) | Keep canonical identities, versions, lineage, governance, and graph facts in PostgreSQL | [Postgres Design](architecture/15_postgres_design.md) |
| [ADR-008: Assessment Intelligence Design](adrs/ADR-008-assessment-intelligence-design.md) | Use blueprint-driven, competency-aligned assessment assets with publication controls | [Assessment Intelligence](architecture/10_assessment_intelligence.md) |
| [ADR-009: Question Generation Architecture](adrs/ADR-009-question-generation-architecture.md) | Separate grounded generation, deterministic validation, review, and release | [Question Generation](architecture/18_question_generation.md) |
| [ADR-010: Agentic Workflow Architecture](adrs/ADR-010-agentic-workflow-architecture.md) | Use durable, policy-bounded workflows with typed state and human approval gates | [Agentic Workflows](architecture/17_agentic_workflows.md) |

## 5. Implementation Epics

| Epic | Document | Primary architecture | Governing ADRs |
|---:|---|---|---|
| 01 | [Document Intelligence](epics/epic-01-document-intelligence.md) | [03](architecture/03_document_intelligence.md) | [ADR-001](adrs/ADR-001-document-parsing-strategy.md) |
| 02 | [Knowledge Intelligence](epics/epic-02-knowledge-intelligence.md) | [04](architecture/04_educational_ontology.md), [05](architecture/05_knowledge_intelligence.md) | [ADR-002](adrs/ADR-002-knowledge-graph-design.md) |
| 03 | [Adaptive Chunking Engine](epics/epic-03-adaptive-chunking-engine.md) | [06](architecture/06_adaptive_chunking_engine.md), [08](architecture/08_multiresolution_chunks.md) | [ADR-003](adrs/ADR-003-adaptive-chunking-strategy.md), [ADR-005](adrs/ADR-005-multi-resolution-retrieval.md) |
| 04 | [Contextual Retrieval](epics/epic-04-contextual-retrieval.md) | [07](architecture/07_contextual_retrieval.md), [16](architecture/16_rag_architecture.md) | [ADR-004](adrs/ADR-004-contextual-retrieval-strategy.md), [ADR-005](adrs/ADR-005-multi-resolution-retrieval.md) |
| 05 | [Knowledge Graph](epics/epic-05-knowledge-graph.md) | [09](architecture/09_knowledge_graph_architecture.md) | [ADR-002](adrs/ADR-002-knowledge-graph-design.md) |
| 06 | [Vector Database Layer](epics/epic-06-vector-database-layer.md) | [13](architecture/13_vector_store_architecture.md), [14](architecture/14_qdrant_design.md), [15](architecture/15_postgres_design.md) | [ADR-006](adrs/ADR-006-qdrant-collection-design.md), [ADR-007](adrs/ADR-007-postgres-knowledge-model.md) |
| 07 | [Assessment Intelligence](epics/epic-07-assessment-intelligence.md) | [10](architecture/10_assessment_intelligence.md), [11](architecture/11_competency_mapping.md) | [ADR-008](adrs/ADR-008-assessment-intelligence-design.md) |
| 08 | [Question Generation](epics/epic-08-question-generation.md) | [18](architecture/18_question_generation.md) | [ADR-009](adrs/ADR-009-question-generation-architecture.md) |
| 09 | [Adaptive Learning](epics/epic-09-adaptive-learning.md) | [12](architecture/12_learning_path_engine.md), [19](architecture/19_adaptive_learning.md) | [ADR-008](adrs/ADR-008-assessment-intelligence-design.md) |
| 10 | [Agentic Learning Workflows](epics/epic-10-agentic-learning-workflows.md) | [17](architecture/17_agentic_workflows.md) | [ADR-010](adrs/ADR-010-agentic-workflow-architecture.md) |

Every epic is also governed by the cross-cutting requirements in [Testing Strategy](architecture/20_testing_strategy.md), [Deployment Architecture](architecture/21_deployment_architecture.md), [Security and Governance](architecture/22_security_and_governance.md), and [Observability](architecture/23_observability.md).

## 6. Recommended Reading Paths

### 6.1 Executive and product leadership

1. [System Vision](architecture/01_system_vision.md)
2. [Platform Architecture](architecture/02_platform_architecture.md)
3. [Security and Governance](architecture/22_security_and_governance.md)
4. [Roadmap](architecture/24_roadmap.md)

### 6.2 Content and knowledge engineering

1. [Document Intelligence](architecture/03_document_intelligence.md)
2. [Educational Ontology](architecture/04_educational_ontology.md)
3. [Knowledge Intelligence](architecture/05_knowledge_intelligence.md)
4. [Adaptive Chunking Engine](architecture/06_adaptive_chunking_engine.md)
5. [Knowledge Graph Architecture](architecture/09_knowledge_graph_architecture.md)
6. [ADR-001](adrs/ADR-001-document-parsing-strategy.md), [ADR-002](adrs/ADR-002-knowledge-graph-design.md), and [ADR-003](adrs/ADR-003-adaptive-chunking-strategy.md)

### 6.3 Search, RAG, and data platform engineering

1. [Contextual Retrieval](architecture/07_contextual_retrieval.md)
2. [Multi-Resolution Chunks](architecture/08_multiresolution_chunks.md)
3. [Vector Store Architecture](architecture/13_vector_store_architecture.md)
4. [Qdrant Design](architecture/14_qdrant_design.md)
5. [Postgres Design](architecture/15_postgres_design.md)
6. [RAG Architecture](architecture/16_rag_architecture.md)

### 6.4 Learning science and assessment

1. [Assessment Intelligence](architecture/10_assessment_intelligence.md)
2. [Competency Mapping](architecture/11_competency_mapping.md)
3. [Learning Path Engine](architecture/12_learning_path_engine.md)
4. [Question Generation](architecture/18_question_generation.md)
5. [Adaptive Learning](architecture/19_adaptive_learning.md)

### 6.5 Security, reliability, and operations

1. [Testing Strategy](architecture/20_testing_strategy.md)
2. [Deployment Architecture](architecture/21_deployment_architecture.md)
3. [Security and Governance](architecture/22_security_and_governance.md)
4. [Observability](architecture/23_observability.md)
5. [Agentic Workflows](architecture/17_agentic_workflows.md)

## 7. Documentation Workspace

| Directory | Purpose |
|---|---|
| `docs/architecture/` | Normative architecture and operating model |
| `docs/adrs/` | Accepted architecture decisions and consequences |
| `docs/epics/` | Implementation-ready outcome definitions |
| `docs/research/` | Evidence reviews, benchmarks, experiments, and vendor analysis |
| `docs/testing/` | Test plans, evaluation sets, quality reports, and release evidence |
| `docs/prompts/` | Versioned prompt specifications, safety constraints, and evaluation records |

Research, testing, and prompt artifacts become authoritative only when reviewed and linked from an architecture document, ADR, epic, or approved release record.

## 8. Change Governance

1. Architecture changes begin with impact analysis across data contracts, provenance, tenancy, safety, educational quality, operations, and migration.
2. A change that alters a recorded decision requires a new ADR that supersedes the prior ADR. Accepted ADR history is immutable.
3. Epics must cite the architecture and ADRs they implement, include measurable acceptance criteria, and satisfy the cross-cutting release gates.
4. Schema, ontology, graph, embedding, prompt, model, policy, and index changes are versioned. Production promotion uses compatibility tests, migration evidence, and rollback plans.
5. Documentation links, prohibited placeholders, structural completeness, and decision consistency are validated before merge.
6. Material changes require review from architecture, domain or learning science, security/privacy, data governance, and operations owners.

## 9. Platform-Wide Release Invariants

A ULIP capability is not production-ready unless:

- every served asset resolves to authorized source evidence and transformation lineage;
- tenant, rights, locale, audience, curriculum, and safety filters are enforced before retrieval and generation;
- uncertain mappings remain explicitly unrated, unmapped, quarantined, or review-required;
- canonical state and derived projections are versioned, reconcilable, idempotent, and recoverable;
- knowledge graph edges and generated assessments pass deterministic and expert-defined validation;
- retrieval and generation meet approved relevance, grounding, citation, safety, latency, and cost gates;
- learner adaptations are explainable, reversible, age-appropriate, and based on purpose-limited evidence;
- telemetry supports SLOs and diagnosis without exposing protected content or learner data;
- rollback, disaster recovery, deletion, rights revocation, and audit procedures have verified evidence.

These invariants apply to every implementation epic and cannot be waived by a component-level success metric.
