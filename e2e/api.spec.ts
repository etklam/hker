import {test,expect} from '@playwright/test'
test('public restrictive filters cannot silently broaden results',async({request})=>{
 for(const query of ['status=disabled','tagIds=,','tagIds=1,','audience=admin','taxonomy=1&audience=admin']) expect((await request.get(`/api/catalog?${query}`)).status()).toBe(400);
})
test('health and anonymous session endpoints remain available',async({request})=>{expect((await request.get('/api/health')).status()).toBe(200);const session=await request.get('/api/auth/session');expect((await session.json()).user).toBeNull()})
test('public catalog validates search and exposes managed taxonomies',async({request})=>{const result=await request.get('/api/catalog?q=維修');expect(result.status()).toBe(200);expect(Array.isArray((await result.json()).items)).toBe(true);expect((await request.get('/api/catalog?pageSize=10000')).status()).toBe(400);const taxonomy=await request.get('/api/catalog?taxonomy=1');expect((await taxonomy.json()).tags).toBeInstanceOf(Array)})
test('public listing DTO omits internal mutation and ordering fields', async ({ request }) => {
 const response = await request.get('/api/catalog?q=測試維修店');
 expect(response.status()).toBe(200);
 const item = (await response.json()).items[0];
 expect(item.name).toBe('測試維修店');
 for (const key of ['revision','enabled','sortOrder','createdAt','updatedAt','aliases','categoryId','areaId']) expect(item).not.toHaveProperty(key);
 for (const link of item.links) for (const key of ['listingId','enabled','sortOrder','createdAt','updatedAt']) expect(link).not.toHaveProperty(key);
 for (const tag of item.tags) for (const key of ['botVisible','publicVisible','enabled','sortOrder']) expect(tag).not.toHaveProperty(key);
});
