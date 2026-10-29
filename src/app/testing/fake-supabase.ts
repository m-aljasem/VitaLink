/**
 * Minimal stand-in for the Supabase client: every query-builder method chains,
 * and awaiting the query (or calling single/maybeSingle) resolves to `result`.
 */
export function fakeQuery(result: any): any {
  const query: any = {};
  for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'in', 'gt', 'gte', 'order', 'limit']) {
    query[method] = jasmine.createSpy(method).and.returnValue(query);
  }
  query.single = jasmine.createSpy('single').and.callFake(() => Promise.resolve(result));
  query.maybeSingle = jasmine.createSpy('maybeSingle').and.callFake(() => Promise.resolve(result));
  query.then = (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject);
  return query;
}

export function fakeSupabase(): { from: jasmine.Spy; rpc: jasmine.Spy } {
  return {
    from: jasmine.createSpy('from'),
    rpc: jasmine.createSpy('rpc'),
  };
}

export const NETWORK_ERROR = { message: 'TypeError: Failed to fetch' };
