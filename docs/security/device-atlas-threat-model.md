# Device Atlas threat model

- Review status: Required gate before any live bridge or device command
- Scope: Google Home companion, Govee, selected local discovery, identity reconciliation, monitoring, and automation drafts

| Threat | Sprint 1 control |
| --- | --- |
| Inventory without consent | Every observation records a source-specific consent scope; fixture UI explains independent grants. |
| Broad LAN surveillance | Companion manifest omits broad LAN/location permissions; discovery is off and the model permits selected services. |
| Credential guessing or unsafe probing | Explicit non-goal; no port scanner, login attempt, or credential field exists. |
| Wrong-device merge | Only strong identifiers merge. Same name, address, or service instance alone remains separate. |
| Provider object leakage | Only versioned provider-neutral observations cross into Orbit Core. |
| Malicious companion or bridge replay | Future messages require an authenticated session, exact-received-byte signature verification, runtime schema and field/byte bounds, five-minute freshness, monotonic sequence, and record cap. No ingest route exists yet. |
| Path score grants authority | Scores rank already-consented candidates only; absence of consent prevents preferred-path selection. |
| Hidden monitoring | Event-first plans are visible; polling is bounded to 15 minutes while active; otherwise refresh is manual. |
| Automation executes from a draft | Draft state and `requiredApproval: true` are structural. Sprint 1 exposes no activation or execution endpoint. |
| Sensitive network identifiers persist | The normalized identity union and bridge schema prohibit network endpoints; discovery adapters must discard endpoints before normalization. |
| Camera or microphone access | Android manifest requests neither. Camera video remains isolated to the existing explicit Nest flow. |
| Secret committed to source | No Google Home registration data, Govee API key, token, local bridge key, or personal fixture is present. |

## Live stop conditions

Stop qualification if the companion asks for undeclared broad permissions, exposes SDK objects or stable network identifiers, accepts unsigned/stale/replayed messages, inventories a home without explicit selection, merges by name or address, performs hidden polling, sends a device command, or persists credentials outside device-bound secure storage.
