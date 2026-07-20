"use client";

import { useEffect, useRef, useState } from "react";
import type {
  HomeAuditEvent,
  HomeCommandPlan,
  HomeCommandResult,
  HomeContextSnapshot,
  HomeDevice,
} from "@/domain/orbit/connectors";

export type GoogleNestNotice =
  | "connected"
  | "disconnected"
  | "synced"
  | "current"
  | "denied"
  | "invalid_callback"
  | "failed"
  | "local_only";

const notices: Partial<Record<GoogleNestNotice, string>> = {
  connected:
    "Google Home / Nest is connected and its first bounded read completed.",
  disconnected:
    "Google Home / Nest was disconnected and its local credentials and sessions were removed.",
  synced: "Google Home / Nest context was refreshed.",
  denied: "Google Nest access was not granted. Nothing was stored.",
  invalid_callback:
    "Orbit could not match the Google Nest response to this browser.",
  failed: "Orbit could not finish the Google Nest request.",
  local_only:
    "Local Nest data was removed. Review Partner Connections Manager if you also want to revoke provider access.",
};

function fixtureOffer(): string {
  return `v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE 0 1 2\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=mid:0\r\na=recvonly\r\na=rtpmap:111 opus/48000/2\r\nm=video 9 UDP/TLS/RTP/SAVPF 102\r\na=mid:1\r\na=recvonly\r\na=rtpmap:102 H264/90000\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\na=mid:2\r\na=sctp-port:5000\r\n`;
}

async function completeIce(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 5000);
    const changed = () => {
      if (peer.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        peer.removeEventListener("icegatheringstatechange", changed);
        resolve();
      }
    };
    peer.addEventListener("icegatheringstatechange", changed);
  });
}

function temperature(device: HomeDevice): number | undefined {
  const value = device.observations.find(
    (item) => item.kind === "temperature",
  )?.value;
  return value && "celsius" in value ? value.celsius : undefined;
}

function mode(device: HomeDevice): string {
  const value = device.observations.find(
    (item) => item.kind === "thermostat_mode",
  )?.value;
  return value && "mode" in value ? value.mode : "unknown";
}

export function GoogleNestConnectionPanel({
  snapshot,
  notice,
}: {
  snapshot: HomeContextSnapshot;
  notice?: GoogleNestNotice;
}) {
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [cameraRequest, setCameraRequest] = useState<HomeDevice>();
  const [stream, setStream] = useState<{
    deviceId: string;
    sessionId: string;
    fixture: boolean;
    expiresAt: string;
  }>();
  const [plan, setPlan] = useState<HomeCommandPlan>();
  const [result, setResult] = useState<HomeCommandResult>();
  const [audit, setAudit] = useState<HomeAuditEvent[]>(snapshot.audit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [heatTarget, setHeatTarget] = useState("20");
  const [coolTarget, setCoolTarget] = useState("23");
  const peer = useRef<RTCPeerConnection | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const devices = snapshot.records[0]?.payload.devices ?? [];
  const connected = [
    "connected",
    "fresh",
    "stale",
    "rate_limited",
    "unavailable",
    "syncing",
  ].includes(snapshot.status);

  async function jsonPost(path: string, value: unknown) {
    const response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(value),
    });
    const body = response.status === 204 ? {} : await response.json();
    if (!response.ok)
      throw new Error(body.message ?? "Orbit could not complete the request.");
    return body;
  }

  async function makePlan(
    deviceId: string,
    capability: string,
    parameters: Record<string, unknown>,
  ) {
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const body = await jsonPost("/api/connectors/google-nest/actions/plan", {
        deviceId,
        capability,
        parameters,
      });
      setPlan(body.plan as HomeCommandPlan);
      if (Array.isArray(body.audit)) setAudit(body.audit as HomeAuditEvent[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The plan could not be created.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    if (!plan) return;
    setBusy(true);
    setError(undefined);
    try {
      const body = await jsonPost(
        "/api/connectors/google-nest/actions/approve",
        { planId: plan.id, planHash: plan.planHash },
      );
      setResult(body.result as HomeCommandResult);
      if (Array.isArray(body.audit)) setAudit(body.audit as HomeAuditEvent[]);
      setPlan(undefined);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "The device change failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    if (!cameraRequest) return;
    setBusy(true);
    setError(undefined);
    let activePeer: RTCPeerConnection | undefined;
    try {
      let offerSdp = fixtureOffer();
      if (snapshot.mode === "live") {
        activePeer = new RTCPeerConnection({ bundlePolicy: "max-bundle" });
        activePeer.addTransceiver("audio", { direction: "recvonly" });
        activePeer.addTransceiver("video", { direction: "recvonly" });
        activePeer.createDataChannel("nest");
        activePeer.ontrack = (event) => {
          if (video.current) video.current.srcObject = event.streams[0];
        };
        await activePeer.setLocalDescription(await activePeer.createOffer());
        await completeIce(activePeer);
        offerSdp = activePeer.localDescription?.sdp ?? "";
        if (!offerSdp.endsWith("\n")) offerSdp += "\r\n";
      }
      const body = await jsonPost("/api/connectors/google-nest/streams/start", {
        deviceId: cameraRequest.id,
        offerSdp,
      });
      const session = body.session as {
        fixture: boolean;
        answerSdp?: string;
        sessionId: string;
        expiresAt: string;
      };
      if (Array.isArray(body.audit)) setAudit(body.audit as HomeAuditEvent[]);
      if (!session.fixture) {
        if (!activePeer || !session.answerSdp)
          throw new Error("Nest did not return a usable WebRTC answer.");
        await activePeer.setRemoteDescription({
          type: "answer",
          sdp: session.answerSdp,
        });
        peer.current = activePeer;
      }
      setStream({
        deviceId: cameraRequest.id,
        sessionId: session.sessionId,
        fixture: session.fixture,
        expiresAt: session.expiresAt,
      });
      setCameraRequest(undefined);
    } catch (cause) {
      activePeer?.close();
      setError(
        cause instanceof Error
          ? cause.message
          : "The camera stream could not start.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function stopCamera() {
    const current = stream;
    setStream(undefined);
    peer.current?.close();
    peer.current = null;
    if (video.current) video.current.srcObject = null;
    if (current) {
      const body = await jsonPost("/api/connectors/google-nest/streams/stop", {
        sessionId: current.sessionId,
      }).catch(() => undefined);
      if (body && Array.isArray(body.audit))
        setAudit(body.audit as HomeAuditEvent[]);
    }
  }

  useEffect(
    () => () => {
      peer.current?.close();
    },
    [],
  );
  useEffect(() => {
    if (!stream) return;
    const delay = Math.max(0, Date.parse(stream.expiresAt) - Date.now());
    const stopExpired = () => {
      setStream(undefined);
      peer.current?.close();
      peer.current = null;
      if (video.current) video.current.srcObject = null;
    };
    const timeout = window.setTimeout(stopExpired, delay);
    return () => {
      window.clearTimeout(timeout);
      void fetch("/api/connectors/google-nest/streams/stop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: stream.sessionId }),
        keepalive: true,
      }).catch(() => undefined);
    };
  }, [stream]);

  return (
    <article
      className="calendar-connection nest-connection"
      aria-labelledby="nest-heading"
    >
      <div className="calendar-connection__heading">
        <div>
          <p className="connection-mode">
            {snapshot.mode} mode · Google Device Access
          </p>
          <h2 id="nest-heading">Google Home / Nest</h2>
        </div>
        <span className="status-text" data-status={snapshot.status}>
          {snapshot.status.replaceAll("_", " ")}
        </span>
      </div>
      {notice && notices[notice] ? (
        <p
          role={
            notice === "failed" || notice === "invalid_callback"
              ? "alert"
              : "status"
          }
          className="calendar-connection__notice"
        >
          {notices[notice]}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="calendar-connection__notice">
          {error}
        </p>
      ) : null}
      <p>
        Orbit can show selected Nest devices, open a temporary camera stream
        only when you request it, and control supported thermostats or fans only
        after showing an approval plan.
      </p>
      <ul>
        <li>
          Camera video is live and temporary; Orbit does not record, persist,
          analyze, or send it to a model.
        </li>
        <li>
          Every device change is previewed, approved, executed once, re-read,
          verified, and audited.
        </li>
        <li>
          Google&apos;s Device Access permission includes the traits selected in
          Partner Connections Manager; Orbit enforces a smaller capability
          allowlist.
        </li>
        <li>
          This is Nest Device Access, not the broader Android/iOS Google Home
          SDK.
        </li>
      </ul>
      {!connected ? (
        <form action="/api/connectors/google-nest/connect" method="post">
          <button className="primary-button" type="submit">
            {snapshot.mode === "fixture"
              ? "Connect fictional Nest home"
              : "Connect Google Home / Nest"}
          </button>
        </form>
      ) : (
        <>
          <dl className="calendar-connection__facts">
            <div>
              <dt>Structures</dt>
              <dd>{snapshot.structureCount}</dd>
            </div>
            <div>
              <dt>Supported devices</dt>
              <dd>{snapshot.supportedDeviceCount}</dd>
            </div>
            <div>
              <dt>Unsupported</dt>
              <dd>{snapshot.unsupportedDeviceCount}</dd>
            </div>
            <div>
              <dt>Authority</dt>
              <dd>Requested stream · approved controls</dd>
            </div>
          </dl>
          <div className="nest-device-list">
            {devices.map((device) => {
              const streamCapability = device.capabilities.find(
                (item) => item.kind === "camera.live_stream",
              );
              const currentTemperature = temperature(device);
              const currentMode = mode(device);
              return (
                <section
                  className="nest-device"
                  key={device.id}
                  aria-labelledby={`${device.id}-heading`}
                >
                  <div>
                    <h3 id={`${device.id}-heading`}>{device.displayName}</h3>
                    <p>
                      {device.category} ·{" "}
                      {device.supported
                        ? "supported"
                        : "not supported by this connector"}
                    </p>
                  </div>
                  {currentTemperature !== undefined ? (
                    <p>
                      {Math.round((currentTemperature * 9) / 5 + 32)}°F ·{" "}
                      {currentMode.replace("_", " ")}
                    </p>
                  ) : null}
                  {streamCapability ? (
                    streamCapability.protocols.includes("webrtc") ? (
                      <button
                        type="button"
                        onClick={() => setCameraRequest(device)}
                      >
                        View live video
                      </button>
                    ) : (
                      <p>
                        Legacy RTSP only · browser viewing is not yet supported.
                      </p>
                    )
                  ) : null}
                  {device.capabilities.some(
                    (item) => item.kind === "thermostat.set_mode",
                  ) ? (
                    <div
                      className="nest-controls"
                      aria-label={`${device.displayName} mode controls`}
                    >
                      {["heat", "cool", "heat_cool", "off"].map((next) => (
                        <button
                          key={next}
                          type="button"
                          disabled={busy || currentMode === next}
                          onClick={() =>
                            void makePlan(device.id, "thermostat.set_mode", {
                              mode: next,
                            })
                          }
                        >
                          Set {next.replace("_", " ")}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {device.capabilities.some(
                    (item) => item.kind === "thermostat.set_temperature",
                  ) ? (
                    <form
                      className="nest-controls"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const heat = Number(heatTarget);
                        const cool = Number(coolTarget);
                        void makePlan(
                          device.id,
                          "thermostat.set_temperature",
                          currentMode === "cool"
                            ? { coolCelsius: cool }
                            : currentMode === "heat_cool"
                              ? { heatCelsius: heat, coolCelsius: cool }
                              : { heatCelsius: heat },
                        );
                      }}
                    >
                      {currentMode !== "cool" ? (
                        <label>
                          Heat target °C{" "}
                          <input
                            value={heatTarget}
                            onChange={(event) =>
                              setHeatTarget(event.target.value)
                            }
                            type="number"
                            min="9"
                            max="32"
                            step="0.5"
                          />
                        </label>
                      ) : null}
                      {currentMode !== "heat" ? (
                        <label>
                          Cool target °C{" "}
                          <input
                            value={coolTarget}
                            onChange={(event) =>
                              setCoolTarget(event.target.value)
                            }
                            type="number"
                            min="9"
                            max="32"
                            step="0.5"
                          />
                        </label>
                      ) : null}
                      <button
                        type="submit"
                        disabled={
                          busy ||
                          currentMode === "off" ||
                          currentMode === "unknown"
                        }
                      >
                        Review temperature
                      </button>
                    </form>
                  ) : null}
                  {device.capabilities.some(
                    (item) => item.kind === "fan.set_timer",
                  ) ? (
                    <div className="nest-controls">
                      <button
                        type="button"
                        onClick={() =>
                          void makePlan(device.id, "fan.set_timer", {
                            timerMode: "on",
                            durationSeconds: 900,
                          })
                        }
                      >
                        Run fan 15 minutes
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void makePlan(device.id, "fan.set_timer", {
                            timerMode: "off",
                          })
                        }
                      >
                        Stop fan
                      </button>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
          {cameraRequest ? (
            <section
              className="nest-approval"
              role="dialog"
              aria-modal="true"
              aria-labelledby="camera-confirm"
            >
              <h3 id="camera-confirm">
                View {cameraRequest.displayName} live?
              </h3>
              <p>
                Orbit will create one private, expiring stream session. Nothing
                is recorded or analyzed.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void startCamera()}
              >
                Start live video
              </button>
              <button type="button" onClick={() => setCameraRequest(undefined)}>
                Cancel
              </button>
            </section>
          ) : null}
          {stream ? (
            <section className="nest-stream" aria-label="Temporary live camera">
              <div className="nest-stream__frame">
                {stream.fixture ? (
                  <div role="img" aria-label="Fictional camera stream preview">
                    Private fixture stream
                  </div>
                ) : (
                  <video
                    ref={video}
                    autoPlay
                    playsInline
                    controls={false}
                    aria-label="Live Nest camera video"
                  />
                )}
              </div>
              <p>
                Temporary session · expires{" "}
                {new Date(stream.expiresAt).toLocaleTimeString()}
              </p>
              <button type="button" onClick={() => void stopCamera()}>
                Stop video
              </button>
            </section>
          ) : null}
          {plan ? (
            <section
              className="nest-approval"
              role="dialog"
              aria-modal="true"
              aria-labelledby="plan-heading"
            >
              <h3 id="plan-heading">Approve this device change?</h3>
              <p>{plan.summary}</p>
              <p>{plan.previousState}</p>
              <p>{plan.expectedEffect}</p>
              <p>
                Orbit will execute this once, read the device again, and record
                the result.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void approve()}
              >
                Approve change
              </button>
              <button type="button" onClick={() => setPlan(undefined)}>
                Cancel
              </button>
            </section>
          ) : null}
          {result ? (
            <div className="calendar-connection__notice">
              <p role="status">
                {result.state === "verified"
                  ? `Verified: ${result.observedState}`
                  : `The change was not verified: ${result.observedState ?? result.state}`}
              </p>
              {result.undoPlan ? (
                <button type="button" onClick={() => setPlan(result.undoPlan)}>
                  Review undo
                </button>
              ) : null}
            </div>
          ) : null}
          {audit.length ? (
            <section
              className="nest-audit"
              aria-labelledby="nest-audit-heading"
            >
              <h3 id="nest-audit-heading">Recent device activity</h3>
              <ol>
                {audit
                  .slice(-5)
                  .reverse()
                  .map((event) => (
                    <li key={event.id}>
                      <span>{event.summary}</span>{" "}
                      <time dateTime={event.occurredAt}>
                        {new Date(event.occurredAt).toLocaleTimeString()}
                      </time>
                    </li>
                  ))}
              </ol>
            </section>
          ) : null}
          <div className="calendar-connection__actions">
            <form action="/api/connectors/google-nest/sync" method="post">
              <button type="submit">Refresh now</button>
            </form>
            <button type="button" onClick={() => setConfirmDisconnect(true)}>
              Disconnect
            </button>
          </div>
          {confirmDisconnect ? (
            <section
              className="nest-approval"
              role="dialog"
              aria-modal="true"
              aria-labelledby="disconnect-nest"
            >
              <h3 id="disconnect-nest">Disconnect Google Home / Nest?</h3>
              <p>
                This stops active streams, removes local credentials and cached
                device data, and asks Google to revoke the grant. It does not
                change device state.
              </p>
              <form
                action="/api/connectors/google-nest/disconnect"
                method="post"
              >
                <button type="submit">Remove Nest connection</button>
              </form>
              <button type="button" onClick={() => setConfirmDisconnect(false)}>
                Keep connected
              </button>
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}
