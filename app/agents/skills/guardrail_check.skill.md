# Guardrail Check Skill

**Agent**: guardrail_agent
**RouteId**: guardrail_check

## Purpose

Detect and handle guardrail alerts that block review workflows.

## Inputs

- **context**: Current workflow state
- **routeId**: Must be `guardrail_check`

## Outputs

- **topic_summaries**: 2 guardrail topics
  - system_alert
  - risk_flag
- **alert_severity**: critical | high | medium
- **blocking**: true | false

## Flow Steps

1. **alert_detection**: Detect guardrail trigger
2. **human_resolution**: Force human review to unblock

## Determinism

- RouteId maps to minimal guardrail topics
- Alert detection rules hardcoded in detectGuardrailIssue.ts

## Example

```
Input: context={blocked_doc_id: "123"}, routeId=guardrail_check
Output: { alert: "high_risk_jurisdiction", blocking: true }
```
