import { workspace } from '@/lib/workspace';
export async function logout() {
  const result = await workspace('logout', {});
  if (result.ok) window.location.assign('/login');
  else window.alert(result.error);
}
