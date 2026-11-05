import { JsonStore, type JsonPath, type JsonRow, type JsonSearchResult, type LoadResult } from './json-logic';

/** Requests the page can send to the engine. They are plain data so they can cross a Worker boundary. */
export type EngineRequest =
  | { method: 'load'; text: string }
  | { method: 'rootRow' }
  | { method: 'children'; path: JsonPath; offset: number; limit: number }
  | { method: 'search'; query: string; scope: 'keys' | 'values' | 'both'; caseSensitive: boolean; limit: number }
  | { method: 'stringify'; path: JsonPath };

export type EngineReply =
  | LoadResult
  | JsonRow
  | { rows: JsonRow[]; total: number }
  | JsonSearchResult
  | { text: string; truncated: boolean };

/** Runs one request against a store. Used inside the worker and by the in-page fallback. */
export function runRequest(store: JsonStore, req: EngineRequest): EngineReply {
  switch (req.method) {
    case 'load':
      return store.load(req.text);
    case 'rootRow':
      return store.rootRow();
    case 'children':
      return store.children(req.path, req.offset, req.limit);
    case 'search':
      return store.search(req.query, req.scope, req.caseSensitive, req.limit);
    case 'stringify':
      return store.stringify(req.path);
  }
}

export interface WorkerEnvelope {
  id: number;
  request: EngineRequest;
}

export interface WorkerResponse {
  id: number;
  reply?: EngineReply;
  error?: string;
}

/**
 * The page-side handle on a JsonStore. With a Worker the parsed document lives off the main thread and only
 * small answers are copied back; without one (no Worker support, or it failed to start) the same store runs in
 * the page, in which case big files may briefly block it.
 */
export class JsonEngine {
  private worker: Worker | null = null;
  private local: JsonStore | null = null;
  private pending = new Map<number, { resolve: (r: EngineReply) => void; reject: (e: Error) => void }>();
  private nextId = 0;
  /** True when the document is being served from the main thread. */
  usingFallback = false;

  constructor(private readonly createWorker: () => Worker) {}

  private ensureWorker(): Worker | null {
    if (this.worker) return this.worker;
    if (typeof Worker === 'undefined') return null;
    try {
      const worker = this.createWorker();
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const slot = this.pending.get(event.data.id);
        if (!slot) return;
        this.pending.delete(event.data.id);
        if (event.data.error !== undefined) slot.reject(new Error(event.data.error));
        else slot.resolve(event.data.reply as EngineReply);
      };
      worker.onerror = () => this.failWorker();
      this.worker = worker;
      return worker;
    } catch {
      return null;
    }
  }

  private failWorker(): void {
    this.worker?.terminate();
    this.worker = null;
    for (const slot of this.pending.values()) slot.reject(new Error('worker-failed'));
    this.pending.clear();
  }

  async request<T extends EngineReply>(req: EngineRequest): Promise<T> {
    if (!this.usingFallback) {
      const worker = req.method === 'load' ? this.ensureWorker() : this.worker;
      if (worker) {
        try {
          return await new Promise<T>((resolve, reject) => {
            const id = ++this.nextId;
            this.pending.set(id, { resolve: resolve as (r: EngineReply) => void, reject });
            worker.postMessage({ id, request: req } satisfies WorkerEnvelope);
          });
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'worker-failed' || req.method !== 'load') throw error;
          // The worker could not run: serve this document from the page instead.
        }
      }
      this.usingFallback = true;
    }
    if (req.method === 'load') this.local = new JsonStore();
    if (!this.local) throw new Error('No document loaded');
    return runRequest(this.local, req) as T;
  }

  dispose(): void {
    this.worker?.terminate();
    this.worker = null;
    this.local = null;
    this.pending.clear();
  }
}
