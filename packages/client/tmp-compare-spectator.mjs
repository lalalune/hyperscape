import { chromium } from 'playwright';

const urls = [
  'http://localhost:3333/?embedded=true&mode=spectator',
  'http://localhost:3333/?embedded=true&mode=spectator&followEntity=agent-openai-gpt-5',
  'http://localhost:3333/?embedded=true&mode=spectator&followEntity=agent-openai-gpt-4-1',
  'http://localhost:3333/?embedded=true&mode=spectator&followEntity=agent-openai-gpt-4-1-mini',
];

for (const [idx, url] of urls.entries()) {
  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-webgpu','--ignore-gpu-blocklist','--enable-features=Vulkan']
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const logs = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/spectator|camera|follow|snapshot|error|warn|target|loading/i.test(text)) logs.push(`[${msg.type()}] ${text}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(15000);

  const state = await page.evaluate(() => {
    const world = window.world;
    const cfg = window.__HYPERIA_CONFIG__ || null;
    const net = world?.getSystem?.('network');
    const cam = world?.getSystem?.('client-camera-system') || world?.getSystem?.('client-camera') || world?.getSystem?.('camera');
    const target = cam?.target || cam?.targetEntity || cam?.followTarget || null;
    const tid = target?.id || target?.characterId || target?.data?.id || null;
    const toPos = (p) => p ? {x:Number(p.x ?? p[0] ?? 0), y:Number(p.y ?? p[1] ?? 0), z:Number(p.z ?? p[2] ?? 0)} : null;
    const tpos = toPos(target?.position || target?.data?.position || target?.model?.position || null);
    const players = world?.entities?.players;
    const items = world?.entities?.items;
    const playerList = [];
    if (players?.entries) {
      for (const [id, e] of players.entries()) {
        const p = toPos(e?.position || e?.data?.position || null);
        playerList.push({id, pos:p, inStreamingDuel: e?.data?.inStreamingDuel === true});
      }
    }
    return {
      cfg,
      netId: net?.id || null,
      spectatorFollowEntity: net?.spectatorFollowEntity || null,
      targetId: tid,
      targetPos: tpos,
      playerCount: players?.size ?? null,
      itemCount: items?.size ?? null,
      players: playerList,
      loadingText: (document.body?.innerText || '').slice(0, 220)
    };
  });

  console.log(`=== URL ${idx+1} ===`);
  console.log(url);
  console.log(JSON.stringify(state));
  console.log('--- logs ---');
  for (const l of logs.slice(-60)) console.log(l);
  await page.screenshot({ path: `/Users/shawwalters/eliza-workspace/hyperia/tmp-spectator-compare-${idx+1}.png`, fullPage: true });
  await browser.close();
}
