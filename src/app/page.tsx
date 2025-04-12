import Image from "next/image";
import RSSFeed from './components/RSSFeed';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <RSSFeed />
    </div>
  );
}
