import { readWorkbook } from './excel-to-json.logic';

/** Opens an .xlsx off the main thread: receives the file's ArrayBuffer, replies with the sheets as rows of cells. */
interface WorkerScope {
  onmessage: ((event: { data: ArrayBuffer }) => void) | null;
  postMessage(message: unknown): void;
}

const scope = globalThis as unknown as WorkerScope;
scope.onmessage = async (event) => {
  scope.postMessage(await readWorkbook(event.data));
};
