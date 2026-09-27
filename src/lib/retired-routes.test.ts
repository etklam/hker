import { describe, expect, it, vi } from 'vitest';
import { isRetiredPath, retiredPaths } from './retired-routes';
import { POST as register } from '@/app/api/auth/register/route';
import { GET as featured } from '@/app/api/featured/route';
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));
import BillsLayout from '@/app/(main)/bills/layout';
import RegistrationLayout from '@/app/(auth)/register/layout';
describe('retired server entry points', () => {
  it('covers every retired subtree without blocking similarly named paths', () => {
    for (const path of retiredPaths) { expect(isRetiredPath(path)).toBe(true); expect(isRetiredPath(`${path}/child`)).toBe(true); expect(isRetiredPath(`${path}-new`)).toBe(false); }
    expect(isRetiredPath('/api/admin/catalog')).toBe(false);
  });
  it('disables registration and featured data without middleware', () => {
    expect(register().status).toBe(410);
    expect(featured().status).toBe(410);
  });
  it('rejects retired page trees at server rendering', () => {
    expect(() => BillsLayout()).toThrow('NEXT_NOT_FOUND');
    expect(() => RegistrationLayout()).toThrow('NEXT_NOT_FOUND');
  });
});
