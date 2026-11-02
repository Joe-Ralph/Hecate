/**
 * Ollama Local Provider (Fully on-device)
 */

import { AiCompletionRequest, AiProvider } from '../types';

export class OllamaProvider implements AiProvider {
  public id: 'ollama' = 'ollama';

  constructor(
    private endpoint: string = 'http://localhost:11434/api/generate',
    private model: string = 'llama3'
  ) {}

  async complete(req: AiCompletionRequest): Promise<string> {
    const prompt = `${req.system}\n\nUser Data:\n${req.user}`;

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        format: req.json ? 'json' : undefined,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Ollama error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    return data.response || '';
  }
}
