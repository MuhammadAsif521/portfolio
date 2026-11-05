import { serveConverter } from '../shared/worker-serve';
import { convertCsvToJson } from './csv-to-json.logic';

serveConverter(convertCsvToJson);
