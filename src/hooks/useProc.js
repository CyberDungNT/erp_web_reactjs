import { useCallback, useEffect, useRef, useState } from 'react';
import { callProc } from '@/api/apiClient';

/**
 * Gọi proc theo kiểu hook, tự động gọi khi mount hoặc khi params đổi.
 *
 *   const { table, tables, loading, error, reload } = useProc('GetData', [1, 2]);
 *   const { run } = useProc('SaveData', null, { auto: false });  // gọi tay: await run([...])
 */
export function useProc(name, params, { auto = true } = {}) {
  const [state, setState] = useState({ tables: [], table: [], loading: auto, error: null });
  const paramsKey = JSON.stringify(params ?? null);
  const latest = useRef(0);

  const run = useCallback(
    async (overrideParams) => {
      const id = ++latest.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const res = await callProc(name, overrideParams ?? JSON.parse(paramsKey));
        if (id === latest.current) setState({ ...res, loading: false, error: null });
        return res;
      } catch (err) {
        if (id === latest.current) setState((s) => ({ ...s, loading: false, error: err.message }));
        throw err;
      }
    },
    [name, paramsKey]
  );

  useEffect(() => {
    if (auto && name) run().catch(() => {});
  }, [auto, name, run]);

  return { ...state, run, reload: run };
}
