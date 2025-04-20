'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { NewsItem } from '@/app/types';
import { use } from 'react';

export default function NewsDetail({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factCheck, setFactCheck] = useState<string | null>(null);
  const [sources, setSources] = useState<string[]>([]);
  const [isLoadingFactCheck, setIsLoadingFactCheck] = useState(false);
  const router = useRouter();
  const [summaryLength, setSummaryLength] = useState<number>(200);
  const [customSummary, setCustomSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const fetchNewsItem = async () => {
      if (!resolvedParams.id) {
        setError('News item ID is required');
        setLoading(false);
        return;
      }

      try {
        // First fetch all news items to ensure we have them
        const newsResponse = await fetch('/api/rss');
        if (!newsResponse.ok) {
          throw new Error('Failed to fetch news items');
        }
        const newsData = await newsResponse.json();

        // Decode the ID from the URL
        const decodedId = decodeURIComponent(resolvedParams.id);
        console.log('Fetching news item with ID:', decodedId);

        // Then fetch the specific news item
        const response = await fetch(`/api/rss`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            id: decodedId
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch news item');
        }

        const data = await response.json();
        if (!data.id) {
          throw new Error('News item ID not found in response');
        }
        setNewsItem(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch news');
        setNewsItem(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNewsItem();
  }, [resolvedParams.id]);

  const handleFactCheck = async () => {
    if (!newsItem?.id) {
      setError('News item ID is required for fact checking');
      return;
    }

    try {
      console.log('Fact checking news item with ID:', newsItem.id);
      const response = await fetch(`/api/rss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: newsItem.id,
          action: 'fact-check'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fact-check news');
      }

      const data = await response.json();
      setFactCheck(data.factCheck);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fact-check news');
      setFactCheck(null);
    }
  };

  const handleCustomSummary = async () => {
    if (!newsItem?.id) {
      setError('News item ID is required for summarization');
      return;
    }

    setIsSummarizing(true);
    try {
      console.log('Generating custom summary for news item with ID:', newsItem.id);
      const response = await fetch(`/api/rss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: newsItem.id,
          action: 'custom-summary',
          length: summaryLength
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate custom summary');
      }

      const data = await response.json();
      setCustomSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate custom summary');
      setCustomSummary(null);
    } finally {
      setIsSummarizing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !newsItem) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{error || 'News item not found'}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Back Button */}
        <button
          onClick={() => router.push('/')}
          className="mb-6 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <svg
            className="h-5 w-5 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Back to Home
        </button>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : newsItem ? (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {newsItem.imageUrl && (
              <div className="relative h-64 w-full">
                <img
                  src={newsItem.imageUrl}
                  alt={newsItem.title}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-500">{newsItem.source}</span>
                  <span className="text-sm text-gray-400">•</span>
                  <span className="text-sm text-gray-500">{new Date(newsItem.pubDate).toLocaleDateString()}</span>
                </div>
                <span className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-100 rounded-full">
                  {newsItem.category}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-4">{newsItem.title}</h1>
              
              {/* Full Content Section */}
              <div className="mt-6 prose prose-lg max-w-none">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">Full Article</h2>
                <div className="text-gray-900 space-y-4">
                  {newsItem.content?.split('\n').map((paragraph: string, index: number) => (
                    <p key={index} className="mb-4 text-gray-700">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>

              {/* Summary Section */}
              <div className="mt-8">
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI Summary</h2>
                <p className="text-gray-700 leading-relaxed">{newsItem.summary}</p>
              </div>

              {/* Action Buttons */}
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={handleFactCheck}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Fact Check
                </button>
                <div className="flex items-center space-x-4">
                  <input
                    type="range"
                    min="50"
                    max="500"
                    step="50"
                    value={summaryLength}
                    onChange={(e) => setSummaryLength(Number(e.target.value))}
                    className="w-48"
                  />
                  <button
                    onClick={handleCustomSummary}
                    disabled={isSummarizing}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {isSummarizing ? 'Generating...' : 'Generate Custom Summary'}
                  </button>
                </div>
              </div>

              {/* Fact Check Result */}
              {factCheck && (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Fact Check Report</h3>
                  <div className="text-gray-700 whitespace-pre-line">{factCheck}</div>
                </div>
              )}

              {/* Custom Summary Result */}
              {customSummary && (
                <div className="mt-8 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Custom Summary</h3>
                  <p className="text-gray-700">{customSummary}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
} 