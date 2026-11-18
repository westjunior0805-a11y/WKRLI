import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { Article, MachineApplication } from '../../types';
import { useStock } from '../../context/StockContext';
import { ImportWhereUsedModal } from './ImportWhereUsedModal';
import {
  Tractor,
  X,
  Plus,
  Trash2,
  Edit2,
  Check,
  Search,
  Download,
  Upload,
  AlertCircle,
  Cpu,
  Layers,
} from 'lucide-react';

interface MachineWhereUsedModalProps {
  article: Article | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MachineWhereUsedModal: React.FC<MachineWhereUsedModalProps> = ({
  article: propArticle,
  isOpen,
  onClose,
}) => {
  const {
    articles,
    addMachineApplication,
    updateMachineApplication,
    removeMachineApplication,
    getTotalStockForArticle,
  } = useStock();

  const article = propArticle
    ? articles.find((a) => a.id === propArticle.id) || propArticle
    : null;

  const [searchFilter, setSearchFilter] = useState('');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // New Application Form State (Caterpillar SIS 2.0 standard fields)
  const [familyInput, setFamilyInput] = useState('');
  const [subFamilyInput, setSubFamilyInput] = useState('');
  const [modelInput, setModelInput] = useState('');
  const [prefixInput, setPrefixInput] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Mode State
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [editFamily, setEditFamily] = useState('');
  const [editSubFamily, setEditSubFamily] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPrefix, setEditPrefix] = useState('');

  if (!isOpen || !article) return null;

  const totalStock = getTotalStockForArticle(article.id);
  const applications = article.machineApplications || [];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (!modelInput.trim()) {
      setAddError('Veuillez renseigner le Modèle de vente (ex: 320D, 966H).');
      return;
    }

    const res = addMachineApplication(article.id, {
      productFamily: familyInput.trim().toUpperCase() || undefined,
      subFamily: subFamilyInput.trim().toUpperCase() || undefined,
      model: modelInput.trim().toUpperCase(),
      serialPrefix: prefixInput.trim().toUpperCase() || undefined,
    });

    if (!res.success) {
      setAddError(res.error || 'Erreur lors de l’ajout.');
    } else {
      setFamilyInput('');
      setSubFamilyInput('');
      setModelInput('');
      setPrefixInput('');
    }
  };

  const handleStartEdit = (app: MachineApplication) => {
    setEditingAppId(app.id);
    setEditFamily(app.productFamily || '');
    setEditSubFamily(app.subFamily || '');
    setEditModel(app.model);
    setEditPrefix(app.serialPrefix || '');
  };

  const handleSaveEdit = (appId: string) => {
    if (!editModel.trim()) return;

    updateMachineApplication(article.id, appId, {
      productFamily: editFamily.trim().toUpperCase() || undefined,
      subFamily: editSubFamily.trim().toUpperCase() || undefined,
      model: editModel.trim().toUpperCase(),
      serialPrefix: editPrefix.trim().toUpperCase() || undefined,
    });

    setEditingAppId(null);
  };

  const handleExportExcel = () => {
    if (applications.length === 0) return;

    const headers = [
      'Famille de produits',
      'Sous-famille',
      'Modèle de vente',
      'Préfixe',
      'Référence Pièce',
      'Désignation',
    ];

    const rows = applications.map((app) => [
      app.productFamily || '',
      app.subFamily || '',
      app.model,
      app.serialPrefix || '',
      article.mainReference,
      article.designation,
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    ws['!cols'] = [
      { wch: 24 }, // Famille de produits
      { wch: 18 }, // Sous-famille
      { wch: 18 }, // Modèle de vente
      { wch: 14 }, // Préfixe
      { wch: 18 }, // Référence Pièce
      { wch: 32 }, // Désignation
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Where_Used');
    const safeRef = article.mainReference.replace(/[^a-zA-Z0-9_-]/g, '');
    XLSX.writeFile(wb, `Where_Used_SIS_${safeRef}.xlsx`);
  };

  const filteredApps = applications.filter((app) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      app.model.toLowerCase().includes(q) ||
      (app.serialPrefix && app.serialPrefix.toLowerCase().includes(q)) ||
      (app.productFamily && app.productFamily.toLowerCase().includes(q)) ||
      (app.subFamily && app.subFamily.toLowerCase().includes(q))
    );
  });

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold shadow-xs">
                <Tractor className="w-5 h-5 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Where Used (Affectations Engins SIS 2.0)
                  </h2>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 font-mono">
                    Caterpillar SIS
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Machines et séries d'engins dans lesquelles cette pièce est utilisée.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Part Summary Card */}
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-mono font-extrabold text-sm text-slate-950 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-md shadow-2xs">
                {article.mainReference}
              </span>
              <div>
                <h3 className="font-bold text-slate-900">{article.designation}</h3>
                <span className="text-slate-500 text-[11px]">
                  Marque : <strong>{article.brand}</strong> · {article.category}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                  Stock Total
                </span>
                <span className="font-mono font-black text-sm text-slate-900">
                  {totalStock} {article.unit}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-300" />
              <div className="text-right">
                <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">
                  Machines Affectées
                </span>
                <span className="font-mono font-black text-sm text-amber-600">
                  {applications.length}
                </span>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 overflow-y-auto flex-1 space-y-5">
            {/* Action Bar: Search, Import SIS 2.0, Export Excel */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  placeholder="Filtrer par modèle (ex: 320D), préfixe (ex: FAL), famille..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Importer des affectations d'engins depuis un export Caterpillar SIS 2.0"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-950" />
                  <span>Importer fichier SIS 2.0</span>
                </button>

                <button
                  type="button"
                  disabled={applications.length === 0}
                  onClick={handleExportExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-300 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  title="Télécharger la liste Where-Used au format Excel"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Exporter Excel</span>
                </button>
              </div>
            </div>

            {/* Quick Add Application Form with the 4 Caterpillar SIS 2.0 fields */}
            <form
              onSubmit={handleAdd}
              className="p-4 bg-amber-50/40 border border-amber-200/80 rounded-xl space-y-3"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-amber-600" />
                  <span>Ajouter une machine compatible (Format SIS 2.0)</span>
                </h4>
                <span className="text-[11px] text-slate-500 italic">
                  Modèle requis · Préfixe, Famille & Sous-famille recommandés
                </span>
              </div>

              {addError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                    Famille de produits
                  </label>
                  <input
                    type="text"
                    value={familyInput}
                    onChange={(e) => setFamilyInput(e.target.value)}
                    placeholder="Ex: EXCAVATOR"
                    className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                    Sous-famille
                  </label>
                  <input
                    type="text"
                    value={subFamilyInput}
                    onChange={(e) => setSubFamilyInput(e.target.value)}
                    placeholder="Ex: 320, D6, 966"
                    className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                    Modèle de vente *
                  </label>
                  <input
                    type="text"
                    value={modelInput}
                    onChange={(e) => setModelInput(e.target.value)}
                    placeholder="Ex: 320D, 966H"
                    className="w-full px-2.5 py-1.5 text-xs font-bold font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-700 uppercase mb-0.5">
                    Préfixe (S/N)
                  </label>
                  <input
                    type="text"
                    value={prefixInput}
                    onChange={(e) => setPrefixInput(e.target.value)}
                    placeholder="Ex: FAL, WBN, B4L"
                    className="w-full px-2.5 py-1.5 text-xs font-bold font-mono uppercase bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg shadow-2xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Ajouter</span>
                  </button>
                </div>
              </div>
            </form>

            {/* Applications Table with the 4 columns */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>
                  Affichage de <strong>{filteredApps.length}</strong> engin(s) compatible(s)
                </span>
                {applications.length > 0 && (
                  <span className="text-[11px] font-mono font-semibold text-slate-600">
                    4 colonnes SIS 2.0 : Famille · Sous-famille · Modèle de vente · Préfixe
                  </span>
                )}
              </div>

              {filteredApps.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 space-y-2">
                  <Tractor className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-700">
                    {searchFilter
                      ? 'Aucun engin ne correspond à votre filtre.'
                      : 'Aucune machine n’est encore associée à cette référence.'}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    {searchFilter
                      ? 'Modifiez votre recherche ou effacez le filtre.'
                      : 'Utilisez le formulaire ci-dessus ou cliquez sur "Importer fichier SIS 2.0" pour charger votre export.'}
                  </p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Famille de produits</th>
                        <th className="py-2.5 px-3">Sous-famille</th>
                        <th className="py-2.5 px-3">Modèle de vente</th>
                        <th className="py-2.5 px-3">Préfixe</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {filteredApps.map((app) => {
                        const isEditing = editingAppId === app.id;

                        if (isEditing) {
                          return (
                            <tr key={app.id} className="bg-amber-50/50">
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={editFamily}
                                  onChange={(e) => setEditFamily(e.target.value)}
                                  className="w-full px-2 py-1 text-xs font-mono uppercase bg-white border border-amber-300 rounded"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={editSubFamily}
                                  onChange={(e) => setEditSubFamily(e.target.value)}
                                  className="w-full px-2 py-1 text-xs font-mono uppercase bg-white border border-amber-300 rounded"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={editModel}
                                  onChange={(e) => setEditModel(e.target.value)}
                                  className="w-full px-2 py-1 text-xs font-mono font-bold uppercase bg-white border border-amber-300 rounded"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={editPrefix}
                                  onChange={(e) => setEditPrefix(e.target.value)}
                                  className="w-full px-2 py-1 text-xs font-mono font-bold uppercase bg-white border border-amber-300 rounded"
                                />
                              </td>
                              <td className="py-2 px-3 text-right whitespace-nowrap">
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(app.id)}
                                    className="p-1 text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 rounded cursor-pointer"
                                    title="Enregistrer"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingAppId(null)}
                                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                                    title="Annuler"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={app.id} className="hover:bg-slate-50/80 transition-colors">
                            {/* Product Family */}
                            <td className="py-3 px-3 text-slate-700">
                              {app.productFamily ? (
                                <span className="font-semibold text-slate-800">
                                  {app.productFamily}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">—</span>
                              )}
                            </td>

                            {/* Subfamily */}
                            <td className="py-3 px-3 text-slate-700">
                              {app.subFamily ? (
                                <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[11px] font-semibold">
                                  {app.subFamily}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">—</span>
                              )}
                            </td>

                            {/* Sales Model */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span className="font-mono font-bold text-slate-900 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded text-xs">
                                {app.model}
                              </span>
                            </td>

                            {/* Serial Prefix */}
                            <td className="py-3 px-3 whitespace-nowrap">
                              {app.serialPrefix ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-900 border border-slate-200 rounded font-mono font-extrabold text-[11px]">
                                  {app.serialPrefix}
                                </span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">Tous S/N</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(app)}
                                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                  title="Modifier"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeMachineApplication(article.id, app.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                  title="Supprimer cette affectation"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <span className="text-xs text-slate-500">
              Ces correspondances alimentent automatiquement le moteur de recherche et les filtres machine au comptoir.
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Import Modal directly targeted to this piece */}
      <ImportWhereUsedModal
        article={article}
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </>
  );
};
