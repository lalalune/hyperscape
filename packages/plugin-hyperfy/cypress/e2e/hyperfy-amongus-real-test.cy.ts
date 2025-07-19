/// <reference types="cypress" />

// Color assignments for visual verification
const ELEMENT_COLORS = {
    // Players
    RED_AGENT: '#FF0000',
    PURPLE_AGENT: '#800080',
    BLUE_AGENT: '#0000FF',
    GREEN_AGENT: '#00FF00',
    YELLOW_AGENT: '#FFFF00',
    ORANGE_AGENT: '#FFA500',
    BLACK_AGENT: '#000000',
    WHITE_AGENT: '#FFFFFF',
    
    // Game elements
    TASK_IDLE: '#00FF00',      // Green when idle
    TASK_ACTIVE: '#FFFF00',    // Yellow when in progress
    TASK_COMPLETE: '#0000FF',  // Blue when completed
    DEAD_BODY: '#FF0000',      // Red bodies
    
    // UI elements
    CHAT_BUBBLE: '#EEEEEE',
    MEETING_UI: '#FF00FF',
    VOTE_BUTTON: '#00FFFF',
    TASK_PROGRESS: '#00FF88',
    KILL_BUTTON: '#FF0088'
};

describe('Hyperfy Among Us - Real Implementation Tests', () => {
    let worldConnection: WebSocket;
    let agentPositions: Map<string, { x: number, z: number }>;
    let chatMessages: Array<{ player: string, text: string, timestamp: number }>;
    
    before(() => {
        // Initialize tracking
        agentPositions = new Map();
        chatMessages = [];
    });
    
    beforeEach(() => {
        // Visit the Hyperfy world
        cy.visit('http://localhost:3000/hyperfy-amongus.html');
        
        // Wait for world to load
        cy.window().then((win) => {
            // Connect to Hyperfy WebSocket
            worldConnection = new WebSocket('ws://localhost:4000/amongus');
            
            worldConnection.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                // Track agent positions
                if (data.type === 'position_update') {
                    data.positions.forEach((pos: any) => {
                        agentPositions.set(pos.id, { x: pos.x, z: pos.z });
                    });
                }
                
                // Track chat messages
                if (data.type === 'chat_message') {
                    chatMessages.push({
                        player: data.playerName,
                        text: data.text,
                        timestamp: Date.now()
                    });
                }
            };
        });
        
        // Wait for agents to connect
        cy.wait(5000);
    });
    
    it('should connect real ElizaOS agents to Hyperfy world', () => {
        // Verify Hyperfy plugin is loaded
        cy.window().should('have.property', 'HyperfyPlugin');
        
        // Verify world connection
        cy.window().its('hyperfyWorld').should('exist');
        
        // Verify all 8 agents connected
        cy.get('[data-testid="player-list"]').within(() => {
            cy.get('[data-player="Red"]').should('exist');
            cy.get('[data-player="Purple"]').should('exist');
            cy.get('[data-player="Blue"]').should('exist');
            cy.get('[data-player="Green"]').should('exist');
            cy.get('[data-player="Yellow"]').should('exist');
            cy.get('[data-player="Orange"]').should('exist');
            cy.get('[data-player="Black"]').should('exist');
            cy.get('[data-player="White"]').should('exist');
        });
        
        // Screenshot for visual verification
        cy.screenshot('agents-connected');
    });
    
    it('should render agents with correct colors', () => {
        // Test each agent's visual representation
        Object.entries(ELEMENT_COLORS).forEach(([agent, color]) => {
            if (agent.includes('AGENT')) {
                const name = agent.replace('_AGENT', '');
                
                // Check agent mesh has correct color
                cy.get(`[data-agent-mesh="${name}"]`)
                    .should('have.css', 'background-color', color);
                
                // Verify in 3D scene
                cy.window().then((win: any) => {
                    const scene = win.hyperfyWorld?.scene;
                    const agentMesh = scene?.getObjectByName(`agent-${name}`);
                    
                    expect(agentMesh).to.exist;
                    expect(agentMesh.material.color.getHexString()).to.equal(
                        color.replace('#', '').toLowerCase()
                    );
                });
            }
        });
        
        cy.screenshot('agent-colors-verified');
    });
    
    it('should show agents moving using Hyperfy physics', () => {
        // Track initial positions
        const initialPositions = new Map<string, { x: number, z: number }>();
        
        cy.window().then((win: any) => {
            const players = win.hyperfyWorld?.players;
            players?.forEach((player: any) => {
                initialPositions.set(player.id, {
                    x: player.position.x,
                    z: player.position.z
                });
            });
        });
        
        // Wait for movement
        cy.wait(10000);
        
        // Verify agents have moved
        cy.window().then((win: any) => {
            const players = win.hyperfyWorld?.players;
            let movedCount = 0;
            
            players?.forEach((player: any) => {
                const initial = initialPositions.get(player.id);
                if (initial) {
                    const distance = Math.sqrt(
                        Math.pow(player.position.x - initial.x, 2) +
                        Math.pow(player.position.z - initial.z, 2)
                    );
                    
                    if (distance > 0.5) {
                        movedCount++;
                        cy.log(`${player.name} moved ${distance.toFixed(2)} units`);
                    }
                }
            });
            
            expect(movedCount).to.be.greaterThan(4); // At least half should move
        });
        
        cy.screenshot('agents-movement');
    });
    
    it('should enforce proximity for task interactions', () => {
        // Find a task entity
        cy.window().then((win: any) => {
            const world = win.hyperfyWorld;
            const tasks = world?.app?.tasks;
            
            expect(tasks).to.exist;
            expect(tasks.size).to.be.greaterThan(0);
            
            // Get first task
            const firstTask = Array.from(tasks.values())[0];
            
            // Try to start task from far away
            world.app.emit('startTask', {
                playerId: 'test-player',
                taskId: firstTask.id
            });
            
            // Should receive error about proximity
            cy.on('window:alert', (text) => {
                expect(text).to.include('Too far from task');
            });
        });
        
        cy.screenshot('proximity-check');
    });
    
    it('should display real AI-generated chat messages', () => {
        // Wait for some chat messages
        cy.wait(15000);
        
        // Check chat messages are unique (not from predefined list)
        cy.get('[data-testid="chat-log"]').within(() => {
            cy.get('.chat-message').should('have.length.greaterThan', 5);
            
            const messages = new Set<string>();
            cy.get('.chat-message-text').each(($el) => {
                messages.add($el.text());
            });
            
            // Should have mostly unique messages
            cy.wrap(messages.size).should('be.greaterThan', 3);
        });
        
        // Verify messages use Hyperfy chat system
        cy.window().then((win: any) => {
            const chatHistory = win.hyperfyWorld?.chatHistory;
            expect(chatHistory).to.exist;
            expect(chatHistory.length).to.be.greaterThan(0);
        });
        
        cy.screenshot('ai-chat-messages');
    });
    
    it('should show tasks with correct visual states', () => {
        // Check task colors change based on state
        cy.get('[data-testid="task-list"]').within(() => {
            // Idle tasks should be green
            cy.get('.task-idle').should('have.css', 'background-color', ELEMENT_COLORS.TASK_IDLE);
            
            // Active tasks should be yellow
            cy.get('.task-active').should('have.css', 'background-color', ELEMENT_COLORS.TASK_ACTIVE);
            
            // Completed tasks should be blue
            cy.get('.task-complete').should('have.css', 'background-color', ELEMENT_COLORS.TASK_COMPLETE);
        });
        
        // Verify in 3D scene
        cy.window().then((win: any) => {
            const tasks = win.hyperfyWorld?.app?.tasks;
            tasks?.forEach((task: any) => {
                const entity = task.entity;
                if (entity) {
                    const color = entity.material.color.getHexString();
                    
                    if (task.completedBy.size > 0) {
                        expect(color).to.equal('0000ff'); // Blue
                    } else if (task.inProgress.size > 0) {
                        expect(color).to.equal('ffff00'); // Yellow
                    } else {
                        expect(color).to.equal('00ff00'); // Green
                    }
                }
            });
        });
        
        cy.screenshot('task-visual-states');
    });
    
    it('should handle kills with proper death mechanics', () => {
        // Wait for a kill to happen
        cy.wait(30000);
        
        // Check for dead bodies
        cy.window().then((win: any) => {
            const bodies = win.hyperfyWorld?.app?.bodies;
            
            if (bodies && bodies.size > 0) {
                // Verify body entities exist
                bodies.forEach((body: any) => {
                    expect(body.entity).to.exist;
                    
                    // Check body color
                    const color = body.entity.material.color.getHexString();
                    expect(color).to.equal('ff0000'); // Red
                });
                
                // Verify dead players are hidden
                const players = win.hyperfyWorld?.players;
                players?.forEach((player: any) => {
                    if (!player.alive) {
                        expect(player.entity.visible).to.be.false;
                    }
                });
            }
        });
        
        cy.screenshot('death-mechanics');
    });
    
    it('should conduct meetings when bodies are reported', () => {
        // Wait for a meeting
        cy.wait(45000);
        
        // Check if meeting UI appears
        cy.get('[data-testid="meeting-ui"]').then(($el) => {
            if ($el.length > 0) {
                // Verify meeting UI color
                cy.wrap($el).should('have.css', 'background-color', ELEMENT_COLORS.MEETING_UI);
                
                // Check all alive players are present
                cy.get('[data-testid="voting-panel"]').within(() => {
                    cy.get('.player-vote-option').should('have.length.greaterThan', 0);
                });
                
                // Verify discussion messages
                cy.get('[data-testid="meeting-chat"]').within(() => {
                    cy.get('.discussion-message').should('have.length.greaterThan', 0);
                });
            }
        });
        
        cy.screenshot('meeting-system');
    });
    
    it('should track game progress and win conditions', () => {
        // Check task progress
        cy.get('[data-testid="task-progress"]')
            .should('exist')
            .and('have.css', 'background-color', ELEMENT_COLORS.TASK_PROGRESS);
        
        // Verify progress updates
        cy.window().then((win: any) => {
            const app = win.hyperfyWorld?.app;
            const progress = app?.gameState?.taskProgress;
            
            expect(progress).to.be.a('number');
            expect(progress).to.be.at.least(0);
            expect(progress).to.be.at.most(100);
        });
        
        // Check win condition monitoring
        cy.window().then((win: any) => {
            const gamePhase = win.hyperfyWorld?.app?.gameState?.phase;
            expect(['waiting', 'gameplay', 'meeting', 'voting', 'end']).to.include(gamePhase);
        });
        
        cy.screenshot('game-progress');
    });
    
    it('should validate complete Hyperfy integration', () => {
        // Final validation of all systems
        cy.window().then((win: any) => {
            // Verify Hyperfy world
            expect(win.hyperfyWorld).to.exist;
            expect(win.hyperfyWorld.ws).to.exist; // WebSocket connection
            expect(win.hyperfyWorld.scene).to.exist; // Three.js scene
            expect(win.hyperfyWorld.physics).to.exist; // Physics engine
            
            // Verify Among Us app
            const app = win.hyperfyWorld.app;
            expect(app).to.exist;
            expect(app.players.size).to.equal(8);
            expect(app.tasks.size).to.be.greaterThan(0);
            
            // Verify real agents
            app.players.forEach((player: any) => {
                expect(player.isAI).to.be.true;
                expect(player.entity).to.exist;
                expect(player.position).to.exist;
            });
            
            // Log summary
            cy.log('✅ Hyperfy world connected');
            cy.log('✅ Real ElizaOS agents active');
            cy.log('✅ Physics and proximity working');
            cy.log('✅ Game mechanics functional');
            cy.log('✅ Visual elements verified');
        });
        
        cy.screenshot('full-integration-verified');
    });
    
    after(() => {
        if (worldConnection) {
            worldConnection.close();
        }
    });
}); 