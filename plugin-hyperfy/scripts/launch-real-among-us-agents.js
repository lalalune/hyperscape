#!/usr/bin/env node

import { AgentRuntime, ModelProviderName, SqliteAdapter, defaultCharacter } from '@elizaos/core';
import { HyperfyService } from '../src/service.js';
import { RealAmongUsAgent } from '../src/agents/RealAmongUsAgent.js';
import { HyperfyGameService } from '../src/services/HyperfyGameService.js';
import { GameState } from '../src/apps/amongus/GameState.js';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Starting Real Among Us Agents with ElizaOS');
console.log('=' .repeat(50));

// Agent configurations
const AGENT_CONFIGS = [
  { id: 'red-agent', name: 'Red', color: 'red', role: 'impostor' },
  { id: 'blue-agent', name: 'Blue', color: 'blue', role: 'crewmate' },
  { id: 'green-agent', name: 'Green', color: 'green', role: 'crewmate' },
  { id: 'yellow-agent', name: 'Yellow', color: 'yellow', role: 'crewmate' },
  { id: 'purple-agent', name: 'Purple', color: 'purple', role: 'impostor' },
  { id: 'orange-agent', name: 'Orange', color: 'orange', role: 'crewmate' },
  { id: 'black-agent', name: 'Black', color: 'black', role: 'crewmate' },
  { id: 'white-agent', name: 'White', color: 'white', role: 'crewmate' }
];

const WS_URL = process.env.AMONG_US_WS_URL || 'ws://localhost:8080';
const MODEL_PROVIDER = process.env.MODEL_PROVIDER || ModelProviderName.OPENAI;

class AmongUsAgentLauncher {
  constructor() {
    this.agents = [];
    this.gameState = new GameState();
    this.wsClients = new Map();
  }

  async launchAgent(config) {
    console.log(`\n🤖 Launching ${config.name} (${config.role})...`);

    try {
      // Load character data
      const characterPath = path.join(__dirname, '..', 'src', 'agents', 'characters', `${config.color}.json`);
      let character;
      
      if (fs.existsSync(characterPath)) {
        const characterData = fs.readFileSync(characterPath, 'utf8');
        character = JSON.parse(characterData);
      } else {
        // Create default character
        character = {
          ...defaultCharacter,
          name: config.name,
          description: `A ${config.role} player in Among Us`,
          settings: {
            ...defaultCharacter.settings,
            gameRole: config.role
          }
        };
      }

      // Create database
      const dbPath = path.join(__dirname, '..', 'db', `${config.id}.sqlite`);
      const dbDir = path.dirname(dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      // Initialize runtime
      const runtime = new AgentRuntime({
        character,
        databaseAdapter: new SqliteAdapter({ 
          filename: dbPath,
          memory: false
        }),
        modelProvider: MODEL_PROVIDER,
        conversationLength: 32,
        agentId: config.id,
        serverUrl: 'http://localhost:3000',
        token: process.env.AGENT_TOKEN || 'default-token'
      });

      await runtime.initialize();

      // Initialize Hyperfy service
      const hyperfyService = await HyperfyService.start(runtime);
      const gameService = new HyperfyGameService(hyperfyService);

      // Create real AI agent
      const agent = new RealAmongUsAgent({
        character,
        modelProvider: MODEL_PROVIDER,
        gameState: this.gameState,
        hyperfyService: gameService,
        playerId: config.id
      });

      // Connect to WebSocket server
      const ws = new WebSocket(WS_URL);
      
      ws.on('open', () => {
        console.log(`✅ ${config.name} connected to game server`);
        
        // Join game
        ws.send(JSON.stringify({
          type: 'join',
          playerId: config.id,
          data: {
            name: config.name,
            isAgent: true
          },
          timestamp: Date.now()
        }));
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleGameMessage(config.id, message);
        } catch (error) {
          console.error(`Error parsing message for ${config.name}:`, error);
        }
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for ${config.name}:`, error);
      });

      ws.on('close', () => {
        console.log(`❌ ${config.name} disconnected from game server`);
      });

      this.wsClients.set(config.id, ws);

      // Start the AI agent
      await agent.start();

      this.agents.push({
        config,
        runtime,
        agent,
        ws
      });

      console.log(`✅ ${config.name} agent is running with real AI!`);

    } catch (error) {
      console.error(`Failed to launch ${config.name}:`, error);
    }
  }

  handleGameMessage(agentId, message) {
    switch (message.type) {
      case 'gameState':
        // Update local game state
        if (message.data) {
          this.gameState = GameState.deserialize(message.data);
        }
        break;

      case 'joined':
        console.log(`Agent ${agentId} successfully joined the game`);
        break;

      case 'gameStarted':
        console.log('🎮 Game started!');
        if (message.data) {
          this.gameState = GameState.deserialize(message.data);
        }
        break;

      case 'playerMove':
        // Update player positions
        const player = this.gameState.players.get(message.playerId);
        if (player) {
          player.position = message.data.position;
        }
        break;

      case 'playerKilled':
        console.log(`💀 ${message.data.victimId} was eliminated!`);
        break;

      case 'meetingStarted':
        console.log('🚨 Emergency meeting called!');
        break;

      case 'gameEnded':
        console.log(`🏆 Game Over! Winner: ${message.data.winner}`);
        break;
    }
  }

  async launchAllAgents() {
    console.log('\n🎮 Launching all Among Us agents...\n');

    // Launch agents with delay to avoid overwhelming the system
    for (const config of AGENT_CONFIGS) {
      await this.launchAgent(config);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ All agents launched successfully!');
    console.log('\n📊 Agent Summary:');
    console.log(`- Total Agents: ${this.agents.length}`);
    console.log(`- Impostors: ${this.agents.filter(a => a.config.role === 'impostor').length}`);
    console.log(`- Crewmates: ${this.agents.filter(a => a.config.role === 'crewmate').length}`);
    console.log('\n🎮 Game will start automatically when enough players join!');
  }

  async shutdown() {
    console.log('\n👋 Shutting down agents...');

    for (const agent of this.agents) {
      try {
        await agent.agent.stop();
        agent.ws.close();
        await agent.runtime.stop();
      } catch (error) {
        console.error(`Error stopping agent ${agent.config.name}:`, error);
      }
    }

    console.log('✅ All agents stopped');
  }
}

// Main execution
async function main() {
  const launcher = new AmongUsAgentLauncher();

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nReceived interrupt signal...');
    await launcher.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\nReceived termination signal...');
    await launcher.shutdown();
    process.exit(0);
  });

  try {
    // First check if WebSocket server is running
    console.log(`\n🔍 Checking WebSocket server at ${WS_URL}...`);
    
    const testWs = new WebSocket(WS_URL);
    
    await new Promise((resolve, reject) => {
      testWs.on('open', () => {
        console.log('✅ WebSocket server is running');
        testWs.close();
        resolve();
      });
      
      testWs.on('error', (error) => {
        console.error('❌ WebSocket server not available:', error.message);
        console.log('\n💡 Please start the game server first:');
        console.log('   npm run server:amongus');
        reject(error);
      });
    });

    // Launch agents
    await launcher.launchAllAgents();

    // Keep process alive
    console.log('\n💡 Agents are running. Press Ctrl+C to stop.\n');

  } catch (error) {
    console.error('\n❌ Failed to start agents:', error);
    process.exit(1);
  }
}

// Check for required environment variables
if (!process.env.OPENAI_API_KEY && MODEL_PROVIDER === ModelProviderName.OPENAI) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  console.log('\n💡 Set your OpenAI API key:');
  console.log('   export OPENAI_API_KEY=your-api-key-here');
  process.exit(1);
}

main().catch(console.error); 