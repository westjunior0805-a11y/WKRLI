import React, { useState, useEffect, useRef } from 'react';
import { Article, ArticleCategory } from '../../types';
import { X, Plus, Trash2, Image as ImageIcon, Upload, Link as LinkIcon, Camera } from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';

interface ArticleFormModalProps {
  isOpen: boolean;
  articleToEdit?: Article | null;
  onClose: () => void;
  onSubmit: (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => {
    success: boolean;
    error?: string;
  };
}

const CATEGORIES: ArticleCategory[] = [
  'Filtration',
  'Moteur & Refroidissement',
  'Système Injection & Carburant',
  'Train de Roulement & Chenilles',
  'Hydraulique & Vérins',
  'Freinage & Friction',
  'Électricité & Démarreurs',
  'Transmission & Ponts',
  'Outils d’Attaque au Sol (Dents/Lames)',
];

const COMMON_BRANDS = [
  'Caterpillar',
  'Komatsu',
  'Volvo CE',
  'Donaldson',
  'Fleetguard',
  'Bosch',
  'Berco',
  'Baldwin',
  'JCB',
  'Cummins',
  'Liebherr',
  'ITR',
  'Perkins',
  'Hitachi',
  'Autre',
];

interface FormBrandOffer {
  id: string;
  brand: string;
  brandReference: string;
  purchasePrice: number;
  salePrice: number;
  preferredSupplier: string;
  isDefault: boolean;
}

export const ArticleFormModal: React.FC<ArticleFormModalProps> = ({
  isOpen,
  articleToEdit,
  onClose,
  onSubmit,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mainReference, setMainReference] = useState('');
  const [designation, setDesignation] = useState('');
  const [category, setCategory] = useState<ArticleCategory>('Filtration');
  const [equivalentInput, setEquivalentInput] = useState('');
  const [equivalents, setEquivalents] = useState<string[]>([]);
  const [machineInput, setMachineInput] = useState('');
  const [machines, setMachines] = useState<string[]>([]);
  const [minStockThreshold, setMinStockThreshold] = useState<number>(5);
  const [defaultLocation, setDefaultLocation] = useState('');
  const [unit, setUnit] = useState('Unité');
  const [barcode, setBarcode] = useState('');
  const [weightKg, setWeightKg] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<'active' | 'archived'>('active');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Multi-brand offers state
  const [brandOffers, setBrandOffers] = useState<FormBrandOffer[]>([]);

  // Image upload & management state
  const [imageUrl, setImageUrl] = useState('');
  const [imageType, setImageType] = useState<'REAL_PHOTO' | 'SUPPLIER_IMAGE' | 'AI_ILLUSTRATION'>('REAL_PHOTO');
  const [imageMode, setImageMode] = useState<'FILE' | 'URL'>('FILE');

  useEffect(() => {
    if (articleToEdit) {
      setMainReference(articleToEdit.mainReference);
      setDesignation(articleToEdit.designation);
      setCategory(articleToEdit.category);
      setEquivalents(articleToEdit.equivalentReferences || []);
      setMachines(articleToEdit.compatibleMachines || []);
      setMinStockThreshold(articleToEdit.minStockThreshold);
      setDefaultLocation(articleToEdit.defaultLocation);
      setUnit(articleToEdit.unit);
      setBarcode(articleToEdit.barcode || '');
      setWeightKg(articleToEdit.weightKg);
      setStatus(articleToEdit.status);
      setNotes(articleToEdit.notes || '');
      setImageUrl(articleToEdit.imageUrl || '');
      setImageType(articleToEdit.imageType || 'REAL_PHOTO');

      if (articleToEdit.brandOffers && articleToEdit.brandOffers.length > 0) {
        setBrandOffers(
          articleToEdit.brandOffers.map((bo) => ({
            id: bo.id || `bo_${Math.random()}`,
            brand: bo.brand || 'Caterpillar',
            brandReference: bo.brandReference || articleToEdit.mainReference,
            purchasePrice: bo.purchasePrice || 0,
            salePrice: bo.salePrice || 0,
            preferredSupplier: bo.preferredSupplier || '',
            isDefault: bo.isDefault || false,
          }))
        );
      } else {
        setBrandOffers([
          {
            id: 'bo_default',
            brand: articleToEdit.brand || 'Caterpillar',
            brandReference: articleToEdit.mainReference,
            purchasePrice: articleToEdit.purchasePrice || 0,
            salePrice: articleToEdit.salePrice || 0,
            preferredSupplier: articleToEdit.preferredSupplier || '',
            isDefault: true,
          },
        ]);
      }
    } else {
      setMainReference('');
      setDesignation('');
      setCategory('Filtration');
      setEquivalents([]);
      setMachines([]);
      setMinStockThreshold(5);
      setDefaultLocation('');
      setUnit('Unité');
      setBarcode('');
      setWeightKg(undefined);
      setStatus('active');
      setNotes('');
      setImageUrl('');
      setImageType('REAL_PHOTO');
      setBrandOffers([
        {
          id: 'bo_1',
          brand: 'Caterpillar',
          brandReference: '',
          purchasePrice: 0,
          salePrice: 0,
          preferredSupplier: '',
          isDefault: true,
        },
      ]);
    }
    setErrorMessage('');
  }, [articleToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUri = await compressImageFile(file, 480, 480, 0.72);
      setImageUrl(compressedDataUri);
      setImageType('REAL_PHOTO');
      setErrorMessage('');
    } catch {
      setErrorMessage("Erreur lors de la compression de l'image.");
    }
  };

  const handleAddEquivalent = () => {
    if (equivalentInput.trim() && !equivalents.includes(equivalentInput.trim())) {
      setEquivalents([...equivalents, equivalentInput.trim()]);
      setEquivalentInput('');
    }
  };

  const handleRemoveEquivalent = (index: number) => {
    setEquivalents(equivalents.filter((_, i) => i !== index));
  };

  const handleAddMachine = () => {
    if (machineInput.trim() && !machines.includes(machineInput.trim())) {
      setMachines([...machines, machineInput.trim()]);
      setMachineInput('');
    }
  };

  const handleRemoveMachine = (index: number) => {
    setMachines(machines.filter((_, i) => i !== index));
  };

  const handleAddBrandOffer = () => {
    const newOffer: FormBrandOffer = {
      id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      brand: 'Donaldson',
      brandReference: '',
      purchasePrice: 0,
      salePrice: 0,
      preferredSupplier: '',
      isDefault: brandOffers.length === 0,
    };
    setBrandOffers([...brandOffers, newOffer]);
  };

  const handleUpdateBrandOffer = (id: string, updates: Partial<FormBrandOffer>) => {
    setBrandOffers(
      brandOffers.map((bo) => {
        if (bo.id === id) {
          return { ...bo, ...updates };
        }
        if (updates.isDefault && bo.id !== id) {
          return { ...bo, isDefault: false };
        }
        return bo;
      })
    );
  };

  const handleRemoveBrandOffer = (id: string) => {
    if (brandOffers.length <= 1) {
      setErrorMessage('La fiche doit comporter au moins une marque / constructeur.');
      return;
    }
    const remaining = brandOffers.filter((bo) => bo.id !== id);
    if (!remaining.some((bo) => bo.isDefault) && remaining.length > 0) {
      remaining[0].isDefault = true;
    }
    setBrandOffers(remaining);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!mainReference.trim()) {
      setErrorMessage('La référence constructeur principale est obligatoire.');
      return;
    }
    if (!designation.trim()) {
      setErrorMessage('La désignation de la pièce est obligatoire.');
      return;
    }
    if (brandOffers.length === 0) {
      setErrorMessage('Veuillez ajouter au moins une marque avec son tarif.');
      return;
    }

    const defaultOffer = brandOffers.find((bo) => bo.isDefault) || brandOffers[0];

    const result = onSubmit({
      mainReference: mainReference.trim().toUpperCase(),
      designation: designation.trim(),
      brand: defaultOffer.brand.trim() || 'Générique',
      category,
      compatibleMachines: machines,
      equivalentReferences: equivalents,
      purchasePrice: Number(defaultOffer.purchasePrice) || 0,
      salePrice: Number(defaultOffer.salePrice) || 0,
      minStockThreshold: Number(minStockThreshold) || 0,
      brandOffers: brandOffers.map((bo) => ({
        id: bo.id,
        brand: bo.brand.trim() || 'Générique',
        brandReference: bo.brandReference.trim() || mainReference.trim().toUpperCase(),
        purchasePrice: Number(bo.purchasePrice) || 0,
        salePrice: Number(bo.salePrice) || 0,
        preferredSupplier: bo.preferredSupplier.trim() || undefined,
        isDefault: bo.id === defaultOffer.id,
      })),
      defaultLocation: defaultLocation.trim() || 'Rayon général',
      unit,
      barcode: barcode.trim() || undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      imageUrl: imageUrl.trim() || undefined,
      imageType: imageUrl.trim() ? imageType : undefined,
      status,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de l’enregistrement.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {articleToEdit ? 'Modifier la pièce détachée' : 'Ajouter une nouvelle référence'}
            </h2>
            <p className="text-xs text-slate-300">
              Fiche article maître & gestion multi-marques / constructeurs
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold">
              {errorMessage}
            </div>
          )}

          {/* Section 1: Identification principale */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
              <span>Identification Technique de la Pièce</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Réf. Constructeur / Pivot Principale *
                </label>
                <input
                  type="text"
                  required
                  value={mainReference}
                  onChange={(e) => setMainReference(e.target.value)}
                  placeholder="Ex: 1R-0716, 6736-51-5142"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-bold bg-white text-slate-900"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Référence technique pivot unique dans le catalogue.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Catégorie technique *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ArticleCategory)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Désignation de la pièce *
              </label>
              <input
                type="text"
                required
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                placeholder="Ex: Filtre à Carburant Haute Efficacité 2 Microns"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              />
            </div>

            {/* Équivalences Cross-Ref */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Références équivalentes / Cross-ref (Donaldson, Baldwin, Fleetguard, Mann, etc.)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={equivalentInput}
                  onChange={(e) => setEquivalentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEquivalent();
                    }
                  }}
                  placeholder="Ajouter une réf équivalente (ex: P551313, LF3349, W950)"
                  className="flex-1 px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddEquivalent}
                  className="px-3 py-1.5 text-xs font-semibold bg-white hover:bg-slate-100 text-slate-800 rounded-lg border border-slate-300 inline-flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              </div>
              {equivalents.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {equivalents.map((eq, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-white border border-slate-300 text-slate-800 text-xs font-mono rounded shadow-2xs"
                    >
                      {eq}
                      <button
                        type="button"
                        onClick={() => handleRemoveEquivalent(i)}
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Marques, Constructeurs & Grille Tarifaire */}
          <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-900 flex items-center gap-1.5">
                  <span>Marques, Constructeurs & Grille Tarifaire</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-900">
                    {brandOffers.length} {brandOffers.length > 1 ? 'marques' : 'marque'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Définissez les différents constructeurs proposant cette pièce avec leurs prix d'achat et de vente respectifs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddBrandOffer}
                className="px-3 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg shadow-2xs transition-colors inline-flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une marque
              </button>
            </div>

            <div className="space-y-2.5">
              {brandOffers.map((offer, idx) => {
                const margin = (offer.salePrice || 0) - (offer.purchasePrice || 0);
                const marginPercent = offer.purchasePrice > 0 ? Math.round((margin / offer.purchasePrice) * 100) : 0;

                return (
                  <div
                    key={offer.id || idx}
                    className={`p-3 bg-white border rounded-xl shadow-2xs transition-all space-y-2 ${
                      offer.isDefault ? 'border-amber-400 ring-1 ring-amber-400/30' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700">
                          <input
                            type="radio"
                            name="defaultBrandOffer"
                            checked={offer.isDefault}
                            onChange={() => handleUpdateBrandOffer(offer.id, { isDefault: true })}
                            className="w-3.5 h-3.5 text-amber-600 focus:ring-amber-500"
                          />
                          <span>Marque par défaut</span>
                        </label>
                      </div>

                      {brandOffers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveBrandOffer(offer.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                          title="Supprimer cette offre de marque"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Marque / Fabricant *
                        </label>
                        <input
                          type="text"
                          required
                          value={offer.brand}
                          onChange={(e) => handleUpdateBrandOffer(offer.id, { brand: e.target.value })}
                          placeholder="Ex: Caterpillar, Donaldson..."
                          className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Prix Achat (FCFA) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          required
                          value={offer.purchasePrice}
                          onChange={(e) =>
                            handleUpdateBrandOffer(offer.id, {
                              purchasePrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Prix Vente (FCFA) *
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="100"
                          required
                          value={offer.salePrice}
                          onChange={(e) =>
                            handleUpdateBrandOffer(offer.id, {
                              salePrice: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                          Fournisseur habituel
                        </label>
                        <input
                          type="text"
                          value={offer.preferredSupplier}
                          onChange={(e) =>
                            handleUpdateBrandOffer(offer.id, { preferredSupplier: e.target.value })
                          }
                          placeholder="Ex: Sodimate BTP"
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1 text-slate-500 border-t border-slate-100">
                      <span>
                        Marge brute :{' '}
                        <strong className={margin >= 0 ? 'text-emerald-700 font-mono' : 'text-rose-600 font-mono'}>
                          {margin.toLocaleString()} FCFA ({marginPercent}%)
                        </strong>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 3: Seuil minimal & Logistique */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Seuil Minimal d'Alerte (global) *
              </label>
              <input
                type="number"
                min="0"
                required
                value={minStockThreshold}
                onChange={(e) => setMinStockThreshold(parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Seuil d'alerte pour la pièce (toutes marques confondues).
              </span>
            </div>
          </div>

          {/* Row 6: Location, Unit, Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Emplacement de stockage
              </label>
              <input
                type="text"
                value={defaultLocation}
                onChange={(e) => setDefaultLocation(e.target.value)}
                placeholder="Ex: Allée B - Casier 04"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Unité de gestion
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="Unité">Unité (pièce)</option>
                <option value="Jeu">Jeu / Paire</option>
                <option value="Kit complet">Kit complet</option>
                <option value="Fût 200L">Fût 200L</option>
                <option value="Bidon 20L">Bidon 20L</option>
                <option value="Mètre">Mètre</option>
                <option value="Rouleau">Rouleau</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Code-barres / EAN (facultatif)
              </label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Ex: 7891234001"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Row: Illustration / Photo du produit */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Photo & Illustration de la pièce
                </span>
              </div>
              <div className="inline-flex p-0.5 bg-slate-200 rounded text-[11px]">
                <button
                  type="button"
                  onClick={() => setImageMode('FILE')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    imageMode === 'FILE'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fichier / Photo
                </button>
                <button
                  type="button"
                  onClick={() => setImageMode('URL')}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    imageMode === 'URL'
                      ? 'bg-white text-slate-900 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Lien Web / URL
                </button>
              </div>
            </div>

            {imageMode === 'FILE' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-4 px-4 border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/20 rounded-xl flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer group"
                >
                  <div className="p-2 rounded-full bg-slate-100 group-hover:bg-amber-100 text-slate-600 group-hover:text-amber-700 transition-colors">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">
                    Cliquer pour sélectionner une photo de la pièce
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Formats acceptés : PNG, JPG, JPEG, WEBP (Max 3 Mo)
                  </span>
                </button>
              </div>
            ) : (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                  URL de l'image (Lien web externe ou catalogue fournisseur)
                </label>
                <div className="relative">
                  <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://exemple.com/images/cat-filter-1r0716.jpg"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                  />
                </div>
              </div>
            )}

            {/* Image Preview & Details */}
            {imageUrl && (
              <div className="pt-2 flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-200 animate-in fade-in">
                <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 shrink-0 relative flex items-center justify-center">
                  <img
                    src={imageUrl}
                    alt="Aperçu de la pièce"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <span className="text-xs font-semibold text-slate-800 block">
                    Aperçu de la photo chargée
                  </span>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-500">Type :</label>
                    <select
                      value={imageType}
                      onChange={(e) => setImageType(e.target.value as any)}
                      className="px-2 py-0.5 text-[11px] font-semibold border border-slate-200 rounded bg-slate-50 text-slate-700"
                    >
                      <option value="REAL_PHOTO">Photo magasin / atelier</option>
                      <option value="SUPPLIER_IMAGE">Catalogue constructeur</option>
                      <option value="AI_ILLUSTRATION">Schéma technique</option>
                    </select>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors shrink-0"
                  title="Supprimer la photo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Row 7: Notes & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Notes et spécifications techniques
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Spécifications (pression, dimensions, recommandations)..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Statut
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'archived')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="active">Actif (en vente/service)</option>
                <option value="archived">Archivé (obsolète)</option>
              </select>
            </div>
          </div>

          {/* Submit buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
            >
              {articleToEdit ? 'Enregistrer les modifications' : 'Créer la pièce'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
