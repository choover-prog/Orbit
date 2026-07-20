import type {
  DeviceAtlasSourceKind,
  DeviceSourceObservation,
} from "@/domain/orbit/device-atlas";

export interface DeviceInventoryRequest {
  now: Date;
  maximumRecords: number;
}

export interface DeviceInventoryResult {
  source: DeviceAtlasSourceKind;
  complete: boolean;
  observations: DeviceSourceObservation[];
}

export interface GoogleHomeCompanionSource {
  inventory(request: DeviceInventoryRequest): Promise<DeviceInventoryResult>;
}

export interface GoveeInventorySource {
  inventory(request: DeviceInventoryRequest): Promise<DeviceInventoryResult>;
}

export interface LocalServiceDiscoverySource {
  selectAndObserve(
    request: DeviceInventoryRequest,
  ): Promise<DeviceInventoryResult>;
}
