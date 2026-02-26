import { MessageSquare } from 'lucide-react';

interface ShotFeedProps {
  commentary: string[];
}

export function ShotFeed({ commentary }: ShotFeedProps) {
  if (commentary.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-gray-800">Shot Feed</h3>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {commentary.map((comment, idx) => (
          <div
            key={idx}
            className="text-sm text-gray-700 bg-gray-50 rounded px-3 py-2 border-l-2 border-blue-500"
          >
            {comment}
          </div>
        ))}
      </div>
    </div>
  );
}
