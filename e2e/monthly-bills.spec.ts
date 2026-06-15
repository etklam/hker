import { test, expect, type APIRequestContext } from '@playwright/test';

const RUN_ID = Date.now().toString(36);
const USER_A_EMAIL = `mvp-a-${RUN_ID}@hker.test`;
const USER_B_EMAIL = `mvp-b-${RUN_ID}@hker.test`;
const PASSWORD = 'TestPass!1';

async function registerUser(
  request: APIRequestContext,
  email: string,
  displayName: string,
) {
  const res = await request.post('/api/auth/register', {
    data: { email, password: PASSWORD, displayName },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function createSpace(request: APIRequestContext, name: string) {
  const res = await request.post('/api/spaces', { data: { name } });
  expect(res.status()).toBe(201);
  return res.json();
}

async function createInvite(request: APIRequestContext, spaceId: number) {
  const res = await request.post(`/api/spaces/${spaceId}/invites`, {
    data: { maxUses: 5, expiresInHours: 24 },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function joinByInvite(
  request: APIRequestContext,
  token: string,
) {
  const res = await request.post(`/api/spaces/invites/${token}/join`);
  return { status: res.status(), body: await res.json().catch(() => null) };
}

async function createBillList(
  request: APIRequestContext,
  name: string,
  sharedSpaceId: number | null,
) {
  const res = await request.post('/api/monthly-bills/lists', {
    data: { name, sharedSpaceId },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function createBill(
  request: APIRequestContext,
  listId: number,
  data: { name: string; dueDay: number; amountCents?: number },
) {
  const res = await request.post(`/api/monthly-bills/lists/${listId}/items`, {
    data,
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function setChecked(
  request: APIRequestContext,
  itemId: number,
  year: number,
  month: number,
  checked: boolean,
) {
  const res = await request.patch(`/api/monthly-bills/items/${itemId}/check`, {
    data: { year, month, checked },
  });
  expect(res.status()).toBe(204);
}

async function getBoard(
  request: APIRequestContext,
  year: number,
  month: number,
  listId?: number,
) {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (listId) params.set('listId', String(listId));
  const res = await request.get(`/api/monthly-bills?${params}`);
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe.serial('Monthly Bills MVP smoke', () => {
  test('register -> create space -> invite -> bills -> check paid', async ({ browser }) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // --- User A registers (cookie sticks to contextA) ---
    const contextA = await browser.newContext({
      extraHTTPHeaders: { Origin: 'http://localhost:3000' },
    });
    const reqA = contextA.request;
    await registerUser(reqA, USER_A_EMAIL, 'User A');

    // --- Create space ---
    const space = await createSpace(reqA, 'Family');
    expect(space.name).toBe('Family');
    const spaceId = space.id;

    // --- Create invite ---
    const invite = await createInvite(reqA, spaceId);
    const token = invite.token;
    expect(token).toBeTruthy();

    // --- User B registers in own context ---
    const contextB = await browser.newContext({
      extraHTTPHeaders: { Origin: 'http://localhost:3000' },
    });
    const reqB = contextB.request;
    await registerUser(reqB, USER_B_EMAIL, 'User B');

    // --- User B joins via invite ---
    const join = await joinByInvite(reqB, token);
    expect([200, 201]).toContain(join.status);

    // --- User A creates bill list shared with space ---
    const list = await createBillList(reqA, 'Home Bills', spaceId);
    expect(list.sharedSpaceId).toBe(spaceId);
    const listId = list.id;

    // --- Add bill ---
    const bill = await createBill(reqA, listId, {
      name: 'Rent',
      dueDay: 5,
      amountCents: 128000,
    });
    const itemId = bill.id;
    expect(itemId).toBeGreaterThan(0);

    // --- Verify unpaid state ---
    const before = await getBoard(reqA, year, month, listId);
    expect(before.items).toHaveLength(1);
    expect(before.items[0].checkedAt).toBeNull();

    // --- Check paid ---
    await setChecked(reqA, itemId, year, month, true);

    // --- Verify paid state via API ---
    const after = await getBoard(reqA, year, month, listId);
    expect(after.items[0].checkedAt).not.toBeNull();
    expect(after.items[0].status).toBe('paid');

    // --- Verify UI shows paid state ---
    const pageA = await contextA.newPage();
    await pageA.goto(`/tools/monthly-bills?listId=${listId}`);
    await expect(pageA).toHaveURL(/\/tools\/monthly-bills/);

    // Summary tile shows 1/1 paid (locale-agnostic)
    await expect(pageA.locator('text=1/1')).toBeVisible({ timeout: 10_000 });

    await contextA.close();
    await contextB.close();
  });
});
