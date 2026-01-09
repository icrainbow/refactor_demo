# Agent Registry

**Phase 5.1**: Deterministic agent-based routing system.

## Purpose

The agent registry provides a centralized, type-safe mapping from routes to agents with explicit flow definitions. Each agent encapsulates:
- **RouteIds**: Which routes it handles (from `deriveFlow2RouteId`)
- **Flow**: Ordered execution steps (tools, skills, human gates)
- **Skills**: Optional skill file references for LLM prompting

## Architecture

```
Route Context (isFlow2, case3Active, etc.)
    ↓
deriveFlow2RouteId() → routeId
    ↓
resolveAgentByRouteId(routeId) → agent
    ↓
agent.flow.steps → execution plan
```

## How to Add a New Agent

### 1. Add Agent Definition to Registry

Edit `app/agents/registry.ts`:

```typescript
{
  id: 'my_new_agent',
  title: 'My New Agent',
  routeIds: ['my_new_route'],
  flow: {
    id: 'my_new_flow',
    routeId: 'my_new_route',
    steps: [
      { id: 'step1', kind: 'tool', ref: 'tool_name' },
      { id: 'step2', kind: 'skill', ref: 'skill_file' },
      { id: 'step3', kind: 'human', ref: 'HITL', optional: true },
    ],
  },
  skills: ['my_new_agent.skill.md'],
}
```

### 2. Add Skill File (Optional)

Create `app/agents/skills/my_new_agent.skill.md`:

```markdown
# My New Agent Skill

## Inputs
- Document content
- Context variables

## Outputs
- Analysis results
- Recommendations

## Determinism
Must use routeId for consistent behavior.
```

### 3. Add Contract Test

Edit `tests/unit/routeToAgent.contract.test.ts`:

```typescript
it('should resolve my_new_route to my_new_agent', () => {
  const agent = resolveAgentByRouteId('my_new_route');
  expect(agent.id).toBe('my_new_agent');
  expect(agent.flow.routeId).toBe('my_new_route');
});
```

## Current Agents

| Agent ID | Route IDs | Purpose |
|----------|-----------|---------|
| `kyc_agent` | `kyc_review` | KYC document review + risk triage |
| `case2_agent` | `case2_review` | Case2 CS integration workflow |
| `it_agent` | `it_review` | IT bulletin impact analysis |
| `guardrail_agent` | `guardrail_check` | Guardrail alert detection + resolution |
| `chat_general_agent` | `chat_general` | General chat fallback |

## Design Principles

1. **Deterministic**: Same routeId always resolves to same agent
2. **Fail-fast**: Unknown routeId throws immediately with helpful error
3. **Type-safe**: AgentId is a string union, not any string
4. **Extensible**: Add new agents without touching existing code
5. **Testable**: Contract tests verify route → agent mappings

## Integration Point

The registry is integrated at topic resolution time:

```typescript
const ctx = buildDeriveContext({ isFlow2, case3Active, case4Active, case2Active });
const routeId = deriveFlow2RouteId(ctx);
const agent = resolveAgentByRouteId(routeId);
const topicIds = resolveTopicSet(routeId).topic_ids;
```

Agent flow steps are not yet executed - this is just routing infrastructure for Phase 5.2+.

## Files

```
app/agents/
├── types.ts              # Type definitions
├── registry.ts           # Agent registry + resolution
├── README.md            # This file
└── skills/              # Skill markdown files
    ├── kyc_review.skill.md
    ├── case2_review.skill.md
    ├── it_review.skill.md
    ├── guardrail_check.skill.md
    └── chat_general.skill.md
```

## Next Steps (Future Phases)

- **Phase 5.2**: Flow executor (run agent.flow.steps)
- **Phase 5.3**: Skill loader + LLM integration
- **Phase 5.4**: Human-in-the-loop step handlers
- **Phase 5.5**: Agent observability + logging
