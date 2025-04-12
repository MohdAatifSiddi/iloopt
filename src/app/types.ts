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
  summary?: string;
} 