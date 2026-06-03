import { chromium } from 'playwright';

async function run(headless) {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless,
    args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan']
  });
  const page = await browser.newPage();
  await page.goto('http://localhost:3333/?embedded=true&mode=spectator&followEntity=agent-openai-gpt-5', { waitUntil: 'domcontentloaded', timeout: 30000 });
  const state = await page.evaluate(async () => {
    const hasGpu = Boolean(navigator.gpu);
    let adapter = null;
    try {
      adapter = hasGpu ? Boolean(await navigator.gpu.requestAdapter()) : false;
    } catch {
      adapter = false;
    }
    return {
      hasGpu,
      hasAdapter: adapter,
      hasWorld: Boolean(window.world),
      cfg: window.__HYPERIA_CONFIG__ || null,
    };
  });
  console.log('headless='+headless, JSON.stringify(state));
  await browser.close();
}

try { await run(true); } catch (e) { console.error('headless true failed', e?.message || e); }
try { await run(false); } catch (e) { console.error('headless false failed', e?.message || e); }
