# Flow2 Prompts Bundle

## Metadata
- **version**: "1.0"
- **schema**: "prompts_bundle_v1"
- **schema_validation**: "warn-only" (non-deterministic LLM outputs)
- **last_updated**: "2025-01-07"
- **owner**: "AI Team"
- **approver**: "AI Lead + Risk (sign-off)"

---

## prompt_id: topic_summaries

### Role
You are a {{prompt_role}} summarizing information from multiple documents.

### Instructions
{{prompt_instructions}}

### Critical Rules
1. You MUST output exactly {{topic_count}} topic summaries (one per topic_id listed below)
2. For EACH topic, determine:
   - coverage: "PRESENT" (clearly addressed), "WEAK" (partially/vaguely mentioned), or "MISSING" (not found)
   - bullets: Up to {{max_bullets}} bullet points summarizing WHAT THE DOCUMENTS SAY (not risk assessment)
   - evidence: Up to {{max_evidence}} short verbatim quotes from the documents (max 150 chars each) with doc_id attribution
     * If a document contains "IMAGE_EVIDENCE: <url>", extract the URL and include it in the evidence object as "image_url"
3. If a topic is not addressed in ANY document, return coverage="MISSING" with bullets=["This topic is not addressed in the provided documents."]
4. Your summaries must be CONTENT SUMMARIES (what the documents say), NOT risk judgments
5. Aggregate information across ALL documents for each topic (don't treat them separately)
6. Output ONLY valid JSON (no markdown wrapper, no extra text)

### Required Topics
{{topics_list}}

### Documents to Analyze
{{documents_text}}

### Output Format (JSON ONLY)
```json
[
  {
    "topic_id": "{{topic_id_example}}",
    "coverage": "PRESENT" | "WEAK" | "MISSING",
    "bullets": ["bullet 1", "bullet 2", ...],
    "evidence": [
      {"quote": "verbatim snippet max 150 chars", "doc_id": "doc-123", "image_url": "optional-url-if-found"},
      ...
    ]
  },
  ...
]
```

Output the JSON array now (all {{topic_count}} topics):

---

### Variables Schema

```yaml
prompt_role:
  type: string
  source: "config.prompt_role"
  example: "compliance analyst"

prompt_instructions:
  type: string
  source: "config.prompt_instructions"
  example: "Extract KYC-related information from uploaded documents"

topic_count:
  type: integer
  source: "config.topic_ids.length"
  example: 8

max_bullets:
  type: integer
  source: "config.max_bullets"
  example: 5

max_evidence:
  type: integer
  source: "config.max_evidence"
  example: 3

topics_list:
  type: string
  source: "Formatted from config.topic_ids + config.topic_titles"
  example: "1. **customer_identity_profile** (Customer Identity & Verification)\n2. **source_of_wealth** (Source of Wealth & Income)\n..."

documents_text:
  type: string
  source: "Concatenated from documents array"
  example: "### Document 1: client_profile.txt (ID: doc-123)\n\n[content]...\n\n---\n\n### Document 2: ..."

topic_id_example:
  type: string
  source: "Placeholder for output schema documentation"
  example: "customer_identity_profile"
```

### Output Schema Validation

```yaml
type: array
min_length: topic_count
items:
  type: object
  required: [topic_id, coverage, bullets, evidence]
  properties:
    topic_id:
      type: string
      enum: config.topic_ids
    coverage:
      type: string
      enum: [PRESENT, WEAK, MISSING]
    bullets:
      type: array
      items: {type: string}
    evidence:
      type: array
      items:
        type: object
        required: [quote, doc_id]
        properties:
          quote: {type: string, max_length: 150}
          doc_id: {type: string}
          image_url: {type: string, format: uri, optional: true}
```
