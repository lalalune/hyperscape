import { System } from './System';
import * as THREE from '../extras/three';
import { DEG2RAD, RAD2DEG } from '../extras/general';
import { clamp, num, uuid } from '../utils';
import { LerpVector3 } from '../extras/LerpVector3';
import { LerpQuaternion } from '../extras/LerpQuaternion';
import { Curve } from '../extras/Curve';
import { prng } from '../extras/prng';
import { BufferedLerpVector3 } from '../extras/BufferedLerpVector3';
import { BufferedLerpQuaternion } from '../extras/BufferedLerpQuaternion';
import type { World } from '../../types/index';

/**
 * Script System - UNRESTRICTED
 *
 * - Runs on both the server and client.
 * - Executes scripts with NO sandbox restrictions
 * - Full access to Three.js and all globals
 * - SES lockdown REMOVED for pure ECS architecture
 *
 */

export interface ScriptResult {
  exec: (...args: any[]) => any;
  code: string;
}

export class Scripts extends System {
  private scriptGlobals: any;

  constructor(world: World) {
    super(world);
    
    // NO RESTRICTIONS - Full access to all globals and Three.js
    this.scriptGlobals = {
      // Full console access (no restrictions)
      console,
      // Full Math access
      Math,
      // Direct Three.js access (no wrapper)
      THREE,
      // Utility constants and functions
      DEG2RAD,
      RAD2DEG,
      clamp,
      num,
      uuid,
      LerpVector3,
      LerpQuaternion,
      Curve,
      prng,
      BufferedLerpVector3,
      BufferedLerpQuaternion,
      // Expose window object for client-side scripts
      ...(typeof window !== 'undefined' ? { window } : {}),
      // Expose global object for server-side scripts
      ...(typeof global !== 'undefined' ? { global } : {}),
    };
    
    console.log('[Scripts] UNRESTRICTED script system initialized - no sandbox');
  }

  exec(code: string): ScriptResult {
    let value;
    const { scriptGlobals } = this;

    try {
      // UNRESTRICTED execution - direct access to all globals
      console.log('[Scripts] Executing script with full access (no sandbox)');
      
      // Create a function with the script globals in scope
      const scriptFunction = new Function(
        ...Object.keys(scriptGlobals),
        `
        // UNRESTRICTED SCRIPT EXECUTION
        // Full access to Three.js, console, Math, window, etc.
        
        ${code}
        
        // Return the function if it exists
        if (typeof exec === 'function') {
          return exec;
        }
        `
      );
      
      // Execute with full globals access - no restrictions
      value = scriptFunction(...Object.values(scriptGlobals));
    } catch (error: any) {
      console.error('[Scripts] Script execution error (unrestricted mode):', error);
      throw error;
    }

    if (typeof value !== 'function') {
      throw new Error('Script must export an exec() function for unrestricted execution');
    }

    console.log('[Scripts] Script executed successfully with unrestricted access');
    return {
      exec: value,
      code,
    };
  }
} 