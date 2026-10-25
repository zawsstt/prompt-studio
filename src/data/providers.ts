import type { ProviderTemplate } from '../types';

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    providerId: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    auth: {
      type: 'bearer-header',
      headerName: 'Authorization',
      prefix: 'Bearer ',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['deepseek-flash', 'deepseek-v4-pro'],
    extraHeaders: {},
    iconBg: '#4C6EF5',
    iconText: 'DS',
    iconUrl: './icons/deepseek.ico',
  },
  {
    providerId: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    auth: {
      type: 'bearer-header',
      headerName: 'Authorization',
      prefix: 'Bearer ',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['gpt-6.1-sol', 'gpt-6-astra', 'gpt-6-luna'],
    extraHeaders: {},
    iconBg: '#10A37F',
    iconText: 'OA',
    iconUrl: './icons/openai.png',
  },
  {
    providerId: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    auth: {
      type: 'x-api-key',
      headerName: 'x-api-key',
    },
    endpoints: {
      chat: '/messages',
      models: '/models',
    },
    compat: 'anthropic',
    streaming: true,
    defaultModels: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
    extraHeaders: {
      'anthropic-version': '2023-06-01',
    },
    iconBg: '#D97706',
    iconText: 'AN',
    iconUrl: './icons/anthropic.svg',
  },
  {
    providerId: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    auth: {
      type: 'query-key',
      queryParam: 'key',
    },
    endpoints: {
      chat: '/models',
      models: '/models',
    },
    compat: 'gemini',
    streaming: true,
    defaultModels: ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-pro-preview'],
    extraHeaders: {},
    iconBg: '#1A73E8',
    iconText: 'GE',
    iconUrl: './icons/gemini.png',
  },
  {
    providerId: 'moonshot',
    name: 'Moonshot (Kimi)',
    baseUrl: 'https://api.moonshot.cn/v1',
    auth: {
      type: 'bearer-header',
      headerName: 'Authorization',
      prefix: 'Bearer ',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['kimi-k3', 'kimi-k2.7-code', 'kimi-k2.7-code-highspeed', 'kimi-k2.6'],
    extraHeaders: {},
    iconBg: '#0F0F0F',
    iconText: 'MS',
    iconUrl: './icons/moonshot.webp',
  },
  {
    providerId: 'qwen',
    name: '通义千问 (Qwen)',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    auth: {
      type: 'bearer-header',
      headerName: 'Authorization',
      prefix: 'Bearer ',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['qwen3.8-max', 'qwen3.8-flash', 'qwen3.7-plus'],
    extraHeaders: {},
    iconBg: '#615CED',
    iconText: 'QW',
    iconUrl: './icons/qwen.png',
  },
  {
    providerId: 'zhipu',
    name: '智谱 (GLM)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    auth: {
      type: 'bearer-header',
      headerName: 'Authorization',
      prefix: 'Bearer ',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['glm-5.3', 'glm-5.3-flash', 'glm-5.3-flashx', 'glm-5.2'],
    extraHeaders: {},
    iconBg: '#111111',
    iconText: 'Z',
    iconUrl: './icons/zhipu.png',
  },
  {
    providerId: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    auth: {
      type: 'bearer-header',
      headerName: 'Authorization',
      prefix: 'Bearer ',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['openai/gpt-6.1-sol', 'anthropic/claude-sonnet-5.5', 'google/gemini-4-argon', 'z-ai/glm-5.3'],
    extraHeaders: {},
    iconBg: '#7C3AED',
    iconText: 'OR',
  },
];

export const CUSTOM_TEMPLATE: ProviderTemplate = {
  providerId: 'custom',
  name: '自定义 (OpenAI 兼容)',
  baseUrl: '',
  auth: {
    type: 'bearer-header',
    headerName: 'Authorization',
    prefix: 'Bearer ',
  },
  endpoints: {
    chat: '/chat/completions',
    models: '/models',
  },
  compat: 'openai',
  streaming: true,
  defaultModels: [],
  extraHeaders: {},
  iconBg: '#6366F1',
  iconText: '⩙',
};

export function getTemplate(providerId: string): ProviderTemplate | undefined {
  return PROVIDER_TEMPLATES.find(p => p.providerId === providerId) ||
    (providerId === 'custom' ? CUSTOM_TEMPLATE : undefined);
}
