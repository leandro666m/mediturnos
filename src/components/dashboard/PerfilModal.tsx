import React, { useState } from 'react';
import { User, MapPin, CreditCard, Shield, X, Plus, Trash2, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Location } from '../../types';

interface PerfilModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerfilModal: React.FC<PerfilModalProps> = ({ isOpen, onClose }) => {
  const { professional, locations, updateProfessional } = useApp();

  const [nombre, setNombre] = useState(professional.nombre);
  const [titulo, setTitulo] = useState(professional.titulo);
  const [especialidad, setEspecialidad] = useState(professional.especialidad);
  const [mn, setMn] = useState(professional.matriculaNacional);
  const [mp, setMp] = useState(professional.matriculaProvincial);
  const [alias, setAlias] = useState(professional.aliasCobro);
  const [titular, setTitular] = useState(professional.titularCobro);
  const [slug, setSlug] = useState(professional.slug);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfessional({
      nombre,
      titulo,
      especialidad,
      matriculaNacional: mn,
      matriculaProvincial: mp,
      aliasCobro: alias,
      titularCobro: titular,
      slug: slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-'),
    });
    alert('Perfil profesional actualizado.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900">Perfil del Profesional</h3>
              <p className="text-xs text-slate-500">Datos visibles para pacientes y plantillas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                placeholder="Lic. / Dr. / Dra."
                className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Nombre y Apellido</label>
              <input
                type="text"
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Especialidad</label>
            <input
              type="text"
              value={especialidad}
              onChange={e => setEspecialidad(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Matrícula Nacional (M.N.)</label>
              <input
                type="text"
                value={mn}
                onChange={e => setMn(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600 tabular-nums"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Matrícula Provincial (M.P.)</label>
              <input
                type="text"
                value={mp}
                onChange={e => setMp(e.target.value)}
                className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600 tabular-nums"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>Datos de Cobro (se insertan en WhatsApp)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alias de Cobro / CBU</label>
                <input
                  type="text"
                  value={alias}
                  onChange={e => setAlias(e.target.value)}
                  placeholder="ej. martin.kine.mp"
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600 font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Titular de la cuenta</label>
                <input
                  type="text"
                  value={titular}
                  onChange={e => setTitular(e.target.value)}
                  placeholder="Nombre y Apellido"
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100">
            <h4 className="font-bold text-slate-900 mb-1">Enlace público de reserva</h4>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono">mediturnos.app/</span>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                className="p-2 border border-slate-200 rounded-lg flex-1 outline-none font-mono focus:border-sky-600"
              />
            </div>
          </div>

          {/* Aviso Hito 2 (Google Drive / Sheets) preparado */}
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-[11px] text-sky-900">
            <strong>Sincronización con Google Drive (Hito 2):</strong> Modelo y rutas preparadas para respaldo espejo de fichas clínicas y exportación a Google Sheets.
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 shadow-xs"
            >
              Guardar Cambios
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
