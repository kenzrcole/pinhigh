import { ChevronLeft, Users, Map, Building2 } from 'lucide-react';

interface StoreScreenProps {
  onBackToHome: () => void;
  onPlayers: () => void;
  onPremiumMaps: () => void;
  onOrgs: () => void;
}

export function StoreScreen({
  onBackToHome,
  onPlayers,
  onPremiumMaps,
  onOrgs,
}: StoreScreenProps) {
  return (
    <div className="h-full w-full bg-slate-900 flex flex-col">
      <header className="flex items-center justify-between p-4 border-b border-slate-800 shrink-0">
        <button
          onClick={onBackToHome}
          className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          aria-label="Back to home"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-white">Store</h1>
        <div className="w-10" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="w-full max-w-sm mx-auto space-y-4">
          <button
            onClick={onPlayers}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700 shrink-0">
              <Users className="w-6 h-6 text-slate-300" />
            </div>
            <span>Players</span>
          </button>

          <button
            onClick={onPremiumMaps}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700 shrink-0">
              <Map className="w-6 h-6 text-slate-300" />
            </div>
            <span>Premium Maps</span>
          </button>

          <button
            onClick={onOrgs}
            className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-left transition"
          >
            <div className="p-2.5 rounded-xl bg-slate-700 shrink-0">
              <Building2 className="w-6 h-6 text-slate-300" />
            </div>
            <span>Orgs & Integrations</span>
          </button>
        </div>
      </div>
    </div>
  );
}
