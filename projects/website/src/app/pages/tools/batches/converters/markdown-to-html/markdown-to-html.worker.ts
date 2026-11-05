import { serveConverter } from '../shared/worker-serve';
import { convertMarkdown } from './markdown-to-html.logic';

serveConverter(convertMarkdown);
