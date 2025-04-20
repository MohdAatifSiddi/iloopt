import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { query } = await request.json();

    // First, search using Searxng with JSON format
    const searxngResponse = await fetch(`${process.env.SEARXNG_URL}/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        format: 'json',
        engines: ['news'],
        categories: ['news'],
      }),
    });

    if (!searxngResponse.ok) {
      throw new Error('Failed to fetch from Searxng');
    }

    const searxngData = await searxngResponse.json();

    // Then, send the query and search results to Azure OpenAI
    const llmResponse = await fetch(`${process.env.LLM_API_URL}?api-version=${process.env.LLM_API_VERSION}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.LLM_API_KEY || '',
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions about news. Use the provided search results to inform your response. Be concise and accurate.',
          },
          {
            role: 'user',
            content: `Question: ${query}\n\nSearch Results: ${JSON.stringify(searxngData.results)}`,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.95,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!llmResponse.ok) {
      throw new Error('Failed to get response from LLM');
    }

    const llmData = await llmResponse.json();

    return NextResponse.json({ 
      response: llmData.choices[0].message.content,
      searchResults: searxngData.results 
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to process your request' },
      { status: 500 }
    );
  }
} 