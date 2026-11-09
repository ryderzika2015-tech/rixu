"""Real Chromium/Vue UI with injected memory Repository.
The managed browser forbids URL navigation, so this test does NOT exercise
IndexedDB, real HTTP module loading, durable reload, Android or notifications.
Use tests/e2e.py on an unrestricted local machine for real IndexedDB checks.
"""
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
import json,traceback
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'qa/test-harness.html').read_text()
RESULTS=[];ERRORS=[]
def check(name,condition,detail=None):
    RESULTS.append({'name':name,'passed':bool(condition),'detail':detail})
    print(('PASS ' if condition else 'FAIL ')+name+((' '+str(detail)) if not condition else ''),flush=True)
def ev(p,js,arg=None):return p.evaluate(js,arg)
def data(p):return ev(p,'__test.read()')
def open_(p,name,payload=None):
    ev(p,'([name,payload])=>__test.module("ui.js").open(name,payload)',[name,payload or {}]);p.wait_for_timeout(60)
def close_(p):
    ev(p,'__test.module("ui.js").stack.value=[]');p.wait_for_timeout(50)
def nav(p,name):
    close_(p);ev(p,'x=>__test.module("ui.js").navigate(x)',name);p.wait_for_timeout(60)
def shot(p,name):
    ev(p,"__test.store.notice.value=''");p.screenshot(path=str(ROOT/'qa'/f'{name}.png'),full_page=False,animations='disabled')
def boot(ctx,fixture=None):
    p=ctx.new_page();p.set_default_timeout(5000);p.on('pageerror',lambda e:ERRORS.append(str(e)));p.on('console',lambda m:ERRORS.append(m.text) if m.type=='error' else None)
    p.clock.install(time=datetime(2026,11,9,8,tzinfo=timezone.utc))
    if fixture:p.evaluate('x=>window.__fixture=x',fixture)
    p.set_content(HTML,wait_until='load');p.wait_for_function('window.__test&&__test.store.ready.value',timeout=10000)
    return p
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,locale='zh-CN',timezone_id='Asia/Shanghai',reduced_motion='reduce',is_mobile=True,has_touch=True)
    p=boot(ctx)
    try:
        check('Vue boot, 171 tasks, zero fake transactions',len(data(p)['tasks'])==171 and not data(p)['transactions'])
        check('five navigation controls',p.locator('.bottom-nav>button').count()==5)
        check('independent Vue component tree, no iframe',p.locator('iframe').count()==0 and ev(p,'!!document.querySelector("#app").__vue_app__'))
        shot(p,'today')
        # Actual task form save / progress / stale version.
        p.locator('.tasks-panel .icon-button').click()
        p.locator('[data-testid=task-title]').fill('Regression task')
        p.locator('[data-testid=task-save]').click();p.wait_for_timeout(150)
        created=next(x for x in data(p)['tasks'] if x['title']=='Regression task')
        check('new task goes through Repository commit',created['version']==1 and len(data(p)['tasks'])==172)
        open_(p,'task',{'id':created['id']});p.locator('[data-testid=task-title]').fill('Regression edited');p.locator('[data-testid=task-save]').click();p.wait_for_timeout(120)
        check('task edit keeps ID and increments version',next(x for x in data(p)['tasks'] if x['id']==created['id'])['version']==2)
        stale=created
        result=ev(p,'async x=>{try{await __test.store.saveTask(x,"Study",[]);return false}catch(e){return e.message}}',stale)
        check('stale editor rejected without overwriting newer version',result=='CONFLICT' and next(x for x in data(p)['tasks'] if x['id']==created['id'])['title']=='Regression edited')
        # All route and editor templates must actually compile in Vue.
        first=data(p)['tasks'][0]['id']; goal=data(p)['goals'][0]['id']
        for name,payload in [('agenda',{}),('goal',{'id':goal}),('transaction',{}),('plans',{}),('taxonomy',{}),('backup',{}),('planner',{}),('focusSetup',{'id':first}),('knowledge',{'key':'listening'}),('search',{}),('trash',{}),('inbox',{}),('allTasks',{}),('reminders',{}),('about',{})]:
            close_(p);before=len(ERRORS);open_(p,name,payload)
            check('dialog compiles '+name,p.locator('[role=dialog]').count()==1 and len(ERRORS)==before,ERRORS[before:])
        close_(p)
        # Quick capture specific reported regression.
        nav(p,'ledger');p.locator('.bottom-nav .nav-add').click();p.locator('[data-testid=capture-text]').fill('\u4eca\u5929\u4e2d\u5348\u5403\u996d\u82b1\u4e8619.2\uff0c\u7136\u540e\u5462\uff0c\u4e2d\u5348\u4e70\u4e86\u836f\uff0c\u82b1\u4e8628.8')
        p.locator('[data-testid=capture-parse]').click();p.wait_for_timeout(80)
        check('ledger capture two selectable candidates',p.locator('.candidate').count()==2 and '48.00' in p.locator('.capture-summary').inner_text())
        shot(p,'capture');before=len(data(p)['tasks']);p.locator('[data-testid=capture-save]').click();p.wait_for_timeout(120)
        check('ledger saved two cents records without creating tasks',len(data(p)['transactions'])==2 and sum(x['amount'] for x in data(p)['transactions'])==4800 and len(data(p)['tasks'])==before)
        # Store boundary independent of UI parser.
        r=ev(p,'async()=>{try{await __test.store.saveCapture([{kind:"task",selected:true,title:"Wrong",date:"2026-11-09"}],"ledger");return false}catch(e){return e.message}}')
        check('ledger write boundary rejects task candidates',r=='LEDGER_BOUNDARY')
        p.locator('.bottom-nav .nav-add').click();p.locator('[data-testid=capture-text]').fill('\u51c6\u5907\u4e70\u836f\u5927\u698230');p.locator('[data-testid=capture-parse]').click();p.locator('.form-footer .secondary').click();p.wait_for_timeout(120)
        check('ambiguous amount saved to inbox only',len(data(p)['drafts'])==1 and len(data(p)['transactions'])==2)
        shot(p,'ledger')
        # Plan importer preview / duplicate / rollback.
        open_(p,'plans');p.locator('.import-drop').click()
        fixture={'format':'rixu.plan.v1','id':'ui-plan','name':'Test import','tasks':[{'date':'2026-11-11','title':'Prepare report','estimate':30},{'date':'2026-11-12','title':'Submit report','type':'memo','deadline':'2026-11-12T20:00','estimate':15}], 'goals':[{'title':'Reading goal','date':'2026-12-15','kind':'habit'}]}
        old=len(data(p)['tasks']);p.locator('[data-testid=plan-file]').set_input_files({'name':'plan.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});p.wait_for_timeout(100)
        check('file preview has no data writes',len(data(p)['tasks'])==old and p.locator('[data-testid=plan-confirm]').is_enabled())
        shot(p,'plan-preview');p.locator('[data-testid=plan-confirm]').click();p.wait_for_timeout(130)
        check('file import adds tasks and goal atomically',len(data(p)['tasks'])==old+2 and any(x['title']=='Reading goal' for x in data(p)['goals']))
        p.locator('.import-drop').click();p.locator('[data-testid=plan-file]').set_input_files({'name':'plan.json','mimeType':'application/json','buffer':json.dumps(fixture).encode()});p.wait_for_timeout(70)
        check('duplicate confirmation disabled',p.locator('[data-testid=plan-confirm]').is_disabled())
        close_(p);open_(p,'agenda');check('memos and all goals immediately visible',p.locator('.memo-row').count()==1 and p.locator('.goal-card').count()==2);shot(p,'agenda')
        close_(p)
        # category edits via actual UI
        open_(p,'taxonomy');p.locator('.sheet .tabs button').nth(1).click();p.locator('.taxon-entry').first.locator('button').first.click();p.locator('.taxon-entry input').fill('Meals');p.locator('.taxon-entry .link').click();p.wait_for_timeout(120)
        check('category rename keeps expense references valid',any(x['name']=='Meals' for x in data(p)['taxa']) and sum(x['amount'] for x in data(p)['transactions'])==4800)
        p.locator('.taxon-entry').filter(has_text='Meals').locator('button').last.click();p.locator('.delete-area .danger').click();p.wait_for_timeout(120)
        check('category delete reroutes expenses without money change',all(next(c for c in data(p)['taxa'] if c['id']==x['categoryId']).get('deletedAt') is None for x in data(p)['transactions']) and sum(x['amount'] for x in data(p)['transactions'])==4800)
        shot(p,'taxonomy');close_(p)
        # focus persistent timestamps / UI / settlement
        nav(p,'today');open_(p,'focusSetup',{'id':first});p.locator('[data-testid=focus-minutes]').fill('1');p.locator('[data-testid=focus-start]').click();p.wait_for_timeout(80)
        check('focus overlay is full viewport',p.locator('.focus-screen').is_visible())
        shot(p,'focus');p.clock.fast_forward(12000);p.locator('.focus-controls .focus-primary').click();p.wait_for_timeout(100)
        active=data(p)['settings'][0]['activeFocus'];check('pause retains elapsed seconds',11.9<=active['accumulated']<=13 and active['paused'],active['accumulated'])
        p.clock.fast_forward(20000);check('paused time does not accumulate',data(p)['settings'][0]['activeFocus']['accumulated']==active['accumulated'])
        p.locator('.focus-controls .focus-secondary').click();p.locator('[data-testid=focus-save]').click();p.wait_for_timeout(100)
        check('early finish saves one session without completing task',len(data(p)['sessions'])==1 and next(x for x in data(p)['tasks'] if x['id']==first)['progress']==0 and data(p)['settings'][0]['activeFocus'] is None)
        # continuation and immutable history
        awaitval=ev(p,'async id=>{await __test.store.execute(s=>{let x=s.tasks.find(x=>x.id===id);x.progress=20});return true}',first)
        open_(p,'planner',{'date':'2026-11-09'});p.locator('.carry-row input').first.check();shot(p,'planner');p.locator('.form-footer .primary').click();p.wait_for_timeout(120)
        check('evening carry keeps original day and remaining quantity',next(x for x in data(p)['tasks'] if x['id']==first)['date']=='2026-11-09' and any(x.get('carriedFrom')==first and x['quantity']==30 for x in data(p)['tasks']))
        # backup malformed rejection has no writes; valid merge doesn't duplicate
        close_(p);open_(p,'backup');snapshot=ev(p,'__test.store.exportBackup()');before=len(data(p)['tasks'])
        p.locator('[data-testid=backup-file]').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"tasks":[],"goals":[],"transactions":[{"amount":1.2}]}'});p.wait_for_timeout(80)
        check('bad backup rejected without partial writes',len(data(p)['tasks'])==before and p.locator('.backup-preview').count()==0)
        p.locator('[data-testid=backup-file]').set_input_files({'name':'good.json','mimeType':'application/json','buffer':json.dumps(snapshot).encode()});p.wait_for_timeout(80)
        p.locator('.backup-preview .primary').click();p.wait_for_timeout(150)
        check('backup merge retains record identities and counts',len(data(p)['tasks'])==before and len(data(p)['transactions'])==2)
        check('before-merge recovery snapshot excludes recursive recovery',all(not x['raw']['data']['recovery'] for x in data(p)['recovery'] if x['reason']=='before-merge'))
        # recycle persisted contract
        rid=data(p)['transactions'][0]['id'];ev(p,'id=>__test.store.remove("transactions",id)',rid);open_(p,'trash');p.locator('.recovery-row .link').first.click();p.wait_for_timeout(100)
        check('recycle restores exact financial record ID',not next(x for x in data(p)['transactions'] if x['id']==rid).get('deletedAt'))
        # Idempotent capture batch and replacement restore are separate safety checks.
        q=ev(p,'''async()=>{const c=[{kind:"transaction",title:"Batch",date:"2026-11-09",amount:100,type:"expense",category:"Other",raw:"Batch",selected:true}];await __test.store.saveCapture(c,"ledger","idempotent-test");await __test.store.saveCapture(c,"ledger","idempotent-test");return __test.read().transactions.filter(x=>x.title==="Batch").length}''')
        check('duplicate save batch creates exactly one expense',q==1)
        ev(p,'x=>__test.store.importBackup(x.data,true)',snapshot)
        check('backup replacement revives retained records instead of leaving tombstones',sum(not x.get('deletedAt') for x in data(p)['transactions'])==2)
        # Data rehydration with injected snapshot, not IDB durability.
        snapshot=data(p);p2=boot(ctx,snapshot);check('snapshot rehydration renders saved record state',sum(not x.get('deletedAt') for x in data(p2)['transactions'])==2 and len(data(p2)['sessions'])==1);p2.close()
        # navigation and mobile layout
        for name in ['calendar','ledger','review','settings']:
            nav(p,name);check('page renders '+name,not p.locator('.boot').count());shot(p,name)
        nav(p,'calendar');boxes=[p.locator('.weekday').nth(i).bounding_box() for i in range(7)];check('calendar has seven columns',len({round(x['x']) for x in boxes})==7)
        for width in [320,360,390,430]:
            p.set_viewport_size({'width':width,'height':844});nav(p,'today')
            check('no horizontal overflow '+str(width),ev(p,'document.documentElement.scrollWidth<=innerWidth'))
            open_(p,'agenda');check('sheet fits phone '+str(width),ev(p,'document.querySelector(".sheet").getBoundingClientRect().right<=innerWidth'))
            close_(p)
        p.set_viewport_size({'width':1440,'height':1000});nav(p,'today');shot(p,'desktop')
        check('no Vue runtime errors',not ERRORS,ERRORS)
    except Exception:
        check('test sequence completed',False,traceback.format_exc());print(traceback.format_exc());shot(p,'failure')
    finally:
        report={'scope':'Real Vue/Chromium UI with memory Repository injection; NOT IndexedDB persistence verification','passed':sum(x['passed'] for x in RESULTS),'failed':sum(not x['passed'] for x in RESULTS),'tests':RESULTS,'runtimeErrors':ERRORS}
        (ROOT/'qa/ui-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));browser.close()
print('TOTAL',len(RESULTS),'PASS',report['passed'],'FAIL',report['failed'])
if report['failed']:raise SystemExit(1)
