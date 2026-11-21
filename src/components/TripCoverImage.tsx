import { useState } from 'react';
import { Mountain } from 'lucide-react';

interface TripCoverImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

export function TripCoverImage({ src, alt, className = '' }: TripCoverImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`bg-gradient-to-br from-slate-800 via-slate-700 to-teal-900 flex flex-col items-center justify-center text-slate-200 p-4 ${className}`}
      >
        <Mountain className="w-8 h-8 opacity-75 mb-1.5" />
        <span className="text-xs font-medium text-center opacity-80 line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
