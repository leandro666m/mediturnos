import React, { useRef, useState } from 'react';
import { User, MapPin, CreditCard, Shield, X, Plus, Trash2, Check, Camera, UploadCloud, Image as ImageIcon } from 'lucide-react';
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
  const [fotoPerfil, setFotoPerfil] = useState<string>(professional.fotoPerfil || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSubirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      alert('La imagen no debe superar los 3 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setFotoPerfil(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleQuitarFoto = () => {
    setFotoPerfil('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
      fotoPerfil: fotoPerfil || undefined,
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
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* FOTO DE PERFIL DEL PROFESIONAL */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
            <label className="block font-bold text-slate-800 mb-2">Foto de Perfil Profesional</label>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Vista previa del avatar */}
              <div className="relative group shrink-0">
                <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-md flex items-center justify-center text-slate-500">
                  {fotoPerfil ? (
                    <img
                      src={fotoPerfil}
                      alt="Foto de perfil"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-sky-600 to-teal-500 text-white flex items-center justify-center text-2xl font-bold">
                      {nombre.charAt(0) || 'D'}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute -bottom-1.5 -right-1.5 p-1.5 bg-sky-600 text-white rounded-xl shadow-md hover:bg-sky-700 transition-colors cursor-pointer"
                  title="Cambiar foto"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Botones y explicaciones */}
              <div className="flex-1 text-center sm:text-left">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleSubirFoto}
                  accept="image/*"
                  className="hidden"
                />
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <UploadCloud className="w-3.5 h-3.5 text-sky-600" />
                    <span>{fotoPerfil ? 'Reemplazar foto' : 'Subir foto'}</span>
                  </button>

                  {fotoPerfil && (
                    <button
                      type="button"
                      onClick={handleQuitarFoto}
                      className="px-2.5 py-1.5 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 rounded-xl font-semibold flex items-center gap-1 cursor-pointer"
                      title="Eliminar foto de perfil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Quitar</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight">
                  Esta foto se mostrará a tus pacientes en el <strong>Portal Paciente</strong> y en la cabecera de tu agenda. Formato JPG, PNG o WebP (máx. 3 MB).
                </p>
              </div>
            </div>
          </div>
          
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
