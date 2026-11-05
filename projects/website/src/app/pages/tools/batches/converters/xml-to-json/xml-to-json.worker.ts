import { serveConverter } from '../shared/worker-serve';
import { convertXmlToJson } from './xml-to-json.logic';

serveConverter(convertXmlToJson);
