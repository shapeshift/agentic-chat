import { AgentRuntime, ModelProviderName } from '@elizaos/core';

export class ElizaService {
  private static instance: ElizaService;
  private eliza: AgentRuntime | null = null;

  private constructor() {
    // Initialize Eliza only when needed
  }

  public static getInstance(): ElizaService {
    if (!ElizaService.instance) {
      ElizaService.instance = new ElizaService();
    }
    return ElizaService.instance;
  }

  public async initialize() {
    if (!this.eliza) {
      try {
        this.eliza = new AgentRuntime({
          agentId: '123e4567-e89b-12d3-a456-426614174000' as const,
          serverUrl: 'http://localhost:3000',
          token: '',
          modelProvider: ModelProviderName.VENICE,
          character: {
            name: 'Eliza',
            bio: 'A Rogerian psychotherapist',
            modelProvider: ModelProviderName.OPENAI,
            plugins: [],
            lore: [],
            messageExamples: [],
            postExamples: [],
            topics: [],
            adjectives: [],
            style: {
              all: [],
              chat: [],
              post: []
            }
          }
        });

        // Initialize Eliza
        await this.eliza.initialize();
      } catch (error) {
        console.error('Failed to initialize Eliza:', error);
        throw error;
      }
    }
  }

  public async chat(message: string): Promise<string> {
    if (!this.eliza) {
      throw new Error('Eliza not initialized');
    }
    try {
      // Create a message object with the required structure
    //   const response = await this.eliza.processMessage({
    //     text: message,
    //     source: 'user'
    //   });
    //   return response.text;
    return 'test';
    } catch (error) {
      console.error('Error in chat:', error);
      throw error;
    }
  }

  public async shutdown() {
    if (this.eliza) {
      try {
        // Clean up resources
        await this.eliza.stop();
        this.eliza = null;
      } catch (error) {
        console.error('Error shutting down Eliza:', error);
        throw error;
      }
    }
  }
} 
