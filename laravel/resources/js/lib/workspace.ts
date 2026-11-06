export async function workspace(path: string, data?: unknown): Promise<any> {
  try {
    const token = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '';
    const response = await fetch(`/workspace/${path}`, {
      method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': token, 'X-Requested-With': 'XMLHttpRequest' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const result = await response.json();
    return response.ok ? result : { ok: false, error: result.message || result.error || 'The request could not be saved. Refresh and try again.' };
  } catch { return { ok: false, error: 'Connection interrupted. Your form is unchanged; please retry.' }; }
}
