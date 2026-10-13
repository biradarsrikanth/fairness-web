import { listQueryParams, matSort, pagingParams, parseListState, sortChange } from './list-state';

const config = { sortable: ['triggeredAt', 'severity'], defaultSort: 'triggeredAt,desc' };

describe('list state', () => {
  it('reads page, size and sort from the URL', () => {
    const state = parseListState({ page: '2', size: '50', sort: 'severity,asc' }, config);
    expect(state).toEqual({ page: 2, size: 50, sort: 'severity,asc' });
    expect(pagingParams(state)).toEqual({ page: 2, size: 50, sort: ['severity,asc'] });
    expect(matSort(state)).toEqual({ active: 'severity', direction: 'asc' });
  });

  it('falls back to the defaults for values the gateway would refuse', () => {
    expect(parseListState({ page: '-1', size: '1000', sort: 'title,asc' }, config)).toEqual({
      page: 0,
      size: 20,
      sort: 'triggeredAt,desc',
    });
    expect(parseListState({ sort: 'severity,sideways' }, config).sort).toBe('triggeredAt,desc');
  });

  it('keeps the defaults out of the URL', () => {
    expect(listQueryParams({ page: 0, size: 20, sort: 'triggeredAt,desc' }, config)).toEqual({
      page: null,
      size: null,
      sort: null,
    });
  });

  it('goes back to page one when the sort changes, and to the default when it is cleared', () => {
    expect(sortChange({ active: 'severity', direction: 'desc' }, config)).toEqual({
      sort: 'severity,desc',
      page: null,
    });
    expect(sortChange({ active: 'severity', direction: '' }, config)).toEqual({
      sort: null,
      page: null,
    });
  });
});
