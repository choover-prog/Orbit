# Future native Google Home bridge boundary

Google's broad Home APIs are Android/iOS SDKs. They expose structures, rooms, Matter and cloud-to-cloud devices, automations, commissioning, permissions, and low-latency local control. They are not a REST replacement for Nest Device Access and cannot be imported into Orbit's Next.js server.

A future native companion may act as a replaceable adapter:

```text
Google Home SDK (Android/iOS)
  → native permission and device selection
  → signed local bridge session
  → provider-neutral HomeStructure / HomeRoom / HomeDevice capabilities
  → Orbit Core plans and approvals
  → native command execution
  → provider readback, verification, audit, undo metadata
```

The bridge must never expose native SDK objects to product components. It must use device-bound authentication, replay protection, per-capability grants, encrypted local transport, explicit camera/microphone indicators, foreground session rules, revocation, and independent threat review.

Nest Device Access and a future Home Assistant adapter map into the same provider-neutral home contracts. Neither adapter owns Orbit's attention, approval, audit, or undo policy.

Native implementation, commissioning, automations, background presence, microphone input, hosted relay, and household multi-user policy remain deferred.
