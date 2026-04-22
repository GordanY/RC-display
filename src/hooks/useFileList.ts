import { useEffect, useState } from 'react';
import { listFiles } from '../admin/api';

// Polls the server for files in a directory under public/artifacts/.
// Used by the admin forms to stay in sync with the actual disk state — if
// someone deletes a file via the OS file manager, the listing updates within
// ~1s and the form can show "檔案遺失" / refresh the format-toggle indicators.
export function useFileList(dir: string, intervalMs = 1000): string[] {
  const [files, setFiles] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const next = await listFiles(dir);
        if (alive) setFiles(next);
      } catch (err) {
        // Transient network/server errors are OK — next tick retries. But log
        // so the next time the API contract drifts (e.g. missing route on the
        // Flask launcher returning index.html as JSON), it surfaces in the
        // console rather than silently leaving every upload as "檔案遺失".
        console.warn(`useFileList: failed to list "${dir}":`, err);
      }
    };
    void poll();
    const id = setInterval(poll, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [dir, intervalMs]);

  return files;
}
