import { serveConverter } from '../shared/worker-serve';
import { convertJsonToCsv } from './json-to-csv.logic';

serveConverter(convertJsonToCsv);
