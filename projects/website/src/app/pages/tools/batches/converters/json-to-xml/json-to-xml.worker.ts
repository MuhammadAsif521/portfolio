import { serveConverter } from '../shared/worker-serve';
import { convertJsonToXml } from './json-to-xml.logic';

serveConverter(convertJsonToXml);
