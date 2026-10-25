// ── API Key Storage ──
// WebCrypto AES-256-GCM encryption at rest (P1-7).
// The device-level key is a non-extractable CryptoKey persisted in IndexedDB
// (Dexie `keystore` table, structured clone). Ciphertexts stored in localStorage
// carry a `v2:` prefix; legacy base64 values are transparently migrated on read.
// Fallback: when `crypto.subtle` is unavailable (non-secure context), fall back
// to the legacy base64 obfuscation and log a warning.

import { getDeviceKeyRecord, saveDeviceKeyRecord } from '../store/db';

const STORAGE_PREFIX = 'ps_key_';
const V2_PREFIX = 'v2:';

// ── Base64 helpers ──
function bufToBase64(buf: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < buf.length; i++) {
    binary += String.fromCharCode(buf[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): Uint8Array {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    buf[i] = binary.charCodeAt(i);
  }
  return buf;
}

// ── Legacy base64 obfuscation (v1 format, kept for migration + fallback) ──
function legacyEncode(key: string): string {
  return btoa(unescape(encodeURIComponent(key)));
}

function legacyDecode(encoded: string): string {
  return decodeURIComponent(escape(atob(encoded)));
}

// ── Device key management ──
let deviceKeyPromise: Promise<CryptoKey | null> | null = null;

/**
 * Returns the device-level AES-256-GCM key, creating and persisting it on first
 * use. Returns null when WebCrypto is unavailable (non-secure context) or the
 * keystore cannot be read — callers should fall back to legacy storage.
 */
export function getOrCreateDeviceKey(): Promise<CryptoKey | null> {
  if (!deviceKeyPromise) {
    deviceKeyPromise = (async () => {
      if (typeof crypto === 'undefined' || !crypto.subtle) {
        console.warn('[crypto] WebCrypto 不可用（非安全上下文），API Key 将回退为基础混淆存储');
        return null;
      }
      try {
        const existing = await getDeviceKeyRecord();
        if (existing?.key) return existing.key;
        const key = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          false, // non-extractable
          ['encrypt', 'decrypt']
        );
        await saveDeviceKeyRecord(key);
        return key;
      } catch (err) {
        console.warn('[crypto] 设备密钥初始化失败，回退为基础混淆存储', err);
        return null;
      }
    })();
  }
  return deviceKeyPromise;
}

// ── API Key read/write ──

/** Encrypt and persist an API key (AES-256-GCM, `v2:` prefixed). */
export async function saveApiKey(providerId: string, key: string): Promise<void> {
  const deviceKey = await getOrCreateDeviceKey();
  if (!deviceKey) {
    localStorage.setItem(STORAGE_PREFIX + providerId, legacyEncode(key));
    return;
  }
  try {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      deviceKey,
      new TextEncoder().encode(key)
    );
    const combined = new Uint8Array(iv.length + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.length);
    localStorage.setItem(STORAGE_PREFIX + providerId, V2_PREFIX + bufToBase64(combined));
  } catch (err) {
    console.error('[crypto] API Key 加密失败，回退为基础混淆存储', err);
    localStorage.setItem(STORAGE_PREFIX + providerId, legacyEncode(key));
  }
}

/**
 * Read and decrypt an API key. Legacy base64 values (no `v2:` prefix) are
 * decoded and transparently re-written in the v2 encrypted format.
 */
export async function getApiKey(providerId: string): Promise<string> {
  const stored = localStorage.getItem(STORAGE_PREFIX + providerId);
  if (!stored) return '';

  if (stored.startsWith(V2_PREFIX)) {
    const deviceKey = await getOrCreateDeviceKey();
    if (!deviceKey) return '';
    try {
      const buf = base64ToBuf(stored.slice(V2_PREFIX.length));
      const iv = buf.slice(0, 12);
      const cipher = buf.slice(12);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, deviceKey, cipher);
      return new TextDecoder().decode(plain);
    } catch (err) {
      console.error('[crypto] API Key 解密失败', err);
      return '';
    }
  }

  // Legacy format → decode, then transparently migrate to v2.
  try {
    const key = legacyDecode(stored);
    await saveApiKey(providerId, key);
    return key;
  } catch {
    return '';
  }
}

export function deleteApiKey(providerId: string): void {
  localStorage.removeItem(STORAGE_PREFIX + providerId);
}

export function maskApiKey(key: string): string {
  if (!key) return '••••••••';
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 3) + '••••••••' + key.slice(-3);
}

// ── Model config storage ──
const MODEL_CONFIG_KEY = 'ps_model_config';

export interface StoredModelConfig {
  providerId: string;
  modelName: string;
  baseUrlOverride?: string;
  configured: boolean;
}

export function saveModelConfig(config: StoredModelConfig): void {
  localStorage.setItem(MODEL_CONFIG_KEY, JSON.stringify(config));
}

export function loadModelConfig(): StoredModelConfig | null {
  const raw = localStorage.getItem(MODEL_CONFIG_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ── Cost estimation (rough, per 1K tokens, USD) ──
const PRICING: Record<string, { input: number; output: number }> = {
  // DeepSeek
  'deepseek-flash': { input: 0.0003, output: 0.0011 },
  'deepseek-v4-pro': { input: 0.002, output: 0.008 },
  // OpenAI
  'gpt-6.1-sol': { input: 0.005, output: 0.02 },
  'gpt-6-astra': { input: 0.01, output: 0.04 },
  'gpt-6-luna': { input: 0.001, output: 0.004 },
  // Anthropic
  'claude-opus-5-5': { input: 0.015, output: 0.075 },
  'claude-sonnet-5-5': { input: 0.003, output: 0.015 },
  'claude-haiku-5-5': { input: 0.001, output: 0.005 },
  'claude-fable-5-1': { input: 0.02, output: 0.1 },
  // Gemini
  'gemini-4-argon': { input: 0.002, output: 0.012 },
  'gemini-3.8-flash': { input: 0.0003, output: 0.0025 },
  'gemini-3.1-pro-preview': { input: 0.00125, output: 0.01 },
  // Moonshot (Kimi)
  'kimi-k3': { input: 0.003, output: 0.015 },
  'kimi-k2.7-code': { input: 0.0006, output: 0.0025 },
  'kimi-k2.7-code-highspeed': { input: 0.0004, output: 0.002 },
  'kimi-k2.6': { input: 0.0006, output: 0.0025 },
  // Qwen (通义千问)
  'qwen3.8-max': { input: 0.0012, output: 0.006 },
  'qwen3.8-flash': { input: 0.00015, output: 0.0005 },
  'qwen3.7-plus': { input: 0.0004, output: 0.0012 },
  // Zhipu (智谱 GLM)
  'glm-5.3': { input: 0.001, output: 0.004 },
  'glm-5.3-flash': { input: 0.0002, output: 0.0008 },
  'glm-5.3-flashx': { input: 0.0004, output: 0.0016 },
  'glm-5.2': { input: 0.0008, output: 0.0032 },
  // OpenRouter (通用档位)
  'openai/gpt-6.1-sol': { input: 0.005, output: 0.02 },
  'anthropic/claude-sonnet-5.5': { input: 0.003, output: 0.015 },
  'google/gemini-4-argon': { input: 0.002, output: 0.012 },
  'z-ai/glm-5.3': { input: 0.001, output: 0.004 },
};

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = PRICING[model] || { input: 0.002, output: 0.006 };
  return (inputTokens / 1000 * pricing.input) + (outputTokens / 1000 * pricing.output);
}
