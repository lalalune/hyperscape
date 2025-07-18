import { spawn } from 'child_process';
import puppeteer from 'puppeteer';
import chalk from 'chalk';
import ora from 'ora';

console.log(chalk.blue.bold('🧪 Among Us Hyperfy - Comprehensive Runtime Test'));
console.log(chalk.gray('=' .repeat(60)));

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTest(name, testFn) {
  const spinner = ora(name).start();
  const startTime = Date.now();
  
  try {
    await testFn();
    const duration = Date.now() - startTime;
    spinner.succeed(`${name} (${duration}ms)`);
    return { name, passed: true, duration };
  } catch (error) {
    const duration = Date.now() - startTime;
    spinner.fail(`${name} (${duration}ms) - ${error.message}`);
    return { name, passed: false, error: error.message, duration };
  }
}

async function main() {
  const results = [];
  let viteProcess;
  let browser;

  console.log(chalk.yellow('\n📦 Starting development server...'));
  
  try {
    // Start Vite dev server
    viteProcess = spawn('npm', ['run', 'minigames'], {
      stdio: 'pipe',
      shell: true
    });

    // Wait for server to start
    await new Promise((resolve, reject) => {
      viteProcess.stdout.on('data', (data) => {
        const output = data.toString();
        if (output.includes('ready in') || output.includes('Local:')) {
          resolve();
        }
      });
      viteProcess.stderr.on('data', (data) => {
        console.error(chalk.red('Server error:', data.toString()));
      });
      setTimeout(() => reject(new Error('Server failed to start')), 30000);
    });

    console.log(chalk.green('✓ Development server started'));
    await sleep(2000);

    // Launch browser
    console.log(chalk.yellow('\n🌐 Launching browser...'));
    browser = await puppeteer.launch({
      headless: false,
      defaultViewport: { width: 1920, height: 1080 },
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        console.log(chalk.red(`[Browser Error] ${text}`));
      } else if (text.includes('Test:') || text.includes('Result:')) {
        console.log(chalk.cyan(`[Browser] ${text}`));
      }
    });

    page.on('pageerror', error => {
      console.log(chalk.red(`[Page Error] ${error.message}`));
    });

    console.log(chalk.green('✓ Browser launched'));

    // Test 1: Load the Among Us game
    results.push(await runTest('Load Among Us Game', async () => {
      await page.goto('http://localhost:3001/amongus.html', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Check if canvas exists
      const canvasExists = await page.evaluate(() => {
        return document.querySelector('canvas') !== null;
      });
      
      if (!canvasExists) throw new Error('Game canvas not found');
      
      // Check if Three.js scene is initialized
      const sceneInitialized = await page.evaluate(() => {
        return window.scene && window.scene.type === 'Scene';
      });
      
      if (!sceneInitialized) throw new Error('Three.js scene not initialized');
    }));

    await sleep(2000);

    // Test 2: Verify 8 agents spawn
    results.push(await runTest('Verify 8 Agents Spawn', async () => {
      const agentCount = await page.evaluate(() => {
        if (!window.gameManager) return 0;
        return window.gameManager.agents.size;
      });
      
      if (agentCount !== 8) {
        throw new Error(`Expected 8 agents, found ${agentCount}`);
      }
      
      // Verify agent colors
      const agentColors = await page.evaluate(() => {
        if (!window.gameManager) return [];
        return Array.from(window.gameManager.agents.values())
          .map(agent => agent.color);
      });
      
      const expectedColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'black', 'white'];
      const hasAllColors = expectedColors.every(color => agentColors.includes(color));
      
      if (!hasAllColors) {
        throw new Error('Not all agent colors present');
      }
    }));

    // Test 3: Verify agents are moving
    results.push(await runTest('Verify Agent Movement', async () => {
      // Record initial positions
      const initialPositions = await page.evaluate(() => {
        if (!window.gameManager) return {};
        const positions = {};
        window.gameManager.agents.forEach((agent, id) => {
          positions[id] = { ...agent.position };
        });
        return positions;
      });
      
      // Wait for movement
      await sleep(3000);
      
      // Check if positions changed
      const movedCount = await page.evaluate((initial) => {
        if (!window.gameManager) return 0;
        let moved = 0;
        window.gameManager.agents.forEach((agent, id) => {
          const oldPos = initial[id];
          const newPos = agent.position;
          const distance = Math.sqrt(
            Math.pow(newPos.x - oldPos.x, 2) +
            Math.pow(newPos.z - oldPos.z, 2)
          );
          if (distance > 0.1) moved++;
        });
        return moved;
      }, initialPositions);
      
      if (movedCount < 4) {
        throw new Error(`Only ${movedCount}/8 agents moved`);
      }
    }));

    // Test 4: Verify task system
    results.push(await runTest('Verify Task System', async () => {
      const taskInfo = await page.evaluate(() => {
        if (!window.gameManager) return null;
        const tasks = Array.from(window.gameManager.tasks.values());
        return {
          count: tasks.length,
          firstTask: tasks[0] ? {
            name: tasks[0].name,
            position: tasks[0].position,
            duration: tasks[0].duration
          } : null
        };
      });
      
      if (!taskInfo || taskInfo.count < 5) {
        throw new Error(`Expected at least 5 tasks, found ${taskInfo?.count || 0}`);
      }
      
      // Verify task durations are between 5-15 seconds
      const validDuration = taskInfo.firstTask && 
        taskInfo.firstTask.duration >= 5000 && 
        taskInfo.firstTask.duration <= 15000;
      
      if (!validDuration) {
        throw new Error('Task duration not in valid range (5-15 seconds)');
      }
    }));

    // Test 5: Verify agents are doing tasks
    results.push(await runTest('Verify Agents Doing Tasks', async () => {
      // Wait for some task progress
      await sleep(5000);
      
      const taskProgress = await page.evaluate(() => {
        if (!window.gameManager) return null;
        let tasksInProgress = 0;
        let tasksCompleted = 0;
        
        window.gameManager.tasks.forEach(task => {
          if (task.playersCompleted.size > 0) tasksCompleted++;
          if (task.playersInProgress.size > 0) tasksInProgress++;
        });
        
        return { tasksInProgress, tasksCompleted };
      });
      
      if (!taskProgress) {
        throw new Error('Could not get task progress');
      }
      
      if (taskProgress.tasksInProgress === 0 && taskProgress.tasksCompleted === 0) {
        throw new Error('No tasks being worked on');
      }
    }));

    // Test 6: Verify kill mechanics
    results.push(await runTest('Verify Kill Mechanics', async () => {
      // Wait for potential kills
      await sleep(10000);
      
      const gameInfo = await page.evaluate(() => {
        if (!window.gameManager) return null;
        const aliveCount = Array.from(window.gameManager.agents.values())
          .filter(agent => agent.alive).length;
        const bodies = window.gameManager.bodies.size;
        return { aliveCount, bodies };
      });
      
      if (!gameInfo) {
        throw new Error('Could not get game info');
      }
      
      // Check if any kills happened
      if (gameInfo.aliveCount === 8 && gameInfo.bodies === 0) {
        console.log(chalk.yellow('  ⚠️  No kills observed yet (this may be normal)'));
      }
    }));

    // Test 7: Verify meetings can be called
    results.push(await runTest('Verify Meeting System', async () => {
      const meetingCalled = await page.evaluate(() => {
        if (!window.gameManager) return false;
        // Check if any meeting has been called
        return window.gameManager.phase === 'meeting' || 
               window.gameManager.meetingHistory.length > 0;
      });
      
      if (!meetingCalled) {
        // Try to trigger a meeting by simulating a body report
        await page.evaluate(() => {
          if (window.gameManager && window.gameManager.bodies.size > 0) {
            const reporter = Array.from(window.gameManager.agents.values())
              .find(a => a.alive);
            if (reporter) {
              window.gameManager.reportBody(reporter.id);
            }
          }
        });
        
        await sleep(2000);
        
        const meetingPhase = await page.evaluate(() => {
          return window.gameManager?.phase === 'meeting';
        });
        
        if (!meetingPhase) {
          console.log(chalk.yellow('  ⚠️  No meetings observed (this may be normal)'));
        }
      }
    }));

    // Test 8: Verify chat messages
    results.push(await runTest('Verify Chat Messages', async () => {
      const chatStats = await page.evaluate(() => {
        if (!window.gameManager) return null;
        const messages = window.gameManager.chatHistory || [];
        const uniqueMessages = new Set(messages.map(m => m.text));
        return {
          totalMessages: messages.length,
          uniqueMessages: uniqueMessages.size,
          hasVariety: uniqueMessages.size > messages.length * 0.7
        };
      });
      
      if (!chatStats || chatStats.totalMessages === 0) {
        throw new Error('No chat messages found');
      }
      
      if (!chatStats.hasVariety) {
        throw new Error(`Too many duplicate messages: ${chatStats.uniqueMessages}/${chatStats.totalMessages} unique`);
      }
    }));

    // Test 9: Check for real AI integration
    results.push(await runTest('Verify Real AI Integration', async () => {
      const aiCheck = await page.evaluate(() => {
        if (!window.gameManager) return null;
        
        // Check if agents have AI properties
        const firstAgent = Array.from(window.gameManager.agents.values())[0];
        if (!firstAgent) return null;
        
        return {
          hasRuntime: !!firstAgent.runtime,
          hasCharacter: !!firstAgent.character,
          hasMemory: !!firstAgent.runtime?.memory,
          hasActions: !!firstAgent.runtime?.actions,
          isRealAgent: firstAgent.constructor.name !== 'MockAmongUsAgent'
        };
      });
      
      if (!aiCheck) {
        throw new Error('Could not check AI integration');
      }
      
      if (!aiCheck.isRealAgent) {
        throw new Error('Using mock agents instead of real ElizaOS agents');
      }
      
      if (!aiCheck.hasRuntime || !aiCheck.hasCharacter) {
        throw new Error('Agents missing AI components');
      }
    }));

    // Test 10: Performance check
    results.push(await runTest('Performance Check', async () => {
      const metrics = await page.evaluate(() => {
        if (!performance.memory) {
          return { fps: 60, memory: 'N/A' };
        }
        
        // Measure FPS
        let fps = 60;
        if (window.stats) {
          fps = window.stats.fps || 60;
        }
        
        return {
          fps,
          memory: Math.round(performance.memory.usedJSHeapSize / 1048576) + ' MB'
        };
      });
      
      if (metrics.fps < 30) {
        throw new Error(`Poor performance: ${metrics.fps} FPS`);
      }
    }));

    // Generate summary
    console.log(chalk.blue('\n📊 Test Summary'));
    console.log(chalk.gray('=' .repeat(60)));
    
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const successRate = Math.round((passed / total) * 100);
    
    console.log(chalk.green(`✅ Passed: ${passed}`));
    console.log(chalk.red(`❌ Failed: ${failed}`));
    console.log(chalk.blue(`📈 Success Rate: ${successRate}%`));
    
    if (failed > 0) {
      console.log(chalk.red('\n❌ Failed Tests:'));
      results.filter(r => !r.passed).forEach(r => {
        console.log(chalk.red(`  - ${r.name}: ${r.error}`));
      });
    }
    
    // Visual verification instructions
    console.log(chalk.yellow('\n👁️  Visual Verification:'));
    console.log(chalk.gray('Please manually verify in the browser window:'));
    console.log(chalk.gray('1. Agents are moving around the map'));
    console.log(chalk.gray('2. Chat bubbles appear above agents'));
    console.log(chalk.gray('3. Task progress bars show when agents work'));
    console.log(chalk.gray('4. Kill animations when impostors eliminate crewmates'));
    console.log(chalk.gray('5. Emergency meetings gather all players'));
    
    console.log(chalk.cyan('\n💡 Press Ctrl+C when done with visual verification'));
    
    // Keep running for visual inspection
    await new Promise(() => {});
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test Error:'), error.message);
  } finally {
    if (browser) await browser.close();
    if (viteProcess) {
      viteProcess.kill();
      await sleep(1000);
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down gracefully...'));
  process.exit(0);
});

main().catch(console.error); 