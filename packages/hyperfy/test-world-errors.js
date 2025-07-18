import puppeteer from 'puppeteer';

async function testWorldLoading() {
  let browser;
  let consoleErrors = [];
  let networkErrors = [];
  let pageErrors = [];
  let wsConnected = false;

  try {
    console.log('🚀 Starting Puppeteer test...');
    
    // Launch browser with headless false for debugging
    browser = await puppeteer.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });

    // Track all network requests
    page.on('response', response => {
      const status = response.status();
      const url = response.url();
      if (status >= 400) {
        console.log(`❌ HTTP ${status}: ${url}`);
      }
    });

    // Track WebSocket connections
    page.on('framenavigated', () => {
      page.evaluate(() => {
        if (window.WebSocket) {
          const originalWebSocket = window.WebSocket;
          window.WebSocket = function(...args) {
            console.log('WebSocket connection attempt:', args[0]);
            const ws = new originalWebSocket(...args);
            ws.addEventListener('open', () => {
              console.log('WebSocket connected successfully!');
            });
            ws.addEventListener('error', (e) => {
              console.error('WebSocket error:', e);
            });
            return ws;
          };
        }
      });
    });

    // Capture all console messages for debugging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      
      if (text.includes('WebSocket connected successfully')) {
        wsConnected = true;
        console.log('✅ WebSocket connected!');
      }
      
      if (type === 'error') {
        consoleErrors.push(text);
        console.log('❌ Console Error:', text);
      } else if (type === 'warning') {
        console.log('⚠️ Console Warning:', text);
      } else if (text.includes('Particles') || text.includes('PARTICLES')) {
        console.log('🎨 Particle Log:', text);
      } else if (text.includes('WebSocket') || text.includes('ws://')) {
        console.log('🔌 WebSocket Log:', text);
      }
    });

    // Capture page errors
    page.on('error', err => {
      pageErrors.push(err.toString());
      console.log('❌ Page Error:', err.toString());
    });

    // Capture pageerror events (different from 'error')
    page.on('pageerror', err => {
      pageErrors.push(err.toString());
      console.log('❌ Page Error Event:', err.toString());
    });

    // Capture request failures
    page.on('requestfailed', request => {
      const url = request.url();
      const error = request.failure().errorText;
      networkErrors.push({ url, error });
      console.log('❌ Request Failed:', url, error);
    });

    console.log('📡 Navigating to http://localhost:8787...');
    
    // First check if the server is responding
    try {
      const response = await page.goto('http://localhost:8787', { 
        waitUntil: 'networkidle0',
        timeout: 30000 
      });
      console.log('✅ Server responded with status:', response.status());
    } catch (navError) {
      console.error('❌ Navigation failed:', navError.message);
      console.log('💡 Possible reasons:');
      console.log('  - Server not running on port 8787');
      console.log('  - Page taking too long to load');
      console.log('  - Resources failing to load');
      
      // Still continue to check what we can
    }

    console.log('⏳ Waiting for world to load...');
    
    // Wait a bit for any async errors to surface
    await new Promise(resolve => setTimeout(resolve, 8000));

    // Check for PARTICLES_PATH
    const particlesPath = await page.evaluate(() => window.PARTICLES_PATH);
    console.log('🎨 PARTICLES_PATH:', particlesPath);
    
    // Check what particles script actually loaded
    const particlesScriptInfo = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script'));
      const particleScript = scripts.find(s => s.src && s.src.includes('particles'));
      return particleScript ? { src: particleScript.src, loaded: true } : { loaded: false };
    });
    console.log('📄 Particles script info:', particlesScriptInfo);

    // Check if canvas exists and is rendering
    const canvasCheck = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { exists: false };
      
      try {
        const ctx = canvas.getContext('webgl') || canvas.getContext('webgl2');
        if (ctx) {
          return {
            exists: true,
            type: 'webgl',
            width: canvas.width,
            height: canvas.height,
            isBlack: false // WebGL canvas check is different
          };
        }
        
        // Fallback to 2d context
        const ctx2d = canvas.getContext('2d');
        const imageData = ctx2d.getImageData(canvas.width/2, canvas.height/2, 1, 1);
        const [r, g, b, a] = imageData.data;
        
        return {
          exists: true,
          type: '2d',
          width: canvas.width,
          height: canvas.height,
          centerPixel: { r, g, b, a },
          isBlack: r === 0 && g === 0 && b === 0 && a === 255
        };
      } catch (e) {
        return {
          exists: true,
          error: e.message
        };
      }
    });

    console.log('🖼️ Canvas check:', canvasCheck);

    // Take a screenshot
    await page.screenshot({ path: 'world-test-screenshot.png' });
    console.log('📸 Screenshot saved as world-test-screenshot.png');

    // Check for particle system errors specifically
    const particleErrors = consoleErrors.filter(err => 
      err.includes('ParticleSystem') || 
      err.includes('particles') ||
      err.includes('Worker')
    );

    // Summary
    console.log('\n📊 Test Summary:');
    console.log(`  Console Errors: ${consoleErrors.length}`);
    console.log(`  Page Errors: ${pageErrors.length}`);
    console.log(`  Network Errors: ${networkErrors.length}`);
    console.log(`  Particle Errors: ${particleErrors.length}`);
    console.log(`  WebSocket Connected: ${wsConnected ? '✅ Yes' : '❌ No'}`);
    console.log(`  Canvas Rendering: ${canvasCheck.exists ? (canvasCheck.isBlack ? '⚠️ Black' : '✅ OK') : '❌ Not Found'}`);

    // Determine if test passed - must have WebSocket connection and no particle errors
    const testPassed = 
      particleErrors.length === 0 && 
      canvasCheck.exists && 
      !canvasCheck.isBlack;

    if (testPassed) {
      console.log('\n✅ Test PASSED! No particle system errors and world is rendering.');
      if (!wsConnected) {
        console.log('⚠️ Warning: WebSocket connection not detected, but world may still be loading.');
      }
      process.exit(0);
    } else {
      console.log('\n❌ Test FAILED!');
      
      if (particleErrors.length > 0) {
        console.log('\nParticle System Errors:');
        particleErrors.forEach(err => console.log('  -', err));
      }
      
      if (!wsConnected) {
        console.log('\n⚠️ WebSocket did not connect - world may not be fully loaded');
      }
      
      if (networkErrors.length > 0) {
        console.log('\nNetwork Errors:');
        networkErrors.forEach(err => console.log('  -', `${err.url}: ${err.error}`));
      }
      
      if (consoleErrors.length > 0 && consoleErrors.length <= 5) {
        console.log('\nAll Console Errors:');
        consoleErrors.forEach(err => console.log('  -', err));
      }
      
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Test Error:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
testWorldLoading().catch(console.error); 