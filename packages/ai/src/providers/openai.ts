/**
 * OpenAI-Compatible Provider
 */

import { AiCompletionRequest, AiProvider } from '../types';

export class OpenAiProvider implements AiProvider {
  public id: 'openai-compatible' = 'openai-compatible';

  constructor(
    private apiKey: string,
    private endpoint: string = 'https://api.openai.com/v1/chat/completions',
    private model: string = 'gpt-4o-mini'
  ) {}

  async complete(req: AiCompletionRequest): Promise<string> {
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: req.system },
          { role: 'user', content: req.user },
        ],
        max_tokens: req.maxTokens || 1000,
        response_format: req.json ? { type: 'json_object' } : undefined,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}
