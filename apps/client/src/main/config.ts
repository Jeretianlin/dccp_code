import { app } from 'electron';
import { join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

interface AppConfig {
  serverUrl: string;
}

const DEFAULT_CONFIG: AppConfig = {
  serverUrl: 'https://localhost:3000',
};

let cachedConfig: AppConfig | null = null;

function getConfigPaths(): string[] {
  const exePath = app.getPath('exe');
  const exeDir = exePath.substring(0, exePath.lastIndexOf(require('path').sep));
  const exeConfigPath = join(exeDir, 'config.json');
  const resourcesConfigPath = join(exeDir, 'resources', 'config.json');
  return [exeConfigPath, resourcesConfigPath];
}

export function getConfig(): AppConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPaths = getConfigPaths();
  let config: AppConfig = { ...DEFAULT_CONFIG };

  for (const configPath of configPaths) {
    try {
      if (existsSync(configPath)) {
        const content = readFileSync(configPath, 'utf-8');
        const parsed = JSON.parse(content);
        config = { ...DEFAULT_CONFIG, ...parsed };
        break;
      }
    } catch (error) {
      console.error('Failed to load config from', configPath, error);
    }
  }

  cachedConfig = config;
  return cachedConfig;
}

export function updateConfig(newConfig: Partial<AppConfig>): { success: boolean; error?: string } {
  const configPaths = getConfigPaths();
  const configPath = configPaths[0];

  try {
    const currentConfig = getConfig();
    cachedConfig = { ...currentConfig, ...newConfig };
    writeFileSync(configPath, JSON.stringify(cachedConfig, null, 2), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Failed to save config:', error);
    return { success: false, error: (error as Error).message };
  }
}

export function getApiUrl(): string {
  const config = getConfig();
  return `${config.serverUrl}/api`;
}

export function getBaseUrl(): string {
  const config = getConfig();
  return config.serverUrl;
}

export async function testConnection(serverUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      const data = await response.json();
      return { success: true, message: `连接成功 - 服务器状态: ${data.status}` };
    } else {
      return { success: false, message: `服务器返回错误: ${response.status}` };
    }
  } catch (error) {
    return { success: false, message: `连接失败: ${(error as Error).message}` };
  }
}

export function clearConfigCache(): void {
  cachedConfig = null;
}