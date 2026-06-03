import { chromium } from 'playwright';

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan']
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const logs = [];
page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => logs.push(`[pageerror] ${err?.stack || err?.message || err}`));

await page.goto('http://localhost:3333/?embedded=true&mode=spectator&followEntity=agent-openai-gpt-5', { waitUntil: 'domcontentloaded', timeout: 30000 });

for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const cfg = window.__HYPERIA_CONFIG__ || null;
    const world = window.world || null;
    const text = document.body?.innerText || '';
    return {
      i: performance.now(),
      hasWorld: Boolean(world),
      cfg,
      text: text.slice(0, 300),
      ready: document.readyState,
      hasCanvas: !!document.querySelector('canvas'),
    };
  });
  console.log('STATE', JSON.stringify(state));
}

await page.screenshot({ path: '/Users/shawwalters/eliza-workspace/hyperia/tmp-webgpu-probe.png', fullPage: true });
console.log('===LOGS===');
for (const l of logs) {
  if (/error|warn|spectator|camera|world|physx|gpu|network|snapshot|follow|lock|loading/i.test(l)) {
    console.log(l);
  }
}
await browser.close();
