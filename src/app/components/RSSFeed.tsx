'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface FeedItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
  imageUrl?: string;
}

interface ErrorResponse {
  error: string;
  details?: string;
}

interface FactCheckResponse {
  factCheck: string;
  sources?: string[];
}

export default function RSSFeed() {
  const [news, setNews] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ErrorResponse | null>(null);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [factCheck, setFactCheck] = useState<string | null>(null);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [searchingRelatedNews, setSearchingRelatedNews] = useState(false);
  const [sources, setSources] = useState<string[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchRSS();
  }, []);

  const fetchRSS = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/rss');
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to fetch news feed');
      }
      
      const data = await response.json();
      setNews(data);
    } catch (err) {
      setError({
        error: 'Failed to fetch news feed',
        details: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNewsClick = (item: FeedItem) => {
    setSelectedItem(item);
    setFactCheck(null);
    router.push(`/news/${item.id}`);
  };

  const handleFactCheck = async (item: FeedItem) => {
    try {
      setIsFactChecking(true);
      setSearchingRelatedNews(true);
      setError(null);
      setSources([]);
      
      const response = await fetch('/api/rss', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: item.id,
          action: 'fact-check'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || 'Failed to fact-check news item');
      }

      const data: FactCheckResponse = await response.json();
      setFactCheck(data.factCheck);
      if (data.sources) {
        setSources(data.sources);
      }
    } catch (err) {
      setError({
        error: 'Failed to fact-check news item',
        details: err instanceof Error ? err.message : 'Unknown error occurred'
      });
    } finally {
      setIsFactChecking(false);
      setSearchingRelatedNews(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-blue-900 via-black to-green-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-400"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-4 bg-gradient-to-br from-blue-900 via-black to-green-900">
        <div className="bg-red-100/10 backdrop-blur-sm border border-red-400 text-red-200 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error.error}</span>
          {error.details && (
            <p className="mt-2 text-sm text-red-300">{error.details}</p>
          )}
          <button
            onClick={fetchRSS}
            className="mt-4 bg-red-500/80 hover:bg-red-700/80 text-white font-bold py-2 px-4 rounded transition-all duration-300"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-900 via-black to-green-900">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {news.map((item) => (
          <div
            key={item.id}
            className="bg-white/10 backdrop-blur-sm rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border border-white/20 hover:border-blue-400/50"
            onClick={() => handleNewsClick(item)}
          >
            {item.imageUrl && (
              <div className="relative h-48 w-full">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-blue-500/20 text-blue-200 text-xs font-medium px-2.5 py-0.5 rounded">
                  {item.category}
                </span>
                <span className="bg-green-500/20 text-green-200 text-xs font-medium px-2.5 py-0.5 rounded">
                  {item.source}
                </span>
              </div>
              <h2 className="text-xl font-semibold mb-2 line-clamp-2 text-white">{item.title}</h2>
              <p className="text-gray-300 text-sm mb-4 line-clamp-3">{item.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">
                  {new Date(item.pubDate).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFactCheck(item);
                  }}
                  className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white text-sm font-medium px-3 py-1 rounded transition-all duration-300"
                  disabled={isFactChecking}
                >
                  {isFactChecking ? 'Checking...' : 'Fact Check'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {searchingRelatedNews && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-r from-blue-900/90 to-green-900/90 rounded-lg shadow-xl p-6 border border-white/20">
            <div className="flex items-center gap-4">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-400"></div>
              <p className="text-lg font-medium text-white">Searching for related news and facts...</p>
            </div>
          </div>
        </div>
      )}

      {factCheck && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-gradient-to-r from-blue-900/90 to-green-900/90 rounded-lg shadow-xl max-w-2xl w-full p-6 overflow-y-auto max-h-[80vh] border border-white/20">
            <h3 className="text-xl font-bold mb-4 text-white">Fact Check Report</h3>
            {sources.length > 0 && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold text-blue-200 mb-2">Sources Used:</h4>
                <div className="flex flex-wrap gap-2">
                  {sources.map((source, index) => (
                    <span key={index} className="bg-blue-500/20 text-blue-200 text-xs px-2 py-1 rounded">
                      {source}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="prose max-w-none text-gray-200">
              {factCheck.split('\n').map((paragraph, index) => (
                <p key={index} className="mb-4">{paragraph}</p>
              ))}
            </div>
            <button
              onClick={() => {
                setFactCheck(null);
                setSources([]);
              }}
              className="mt-4 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-bold py-2 px-4 rounded transition-all duration-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 