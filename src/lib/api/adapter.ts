import type { ProviderTemplate } from '../../types';

export interface ChatMessagePayload {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onReasoning?: (token: string) => void;
  onDone: (fullText: string) => void;
  onError: (error: Error) => void;
}

export interface SendOptions {
  template: ProviderTemplate;
  apiKey: string;
  model: string;
  messages: ChatMessagePayload[];
  signal?: AbortSignal;
  callbacks: StreamCallbacks;
  systemPrompt?: string;
}

// ── Unified send message with streaming support ──
export async function sendMessage(opts: SendOptions): Promise<void> {
  const { template } = opts;

  if (template.compat === 'anthropic') {
    return sendAnthropic(opts);
  } else if (template.compat === 'gemini') {
    return sendGemini(opts);
  } else {
    return sendOpenAICompatible(opts);
  }
}

/**
 * Apply authentication to a request: bearer/x-api-key go to headers,
 * `query-key` is appended to the URL (e.g. Gemini `?key=...`), `none` is a no-op.
 */
export function applyAuth(
  headers: Record<string, string>,
  url: string,
  template: ProviderTemplate,
  apiKey: string
): { headers: Record<string, string>; url: string } {
  const auth = template.auth;
  if (auth.type === 'bearer-header') {
    headers[auth.headerName || 'Authorization'] = `${auth.prefix || 'Bearer '}${apiKey}`;
  } else if (auth.type === 'x-api-key') {
    headers[auth.headerName || 'x-api-key'] = apiKey;
  } else if (auth.type === 'query-key' && apiKey) {
    const sep = url.includes('?') ? '&' : '?';
    url = `${url}${sep}${auth.queryParam || 'key'}=${encodeURIComponent(apiKey)}`;
  }
  return { headers, url };
}

// ── OpenAI-compatible streaming (DeepSeek, OpenAI, custom) ──
async function sendOpenAICompatible(opts: SendOptions): Promise<void> {
  const { template, apiKey, model, messages, signal, callbacks, systemPrompt } = opts;

  const baseUrl = template.baseUrl.replace(/\/$/, '');
  let url = `${baseUrl}${template.endpoints.chat}`;

  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Auth (header or query-key)
  ({ headers, url } = applyAuth(headers, url, template, apiKey));

  // Extra headers
  Object.assign(headers, template.extraHeaders);

  // Build messages
  const payloadMessages = [];
  if (systemPrompt) {
    payloadMessages.push({ role: 'system', content: systemPrompt });
  }
  for (const msg of messages) {
    payloadMessages.push({ role: msg.role, content: msg.content });
  }

  const body = JSON.stringify({
    model,
    messages: payloadMessages,
    stream: true,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('API Key 无效或未授权 (401)。请检查 API Key 是否正确。');
      } else if (response.status === 404) {
        throw new Error(`模型 "${model}" 不存在或不可用 (404)。请检查模型名称。`);
      } else if (response.status === 429) {
        throw new Error('请求被限流 (429)。请稍后重试。');
      } else {
        throw new Error(`API 请求失败 (${response.status})。${errorText}`);
      }
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let fullReasoning = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') {
          callbacks.onDone(fullText);
          return;
        }

        try {
          const json = JSON.parse(data);
          const delta = json.choices?.[0]?.delta;

          if (delta?.reasoning_content) {
            fullReasoning += delta.reasoning_content;
            callbacks.onReasoning?.(delta.reasoning_content);
          }

          if (delta?.content) {
            fullText += delta.content;
            callbacks.onToken(delta.content);
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }
    }

    callbacks.onDone(fullText);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      // User cancelled - don't throw
      callbacks.onDone('');
      return;
    }
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败。请检查网络或 Base URL 是否正确。');
    }
    throw err;
  }
}

// ── Anthropic streaming ──
async function sendAnthropic(opts: SendOptions): Promise<void> {
  const { template, apiKey, model, messages, signal, callbacks, systemPrompt } = opts;

  const baseUrl = template.baseUrl.replace(/\/$/, '');
  const url = `${baseUrl}${template.endpoints.chat}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };

  if (template.auth.type === 'x-api-key') {
    headers[template.auth.headerName || 'x-api-key'] = apiKey;
  }

  Object.assign(headers, template.extraHeaders);

  // Convert messages: system goes separately
  const systemContent = systemPrompt || '';
  const userMessages = messages.map(m => ({
    role: m.role,
    content: m.content,
  }));

  const body = JSON.stringify({
    model,
    system: systemContent,
    messages: userMessages,
    max_tokens: 8192,
    stream: true,
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 401) {
        throw new Error('API Key 无效或未授权 (401)。请检查 API Key 是否正确。');
      } else if (response.status === 404) {
        throw new Error(`模型 "${model}" 不存在或不可用 (404)。`);
      } else if (response.status === 429) {
        throw new Error('请求被限流 (429)。请稍后重试。');
      } else {
        throw new Error(`API 请求失败 (${response.status})。${errorText}`);
      }
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';
    let fullReasoning = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);

        try {
          const json = JSON.parse(data);

          if (json.type === 'content_block_delta') {
            if (json.delta?.type === 'thinking_delta') {
              fullReasoning += json.delta.thinking;
              callbacks.onReasoning?.(json.delta.thinking);
            } else if (json.delta?.type === 'text_delta') {
              fullText += json.delta.text;
              callbacks.onToken(json.delta.text);
            }
          } else if (json.type === 'message_stop') {
            callbacks.onDone(fullText);
            return;
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }
    }

    callbacks.onDone(fullText);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onDone('');
      return;
    }
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败。请检查网络或 Base URL 是否正确。');
    }
    throw err;
  }
}

// ── Gemini streaming (streamGenerateContent, SSE) ──
async function sendGemini(opts: SendOptions): Promise<void> {
  const { template, apiKey, model, messages, signal, callbacks, systemPrompt } = opts;

  const baseUrl = template.baseUrl.replace(/\/$/, '');
  let url = `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;

  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  ({ headers, url } = applyAuth(headers, url, template, apiKey));
  Object.assign(headers, template.extraHeaders);

  // Convert messages: system roles fold into system_instruction; assistant → model
  let systemText = systemPrompt || '';
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    if (msg.role === 'system') {
      systemText = systemText ? `${systemText}\n\n${msg.content}` : msg.content;
      continue;
    }
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  const body = JSON.stringify({
    contents,
    ...(systemText ? { system_instruction: { parts: [{ text: systemText }] } } : {}),
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      if (response.status === 400 && errorText.includes('API key')) {
        throw new Error('API Key 无效 (400)。请检查 Gemini API Key。');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error(`API Key 无效或未授权 (${response.status})。请检查 Gemini API Key。`);
      } else if (response.status === 404) {
        throw new Error(`模型 "${model}" 不存在或不可用 (404)。请检查模型名称。`);
      } else if (response.status === 429) {
        throw new Error('请求被限流 (429)。请稍后重试。');
      } else {
        throw new Error(`API 请求失败 (${response.status})。${errorText.slice(0, 300)}`);
      }
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        if (!trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        try {
          const json = JSON.parse(data);
          const parts = json.candidates?.[0]?.content?.parts;
          if (Array.isArray(parts)) {
            for (const part of parts) {
              if (typeof part?.text === 'string' && part.text) {
                fullText += part.text;
                callbacks.onToken(part.text);
              }
            }
          }
        } catch {
          // Skip invalid JSON chunks
        }
      }
    }

    callbacks.onDone(fullText);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      callbacks.onDone('');
      return;
    }
    if (err instanceof TypeError && err.message.includes('Failed to fetch')) {
      throw new Error('网络连接失败。请检查网络或 Base URL 是否正确。');
    }
    throw err;
  }
}

// ── Test connection ──
export async function testConnection(
  template: ProviderTemplate,
  apiKey: string,
  model: string
): Promise<{ success: boolean; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const baseUrl = template.baseUrl.replace(/\/$/, '');
    let url: string;
    let body: string;

    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (template.compat === 'gemini') {
      // Non-streaming probe for Gemini
      url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
      body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
      });
    } else {
      url = `${baseUrl}${template.endpoints.chat}`;
      body = template.compat === 'anthropic'
        ? JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            max_tokens: 10,
            stream: false,
          })
        : JSON.stringify({
            model,
            messages: [{ role: 'user', content: 'Hi' }],
            stream: false,
            max_tokens: 10,
          });
    }

    ({ headers, url } = applyAuth(headers, url, template, apiKey));
    Object.assign(headers, template.extraHeaders);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      return { success: true, message: '连接成功！模型可用。' };
    } else if (response.status === 401 || response.status === 403) {
      return { success: false, message: `API Key 无效或未授权 (${response.status})。请检查 API Key。` };
    } else if (response.status === 404) {
      return { success: false, message: `模型 "${model}" 不存在 (404)。请检查模型名称。` };
    } else if (response.status === 429) {
      return { success: false, message: '请求被限流 (429)。请稍后重试。' };
    } else {
      const errorText = await response.text().catch(() => '');
      return { success: false, message: `连接失败 (${response.status})。${errorText.slice(0, 200)}` };
    }
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { success: false, message: '连接超时（15s）。请检查网络或 Base URL。' };
    }
    if (err instanceof TypeError) {
      if (template.providerId === 'ollama') {
        return { success: false, message: '无法连接本地 Ollama。请确认 Ollama 已启动（ollama serve），并检查 Base URL。' };
      }
      return { success: false, message: '网络连接失败。请检查网络或 Base URL 是否正确。' };
    }
    return { success: false, message: `连接失败: ${err instanceof Error ? err.message : String(err)}` };
  }
}
