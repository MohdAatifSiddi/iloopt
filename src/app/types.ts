export interface NewsItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  image?: string;
  source: string;
  summary?: string;
  content?: string;
}

export interface FeedItem extends NewsItem {
  id: string;
}

export interface ErrorResponse {
  error: string;
  details?: string;
}

export interface FactCheckResponse {
  content: string;
  sources: string[];
} 