export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object';
  required?: boolean;
  description?: string;
}

export interface ActionDefinition {
  name: string;
  description: string;
  parameters: ActionParameter[];
  validate?: (context: ActionContext) => boolean;
  execute: (context: ActionContext, params: any) => Promise<any>;
}

export interface ActionContext {
  world: any;
  playerId?: string;
  entity?: any;
  [key: string]: any;
}

export class ActionRegistry {
  private actions = new Map<string, ActionDefinition>();
  
  register(action: ActionDefinition): void {
    this.actions.set(action.name, action);
    console.log(`[ActionRegistry] Registered action: ${action.name}`);
  }
  
  unregister(name: string): boolean {
    const removed = this.actions.delete(name);
    if (removed) {
      console.log(`[ActionRegistry] Unregistered action: ${name}`);
    }
    return removed;
  }
  
  get(name: string): ActionDefinition | undefined {
    return this.actions.get(name);
  }
  
  getAll(): ActionDefinition[] {
    return Array.from(this.actions.values());
  }
  
  getAvailable(context: ActionContext): ActionDefinition[] {
    return this.getAll().filter(action => 
      !action.validate || action.validate(context)
    );
  }
  
  async execute(name: string, context: ActionContext, params: any): Promise<any> {
    const action = this.actions.get(name);
    if (!action) {
      throw new Error(`Action not found: ${name}`);
    }
    
    if (action.validate && !action.validate(context)) {
      throw new Error(`Action validation failed: ${name}`);
    }
    
    return await action.execute(context, params);
  }
}