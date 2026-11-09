from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import datetime, timezone
import json
ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'qa'/'test-harness.html').read_text(encoding='utf-8')
checks=[];errs=[]
def check(title, condition):
    checks.append((title,bool(condition)))
    print(('PASS ' if condition else 'FAIL ')+title,flush=True)
def eval_(p,expr,arg=None):return p.evaluate(expr,arg)
def read(p):return eval_(p,'__test.read()')
def open_(p,name,payload=None):
    eval_(p,'([name,payload])=>__test.module("ui.js").open(name,payload)',[name,payload or {}]);p.wait_for_timeout(80)
def close(p):eval_(p,'__test.module("ui.js").stack.value=[]');p.wait_for_timeout(40)
with sync_playwright() as w:
    b=w.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    p=b.new_page(viewport={'width':390,'height':844},timezone_id='Asia/Shanghai',locale='zh-CN')
    p.clock.install(time=datetime(2026,11,9,8,tzinfo=timezone.utc))
    p.on('pageerror',lambda x:errs.append(str(x)))
    p.set_content(HTML,wait_until='load')
    p.wait_for_function('window.__test&&__test.store.ready.value')
    # Chinese spoken amount and editable fields.
    open_(p,'capture',{'mode':'ledger'})
    p.locator('[data-testid=capture-text]').fill('我吃饭花了八元，')
    p.locator('[data-testid=capture-parse]').click()
    check('Chinese amount becomes selectable expense',p.locator('.candidate').count()==1 and p.locator('input[inputmode=decimal]').input_value()=='8.00' and p.locator('[data-testid=capture-save]').is_enabled())
    p.locator('input[inputmode=decimal]').fill('8.50')
    p.locator('.candidate .span-full input').fill('食堂,早餐')
    p.locator('.candidate input[type=date]').fill('2026-11-08')
    p.locator('[data-testid=capture-save]').click();p.wait_for_timeout(90)
    transactions=read(p)['transactions'];check('edited amount/date/tags go into formal ledger',len(transactions)==1 and transactions[0]['amount']==850 and transactions[0]['date']=='2026-11-08' and len(transactions[0]['tagIds'])==2)
    # A true draft is not an accounting entry.
    open_(p,'capture',{'mode':'ledger'})
    p.locator('[data-testid=capture-text]').fill('今天午饭花了')
    p.locator('[data-testid=capture-parse]').click()
    check('pending candidate does not enable formal save',not p.locator('[data-testid=capture-save]').is_enabled())
    p.locator('.candidate .secondary').first.click()
    p.locator('input[inputmode=decimal]').fill('12.50')
    check('pending candidate can be resolved',p.locator('[data-testid=capture-save]').is_enabled())
    p.locator('[data-testid=capture-save]').click();p.wait_for_timeout(100)
    check('resolved entry reaches ledger',len(read(p)['transactions'])==2)
    open_(p,'capture',{'mode':'ledger'})
    p.locator('[data-testid=capture-text]').fill('准备花点钱')
    p.locator('.form-footer .secondary').click();p.wait_for_timeout(80)
    check('save draft goes to inbox only',len(read(p)['drafts'])==1 and len(read(p)['transactions'])==2)
    # Live time is included, independently of the task being completed.
    first=read(p)['tasks'][0]['id'];open_(p,'focusSetup',{'id':first})
    p.locator('.mode-options button').first.click()
    p.locator('[data-testid=focus-minutes]').fill('1')
    p.locator('[data-testid=focus-start]').click();p.wait_for_timeout(80)
    p.clock.fast_forward(12000)
    amount=eval_(p,'()=>{const m=__test.module("domain/statistics.js"),s=__test.read();return m.timeGroups(s,"2026-11-09","2026-11-09",Date.now()).reduce((n,x)=>n+x.seconds,0)}')
    check('active learning mode counts before settling',amount>=11 and amount<=13)
    p.locator('.focus-top button').click();p.wait_for_timeout(70)
    check('learning mode continues when returning to home',read(p)['settings'][0]['activeFocus']['paused']==False)
    eval_(p,'()=>__test.module("ui.js").focusOpen.value=true');p.wait_for_timeout(40)
    p.locator('.focus-controls .focus-secondary').click();p.locator('[data-testid=focus-save]').click();p.wait_for_timeout(90)
    check('focus session is recorded without finishing task',len(read(p)['sessions'])==1 and read(p)['tasks'][0]['progress']==0)
    # Strict mode should pause on pressing back.
    open_(p,'focusSetup',{'id':first});p.locator('.mode-options button').nth(1).click();p.locator('[data-testid=focus-start]').click();p.wait_for_timeout(90)
    p.clock.fast_forward(9000)
    p.locator('.focus-top button').click();p.wait_for_timeout(95)
    check('strict mode pauses when focus view is exited',read(p)['settings'][0]['activeFocus']['paused']==True)
    eval_(p,'()=>__test.module("ui.js").focusOpen.value=true');p.wait_for_timeout(40)
    p.locator('.focus-controls .focus-secondary').click();p.locator('[data-testid=focus-save]').click();p.wait_for_timeout(70)
    # Review range and present statistics.
    eval_(p,'()=>__test.module("ui.js").navigate("review")');p.wait_for_timeout(80)
    for period,label in [('month','本月'),('quarter','本季度'),('half','本半年'),('year','本年度'),('custom','选定日期')]:
        p.locator('.range-select').select_option(period);p.wait_for_timeout(50)
        check('review '+period, label in p.locator('.period-hint').inner_text() and p.locator('.report-insights p').count()>=3)
    # Reminder frequency and single-task snooze / restore / permanent stop.
    close(p)
    eval_(p,'async()=>{await __test.store.execute(s=>{let x=s.tasks[0];x.deadline="2026-11-11T20:00";s.settings[0].quiet=false;});}')
    open_(p,'reminders');p.wait_for_timeout(90)
    check('reminder settings have frequency and snooze controls',p.locator('text=每个节点最多提醒几次').count()>0 and p.locator('text=再次提醒间隔').count()>0 and p.locator('text=本任务不再提醒').count()>0)
    p.locator('text=本任务不再提醒').first.click();p.wait_for_timeout(80)
    check('reminder can be stopped per-task',read(p)['tasks'][0]['reminders']['mode']=='off')
    p.locator('details').last.locator('summary').click();p.locator('text=恢复提醒').first.click();p.wait_for_timeout(80)
    check('stopped reminder can be restored',read(p)['tasks'][0]['reminders']['mode']=='default')
    check('no Vue exceptions',len(errs)==0)
    b.close()
print('TOTAL',len(checks),'PASS',sum(x[1] for x in checks),'FAIL',sum(not x[1] for x in checks))
if not all(x[1] for x in checks):raise SystemExit(1)
