# Chat General Skill

**Agent**: chat_general_agent
**RouteId**: chat_general

## Purpose

Fallback agent for general conversational queries outside specific workflows.

## Inputs

- **query**: User message
- **routeId**: Must be `chat_general`

## Outputs

- **topic_summaries**: 1 general topic
  - general_inquiry
- **response**: Conversational reply

## Flow Steps

1. **topic_summaries**: Extract general inquiry context
2. **chat_response**: LLM-based conversational reply

## Determinism

- RouteId maps to minimal general topic
- Response is LLM-driven (non-deterministic by design)

## Example

```
Input: query="What documents do I need?", routeId=chat_general
Output: { response: "Please provide passport and proof of address..." }
```
