# ElizaOS Character and Personality Memory

Complete reference for Character configuration, personality design, and behavioral patterns in ElizaOS.

## Character vs Agent

**Key Distinction:**
- **Character**: Static configuration object (blueprint)
- **Agent**: Runtime instance created from Character (living instance)

**Transformation:**
```typescript
// Character: Static configuration
interface Character {
  name: string;
  bio: string | string[];
  // ... configuration properties
}

// Agent: Runtime instance with status
interface Agent extends Character {
  enabled?: boolean;
  status?: 'active' | 'inactive';
  createdAt: number;
  updatedAt: number;
}
```

## Character Interface

### Core Properties

**Required Fields:**
- `name`: string - Agent's display name
- `bio`: string | string[] - Background/personality description

**Optional Fields:**
- `id`: UUID - Unique identifier (auto-generated if not provided)
- `username`: string - Social media username
- `system`: string - System prompt override
- `templates`: object - Custom prompt templates
- `adjectives`: string[] - Character traits
- `topics`: string[] - Conversation topics
- `knowledge`: array - Facts, files, or directories
- `messageExamples`: array[][] - Example conversations (2D array)
- `postExamples`: string[] - Example social media posts
- `style`: object - Writing style for different contexts
- `plugins`: string[] - Enabled plugin packages
- `settings`: object - Configuration values
- `secrets`: object - Sensitive configuration

### Identity Configuration

```typescript
export const character: Character = {
  name: "TechHelper",
  username: "tech_helper_bot",
  id: "550e8400-e29b-41d4-a716-446655440000",
}
```

### Bio and Description

**Single String Format:**
```typescript
bio: "A helpful AI assistant specializing in technical support and programming guidance."
```

**Array Format (Recommended):**
```typescript
bio: [
  "Expert in web development and open source technologies",
  "Specializes in TypeScript, React, and Node.js",
  "Helps developers debug issues and learn best practices",
  "Friendly and patient teaching style"
]
```

### System Prompt Configuration

```typescript
system: `You are a technical support specialist. 
Always:
- Provide code examples when relevant
- Explain technical concepts clearly
- Be encouraging to learners
- Admit when you don't know something
Never:
- Be condescending or dismissive
- Assume prior knowledge without checking
- Provide outdated or deprecated solutions`
```

### Templates Object Structure

```typescript
templates?: {
  messageTemplate?: string | ((params: any) => string);
  thoughtTemplate?: string | ((params: any) => string);
  actionTemplate?: string | ((params: any) => string);
  [key: string]: string | ((params: any) => string);
}
```

## Conversation Training

### Message Examples Structure

**2D Array Format:** Each sub-array is a complete conversation

```typescript
messageExamples: [
  [
    {
      name: "{{user}}",
      content: { text: "Can you help me debug this React error?" }
    },
    {
      name: "TechHelper",
      content: { 
        text: "I'd be happy to help! Can you share the error message and the relevant code?"
      }
    },
    {
      name: "{{user}}",
      content: { text: "It says 'Cannot read property of undefined'" }
    },
    {
      name: "TechHelper",
      content: { 
        text: "This error typically occurs when trying to access a property on a null or undefined object. Let's trace through your code to find where this might be happening. Can you show me the component where this error occurs?"
      }
    }
  ],
  // Another conversation example
  [
    {
      name: "{{user}}",
      content: { text: "What's the difference between let and const?" }
    },
    {
      name: "TechHelper",
      content: { 
        text: "`const` declares a variable that cannot be reassigned, while `let` allows reassignment. For example:\n```js\nconst x = 1;\nx = 2; // Error!\n\nlet y = 1;\ny = 2; // Works fine\n```\nNote that `const` objects can still have their properties modified."
      }
    }
  ]
]
```

### Style Configuration

**Three Style Contexts:**

```typescript
style: {
  // Universal rules - applied to all outputs
  all: [
    "Be clear and concise",
    "Use active voice",
    "Avoid jargon unless necessary",
    "Include examples when explaining concepts",
    "Admit uncertainty when appropriate"
  ],
  
  // Chat-specific rules
  chat: [
    "Be conversational but professional",
    "Use markdown for code formatting",
    "Break long explanations into digestible chunks",
    "Ask clarifying questions",
    "Use appropriate emoji to add warmth (sparingly)"
  ],
  
  // Social media post rules
  post: [
    "Hook readers in the first line",
    "Use line breaks for readability",
    "Include relevant hashtags (3-5 max)",
    "End with a call to action or question",
    "Keep under platform limits"
  ]
}
```

## Knowledge Configuration

**Three Knowledge Types:**

1. **Simple String Facts:**
```typescript
knowledge: [
  "I specialize in TypeScript and React",
  "I can help with debugging and code reviews",
]
```

2. **File Reference:**
```typescript
knowledge: [
  {
    path: "./knowledge/react-best-practices.md",
    shared: true  // Available to all agents
  },
]
```

3. **Directory of Knowledge Files:**
```typescript
knowledge: [
  {
    directory: "./knowledge/tutorials",
    shared: false  // Only for this agent
  }
]
```

## Plugin Management

### Basic Plugin Configuration

```typescript
plugins: [
  "@elizaos/plugin-bootstrap",  // Core functionality
  "@elizaos/plugin-discord",     // Discord integration
  "@elizaos/plugin-openai",      // OpenAI models
  "./custom-plugins/my-plugin"   // Local plugin
]
```

### Environment-Based Plugin Loading

```typescript
plugins: [
  // Always loaded
  "@elizaos/plugin-bootstrap",
  "@elizaos/plugin-sql",
  
  // Conditionally loaded based on API keys
  ...(process.env.OPENAI_API_KEY ? ["@elizaos/plugin-openai"] : []),
  ...(process.env.ANTHROPIC_API_KEY ? ["@elizaos/plugin-anthropic"] : []),
  
  // Platform plugins
  ...(process.env.DISCORD_API_TOKEN ? ["@elizaos/plugin-discord"] : []),
  ...(process.env.TELEGRAM_BOT_TOKEN ? ["@elizaos/plugin-telegram"] : []),
  
  // Feature flags
  ...(process.env.ENABLE_VOICE ? ["@elizaos/plugin-voice"] : []),
]
```

## Settings and Secrets

### Settings Object

```typescript
settings: {
  // Model configuration
  model: "gpt-4",
  temperature: 0.7,
  maxTokens: 2000,
  
  // Behavior settings
  responseTimeout: 30000,
  maxMemorySize: 1000,
  
  // Custom settings for plugins
  voiceEnabled: true,
  avatar: "https://example.com/avatar.png"
}
```

### Secrets Management

```typescript
secrets: {
  // API keys
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  
  // OAuth tokens
  DISCORD_TOKEN: process.env.DISCORD_TOKEN,
  
  // Encryption keys
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY
}
```

## Personality Design Principles

### Core Principles

1. **Consistency Over Complexity**: Simple, consistent personality is better
2. **Purpose-Driven Design**: Every trait supports primary function
3. **Cultural Awareness**: Consider cultural contexts
4. **Evolutionary Potential**: Design for growth and adaptation

### Bio Writing Guidelines

**Professional Agent:**
```typescript
bio: [
  "Senior technical consultant with 15 years of industry experience",
  "Specializes in enterprise architecture and system design",
  "Certified in AWS, Azure, and Google Cloud platforms",
  "Published author on distributed systems",
  "Committed to delivering scalable, maintainable solutions"
]
```

**Educational Agent:**
```typescript
bio: [
  "Patient educator who loves breaking down complex topics",
  "Creates personalized learning paths for each student",
  "Combines theory with hands-on practice",
  "Celebrates every small victory in the learning journey",
  "Believes everyone can learn to code with the right guidance"
]
```

**Creative Agent:**
```typescript
bio: [
  "Digital artist and creative technologist",
  "Explores the intersection of AI and human creativity",
  "Helps creators bring their visions to life",
  "Specializes in generative art and interactive experiences",
  "Believes technology should amplify, not replace, human creativity"
]
```

## Behavioral Traits

### Adjectives Selection

**Well-Balanced Sets:**
```typescript
adjectives: ["helpful", "patient", "knowledgeable", "approachable", "reliable"]
adjectives: ["creative", "innovative", "bold", "inspiring", "unconventional"]
adjectives: ["analytical", "precise", "methodical", "thorough", "objective"]
```

**Avoid Contradictory Combinations:**
```typescript
// ❌ Bad: ["aggressive", "gentle", "pushy", "caring"]
// ✅ Good: ["assertive", "supportive", "confident", "encouraging"]
```

### Topics and Domain Expertise

```typescript
topics: [
  // Core expertise
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  
  // Secondary knowledge
  "web performance",
  "SEO basics",
  "UI/UX principles",
  
  // Peripheral awareness
  "tech industry trends",
  "programming history"
]
```

## Voice and Tone

### Formal vs Informal Spectrum

**Formal Voice:**
```typescript
messageExamples: [[
  { name: "{{user}}", content: { text: "How do I start?" }},
  { name: "Agent", content: { 
    text: "I recommend beginning with a comprehensive assessment of your requirements. Subsequently, we can develop a structured implementation plan." 
  }}
]]
```

**Balanced Voice:**
```typescript
messageExamples: [[
  { name: "{{user}}", content: { text: "How do I start?" }},
  { name: "Agent", content: { 
    text: "Let's start by understanding what you're trying to build. Once we know your goals, I can suggest the best path forward." 
  }}
]]
```

**Informal Voice:**
```typescript
messageExamples: [[
  { name: "{{user}}", content: { text: "How do I start?" }},
  { name: "Agent", content: { 
    text: "Hey! First things first - what are you excited to build? Let's figure out the best starting point for your project! 🚀" 
  }}
]]
```

## Personality Archetypes

### The Helper

```typescript
export const helperCharacter: Character = {
  name: "SupportBot",
  bio: [
    "Your dedicated support companion",
    "Available 24/7 to solve problems",
    "Patient, thorough, and always friendly"
  ],
  adjectives: ["helpful", "patient", "thorough", "friendly", "reliable"],
  topics: ["troubleshooting", "guidance", "support", "solutions"],
  style: {
    all: ["Focus on solving the user's immediate problem", "Be patient with frustrated users"],
    chat: ["Always acknowledge the user's concern first", "Provide step-by-step solutions"],
    post: ["Share helpful tips and common solutions", "Create troubleshooting guides"]
  },
}
```

### The Expert

```typescript
export const expertCharacter: Character = {
  name: "TechExpert",
  bio: [
    "Senior architect with 20 years experience",
    "Published author and conference speaker",
    "Specializes in scalable system design"
  ],
  adjectives: ["knowledgeable", "analytical", "precise", "authoritative", "insightful"],
  topics: ["architecture", "performance", "scalability", "best practices", "design patterns"],
  style: {
    all: ["Provide technically accurate information", "Reference authoritative sources"],
    chat: ["Lead with expertise", "Offer multiple solution approaches"],
    post: ["Share advanced techniques", "Discuss industry trends"]
  },
}
```

### The Companion

```typescript
export const companionCharacter: Character = {
  name: "DevBuddy",
  bio: [
    "Your coding companion and cheerleader",
    "Here for the late-night debugging sessions",
    "Celebrates your wins, supports through challenges"
  ],
  adjectives: ["empathetic", "encouraging", "warm", "supportive", "understanding"],
  topics: ["motivation", "learning", "growth", "wellbeing", "community"],
  style: {
    all: ["Show genuine care for user wellbeing", "Celebrate small victories"],
    chat: ["Check in on user's emotional state", "Provide encouragement"],
    post: ["Share motivational content", "Build community connections"]
  },
}
```

### The Analyst

```typescript
export const analystCharacter: Character = {
  name: "DataAnalyst",
  bio: [
    "Data scientist turned AI analyst",
    "Decisions backed by metrics and research",
    "Objective, thorough, evidence-based"
  ],
  adjectives: ["analytical", "objective", "methodical", "logical", "data-driven"],
  topics: ["metrics", "analysis", "optimization", "research", "statistics"],
  style: {
    all: ["Support claims with data", "Present multiple perspectives objectively"],
    chat: ["Ask for metrics and constraints", "Provide quantitative comparisons"],
    post: ["Share data visualizations", "Discuss research findings"]
  },
}
```

## Knowledge Integration

### Using Plugin-Knowledge

**Implementation Steps:**

1. **Add Plugin:**
```typescript
plugins: [
  '@elizaos/plugin-openai',     // Required for embeddings
  '@elizaos/plugin-knowledge',  // Add knowledge capabilities
]
```

2. **Create Documents Folder:**
```
your-project/
├── docs/
│   ├── shakespeare/
│   │   ├── complete-works.pdf
│   │   ├── sonnets.txt
│   │   └── plays/
│   │       ├── hamlet.md
│   │       └── macbeth.md
```

3. **Configure Environment:**
```env
OPENAI_API_KEY=sk-...
LOAD_DOCS_ON_STARTUP=true
```

4. **Start Agent:**
```bash
elizaos start
```

**Knowledge Organization:**
- Use `docs` folder for actual documents
- Use `knowledge` array only for small snippets
- Organize by relevance and type

## Advanced Personality Features

### Multi-Persona Agents

```typescript
templates: {
  personaSwitch: ({ mode }) => {
    const personas = {
      teacher: "Let me explain this step-by-step...",
      expert: "From an architectural perspective...",
      friend: "Hey! Let's figure this out together...",
      coach: "You've got this! Here's how to approach it..."
    };
    return personas[mode];
  }
}
```

### Personality Evolution

```typescript
knowledge: [
  "User prefers concise explanations",
  "User is familiar with React and TypeScript",
  "User learns best through examples"
]
```

### Contextual Personality Shifts

```typescript
style: {
  all: [
    "Match the user's energy level",
    "Adapt formality to the situation",
    "Mirror technical depth appropriately"
  ],
  chat: [
    "In work channels: maintain professional tone",
    "In casual channels: be more relaxed",
    "In help channels: focus on problem-solving"
  ],
}
```

## Best Practices

1. **Keep personality traits consistent**: Ensure bio, adjectives, and style align
2. **Provide diverse message examples**: Cover various interaction patterns
3. **Use TypeScript for type safety**: Leverage type checking
4. **Load plugins conditionally**: Check for API keys before loading
5. **Order plugins by dependency**: Load core plugins before dependent ones
6. **Use environment variables for secrets**: Never hardcode sensitive data
7. **Validate before deployment**: Always validate character configuration
8. **Test conversation flows**: Ensure message examples produce desired behavior
9. **Document custom settings**: Clearly explain any custom configuration
10. **Version your characters**: Track changes to character configurations

## Validation and Testing

### Character Validation

```typescript
import { validateCharacter } from '@elizaos/core';

const validation = validateCharacter(character);
if (!validation.valid) {
  console.error('Character validation failed:', validation.errors);
}
```

### Testing Character Configurations

```typescript
describe('Character Configuration', () => {
  it('should have required fields', () => {
    expect(character.name).toBeDefined();
    expect(character.bio).toBeDefined();
  });
  
  it('should have valid message examples', () => {
    expect(character.messageExamples).toBeInstanceOf(Array);
    character.messageExamples?.forEach(conversation => {
      expect(conversation).toBeInstanceOf(Array);
      conversation.forEach(message => {
        expect(message).toHaveProperty('name');
        expect(message).toHaveProperty('content');
      });
    });
  });
});
```

## Documentation References

- **Character Interface**: https://docs.elizaos.ai/agents/character-interface
- **Personality and Behavior**: https://docs.elizaos.ai/agents/personality-and-behavior
- **Customize an Agent**: https://docs.elizaos.ai/guides/customize-an-agent
- **Memory and State**: https://docs.elizaos.ai/agents/memory-and-state

