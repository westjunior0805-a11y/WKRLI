import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { InventorySession } from '../../types';
import { formatFCFA, formatDate, exportToCSV } from '../../utils/formatters';
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Download,
  ShieldCheck,
  Building2,
  Calendar,
  Lock,
} from 'lucide-react';
import { ConfirmModal } from '../common/ConfirmModal';

interface InventorySessionViewProps {
  session: InventorySession;
  onBack: () => void;
  onSuccess: (message: string) => void;
}

export const InventorySessionView: React.FC<InventorySessionViewProps> = ({
  session,
  onBack,
  onSuccess,
}) => {
  const {
    getWarehouseById,
    getArticleById,
    updateInventoryCount,
    validateInventorySession,
    cancelInventorySession,
    currentUser,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterVarianceOnly, setFilterVarianceOnly] = useState(false);
  const [isConfirmValidateOpen, setIsConfirmValidateOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const warehouse = getWarehouseById(session.warehouseId);
  const isValidated = session.status === 'VALIDATED';

  // Compute live totals for this session
  const totalCountedArticles = session.items.filter((i) => i.countedQty !== null).length;
  const totalArticles = session.items.length;
  const progressPercent = Math.round((totalCountedArticles / totalArticles) * 100);

  const totalVarianceQty = session.items.reduce((sum, item) => sum + (item.variance || 0), 0);
  const totalVarianceValue = session.items.reduce((sum, item) => sum + (item.varianceValue || 0), 0);
  const varianceCount = session.items.filter((i) => i.countedQty !== null && i.variance !== 0).length;

  // Filtered items
  const filteredItems = useMemo(() => {
    return session.items.filter((item) => {
      const art = getArticleById(item.articleId);
      if (!art) return false;

      if (filterVarianceOnly && (item.countedQty === null || item.variance === 0)) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchRef = art.mainReference.toLowerCase().includes(q);
        const matchDesig = art.designation.toLowerCase().includes(q);
        const matchBrand = art.brand.toLowerCase().includes(q);
        const matchLoc = art.defaultLocation.toLowerCase().includes(q);
        if (!matchRef && !matchDesig && !matchBrand && !matchLoc) return false;
      }

      return true;
    });
  }, [session.items, filterVarianceOnly, searchQuery, getArticleById]);

  const handleCountChange = (articleId: string, valStr: string) => {
    if (isValidated) return;
    if (valStr.trim() === '') {
      updateInventoryCount(session.id, articleId, null);
    } else {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        updateInventoryCount(session.id, articleId, parsed);
      }
    }
  };

  const handleNotesChange = (articleId: string, notes: string) => {
    if (isValidated) return;
    const item = session.items.find((i) => i.articleId === articleId);
    if (item) {
      updateInventoryCount(session.id, articleId, item.countedQty, notes);
    }
  };

  const handleValidateSession = () => {
    setErrorMessage('');
    const result = validateInventorySession(session.id);
    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de la validation.');
      setIsConfirmValidateOpen(false);
    } else {
      setIsConfirmValidateOpen(false);
      onSuccess(`Session d'inventaire ${session.code} validée. Écritures d'ajustement générées avec succès.`);
    }
  };

  const handleCancelSession = () => {
    cancelInventorySession(session.id);
    setIsConfirmCancelOpen(false);
    onBack();
  };

  const handleExportCSV = () => {
    const headers = [
      'Code Session',
      'Magasin',
      'Réf Constructeur',
      'Désignation',
      'Stock Théorique',
      'Stock Compté',
      'Écart (Compté - Théorique)',
      'Coût Unitaire (FCFA)',
      'Valorisation Écart (FCFA)',
      'Justification / Notes',
    ];

    const rows = session.items.map((it) => {
      const art = getArticleById(it.articleId);
      return [
        session.code,
        warehouse?.name || '',
        art?.mainReference || '',
        art?.designation || '',
        it.theoreticalQty,
        it.countedQty !== null ? it.countedQty : 'Non compté',
        it.variance,
        it.unitCost,
        it.varianceValue,
        it.notes || '',
      ];
    });

    exportToCSV(`inventaire_${session.code}`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Session Top Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              title="Retour aux sessions d'inventaire"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {session.code}
                </span>
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                    isValidated
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {isValidated ? 'Validé & Verrouillé' : 'Comptage en cours'}
                </span>
              </div>
              <h2 className="text-base font-bold text-slate-900 mt-1">
                {warehouse?.name} ({warehouse?.code})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exporter PV
            </button>

            {!isValidated && (
              <>
                <button
                  onClick={() => setIsConfirmCancelOpen(true)}
                  className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                >
                  Annuler la session
                </button>
                <button
                  onClick={() => setIsConfirmValidateOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Valider définitivement
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress & Variance Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase block">
              Progression Comptage
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                {totalCountedArticles} / {totalArticles}
              </span>
              <span className="text-xs text-slate-500">({progressPercent}%)</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase block">
              Articles avec Écart
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span
                className={`text-lg font-bold font-mono tabular-nums ${
                  varianceCount > 0 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {varianceCount}
              </span>
              <span className="text-xs text-slate-500">référence(s)</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase block">
              Écart Quantitatif Cumulé
            </span>
            <div className="mt-1">
              <span
                className={`text-lg font-bold font-mono tabular-nums ${
                  totalVarianceQty > 0
                    ? 'text-emerald-700'
                    : totalVarianceQty < 0
                    ? 'text-rose-600'
                    : 'text-slate-900'
                }`}
              >
                {totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty} pièces
              </span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-[11px] text-slate-500 font-semibold uppercase block">
              Valorisation de l'Écart
            </span>
            <div className="mt-1">
              <span
                className={`text-base font-bold font-mono tabular-nums ${
                  totalVarianceValue > 0
                    ? 'text-emerald-700'
                    : totalVarianceValue < 0
                    ? 'text-rose-600'
                    : 'text-slate-900'
                }`}
              >
                {formatFCFA(totalVarianceValue)}
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Filter and search bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="w-full sm:w-96 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par référence, désignation ou emplacement..."
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={filterVarianceOnly}
              onChange={(e) => setFilterVarianceOnly(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            <span>Afficher uniquement les écarts</span>
          </label>
        </div>
      </div>

      {/* Inventory Counting Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-3">Réf. Constructeur</th>
                <th className="py-3 px-3">Désignation</th>
                <th className="py-3 px-3">Emplacement</th>
                <th className="py-3 px-3 text-right">Stock Théorique</th>
                <th className="py-3 px-3 text-right w-36">Stock Compté</th>
                <th className="py-3 px-3 text-right">Écart (Compté - Théo)</th>
                <th className="py-3 px-3 text-right">Valeur Écart</th>
                <th className="py-3 px-3">Motif / Justification écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.map((item) => {
                const art = getArticleById(item.articleId);
                if (!art) return null;

                const hasCounted = item.countedQty !== null;
                const variance = item.variance || 0;
                const isPositive = variance > 0;
                const isNegative = variance < 0;

                return (
                  <tr key={item.articleId} className="hover:bg-slate-50/60">
                    {/* Ref */}
                    <td className="py-3 px-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                      {art.mainReference}
                      <span className="block text-[10px] text-slate-400 font-normal">
                        {art.brand}
                      </span>
                    </td>

                    {/* Designation */}
                    <td className="py-3 px-3 max-w-xs">
                      <div className="font-medium text-slate-800 truncate">{art.designation}</div>
                      <div className="text-[11px] text-slate-500">{art.category}</div>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-3 font-mono text-slate-500 whitespace-nowrap text-[11px]">
                      {art.defaultLocation}
                    </td>

                    {/* Theoretical Stock */}
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-700 whitespace-nowrap tabular-nums">
                      {item.theoreticalQty} {art.unit}
                    </td>

                    {/* Counted input */}
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      {isValidated ? (
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {item.countedQty} {art.unit}
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Saisir..."
                            value={item.countedQty === null ? '' : item.countedQty}
                            onChange={(e) => handleCountChange(item.articleId, e.target.value)}
                            className="w-24 px-2 py-1 text-sm font-mono font-bold text-right border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                          />
                          <span className="text-[10px] text-slate-400">{art.unit}</span>
                        </div>
                      )}
                    </td>

                    {/* Variance */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold tabular-nums">
                      {!hasCounted ? (
                        <span className="text-slate-300 text-[11px]">En attente</span>
                      ) : variance === 0 ? (
                        <span className="text-emerald-700">0 (Conforme)</span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            isPositive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isPositive ? `+${variance}` : variance}
                        </span>
                      )}
                    </td>

                    {/* Variance value */}
                    <td className="py-3 px-3 text-right whitespace-nowrap font-mono tabular-nums text-slate-700">
                      {!hasCounted || variance === 0 ? '-' : formatFCFA(item.varianceValue)}
                    </td>

                    {/* Notes */}
                    <td className="py-3 px-3">
                      {isValidated ? (
                        <span className="text-slate-600 text-[11px]">{item.notes || '-'}</span>
                      ) : (
                        <input
                          type="text"
                          value={item.notes || ''}
                          disabled={!hasCounted || variance === 0}
                          onChange={(e) => handleNotesChange(item.articleId, e.target.value)}
                          placeholder={variance !== 0 ? 'Justification de l’écart...' : '-'}
                          className="w-full px-2 py-1 text-xs border border-slate-200 rounded disabled:bg-slate-50 disabled:text-slate-400"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Superviseur : <strong>{session.supervisor}</strong> · Date : {formatDate(session.date)}
          </span>
          <span className="font-medium">
            Règle : La validation finale génère automatiquement les écritures d'ajustement requises.
          </span>
        </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={isConfirmValidateOpen}
        title="Validation définitive de l'inventaire physique"
        message={`Êtes-vous sûr de vouloir valider la session ${session.code} ? Cette action va enregistrer officiellement les ${varianceCount} ajustements de stock dans l'historique et verrouiller définitivement la session.`}
        confirmLabel="Valider et clôturer l'inventaire"
        variant="primary"
        onConfirm={handleValidateSession}
        onCancel={() => setIsConfirmValidateOpen(false)}
      />

      <ConfirmModal
        isOpen={isConfirmCancelOpen}
        title="Annuler la session d'inventaire"
        message="Êtes-vous sûr de vouloir annuler cette session ? Les comptages non validés seront abandonnés."
        confirmLabel="Confirmer l'annulation"
        variant="danger"
        onConfirm={handleCancelSession}
        onCancel={() => setIsConfirmCancelOpen(false)}
      />
    </div>
  );
};
