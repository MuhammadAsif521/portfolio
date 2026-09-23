import type { PaginationMeta } from '../components/custom-paginator/custom-paginator';
import type { PaginatedResponse } from '../interfaces/auth.interface';

/** Maps the API's `{ total, limit, page, pages }` onto the paginator/table component's PaginationMeta. */
export function toPaginationMeta(response: Pick<PaginatedResponse<unknown>, 'total' | 'limit' | 'page' | 'pages'>): PaginationMeta {
  return {
    currentPage: response.page,
    totalPages: response.pages,
    totalItems: response.total,
    pageSize: response.limit,
  };
}
