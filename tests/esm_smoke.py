"""Real Chromium module semantics, no HTTP navigation or storage claims.
Loads the shipped Vue global build AS AN ES MODULE using a Blob URL, exactly
preserving the scoping that caused the old blank screen. No network is used.
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
vendor=(ROOT/'dist/vendor/vue.global.js').read_text()
fixed=(ROOT/'dist/vendor/vue.mjs').read_text()
old="import './vue.global.js'; export const {createApp}=globalThis.__RIXU_VUE;"
report={'scope':'Chromium ESM Blob fixture; no HTTP, IndexedDB or Windows test','checks':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for name,adapter,should_pass in [('old-adapter-reproduces-error',old,False),('fixed-adapter-mounts-template',fixed,True)]:
  page=b.new_page(viewport={'width':390,'height':844})
  page.set_content('<div id="app"></div>')
  result=page.evaluate('''async ([vendor,adapter])=>{
    const make=s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}));
    const a=make(vendor),url=make(adapter.replace("'./vue.global.js'",JSON.stringify(a)));
    let caught='';
    try {
      const m=await import(url);
      const app=m.createApp({data:()=>({title:'Rixu startup OK'}),template:'<main><h1>{{title}}</h1></main>'});
      app.config.errorHandler=e=>{caught=e.message};
      app.mount('#app');
      await globalThis.__RIXU_VUE.nextTick();
      return {text:document.body.innerText,error:caught,globalVue:typeof globalThis.Vue};
    }catch(e){return {error:e.message,text:document.body.innerText}}
    finally{URL.revokeObjectURL(a);URL.revokeObjectURL(url)}
  }''',[vendor,adapter])
  ok=('Rixu startup OK' in result.get('text','') and not result.get('error')) if should_pass else 'Vue is not defined' in result.get('error','')
  report['checks'].append({'name':name,'passed':ok,'result':result})
  page.close()
 # Broken application entry produces a readable error without touching storage.
 page=b.new_page()
 page.set_content('<div id="boot-status">Loading</div><div id="app"></div>')
 page.add_script_tag(content=(ROOT/'dist/boot-guard.js').read_text())
 page.evaluate("window.__rixuBoot.fail(new Error('Simulated missing module'))")
 ok=page.locator('#boot-status[data-status=failed]').count()==1 and 'Simulated missing module' in page.locator('#boot-status').inner_text()
 report['checks'].append({'name':'bootstrap-failure-visible','passed':ok})
 page.close();b.close()
report['status']='passed' if all(x['passed'] for x in report['checks']) else 'failed'
(ROOT/'qa/esm-startup-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(0 if report['status']=='passed' else 1)
