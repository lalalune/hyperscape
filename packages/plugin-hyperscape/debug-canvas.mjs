import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: false });
const page = await browser.newPage();

// Enable detailed console logging
page.on('console', msg => {
  const text = msg.text();
  if (text.includes('Client') || text.includes('Graphics') || text.includes('canvas') || text.includes('RPG')) {
    console.log(`[${msg.type()}] ${text}`);
  }
});

page.on('pageerror', error => {
  console.error('[PAGE ERROR]', error.message);
});

console.log('Loading page...');
await page.goto('http://localhost:4444');
await page.waitForTimeout(5000); // Wait for app to initialize

// Debug what's actually on the page
const bodyHTML = await page.$eval('body', el => el.innerHTML);
console.log('\nBody HTML (first 500 chars):');
console.log(bodyHTML.substring(0, 500));

// Look for any canvas elements
const canvases = await page.$$('canvas');
console.log(`\nFound ${canvases.length} canvas elements`);

for (let i = 0; i < canvases.length; i++) {
  const canvas = canvases[i];
  const props = await canvas.evaluate(el => ({
    id: el.id,
    className: el.className,
    width: el.width,
    height: el.height,
    parentId: el.parentElement?.id,
    parentClass: el.parentElement?.className
  }));
  console.log(`Canvas ${i}:`, props);
}

// Check for viewport
const viewport = await page.$('.App__viewport');
console.log('\nViewport exists:', !!viewport);

// Keep browser open for manual inspection
console.log('\nBrowser will stay open for 10 seconds for inspection...');
await page.waitForTimeout(10000);

await browser.close();