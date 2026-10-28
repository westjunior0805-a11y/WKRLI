import React, { useState, useEffect } from 'react';
import { Warehouse } from '../../types';
import { X } from 'lucide-react';

interface WarehouseFormModalProps {
  isOpen: boolean;
  warehouseToEdit?: Warehouse | null;
  onClose: () => void;
  onSubmit: (warehouseData: Omit<Warehouse, 'id'>) => { success: boolean; error?: string };
}

export const WarehouseFormModal: React.FC<WarehouseFormModalProps> = ({
  isOpen,
  warehouseToEdit,
  onClose,
  onSubmit,
}) => {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [manager, setManager] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (warehouseToEdit) {
      setCode(warehouseToEdit.code);
      setName(warehouseToEdit.name);
      setLocation(warehouseToEdit.location);
      setPhone(warehouseToEdit.phone);
      setManager(warehouseToEdit.manager);
      setIsActive(warehouseToEdit.isActive);
      setIsDefault(warehouseToEdit.isDefault);
      setNotes(warehouseToEdit.notes || '');
    } else {
      setCode('');
      setName('');
      setLocation('');
      setPhone('');
      setManager('');
      setIsActive(true);
      setIsDefault(false);
      setNotes('');
    }
    setErrorMessage('');
  }, [warehouseToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!code.trim()) {
      setErrorMessage('Le code du magasin est obligatoire (ex: MAG-DKR-01).');
      return;
    }
    if (!name.trim()) {
      setErrorMessage('Le nom du magasin est obligatoire.');
      return;
    }

    const result = onSubmit({
      code: code.trim().toUpperCase(),
      name: name.trim(),
      location: location.trim(),
      phone: phone.trim(),
      manager: manager.trim(),
      isActive,
      isDefault,
      notes: notes.trim() || undefined,
    });

    if (!result.success) {
      setErrorMessage(result.error || 'Erreur lors de l’enregistrement du magasin.');
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              {warehouseToEdit ? 'Modifier le magasin' : 'Nouveau magasin de stockage'}
            </h2>
            <p className="text-xs text-slate-300">
              Gestion des entrepôts et dépôts régionaux
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {errorMessage}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Code Magasin *
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ex: MAG-DKR-01"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Responsable de site
              </label>
              <input
                type="text"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder="Ex: Mamadou Diop"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Nom du Magasin / Entrepôt *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Entrepôt Central Dakar Port"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Localisation géographique
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Ex: Zone Industrielle Bel-Air, Dakar"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Téléphone de contact
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex: +221 33 849 20 10"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
              Notes & Description d'exploitation
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Usage spécifique (chantiers, engins ciblés)..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
            />
          </div>

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
              {warehouseToEdit ? 'Enregistrer' : 'Créer le magasin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
