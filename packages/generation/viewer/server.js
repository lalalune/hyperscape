"use strict";
/**
 * Interactive Viewer Server
 * Web-based interface for viewing and managing generations
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
exports.startViewer = startViewer;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const path = __importStar(require("path"));
const src_1 = require("../src");
function startViewer(port = 3000) {
    const app = (0, express_1.default)();
    const server = app.listen(port);
    // Create WebSocket server for real-time updates
    const wss = new ws_1.WebSocketServer({ server });
    // Initialize AI service
    const service = new src_1.AICreationService(src_1.defaultConfig);
    // Static files
    app.use(express_1.default.static(path.join(__dirname, 'public')));
    app.use(express_1.default.json());
    // API endpoints
    app.get('/api/status', (req, res) => {
        res.json({
            status: 'active',
            activeGenerations: service.getActiveGenerations()
        });
    });
    app.post('/api/generate', async (req, res) => {
        try {
            const request = req.body;
            // Send updates via WebSocket
            service.on('stage-start', (data) => {
                broadcast({ type: 'stage-start', data });
            });
            service.on('stage-complete', (data) => {
                broadcast({ type: 'stage-complete', data });
            });
            service.on('error', (data) => {
                broadcast({ type: 'error', data });
            });
            const result = await service.generate(request);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    app.get('/api/generation/:id', async (req, res) => {
        try {
            const result = await service.getGeneration(req.params.id);
            if (!result) {
                res.status(404).json({ error: 'Generation not found' });
            }
            else {
                res.json(result);
            }
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    app.post('/api/regenerate/:id/:stage', async (req, res) => {
        try {
            const result = await service.regenerateStage(req.params.id, req.params.stage);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    });
    // WebSocket connection handler
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection');
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('Received:', data);
            }
            catch (error) {
                console.error('Invalid WebSocket message:', error);
            }
        });
    });
    // Broadcast to all connected clients
    function broadcast(data) {
        const message = JSON.stringify(data);
        wss.clients.forEach((client) => {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send(message);
            }
        });
    }
    console.log(`Viewer server running on http://localhost:${port}`);
}
//# sourceMappingURL=server.js.map