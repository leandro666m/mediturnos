import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  MapPin,
  CreditCard,
  Shield,
  X,
  Plus,
  Trash2,
  Check,
  Camera,
  UploadCloud,
  Image as ImageIcon,
  Type,
  Edit2,
  AlertCircle,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { FontSizePreference, Location } from '../../types';

interface PerfilModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PerfilModal: React.FC<PerfilModalProps> = ({ isOpen, onClose }) => {
  const { professional, locations, updateProfessional, updateLocations } = useApp();

  const [nombre, setNombre] = useState(professional.nombre);
  const [titulo, setTitulo] = useState(professional.titulo);
  const [especialidad, setEspecialidad] = useState(professional.especialidad);
  const [mn, setMn] = useState(professional.matriculaNacional);
  const [mp, setMp] = useState(professional.matriculaProvincial);
  const [alias, setAlias] = useState(professional.aliasCobro);
  const [titular, setTitular] = useState(professional.titularCobro);
  const [slug, setSlug] = useState(professional.slug);
  const [fotoPerfil, setFotoPerfil] = useState<string>(professional.fotoPerfil || '');
  const [tamanoTexto, setTamanoTextoState] = useState<FontSizePreference>(professional.tamanoTexto || 'predeterminado');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estados para el ABM de direcciones (Ubicaciones)
  const [listaLocations, setListaLocations] = useState<Location[]>(locations);
  const [modoEdicionLocId, setModoEdicionLocId] = useState<string | null>(null); // 'nueva' o id de la location
  const [locNombre, setLocNombre] = useState('');
  const [locDireccion, setLocDireccion] = useState('');
  const [locIndicaciones, setLocIndicaciones] = useState('');
  const [locMapsUrl, setLocMapsUrl] = useState('');
  const [locActiva, setLocActiva] = useState(true);
  const [locError, setLocError] = useState('');
  const [locAEliminarId, setLocAEliminarId] = useState<string | null>(null);
  const [locFeedback, setLocFeedback] = useState<string | null>(null);

  // Sincronizar lista si locations cambia externamente
  useEffect(() => {
    setListaLocations(locations);
  }, [locations]);

  if (!isOpen) return null;

  const handleSubirFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLocError('Por favor selecciona un archivo de imagen válido (JPG, PNG, WebP).');
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setLocError('La imagen no debe superar los 3 MB.');
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

  const handleSeleccionarTamano = (size: FontSizePreference) => {
    setTamanoTextoState(size);
    // Previsualización inmediata en tiempo real para el profesional
    document.documentElement.setAttribute('data-text-size', size);
  };

  // Handlers para el ABM de direcciones
  const handleAbrirAltaLoc = () => {
    setModoEdicionLocId('nueva');
    setLocNombre('');
    setLocDireccion('');
    setLocIndicaciones('');
    setLocMapsUrl('');
    setLocActiva(true);
    setLocError('');
    setLocAEliminarId(null);
  };

  const handleAbrirEdicionLoc = (loc: Location) => {
    setModoEdicionLocId(loc.id);
    setLocNombre(loc.nombre);
    setLocDireccion(loc.direccion);
    setLocIndicaciones(loc.indicaciones || '');
    setLocMapsUrl(loc.mapsUrl || '');
    setLocActiva(loc.activa);
    setLocError('');
    setLocAEliminarId(null);
  };

  const handleCerrarFormLoc = () => {
    setModoEdicionLocId(null);
    setLocNombre('');
    setLocDireccion('');
    setLocIndicaciones('');
    setLocMapsUrl('');
    setLocError('');
  };

  const handleGuardarLoc = () => {
    if (!locNombre.trim()) {
      setLocError('Ingresá un nombre identificatorio para el consultorio o sede.');
      return;
    }
    if (!locDireccion.trim()) {
      setLocError('Ingresá la dirección física completa.');
      return;
    }

    const mapsUrlLimpio = locMapsUrl.trim() || undefined;

    if (modoEdicionLocId === 'nueva') {
      const nueva: Location = {
        id: `loc-${Date.now()}`,
        nombre: locNombre.trim(),
        direccion: locDireccion.trim(),
        indicaciones: locIndicaciones.trim() || undefined,
        mapsUrl: mapsUrlLimpio,
        activa: locActiva,
      };
      const actualizadas = [...listaLocations, nueva];
      setListaLocations(actualizadas);
      updateLocations(actualizadas);
      setLocFeedback(`Dirección "${nueva.nombre}" agregada.`);
      setTimeout(() => setLocFeedback(null), 3000);
    } else {
      const actualizadas = listaLocations.map(l =>
        l.id === modoEdicionLocId
          ? {
              ...l,
              nombre: locNombre.trim(),
              direccion: locDireccion.trim(),
              indicaciones: locIndicaciones.trim() || undefined,
              mapsUrl: mapsUrlLimpio,
              activa: locActiva,
            }
          : l
      );
      setListaLocations(actualizadas);
      updateLocations(actualizadas);
      setLocFeedback(`Dirección "${locNombre.trim()}" actualizada.`);
      setTimeout(() => setLocFeedback(null), 3000);
    }

    handleCerrarFormLoc();
  };

  const handleEliminarLoc = (id: string) => {
    const locEliminada = listaLocations.find(l => l.id === id);
    const actualizadas = listaLocations.filter(l => l.id !== id);
    setListaLocations(actualizadas);
    updateLocations(actualizadas);
    if (modoEdicionLocId === id) {
      handleCerrarFormLoc();
    }
    setLocAEliminarId(null);
    setLocFeedback(`Dirección ${locEliminada ? `"${locEliminada.nombre}" ` : ''}eliminada.`);
    setTimeout(() => setLocFeedback(null), 3000);
  };

  const handleToggleActivaLoc = (id: string) => {
    const actualizadas = listaLocations.map(l =>
      l.id === id ? { ...l, activa: !l.activa } : l
    );
    setListaLocations(actualizadas);
    updateLocations(actualizadas);
  };

  const handleCancelar = () => {
    // Si cancela, restauramos el tamaño original del profesional y cerramos subformularios
    document.documentElement.setAttribute('data-text-size', professional.tamanoTexto || 'predeterminado');
    handleCerrarFormLoc();
    onClose();
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
      tamanoTexto,
    });
    updateLocations(listaLocations);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        
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
            onClick={handleCancelar}
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

          {/* ABM DE DIRECCIONES DE ATENCIÓN (Ubicación donde atiende el profesional) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-sky-600" />
                <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                  Direcciones de Atención (Consultorios y Sedes)
                </h4>
              </div>
              {modoEdicionLocId === null && (
                <button
                  type="button"
                  onClick={handleAbrirAltaLoc}
                  className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva dirección</span>
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              Administrá los consultorios o sedes físicas donde atendés. Se mostrarán en la cabecera de tu agenda, en el Portal Paciente y en los mensajes con las indicaciones para llegar.
            </p>

            {locFeedback && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-[11px] font-semibold flex items-center gap-2 mb-3">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{locFeedback}</span>
              </div>
            )}

            {/* Formulario de Alta / Modificación */}
            {modoEdicionLocId !== null && (
              <div className="p-3.5 bg-sky-50/70 border border-sky-200 rounded-2xl mb-3 space-y-3 transition-all">
                <div className="flex items-center justify-between border-b border-sky-100 pb-2">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-sky-600" />
                    <span>
                      {modoEdicionLocId === 'nueva'
                        ? 'Agregar Nueva Dirección'
                        : 'Modificar Dirección de Atención'}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCerrarFormLoc}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Cerrar formulario"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {locError && (
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{locError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Nombre del consultorio o sede *
                    </label>
                    <input
                      type="text"
                      value={locNombre}
                      onChange={e => {
                        setLocNombre(e.target.value);
                        if (locError) setLocError('');
                      }}
                      placeholder="ej. Consultorio Belgrano (CABA)"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-600 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                      Dirección física completa *
                    </label>
                    <input
                      type="text"
                      value={locDireccion}
                      onChange={e => {
                        setLocDireccion(e.target.value);
                        if (locError) setLocError('');
                      }}
                      placeholder="ej. Av. Cabildo 2450, Piso 4 Of. B"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-600 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 text-[11px]">
                    Indicaciones de acceso o transporte (opcional)
                  </label>
                  <input
                    type="text"
                    value={locIndicaciones}
                    onChange={e => setLocIndicaciones(e.target.value)}
                    placeholder="ej. Timbre 4B. A 100m de Subte D. Estacionamiento en esquina."
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-600 text-xs"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700 text-[11px]">
                      Link de Google Maps (opcional)
                    </label>
                    {locMapsUrl.trim() && (
                      <a
                        href={locMapsUrl.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Probar enlace</span>
                      </a>
                    )}
                  </div>
                  <div className="relative">
                    <input
                      type="url"
                      value={locMapsUrl}
                      onChange={e => setLocMapsUrl(e.target.value)}
                      placeholder="ej. https://maps.app.goo.gl/... o https://goo.gl/maps/..."
                      className="w-full p-2 pl-8 bg-white border border-slate-200 rounded-lg outline-none focus:border-sky-600 text-xs font-mono"
                    />
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Pegá el enlace directo para que tus pacientes puedan abrir la ubicación en Google Maps desde el portal y desde el WhatsApp de confirmación.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-sky-100">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={locActiva}
                      onChange={e => setLocActiva(e.target.checked)}
                      className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
                    />
                    <span>Ubicación activa (visible para pacientes y turnos presenciales)</span>
                  </label>

                  <div className="flex items-center gap-2 justify-end">
                    {modoEdicionLocId !== 'nueva' && (
                      <button
                        type="button"
                        onClick={() => handleEliminarLoc(modoEdicionLocId)}
                        className="px-2.5 py-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer mr-auto"
                        title="Eliminar esta dirección"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Eliminar dirección</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleCerrarFormLoc}
                      className="px-2.5 py-1.5 text-slate-600 hover:bg-slate-200/60 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleGuardarLoc}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{modoEdicionLocId === 'nueva' ? 'Guardar dirección' : 'Actualizar'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de direcciones existentes */}
            <div className="space-y-2">
              {listaLocations.length === 0 ? (
                <div className="p-4 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400">
                  <MapPin className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                  <p className="text-xs font-medium">No tenés direcciones registradas aún.</p>
                  <button
                    type="button"
                    onClick={handleAbrirAltaLoc}
                    className="mt-2 text-xs font-bold text-sky-600 hover:text-sky-700 underline cursor-pointer"
                  >
                    + Agregar primera dirección
                  </button>
                </div>
              ) : (
                listaLocations.map(loc => (
                  <div
                    key={loc.id}
                    className={`p-3 rounded-2xl border transition-all ${
                      loc.activa
                        ? 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                        : 'border-slate-200 bg-slate-50/70 opacity-75'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">
                            {loc.nombre}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              loc.activa
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}
                          >
                            {loc.activa ? 'Activa' : 'Pausada'}
                          </span>
                        </div>

                        <div className="flex items-start gap-1.5 text-xs text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                          <span className="break-words">{loc.direccion}</span>
                        </div>

                        {loc.indicaciones && (
                          <div className="text-[11px] text-slate-500 mt-1 pl-5 italic">
                            Indicaciones: {loc.indicaciones}
                          </div>
                        )}

                        {loc.mapsUrl && (
                          <div className="mt-1 pl-5">
                            <a
                              href={loc.mapsUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700 hover:underline"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>Ver en Google Maps</span>
                            </a>
                          </div>
                        )}
                      </div>

                      {/* Botones de acción del ABM */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-end">
                        <button
                          type="button"
                          onClick={() => handleToggleActivaLoc(loc.id)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer ${
                            loc.activa
                              ? 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}
                          title={loc.activa ? 'Pausar esta ubicación' : 'Activar esta ubicación'}
                        >
                          {loc.activa ? 'Pausar' : 'Activar'}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAbrirEdicionLoc(loc)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                          title="Modificar dirección"
                        >
                          <Edit2 className="w-3 h-3 text-slate-500" />
                          <span>Editar</span>
                        </button>

                        {locAEliminarId === loc.id ? (
                          <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg">
                            <span className="text-[10px] font-bold text-rose-700">¿Eliminar?</span>
                            <button
                              type="button"
                              onClick={() => handleEliminarLoc(loc.id)}
                              className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setLocAEliminarId(null)}
                              className="px-1.5 py-0.5 text-slate-500 hover:text-slate-700 rounded text-[10px] font-medium cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setLocAEliminarId(loc.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar dirección"
                            aria-label="Eliminar dirección"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
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

          {/* SELECTOR DE TAMAÑO DE TEXTO (Regla del usuario: mínimo = actual, predeterminado = un poco más grande, grande = ampliado) */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5">
                <Type className="w-4 h-4 text-sky-600" />
                <h4 className="font-bold text-slate-900">Tamaño del Texto</h4>
              </div>
              <span className="text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-lg border border-sky-100">
                {tamanoTexto === 'minimo' && 'Tamaño: Compacto (Mínimo)'}
                {tamanoTexto === 'predeterminado' && 'Tamaño: Estándar (Predeterminado)'}
                {tamanoTexto === 'grande' && 'Tamaño: Grande (Ampliado)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Opción 1: Mínimo (Tamaño original compacto) */}
              <button
                type="button"
                onClick={() => handleSeleccionarTamano('minimo')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  tamanoTexto === 'minimo'
                    ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-black text-xs">
                      A
                    </span>
                    <span>Compacto</span>
                  </span>
                  {tamanoTexto === 'minimo' && (
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  Tamaño mínimo original. Máxima densidad de turnos por pantalla.
                </div>
              </button>

              {/* Opción 2: Predeterminado (Un poco más grande, recomendado) */}
              <button
                type="button"
                onClick={() => handleSeleccionarTamano('predeterminado')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  tamanoTexto === 'predeterminado'
                    ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center font-black text-sm">
                      A
                    </span>
                    <span>Estándar</span>
                  </span>
                  {tamanoTexto === 'predeterminado' && (
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  <span className="font-semibold text-sky-700">Predeterminado</span>. Un poco más grande, lectura descansada.
                </div>
              </button>

              {/* Opción 3: Grande (Más grande aún, ideal tablets / celular) */}
              <button
                type="button"
                onClick={() => handleSeleccionarTamano('grande')}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative ${
                  tamanoTexto === 'grande'
                    ? 'border-sky-600 bg-sky-50/70 ring-2 ring-sky-600/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-sky-100 text-sky-800 flex items-center justify-center font-black text-base">
                      A
                    </span>
                    <span>Grande</span>
                  </span>
                  {tamanoTexto === 'grande' && (
                    <span className="w-4 h-4 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] font-bold">
                      ✓
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">
                  Tamaño ampliado. Alta legibilidad para tablet, móvil o visión relajada.
                </div>
              </button>
            </div>
          </div>

          {/* Aviso Hito 2 (Google Drive / Sheets) preparado */}
          <div className="p-3 bg-sky-50 rounded-xl border border-sky-100 text-[11px] text-sky-900">
            <strong>Sincronización con Google Drive (Hito 2):</strong> Modelo y rutas preparadas para respaldo espejo de fichas clínicas y exportación a Google Sheets.
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCancelar}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 shadow-xs cursor-pointer"
            >
              Guardar Cambios
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
