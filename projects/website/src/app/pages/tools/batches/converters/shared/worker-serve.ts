import { type ConvertResult, type Converter, failFromException } from './convert-common';

/** Request and reply of the converter Web Workers (plain data, so it survives structured cloning). */
export interface WorkerRequest<O> {
  text: string;
  options: O;
}

interface WorkerScope {
  onmessage: ((event: { data: WorkerRequest<never> }) => void) | null;
  postMessage(message: ConvertResult): void;
}

/** Entry point of a converter worker: `serveConverter(convertJsonToCsv)`. */
export function serveConverter<O>(convert: Converter<O>): void {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = async (event) => {
    const { text, options } = event.data as unknown as WorkerRequest<O>;
    try {
      scope.postMessage(await convert(text, options));
    } catch (error) {
      scope.postMessage(failFromException(error, 'worker'));
    }
  };
}
