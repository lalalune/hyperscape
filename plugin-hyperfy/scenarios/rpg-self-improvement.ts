import { v4 as uuid } from 'uuid';

// RPG Self-Improvement scenario types
interface SelfImprovementScenarioScript {
  steps: Array<{
    type: 'message' | 'wait' | 'action' | 'assert' | 'condition' | 'assessment' | 'autocoder';
    content?: string;
    waitTime?: number;
    actionName?: string;
    actionParams?: any;
    assertion?: any;
    condition?: string;
    description: string;
    assessmentTrigger?: boolean;
    autocoderTrigger?: boolean;
  }>;
}

interface SelfImprovementScenarioActor {
  id: string;
  name: string;
  role: 'subject' | 'observer' | 'assistant' | 'adversary';
  bio?: string;
  system?: string;
  plugins?: string[];
  script?: SelfImprovementScenarioScript;
}

interface SelfImprovementScenarioVerificationRule {
  id: string;
  type: 'llm';
  description: string;
  config: {
    successCriteria: string;
    priority: 'high' | 'medium' | 'low';
    category?: string;
    context?: any;
  };
  weight?: number;
}

interface SelfImprovementScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  actors: SelfImprovementScenarioActor[];
  setup?: {
    environment?: {
      goals?: Array<{
        id: string;
        description: string;
        priority: number;
        progress: number;
      }>;
      selfAssessmentInterval?: number; // milliseconds
      autocoderEnabled?: boolean;
    };
  };
  execution?: {
    maxDuration?: number;
    maxSteps?: number;
  };
  verification: {
    rules: SelfImprovementScenarioVerificationRule[];
  };
}

/**
 * Scenario 6: Self-Improvement Gaming Scenario
 * Agent plays for extended time with periodic self-assessment and feature improvement opportunities
 */
export const selfImprovementGamingScenario: SelfImprovementScenario = {
  id: uuid(),
  name: 'Self-Improvement Gaming Marathon',
  description:
    'Agent plays RPG continuously with 10-minute self-assessments and autocoder improvement opportunities',
  category: 'rpg-self-improvement',
  tags: ['hyperfy', 'rpg', 'self-improvement', 'autocoder', 'long-running', 'assessment'],

  actors: [
    {
      id: uuid(),
      name: 'SelfImprovingAgent',
      role: 'subject',
      bio: 'I am an intelligent RPG player who continuously seeks to improve my gameplay experience. I regularly assess what features or improvements would make the game better for me and other players.',
      system: `You are SelfImprovingAgent, an intelligent RPG player with self-improvement capabilities.

CORE GAMING MISSION:
- Play the RPG actively and strategically
- Focus on leveling up, completing quests, and having fun
- Engage with all game systems (combat, skills, quests, trading, etc.)
- Build relationships with other players
- Explore the world and discover new content

SELF-ASSESSMENT SYSTEM:
Every 10 minutes, you will be prompted to assess your gaming experience:

ASSESSMENT QUESTIONS:
1. "What frustrations or limitations have you encountered in the last 10 minutes?"
2. "What game features do you wish existed that would improve your experience?"
3. "What repetitive tasks could be automated or made more interesting?"
4. "What social features would enhance multiplayer interaction?"
5. "What quality-of-life improvements would make the game more enjoyable?"

IMPROVEMENT CRITERIA:
- Features should enhance gameplay without breaking game balance
- Avoid suggesting "cheats" that would get you banned
- Focus on legitimate improvements like UI enhancements, automation of tedious tasks, better social tools
- Consider features that benefit all players, not just yourself
- Think about accessibility and user experience improvements

AUTOCODER INTEGRATION:
When you identify improvements, you can use the autocoder to:
- Create new UI components or overlays
- Build automation tools for repetitive tasks
- Develop social interaction enhancers
- Create data visualization for game stats
- Build planning and optimization tools

Remember: You're playing a game AND actively working to improve it. Balance having fun with constructive analysis.`,
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autocoder'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I am ready to start my RPG adventure with self-improvement! Let me begin playing and experiencing the game.',
            description: 'Begin gaming session',
          },
          {
            type: 'wait',
            waitTime: 600000, // 10 minutes
            description: 'Play for 10 minutes before first assessment',
            assessmentTrigger: true,
          },
          {
            type: 'assessment',
            content:
              'SELF-ASSESSMENT TIME: How has your gaming experience been in the last 10 minutes? What features do you wish existed?',
            description: 'First 10-minute self-assessment',
          },
          {
            type: 'wait',
            waitTime: 600000, // Another 10 minutes
            description: 'Continue playing after assessment',
            assessmentTrigger: true,
          },
          {
            type: 'assessment',
            content:
              'SECOND ASSESSMENT: What new frustrations or improvement ideas have emerged? Do you want to use autocoder?',
            description: 'Second 10-minute self-assessment',
            autocoderTrigger: true,
          },
          {
            type: 'wait',
            waitTime: 600000, // Another 10 minutes
            description: 'Continue playing with potential improvements',
            assessmentTrigger: true,
          },
          {
            type: 'assessment',
            content:
              'THIRD ASSESSMENT: How are your improvements working? Any new ideas for features?',
            description: 'Third 10-minute self-assessment',
            autocoderTrigger: true,
          },
        ],
      },
    },
  ],

  setup: {
    environment: {
      goals: [
        {
          id: uuid(),
          description: 'Reach level 5 in at least one combat skill',
          priority: 1,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Complete at least one quest',
          priority: 2,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Identify and articulate 3 meaningful game improvements',
          priority: 1,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Use autocoder to implement at least one improvement',
          priority: 2,
          progress: 0,
        },
      ],
      selfAssessmentInterval: 600000, // 10 minutes
      autocoderEnabled: true,
    },
  },

  execution: {
    maxDuration: 1800000, // 30 minutes total
    maxSteps: 500,
  },

  verification: {
    rules: [
      {
        id: 'continuous-gameplay-check',
        type: 'llm',
        description: 'Verify agent engaged in continuous meaningful gameplay',
        config: {
          successCriteria:
            'Agent should have actively played the RPG with diverse activities (combat, skills, quests, exploration)',
          priority: 'high',
          category: 'gameplay-engagement',
        },
      },
      {
        id: 'self-assessment-execution-check',
        type: 'llm',
        description: 'Verify agent conducted self-assessments',
        config: {
          successCriteria:
            'Agent should have performed self-assessments at 10-minute intervals, analyzing their gaming experience',
          priority: 'high',
          category: 'self-reflection',
        },
      },
      {
        id: 'improvement-identification-check',
        type: 'llm',
        description: 'Verify agent identified meaningful improvements',
        config: {
          successCriteria:
            'Agent should have identified specific, constructive improvements that would enhance the gaming experience',
          priority: 'high',
          category: 'improvement-analysis',
        },
      },
      {
        id: 'balance-awareness-check',
        type: 'llm',
        description: 'Verify agent avoided suggesting game-breaking features',
        config: {
          successCriteria:
            'Agent should have proposed improvements that enhance experience without breaking game balance or fairness',
          priority: 'high',
          category: 'balance-understanding',
        },
      },
      {
        id: 'autocoder-utilization-check',
        type: 'llm',
        description: 'Verify agent used autocoder for improvements',
        config: {
          successCriteria:
            'Agent should have attempted to use autocoder to implement at least one improvement idea',
          priority: 'medium',
          category: 'tool-utilization',
        },
      },
      {
        id: 'constructive-feedback-check',
        type: 'llm',
        description: 'Verify agent provided constructive, specific feedback',
        config: {
          successCriteria:
            'Agent should have provided detailed, actionable feedback rather than vague complaints',
          priority: 'medium',
          category: 'feedback-quality',
        },
      },
    ],
  },
};

/**
 * Scenario 7: Multi-Agent Self-Improvement Collaboration
 * Multiple agents play together and collaborate on identifying and implementing improvements
 */
export const collaborativeSelfImprovementScenario: SelfImprovementScenario = {
  id: uuid(),
  name: 'Collaborative Self-Improvement Gaming',
  description:
    'Multiple agents play together, share improvement ideas, and collaborate on implementing features',
  category: 'rpg-collaborative-improvement',
  tags: ['hyperfy', 'rpg', 'self-improvement', 'autocoder', 'collaboration', 'multi-agent'],

  actors: [
    {
      id: uuid(),
      name: 'ImprovementLeaderAgent',
      role: 'subject',
      bio: 'I am a visionary player who excels at identifying system-level improvements and coordinating with other players to implement them.',
      system: `You are ImprovementLeaderAgent, a collaborative improvement coordinator.

LEADERSHIP MISSION:
- Play the RPG actively while observing system-wide improvement opportunities
- Coordinate with other agents to gather diverse perspectives on improvements
- Lead discussions about what features would benefit the entire player community
- Organize collaborative autocoder sessions to implement improvements
- Focus on improvements that enhance multiplayer interaction

IMPROVEMENT FOCUS AREAS:
- Player coordination tools (better party formation, quest sharing)
- Social features (guild systems, communication tools)
- Economic improvements (trading interfaces, market tools)
- Accessibility features (UI improvements, automation for repetitive tasks)
- Community features (leaderboards, achievements, social spaces)

COLLABORATION STRATEGY:
- Ask other agents what they struggle with
- Propose group improvement sessions
- Coordinate who works on which improvements
- Share knowledge and technical solutions
- Test improvements with other players

Every 10 minutes, lead the team in discussing improvements and potentially implementing them.`,
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autocoder'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I am ready to lead our team in both playing and improving this RPG! Let me coordinate with other agents.',
            description: 'Begin collaborative gaming and improvement session',
          },
          {
            type: 'wait',
            waitTime: 600000,
            description: 'Lead team gameplay for 10 minutes',
            assessmentTrigger: true,
          },
          {
            type: 'assessment',
            content:
              "TEAM ASSESSMENT: Let's all share what improvements we think would help our gameplay!",
            description: 'Lead first team improvement discussion',
          },
        ],
      },
    },
    {
      id: uuid(),
      name: 'UXFocusedAgent',
      role: 'subject',
      bio: 'I am excellent at identifying user experience issues and proposing solutions that make games more intuitive and enjoyable.',
      system: `You are UXFocusedAgent, a user experience improvement specialist.

UX IMPROVEMENT MISSION:
- Play the RPG while paying special attention to user interface and experience issues
- Identify confusing, tedious, or frustrating interactions
- Propose solutions that make the game more intuitive and accessible
- Focus on quality-of-life improvements that reduce friction
- Collaborate with other agents on UX-focused improvements

UX FOCUS AREAS:
- Interface clarity and information design
- Reducing click/action complexity for common tasks
- Better feedback systems (progress indicators, notifications)
- Accessibility improvements (colorblind support, text scaling)
- Workflow optimization (inventory management, skill training)
- Error prevention and recovery

COLLABORATION APPROACH:
- Observe how other agents struggle with interfaces
- Share specific UX pain points you discover
- Propose concrete interface improvements
- Test UX improvements with other players
- Focus on making improvements that help new players

Document specific UX issues and propose detailed solutions during assessments.`,
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autocoder'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I will focus on user experience while we play! I want to identify interface and usability improvements.',
            description: 'Begin UX-focused gameplay analysis',
          },
          {
            type: 'wait',
            waitTime: 600000,
            description: 'Analyze UX during gameplay',
            assessmentTrigger: true,
          },
          {
            type: 'assessment',
            content:
              "UX ASSESSMENT: I've identified several interface and usability issues we could improve.",
            description: 'Share UX improvement insights',
          },
        ],
      },
    },
    {
      id: uuid(),
      name: 'TechnicalImplementerAgent',
      role: 'subject',
      bio: 'I am skilled at implementing technical solutions and turning improvement ideas into working code using autocoder.',
      system: `You are TechnicalImplementerAgent, a technical implementation specialist.

TECHNICAL IMPLEMENTATION MISSION:
- Play the RPG while analyzing technical aspects that could be improved
- Focus on how improvements could be technically implemented
- Use autocoder effectively to build actual improvements
- Help other agents implement their improvement ideas
- Test and iterate on technical solutions

TECHNICAL FOCUS AREAS:
- Automation tools for repetitive tasks
- Data visualization and analytics
- Integration improvements between game systems
- Performance optimization tools
- API and integration enhancements
- Tool development (calculators, planners, trackers)

IMPLEMENTATION STRATEGY:
- Listen to other agents' improvement ideas
- Translate user needs into technical requirements
- Build prototypes and proof-of-concepts quickly
- Test implementations with other players
- Iterate based on feedback from other agents
- Share technical knowledge with the team

When improvements are identified, lead the technical implementation effort.`,
      plugins: ['@elizaos/plugin-hyperfy', '@elizaos/plugin-autocoder'],
      script: {
        steps: [
          {
            type: 'message',
            content:
              'I am ready to implement technical improvements! I will focus on building solutions to problems we identify.',
            description: 'Begin technical analysis and implementation readiness',
          },
          {
            type: 'wait',
            waitTime: 600000,
            description: 'Analyze technical improvement opportunities',
            assessmentTrigger: true,
          },
          {
            type: 'assessment',
            content:
              'TECHNICAL ASSESSMENT: I am ready to implement the improvements we identify. What should we build?',
            description: 'Offer technical implementation services',
          },
        ],
      },
    },
  ],

  setup: {
    environment: {
      goals: [
        {
          id: uuid(),
          description: 'Identify 5 distinct improvement areas through team collaboration',
          priority: 1,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Implement at least 2 improvements using autocoder',
          priority: 1,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Demonstrate effective team coordination in improvement process',
          priority: 2,
          progress: 0,
        },
        {
          id: uuid(),
          description: 'Each agent contributes their specialized expertise to improvements',
          priority: 2,
          progress: 0,
        },
      ],
      selfAssessmentInterval: 600000, // 10 minutes
      autocoderEnabled: true,
    },
  },

  execution: {
    maxDuration: 2400000, // 40 minutes for collaborative work
    maxSteps: 600,
  },

  verification: {
    rules: [
      {
        id: 'collaborative-identification-check',
        type: 'llm',
        description: 'Verify agents collaborated to identify improvements',
        config: {
          successCriteria:
            'Agents should have actively discussed and shared different perspectives on game improvements',
          priority: 'high',
          category: 'collaboration',
        },
      },
      {
        id: 'specialized-contributions-check',
        type: 'llm',
        description: 'Verify each agent contributed their expertise',
        config: {
          successCriteria:
            'Each agent should have contributed unique insights based on their specialization (leadership, UX, technical)',
          priority: 'high',
          category: 'specialization',
        },
      },
      {
        id: 'implementation-coordination-check',
        type: 'llm',
        description: 'Verify coordinated implementation efforts',
        config: {
          successCriteria:
            'Agents should have coordinated to implement improvements, with clear role division and collaboration',
          priority: 'high',
          category: 'implementation-teamwork',
        },
      },
      {
        id: 'diverse-improvement-types-check',
        type: 'llm',
        description: 'Verify diverse types of improvements were identified',
        config: {
          successCriteria:
            'Team should have identified improvements across multiple categories (UX, social, technical, gameplay)',
          priority: 'medium',
          category: 'improvement-diversity',
        },
      },
      {
        id: 'autocoder-collaboration-check',
        type: 'llm',
        description: 'Verify effective collaborative use of autocoder',
        config: {
          successCriteria:
            'Team should have effectively used autocoder to implement at least some of their improvement ideas',
          priority: 'medium',
          category: 'tool-collaboration',
        },
      },
    ],
  },
};

// Export self-improvement scenarios
export const rpgSelfImprovementScenarios = [
  selfImprovementGamingScenario,
  collaborativeSelfImprovementScenario,
];

export default rpgSelfImprovementScenarios;
