import React, { useState } from 'react';
import { useStock } from '../../context/StockContext';
import { InventorySession } from '../../types';
import { formatDate } from '../../utils/formatters';
import {
  ClipboardCheck,
  Plus,
  Building2,
  Calendar,
  User,
  ArrowRight,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { InventorySessionView } from './InventorySessionView';

interface InventoryListViewProps {
  onSuccess: (message: string) => void;
}

export const InventoryListView: React.FC<InventoryListViewProps> = ({ onSuccess }) => {
  const {
    inventories,
    warehouses,
    selectedWarehouseId,
    getWarehouseById,
    createInventorySession,
    currentUser,
  } = useStock();

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedWarehouseForNew, setSelectedWarehouseForNew] = useState<string>(
    selectedWarehouseId || warehouses[0]?.id || ''
  );
  const [sessionNotes, setSessionNotes] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const activeSession = inventories.find((s) => s.id === activeSessionId);

  const handleStartNewSession = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const result = createInventorySession(selectedWarehouseForNew, sessionNotes);
    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de la création de la session.');
    } else if (result.session) {
      setIsCreatingNew(false);
      setSessionNotes('');
      setActiveSessionId(result.session.id);
      onSuccess(`Session d'inventaire ${result.session.code} créée avec succès.`);
    }
  };

  if (activeSession) {
    return (
      <InventorySessionView
        session={activeSession}
        onBack={() => setActiveSessionId(null)}
        onSuccess={onSuccess}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Action */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-amber-500" />
            Sessions d'Inventaire Physique
          </h2>
          <p className="text-xs text-slate-500">
            Comptage périodique contradictoire, calcul immédiat des écarts et régularisation traçable
          </p>
        </div>

        {currentUser.role !== 'MAGASINIER' && (
          <button
            onClick={() => setIsCreatingNew(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Nouvel inventaire magasin
          </button>
        )}
      </div>

      {/* New Session Creation Modal */}
      {isCreatingNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-base font-bold text-slate-900">
              Ouvrir une nouvelle session d'inventaire
            </h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Sélectionnez l'entrepôt concerné. Les stocks théoriques actuels seront gelés pour comparaison.
            </p>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs mb-4">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleStartNewSession} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Magasin à inventorier *
                </label>
                <select
                  value={selectedWarehouseForNew}
                  onChange={(e) => setSelectedWarehouseForNew(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Motif / Contexte de l'inventaire
                </label>
                <input
                  type="text"
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value)}
                  placeholder="Ex: Clôture mensuelle, contrôle inopiné, audit..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs"
                >
                  Démarrer le comptage
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sessions List */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-900">
            Historique des sessions d'inventaire ({inventories.length})
          </h3>
        </div>

        <div className="divide-y divide-slate-100">
          {inventories.map((session) => {
            const wh = getWarehouseById(session.warehouseId);
            const isValidated = session.status === 'VALIDATED';
            const isCounting = session.status === 'COUNTING';
            const isCancelled = session.status === 'CANCELLED';

            const countedCount = session.items.filter((i) => i.countedQty !== null).length;
            const varianceCount = session.items.filter((i) => i.countedQty !== null && i.variance !== 0).length;

            return (
              <div
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      {session.code}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        isValidated
                          ? 'bg-emerald-100 text-emerald-800'
                          : isCounting
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isValidated
                        ? 'Validé & Verrouillé'
                        : isCounting
                        ? 'Comptage en cours'
                        : 'Annulé'}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-900 mt-1">
                    {wh?.name} ({wh?.code})
                  </h4>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1.5">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {formatDate(session.date)}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Superviseur : {session.supervisor}
                    </span>
                    {session.notes && (
                      <>
                        <span>·</span>
                        <span className="italic">{session.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right text-xs">
                    <div className="font-medium text-slate-700">
                      Progression :{' '}
                      <span className="font-mono font-bold">
                        {countedCount} / {session.items.length}
                      </span>
                    </div>
                    {varianceCount > 0 && (
                      <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                        {varianceCount} écart(s) détecté(s)
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => setActiveSessionId(session.id)}
                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg transition-colors"
                    title="Ouvrir la session"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
