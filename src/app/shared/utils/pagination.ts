/** The page size every list endpoint uses unless `page_size` is sent. */
export const PAGE_SIZE = 20;

export interface PageRange {
  /** 1-based number of the first and last row on this page (0 when empty). */
  from: number;
  to: number;
  totalPages: number;
}

/** "Showing 21-40 of 57" and "page 2 of 3" for a list that has `count` rows in all. */
export function pageRange(count: number, page: number, pageSize = PAGE_SIZE): PageRange {
  if (count === 0) return { from: 0, to: 0, totalPages: 1 };

  return {
    from: (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, count),
    totalPages: Math.ceil(count / pageSize),
  };
}
