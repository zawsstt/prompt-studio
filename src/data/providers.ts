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
    defaultModels: ['deepseek-chat', 'deepseek-reasoner'],
    extraHeaders: {},
    iconBg: '#4C6EF5',
    iconText: 'DS',
    iconUrl: '/icons/deepseek.ico',
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
    defaultModels: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    extraHeaders: {},
    iconBg: '#10A37F',
    iconText: 'OA',
    iconUrl: '/icons/openai.png',
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
    defaultModels: ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20250315', 'claude-opus-4-20250514'],
    extraHeaders: {
      'anthropic-version': '2023-06-01',
    },
    iconBg: '#D97706',
    iconText: 'AN',
    iconUrl: '/icons/anthropic.svg',
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
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    extraHeaders: {},
    iconBg: '#1A73E8',
    iconText: 'GE',
    iconUrl: '/icons/gemini.png',
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
    defaultModels: ['kimi-k2-0711-preview', 'moonshot-v1-8k', 'moonshot-v1-32k'],
    extraHeaders: {},
    iconBg: '#0F0F0F',
    iconText: 'MS',
    iconUrl: '/icons/moonshot.webp',
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
    defaultModels: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    extraHeaders: {},
    iconBg: '#615CED',
    iconText: 'QW',
    iconUrl: '/icons/qwen.png',
  },
  {
    providerId: 'ollama',
    name: 'Ollama (本地)',
    baseUrl: 'http://localhost:11434/v1',
    auth: {
      type: 'none',
    },
    endpoints: {
      chat: '/chat/completions',
      models: '/models',
    },
    compat: 'openai',
    streaming: true,
    defaultModels: ['llama3.1', 'qwen2.5', 'deepseek-r1'],
    extraHeaders: {},
    iconBg: '#374151',
    iconText: 'OL',
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
    defaultModels: ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'google/gemini-2.5-flash'],
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
