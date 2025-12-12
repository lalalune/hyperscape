/**
 * Screenshot utilities with blank page detection
 * Ensures every test captures real page content, not blank screens
 */
import { Page } from "playwright";
import { PNG } from "pngjs";
import fs from "fs";

interface ScreenshotOptions {
  name: string;
  fullPage?: boolean;
  errorOnBlank?: boolean;
}

/**
 * Take screenshot and verify it's not blank/single color
 */
export async function takeAndVerifyScreenshot(
  page: Page,
  options: ScreenshotOptions,
): Promise<string> {
  const { name, fullPage = true, errorOnBlank = true } = options;

  const screenshotPath = `tests/e2e/screenshots/${name}.png`;

  // Take screenshot
  await page.screenshot({
    path: screenshotPath,
    fullPage,
  });

  if (errorOnBlank) {
    // Verify screenshot is not blank/single color
    const isBlank = await isScreenshotBlank(screenshotPath);

    if (isBlank) {
      throw new Error(
        `Screenshot ${name} is blank or single color! ` +
          `Page may not have loaded. URL: ${page.url()}`,
      );
    }
  }

  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

/**
 * Check if screenshot is blank or single color
 * Returns true if >95% of pixels are the same color
 */
async function isScreenshotBlank(path: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(path);
    const png = new PNG();

    stream
      .pipe(png)
      .on("parsed", function () {
        const colorCounts = new Map<string, number>();
        let totalPixels = 0;

        // Count color frequency
        for (let y = 0; y < this.height; y++) {
          for (let x = 0; x < this.width; x++) {
            const idx = (this.width * y + x) << 2;
            const r = this.data[idx];
            const g = this.data[idx + 1];
            const b = this.data[idx + 2];
            const a = this.data[idx + 3];

            // Create color key
            const colorKey = `${r},${g},${b},${a}`;
            colorCounts.set(colorKey, (colorCounts.get(colorKey) || 0) + 1);
            totalPixels++;
          }
        }

        // Find most common color
        let maxCount = 0;
        for (const count of colorCounts.values()) {
          if (count > maxCount) maxCount = count;
        }

        // If >95% same color, consider blank
        const dominantPercentage = (maxCount / totalPixels) * 100;
        const isBlank = dominantPercentage > 95;

        if (isBlank) {
          console.error(
            `⚠️  Screenshot appears blank: ${dominantPercentage.toFixed(1)}% same color`,
          );
        }

        resolve(isBlank);
      })
      .on("error", reject);
  });
}

/**
 * Wait for page to actually load content
 */
export async function waitForPageLoad(
  page: Page,
  expectedUrl?: string,
): Promise<void> {
  // Wait for network idle
  await page.waitForLoadState("networkidle");

  // Verify URL if provided
  if (expectedUrl && !page.url().includes(expectedUrl)) {
    throw new Error(
      `Expected URL to contain "${expectedUrl}", got "${page.url()}"`,
    );
  }

  // Wait for some content to be visible
  await page.waitForSelector("body", { state: "visible" });

  // Small delay to ensure rendering
  await page.waitForTimeout(500);
}
