import { registerPlugin } from "@capacitor/core";

export type HeartRateSample = {
  measuredAt: string; // ISO 8601
  heartRate: number;
};

export interface HealthConnectPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestPermissions(): Promise<{ granted: boolean }>;
  readRecentHeartRate(options: {
    since: string | null;
  }): Promise<{ samples: HeartRateSample[] }>;
}

const HealthConnect = registerPlugin<HealthConnectPlugin>("HealthConnect");

export default HealthConnect;
