import { serveConverter } from '../shared/worker-serve';
import { convertYamlToJson } from './yaml-to-json.logic';

serveConverter(convertYamlToJson);
