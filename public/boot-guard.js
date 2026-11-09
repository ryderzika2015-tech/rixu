/* Independent startup guard: no Vue, no storage writes, no external network. */
(() => {
  let mounted = false;
  const box = document.getElementById('boot-status');
  if (!box) return;
  const fail = error => {
    if (mounted) return;
    clearTimeout(timer);
    box.replaceChildren();
    const title = document.createElement('h2');
    title.textContent = '\u65e5\u5e8f\u542f\u52a8\u5931\u8d25';
    const message = document.createElement('p');
    message.textContent = '\u8bf7\u5148\u91cd\u8bd5\uff0c\u4e0d\u8981\u6e05\u9664\u6d4f\u89c8\u5668\u6570\u636e\u3002';
    const detail = document.createElement('pre');
    detail.textContent = String(error && error.message || error || 'Unknown startup error');
    detail.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;max-width:100%';
    const retry = document.createElement('button');
    retry.textContent = '\u91cd\u65b0\u52a0\u8f7d';
    retry.onclick = () => location.reload();
    box.append(title, message, detail, retry);
    box.dataset.status = 'failed';
  };
  const timer = setTimeout(() => fail('Startup timed out. Open F12 > Console and check tools/doctor.mjs.'), 15000);
  window.__rixuBoot = {
    fail,
    mounted() { mounted = true; clearTimeout(timer); box.remove(); }
  };
  window.addEventListener('error', event => {
    const resource = event.target;
    if (resource && resource.tagName === 'SCRIPT') fail('Cannot load script: ' + (resource.src || '(inline)'));
    else if (event.error || event.message) fail(event.error || event.message);
  }, true);
  window.addEventListener('unhandledrejection', event => fail(event.reason));
})();
