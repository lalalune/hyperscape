#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const css = fs.readFileSync(
  path.join(
    workspaceRoot,
    "packages/client/src/components/streaming/StreamingOverlay.css",
  ),
  "utf8",
);
const captureDirectoryInput = process.env.STREAMING_LAYOUT_CAPTURE_DIR?.trim();
const captureDirectory = captureDirectoryInput
  ? path.resolve(workspaceRoot, captureDirectoryInput)
  : null;
if (captureDirectory) {
  fs.mkdirSync(captureDirectory, { recursive: true });
}

const viewports = [
  { name: "hd-landscape", width: 1280, height: 720 },
  { name: "full-hd", width: 1920, height: 1080 },
  { name: "square", width: 1080, height: 1080 },
  { name: "mobile-portrait", width: 390, height: 844 },
  { name: "vertical-video", width: 1080, height: 1920 },
  { name: "mobile-landscape", width: 844, height: 390 },
];

function frozenLoadouts(side) {
  return `
    <section class="streaming-frozen-loadouts streaming-frozen-loadouts--${side}" data-loadout-fingerprint="0123456789abcdef">
      <div class="streaming-frozen-loadouts-header"><span>Frozen loadouts</span><span class="streaming-frozen-loadouts-fingerprint">01234567</span></div>
      <div class="streaming-frozen-loadouts-list">
        <div class="streaming-frozen-loadout-entry"><span class="streaming-frozen-loadout-role">melee</span><span class="streaming-frozen-loadout-details">Bronze Longsword · Wooden Shield</span></div>
        <div class="streaming-frozen-loadout-entry"><span class="streaming-frozen-loadout-role">ranged</span><span class="streaming-frozen-loadout-details">Shortbow · Iron Arrow</span></div>
        <div class="streaming-frozen-loadout-entry"><span class="streaming-frozen-loadout-role">mage</span><span class="streaming-frozen-loadout-details">Air Staff · Wind Strike</span></div>
      </div>
    </section>`;
}

function agentCard(side, showFrozenLoadouts = false) {
  return `
    <section class="streaming-agent-stats streaming-agent-stats--${side}">
      <div class="streaming-agent-heading" style="display:flex;justify-content:space-between;width:100%;padding:0 6px">
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <span class="streaming-agent-rank" style="padding:2px 8px">#1</span>
          <span class="streaming-agent-name">Riven Ash the Unbroken</span>
        </div>
        <div class="streaming-agent-records" style="padding:2px 10px">OVR 3-1 / H2H 2-1</div>
      </div>
      ${showFrozenLoadouts ? frozenLoadouts(side) : ""}
      <div style="width:100%;height:28px;background:#0fc"></div>
      <div class="streaming-agent-loadout" style="width:100%;height:64px;background:#111"></div>
    </section>`;
}

function announcementMarkup() {
  return `
    <div class="streaming-overlay-root streaming-overlay-phase--announcement" style="position:absolute;inset:0;overflow:hidden">
      ${bettingRail("open")}
      <div class="streaming-between-strip">
        ${agentCard("left", true)}
        <div class="streaming-between-center">
          <span class="streaming-between-eyebrow">Matchup set</span>
          <span class="streaming-between-title">Riven Ash vs Astra Vale</span>
          <div class="streaming-between-timer-wrap"><div class="streaming-between-timer-inner">1:48</div></div>
          <span>Starts in</span>
        </div>
        ${agentCard("right", true)}
      </div>
      ${lowerThird()}
    </div>`;
}

function timer() {
  return `
    <div class="streaming-fight-timer">
      <span class="streaming-fight-timer-eyebrow">Round timer</span>
      <div class="streaming-fight-timer-outer">
        <div class="streaming-fight-timer-inner" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center">0:48</div>
      </div>
    </div>`;
}

function lowerThird() {
  return `
    <footer class="streaming-lower-third">
      <div class="streaming-lower-third-brand">
        <span class="streaming-lower-third-mark">Hyperia</span>
        <span>·</span><span class="streaming-lower-third-sub">AI duel arena</span>
      </div>
      <p class="streaming-lower-third-status">Live — round in progress</p>
    </footer>`;
}

function bettingRail(state) {
  return `
    <aside class="streaming-betting-rail streaming-betting-rail--${state}">
      <div class="streaming-betting-rail-eyebrow">Pick a side</div>
      <div class="streaming-betting-rail-title">Riven Ash vs Astra Vale</div>
      <div class="streaming-betting-rail-headline">${state === "done" ? "Fight over" : "Betting open"}</div>
      <p class="streaming-betting-rail-sub">Wagers lock at the announced deadline. Closes in 0:48.</p>
      <a class="streaming-betting-rail-cta">Open betting app</a>
      <p class="streaming-betting-rail-hint">Native SOL market</p>
    </aside>`;
}

function activeMarkup() {
  return `
    <div class="streaming-overlay-root" style="position:absolute;inset:0;overflow:hidden">
      <div class="streaming-combat-log" style="position:absolute;top:72px;left:16px;width:268px;height:180px"></div>
      ${bettingRail("open")}
      <div class="streaming-duel-info">
        ${agentCard("left")}${timer()}${agentCard("right")}
      </div>
      ${lowerThird()}
    </div>`;
}

function resolutionMarkup() {
  return `
    <div class="streaming-overlay-root" style="position:absolute;inset:0;overflow:hidden">
      ${bettingRail("done")}
      <div class="streaming-between-strip">
        ${agentCard("left")}
        <div class="streaming-between-center">
          <span class="streaming-between-eyebrow">Winner</span>
          <span class="streaming-between-title">Riven Ash</span>
          <div class="streaming-between-timer-wrap"><div class="streaming-between-timer-inner">0:08</div></div>
          <span>Next duel</span>
        </div>
        ${agentCard("right")}
      </div>
      <div class="streaming-post-fight-position">
        <div class="streaming-post-fight-card" style="min-width:340px;height:210px"></div>
      </div>
      ${lowerThird()}
    </div>`;
}

function overlaps(first, second) {
  if (!first || !second) return false;
  return (
    Math.min(first.right, second.right) - Math.max(first.left, second.left) >
      1 &&
    Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1
  );
}

const browser = await chromium.launch({ headless: true });
const failures = [];
let assertions = 0;

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    for (const [scenario, markup] of [
      ["active", activeMarkup()],
      ["announcement", announcementMarkup()],
      ["resolution", resolutionMarkup()],
    ]) {
      await page.setContent(`
        <!doctype html>
        <html><head><style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #000; }
          ${css}
        </style></head><body>${markup}</body></html>
      `);
      await page.waitForTimeout(850);

      if (captureDirectory && scenario === "announcement") {
        await page.screenshot({
          path: path.join(
            captureDirectory,
            `frozen-loadouts-${viewport.name}.png`,
          ),
          fullPage: true,
        });
      }

      const geometry = await page.evaluate(() => {
        const selectors = [
          ".streaming-duel-info",
          ".streaming-between-strip",
          ".streaming-agent-stats--left",
          ".streaming-agent-stats--right",
          ".streaming-frozen-loadouts--left",
          ".streaming-frozen-loadouts--right",
          ".streaming-fight-timer",
          ".streaming-combat-log",
          ".streaming-betting-rail",
          ".streaming-post-fight-position",
          ".streaming-lower-third",
        ];
        const boxes = Object.fromEntries(
          selectors.map((selector) => {
            const element = document.querySelector(selector);
            if (!element || getComputedStyle(element).display === "none") {
              return [selector, null];
            }
            const rect = element.getBoundingClientRect();
            return [
              selector,
              {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
              },
            ];
          }),
        );
        return {
          boxes,
          scrollWidth: document.documentElement.scrollWidth,
          scrollHeight: document.documentElement.scrollHeight,
          width: window.innerWidth,
          height: window.innerHeight,
        };
      });

      for (const [selector, box] of Object.entries(geometry.boxes)) {
        if (!box) continue;
        assertions += 1;
        if (
          box.left < -1 ||
          box.top < -1 ||
          box.right > geometry.width + 1 ||
          box.bottom > geometry.height + 1
        ) {
          failures.push({ viewport: viewport.name, scenario, selector, box });
        }
      }

      assertions += 2;
      if (geometry.scrollWidth > geometry.width) {
        failures.push({
          viewport: viewport.name,
          scenario,
          reason: "horizontal_overflow",
          actual: geometry.scrollWidth,
          expected: geometry.width,
        });
      }
      if (geometry.scrollHeight > geometry.height) {
        failures.push({
          viewport: viewport.name,
          scenario,
          reason: "vertical_overflow",
          actual: geometry.scrollHeight,
          expected: geometry.height,
        });
      }

      const boxes = geometry.boxes;
      const collisionPairs =
        scenario === "active"
          ? [
              [".streaming-agent-stats--left", ".streaming-combat-log"],
              [".streaming-agent-stats--right", ".streaming-betting-rail"],
              [".streaming-betting-rail", ".streaming-lower-third"],
            ]
          : scenario === "announcement"
            ? [
                [".streaming-agent-stats--right", ".streaming-betting-rail"],
                [".streaming-betting-rail", ".streaming-lower-third"],
              ]
            : [
                [".streaming-post-fight-position", ".streaming-betting-rail"],
                [".streaming-post-fight-position", ".streaming-lower-third"],
              ];

      for (const [first, second] of collisionPairs) {
        assertions += 1;
        if (overlaps(boxes[first], boxes[second])) {
          failures.push({
            viewport: viewport.name,
            scenario,
            reason: "hud_collision",
            first,
            second,
          });
        }
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
}

if (failures.length > 0) {
  console.error(JSON.stringify({ ok: false, assertions, failures }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify({
    ok: true,
    viewports: viewports.length,
    scenariosPerViewport: 3,
    assertions,
    capturedAnnouncementScreenshots: captureDirectory ? viewports.length : 0,
  }),
);
