/**
 * Mock AI Provider for testing and offline execution
 */

import { AiCompletionRequest, AiProvider } from '../types';

export class MockProvider implements AiProvider {
  public id: 'mock' = 'mock';
  public shouldFailMalformedCount = 0;

  async complete(req: AiCompletionRequest): Promise<string> {
    if (this.shouldFailMalformedCount > 0) {
      this.shouldFailMalformedCount--;
      return 'Malformed text not JSON';
    }

    let topics = ['Deep Work', 'Design Systems', 'Daily Notes'];
    let summary = 'You have focused on structuring your outliner workspace and personal reading goals this week.';

    try {
      const parsedUser = JSON.parse(req.user);
      if (parsedUser.digest && parsedUser.digest.length > 0) {
        const first = parsedUser.digest[0];
        if (first.tags && first.tags.length > 0) {
          topics = first.tags.map((t: string) => `#${t}`);
        }
      }
    } catch {}

    const payload = {
      summary,
      topics: topics.slice(0, 5),
      tasks: [
        {
          title: 'Read a book chapter for 15 minutes',
          rationale: 'You captured notes on Deep Work earlier.',
          category: 'learning',
          duration_min: 15,
        },
        {
          title: 'Go for a 20-minute restorative walk',
          rationale: 'Balancing focus sessions with physical movement.',
          category: 'health',
          duration_min: 20,
        },
        {
          title: 'Send a quick update to a close collaborator',
          rationale: 'Nurturing relationships and staying connected.',
          category: 'relationships',
          duration_min: 10,
        },
        {
          title: 'Organize your physical desk or workspace',
          rationale: 'Clearing your physical space aids mental clarity.',
          category: 'home',
          duration_min: 10,
        },
      ],
    };

    return JSON.stringify(payload, null, 2);
  }
}
