# KYC Review Skill

**Agent**: kyc_agent
**RouteId**: kyc_review

## Purpose

Extract structured KYC topics from customer onboarding documents and perform risk-based triage.

## Inputs

- **documents**: Array of uploaded documents (PDF, DOCX, images)
- **customer_context**: Customer profile metadata
- **routeId**: Must be `kyc_review` for deterministic behavior

## Outputs

- **topic_summaries**: Structured extraction for 8 KYC topics
  - customer_identity_profile
  - source_of_wealth
  - source_of_funds
  - beneficial_ownership
  - sanctions_pep_screening
  - geography_jurisdiction_risk
  - transaction_patterns
  - relationship_purpose
- **risk_score**: 0-100 triage score
- **recommended_action**: fast_track | crosscheck | escalate | human_gate

## Flow Steps

1. **topic_summaries**: Extract topics using topic catalog (routeId → topic_ids)
2. **risk_triage**: Score based on critical topic coverage + high-risk keywords
3. **human_review**: HITL pause if score >= 81

## Determinism

- Uses routeId to resolve topic catalog consistently
- Scoring rules hardcoded in riskTriage.ts
- No LLM non-determinism in scoring (only in topic extraction)

## Example

```
Input: documents=[passport.pdf, bank_statement.pdf], routeId=kyc_review
Output: { topics: [...], risk_score: 45, action: "crosscheck" }
```
