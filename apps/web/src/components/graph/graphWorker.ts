import { DEFAULT_GRAPH_FORCES, ForceEngine, GraphForceSettings, TUNING } from './physics';
import { GraphPositionsMessage, GraphWorkerRequest } from './protocol';

let engine: ForceEngine | null = null;
let revision = 0;
let forces: GraphForceSettings = { ...DEFAULT_GRAPH_FORCES };
let timer: ReturnType<typeof setTimeout> | null = null;

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<GraphWorkerRequest>) => void) | null;
  postMessage: (message: GraphPositionsMessage, transfer: Transferable[]) => void;
};

function publish() {
  if (!engine) return;
  const state = engine.snapshotState();
  const ids = [...state.keys()];
  const buffer = new ArrayBuffer(ids.length * 2 * 4);
  const coordinates = new Float32Array(buffer);
  ids.forEach((id, index) => {
    const point = state.get(id)!;
    coordinates[index * 2] = point.x;
    coordinates[index * 2 + 1] = point.y;
  });
  scope.postMessage(
    {
      type: 'positions',
      revision,
      ids,
      buffer,
      alpha: engine.alpha,
      settled: engine.alpha <= TUNING.settleAlpha,
    },
    [buffer]
  );
}

function schedule() {
  if (timer !== null || !engine || engine.alpha <= TUNING.settleAlpha) return;
  timer = setTimeout(() => {
    timer = null;
    if (!engine) return;
    const hot = engine.tick();
    publish();
    if (hot) schedule();
  }, 1000 / 60);
}

scope.onmessage = (event) => {
  const message = event.data;
  if (message.type === 'dispose') {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    engine = null;
    return;
  }
  if (message.type === 'set-data') {
    revision = message.revision;
    forces = message.forces;
    const previous = engine && !message.reset ? engine.snapshotState() : undefined;
    engine = new ForceEngine(message.data, message.communities, previous, forces);
    if (!previous) for (let i = 0; i < 120; i++) engine.tick();
    engine.reheat(previous ? 0.3 : 1);
    publish();
    schedule();
    return;
  }
  if (message.type === 'set-forces') {
    revision = message.revision;
    forces = message.forces;
    const previous = engine?.snapshotState();
    engine = new ForceEngine(message.data, message.communities, previous, forces);
    engine.reheat(0.3);
    publish();
    schedule();
    return;
  }
  if (!engine) return;
  if (message.type === 'pin') {
    engine.setFixed(message.id, message.x, message.y);
    engine.reheat(0.3);
    publish();
    schedule();
  } else if (message.type === 'unpin') {
    engine.clearFixed(message.id);
    engine.reheat(0.12);
    schedule();
  } else if (message.type === 'reheat') {
    engine.reheat(message.alpha);
    schedule();
  }
};
