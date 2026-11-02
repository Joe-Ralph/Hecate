/**
 * Anthropic Messages API Provider
 */

import { AiCompletionRequest, AiProvider } from '../types';

export class AnthropicProvider implements AiProvider {
  public id: 'anthropic' = 'anthropic';

  constructor(
    private apiKey: string,
    private model: string = 'claude-3-5-sonnet-20241022',
    private proxyUrl?: string
  ) {}

  async complete(req: AiCompletionRequest): Promise<string> {
    const url = this.proxyUrl || 'https://api.anthropic.com/v1/messages';

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: req.maxTokens || 1000,
        system: req.system,
        messages: [{ role: 'user', content: req.user }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
}
