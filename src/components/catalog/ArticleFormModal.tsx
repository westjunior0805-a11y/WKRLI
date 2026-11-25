import React, { useState, useEffect, useRef } from 'react';
import { Article, ArticleCategory, ARTICLE_CATEGORY_GROUPS, MachineApplication } from '../../types';
import { X, Plus, Trash2, Image as ImageIcon, Upload, Link as LinkIcon, Camera, Tractor } from 'lucide-react';
import { compressImageFile } from '../../utils/imageCompressor';
import { NumericInput } from '../common/NumericInput';
import { cleanBrandName } from '../../utils/articleHelpers';

interface ArticleFormModalProps {
  isOpen: boolean;
  articleToEdit?: Article | null;
  onClose: () => void;
  onSubmit: (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>) => {
    success: boolean;
    error?: string;
  };
  catalogOnlyMode?: boolean;
}

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
  stockQuantity?: number;
  location?: string;
  locations?: string[];
  invoiceNumber?: string;
  invoiceNumbers?: string[];
  isDefault: boolean;
}

export const ArticleFormModal: React.FC<ArticleFormModalProps> = ({
  isOpen,
  articleToEdit,
  onClose,
  onSubmit,
  catalogOnlyMode = true,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mainReference, setMainReference] = useState('');
  const [designation, setDesignation] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ArticleCategory>('Filtration');
  const [equivalentInput, setEquivalentInput] = useState('');
  const [equivalents, setEquivalents] = useState<string[]>([]);
  const [machineInput, setMachineInput] = useState('');
  const [machines, setMachines] = useState<string[]>([]);
  const [machineApplications, setMachineApplications] = useState<MachineApplication[]>([]);
  const [appFamily, setAppFamily] = useState('');
  const [appSubFamily, setAppSubFamily] = useState('');
  const [appModel, setAppModel] = useState('');
  const [appPrefix, setAppPrefix] = useState('');
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
      setDescription(articleToEdit.description || '');
      setCategory(articleToEdit.category);
      setEquivalents(articleToEdit.equivalentReferences || []);
      setMachines(articleToEdit.compatibleMachines || []);
      setMachineApplications(articleToEdit.machineApplications || []);
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
            brand: cleanBrandName(bo.brand),
            brandReference: bo.brandReference || articleToEdit.mainReference,
            purchasePrice: bo.purchasePrice || 0,
            salePrice: bo.salePrice || 0,
            preferredSupplier: bo.preferredSupplier || '',
            stockQuantity: bo.stockQuantity,
            location: bo.location || '',
            locations: bo.locations,
            invoiceNumber: bo.invoiceNumber || '',
            invoiceNumbers: bo.invoiceNumbers,
            isDefault: bo.isDefault || false,
          }))
        );
      } else {
        setBrandOffers([
          {
            id: 'bo_default',
            brand: cleanBrandName(articleToEdit.brand),
            brandReference: articleToEdit.mainReference,
            purchasePrice: articleToEdit.purchasePrice || 0,
            salePrice: articleToEdit.salePrice || 0,
            preferredSupplier: articleToEdit.preferredSupplier || '',
            location: articleToEdit.defaultLocation || '',
            invoiceNumber: articleToEdit.invoiceNumber || '',
            isDefault: true,
          },
        ]);
      }
    } else {
      setMainReference('');
      setDesignation('');
      setDescription('');
      setCategory('Filtration');
      setEquivalents([]);
      setMachines([]);
      setMachineApplications([]);
      setAppFamily('');
      setAppSubFamily('');
      setAppModel('');
      setAppPrefix('');
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
          brand: '',
          brandReference: '',
          purchasePrice: 0,
          salePrice: 0,
          preferredSupplier: '',
          location: '',
          invoiceNumber: '',
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

  const handleAddApp = () => {
    if (!appModel.trim()) return;
    const cleanModel = appModel.trim().toUpperCase();
    const cleanPrefix = appPrefix.trim().toUpperCase() || undefined;
    const cleanFam = appFamily.trim().toUpperCase() || undefined;
    const cleanSub = appSubFamily.trim().toUpperCase() || undefined;

    const isDup = machineApplications.some(
      (a) =>
        a.model.toLowerCase() === cleanModel.toLowerCase() &&
        (a.serialPrefix || '').toLowerCase() === (cleanPrefix || '').toLowerCase()
    );

    if (!isDup) {
      const newApp: MachineApplication = {
        id: `app_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productFamily: cleanFam,
        subFamily: cleanSub,
        model: cleanModel,
        serialPrefix: cleanPrefix,
      };
      setMachineApplications([...machineApplications, newApp]);
    }

    setAppFamily('');
    setAppSubFamily('');
    setAppModel('');
    setAppPrefix('');
  };

  const handleRemoveApp = (id: string) => {
    setMachineApplications(machineApplications.filter((a) => a.id !== id));
  };

  const handleAddBrandOffer = () => {
    const newOffer: FormBrandOffer = {
      id: `bo_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      brand: '',
      brandReference: '',
      purchasePrice: 0,
      salePrice: 0,
      preferredSupplier: '',
      location: '',
      invoiceNumber: '',
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

    const defaultOffer =
      brandOffers.find((bo) => bo.isDefault) ||
      brandOffers[0] || {
        id: 'bo_default',
        brand: articleToEdit?.brand || '',
        brandReference: mainReference.trim().toUpperCase(),
        purchasePrice: articleToEdit?.purchasePrice || 0,
        salePrice: articleToEdit?.salePrice || 0,
        preferredSupplier: articleToEdit?.preferredSupplier || '',
        location: articleToEdit?.defaultLocation || '',
        invoiceNumber: articleToEdit?.invoiceNumber || '',
        isDefault: true,
      };

    // Include any typed equivalent in input field if user forgot to click "Ajouter"
    const finalEquivalents = equivalentInput.trim() && !equivalents.includes(equivalentInput.trim())
      ? [...equivalents, equivalentInput.trim()]
      : equivalents;

    // Include any typed machine application (SIS 2.0) or legacy machine input if user forgot to click "+ Ajouter"
    const finalMachineApplications =
      appModel.trim() &&
      !machineApplications.some(
        (m) =>
          m.model.toLowerCase() === appModel.trim().toLowerCase() &&
          (m.serialPrefix || '').toLowerCase() === appPrefix.trim().toLowerCase()
      )
        ? [
            ...machineApplications,
            {
              id: `app_${Date.now()}`,
              productFamily: appFamily.trim() || undefined,
              subFamily: appSubFamily.trim() || undefined,
              model: appModel.trim().toUpperCase(),
              serialPrefix: appPrefix.trim() ? appPrefix.trim().toUpperCase() : undefined,
            },
          ]
        : machineApplications;

    const finalMachines =
      machineInput.trim() && !machines.includes(machineInput.trim())
        ? [...machines, machineInput.trim()]
        : machines;

    const result = onSubmit({
      mainReference: mainReference.trim().toUpperCase(),
      designation: designation.trim(),
      description: description.trim() || notes.trim() || undefined,
      brand:
        catalogOnlyMode && articleToEdit
          ? cleanBrandName(articleToEdit.brand)
          : cleanBrandName(defaultOffer.brand),
      category,
      machineApplications: finalMachineApplications,
      compatibleMachines: Array.from(
        new Set([
          ...finalMachines,
          ...finalMachineApplications.map((m) => m.model),
          ...finalMachineApplications.filter((m) => m.serialPrefix).map((m) => `${m.model} (${m.serialPrefix})`),
        ])
      ),
      equivalentReferences: finalEquivalents,
      purchasePrice: catalogOnlyMode && articleToEdit
        ? articleToEdit.purchasePrice
        : Number(defaultOffer.purchasePrice) || 0,
      salePrice: catalogOnlyMode && articleToEdit
        ? articleToEdit.salePrice
        : Number(defaultOffer.salePrice) || 0,
      minStockThreshold: Number(minStockThreshold) || 0,
      brandOffers:
        catalogOnlyMode && articleToEdit?.brandOffers && articleToEdit.brandOffers.length > 0
          ? articleToEdit.brandOffers
          : brandOffers.map((bo) => ({
              id: bo.id,
              brand: cleanBrandName(bo.brand),
              brandReference: bo.brandReference.trim() || mainReference.trim().toUpperCase(),
              purchasePrice: Number(bo.purchasePrice) || 0,
              salePrice: Number(bo.salePrice) || 0,
              preferredSupplier: bo.preferredSupplier.trim() || undefined,
              stockQuantity: bo.stockQuantity,
              location: bo.location?.trim() || undefined,
              locations: bo.locations,
              invoiceNumber: bo.invoiceNumber?.trim() || undefined,
              invoiceNumbers: bo.invoiceNumbers,
              isDefault: bo.id === defaultOffer.id,
            })),
      defaultLocation:
        catalogOnlyMode && articleToEdit
          ? articleToEdit.defaultLocation
          : defaultLocation.trim() || defaultOffer.location?.trim() || 'Rayon général',
      invoiceNumber:
        catalogOnlyMode && articleToEdit
          ? articleToEdit.invoiceNumber
          : defaultOffer.invoiceNumber?.trim() || articleToEdit?.invoiceNumber,
      unit,
      barcode: barcode.trim() || undefined,
      weightKg: weightKg ? Number(weightKg) : undefined,
      imageUrl: imageUrl.trim() || undefined,
      imageType: imageUrl.trim() ? imageType : undefined,
      status,
      notes: notes.trim() || description.trim() || undefined,
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
              {articleToEdit
                ? 'Modifier la fiche Catalogue'
                : 'Ajouter une référence au Catalogue'}
            </h2>
            <p className="text-xs text-slate-300">
              {catalogOnlyMode
                ? 'Référence, Désignation, Description, Équivalences & Seuil minimum (les stocks et prix se gèrent dans Stock & Dépôts)'
                : 'Fiche article maître & gestion multi-marques / constructeurs'}
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

          {/* Section 1: Identification principale Catalogue */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
              <span>Informations du Catalogue</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Référence *
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
                  {ARTICLE_CATEGORY_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Désignation *
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

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Filtre primaire haute efficacité pour moteurs C9 / C15"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
              />
            </div>

            {/* Équivalences Cross-Ref */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Équivalences / Cross-ref (Donaldson, Baldwin, Fleetguard, Mann, etc.)
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

            {/* Where Used (Caterpillar SIS 2.0) - Applications Engins */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                  <Tractor className="w-4 h-4 text-amber-500" />
                  <span>Where Used (SIS 2.0) — Engins Compatibles ({machineApplications.length})</span>
                </label>
                <span className="text-[11px] text-slate-400">Famille, Sous-famille, Modèle de vente, Préfixe</span>
              </div>

              {/* Input fields */}
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                <input
                  type="text"
                  value={appFamily}
                  onChange={(e) => setAppFamily(e.target.value)}
                  placeholder="Famille (ex: EXCAVATOR)"
                  className="px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={appSubFamily}
                  onChange={(e) => setAppSubFamily(e.target.value)}
                  placeholder="Sous-famille (ex: 320)"
                  className="px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={appModel}
                  onChange={(e) => setAppModel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddApp();
                    }
                  }}
                  placeholder="Modèle * (ex: 320D)"
                  className="px-2.5 py-1.5 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg bg-white"
                />
                <input
                  type="text"
                  value={appPrefix}
                  onChange={(e) => setAppPrefix(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddApp();
                    }
                  }}
                  placeholder="Préfixe (ex: FAL)"
                  className="px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg bg-white"
                />
                <button
                  type="button"
                  onClick={handleAddApp}
                  className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg inline-flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter</span>
                </button>
              </div>

              {/* List of Applications */}
              {machineApplications.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {machineApplications.map((app) => (
                    <span
                      key={app.id}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-md text-xs font-medium text-slate-800 shadow-2xs"
                    >
                      {app.productFamily && (
                        <span className="text-[10px] text-slate-500 uppercase font-mono">{app.productFamily} ·</span>
                      )}
                      <strong className="font-mono text-slate-950 font-bold">{app.model}</strong>
                      {app.serialPrefix && (
                        <span className="px-1 py-0.2 bg-amber-100 text-amber-900 border border-amber-200 rounded text-[10px] font-mono font-bold">
                          {app.serialPrefix}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleRemoveApp(app.id)}
                        className="text-slate-400 hover:text-rose-600 ml-0.5 cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-200/80">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Seuil minimum *
                </label>
                <NumericInput
                  min={0}
                  value={minStockThreshold}
                  onChange={(val) => setMinStockThreshold(Math.max(0, Math.floor(val)))}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Only shown if not catalogOnlyMode */}
          {!catalogOnlyMode && (
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
                    Définissez les différentes marques (Caterpillar, CTP, ITR...) avec leurs emplacements, factures et tarifs respectifs.
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
                      className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs transition-all space-y-2"
                    >
                      {brandOffers.length > 1 && (
                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => handleRemoveBrandOffer(offer.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                            title="Supprimer cette offre de marque"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Marque (facultative)
                          </label>
                          <input
                            type="text"
                            value={offer.brand}
                            onChange={(e) => handleUpdateBrandOffer(offer.id, { brand: e.target.value })}
                            placeholder="Optionnel (ex: CAT, Donaldson...)"
                            className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Emplacement
                          </label>
                          <input
                            type="text"
                            value={offer.location || ''}
                            onChange={(e) =>
                              handleUpdateBrandOffer(offer.id, { location: e.target.value })
                            }
                            placeholder="Ex: Allée A - R1"
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            N° Facture commande
                          </label>
                          <input
                            type="text"
                            value={offer.invoiceNumber || ''}
                            onChange={(e) =>
                              handleUpdateBrandOffer(offer.id, { invoiceNumber: e.target.value })
                            }
                            placeholder="Ex: FAC-2025-001"
                            className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Prix Achat Unit.
                          </label>
                          <NumericInput
                            min={0}
                            step={100}
                            value={offer.purchasePrice}
                            onChange={(val) => handleUpdateBrandOffer(offer.id, { purchasePrice: val })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                            Prix Vente Unit.
                          </label>
                          <NumericInput
                            min={0}
                            step={100}
                            value={offer.salePrice}
                            onChange={(val) => handleUpdateBrandOffer(offer.id, { salePrice: val })}
                            placeholder="0"
                            className="w-full px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-700 border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
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
          )}

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
