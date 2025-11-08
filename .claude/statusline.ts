#!/usr/bin/env bun

import { readFileSync, existsSync } from 'fs';
import { basename } from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  // Model colors
  main: '\x1b[38;5;75m',      // Blue for main agent
  general: '\x1b[38;5;214m',  // Orange for general-purpose
  devops: '\x1b[38;5;46m',    // Green for devops/SRE
  security: '\x1b[38;5;196m', // Red for security
  data: '\x1b[38;5;141m',     // Purple for data/database
  system: '\x1b[38;5;226m',   // Yellow for system/architecture
  // UI elements
  dir: '\x1b[38;5;117m',      // Light blue
  git: '\x1b[38;5;155m',      // Light green
  cost: '\x1b[38;5;208m',     // Orange
  gray: '\x1b[38;5;246m',     // Gray
};

interface StatusInput {
  hook_event_name: string;
  session_id: string;
  transcript_path: string;
  cwd: string;
  model: {
    id: string;
    display_name: string;
  };
  workspace: {
    current_dir: string;
    project_dir: string;
  };
  version: string;
  output_style?: {
    name: string;
  };
  cost: {
    total_cost_usd: number;
    total_duration_ms: number;
    total_api_duration_ms: number;
    total_lines_added: number;
    total_lines_removed: number;
  };
  subagent?: {
    type: string;
    description: string;
  };
}

function getAgentColor(modelName: string, subagentType?: string): string {
  if (subagentType) {
    // Color by subagent type
    if (['devops-engineer', 'sre-consultant', 'platform-engineer'].includes(subagentType)) {
      return colors.devops;
    }
    if (['security-auditor', 'security-architect', 'compliance-officer'].includes(subagentType)) {
      return colors.security;
    }
    if (['database-architect', 'data-architect'].includes(subagentType)) {
      return colors.data;
    }
    if (['system-architect', 'enterprise-architect', 'distributed-systems-architect'].includes(subagentType)) {
      return colors.system;
    }
    return colors.general;
  }
  return colors.main;
}

function getGitBranch(dir: string): string | null {
  const gitHeadPath = `${dir}/.git/HEAD`;
  if (!existsSync(gitHeadPath)) return null;

  try {
    const headContent = readFileSync(gitHeadPath, 'utf8').trim();
    if (headContent.startsWith('ref: refs/heads/')) {
      return headContent.replace('ref: refs/heads/', '');
    }
  } catch {
    return null;
  }
  return null;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(3)}`;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m${remainingSeconds}s`;
}

// Read JSON from stdin
const input = JSON.parse(await Bun.stdin.text()) as StatusInput;

// Extract values
const modelName = input.model.display_name;
const subagentType = input.subagent?.type;
const currentDir = basename(input.workspace.current_dir);
const gitBranch = getGitBranch(input.workspace.current_dir);
const outputStyle = input.output_style?.name || 'default';
const cost = input.cost.total_cost_usd;
const duration = input.cost.total_duration_ms;
const linesAdded = input.cost.total_lines_added;
const linesRemoved = input.cost.total_lines_removed;

// Build status line
const agentColor = getAgentColor(modelName, subagentType);
const agentLabel = subagentType || modelName;

const parts: string[] = [
  `${agentColor}${agentLabel}${colors.reset}`,
  `${colors.dir}📁 ${currentDir}${colors.reset}`,
];

if (gitBranch) {
  parts.push(`${colors.git}🌿 ${gitBranch}${colors.reset}`);
}

if (outputStyle !== 'default') {
  parts.push(`${colors.gray}[${outputStyle}]${colors.reset}`);
}

if (cost > 0) {
  parts.push(`${colors.cost}${formatCost(cost)}${colors.reset}`);
}

if (linesAdded > 0 || linesRemoved > 0) {
  parts.push(`${colors.gray}+${linesAdded}/-${linesRemoved}${colors.reset}`);
}

console.log(parts.join(` ${colors.gray}|${colors.reset} `));
