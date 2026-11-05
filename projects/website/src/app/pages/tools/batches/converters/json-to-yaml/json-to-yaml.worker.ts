import { serveConverter } from '../shared/worker-serve';
import { convertJsonToYaml } from './json-to-yaml.logic';

serveConverter(convertJsonToYaml);
