export interface NewsItem {
  id: string;
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  category: string;
  imageUrl?: string;
  fullContent?: string;
  content?: string;
  summary?: string;
  factCheck?: string;
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