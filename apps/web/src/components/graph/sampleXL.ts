/**
 * Sample XL: a large, densely cross-linked demo workspace for exploring the
 * graph at scale. Loaded in a single transaction; idempotent via its root.
 */

import { HecateDatabase } from '@hecate/storage';
import { formatDate, NodeRecord } from '@hecate/core';

export async function loadSampleXL(db: HecateDatabase): Promise<void> {
  const existing = await db.adapter.query<any>(
    "SELECT id FROM node WHERE content = 'Sample Workspace XL' AND deleted_at IS NULL"
  );
  if (existing.length > 0) return;

  const tagCache = new Map<string, string>();
  async function tagId(name: string): Promise<string> {
    if (tagCache.has(name)) return tagCache.get(name)!;
    let tag = await db.tags.getTagByName(name);
    if (!tag) tag = await db.tags.createTag(name, { color: '#c4b2ff', showCheckbox: name === 'task' });
    tagCache.set(name, tag.id);
    return tag.id;
  }

  await db.adapter.transaction(async () => {
    async function mk(content: string, parentId: string, tagName?: string): Promise<NodeRecord> {
      const node = await db.nodes.create({ parent_id: parentId, content });
      if (tagName) await db.tags.applyTag(node.id, await tagId(tagName));
      return node;
    }

    const root = await db.nodes.create({ content: 'Sample Workspace XL' });

    // 1. Four projects, each with 5 workstreams of 12 tasks (+ subtasks)
    const projectNames = ['Apollo', 'Hecate v2', 'Personal OS', 'Health reboot'];
    const streamNames = ['Research', 'Design', 'Build', 'Review', 'Ship'];
    const taskPool: NodeRecord[] = [];
    for (const pname of projectNames) {
      const project = await mk(pname, root.id, 'project');
      for (const sname of streamNames) {
        const stream = await mk(`${pname} · ${sname}`, project.id, 'project');
        for (let i = 1; i <= 12; i++) {
          const task = await mk(`${sname} task ${i}`, stream.id, 'task');
          taskPool.push(task);
          for (let s = 1; s <= i % 3; s++) {
            await mk(`Subtask ${s} of ${sname} task ${i}`, task.id);
          }
        }
      }
    }

    // 2. Library: 50 books with 6 chapter notes each
    const library = await mk('Library XL', root.id);
    const bookPool: NodeRecord[] = [];
    const topics = ['Systems', 'Habits', 'Design', 'Cognition', 'History', 'Craft', 'Biology', 'Code', 'Mind', 'Networks'];
    for (let i = 1; i <= 50; i++) {
      const book = await mk(`${topics[i % topics.length]} book ${i}`, library.id, 'book');
      bookPool.push(book);
      for (let c = 1; c <= 6; c++) {
        await mk(`Chapter ${c} notes`, book.id);
      }
    }

    // 3. People + meetings
    const peopleRoot = await mk('People XL', root.id);
    const peoplePool: NodeRecord[] = [];
    const names = ['Maya', 'Jonas', 'Priya', 'Sam', 'Alex', 'Nina', 'Theo', 'Ravi', 'Lena', 'Omar',
      'Iris', 'Kai', 'Noor', 'Elif', 'Hugo', 'Zoe', 'Milo', 'Sana', 'Yuki', 'Leah',
      'Arun', 'Bea', 'Cole', 'Dara', 'Eli', 'Faye', 'Gus', 'Hana', 'Ivan', 'Jade',
      'Kira', 'Liam', 'Mona', 'Nate', 'Opal', 'Pia', 'Quinn', 'Rosa', 'Seth', 'Tara'];
    for (const name of names) {
      peoplePool.push(await mk(name, peopleRoot.id, 'person'));
    }
    const meetingsRoot = await mk('Meetings XL', root.id);
    for (let i = 0; i < 80; i++) {
      const a = peoplePool[i % peoplePool.length];
      const b = peoplePool[(i + 11) % peoplePool.length];
      await mk(`Session ${i + 1} with [[node:${a.id}]] and [[node:${b.id}]]`, meetingsRoot.id, 'meeting');
    }

    // 4. 90 days of daily notes, cross-linked to tasks and books
    for (let d = 0; d < 90; d++) {
      const date = new Date();
      date.setDate(date.getDate() - d);
      const dayNode = await db.nodes.getOrCreateDayNode(formatDate(date));
      for (let j = 0; j < 6; j++) {
        const task = taskPool[(d * 6 + j) % taskPool.length];
        const book = bookPool[(d + j * 3) % bookPool.length];
        await mk(`Worked on [[node:${task.id}]] and read [[node:${book.id}]]`, dayNode.id);
      }
    }

    // 5. Idea web: 30 ideas with 6 cross-linked notes each
    const ideasRoot = await mk('Idea web XL', root.id);
    const ideaPool: NodeRecord[] = [];
    for (let i = 1; i <= 30; i++) {
      ideaPool.push(await mk(`Idea ${i}: emergent structure`, ideasRoot.id, 'idea'));
    }
    for (const idea of ideaPool) {
      for (let n = 1; n <= 6; n++) {
        const other = ideaPool[(ideaPool.indexOf(idea) + n * 3) % ideaPool.length];
        await mk(`Note ${n} linking [[node:${idea.id}]] to [[node:${other.id}]]`, idea.id);
      }
    }

    // 6. Habit/health cluster: 12 habits with 10 logs each
    const habitsRoot = await mk('Habits XL', root.id);
    const habitNames = ['Reading', 'Jogging', 'Meditation', 'Sleep', 'Water', 'Journal',
      'Stretching', 'Walking', 'No sugar', 'Deep work', 'Practice', 'Review'];
    for (const h of habitNames) {
      const habit = await mk(h, habitsRoot.id, 'habit');
      for (let log = 1; log <= 10; log++) {
        await mk(`${h} log ${log}`, habit.id);
      }
    }
  });
}
