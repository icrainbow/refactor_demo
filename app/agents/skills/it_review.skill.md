# IT Bulletin Review Skill

**Agent**: it_agent
**RouteId**: it_review

## Purpose

Analyze IT infrastructure bulletins for impact assessment.

## Inputs

- **documents**: IT bulletin documents
- **routeId**: Must be `it_review`

## Outputs

- **topic_summaries**: 5 IT-specific topics
  - system_components_identifiers
  - regions_environments_scope
  - change_details_what_changed
  - timeline_execution_windows
  - actions_required_followups
- **impact_score**: Infrastructure impact assessment

## Flow Steps

1. **topic_summaries**: Extract IT topics
2. **impact_analysis**: Assess system impact
3. **validation** (optional): Cross-system validation

## Determinism

- RouteId determines IT topic catalog
- Impact scoring rules hardcoded

## Example

```
Input: documents=[bulletin_2024.pdf], routeId=it_review
Output: { topics: [...], impact_score: "medium" }
```
