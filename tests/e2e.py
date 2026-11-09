"""Real-origin IndexedDB smoke test. Start `node tools/serve.mjs` first.
No memory repository, localStorage replacement or mocked IndexedDB is used.
Exit 2 means environment blocked; it is NOT a pass.
"""
import json,tempfile,os,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('RIXU_TEST_URL','http://127.0.0.1:4173')
checks=[]
def expect(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
def state(page):
 return page.evaluate('async()=>{const m=await import("/app/storage/repository.js");const r=await m.IndexedDbRepository.open();try{return await r.load()}finally{r.close()}}')
def ready(page):page.goto(BASE,wait_until='networkidle');page.wait_for_selector('.tasks-panel')
try:
 with tempfile.TemporaryDirectory(prefix='rixu-idb-test-') as profile, sync_playwright() as p:
  args={'headless':True,'viewport':{'width':390,'height':844},'args':['--no-sandbox']}
  browser_bin=os.environ.get('CHROMIUM_BIN')
  if browser_bin:args['executable_path']=browser_bin
  ctx=p.chromium.launch_persistent_context(profile,**args);page=ctx.pages[0];ready(page)
  expect('real DB boot',len(state(page)['tasks'])==171)
  page.locator('.tasks-panel .icon-button').click();page.locator('[data-testid=task-title]').fill('IndexedDB persistence check');page.locator('[data-testid=task-save]').click();page.wait_for_timeout(250)
  first=next(t for t in state(page)['tasks'] if t['title']=='IndexedDB persistence check');expect('commit version 1',first['version']==1)
  page.reload(wait_until='networkidle');page.wait_for_selector('.tasks-panel');expect('page reload keeps record',any(t['id']==first['id'] for t in state(page)['tasks']))
  page2=ctx.new_page();ready(page2);expect('second tab loads same identity',any(t['id']==first['id'] for t in state(page2)['tasks']))
  ctx.close()
  ctx=p.chromium.launch_persistent_context(profile,**args);page=ctx.pages[0];ready(page);expect('full browser restart keeps record',any(t['id']==first['id'] for t in state(page)['tasks']))
  ctx.close()
 report={'scope':'Real browser IndexedDB / unmocked HTTP origin','status':'passed','checks':checks}
 (ROOT/'qa/real-idb-results.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
except Exception as e:
 blocked='ERR_BLOCKED_BY_ADMINISTRATOR' in str(e)
 report={'scope':'Real browser IndexedDB / unmocked HTTP origin','status':'environment-blocked' if blocked else 'failed','checks':checks,'error':str(e)}
 (ROOT/'qa/real-idb-results.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2));sys.exit(2 if blocked else 1)
