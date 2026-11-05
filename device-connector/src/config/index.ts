import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type ConnectorConfig = {
  cloudBaseUrl: string;
  connectorId?: string;
  /** Prefer OS credential store; file storage is last resort and must be restricted. */
  dataDir: string;
};

export function defaultDataDir(): string {
  if (process.platform === "win32") {
    const base = process.env.PROGRAMDATA || "C:\\ProgramData";
    return join(base, "TRONX", "DeviceConnector");
  }
  return join(homedir(), ".tronx-device-connector");
}

export function loadConfig(): ConnectorConfig {
  const dataDir = process.env.TRONX_CONNECTOR_DATA_DIR || defaultDataDir();
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const configPath = join(dataDir, "config.json");
  if (!existsSync(configPath)) {
    const initial: ConnectorConfig = {
      cloudBaseUrl: process.env.TRONX_CLOUD_BASE_URL || "https://localhost:3000",
      dataDir,
    };
    writeFileSync(configPath, JSON.stringify(initial, null, 2), { mode: 0o600 });
    return initial;
  }
  const parsed = JSON.parse(readFileSync(configPath, "utf8")) as ConnectorConfig;
  return { ...parsed, dataDir };
}

export function saveConfig(config: ConnectorConfig): void {
  const configPath = join(config.dataDir, "config.json");
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
}
