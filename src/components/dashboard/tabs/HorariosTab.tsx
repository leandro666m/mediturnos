import React, { useRef, useState } from 'react';
import {
  Clock,
  Calendar,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Check,
  MapPin,
  Video,
  Send,
  Eye,
  ShieldAlert,
  Sparkles,
  X,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Holiday, Modalidad, ModalidadFranja, Service, WorkingHours } from '../../../types';
import { formatearFechaLarga, formatearMoneda } from '../../../modules/format';
import { construirEnlaceWhatsApp, resolverPlantillaMensaje } from '../../../modules/messaging';

export const HorariosTab: React.FC = () => {
  const {
    professional,
    workingHours,
    services,
    holidays,
    templates,
    locations,
    updateWorkingHours,
    updateServices,
    updateTemplates,
    updateProfessional,
    toggleHolidayLaborable,
    updateHolidays,
  } = useApp();

  const [subTab, setSubTab] = useState<'horarios' | 'parametros' | 'servicios' | 'whatsapp' | 'feriados'>('horarios');

  // Parámetros Globales locales
  const [grillaMin, setGrillaMin] = useState(professional.parametros.grillaMin);
  const [anticipacionHoras, setAnticipacionHoras] = useState(professional.parametros.anticipacionMinHoras);
  const [horizonteDias, setHorizonteDias] = useState(professional.parametros.horizonteDias);
  const [margenMin, setMargenMin] = useState(professional.parametros.margenMin);
  const [quietInicio, setQuietInicio] = useState(professional.parametros.quietHoursInicio);
  const [quietFin, setQuietFin] = useState(professional.parametros.quietHoursFin);

  // Servicios
  const [modalServicio, setModalServicio] = useState<Partial<Service> | null>(null);

  // WhatsApp Templates
  const [tplConfirmacion, setTplConfirmacion] = useState(() => {
    return templates.find(t => t.tipo === 'confirmacion')?.cuerpo || '';
  });
  const [tplRecordatorio, setTplRecordatorio] = useState(() => {
    return templates.find(t => t.tipo === 'recordatorio')?.cuerpo || '';
  });
  const [bloquePresencial, setBloquePresencial] = useState(() => {
    return templates.find(t => t.tipo === 'confirmacion')?.bloquePresencial || '';
  });
  const [bloqueVideollamada, setBloqueVideollamada] = useState(() => {
    return templates.find(t => t.tipo === 'confirmacion')?.bloqueVideollamada || '';
  });

  // Feriados Nacionales y Asuetos
  const [filtroFeriado, setFiltroFeriado] = useState<'todos' | 'laborables' | 'no_laborables'>('todos');
  const [modalNuevoFeriado, setModalNuevoFeriado] = useState(false);
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState('');
  const [nuevoFeriadoNombre, setNuevoFeriadoNombre] = useState('');
  const [nuevoFeriadoLaborable, setNuevoFeriadoLaborable] = useState(false);
  const [errorNuevoFeriado, setErrorNuevoFeriado] = useState('');

  const handleCrearFeriadoPersonalizado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoFeriadoFecha || !nuevoFeriadoNombre.trim()) {
      setErrorNuevoFeriado('Ingresá la fecha y el nombre del feriado o asueto.');
      return;
    }
    const nuevo: Holiday = {
      id: 'hol_custom_' + Math.random().toString(36).slice(2, 8),
      fecha: nuevoFeriadoFecha,
      nombre: nuevoFeriadoNombre.trim(),
      laborable: nuevoFeriadoLaborable,
    };
    updateHolidays([...holidays, nuevo]);
    setModalNuevoFeriado(false);
    setNuevoFeriadoFecha('');
    setNuevoFeriadoNombre('');
    setNuevoFeriadoLaborable(false);
    setErrorNuevoFeriado('');
  };

  // Referencias a los cuadros de texto para inserción exacta en el cursor
  const textareaConfirmacionRef = useRef<HTMLTextAreaElement>(null);
  const textareaRecordatorioRef = useRef<HTMLTextAreaElement>(null);

  const insertarVariableEnCursor = (
    textarea: HTMLTextAreaElement | null,
    textoActual: string,
    setTexto: (nuevo: string) => void,
    variable: string
  ) => {
    if (!textarea) {
      setTexto(textoActual + variable);
      return;
    }

    const start = textarea.selectionStart ?? textoActual.length;
    const end = textarea.selectionEnd ?? textoActual.length;

    const nuevoTexto =
      textoActual.substring(0, start) +
      variable +
      textoActual.substring(end);

    setTexto(nuevoTexto);

    requestAnimationFrame(() => {
      textarea.focus();
      const nuevaPos = start + variable.length;
      textarea.setSelectionRange(nuevaPos, nuevaPos);
    });
  };

  const DIAS = [
    { num: 1, nombre: 'Lunes' },
    { num: 2, nombre: 'Martes' },
    { num: 3, nombre: 'Miércoles' },
    { num: 4, nombre: 'Jueves' },
    { num: 5, nombre: 'Viernes' },
    { num: 6, nombre: 'Sábado' },
    { num: 7, nombre: 'Domingo' },
  ];

  // Actualizar franja horaria
  const handleToggleDiaActivo = (diaNum: number) => {
    const franjas = workingHours.filter(wh => wh.diaSemana === diaNum);
    if (franjas.length > 0) {
      const nuevoEstado = !franjas[0].activo;
      const actualizadas = workingHours.map(wh =>
        wh.diaSemana === diaNum ? { ...wh, activo: nuevoEstado } : wh
      );
      updateWorkingHours(actualizadas);
    } else {
      // Crear nueva franja para el día
      const nueva: WorkingHours = {
        id: 'wh_' + Math.random().toString(36).slice(2, 8),
        diaSemana: diaNum,
        horaInicio: '09:00',
        horaFin: '18:00',
        modalidad: 'presencial',
        descansos: [{ inicio: '13:00', fin: '14:00' }],
        activo: true,
      };
      updateWorkingHours([...workingHours, nueva]);
    }
  };

  const handleUpdateFranja = (id: string, campo: keyof WorkingHours, valor: any) => {
    const actualizadas = workingHours.map(wh => (wh.id === id ? { ...wh, [campo]: valor } : wh));
    updateWorkingHours(actualizadas);
  };

  const handleGuardarParametros = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfessional({
      parametros: {
        ...professional.parametros,
        grillaMin,
        anticipacionMinHoras: anticipacionHoras,
        horizonteDias,
        margenMin,
        quietHoursInicio: quietInicio,
        quietHoursFin: quietFin,
      },
    });
    alert('Parámetros globales guardados.');
  };

  const handleGuardarPlantillas = () => {
    const actualizadas = templates.map(t => {
      if (t.tipo === 'confirmacion') {
        return {
          ...t,
          cuerpo: tplConfirmacion,
          bloquePresencial,
          bloqueVideollamada,
        };
      }
      if (t.tipo === 'recordatorio') {
        return {
          ...t,
          cuerpo: tplRecordatorio,
          bloquePresencial,
          bloqueVideollamada,
        };
      }
      return t;
    });
    updateTemplates(actualizadas);
    alert('Plantillas de WhatsApp guardadas con éxito.');
  };

  // Previsualización de WhatsApp con datos de ejemplo
  const vistaPreviaConfirmacionPresencial = resolverPlantillaMensaje(
    tplConfirmacion,
    bloquePresencial,
    bloqueVideollamada,
    {
      paciente: 'Florencia Gómez',
      profesional: `${professional.titulo} ${professional.nombre}`,
      fecha: 'Jueves 15 de octubre',
      hora: '10:00 hs',
      servicio: 'Consulta Kinefiátrica Inicial',
      valor: '$28.000',
      alias: professional.aliasCobro,
      direccion: locations[0]?.direccion,
      modalidad: 'presencial',
    }
  );

  const vistaPreviaConfirmacionVirtual = resolverPlantillaMensaje(
    tplConfirmacion,
    bloquePresencial,
    bloqueVideollamada,
    {
      paciente: 'Carlos Bianchi',
      profesional: `${professional.titulo} ${professional.nombre}`,
      fecha: 'Viernes 16 de octubre',
      hora: '17:30 hs',
      servicio: 'Teleconsulta de Seguimiento',
      valor: '$19.000',
      alias: professional.aliasCobro,
      modalidad: 'videollamada',
    }
  );

  const vistaPreviaRecordatorioPresencial = resolverPlantillaMensaje(
    tplRecordatorio,
    bloquePresencial,
    bloqueVideollamada,
    {
      paciente: 'Florencia Gómez',
      profesional: `${professional.titulo} ${professional.nombre}`,
      fecha: 'Jueves 15 de octubre',
      hora: '10:00 hs',
      servicio: 'Consulta Kinefiátrica Inicial',
      valor: '$28.000',
      alias: professional.aliasCobro,
      direccion: locations[0]?.direccion,
      modalidad: 'presencial',
    }
  );

  const vistaPreviaRecordatorioVirtual = resolverPlantillaMensaje(
    tplRecordatorio,
    bloquePresencial,
    bloqueVideollamada,
    {
      paciente: 'Carlos Bianchi',
      profesional: `${professional.titulo} ${professional.nombre}`,
      fecha: 'Viernes 16 de octubre',
      hora: '17:30 hs',
      servicio: 'Teleconsulta de Seguimiento',
      valor: '$19.000',
      alias: professional.aliasCobro,
      modalidad: 'videollamada',
    }
  );

  return (
    <div className="space-y-6">
      
      {/* Subpestañas */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-fit">
        <button
          onClick={() => setSubTab('horarios')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'horarios' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Días y Horarios
        </button>
        <button
          onClick={() => setSubTab('servicios')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'servicios' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Servicios y Precios
        </button>
        <button
          onClick={() => setSubTab('whatsapp')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'whatsapp' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Mensajes WhatsApp
        </button>
        <button
          onClick={() => setSubTab('parametros')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'parametros' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Parámetros Globales
        </button>
        <button
          onClick={() => setSubTab('feriados')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            subTab === 'feriados' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Feriados Nacionales
        </button>
      </div>

      {/* =========================================================
          SUBPESTAÑA 1: DÍAS Y HORARIOS (Regla 1.9 A)
         ========================================================= */}
      {subTab === 'horarios' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Esquema Semanal de Atención
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configurá las franjas de cada día y su modalidad obligatoria (Presencial, Videollamada o Ambas).
            </p>

            <div className="space-y-3">
              {DIAS.map(d => {
                const franjasDia = workingHours.filter(wh => wh.diaSemana === d.num);
                const diaActivo = franjasDia.length > 0 && franjasDia[0].activo;

                return (
                  <div
                    key={d.num}
                    className={`p-4 rounded-xl border transition-all ${
                      diaActivo ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-900 min-w-[100px]">
                          <input
                            type="checkbox"
                            checked={diaActivo}
                            onChange={() => handleToggleDiaActivo(d.num)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span>{d.nombre}</span>
                        </label>

                        {!diaActivo && (
                          <span className="text-xs text-slate-400 font-medium">
                            No atiende este día
                          </span>
                        )}
                      </div>

                      {diaActivo && (
                        <div className="flex flex-wrap items-center gap-3">
                          {franjasDia.map(franja => (
                            <div key={franja.id} className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="text-slate-500 font-medium">Horario:</span>
                              <input
                                type="time"
                                value={franja.horaInicio}
                                onChange={e => handleUpdateFranja(franja.id, 'horaInicio', e.target.value)}
                                className="border border-slate-200 rounded p-1 text-xs"
                              />
                              <span className="text-slate-400">a</span>
                              <input
                                type="time"
                                value={franja.horaFin}
                                onChange={e => handleUpdateFranja(franja.id, 'horaFin', e.target.value)}
                                className="border border-slate-200 rounded p-1 text-xs"
                              />

                              <span className="text-slate-400">|</span>

                              {/* Modalidad obligatoria por franja (D-18) */}
                              <span className="text-slate-500 font-medium">Modalidad:</span>
                              <select
                                value={franja.modalidad}
                                onChange={e =>
                                  handleUpdateFranja(franja.id, 'modalidad', e.target.value as ModalidadFranja)
                                }
                                className="border border-slate-200 rounded p-1 text-xs bg-white font-semibold text-slate-800"
                              >
                                <option value="presencial">Solo Presencial</option>
                                <option value="videollamada">Solo Videollamada</option>
                                <option value="ambas">Ambas modalidades</option>
                              </select>

                              {/* Descanso */}
                              {franja.descansos.length > 0 && (
                                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  Almuerzo {franja.descansos[0].inicio} a {franja.descansos[0].fin}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUBPESTAÑA 2: SERVICIOS Y PRECIOS (Regla 1.9 D)
         ========================================================= */}
      {subTab === 'servicios' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Servicios y Aranceles Profesionales
                </h3>
                <p className="text-xs text-slate-500">
                  Definí las prestaciones, duración y precios visibles a los pacientes.
                </p>
              </div>

              <button
                onClick={() =>
                  setModalServicio({
                    id: 'srv_' + Math.random().toString(36).slice(2, 8),
                    nombre: '',
                    descripcion: '',
                    duracionMin: 30,
                    precioCentavos: 2000000,
                    mostrarPrecio: true,
                    modalidades: ['presencial'],
                    activo: true,
                  })
                }
                className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 flex items-center gap-1 shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar Servicio
              </button>
            </div>

            <div className="space-y-3">
              {services.map(srv => (
                <div
                  key={srv.id}
                  className="p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-slate-900">{srv.nombre}</h4>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-600 font-medium">{srv.duracionMin} minutos</span>
                    </div>
                    <p className="text-xs text-slate-500">{srv.descripcion}</p>
                    <div className="flex items-center gap-2 pt-1 text-xs">
                      {srv.modalidades.map(m => (
                        <span key={m} className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px] font-medium capitalize">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div>
                      <div className="font-bold text-base text-slate-900 tabular-nums">
                        {formatearMoneda(srv.precioCentavos)}
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {srv.mostrarPrecio ? 'Visible en portal' : 'Precio oculto'}
                      </span>
                    </div>

                    <button
                      onClick={() => setModalServicio(srv)}
                      className="p-2 text-slate-500 hover:text-sky-700 hover:bg-slate-50 rounded-lg border border-slate-200"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUBPESTAÑA 3: MENSAJES WHATSAPP (Regla 1.9 E & 2.15)
         ========================================================= */}
      {subTab === 'whatsapp' && (
        <div className="space-y-6">
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Plantillas de Mensajería WhatsApp (I-06)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Personalizá los textos de confirmación y recordatorio. Se resuelven con datos reales del turno y se abren directamente en WhatsApp.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGuardarPlantillas}
                className="px-5 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 shadow-xs transition-all self-start sm:self-auto shrink-0 flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Plantillas</span>
              </button>
            </div>

            {/* SECCIÓN 1: PLANTILLA CONFIRMAR POR WHATSAPP */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center text-[11px] font-bold">1</span>
                  <span>Plantilla — "Confirmar por WhatsApp"</span>
                </h4>
              </div>

              {/* Botones de variables para Plantilla 1 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Insertar variable en la posición del cursor:
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}', '{valor}', '{alias}', '{direccion}', '{bloque_modalidad}'].map(
                    v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() =>
                          insertarVariableEnCursor(
                            textareaConfirmacionRef.current,
                            tplConfirmacion,
                            setTplConfirmacion,
                            v
                          )
                        }
                        title={`Insertar ${v} donde esté el cursor`}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-sky-800 font-semibold hover:bg-sky-50 hover:border-sky-300 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                      >
                        {v}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cuerpo principal del mensaje de confirmación
                </label>
                <textarea
                  ref={textareaConfirmacionRef}
                  rows={6}
                  value={tplConfirmacion}
                  onChange={e => setTplConfirmacion(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 font-sans leading-relaxed outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" /> Bloque condicional: Presencial
                  </label>
                  <textarea
                    rows={3}
                    value={bloquePresencial}
                    onChange={e => setBloquePresencial(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                    <Video className="w-3.5 h-3.5 text-emerald-600" /> Bloque condicional: Videollamada
                  </label>
                  <textarea
                    rows={3}
                    value={bloqueVideollamada}
                    onChange={e => setBloqueVideollamada(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              {/* Vistas previas en vivo de Confirmación */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      <span>Vista previa del mensaje Presencial:</span>
                    </span>
                    <a
                      href={construirEnlaceWhatsApp(professional.telefonoContactoPrivado, vistaPreviaConfirmacionPresencial).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Abrir WhatsApp para verificar emoticones y texto"
                    >
                      <Send className="w-3 h-3" />
                      <span>Probar en WhatsApp</span>
                    </a>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed shadow-2xs font-sans">
                    {vistaPreviaConfirmacionPresencial}
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Vista previa del mensaje Videollamada:</span>
                    </span>
                    <a
                      href={construirEnlaceWhatsApp(professional.telefonoContactoPrivado, vistaPreviaConfirmacionVirtual).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Abrir WhatsApp para verificar emoticones y texto"
                    >
                      <Send className="w-3 h-3" />
                      <span>Probar en WhatsApp</span>
                    </a>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed shadow-2xs font-sans">
                    {vistaPreviaConfirmacionVirtual}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* SECCIÓN 2: PLANTILLA RECORDAR POR WHATSAPP */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px] font-bold">2</span>
                  <span>Plantilla — "Recordar por WhatsApp"</span>
                </h4>
              </div>

              {/* Botones de variables para Plantilla 2 */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                  Insertar variable en la posición del cursor:
                </span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}', '{direccion}', '{bloque_modalidad}'].map(
                    v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() =>
                          insertarVariableEnCursor(
                            textareaRecordatorioRef.current,
                            tplRecordatorio,
                            setTplRecordatorio,
                            v
                          )
                        }
                        title={`Insertar ${v} donde esté el cursor`}
                        className="px-2.5 py-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-emerald-800 font-semibold hover:bg-emerald-50 hover:border-emerald-300 transition-colors shadow-2xs active:scale-95 cursor-pointer"
                      >
                        {v}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cuerpo del mensaje de recordatorio
                </label>
                <textarea
                  ref={textareaRecordatorioRef}
                  rows={5}
                  value={tplRecordatorio}
                  onChange={e => setTplRecordatorio(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 font-sans leading-relaxed outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                />
              </div>

              {/* Vistas previas en vivo del Recordatorio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      <span>Vista previa del recordatorio (Presencial):</span>
                    </span>
                    <a
                      href={construirEnlaceWhatsApp(professional.telefonoContactoPrivado, vistaPreviaRecordatorioPresencial).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Abrir WhatsApp para verificar emoticones y texto"
                    >
                      <Send className="w-3 h-3" />
                      <span>Probar en WhatsApp</span>
                    </a>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed shadow-2xs font-sans">
                    {vistaPreviaRecordatorioPresencial}
                  </div>
                </div>

                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Vista previa del recordatorio (Videollamada):</span>
                    </span>
                    <a
                      href={construirEnlaceWhatsApp(professional.telefonoContactoPrivado, vistaPreviaRecordatorioVirtual).url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
                      title="Abrir WhatsApp para verificar emoticones y texto"
                    >
                      <Send className="w-3 h-3" />
                      <span>Probar en WhatsApp</span>
                    </a>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed shadow-2xs font-sans">
                    {vistaPreviaRecordatorioVirtual}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleGuardarPlantillas}
                className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 shadow-xs transition-all flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Guardar Plantillas de WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          SUBPESTAÑA 4: PARÁMETROS GLOBALES (Regla 1.9 B)
         ========================================================= */}
      {subTab === 'parametros' && (
        <form onSubmit={handleGuardarParametros} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs max-w-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
            Parámetros Globales de la Agenda
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Intervalo de la grilla (minutos)
              </label>
              <select
                value={grillaMin}
                onChange={e => setGrillaMin(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value={15}>15 minutos</option>
                <option value={20}>20 minutos</option>
                <option value={30}>30 minutos (Recomendado)</option>
                <option value={45}>45 minutos</option>
                <option value={60}>60 minutos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Anticipación mínima para reservar
              </label>
              <select
                value={anticipacionHoras}
                onChange={e => setAnticipacionHoras(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value={1}>1 hora</option>
                <option value={2}>2 horas</option>
                <option value={4}>4 horas</option>
                <option value={12}>12 horas</option>
                <option value={24}>24 horas (1 día)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horizonte máximo de reserva
              </label>
              <select
                value={horizonteDias}
                onChange={e => setHorizonteDias(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value={15}>15 días</option>
                <option value={30}>30 días</option>
                <option value={45}>45 días</option>
                <option value={60}>60 días</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Margen entre turnos (buffer)
              </label>
              <select
                value={margenMin}
                onChange={e => setMargenMin(Number(e.target.value))}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value={0}>Sin margen (0 min)</option>
                <option value={5}>5 minutos</option>
                <option value={10}>10 minutos</option>
                <option value={15}>15 minutos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horario de descanso WhatsApp (Inicio)
              </label>
              <input
                type="time"
                value={quietInicio}
                onChange={e => setQuietInicio(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Horario de descanso WhatsApp (Fin)
              </label>
              <input
                type="time"
                value={quietFin}
                onChange={e => setQuietFin(e.target.value)}
                className="w-full text-xs p-2 rounded-lg border border-slate-200"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="px-5 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700"
            >
              Guardar Configuración
            </button>
          </div>
        </form>
      )}

      {/* =========================================================
          SUBPESTAÑA 5: FERIADOS (Regla 1.9 C)
         ========================================================= */}
      {subTab === 'feriados' && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs max-w-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>Feriados Nacionales y Días No Laborables</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Por defecto los feriados bloquean las reservas en el portal del paciente. Habilitá individualmente como <strong className="text-emerald-700">"Laborable"</strong> aquellos días en los que desees atender con normalidad.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNuevoFeriadoFecha('');
                setNuevoFeriadoNombre('');
                setNuevoFeriadoLaborable(false);
                setErrorNuevoFeriado('');
                setModalNuevoFeriado(true);
              }}
              className="self-start sm:self-auto px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar Feriado / Asueto</span>
            </button>
          </div>

          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 block text-[11px]">Total configurados</span>
              <span className="text-base font-bold text-slate-800">{holidays.length} feriados</span>
            </div>

            <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 text-xs">
              <span className="text-emerald-700 block text-[11px] font-semibold">Laborables (Se atiende)</span>
              <span className="text-base font-bold text-emerald-800">
                {holidays.filter(h => h.laborable).length} habilitados
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <span className="text-slate-500 block text-[11px]">No laborables (Cerrado)</span>
              <span className="text-base font-bold text-slate-700">
                {holidays.filter(h => !h.laborable).length} bloqueados
              </span>
            </div>
          </div>

          {/* Filtros de estado */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-xs bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setFiltroFeriado('todos')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filtroFeriado === 'todos'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Todos ({holidays.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroFeriado('laborables')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filtroFeriado === 'laborables'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-emerald-700 hover:text-emerald-800'
                }`}
              >
                Laborables ({holidays.filter(h => h.laborable).length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroFeriado('no_laborables')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                  filtroFeriado === 'no_laborables'
                    ? 'bg-slate-700 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                No laborables ({holidays.filter(h => !h.laborable).length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const todosNoLaborables = holidays.map(h => ({ ...h, laborable: false }));
                updateHolidays(todosNoLaborables);
              }}
              className="text-[11px] text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Marcar todos como no laborables
            </button>
          </div>

          {/* Listado interactivo de Feriados */}
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-white">
            {holidays
              .filter(h => {
                if (filtroFeriado === 'laborables') return h.laborable;
                if (filtroFeriado === 'no_laborables') return !h.laborable;
                return true;
              })
              .sort((a, b) => a.fecha.localeCompare(b.fecha))
              .map(h => {
                const [anio, mes, dia] = h.fecha.split('-').map(Number);
                const fechaObj = new Date(anio, mes - 1, dia, 12, 0, 0);
                const diaSemana = fechaObj.toLocaleDateString('es-AR', { weekday: 'long' });
                const mesNombre = fechaObj.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase();

                return (
                  <div
                    key={h.id}
                    className={`p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs transition-colors ${
                      h.laborable ? 'bg-emerald-50/30 hover:bg-emerald-50/50' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Pastilla de calendario con Día y Mes */}
                      <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center border font-bold shrink-0 ${
                        h.laborable
                          ? 'bg-emerald-100/70 border-emerald-300 text-emerald-900'
                          : 'bg-slate-100 border-slate-200 text-slate-700'
                      }`}>
                        <span className="text-[10px] uppercase font-bold leading-none tracking-tight">{mesNombre}</span>
                        <span className="text-sm font-extrabold leading-tight">{dia}</span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs sm:text-sm">{h.nombre}</span>
                          {h.laborable && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              Se atiende
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 capitalize">
                          {diaSemana} {dia} de {fechaObj.toLocaleDateString('es-AR', { month: 'long' })} · {anio}
                        </div>
                      </div>
                    </div>

                    {/* Botón / Toggle interactivo */}
                    <div className="flex items-center gap-2 sm:self-center">
                      <button
                        type="button"
                        onClick={() => toggleHolidayLaborable(h.id)}
                        className={`flex items-center gap-2.5 py-1.5 px-3 rounded-xl border text-xs transition-all cursor-pointer shadow-2xs active:scale-95 ${
                          h.laborable
                            ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                        }`}
                        title={h.laborable ? 'Clic para desmarcar y bloquear en portal' : 'Clic para marcar como laborable'}
                      >
                        <div
                          className={`w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                            h.laborable ? 'bg-white text-emerald-700' : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {h.laborable ? <Check className="w-3 h-3 stroke-[3]" /> : <X className="w-2.5 h-2.5" />}
                        </div>
                        <span className="font-bold">
                          {h.laborable ? 'Laborable (Atiendo)' : 'No laborable (Cerrado)'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>

          <p className="text-[11px] text-slate-500 pt-1">
            💡 Los pacientes sólo podrán reservar turnos en feriados laborables si tenés configurada franja horaria para el día de la semana correspondiente (por ejemplo, si el 25 de mayo cae lunes, requiere horario activo los lunes).
          </p>
        </div>
      )}

      {/* MODAL AGREGAR FERIADO / ASUETO PERSONALIZADO */}
      {modalNuevoFeriado && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-sky-600" />
                <span>Nuevo Feriado o Asueto</span>
              </h4>
              <button
                type="button"
                onClick={() => setModalNuevoFeriado(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCrearFeriadoPersonalizado} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre o Motivo *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={nuevoFeriadoNombre}
                  onChange={e => setNuevoFeriadoNombre(e.target.value)}
                  placeholder="Ej. Asueto Patronal, Día del Médico..."
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Fecha *</label>
                <input
                  type="date"
                  required
                  value={nuevoFeriadoFecha}
                  onChange={e => setNuevoFeriadoFecha(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg outline-none focus:border-sky-600"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={nuevoFeriadoLaborable}
                    onChange={e => setNuevoFeriadoLaborable(e.target.checked)}
                    className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700">
                    Marcar directamente como laborable (Se atiende)
                  </span>
                </label>
              </div>

              {errorNuevoFeriado && (
                <p className="text-[11px] text-red-600 mt-1">{errorNuevoFeriado}</p>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNuevoFeriado(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-lg hover:bg-sky-700 shadow-xs transition-colors cursor-pointer"
                >
                  Guardar Feriado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDITAR SERVICIO */}
      {modalServicio && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="font-bold text-base text-slate-900 mb-3">
              {services.some(s => s.id === modalServicio.id) ? 'Editar Servicio' : 'Nuevo Servicio'}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nombre</label>
                <input
                  type="text"
                  value={modalServicio.nombre || ''}
                  onChange={e => setModalServicio({ ...modalServicio, nombre: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción</label>
                <textarea
                  rows={2}
                  value={modalServicio.descripcion || ''}
                  onChange={e => setModalServicio({ ...modalServicio, descripcion: e.target.value })}
                  className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duración (minutos)</label>
                  <input
                    type="number"
                    value={modalServicio.duracionMin || 30}
                    onChange={e => setModalServicio({ ...modalServicio, duracionMin: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor en Pesos</label>
                  <input
                    type="number"
                    value={modalServicio.precioCentavos ? modalServicio.precioCentavos / 100 : 20000}
                    onChange={e => setModalServicio({ ...modalServicio, precioCentavos: Number(e.target.value) * 100 })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={modalServicio.mostrarPrecio}
                    onChange={e => setModalServicio({ ...modalServicio, mostrarPrecio: e.target.checked })}
                    className="rounded text-sky-600"
                  />
                  <span>Mostrar precio al paciente en el portal</span>
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalServicio(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (modalServicio.nombre) {
                    const idx = services.findIndex(s => s.id === modalServicio.id);
                    if (idx >= 0) {
                      const copy = [...services];
                      copy[idx] = modalServicio as Service;
                      updateServices(copy);
                    } else {
                      updateServices([...services, modalServicio as Service]);
                    }
                    setModalServicio(null);
                  }
                }}
                className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-lg hover:bg-sky-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
