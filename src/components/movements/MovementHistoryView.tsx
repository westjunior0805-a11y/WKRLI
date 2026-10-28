import React, { useState, useMemo } from 'react';
import { useStock } from '../../context/StockContext';
import { MovementType, StockMovement } from '../../types';
import { formatFCFA, formatDateTime, exportToCSV } from '../../utils/formatters';
import {
  History,
  Download,
  Filter,
  Search,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  ShieldCheck,
  Calendar,
  Building2,
  User,
  Info,
} from 'lucide-react';

export const MovementHistoryView: React.FC = () => {
  const {
    movements,
    articles,
    warehouses,
    users,
    selectedWarehouseId,
    getArticleById,
    getWarehouseById,
  } = useStock();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>(
    selectedWarehouseId || 'ALL'
  );
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [selectedMovementDetail, setSelectedMovementDetail] = useState<StockMovement | null>(null);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((mvt) => {
      // Type filter
      if (selectedType !== 'ALL' && mvt.type !== selectedType) return false;

      // Warehouse filter
      if (selectedWarehouseFilter !== 'ALL') {
        const isInSource = mvt.sourceWarehouseId === selectedWarehouseFilter;
        const isInTarget = mvt.targetWarehouseId === selectedWarehouseFilter;
        if (!isInSource && !isInTarget) return false;
      }

      // User filter
      if (selectedUserFilter !== 'ALL' && mvt.userId !== selectedUserFilter) return false;

      // Search query (matches article ref, designation, documentRef, reason, thirdParty)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const art = getArticleById(mvt.articleId);
        const matchDoc = mvt.documentRef.toLowerCase().includes(q);
        const matchReason = mvt.reason.toLowerCase().includes(q);
        const matchThird = mvt.thirdParty?.toLowerCase().includes(q);
        const matchArtRef = art?.mainReference.toLowerCase().includes(q);
        const matchArtDesig = art?.designation.toLowerCase().includes(q);

        if (!matchDoc && !matchReason && !matchThird && !matchArtRef && !matchArtDesig) {
          return false;
        }
      }

      // Date filter
      if (dateFilter !== 'ALL') {
        const mvtDate = new Date(mvt.date);
        const now = new Date();
        if (dateFilter === 'TODAY') {
          if (mvtDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'WEEK') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (mvtDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'MONTH') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (mvtDate < thirtyDaysAgo) return false;
        }
      }

      return true;
    });
  }, [
    movements,
    selectedType,
    selectedWarehouseFilter,
    selectedUserFilter,
    searchQuery,
    dateFilter,
    getArticleById,
  ]);

  const handleExportCSV = () => {
    const headers = [
      'ID Mouvement',
      'Date & Heure',
      'Type d’Opération',
      'Réf Constructeur',
      'Désignation',
      'Quantité',
      'Magasin Source',
      'Magasin Cible',
      'Document Référence',
      'Tiers (Client/Fournisseur)',
      'Motif',
      'Stock Avant',
      'Stock Après',
      'Utilisateur Responsable',
      'Prix Unitaire (FCFA)',
      'Total (FCFA)',
      'Observations',
    ];

    const rows = filteredMovements.map((m) => {
      const art = getArticleById(m.articleId);
      const srcWh = m.sourceWarehouseId ? getWarehouseById(m.sourceWarehouseId)?.name : '';
      const tgtWh = m.targetWarehouseId ? getWarehouseById(m.targetWarehouseId)?.name : '';

      return [
        m.id,
        formatDateTime(m.date),
        m.type,
        art?.mainReference || '',
        art?.designation || '',
        m.quantity,
        srcWh || '',
        tgtWh || '',
        m.documentRef,
        m.thirdParty || '',
        m.reason,
        m.stockBefore !== undefined ? m.stockBefore : '',
        m.stockAfter !== undefined ? m.stockAfter : '',
        m.userName,
        m.unitPrice || 0,
        m.totalPrice || 0,
        m.notes || '',
      ];
    });

    exportToCSV(`historique_mouvements_stock_${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Recherche par n° document (BL, Facture, BS), référence pièce, client ou motif..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Exporter l'historique CSV
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          {/* Movement Type Tabs */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setSelectedType('ALL')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedType === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous ({movements.length})
            </button>
            <button
              onClick={() => setSelectedType('ENTREE')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedType === 'ENTREE'
                  ? 'bg-white text-emerald-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Entrées
            </button>
            <button
              onClick={() => setSelectedType('SORTIE')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedType === 'SORTIE'
                  ? 'bg-white text-rose-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Sorties
            </button>
            <button
              onClick={() => setSelectedType('TRANSFERT')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedType === 'TRANSFERT'
                  ? 'bg-white text-blue-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Transferts
            </button>
            <button
              onClick={() => setSelectedType('AJUSTEMENT')}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                selectedType === 'AJUSTEMENT'
                  ? 'bg-white text-amber-800 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ajustements
            </button>
          </div>

          {/* Warehouse filter */}
          <select
            value={selectedWarehouseFilter}
            onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Tous les magasins</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} - {w.name}
              </option>
            ))}
          </select>

          {/* User filter */}
          <select
            value={selectedUserFilter}
            onChange={(e) => setSelectedUserFilter(e.target.value)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Tous les utilisateurs</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.role})
              </option>
            ))}
          </select>

          {/* Date range filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium hover:bg-slate-50 focus:outline-none"
          >
            <option value="ALL">Toutes les dates</option>
            <option value="TODAY">Aujourd'hui</option>
            <option value="WEEK">7 derniers jours</option>
            <option value="MONTH">30 derniers jours</option>
          </select>
        </div>
      </div>

      {/* Movements Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {filteredMovements.length === 0 ? (
            <div className="text-center py-12 px-4">
              <History className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h3 className="text-sm font-semibold text-slate-800">Aucun mouvement trouvé</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Aucune opération ne correspond aux filtres sélectionnés.
              </p>
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-3 px-3">Date & Heure</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Réf. & Pièce</th>
                  <th className="py-3 px-3 text-right">Quantité</th>
                  <th className="py-3 px-3">Magasin(s)</th>
                  <th className="py-3 px-3">N° Document</th>
                  <th className="py-3 px-3">Motif & Tiers</th>
                  <th className="py-3 px-3 text-right">Stock Avant/Après</th>
                  <th className="py-3 px-3">Utilisateur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMovements.map((mvt, idx) => {
                  const art = getArticleById(mvt.articleId);
                  const srcWh = mvt.sourceWarehouseId ? getWarehouseById(mvt.sourceWarehouseId) : null;
                  const tgtWh = mvt.targetWarehouseId ? getWarehouseById(mvt.targetWarehouseId) : null;

                  let badgeClass = 'bg-slate-100 text-slate-700';
                  let label: string = mvt.type;
                  let qtySign = '+';
                  let qtyColor = 'text-slate-900';

                  if (mvt.type === 'ENTREE') {
                    badgeClass = 'bg-emerald-100 text-emerald-800';
                    label = 'Entrée';
                    qtySign = '+';
                    qtyColor = 'text-emerald-700';
                  } else if (mvt.type === 'SORTIE') {
                    badgeClass = 'bg-rose-100 text-rose-800';
                    label = 'Sortie';
                    qtySign = '-';
                    qtyColor = 'text-rose-700';
                  } else if (mvt.type === 'TRANSFERT') {
                    badgeClass = 'bg-blue-100 text-blue-800';
                    label = 'Transfert';
                    qtySign = '↔';
                    qtyColor = 'text-blue-700';
                  } else if (mvt.type === 'AJUSTEMENT') {
                    badgeClass = 'bg-amber-100 text-amber-800';
                    label = 'Ajustement';
                    qtySign = '±';
                    qtyColor = 'text-amber-700';
                  }

                  return (
                    <tr
                      key={`${mvt.id}-${idx}`}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                      onClick={() => setSelectedMovementDetail(mvt)}
                    >
                      {/* Date */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                        {formatDateTime(mvt.date)}
                        <span className="block text-[10px] text-slate-400 font-normal">
                          {mvt.id}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${badgeClass}`}
                        >
                          {label}
                        </span>
                      </td>

                      {/* Article & Ref */}
                      <td className="py-3 px-3 max-w-[180px]">
                        <span className="font-mono font-bold text-slate-900 block truncate">
                          {art?.mainReference || mvt.articleId}
                        </span>
                        <span className="text-[11px] text-slate-500 truncate block">
                          {art?.designation || ''}
                        </span>
                      </td>

                      {/* Quantity */}
                      <td className="py-3 px-3 text-right whitespace-nowrap font-mono font-bold text-sm tabular-nums">
                        <span className={qtyColor}>
                          {qtySign} {mvt.quantity}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-1">{art?.unit}</span>
                      </td>

                      {/* Warehouse */}
                      <td className="py-3 px-3 text-xs whitespace-nowrap">
                        {mvt.type === 'TRANSFERT' ? (
                          <div className="flex items-center gap-1 font-medium">
                            <span className="text-amber-700">{srcWh?.code}</span>
                            <span>➔</span>
                            <span className="text-emerald-700">{tgtWh?.code}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-slate-800">
                            {tgtWh?.name || srcWh?.name || '-'}
                          </span>
                        )}
                      </td>

                      {/* Document Ref */}
                      <td className="py-3 px-3 font-mono text-slate-700 font-medium whitespace-nowrap">
                        {mvt.documentRef}
                      </td>

                      {/* Reason & Third Party */}
                      <td className="py-3 px-3 max-w-xs">
                        <div className="font-medium text-slate-800 truncate">{mvt.reason}</div>
                        {mvt.thirdParty && (
                          <div className="text-[11px] text-slate-500 truncate">
                            {mvt.thirdParty}
                          </div>
                        )}
                      </td>

                      {/* Stock before / after */}
                      <td className="py-3 px-3 text-right font-mono text-slate-700 whitespace-nowrap tabular-nums">
                        {mvt.stockBefore !== undefined && mvt.stockAfter !== undefined ? (
                          <span>
                            {mvt.stockBefore} ➔ <strong>{mvt.stockAfter}</strong>
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* User */}
                      <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                        {mvt.userName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer legal rule */}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span>
            Total des mouvements filtrés : <strong>{filteredMovements.length}</strong>
          </span>
          <span className="font-medium">
            Règle de sécurité : Les écritures validées sont immuables (aucune suppression directe).
          </span>
        </div>
      </div>

      {/* Detail Modal for a single movement */}
      {selectedMovementDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-xs font-mono font-semibold text-slate-400">
                  {selectedMovementDetail.id}
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">
                  Détail de l'opération {selectedMovementDetail.type}
                </h3>
              </div>
              <button
                onClick={() => setSelectedMovementDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Date et heure</span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatDateTime(selectedMovementDetail.date)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Référence pièce</span>
                <span className="font-mono font-bold text-slate-900">
                  {getArticleById(selectedMovementDetail.articleId)?.mainReference}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Quantité mouvementée</span>
                <span className="font-mono font-bold text-slate-900">
                  {selectedMovementDetail.quantity}{' '}
                  {getArticleById(selectedMovementDetail.articleId)?.unit}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">N° Document justificatif</span>
                <span className="font-mono font-semibold text-slate-900">
                  {selectedMovementDetail.documentRef}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Tiers (Fournisseur/Client)</span>
                <span className="font-medium text-slate-800">
                  {selectedMovementDetail.thirdParty || '-'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Opérateur responsable</span>
                <span className="font-medium text-slate-800">
                  {selectedMovementDetail.userName}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Valorisation de l'opération</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatFCFA(selectedMovementDetail.totalPrice || 0)}
                </span>
              </div>
              {selectedMovementDetail.notes && (
                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 mt-2">
                  <span className="font-semibold block text-slate-700 mb-0.5">Observations :</span>
                  <p className="text-slate-600">{selectedMovementDetail.notes}</p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedMovementDetail(null)}
                className="px-4 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
