import { Sort, SortDirection } from '@angular/material/sort';
import { Params } from '@angular/router';

/** The gateway's page sizes: 20 by default, at most 100. */
export const PAGE_SIZES = [20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;

/**
 * Which page of a list is shown, kept in the URL (?page=&size=&sort=field,dir) with the list's filters.
 * Pages count from 0 as the gateway's do; the URL leaves out the defaults.
 */
export interface ListState {
  readonly page: number;
  readonly size: number;
  /** field,asc or field,desc; one of the list's sortable fields */
  readonly sort: string;
}

export interface ListConfig {
  /** The fields the gateway sorts this list by */
  readonly sortable: readonly string[];
  /** e.g. triggeredAt,desc */
  readonly defaultSort: string;
}

function nonNegativeInt(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  return Number(value);
}

/** The list state from query parameters; anything unusable falls back to the defaults. */
export function parseListState(params: Params, config: ListConfig): ListState {
  const size = nonNegativeInt(params['size']);
  const sort = typeof params['sort'] === 'string' ? params['sort'] : '';
  const [field, direction] = sort.split(',');
  const validSort =
    config.sortable.includes(field) && (direction === 'asc' || direction === 'desc');
  return {
    page: nonNegativeInt(params['page']) ?? 0,
    size: size !== null && PAGE_SIZES.includes(size) ? size : DEFAULT_PAGE_SIZE,
    sort: validSort ? sort : config.defaultSort,
  };
}

/** Query parameters for the router; defaults become null, which removes them from the URL. */
export function listQueryParams(state: ListState, config: ListConfig): Params {
  return {
    page: state.page === 0 ? null : state.page,
    size: state.size === DEFAULT_PAGE_SIZE ? null : state.size,
    sort: state.sort === config.defaultSort ? null : state.sort,
  };
}

/** Paging parameters for a gateway list operation. */
export function pagingParams(state: ListState): { page: number; size: number; sort: string[] } {
  return { page: state.page, size: state.size, sort: [state.sort] };
}

/** The sort as MatSort shows it. */
export function matSort(state: ListState): { active: string; direction: SortDirection } {
  const [active, direction] = state.sort.split(',');
  return { active, direction: direction as SortDirection };
}

/** A MatSort change as a sort parameter; clearing the sort goes back to the default. Back to page one. */
export function sortChange(sort: Sort, config: ListConfig): Params {
  const value = sort.direction ? `${sort.active},${sort.direction}` : config.defaultSort;
  return { sort: value === config.defaultSort ? null : value, page: null };
}
