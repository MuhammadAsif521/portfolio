import { type Signal, signal } from '@angular/core';
import { type ConvertResult, type Converter, WORKER_THRESHOLD, fail, failFromException } from './convert-common';
import type { WorkerRequest } from './worker-serve';

/** What the result panel needs: the latest finished result (kept while a newer one is computing), and the busy state. */
export interface RunView {
  result: ConvertResult | null;
  /** 'none' when idle, 'small' while converting on the page, 'big' while a large input converts in a worker. */
  busy: 'none' | 'small' | 'big';
  ms: number;
}

interface RunnerConfig<O> {
  /** The conversion; also what the worker runs. */
  convert: Converter<O>;
  /** `() => new Worker(new URL('./x.worker', import.meta.url), { type: 'module' })`: the literal must sit in the tool file. */
  createWorker: () => Worker;
}

const DEBOUNCE_MS = 140;
const DEBOUNCE_BIG_MS = 450;

/**
 * Live conversion for one tool: debounced, stale results are dropped, and inputs above ~1 MB run in a Web
 * Worker (terminated when a newer run starts) so typing and scrolling never freeze. Where Workers do not
 * exist (tests, very old browsers) the conversion runs on the page instead.
 */
export class ConvertRunner<O> {
  private readonly view = signal<RunView>({ result: null, busy: 'none', ms: 0 });
  readonly state: Signal<RunView> = this.view.asReadonly();

  private timer: ReturnType<typeof setTimeout> | undefined;
  private seq = 0;
  private worker: Worker | null = null;

  constructor(private readonly config: RunnerConfig<O>) {}

  run(text: string, options: O): void {
    clearTimeout(this.timer);
    this.stopWorker();
    const id = ++this.seq;
    if (!text.trim()) {
      this.view.set({ result: null, busy: 'none', ms: 0 });
      return;
    }
    const big = text.length > WORKER_THRESHOLD;
    this.view.update((v) => ({ ...v, busy: big ? 'big' : 'small' }));
    this.timer = setTimeout(() => void this.execute(id, text, options, big), big ? DEBOUNCE_BIG_MS : DEBOUNCE_MS);
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.seq++;
    this.stopWorker();
  }

  private async execute(id: number, text: string, options: O, big: boolean): Promise<void> {
    const started = Date.now();
    const finish = (result: ConvertResult) => {
      if (id === this.seq) this.view.set({ result, busy: 'none', ms: Date.now() - started });
    };
    try {
      if (big && typeof Worker !== 'undefined') {
        finish(await this.inWorker(text, options));
      } else {
        finish(await this.config.convert(text, options));
      }
    } catch (error) {
      finish(failFromException(error, 'page'));
    }
  }

  private inWorker(text: string, options: O): Promise<ConvertResult> {
    return new Promise<ConvertResult>((resolve) => {
      let worker: Worker;
      try {
        worker = this.config.createWorker();
      } catch {
        // No module workers: convert on the page rather than fail.
        this.config.convert(text, options).then(resolve, (e) => resolve(failFromException(e, 'page')));
        return;
      }
      this.worker = worker;
      worker.onmessage = (event: MessageEvent<ConvertResult>) => {
        if (this.worker === worker) this.worker = null;
        worker.terminate();
        resolve(event.data);
      };
      worker.onerror = () => {
        if (this.worker === worker) this.worker = null;
        worker.terminate();
        resolve(fail('The converter stopped before it finished. The input is probably too large for this browser tab; try a smaller file.'));
      };
      const request: WorkerRequest<O> = { text, options };
      worker.postMessage(request);
    });
  }

  private stopWorker(): void {
    this.worker?.terminate();
    this.worker = null;
  }
}
