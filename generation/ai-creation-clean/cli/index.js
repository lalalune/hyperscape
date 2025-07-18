#!/usr/bin/env node
"use strict";
/**
 * AI Creation CLI
 * Command-line interface for asset generation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const chalk_1 = __importDefault(require("chalk"));
const ora_1 = __importDefault(require("ora"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const src_1 = require("../src");
const helpers_1 = require("../src/utils/helpers");
const program = new commander_1.Command();
program
    .name('hyperscape-ai')
    .description('AI-powered asset generation for Hyperscape RPG')
    .version('1.0.0');
// Generate command
program
    .command('generate <description>')
    .description('Generate a single asset from description')
    .option('-t, --type <type>', 'Asset type (weapon, armor, character, etc)')
    .option('-s, --style <style>', 'Visual style (realistic, cartoon, low-poly)')
    .option('-n, --name <name>', 'Asset name')
    .option('--skip-image', 'Skip image generation and use existing image')
    .option('--image-url <url>', 'Use existing image URL')
    .action(async (description, options) => {
    const spinner = (0, ora_1.default)('Initializing AI Creation Service...').start();
    try {
        // Load config
        const config = await loadConfig();
        const service = new src_1.AICreationService(config);
        // Prepare request
        const request = {
            id: Date.now().toString(),
            name: options.name || description.slice(0, 30),
            description,
            type: options.type || (0, helpers_1.parseAssetType)(description),
            style: options.style
        };
        spinner.text = 'Starting generation pipeline...';
        // Listen to events
        service.on('stage-start', ({ stage }) => {
            spinner.text = `Processing stage: ${stage}`;
        });
        service.on('stage-complete', ({ stage }) => {
            spinner.succeed(`Completed stage: ${stage}`);
            spinner.start('Continuing...');
        });
        // Generate
        const result = await service.generate(request);
        spinner.succeed('Asset generation complete!');
        // Display results
        console.log(chalk_1.default.green('\n✅ Generation successful!'));
        console.log(chalk_1.default.gray('ID:'), result.id);
        console.log(chalk_1.default.gray('Name:'), result.request.name);
        console.log(chalk_1.default.gray('Type:'), result.request.type);
        if (result.finalAsset) {
            console.log(chalk_1.default.gray('Output:'), result.finalAsset.modelUrl);
        }
        // Display stage summary
        console.log(chalk_1.default.blue('\n📊 Stage Summary:'));
        for (const stage of result.stages) {
            const icon = stage.status === 'completed' ? '✅' : '❌';
            console.log(`  ${icon} ${stage.stage}: ${stage.status}`);
        }
    }
    catch (error) {
        spinner.fail('Generation failed!');
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Batch command
program
    .command('batch <file>')
    .description('Generate multiple assets from JSON file')
    .option('--parallel <count>', 'Number of parallel generations', '5')
    .action(async (file, options) => {
    const spinner = (0, ora_1.default)('Loading batch file...').start();
    try {
        // Load batch file
        const content = await fs.readFile(file, 'utf-8');
        const items = JSON.parse(content);
        if (!Array.isArray(items)) {
            throw new Error('Batch file must contain an array of items');
        }
        spinner.succeed(`Loaded ${items.length} items`);
        // Load config and create service
        const config = await loadConfig();
        const service = new src_1.AICreationService(config);
        // Prepare requests
        const requests = items.map((item, index) => ({
            id: `batch-${Date.now()}-${index}`,
            name: item.name || item.description.slice(0, 30),
            description: item.description,
            type: item.type || (0, helpers_1.parseAssetType)(item.description),
            style: item.style,
            metadata: item.metadata
        }));
        // Progress tracking
        let completed = 0;
        service.on('complete', () => {
            completed++;
            spinner.text = `Progress: ${completed}/${items.length}`;
        });
        spinner.start('Starting batch generation...');
        // Generate
        const results = await service.batchGenerate(requests);
        spinner.succeed(`Batch generation complete! ${results.length} assets generated`);
        // Save summary
        const summary = {
            total: items.length,
            successful: results.filter(r => r.stages.every(s => s.status === 'completed')).length,
            failed: results.filter(r => r.stages.some(s => s.status === 'failed')).length,
            results: results.map(r => ({
                id: r.id,
                name: r.request.name,
                type: r.request.type,
                status: r.stages.every(s => s.status === 'completed') ? 'success' : 'failed',
                output: r.finalAsset?.modelUrl
            }))
        };
        const summaryPath = `batch-summary-${Date.now()}.json`;
        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
        console.log(chalk_1.default.green(`\n📄 Summary saved to: ${summaryPath}`));
    }
    catch (error) {
        spinner.fail('Batch generation failed!');
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Regenerate command
program
    .command('regenerate <id> <stage>')
    .description('Regenerate a specific stage of an existing generation')
    .action(async (id, stage) => {
    const spinner = (0, ora_1.default)('Loading generation...').start();
    try {
        const config = await loadConfig();
        const service = new src_1.AICreationService(config);
        // Listen to events
        service.on('stage-start', ({ stage }) => {
            spinner.text = `Processing stage: ${stage}`;
        });
        service.on('stage-complete', ({ stage }) => {
            spinner.succeed(`Completed stage: ${stage}`);
            spinner.start('Continuing...');
        });
        // Regenerate
        const result = await service.regenerateStage(id, stage);
        spinner.succeed('Regeneration complete!');
        console.log(chalk_1.default.green('\n✅ Regeneration successful!'));
        console.log(chalk_1.default.gray('Output:'), result.finalAsset?.modelUrl);
    }
    catch (error) {
        spinner.fail('Regeneration failed!');
        console.error(chalk_1.default.red('Error:'), error instanceof Error ? error.message : error);
        process.exit(1);
    }
});
// Config command
program
    .command('config')
    .description('Show current configuration')
    .action(async () => {
    try {
        const config = await loadConfig();
        console.log(chalk_1.default.blue('Current Configuration:'));
        console.log(JSON.stringify(config, null, 2));
    }
    catch (error) {
        console.error(chalk_1.default.red('Error loading config:'), error);
    }
});
// Viewer command
program
    .command('viewer')
    .description('Start the interactive viewer')
    .option('-p, --port <port>', 'Port to run viewer on', '3000')
    .action(async (options) => {
    console.log(chalk_1.default.blue(`Starting viewer on port ${options.port}...`));
    console.log(chalk_1.default.gray('Visit http://localhost:' + options.port));
    // Import and start viewer
    const { startViewer } = await Promise.resolve().then(() => __importStar(require('../viewer/server')));
    startViewer(parseInt(options.port));
});
// Helper function to load config
async function loadConfig() {
    // Check for config file
    const configPath = path.join(process.cwd(), 'ai-creation.config.json');
    try {
        const configFile = await fs.readFile(configPath, 'utf-8');
        const fileConfig = JSON.parse(configFile);
        // Merge with defaults and env vars
        return {
            ...src_1.defaultConfig,
            ...fileConfig,
            openai: {
                ...src_1.defaultConfig.openai,
                ...fileConfig.openai,
                apiKey: process.env.OPENAI_API_KEY || fileConfig.openai?.apiKey || src_1.defaultConfig.openai.apiKey
            },
            meshy: {
                ...src_1.defaultConfig.meshy,
                ...fileConfig.meshy,
                apiKey: process.env.MESHY_API_KEY || fileConfig.meshy?.apiKey || src_1.defaultConfig.meshy.apiKey
            }
        };
    }
    catch {
        // Use defaults with env vars
        return {
            ...src_1.defaultConfig,
            openai: {
                ...src_1.defaultConfig.openai,
                apiKey: process.env.OPENAI_API_KEY || src_1.defaultConfig.openai.apiKey
            },
            meshy: {
                ...src_1.defaultConfig.meshy,
                apiKey: process.env.MESHY_API_KEY || src_1.defaultConfig.meshy.apiKey
            }
        };
    }
}
// Parse and run
program.parse();
//# sourceMappingURL=index.js.map