import { createHash, randomUUID } from "node:crypto";
import type {
  ConnectorFailure,
  ConnectorMode,
  HomeAuditEvent,
  HomeAuthorizationStatus,
  HomeCommandPlan,
  HomeCommandResult,
  HomeContextStatus,
  HomeDevice,
} from "@/domain/orbit/connectors";
import {
  executeGoogleNestCommand,
  syncGoogleNest,
  type GoogleNestCommandName,
} from "./client";
import {
  GOOGLE_NEST_SCOPE,
  resolveGoogleNestConfig,
  type GoogleNestEnvironment,
  type GoogleNestOAuthConfig,
} from "./config";
import {
  createGoogleNestCredentialStore,
  GoogleNestCredentialStoreError,
  type GoogleNestCredentialStore,
} from "./credential-store";
import {
  applyGoogleNestFixtureCommand,
  createGoogleNestFixtureSource,
  createGoogleNestFixtureState,
  type GoogleNestFixtureState,
} from "./fixture";
import {
  beginGoogleNestAuthorization,
  completeGoogleNestAuthorization,
  disconnectGoogleNest,
  refreshGoogleNestAccessToken,
  type GoogleNestAccessToken,
} from "./oauth";
import {
  getGoogleNestOAuthSessions,
  type GoogleNestOAuthSessionStore,
} from "./oauth-session";
import { GoogleNestService } from "./service";
import type { GoogleNestSyncBatch, GoogleNestSyncOutcome } from "./types";

const PLAN_TTL_MS = 5 * 60_000;
const ACCESS_SKEW_MS = 60_000;
const MAX_PENDING_PLANS = 64;
const MAX_STREAMS = 4;

export interface GoogleNestGatewayEnvironment extends GoogleNestEnvironment {
  ORBIT_GOOGLE_NEST_MODE?: string;
  LOCALAPPDATA?: string;
}

export interface GoogleNestGatewayState {
  status: HomeContextStatus;
  authorization: HomeAuthorizationStatus;
  mode: ConnectorMode;
  batch?: GoogleNestSyncBatch;
  failure?: ConnectorFailure;
  nextSyncEligibleAt?: string;
  audit: HomeAuditEvent[];
}

export type HomeCommandRequest =
  | {
      deviceId: string;
      capability: "thermostat.set_mode";
      parameters: { mode: "heat" | "cool" | "heat_cool" | "off" };
    }
  | {
      deviceId: string;
      capability: "thermostat.set_temperature";
      parameters: { heatCelsius?: number; coolCelsius?: number };
    }
  | {
      deviceId: string;
      capability: "fan.set_timer";
      parameters: { timerMode: "on" | "off"; durationSeconds?: number };
    };

interface InternalPlan {
  public: HomeCommandPlan;
  command: GoogleNestCommandName;
  params: Record<string, unknown>;
  verify: (device: HomeDevice) => boolean;
  undo?: HomeCommandRequest;
  used: boolean;
}

interface StreamSession {
  deviceId: string;
  mediaSessionId: string;
  expiresAt: string;
}

function failure(
  code: ConnectorFailure["code"],
  message: string,
  retryable = false,
): ConnectorFailure {
  return { code, message, retryable };
}

function resolveMode(value: string | undefined): {
  mode: ConnectorMode;
  failure?: ConnectorFailure;
} {
  const mode = value?.trim().toLowerCase();
  if (!mode || mode === "fixture") return { mode: "fixture" };
  if (mode === "live") return { mode: "live" };
  return {
    mode: "fixture",
    failure: failure(
      "configuration_required",
      "ORBIT_GOOGLE_NEST_MODE must be fixture or live.",
    ),
  };
}

function canonicalHash(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

function modeValue(mode: string): string {
  return mode === "heat_cool" ? "HEATCOOL" : mode.toUpperCase();
}

function latestDevice(
  batch: GoogleNestSyncBatch | undefined,
  id: string,
): HomeDevice | undefined {
  return batch?.records
    .flatMap((record) => record.payload.devices)
    .find((device) => device.id === id);
}

function currentMode(device: HomeDevice): string | undefined {
  const value = device.observations.find(
    (item) => item.kind === "thermostat_mode",
  )?.value;
  return value && "mode" in value ? value.mode : undefined;
}

function currentSetpoint(device: HomeDevice): {
  heatCelsius?: number;
  coolCelsius?: number;
} {
  const value = device.observations.find(
    (item) => item.kind === "thermostat_setpoint",
  )?.value;
  return value && ("heatCelsius" in value || "coolCelsius" in value)
    ? {
        ...(typeof value.heatCelsius === "number"
          ? { heatCelsius: value.heatCelsius }
          : {}),
        ...(typeof value.coolCelsius === "number"
          ? { coolCelsius: value.coolCelsius }
          : {}),
      }
    : {};
}

function currentFan(device: HomeDevice): "on" | "off" | "unknown" {
  const value = device.observations.find((item) => item.kind === "fan")?.value;
  return value && "timerMode" in value ? value.timerMode : "unknown";
}

function validateSdp(offer: string): void {
  if (offer.length < 200 || offer.length > 64 * 1024 || !offer.endsWith("\n"))
    throw new Error("The camera offer is invalid.");
  const audio = offer.indexOf("m=audio");
  const video = offer.indexOf("m=video");
  const data = offer.indexOf("m=application");
  const audioSection =
    audio >= 0 && video > audio ? offer.slice(audio, video) : "";
  if (
    audio < 0 ||
    video <= audio ||
    data <= video ||
    !audioSection.includes("a=recvonly") ||
    /a=(?:sendrecv|sendonly)/u.test(offer)
  )
    throw new Error(
      "The camera offer does not meet Nest's receive-only WebRTC requirements.",
    );
}

export class GoogleNestGateway {
  readonly mode: ConnectorMode;
  private readonly credentials: GoogleNestCredentialStore;
  private readonly sessions: GoogleNestOAuthSessionStore;
  private readonly config?: GoogleNestOAuthConfig;
  private readonly fetchImpl?: typeof fetch;
  private readonly service: GoogleNestService;
  private readonly fixtureState?: GoogleNestFixtureState;
  private readonly startupFailure?: ConnectorFailure;
  private readonly plans = new Map<string, InternalPlan>();
  private readonly streams = new Map<string, StreamSession>();
  private readonly audit: HomeAuditEvent[] = [];
  private accessToken?: GoogleNestAccessToken;
  private tokenPromise?: Promise<GoogleNestAccessToken>;

  constructor(
    options: {
      environment?: GoogleNestGatewayEnvironment;
      mode?: string;
      credentialStore?: GoogleNestCredentialStore;
      sessions?: GoogleNestOAuthSessionStore;
      fetchImpl?: typeof fetch;
      platform?: NodeJS.Platform;
      localAppData?: string;
    } = {},
  ) {
    const environment =
      options.environment ?? (process.env as GoogleNestGatewayEnvironment);
    const resolvedMode = resolveMode(
      options.mode ?? environment.ORBIT_GOOGLE_NEST_MODE,
    );
    this.mode = resolvedMode.mode;
    this.sessions = options.sessions ?? getGoogleNestOAuthSessions();
    this.fetchImpl = options.fetchImpl;
    let startupFailure = resolvedMode.failure;
    let credentials = options.credentialStore;
    try {
      credentials ??= createGoogleNestCredentialStore({
        mode: this.mode,
        platform: options.platform,
        localAppData: options.localAppData ?? environment.LOCALAPPDATA,
      });
    } catch (error) {
      startupFailure = failure(
        "storage_unavailable",
        error instanceof Error
          ? error.message
          : "Secure Google Nest storage is unavailable.",
      );
      credentials = createGoogleNestCredentialStore({ mode: "fixture" });
    }
    this.credentials = credentials;
    if (this.mode === "live" && !startupFailure) {
      const resolved = resolveGoogleNestConfig(environment);
      if (resolved.ok) this.config = resolved.config;
      else startupFailure = failure("configuration_required", resolved.message);
    }
    this.startupFailure = startupFailure;
    this.fixtureState =
      this.mode === "fixture" ? createGoogleNestFixtureState() : undefined;
    this.service = new GoogleNestService(
      this.mode === "fixture"
        ? createGoogleNestFixtureSource(this.fixtureState)
        : { sync: (now) => this.syncLive(now) },
    );
  }

  async authorizationStatus(): Promise<HomeAuthorizationStatus> {
    if (this.startupFailure?.code === "storage_unavailable")
      return "storage_unavailable";
    if (this.startupFailure) return "configuration_required";
    try {
      return (await this.credentials.load()) ? "connected" : "disconnected";
    } catch {
      return "storage_unavailable";
    }
  }

  async peek(now: Date): Promise<GoogleNestGatewayState> {
    const authorization = await this.authorizationStatus();
    if (authorization !== "connected")
      return {
        status: authorization,
        authorization,
        mode: this.mode,
        audit: this.audit.slice(-20),
        ...(this.startupFailure ? { failure: this.startupFailure } : {}),
      };
    const result = this.service.peek(now);
    return result
      ? this.state(result)
      : {
          status: "connected",
          authorization,
          mode: this.mode,
          audit: this.audit.slice(-20),
        };
  }

  async read(now: Date, force = false): Promise<GoogleNestGatewayState> {
    const authorization = await this.authorizationStatus();
    if (authorization !== "connected")
      return {
        status: authorization,
        authorization,
        mode: this.mode,
        audit: this.audit.slice(-20),
        ...(this.startupFailure ? { failure: this.startupFailure } : {}),
      };
    return this.state(await this.service.read(now, force));
  }

  async beginAuthorization(now = new Date()) {
    if (this.startupFailure) throw new Error(this.startupFailure.message);
    if (this.mode === "fixture") {
      if (this.fixtureState)
        Object.assign(this.fixtureState, createGoogleNestFixtureState());
      await this.credentials.save({
        version: 1,
        refreshToken: "fixture-nest-refresh-not-a-credential",
        grantedScopes: [GOOGLE_NEST_SCOPE],
        connectedAt: now.toISOString(),
      });
      this.accessToken = {
        accessToken: "fixture-nest-access-not-a-credential",
        expiresAt: new Date(now.getTime() + 3_600_000).toISOString(),
      };
      this.service.clear();
      return { kind: "fixture" as const, state: await this.read(now, true) };
    }
    if (!this.config) throw new Error("Google Nest OAuth is not configured.");
    return {
      kind: "redirect" as const,
      authorization: beginGoogleNestAuthorization(this.config, this.sessions),
      redirectUri: this.config.redirectUri,
    };
  }

  async completeAuthorization(input: {
    code: string;
    state?: string;
    cookieBinding?: string;
  }) {
    if (!this.config || this.mode !== "live")
      throw new Error("Google Nest OAuth is not configured.");
    this.accessToken = await completeGoogleNestAuthorization(
      input,
      this.config,
      this.sessions,
      this.credentials,
      this.fetchImpl,
    );
    this.service.clear();
    return this.read(new Date(), true);
  }

  async disconnect() {
    for (const sessionId of [...this.streams.keys()])
      await this.stopStream(sessionId).catch(() => undefined);
    this.service.clear();
    this.sessions.clear();
    this.plans.clear();
    this.streams.clear();
    this.accessToken = undefined;
    this.tokenPromise = undefined;
    if (this.mode === "fixture") {
      await this.credentials.delete();
      return { localCredentialsDeleted: true, providerRevoked: true };
    }
    return disconnectGoogleNest(this.credentials, this.fetchImpl);
  }

  createPlan(input: HomeCommandRequest, now = new Date()): HomeCommandPlan {
    this.prune(now);
    const batch = this.service.currentBatch();
    if (
      !batch ||
      now.getTime() >= Date.parse(batch.staleAfter) ||
      batch.completeness !== "complete"
    )
      throw new Error("Refresh Google Nest before planning a device change.");
    const device = latestDevice(batch, input.deviceId);
    if (
      !device?.supported ||
      !device.capabilities.some((item) => item.kind === input.capability)
    )
      throw new Error("That device does not expose the requested capability.");
    const id = `home-plan-${randomUUID()}`;
    const expiresAt = new Date(now.getTime() + PLAN_TTL_MS).toISOString();
    let command: GoogleNestCommandName;
    let params: Record<string, unknown>;
    let summary: string;
    let expectedEffect: string;
    let previousState: string;
    let verify: (device: HomeDevice) => boolean;
    let undo: HomeCommandRequest | undefined;
    if (input.capability === "thermostat.set_mode") {
      const previous = currentMode(device) ?? "unknown";
      command = "sdm.devices.commands.ThermostatMode.SetMode";
      params = { mode: modeValue(input.parameters.mode) };
      summary = `Set ${device.displayName} to ${input.parameters.mode.replace("_", " ")}.`;
      expectedEffect = `Thermostat mode becomes ${input.parameters.mode.replace("_", " ")}.`;
      previousState = `Mode was ${previous.replace("_", " ")}.`;
      verify = (current) => currentMode(current) === input.parameters.mode;
      if (["heat", "cool", "heat_cool", "off"].includes(previous))
        undo = {
          deviceId: device.id,
          capability: "thermostat.set_mode",
          parameters: {
            mode: previous as "heat" | "cool" | "heat_cool" | "off",
          },
        };
    } else if (input.capability === "thermostat.set_temperature") {
      const { heatCelsius, coolCelsius } = input.parameters;
      if (
        (heatCelsius !== undefined && (heatCelsius < 9 || heatCelsius > 32)) ||
        (coolCelsius !== undefined && (coolCelsius < 9 || coolCelsius > 32)) ||
        (heatCelsius !== undefined &&
          coolCelsius !== undefined &&
          coolCelsius - heatCelsius < 1)
      )
        throw new Error("Choose a safe thermostat range between 9°C and 32°C.");
      const mode = currentMode(device);
      if (mode === "heat" && heatCelsius !== undefined) {
        command = "sdm.devices.commands.ThermostatTemperatureSetpoint.SetHeat";
        params = { heatCelsius };
      } else if (mode === "cool" && coolCelsius !== undefined) {
        command = "sdm.devices.commands.ThermostatTemperatureSetpoint.SetCool";
        params = { coolCelsius };
      } else if (
        mode === "heat_cool" &&
        heatCelsius !== undefined &&
        coolCelsius !== undefined
      ) {
        command = "sdm.devices.commands.ThermostatTemperatureSetpoint.SetRange";
        params = { heatCelsius, coolCelsius };
      } else
        throw new Error(
          "The requested setpoint does not match the thermostat's current mode.",
        );
      const previous = currentSetpoint(device);
      summary = `Change ${device.displayName}'s target temperature.`;
      expectedEffect = `Target becomes ${heatCelsius ?? "–"}°C heat / ${coolCelsius ?? "–"}°C cool.`;
      previousState = `Previous target was ${previous.heatCelsius ?? "–"}°C heat / ${previous.coolCelsius ?? "–"}°C cool.`;
      verify = (current) => {
        const value = currentSetpoint(current);
        return (
          (heatCelsius === undefined || value.heatCelsius === heatCelsius) &&
          (coolCelsius === undefined || value.coolCelsius === coolCelsius)
        );
      };
      if (
        previous.heatCelsius !== undefined ||
        previous.coolCelsius !== undefined
      )
        undo = {
          deviceId: device.id,
          capability: "thermostat.set_temperature",
          parameters: previous,
        };
    } else {
      const { timerMode, durationSeconds } = input.parameters;
      if (
        timerMode === "on" &&
        (durationSeconds === undefined ||
          !Number.isInteger(durationSeconds) ||
          durationSeconds < 60 ||
          durationSeconds > 43_200)
      )
        throw new Error("Fan duration must be between 1 minute and 12 hours.");
      command = "sdm.devices.commands.Fan.SetTimer";
      params =
        timerMode === "on"
          ? { timerMode: "ON", duration: `${durationSeconds}s` }
          : { timerMode: "OFF" };
      summary = `${timerMode === "on" ? "Run" : "Stop"} ${device.displayName}'s fan.`;
      expectedEffect =
        timerMode === "on"
          ? `Fan runs for ${Math.round((durationSeconds ?? 0) / 60)} minutes.`
          : "Fan timer stops.";
      const previous = currentFan(device);
      previousState = `Fan timer was ${previous}.`;
      verify = (current) => currentFan(current) === timerMode;
      if (previous === "on" || previous === "off") {
        undo = {
          deviceId: device.id,
          capability: "fan.set_timer",
          parameters: {
            timerMode: previous,
            ...(previous === "on" ? { durationSeconds: 900 } : {}),
          },
        };
      }
    }
    const publicPlan: HomeCommandPlan = {
      id,
      deviceId: device.id,
      capability: input.capability,
      summary,
      expectedEffect,
      previousState,
      expiresAt,
      reversible: Boolean(undo),
      parameters: input.parameters,
      planHash: "",
    };
    publicPlan.planHash = canonicalHash(publicPlan);
    this.plans.set(id, {
      public: publicPlan,
      command,
      params,
      verify,
      undo,
      used: false,
    });
    while (this.plans.size > MAX_PENDING_PLANS) {
      const oldest = this.plans.keys().next().value as string | undefined;
      if (!oldest) break;
      this.plans.delete(oldest);
    }
    this.record(device.id, "plan_created", summary, now);
    return publicPlan;
  }

  async approvePlan(
    planId: string,
    planHash: string,
    now = new Date(),
  ): Promise<HomeCommandResult> {
    const plan = this.plans.get(planId);
    if (
      !plan ||
      plan.used ||
      plan.public.planHash !== planHash ||
      now.getTime() >= Date.parse(plan.public.expiresAt)
    )
      throw new Error("That device plan is invalid, expired, or already used.");
    plan.used = true;
    this.record(plan.public.deviceId, "approved", plan.public.summary, now);
    if (this.mode === "live") {
      const batch = this.service.currentBatch();
      const reference = batch?.deviceReferences[plan.public.deviceId];
      if (!reference || !this.config)
        return this.failed(
          plan.public,
          "The device reference is no longer current.",
          now,
        );
      const token = await this.token(now);
      const outcome = await executeGoogleNestCommand(
        {
          accessToken: token.accessToken,
          projectId: this.config.projectId,
          deviceReference: reference,
          command: plan.command,
          params: plan.params,
        },
        { fetchImpl: this.fetchImpl },
      );
      if (!outcome.ok)
        return this.failed(plan.public, outcome.failure.message, now);
    } else if (this.fixtureState) {
      applyGoogleNestFixtureCommand(
        this.fixtureState,
        plan.command,
        plan.params,
      );
    }
    this.record(plan.public.deviceId, "executed", plan.public.summary, now);
    const completedAt = this.mode === "live" ? new Date() : now;
    this.service.clear();
    const refreshed = await this.read(completedAt, true);
    const current = latestDevice(refreshed.batch, plan.public.deviceId);
    const verified = Boolean(current && plan.verify(current));
    if (!verified)
      return {
        planId,
        state: "verification_failed",
        completedAt: completedAt.toISOString(),
      };
    this.record(
      plan.public.deviceId,
      "verified",
      plan.public.expectedEffect,
      completedAt,
    );
    let undoPlan: HomeCommandPlan | undefined;
    if (plan.undo) {
      try {
        undoPlan = this.createPlan(plan.undo, completedAt);
      } catch {
        /* provider state can make undo unavailable */
      }
    }
    return {
      planId,
      state: "verified",
      completedAt: completedAt.toISOString(),
      observedState: plan.public.expectedEffect,
      ...(undoPlan ? { undoPlan } : {}),
    };
  }

  async startStream(
    deviceId: string,
    offerSdp: string,
    now = new Date(),
  ): Promise<{
    fixture: boolean;
    answerSdp?: string;
    sessionId: string;
    expiresAt: string;
  }> {
    this.prune(now);
    validateSdp(offerSdp);
    const batch = this.service.currentBatch();
    if (
      !batch ||
      now.getTime() >= Date.parse(batch.staleAfter) ||
      batch.completeness !== "complete"
    )
      throw new Error("Refresh Google Nest before starting live video.");
    if (this.streams.size >= MAX_STREAMS)
      throw new Error("Stop another camera session before opening this one.");
    const device = latestDevice(batch, deviceId);
    const streamCapability = device?.capabilities.find(
      (item) => item.kind === "camera.live_stream",
    );
    if (
      !device ||
      !streamCapability ||
      !streamCapability.protocols.includes("webrtc")
    )
      throw new Error(
        "This camera does not offer a browser-compatible WebRTC stream.",
      );
    const sessionId = `home-stream-${randomUUID()}`;
    if (this.mode === "fixture") {
      const expiresAt = new Date(now.getTime() + 5 * 60_000).toISOString();
      this.streams.set(sessionId, {
        deviceId,
        mediaSessionId: "fixture",
        expiresAt,
      });
      this.record(
        deviceId,
        "stream_started",
        "Started a fictional local camera preview.",
        now,
      );
      return { fixture: true, sessionId, expiresAt };
    }
    const reference = batch?.deviceReferences[deviceId];
    if (!reference || !this.config)
      throw new Error("The camera reference is no longer current.");
    const token = await this.token(now);
    const outcome = await executeGoogleNestCommand(
      {
        accessToken: token.accessToken,
        projectId: this.config.projectId,
        deviceReference: reference,
        command: "sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream",
        params: { offerSdp },
      },
      { fetchImpl: this.fetchImpl },
    );
    if (!outcome.ok) throw new Error(outcome.failure.message);
    const { answerSdp, mediaSessionId, expiresAt } = outcome.results;
    const parsedExpiry =
      typeof expiresAt === "string" ? Date.parse(expiresAt) : Number.NaN;
    if (
      typeof answerSdp !== "string" ||
      answerSdp.length > 64 * 1024 ||
      typeof mediaSessionId !== "string" ||
      mediaSessionId.length > 4096 ||
      !Number.isFinite(parsedExpiry) ||
      parsedExpiry <= now.getTime() ||
      parsedExpiry > now.getTime() + 6 * 60_000
    )
      throw new Error("Google Nest returned an invalid stream session.");
    this.streams.set(sessionId, {
      deviceId,
      mediaSessionId,
      expiresAt: new Date(parsedExpiry).toISOString(),
    });
    this.record(
      deviceId,
      "stream_started",
      "Started a temporary live camera session.",
      now,
    );
    return {
      fixture: false,
      answerSdp,
      sessionId,
      expiresAt: new Date(parsedExpiry).toISOString(),
    };
  }

  async stopStream(sessionId: string, now = new Date()): Promise<void> {
    this.prune(now);
    const session = this.streams.get(sessionId);
    if (!session) return;
    this.streams.delete(sessionId);
    if (this.mode === "live" && this.config) {
      const reference =
        this.service.currentBatch()?.deviceReferences[session.deviceId];
      if (reference) {
        const token = await this.token(now);
        await executeGoogleNestCommand(
          {
            accessToken: token.accessToken,
            projectId: this.config.projectId,
            deviceReference: reference,
            command: "sdm.devices.commands.CameraLiveStream.StopWebRtcStream",
            params: { mediaSessionId: session.mediaSessionId },
          },
          { fetchImpl: this.fetchImpl },
        );
      }
    }
    this.record(
      session.deviceId,
      "stream_stopped",
      "Stopped the temporary camera session.",
      now,
    );
  }

  auditSnapshot(): HomeAuditEvent[] {
    return this.audit.slice(-20);
  }

  resetForTests(): void {
    this.service.clear();
    this.sessions.clear();
    this.plans.clear();
    this.streams.clear();
    this.audit.length = 0;
    this.accessToken = undefined;
    if (this.fixtureState)
      Object.assign(this.fixtureState, createGoogleNestFixtureState());
  }

  private state(
    result: Awaited<ReturnType<GoogleNestService["read"]>>,
  ): GoogleNestGatewayState {
    if (result.status === "fresh")
      return {
        status: "fresh",
        authorization: "connected",
        mode: this.mode,
        batch: result.batch,
        nextSyncEligibleAt: result.nextSyncEligibleAt,
        audit: this.audit.slice(-20),
      };
    if (result.status === "stale")
      return {
        status: "stale",
        authorization: "connected",
        mode: this.mode,
        batch: result.batch,
        failure: result.failure,
        nextSyncEligibleAt: result.nextSyncEligibleAt,
        audit: this.audit.slice(-20),
      };
    return {
      status: result.status,
      authorization:
        result.status === "reauthorization_required"
          ? "reauthorization_required"
          : "connected",
      mode: this.mode,
      failure: result.failure,
      nextSyncEligibleAt: result.nextSyncEligibleAt,
      audit: this.audit.slice(-20),
    };
  }

  private async syncLive(now: Date): Promise<GoogleNestSyncOutcome> {
    if (!this.config)
      return {
        ok: false,
        failure: failure(
          "configuration_required",
          "Google Nest is not configured.",
        ),
      };
    try {
      const token = await this.token(now);
      return syncGoogleNest(
        {
          now,
          accessToken: token.accessToken,
          projectId: this.config.projectId,
        },
        { fetchImpl: this.fetchImpl },
      );
    } catch (error) {
      if (error instanceof GoogleNestCredentialStoreError)
        return {
          ok: false,
          failure: failure("storage_unavailable", error.message),
        };
      return {
        ok: false,
        failure: failure(
          "authentication_required",
          error instanceof Error
            ? error.message
            : "Google Nest authorization is required.",
        ),
      };
    }
  }

  private async token(now: Date): Promise<GoogleNestAccessToken> {
    if (
      this.accessToken &&
      Date.parse(this.accessToken.expiresAt) > now.getTime() + ACCESS_SKEW_MS
    )
      return this.accessToken;
    if (this.tokenPromise) return this.tokenPromise;
    if (!this.config) throw new Error("Google Nest is not configured.");
    const pending = refreshGoogleNestAccessToken(
      this.config,
      this.credentials,
      this.fetchImpl,
    )
      .then((token) => {
        this.accessToken = token;
        return token;
      })
      .finally(() => {
        if (this.tokenPromise === pending) this.tokenPromise = undefined;
      });
    this.tokenPromise = pending;
    return pending;
  }

  private record(
    deviceId: string,
    kind: HomeAuditEvent["kind"],
    summary: string,
    at: Date,
  ): void {
    this.audit.push({
      id: `home-audit-${randomUUID()}`,
      deviceId,
      kind,
      summary,
      occurredAt: at.toISOString(),
    });
    if (this.audit.length > 100) this.audit.shift();
  }

  private prune(now: Date): void {
    for (const [id, plan] of this.plans)
      if (plan.used || now.getTime() >= Date.parse(plan.public.expiresAt))
        this.plans.delete(id);
    for (const [id, session] of this.streams)
      if (now.getTime() >= Date.parse(session.expiresAt))
        this.streams.delete(id);
  }

  private failed(
    plan: HomeCommandPlan,
    message: string,
    now: Date,
  ): HomeCommandResult {
    this.record(plan.deviceId, "failed", message, now);
    return {
      planId: plan.id,
      state: "failed",
      completedAt: now.toISOString(),
      observedState: message,
    };
  }
}

export function createGoogleNestGateway(
  options: ConstructorParameters<typeof GoogleNestGateway>[0] = {},
) {
  return new GoogleNestGateway(options);
}
