#!/usr/bin/env node

import { AmongUsWebSocketServer } from '../src/servers/AmongUsWebSocketServer.js';
import chalk from 'chalk';

console.log(chalk.blue.bold('🎮 Among Us WebSocket Server'));
console.log(chalk.gray('=' .repeat(50)));

const PORT = process.env.AMONG_US_PORT || 8080;

let server;

async function startServer() {
  try {
    server = new AmongUsWebSocketServer(PORT);
    
    console.log(chalk.green(`\n✅ Server started on port ${PORT}`));
    console.log(chalk.cyan('\n📡 WebSocket URL: ws://localhost:' + PORT));
    console.log(chalk.yellow('\n⏳ Waiting for players to connect...'));
    console.log(chalk.gray('\nMinimum players required: 5'));
    console.log(chalk.gray('Maximum players allowed: 8'));
    
    // Game state monitoring
    setInterval(() => {
      const gameState = server.getGameState();
      const connections = server.getConnections();
      
      console.log(chalk.blue('\n📊 Server Status:'));
      console.log(chalk.gray(`- Connected Players: ${connections.size}`));
      console.log(chalk.gray(`- Game Phase: ${gameState.phase}`));
      console.log(chalk.gray(`- Alive Players: ${Array.from(gameState.players.values()).filter(p => p.alive).length}`));
      
      if (gameState.phase === 'playing') {
        const tasks = gameState.tasks;
        let completedTasks = 0;
        tasks.forEach(task => {
          completedTasks += task.completedBy.size;
        });
        const totalTasks = tasks.size * Array.from(gameState.players.values()).filter(p => p.role === 'crewmate').length;
        console.log(chalk.gray(`- Task Progress: ${completedTasks}/${totalTasks}`));
      }
    }, 30000); // Every 30 seconds
    
    // Handle server events
    server.on('playerJoined', (data) => {
      console.log(chalk.green(`\n✅ Player joined: ${data.name} (${data.playerId})`));
    });
    
    server.on('playerLeft', (data) => {
      console.log(chalk.red(`\n❌ Player left: ${data.playerId}`));
    });
    
    server.on('gameStarted', () => {
      console.log(chalk.green.bold('\n🎮 GAME STARTED!'));
    });
    
    server.on('gameEnded', (winner) => {
      console.log(chalk.yellow.bold(`\n🏆 GAME OVER! Winner: ${winner}`));
    });
    
  } catch (error) {
    console.error(chalk.red('Failed to start server:'), error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down server...'));
  if (server) {
    server.stop();
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down server...'));
  if (server) {
    server.stop();
  }
  process.exit(0);
});

// Start the server
startServer();

console.log(chalk.cyan('\n💡 Press Ctrl+C to stop the server\n')); 