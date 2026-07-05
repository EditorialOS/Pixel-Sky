import { MODULES, ModuleType, RouteResult, ExecutionResult, ChatAction } from './types';

// Request timeout in milliseconds
const FETCH_TIMEOUT = 5000;

// Simple keyword-based routing (can be replaced with Claude API later)
export function routeQuery(query: string): RouteResult {
  const lowerQuery = query.toLowerCase();
  
  // Score each module based on keyword matches
  const scores = MODULES.map(module => {
    const matchCount = module.keywords.filter(keyword => 
      lowerQuery.includes(keyword)
    ).length;
    return { module: module.id, score: matchCount };
  });

  // Find highest scoring module
  const best = scores.reduce((a, b) => a.score > b.score ? a : b);
  
  // Determine intent based on keywords
  let intent = 'query';
  if (lowerQuery.includes('create') || lowerQuery.includes('new') || lowerQuery.includes('make')) {
    intent = 'create';
  } else if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('show')) {
    intent = 'search';
  } else if (lowerQuery.includes('status') || lowerQuery.includes('check') || lowerQuery.includes('track')) {
    intent = 'status';
  }

  // Extract data from query
  const extractedData = extractDataFromQuery(query);

  return {
    module: best.module,
    confidence: best.score > 0 ? Math.min(best.score / 3, 1) : 0.3, // Normalize confidence
    intent,
    extractedData,
  };
}

// Extract structured data from natural language
function extractDataFromQuery(query: string): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  
  // Extract project name (after "for" or "called") - improved regex to capture meaningful chunks
  // Captures up to 5 words, stops at punctuation or common stop words
  const forMatch = query.match(/(?:for|called|named)\s+["']?([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,4})["']?/i);
  if (forMatch) {
    // Clean up the match - remove trailing words like "targeting", "for", "on", etc.
    let projectName = forMatch[1].trim();
    projectName = projectName.replace(/\s+(targeting|for|on|using|with|via|to|and|the).*$/i, '');
    data.project_name = projectName;
  }

  // Extract channels
  const channelKeywords = ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin', 'email', 'facebook'];
  const foundChannels = channelKeywords.filter(ch => query.toLowerCase().includes(ch));
  if (foundChannels.length > 0) {
    data.channels = foundChannels;
  }

  // Extract audience hints - more specific pattern
  const audienceMatch = query.match(/(?:targeting|audience[:\s]+)\s*["']?([^"',\.]{3,30})["']?/i);
  if (audienceMatch) {
    data.audience_hint = audienceMatch[1].trim();
  }

  // Extract objective hints - more specific pattern
  const objectiveMatch = query.match(/(?:goal|objective)[:\s]+\s*["']?([^"',\.]{3,50})["']?/i);
  if (objectiveMatch) {
    data.objective_hint = objectiveMatch[1].trim();
  }

  return data;
}

// Helper function to create fetch with timeout
async function fetchWithTimeout(
  url: string, 
  options: RequestInit = {},
  timeout: number = FETCH_TIMEOUT
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Execute action against the appropriate module
export async function executeAction(
  route: RouteResult,
  query: string
): Promise<ExecutionResult> {
  const module = MODULES.find(m => m.id === route.module);
  if (!module) {
    return {
      success: false,
      module: route.module,
      message: 'Module not found',
    };
  }

  try {
    switch (route.module) {
      case 'brief':
        return await executeBriefAction(route, query, module.url);
      case 'deck':
        return await executeDeckAction(route, query, module.url);
      case 'dam':
        return await executeDamAction(route, query, module.url);
      default:
        return {
          success: true,
          module: route.module,
          message: `I understood you want to use ${module.name}, but that module isn't connected yet.`,
          actions: module.url ? [{ label: `Open ${module.name}`, url: module.url }] : [],
        };
    }
  } catch (error) {
    console.error(`[${route.module}] Execution error:`, error);
    
    // Provide more specific error messages
    const errorMessage = error instanceof Error 
      ? (error.name === 'AbortError' 
          ? `Connection to ${module.name} timed out. The service may be unavailable.`
          : `Failed to connect to ${module.name}: ${error.message}`)
      : `Failed to connect to ${module.name}. Please try again.`;
    
    return {
      success: false,
      module: route.module,
      message: errorMessage,
      actions: module.url ? [{ label: `Open ${module.name}`, url: module.url }] : [],
    };
  }
}

// Brief Engine actions
async function executeBriefAction(
  route: RouteResult,
  query: string,
  baseUrl: string
): Promise<ExecutionResult> {
  if (route.intent === 'create') {
    // Create a new brief
    const briefData = {
      project_name: route.extractedData.project_name || extractProjectName(query),
      objective_primary: route.extractedData.objective_hint || 'Define objective',
      audience_primary: route.extractedData.audience_hint || 'Define audience',
      key_message: 'Define key message',
      channels: route.extractedData.channels || [],
      owner_name: 'Editorial OS User',
      owner_email: 'user@editorialos.com',
      send_to_deck: true,
    };

    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/brief/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefData),
      });

      if (response.ok) {
        const result = await response.json();
        const actions: ChatAction[] = [
          { label: 'View Brief', url: `${baseUrl}`, module: 'brief' },
        ];
        
        if (result.ledger_id) {
          const deckUrl = process.env.NEXT_PUBLIC_CAMPAIGN_DECK_URL || 'https://campaign-ledger.vercel.app';
          actions.push({ 
            label: 'View in Campaign Deck', 
            url: `${deckUrl}/ledger/${result.ledger_id}`,
            module: 'deck',
          });
        }

        return {
          success: true,
          module: 'brief',
          message: `✓ Brief created: "${briefData.project_name}"\n${result.ledger_id ? '✓ Added to Campaign Deck (status: intake)' : ''}\n\nBrief ID: ${result.brief.brief_id}${result.ledger_id ? `\nLedger ID: ${result.ledger_id}` : ''}`,
          data: result,
          actions,
        };
      } else {
        let errorMessage = 'Unknown error';
        try {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}`;
        }
        return {
          success: false,
          module: 'brief',
          message: `Failed to create brief: ${errorMessage}`,
          actions: [{ label: 'Open Brief Engine', url: baseUrl }],
        };
      }
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError'
        ? 'Brief Engine request timed out. Please try again.'
        : 'Could not connect to Brief Engine. Make sure it\'s deployed.';
      
      return {
        success: false,
        module: 'brief',
        message,
        actions: [{ label: 'Open Brief Engine', url: baseUrl }],
      };
    }
  }

  // Default: open Brief Engine
  return {
    success: true,
    module: 'brief',
    message: 'Opening Brief Engine for you.',
    actions: [{ label: 'Open Brief Engine', url: baseUrl }],
  };
}

// Campaign Deck actions
async function executeDeckAction(
  route: RouteResult,
  query: string,
  baseUrl: string
): Promise<ExecutionResult> {
  if (route.intent === 'search' || route.intent === 'status') {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/ledger`);
      
      if (response.ok) {
        const ledgers = await response.json();
        
        // Filter if there's a project name
        let filtered = ledgers;
        if (route.extractedData.project_name) {
          const searchTerm = (route.extractedData.project_name as string).toLowerCase();
          filtered = ledgers.filter((l: { project_name: string }) => 
            l.project_name.toLowerCase().includes(searchTerm)
          );
        }

        if (filtered.length === 0) {
          return {
            success: true,
            module: 'deck',
            message: 'No campaigns found matching your query.',
            actions: [{ label: 'Open Campaign Deck', url: baseUrl }],
          };
        }

        const summary = filtered.slice(0, 5).map((l: { project_name: string; status: string }) => 
          `• ${l.project_name} (${l.status})`
        ).join('\n');

        return {
          success: true,
          module: 'deck',
          message: `Found ${filtered.length} campaign(s):\n\n${summary}`,
          data: { campaigns: filtered },
          actions: [
            { label: 'Open Campaign Deck', url: baseUrl },
            ...(filtered.length === 1 ? [{ 
              label: `View "${filtered[0].project_name}"`, 
              url: `${baseUrl}/ledger/${filtered[0].ledger_id}` 
            }] : []),
          ],
        };
      }
    } catch (error) {
      // Log but continue to default behavior
      console.error('[deck] Fetch error:', error);
    }
  }

  return {
    success: true,
    module: 'deck',
    message: 'Opening Campaign Deck.',
    actions: [{ label: 'Open Campaign Deck', url: baseUrl }],
  };
}

// PixelSky actions
async function executeDamAction(
  route: RouteResult,
  query: string,
  baseUrl: string
): Promise<ExecutionResult> {
  // DAM is primarily a search interface
  return {
    success: true,
    module: 'dam',
    message: `I'll help you find assets. Opening PixelSky with your search.`,
    actions: [{ label: 'Search in DAM', url: baseUrl }],
  };
}

// Helper to extract project name from query
function extractProjectName(query: string): string {
  // Try to find a meaningful name - improved patterns
  const patterns = [
    /(?:for|called|named)\s+["']?([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,3})["']?/i,
    /(?:brief|campaign|project)\s+(?:for\s+)?["']?([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+){0,3})["']?/i,
    /["']([^"']{3,30})["']/,
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1].length > 2) {
      // Clean up common trailing words
      let name = match[1].trim();
      name = name.replace(/\s+(targeting|for|on|using|with).*$/i, '');
      if (name.length > 2) {
        return name;
      }
    }
  }

  // Default name with timestamp
  return `Campaign ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}
