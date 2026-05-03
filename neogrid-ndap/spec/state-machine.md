# State Machine

Allowed transitions:
- IDLE -> PROPOSING
- PROPOSING -> PREVOTING
- PREVOTING -> PRECOMMITTING
- PRECOMMITTING -> FINALIZED
- any active phase -> VIEW_CHANGE
- VIEW_CHANGE -> PROPOSING / PREVOTING / IDLE

Disallowed transitions are any others.

Fork resolution on recovery:
- choose highest cumulative weight
- tie-break by lowest hash(stateRoot)
