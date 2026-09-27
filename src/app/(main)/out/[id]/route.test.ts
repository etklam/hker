import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({after:vi.fn(),enabled:vi.fn(),link:vi.fn(),record:vi.fn(),allow:vi.fn()}));
vi.mock('next/server',()=>({after:mocks.after}));
vi.mock('@/server/catalog/analytics',()=>({analyticsEnabled:mocks.enabled,enabledOutboundLink:mocks.link,recordCatalogEvent:mocks.record}));
vi.mock('@/server/catalog/abuse',()=>({allowCatalogRequest:mocks.allow}));
import {GET} from './route';
describe('stored outbound redirects',()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.enabled.mockReturnValue(true);mocks.link.mockResolvedValue({id:1,url:'https://example.com/Branch#Contact'});});
 it('returns before slow analytics or rate limiting starts',async()=>{
  mocks.allow.mockImplementation(()=>new Promise(()=>{}));
  const response=await GET(new Request('https://hker.example/out/1'),{params:Promise.resolve({id:'1'})});
  expect(response.status).toBe(302);expect(response.headers.get('Location')).toBe('https://example.com/Branch#Contact');
  expect(mocks.after).toHaveBeenCalledOnce();expect(mocks.allow).not.toHaveBeenCalled();expect(mocks.record).not.toHaveBeenCalled();
 });
 it('never accepts a destination URL or unavailable stored link',async()=>{
  expect((await GET(new Request('https://hker.example/out/evil'),{params:Promise.resolve({id:'https://evil.example'})})).status).toBe(404);
  mocks.link.mockResolvedValue(null);
  expect((await GET(new Request('https://hker.example/out/1'),{params:Promise.resolve({id:'1'})})).status).toBe(404);
  expect(mocks.after).not.toHaveBeenCalled();
 });
 it('redirects without counting prefetch and preview requests',async()=>{
  for(const headers of [{purpose:'prefetch'},{'user-agent':'Slackbot-LinkExpanding 1.0'}]){
   vi.clearAllMocks();mocks.enabled.mockReturnValue(true);mocks.link.mockResolvedValue({id:1,url:'https://example.com/Branch#Contact'});
   const response=await GET(new Request('https://hker.example/out/1',{headers}),{params:Promise.resolve({id:'1'})});
   expect(response.status).toBe(302);expect(mocks.after).not.toHaveBeenCalled();
  }
 });
});
