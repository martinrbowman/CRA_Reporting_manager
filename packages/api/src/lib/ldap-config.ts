import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { LdapConfigSchema, type LdapConfig } from '@cra/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PATH = resolve(__dirname, '../../../../config/ldap.yml');

let cached: LdapConfig | null = null;
let loadedFromPath: string | null = null;

function configPath(): string {
  return process.env['LDAP_CONFIG_PATH'] ?? DEFAULT_PATH;
}

// Loaded once at boot (see index.ts) and cached in memory. No config is ever
// written back through the API — config/ldap.yml is ops-managed; the only
// mutation path is POST /settings/ldap/reload, which just re-reads the file.
export function loadLdapConfig(): LdapConfig | null {
  const path = configPath();
  if (!existsSync(path)) {
    cached = null;
    loadedFromPath = null;
    return null;
  }
  const raw = yaml.load(readFileSync(path, 'utf8'));
  const parsed = LdapConfigSchema.parse(raw);
  cached = parsed;
  loadedFromPath = path;
  return parsed;
}

export function getLdapConfig(): LdapConfig | null {
  if (cached === null && loadedFromPath === null) {
    return loadLdapConfig();
  }
  return cached;
}

export function reloadLdapConfig(): LdapConfig | null {
  return loadLdapConfig();
}

// For the Settings > LDAP/AD read-only status view — never returns bindCredentials.
export function maskedLdapStatus() {
  const cfg = getLdapConfig();
  if (!cfg) return { configured: false as const };
  const { bindCredentials: _secret, ...safe } = cfg;
  return { configured: true as const, ...safe, bindCredentials: cfg.bindCredentials ? '••••••••' : '' };
}
