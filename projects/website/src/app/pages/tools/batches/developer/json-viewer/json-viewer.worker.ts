import { runRequest, type WorkerEnvelope, type WorkerResponse } from './json-engine';
import { JsonStore } from './json-logic';

interface WorkerScope {
  onmessage: ((event: { data: WorkerEnvelope }) => void) | null;
  postMessage(message: WorkerResponse): void;
}

/** Holds the parsed document and answers the page's small requests, so a 50 MB file never blocks the page. */
const scope = globalThis as unknown as WorkerScope;
const store = new JsonStore();

scope.onmessage = (event) => {
  const { id, request } = event.data;
  try {
    scope.postMessage({ id, reply: runRequest(store, request) });
  } catch (error) {
    scope.postMessage({ id, error: error instanceof Error ? error.message : 'failed' });
  }
};
