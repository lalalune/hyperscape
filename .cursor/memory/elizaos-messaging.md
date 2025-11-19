# ElizaOS Messaging Memory

Complete reference for real-time messaging infrastructure and Socket.IO integration in ElizaOS.

## Overview

The messaging infrastructure provides real-time communication between clients and the ElizaOS server using Socket.IO. This enables instant message delivery, presence tracking, and bidirectional communication.

## Architecture

### How WebSockets Work in ElizaOS

The project uses **Socket.IO** (not raw WebSockets) for real-time communication between clients and the Eliza server.

**Flow:**
1. Extension Service Worker → Extension Socket.IO Client
2. Extension Socket.IO Client → emit('message') → Socket.IO Server
3. Socket.IO Server → Process → Eliza Server
4. Eliza Server → Response → Socket.IO Server
5. Socket.IO Server → emit('messageBroadcast') → Socket.IO Clients
6. Socket.IO Clients → Filter by channelId → Receive broadcast

### Key Components

1. **Direct Connection**: Socket.IO connects directly to the Eliza server (default: `http://localhost:3000`)
2. **Channel-Based Communication**: Messages are organized by channels (or rooms for backward compatibility)
3. **Message Filtering**: Clients filter incoming broadcasts by channel/room ID

## Socket.IO Events and Message Types

### Message Types Enum

```javascript
enum SOCKET_MESSAGE_TYPE {
  ROOM_JOINING = 1,      // Join a channel/room
  SEND_MESSAGE = 2,      // Send a message
  MESSAGE = 3,           // Generic message
  ACK = 4,              // Acknowledgment
  THINKING = 5,         // Agent is thinking
  CONTROL = 6           // Control messages
}
```

### Key Events

- `messageBroadcast` - Incoming messages from agents/users
- `messageComplete` - Message processing complete
- `controlMessage` - UI control (enable/disable input)
- `connection_established` - Connection confirmed

## Socket.IO Client Implementation

### Minimal Socket.IO Client

```javascript
const SOCKET_URL = 'http://localhost:3000';

// 1. Connect to Socket.IO
const socket = io(SOCKET_URL, {
  'force new connection': true,
  'reconnection': true,
  'reconnectionDelay': 1000,
  'reconnectionAttempts': 5,
  'timeout': 20000,
  'transports': ['polling', 'websocket']
});

// Your IDs (make sure these match exactly)
const entityId = 'your-entity-id';
const roomId = 'your-room-id'; // This should match the agent/channel ID

// 2. CRITICAL: Join the room when connected
socket.on('connect', function() {
  console.log('[SUCCESS] Connected to Eliza, socket ID:', socket.id);
  
  // JOIN THE ROOM - This is required to receive broadcasts!
  socket.emit('message', {
    type: 1, // ROOM_JOINING
    payload: {
      roomId: roomId,
      entityId: entityId
    }
  });
  
  console.log('[SENT] Room join request for room:', roomId);
});

// 3. LISTEN FOR THE CORRECT EVENT: "messageBroadcast" (not "message")
socket.on('messageBroadcast', function(data) {
  console.log('[RECEIVED] Broadcast:', data);
  
  // Check if this message is for your room
  if (data.roomId === roomId || data.channelId === roomId) {
    console.log('[SUCCESS] Message is for our room!');
    console.log('Sender:', data.senderName);
    console.log('Text:', data.text);
    console.log('Full data:', JSON.stringify(data, null, 2));
  } else {
    console.log('[ERROR] Message is for different room:', data.roomId || data.channelId);
  }
});

// 4. Listen for other important events
socket.on('messageComplete', function(data) {
  console.log('[SUCCESS] Message processing complete:', data);
});

socket.on('connection_established', function(data) {
  console.log('[SUCCESS] Connection established:', data);
});

// 5. Send a message (make sure format is exact)
function sendMessageToEliza(text) {
  const messagePayload = {
    type: 2, // SEND_MESSAGE
    payload: {
      senderId: entityId,
      senderName: 'Extension User',
      message: text,
      roomId: roomId,        // Include roomId
      messageId: generateUUID(),
      source: 'extension',
      attachments: [],
      metadata: {}
    }
  };
  
  console.log('[SENDING] Message:', messagePayload);
  socket.emit('message', messagePayload);
}
```

### Modern Implementation (Socket.IO v4.x)

```javascript
import { io } from 'socket.io-client';

const SOCKET_URL = 'http://localhost:3000';

class ElizaSocketClient {
  constructor(entityId, roomId) {
    this.entityId = entityId;
    this.roomId = roomId;
    this.socket = null;
  }

  connect() {
    this.socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('Connected to Eliza');
      this.joinRoom();
    });

    this.socket.on('messageBroadcast', (data) => {
      if (data.roomId === this.roomId || data.channelId === this.roomId) {
        this.onMessageReceived(data);
      }
    });

    // Debug: Log all events
    this.socket.onAny((eventName, ...args) => {
      console.log('Event:', eventName, args);
    });
  }

  joinRoom() {
    this.socket.emit('message', {
      type: 1, // ROOM_JOINING
      payload: {
        roomId: this.roomId,
        entityId: this.entityId,
      }
    });
  }

  sendMessage(text) {
    this.socket.emit('message', {
      type: 2, // SEND_MESSAGE
      payload: {
        senderId: this.entityId,
        senderName: 'Extension User',
        message: text,
        roomId: this.roomId,
        messageId: this.generateUUID(),
        source: 'extension',
        attachments: [],
        metadata: {}
      }
    });
  }

  onMessageReceived(data) {
    console.log('Message received:', data);
    // Handle the message in your application
  }

  generateUUID() {
    return crypto.randomUUID ? crypto.randomUUID() : 
      'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}
```

## Key Points to Check

### 1. Event Name

```javascript
// [WRONG]
socket.on('message', handler)

// [CORRECT]
socket.on('messageBroadcast', handler)
```

### 2. Room Joining Required

```javascript
// You MUST join the room before receiving broadcasts
socket.emit('message', {
  type: 1, // ROOM_JOINING
  payload: {
    roomId: roomId,
    entityId: entityId
  }
});
```

### 3. Exact Message Format

```javascript
// The structure must be exact
{
  type: 2, // SEND_MESSAGE type
  payload: {
    senderId: entityId,
    senderName: 'Extension User',
    message: text,
    roomId: roomId,
    messageId: generateUUID(),
    source: 'extension',
    attachments: [],
    metadata: {}
  }
}
```

## Complete Message Flow

1. **Client connects** → Server accepts connection
2. **Client joins room** → Server adds client to room
3. **Client sends message** → Server receives and processes
4. **Server broadcasts response** → All clients in room receive
5. **Clients filter by room ID** → Only relevant messages shown

## Debugging Steps

### 1. Verify Events

```javascript
// For newer Socket.IO versions
socket.onAny((eventName, ...args) => {
  console.log('Event received:', eventName, args);
});

// For older versions
const onevent = socket.onevent;
socket.onevent = function(packet) {
  console.log('Event:', packet.data);
  onevent.call(socket, packet);
};
```

### 2. Check Room ID

- Ensure the room ID matches exactly between your extension and the server
- Even a single character difference will prevent message delivery

### 3. CORS Issues

For browser extensions, ensure your manifest includes:

```json
{
  "permissions": ["http://localhost:3000/*"],
  "host_permissions": ["http://localhost:3000/*"]
}
```

### 4. Transport Issues

If WebSocket fails, force polling:

```javascript
const socket = io(SOCKET_URL, {
  transports: ['polling'] // Avoid WebSocket issues
});
```

## Socket.IO Version Compatibility

### Version Issues

- **v1.3.0** (2015) - Very old, may have compatibility issues
- **v4.x** (Current) - Recommended for new implementations

### Upgrading

```json
// package.json
{
  "dependencies": {
    "socket.io-client": "^4.5.0"
  }
}
```

## Common Mistakes

1. **Wrong event name** - Using `message` instead of `messageBroadcast`
2. **Not joining room** - Forgetting the `ROOM_JOINING` step
3. **ID mismatch** - Room/channel IDs don't match exactly
4. **Missing fields** - Payload missing required fields
5. **CORS blocked** - Extension lacks permissions

## Server-Side Implementation

The Socket.IO server handles message routing and broadcasting:

```typescript
class SocketIOService extends Service {
  static serviceType = 'socketio' as const;
  capabilityDescription = 'Real-time messaging via Socket.IO';
  
  private io: Server;
  
  async start(runtime: IAgentRuntime) {
    this.io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });
    
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      
      socket.on('message', async (data) => {
        if (data.type === SOCKET_MESSAGE_TYPE.ROOM_JOINING) {
          await this.handleRoomJoin(socket, data.payload);
        } else if (data.type === SOCKET_MESSAGE_TYPE.SEND_MESSAGE) {
          await this.handleMessage(socket, data.payload);
        }
      });
      
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });
  }
  
  private async handleRoomJoin(socket: Socket, payload: any) {
    const { roomId, entityId } = payload;
    
    // Join the room
    socket.join(roomId);
    
    // Notify others in room
    socket.to(roomId).emit('userJoined', {
      userId: entityId,
      roomId: roomId
    });
    
    console.log(`User ${entityId} joined room ${roomId}`);
  }
  
  private async handleMessage(socket: Socket, payload: any) {
    const { roomId, message, senderId } = payload;
    
    // Process message through runtime
    const response = await this.runtime.processMessage({
      content: message,
      roomId: roomId,
      userId: senderId
    });
    
    // Broadcast to all in room
    this.io.to(roomId).emit('messageBroadcast', {
      roomId: roomId,
      channelId: roomId, // For backward compatibility
      senderName: response.agentName,
      text: response.text,
      metadata: response.metadata
    });
  }
  
  async stop() {
    this.io.close();
  }
}
```

## Advanced Features

### Presence Tracking

```javascript
// Track user presence
socket.on('userJoined', (data) => {
  console.log(`User ${data.userId} joined room ${data.roomId}`);
});

socket.on('userLeft', (data) => {
  console.log(`User ${data.userId} left room ${data.roomId}`);
});
```

### Typing Indicators

```javascript
// Send typing indicator
socket.emit('typing', {
  roomId: roomId,
  userId: userId,
  isTyping: true
});

// Listen for typing indicators
socket.on('userTyping', (data) => {
  if (data.roomId === roomId) {
    console.log(`${data.userId} is ${data.isTyping ? 'typing' : 'stopped typing'}`);
  }
});
```

### Message Acknowledgments

```javascript
// Send message with acknowledgment
socket.emit('message', messagePayload, (ack) => {
  console.log('Message acknowledged:', ack);
});
```

## Best Practices

1. **Use correct event name**: `messageBroadcast` not `message`
2. **Join room on connection**: Required to receive broadcasts
3. **Match room IDs exactly**: Single character difference prevents delivery
4. **Use exact message format**: Structure must match exactly
5. **Handle CORS properly**: Include permissions in manifest
6. **Use modern Socket.IO**: v4.x recommended
7. **Handle reconnection**: Automatic reconnection enabled
8. **Filter by room ID**: Check roomId/channelId in handlers
9. **Debug with onAny**: Log all events for debugging
10. **Handle errors gracefully**: Connection errors, disconnects

## Documentation References

- **Messaging**: https://docs.elizaos.ai/runtime/messaging
- **Sessions API**: https://docs.elizaos.ai/runtime/sessions-api
- **Services**: https://docs.elizaos.ai/runtime/services
- **Events**: https://docs.elizaos.ai/runtime/events

