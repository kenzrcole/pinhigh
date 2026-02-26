import { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { StoreItem } from '../data/storeCategories';

interface StoreCategoryScreenProps {
  title: string;
  items: StoreItem[];
  onBack: () => void;
}

function LogoCell({ item }: { item: StoreItem }) {
  const [imgError, setImgError] = useState(false);
  const showImg = item.logoUrl && !imgError;
  const initial = item.name.charAt(0).toUpperCase();

  return (
    <div className="relative w-full aspect-square rounded-2xl bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center">
      {showImg ? (
        <img
          src={item.logoUrl}
          alt=""
          className="w-full h-full object-contain p-3"
          onError={() => setImgError(true)}
        />
      ) : (
        <span className="text-3xl font-bold text-slate-500">{initial}</span>
      )}
      <div
        className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-[2px]"
        aria-hidden
      >
        <span className="text-xs font-semibold text-white bg-slate-700/90 px-3 py-1.5 rounded-full">
          Coming soon
        </span>
      </div>
    </div>
  );
}

export function StoreCategoryScreen({
  title,
  items,
  onBack,
}: StoreCategoryScreenProps) {
  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to store"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-md mx-auto">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col items-center gap-2">
              <LogoCell item={item} />
              <span className="text-xs font-medium text-slate-300 text-center line-clamp-2">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
