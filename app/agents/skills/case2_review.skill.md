# Case2 CS Integration Review Skill

**Agent**: case2_agent
**RouteId**: case2_review

## Purpose

Handle Case2 CS integration workflow for legacy client migration.

## Inputs

- **documents**: Case2-specific documents
- **case2_context**: CS system metadata
- **routeId**: Must be `case2_review`

## Outputs

- **topic_summaries**: 6 Case2-specific topics
  - client_profile_legacy_context
  - jurisdiction_crossborder_constraints
  - risk_appetite_alignment
  - edd_triggers_red_flags
  - required_evidence_data_gaps
  - recommended_approval_path_governance
- **approval_path**: Governance workflow recommendation

## Flow Steps

1. **topic_summaries**: Extract Case2 topics
2. **cs_integration**: Legacy system crosscheck
3. **approval_path**: Route to governance (human gate)

## Determinism

- RouteId determines topic catalog subset
- CS integration logic hardcoded

## Example

```
Input: documents=[legacy_file.pdf], routeId=case2_review
Output: { topics: [...], approval_path: "governance_review" }
```
