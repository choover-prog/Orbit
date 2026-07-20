import type { DeviceAtlasSnapshot } from "@/domain/orbit/device-atlas";

function words(value: string): string {
  return value.replaceAll("_", " ");
}

export function DeviceAtlasPanel({
  snapshot,
}: {
  snapshot: DeviceAtlasSnapshot;
}) {
  const draft = snapshot.automationDrafts[0];
  return (
    <article
      className="calendar-connection device-atlas"
      aria-labelledby="device-atlas-heading"
    >
      <div className="calendar-connection__heading">
        <div>
          <p className="connection-mode">
            Fixture mode · Companion bridge foundation
          </p>
          <h2 id="device-atlas-heading">Orbit Device Atlas</h2>
        </div>
        <span className="status-text" data-status="paused">
          preview
        </span>
      </div>
      <p className="device-atlas__intro">
        A private inventory that shows which approved path can observe or
        control each device. This preview uses fictional data and sends no
        commands.
      </p>
      <ul className="device-atlas__privacy">
        <li>
          Google Home and Govee access will require separate, explicit consent.
        </li>
        <li>
          Local discovery starts with selected services, not a broad network
          scan.
        </li>
        <li>
          Orbit does not retain IP or hardware addresses and never guesses
          credentials.
        </li>
      </ul>
      <dl className="calendar-connection__facts">
        <div>
          <dt>Known devices</dt>
          <dd>{snapshot.devices.length}</dd>
        </div>
        <div>
          <dt>Source observations</dt>
          <dd>{snapshot.sourceObservationCount}</dd>
        </div>
        <div>
          <dt>Needs identity review</dt>
          <dd>{snapshot.unresolvedObservationCount}</dd>
        </div>
        <div>
          <dt>Automatic control</dt>
          <dd>Off</dd>
        </div>
      </dl>
      <div className="device-atlas__list">
        {snapshot.devices.map((device) => (
          <section
            key={device.id}
            className="device-atlas__device"
            aria-labelledby={`${device.id}-name`}
          >
            <div>
              <h3 id={`${device.id}-name`}>{device.displayName}</h3>
              <p>
                {device.roomLabel ?? "Room not assigned"} · {device.category}
              </p>
            </div>
            <div>
              <p>
                <strong>{device.sources.map(words).join(" + ")}</strong>
              </p>
              <p>
                {device.identityConfidence === "single_source"
                  ? "Kept separate until stronger identity evidence exists"
                  : device.identityConfidence === "strong_identity"
                    ? "Stable identity from one approved source"
                    : "Sources joined using strong identity evidence"}
              </p>
            </div>
            <div>
              <p className="device-atlas__path">
                {device.preferredPath
                  ? `${device.preferredPath.label} · ${device.preferredPath.score}/100`
                  : "Observe only"}
              </p>
              <p>{words(device.monitoring.strategy)}</p>
            </div>
          </section>
        ))}
      </div>
      <section
        className="device-atlas__draft"
        aria-labelledby="automation-draft-heading"
      >
        <p className="connection-mode">Simulated automation draft</p>
        <h3 id="automation-draft-heading">{draft.title}</h3>
        <p>
          {draft.trigger}. {draft.actions[0]}.
        </p>
        <p>{draft.simulation.outcome}</p>
        <p>
          <strong>No command was sent.</strong> Activation remains unavailable
          until a future approval and execution sprint.
        </p>
      </section>
    </article>
  );
}
