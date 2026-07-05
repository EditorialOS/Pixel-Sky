import { NextRequest, NextResponse } from 'next/server';
import { routeQuery, executeAction } from '@/lib/router';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    // Route the query
    const route = routeQuery(query);

    // Execute the action
    const result = await executeAction(route, query);

    return NextResponse.json({
      route,
      result,
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process query' },
      { status: 500 }
    );
  }
}
