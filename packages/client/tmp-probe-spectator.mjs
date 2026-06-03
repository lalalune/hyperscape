import { chromium } from 'playwright';

const url = 'http://localhost:3333/?embedded=true&mode=spectator&followEntity=agent-openai-gpt-5';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const logs = [];
page.on('console', (msg) => {
  const text = msg.text();
  if (/spectator|camera|terrain|entity|snapshot|error|warn|lock|follow|loading/i.test(text)) {
    logs.push(`[console:${msg.type()}] ${text}`);
  }
});
page.on('pageerror', (err) => logs.push(`[pageerror] ${err?.message || err}`));

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

const samples = [];
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(1000);
  const sample = await page.evaluate(() => {
    const w = window;
    const world = w.world;
    const cfg = w.__HYPERIA_CONFIG__ || null;
    const targetId = cfg?.followEntity || cfg?.characterId || 'agent-openai-gpt-5';

    const getPos = (e) => {
      if (!e) return null;
      const p = e.position || e.data?.position || e.model?.position || null;
      if (!p) return null;
      const x = Number(p.x ?? p[0] ?? 0);
      const y = Number(p.y ?? p[1] ?? 0);
      const z = Number(p.z ?? p[2] ?? 0);
      return { x, y, z };
    };

    const players = world?.entities?.players;
    const items = world?.entities?.items;
    const target = players?.get?.(targetId) || items?.get?.(targetId) || null;
    const cameraSystem = world?.getSystem?.('client-camera-system') || world?.getSystem?.('client-camera') || world?.getSystem?.('camera');
    const cam = cameraSystem?.camera;
    const camPos = cam?.position ? { x: cam.position.x, y: cam.position.y, z: cam.position.z } : null;
    const cameraTarget = cameraSystem?.target || cameraSystem?.targetEntity || cameraSystem?.followTarget || null;
    const cameraTargetId = cameraTarget?.id || cameraTarget?.characterId || cameraTarget?.data?.id || null;
    const cameraTargetPos = getPos(cameraTarget);

    const terrain = world?.getSystem?.('terrain');
    const tileMap = terrain?._tileMap;
    const tileCount = tileMap?.size ?? null;

    let minDist = null;
    const targetPos = getPos(target);
    if (targetPos && tileMap?.values) {
      for (const tile of tileMap.values()) {
        const c = tile?.center || tile?.worldCenter || tile?.position || null;
        if (!c) continue;
        const dx = Number(c.x || 0) - targetPos.x;
        const dz = Number(c.z || 0) - targetPos.z;
        const d = Math.sqrt(dx * dx + dz * dz);
        if (minDist == null || d < minDist) minDist = d;
      }
    }

    const lockText = Array.from(document.querySelectorAll('div,p,span'))
      .map((el) => (el.textContent || '').trim())
      .find((t) => /Locking camera to target|Preparing spectator viewport|Loading world|Joining world/i.test(t)) || null;

    return {
      t: Date.now(),
      cfgMode: cfg?.mode || null,
      cfgTarget: targetId,
      hasWorld: Boolean(world),
      targetFound: Boolean(target),
      targetPos,
      cameraTargetId,
      cameraTargetPos,
      camPos,
      tileCount,
      nearestTileDistToTarget: minDist,
      lockText,
      playerCount: players?.size ?? null,
      itemCount: items?.size ?? null,
    };
  });
  samples.push(sample);
}

await page.screenshot({ path: '/Users/shawwalters/eliza-workspace/hyperia/tmp-spectator-probe.png', fullPage: true });
await browser.close();

console.log('=== SAMPLES ===');
for (const s of samples) {
  console.log(JSON.stringify(s));
}
console.log('=== LOGS ===');
for (const l of logs.slice(-200)) console.log(l);
