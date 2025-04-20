import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

const API_KEY = "5lxZhUTNPPZGZZOOdvpwQyrjkKWwhFHjlWnw0F3htkGhAlKN2F38JQQJ99BDACHYHv6XJ3w3AAAAACOG9zzz";
const API_URL = "https://mekot-m9pcilcz-eastus2.openai.azure.com";
const MODEL_NAME = "o4-mini";

// Define custom types for RSS feed items
type CustomFeed = {
  title: string;
  description: string;
  link: string;
  items: CustomItem[];
};

type CustomItem = {
  title: string;
  link: string;
  pubDate: string;
  content: string;
  description: string;
  'media:content'?: Array<{ $: { url: string } }>;
  'media:thumbnail'?: Array<{ $: { url: string } }>;
  enclosure?: { url: string };
  'media:group'?: Array<{
    'media:content': Array<{ $: { url: string; type: string } }>;
  }>;
};

const RSS_FEEDS = [
  {
    name: 'BBC News',
    url: 'http://feeds.bbci.co.uk/news/rss.xml',
    category: 'world'
  },
  {
    name: 'The Guardian',
    url: 'https://www.theguardian.com/world/rss',
    category: 'world'
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    category: 'technology'
  },
  {
    name: 'Wired',
    url: 'https://www.wired.com/feed/rss',
    category: 'technology'
  },
  {
    name: 'Business Insider',
    url: 'https://markets.businessinsider.com/rss/news',
    category: 'business'
  },
  {
    name: 'ESPN',
    url: 'https://www.espn.com/espn/rss/news',
    category: 'sports'
  }
];

interface NewsItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
  imageUrl?: string;
  fullContent?: string;
}

// Store news items in memory with a timestamp
let newsItems: NewsItem[] = [];
let lastFetchTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function summarizeContent(content: string, length: number = 200): Promise<string> {
  const maxRetries = 3;
  const timeout = 60000; // Increased to 60 seconds timeout

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to summarize content (attempt ${attempt}/${maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${API_URL}/openai/deployments/${MODEL_NAME}/chat/completions?api-version=2024-12-01-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': API_KEY
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant that summarizes news articles. Generate a summary that is approximately ${length} words long.`
            },
            {
              role: "user",
              content: `Please summarize this news article in about ${length} words: ${content}`
            }
          ],
          max_completion_tokens: Math.min(length * 2, 1000)
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (status ${response.status}):`, errorText);
        throw new Error(`OpenAI API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error(`Error summarizing content (attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Max retries reached');
}

async function factCheckContent(title: string, content: string): Promise<string> {
  const maxRetries = 3;
  const timeout = 60000; // Increased to 60 seconds timeout

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempting to fact-check content (attempt ${attempt}/${maxRetries})`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${API_URL}/openai/deployments/${MODEL_NAME}/chat/completions?api-version=2024-12-01-preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': API_KEY
        },
        body: JSON.stringify({
          messages: [
            {
              role: "system",
              content: "You are a fact-checking assistant. Analyze the news article and provide a fact-check report. Include:\n1. Key claims in the article\n2. Verification status of each claim\n3. Supporting evidence or sources\n4. Any potential biases or limitations\n5. Overall credibility assessment"
            },
            {
              role: "user",
              content: `Please fact-check this news article:\nTitle: ${title}\nContent: ${content}`
            }
          ],
          max_completion_tokens: 1000
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`OpenAI API error (status ${response.status}):`, errorText);
        throw new Error(`OpenAI API returned status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error(`Error fact-checking content (attempt ${attempt}):`, error);
      if (attempt === maxRetries) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Max retries reached');
}

function extractImageFromContent(content: string | undefined): string | undefined {
  if (!content) return undefined;
  
  try {
    // Try to find image URL in content
    const imgRegex = /<img[^>]+src="([^">]+)"/;
    const match = content.match(imgRegex);
    if (match) return match[1];

    // Try to find image URL in enclosure
    const enclosureRegex = /<enclosure[^>]+url="([^">]+)"/;
    const enclosureMatch = content.match(enclosureRegex);
    if (enclosureMatch) return enclosureMatch[1];

    return undefined;
  } catch (error) {
    console.error('Error extracting image from content:', error);
    return undefined;
  }
}

async function fetchNewsFromFeed(feed: typeof RSS_FEEDS[0]): Promise<NewsItem[]> {
  try {
    const parser = new Parser<CustomFeed, CustomItem>({
      customFields: {
        item: ['media:content', 'media:thumbnail', 'enclosure', 'media:group']
      }
    });

    const feedData = await parser.parseURL(feed.url);
    
    return feedData.items.map(item => {
      // Extract image URL from various possible sources
      const imageUrl = 
        // Try media:content first
        item['media:content']?.[0]?.$?.url || 
        // Try media:thumbnail
        item['media:thumbnail']?.[0]?.$?.url || 
        // Try enclosure
        item.enclosure?.url ||
        // Try media:group
        item['media:group']?.[0]?.['media:content']?.find(media => media.$.type.startsWith('image/'))?.$.url ||
        // Try to extract from content
        extractImageFromContent(item.content || item.description);

      return {
        id: encodeURIComponent(item.title || ''),
        title: item.title || '',
        link: item.link || '',
        description: item.content || item.description || '',
        pubDate: item.pubDate || new Date().toISOString(),
        source: feed.name,
        category: feed.category,
        imageUrl,
        fullContent: item.content || item.description || ''
      };
    });
  } catch (error) {
    console.error(`Error fetching feed "${feed.name}":`, error);
    return [];
  }
}

async function fetchAndCacheNewsItems(): Promise<NewsItem[]> {
  const now = Date.now();
  
  // If we have cached items and they're not expired, return them
  if (newsItems.length > 0 && (now - lastFetchTime) < CACHE_DURATION) {
    return newsItems;
  }

  // Fetch news from all feeds in parallel
  const allNewsPromises = RSS_FEEDS.map(feed => fetchNewsFromFeed(feed));
  const allNewsResults = await Promise.all(allNewsPromises);
  
  // Flatten and sort by date
  newsItems = allNewsResults
    .flat()
    .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
    .slice(0, 20); // Get top 20 most recent news

  lastFetchTime = now;
  return newsItems;
}

export async function GET() {
  try {
    const items = await fetchAndCacheNewsItems();

    if (items.length === 0) {
      throw new Error('No news items found from any source');
    }

    return NextResponse.json(items);
  } catch (error) {
    console.error('Error in news processing:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process news',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, action, length } = body;
    
    console.log('POST request received:', { id, action, length });
    
    if (id === undefined || id === null || id === '') {
      console.error('Invalid ID provided in request body:', id);
      return NextResponse.json(
        { error: 'News item ID is required and cannot be empty' },
        { status: 400 }
      );
    }

    // Fetch or get cached news items
    const items = await fetchAndCacheNewsItems();
    
    // Log available IDs for debugging
    console.log('Available news item IDs:', items.map(item => item.id));
    
    // Find the news item - handle both encoded and unencoded IDs
    const newsItem = items.find(item => 
      item.id === id || // Try direct match
      item.id === encodeURIComponent(id) || // Try encoding the provided ID
      decodeURIComponent(item.id) === id // Try decoding the stored ID
    );

    if (!newsItem) {
      console.error('News item not found:', {
        providedId: id,
        encodedId: encodeURIComponent(id),
        availableIds: items.map(item => item.id)
      });
      return NextResponse.json(
        { error: 'News item not found' },
        { status: 404 }
      );
    }

    if (action === 'fact-check') {
      try {
        // Generate fact-check report
        const factCheck = await factCheckContent(newsItem.title, newsItem.fullContent || newsItem.description);
        
        return NextResponse.json({
          id: newsItem.id, // Include the ID in the response
          title: newsItem.title,
          factCheck,
          source: newsItem.source,
          category: newsItem.category,
          pubDate: newsItem.pubDate
        });
      } catch (error) {
        console.error('Error in fact-checking:', error);
        return NextResponse.json(
          { error: 'Failed to generate fact-check report' },
          { status: 500 }
        );
      }
    } else if (action === 'custom-summary') {
      try {
        // Generate custom length summary
        const summary = await summarizeContent(
          newsItem.fullContent || newsItem.description,
          length || 200
        );
        
        return NextResponse.json({
          id: newsItem.id, // Include the ID in the response
          title: newsItem.title,
          summary,
          source: newsItem.source,
          category: newsItem.category,
          pubDate: newsItem.pubDate
        });
      } catch (error) {
        console.error('Error in summarization:', error);
        return NextResponse.json(
          { error: 'Failed to generate summary' },
          { status: 500 }
        );
      }
    } else {
      // Default: Generate standard summary
      try {
        const summary = await summarizeContent(newsItem.fullContent || newsItem.description);
        
        return NextResponse.json({
          id: newsItem.id, // Include the ID in the response
          title: newsItem.title,
          content: newsItem.fullContent || newsItem.description,
          summary,
          imageUrl: newsItem.imageUrl,
          source: newsItem.source,
          category: newsItem.category,
          pubDate: newsItem.pubDate
        });
      } catch (error) {
        console.error('Error in default summarization:', error);
        return NextResponse.json(
          { error: 'Failed to generate default summary' },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('Error in news item processing:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process news item',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 