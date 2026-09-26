import {test,expect} from '@playwright/test'
for(const path of ['/bills','/spaces','/me/collections','/tools','/marketplace','/api/featured','/api/me/subscriptions','/api/admin/collections/1'])test(`legacy route ${path} is retired`,async({request})=>{expect((await request.get(path)).status()).toBe(410)})
