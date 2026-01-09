# Case Trigger Guard Enhancement

## Issue
Previously, chat commands could trigger new cases (Case2, IT Impact) when documents were already uploaded but review hadn't started yet. This was incorrect behavior.

## Fix Location
**File**: `app/document/page.tsx`  
**Function**: `handleFlow2ChatSubmit`  
**Lines**: ~3925-4000

## New Logic

### Blocking Conditions
Case triggers (Case2, IT Impact, etc.) are now **BLOCKED** when:

1. **Review actively in progress**:
   - `flowMonitorStatus === 'running'`
   - `flowMonitorStatus === 'waiting_human'`
   - `flowMonitorStatus === 'resuming'`
   - `isOrchestrating === true`

2. **Documents uploaded but review not finished**:
   - `flow2Documents.length > 0` AND
   - Review is NOT in a final completed/rejected state

### Allowed Conditions
Case triggers are **ALLOWED** only when:

1. **Brand new page** (right after reset):
   - `flow2Documents.length === 0`
   - `flowMonitorStatus === 'idle'`
   - `flowMonitorMetadata === null`

2. **Review fully finished**:
   - `flowMonitorStatus === 'completed'` OR `flowMonitorStatus === 'rejected'`
   - `flowMonitorMetadata !== null` (proves review actually ran)

## Code Logic

```typescript
const isReviewInProgress = 
  flowMonitorStatus === 'running' || 
  flowMonitorStatus === 'waiting_human' || 
  flowMonitorStatus === 'resuming' ||
  isOrchestrating;

const hasDocumentsUploaded = flow2Documents.length > 0;

const isReviewFullyFinished = 
  (flowMonitorStatus === 'completed' || flowMonitorStatus === 'rejected') &&
  flowMonitorMetadata !== null;

const shouldBlockCaseTriggers = 
  isReviewInProgress || 
  (hasDocumentsUploaded && !isReviewFullyFinished);
```

## Test Scenarios

### ✅ Scenario 1: Brand New Page
```
State:
- flow2Documents.length = 0
- flowMonitorStatus = 'idle'
- flowMonitorMetadata = null

Action: Type Case2 trigger in chat
Result: ✅ ALLOWED - Case2 starts
```

### ❌ Scenario 2: Documents Uploaded, Review Not Started
```
State:
- flow2Documents.length = 3
- flowMonitorStatus = 'idle'
- flowMonitorMetadata = null

Action: Type Case2 trigger in chat
Result: ❌ BLOCKED
Message: "Documents are uploaded and ready for review. 
          Please start the current review first, or reset 
          the workspace to start a new case."
```

### ❌ Scenario 3: Review Running
```
State:
- flow2Documents.length = 3
- flowMonitorStatus = 'running'
- isOrchestrating = true

Action: Type Case2 trigger in chat
Result: ❌ BLOCKED
Message: "A review is currently in progress."
```

### ❌ Scenario 4: Review Waiting for Approval
```
State:
- flow2Documents.length = 3
- flowMonitorStatus = 'waiting_human'
- flowMonitorMetadata = {...}

Action: Type Case2 trigger in chat
Result: ❌ BLOCKED
Message: "A review is currently in progress."
```

### ✅ Scenario 5: Review Completed
```
State:
- flow2Documents.length = 3
- flowMonitorStatus = 'completed'
- flowMonitorMetadata = {...} (not null)

Action: Type Case2 trigger in chat
Result: ✅ ALLOWED - Can start new case
Note: User should click "Finish & Download" to reset first,
      but system allows starting new case over old data
```

### ✅ Scenario 6: Review Rejected (Final State)
```
State:
- flow2Documents.length = 3
- flowMonitorStatus = 'rejected'
- flowMonitorMetadata = {...}

Action: Type Case2 trigger in chat
Result: ✅ ALLOWED - Can start new case
```

### ✅ Scenario 7: After Reset
```
State:
- User clicked "Finish & Download Reports"
- Page reloaded to /document?flow=2
- flow2Documents.length = 0
- flowMonitorStatus = 'idle'
- flowMonitorMetadata = null

Action: Type Case2 trigger in chat
Result: ✅ ALLOWED - Fresh workspace
```

## Error Messages

### When Documents Uploaded But Review Not Started
```
⚠️ Cannot Start New Case

Documents are uploaded and ready for review. Please start 
the current review first, or reset the workspace to start 
a new case.

Current status: idle
Documents uploaded: 3

Options:
• Complete the current review process
• Click "Finish & Download Reports" when done
• Then you can start a new case
```

### When Review In Progress
```
⚠️ Cannot Start New Case

A review is currently in progress.

Current status: running
Documents uploaded: 3

Options:
• Complete the current review process
• Click "Finish & Download Reports" when done
• Then you can start a new case
```

## Impact

- **Guards enhanced**: Now blocks case triggers when docs uploaded but review idle
- **User experience**: Clearer error messages explaining current state
- **Demo freeze**: Minimal change, no architecture refactoring
- **Backward compatible**: Existing completed/rejected reviews can still trigger new cases

## Verification

Check console logs:
```
[Chat Guard] shouldBlockCaseTriggers: true {
  flowMonitorStatus: 'idle',
  isOrchestrating: false,
  hasDocumentsUploaded: true,
  isReviewFullyFinished: false,
  flow2DocumentsCount: 3
}
```



