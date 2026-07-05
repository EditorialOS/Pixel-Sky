// Editorial OS Types

export type ModuleType = 'brief' | 'deck' | 'dam' | 'variant';

export interface Module {
  id: ModuleType;
  name: string;
  description: string;
  icon: string;
  url: string;
  keywords: string[];
}

export const MODULES: Module[] = [
  {
    id: 'brief',
    name: 'Brief Engine',
    description: 'Create structured campaign briefs',
    icon: '📝',
    url: process.env.NEXT_PUBLIC_BRIEF_ENGINE_URL || 'https://brief-engine.vercel.app',
    keywords: ['brief', 'create', 'new', 'campaign', 'launch', 'objective', 'audience', 'message'],
  },
  {
    id: 'deck',
    name: 'Campaign Deck',
    description: 'Track campaign state and lifecycle',
    icon: '📊',
    url: process.env.NEXT_PUBLIC_CAMPAIGN_DECK_URL || 'https://campaign-ledger.vercel.app',
    keywords: ['deck', 'ledger', 'track', 'status', 'campaign', 'project', 'active', 'shipped'],
  },
  {
    id: 'dam',
    name: 'PixelSky',
    description: 'Search and manage digital assets',
    icon: '🖼️',
    url: process.env.NEXT_PUBLIC_LIGHT_DAM_URL || 'https://light-dam-v1.vercel.app',
    keywords: ['dam', 'asset', 'image', 'photo', 'find', 'search', 'hero', 'visual'],
  },
  {
    id: 'variant',
    name: 'Message Variant',
    description: 'Generate content variants for regions/personas',
    icon: '🔄',
    url: '', // Chrome extension - no URL
    keywords: ['variant', 'localize', 'region', 'persona', 'adapt', 'translate', 'version'],
  },
];

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  actions?: ChatAction[];
  status?: 'pending' | 'complete' | 'error';
}

export interface ChatAction {
  label: string;
  url?: string;
  module?: ModuleType;
  data?: Record<string, unknown>;
}

export interface RouteResult {
  module: ModuleType;
  confidence: number;
  intent: string;
  extractedData: Record<string, unknown>;
}

export interface ExecutionResult {
  success: boolean;
  module: ModuleType;
  message: string;
  data?: Record<string, unknown>;
  actions?: ChatAction[];
}
