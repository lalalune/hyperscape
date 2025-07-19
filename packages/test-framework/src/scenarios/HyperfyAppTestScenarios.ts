import { TestScenario, TestContext, TestValidation, ValidationFailure } from '../types';

/**
 * Test scenarios for Hyperfy App system functionality
 */
export class HyperfyAppTestScenarios {
  
  /**
   * Test basic app creation and lifecycle
   */
  static getAppCreationTest(): TestScenario {
    return {
      id: 'hyperfy-app-creation',
      name: 'Hyperfy App Creation Test',
      description: 'Verifies that apps can be created, configured, and destroyed',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up app creation test');
        
        // Store test configuration
        context.data.set('appConfig', {
          id: 'test-app',
          name: 'Test App',
          type: 'app',
          position: { x: 0, y: 0, z: 0 },
          properties: {
            testProperty: 'test-value',
            configurable: true
          }
        });
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing app creation test');
        
        const appConfig = context.data.get('appConfig');
        const world = context.world;
        
        // Test app creation through entity system
        const entity = await world.entities.create('app', appConfig);
        context.data.set('createdApp', entity);
        
        // Verify app is in the world
        const retrievedApp = world.entities.get(appConfig.id);
        context.data.set('retrievedApp', retrievedApp);
        
        // Test app configuration
        if (entity && (entity as any).configure) {
          await (entity as any).configure([
            {
              type: 'text',
              key: 'testMessage',
              label: 'Test Message',
              initial: 'Hello World'
            }
          ]);
        }
        
        context.data.set('configurationComplete', true);
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        const appConfig = context.data.get('appConfig');
        const createdApp = context.data.get('createdApp');
        const retrievedApp = context.data.get('retrievedApp');
        
        // Verify app was created
        if (!createdApp) {
          failures.push({
            type: 'assertion',
            message: 'App creation failed - no app entity returned'
          });
        }
        
        // Verify app can be retrieved
        if (!retrievedApp) {
          failures.push({
            type: 'assertion',
            message: 'App retrieval failed - app not found in world'
          });
        }
        
        // Verify app properties
        if (createdApp && createdApp.id !== appConfig.id) {
          failures.push({
            type: 'assertion',
            message: `App ID mismatch: expected ${appConfig.id}, got ${createdApp.id}`
          });
        }
        
        // Verify app type
        if (createdApp && createdApp.type !== 'app') {
          failures.push({
            type: 'assertion',
            message: `App type mismatch: expected 'app', got ${createdApp.type}`
          });
        }
        
        // Verify configuration was applied
        const configurationComplete = context.data.get('configurationComplete');
        if (!configurationComplete) {
          warnings.push('App configuration could not be verified');
        }
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const createdApp = context.data.get('createdApp');
        if (createdApp && context.world.entities.destroy) {
          try {
            await context.world.entities.destroy();
          } catch (error: any) {
            // Ignore cleanup errors for now
          }
        }
      }
    };
  }

  /**
   * Test app scripting and event system
   */
  static getAppScriptingTest(): TestScenario {
    return {
      id: 'hyperfy-app-scripting',
      name: 'Hyperfy App Scripting Test',
      description: 'Verifies app scripting, events, and state management',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up app scripting test');
        
        context.data.set('scriptCode', `
          // Test app script
          app.state = { counter: 0, events: [] };
          
          app.on('test-event', (data) => {
            app.state.counter++;
            app.state.events.push(data);
          });
          
          app.incrementCounter = () => {
            app.state.counter++;
          };
          
          app.getCounter = () => {
            return app.state.counter;
          };
        `);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing app scripting test');
        
        const world = context.world;
        const scriptCode = context.data.get('scriptCode');
        
        // Create app with script
        const appConfig = {
          id: 'scripted-app',
          name: 'Scripted App',
          type: 'app',
          script: scriptCode
        };
        
        const app = await world.entities.create('app', appConfig);
        context.data.set('scriptedApp', app);
        
        // Test script execution
        if (app && (app as any).incrementCounter) {
          (app as any).incrementCounter();
          (app as any).incrementCounter();
          const counter = (app as any).getCounter();
          context.data.set('counterValue', counter);
        }
        
        // Test event system
        if (app && world.events) {
          world.events.emit('test-event', { message: 'test' });
          
          // Wait for event processing
          await context.wait(100);
          
          const finalCounter = (app as any).getCounter();
          context.data.set('finalCounterValue', finalCounter);
        }
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        const scriptedApp = context.data.get('scriptedApp');
        const counterValue = context.data.get('counterValue');
        const finalCounterValue = context.data.get('finalCounterValue');
        
        // Verify app was created with script
        if (!scriptedApp) {
          failures.push({
            type: 'assertion',
            message: 'Scripted app creation failed'
          });
        }
        
        // Verify script methods work
        if (counterValue !== 2) {
          failures.push({
            type: 'assertion',
            message: `Counter method failed: expected 2, got ${counterValue}`
          });
        }
        
        // Verify event handling
        if (finalCounterValue !== 3) {
          failures.push({
            type: 'assertion',
            message: `Event handling failed: expected 3, got ${finalCounterValue}`
          });
        }
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const scriptedApp = context.data.get('scriptedApp');
        if (scriptedApp && context.world.entities.destroy) {
          try {
            await context.world.entities.destroy();
          } catch (error: any) {
            // Ignore cleanup errors for now
          }
        }
      }
    };
  }

  /**
   * Test app interaction and communication
   */
  static getAppInteractionTest(): TestScenario {
    return {
      id: 'hyperfy-app-interaction',
      name: 'Hyperfy App Interaction Test',
      description: 'Verifies app-to-app communication and world interaction',
      
      async setup(context: TestContext): Promise<void> {
        context.log('Setting up app interaction test');
        
        // Script for sender app
        context.data.set('senderScript', `
          app.state = { messagesSent: 0 };
          
          app.sendMessage = (targetId, message) => {
            world.events.emit('app-message', {
              from: app.instanceId,
              to: targetId,
              message: message
            });
            app.state.messagesSent++;
          };
        `);
        
        // Script for receiver app
        context.data.set('receiverScript', `
          app.state = { messagesReceived: [] };
          
          world.events.on('app-message', (data) => {
            if (data.to === app.instanceId) {
              app.state.messagesReceived.push(data);
            }
          });
        `);
      },

      async execute(context: TestContext): Promise<void> {
        context.log('Executing app interaction test');
        
        const world = context.world;
        const senderScript = context.data.get('senderScript');
        const receiverScript = context.data.get('receiverScript');
        
        // Create sender app
        const senderApp = await world.entities.create('app', {
          id: 'sender-app',
          name: 'Sender App',
          type: 'app',
          script: senderScript
        });
        context.data.set('senderApp', senderApp);
        
        // Create receiver app
        const receiverApp = await world.entities.create('app', {
          id: 'receiver-app',
          name: 'Receiver App',
          type: 'app',
          script: receiverScript
        });
        context.data.set('receiverApp', receiverApp);
        
        // Test interaction
        if (senderApp && receiverApp) {
          (senderApp as any).sendMessage('receiver-app', 'Hello from sender!');
          (senderApp as any).sendMessage('receiver-app', 'Second message');
          
          // Wait for message processing
          await context.wait(200);
          
          const messagesSent = (senderApp as any).state.messagesSent;
          const messagesReceived = (receiverApp as any).state.messagesReceived;
          
          context.data.set('messagesSent', messagesSent);
          context.data.set('messagesReceived', messagesReceived);
        }
      },

      async validate(context: TestContext): Promise<TestValidation> {
        const failures: ValidationFailure[] = [];
        const warnings: string[] = [];
        
        const senderApp = context.data.get('senderApp');
        const receiverApp = context.data.get('receiverApp');
        const messagesSent = context.data.get('messagesSent');
        const messagesReceived = context.data.get('messagesReceived');
        
        // Verify apps were created
        if (!senderApp || !receiverApp) {
          failures.push({
            type: 'assertion',
            message: 'App creation failed for interaction test'
          });
        }
        
        // Verify message sending
        if (messagesSent !== 2) {
          failures.push({
            type: 'assertion',
            message: `Message sending failed: expected 2, got ${messagesSent}`
          });
        }
        
        // Verify message receiving
        if (!messagesReceived || messagesReceived.length !== 2) {
          failures.push({
            type: 'assertion',
            message: `Message receiving failed: expected 2 messages, got ${messagesReceived?.length || 0}`
          });
        }
        
        // Verify message content
        if (messagesReceived && messagesReceived.length > 0) {
          const firstMessage = messagesReceived[0];
          if (firstMessage.message !== 'Hello from sender!') {
            failures.push({
              type: 'assertion',
              message: `Message content mismatch: expected 'Hello from sender!', got '${firstMessage.message}'`
            });
          }
        }
        
        return {
          passed: failures.length === 0,
          failures,
          warnings
        };
      },

      async cleanup(context: TestContext): Promise<void> {
        const senderApp = context.data.get('senderApp');
        const receiverApp = context.data.get('receiverApp');
        
        if (senderApp && context.world.entities.destroy) {
          try {
            await context.world.entities.destroy();
          } catch (error: any) {
            // Ignore cleanup errors for now
          }
        }
        if (receiverApp && context.world.entities.destroy) {
          try {
            await context.world.entities.destroy();
          } catch (error: any) {
            // Ignore cleanup errors for now
          }
        }
      }
    };
  }

  /**
   * Get all Hyperfy App test scenarios
   */
  static getAllScenarios(): TestScenario[] {
    return [
      this.getAppCreationTest(),
      this.getAppScriptingTest(),
      this.getAppInteractionTest()
    ];
  }
}