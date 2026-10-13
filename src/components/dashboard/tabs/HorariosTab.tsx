import React, { useState } from 'react';
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
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Modalidad, ModalidadFranja, Service, WorkingHours } from '../../../types';
import { formatearMoneda } from '../../../modules/format';
import { resolverPlantillaMensaje } from '../../../modules/messaging';

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
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Plantillas de WhatsApp (I-06)
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configurá los textos de confirmación y recordatorio. Las variables entre llaves se reemplazan dinámicamente.
            </p>

            {/* Inserción de variables */}
            <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-semibold text-slate-700 block mb-2">
                Variables disponibles:
              </span>
              <div className="flex flex-wrap gap-1.5 text-xs">
                {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}', '{valor}', '{alias}', '{direccion}'].map(
                  v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setTplConfirmacion(prev => prev + ` ${v} `)}
                      className="px-2 py-1 bg-white border border-slate-200 rounded font-mono text-[11px] text-sky-800 font-semibold hover:bg-sky-50 hover:border-sky-300"
                    >
                      {v}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  1. Plantilla — "Confirmar por WhatsApp"
                </label>
                <textarea
                  rows={6}
                  value={tplConfirmacion}
                  onChange={e => setTplConfirmacion(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 font-sans leading-relaxed outline-none focus:border-sky-600"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-sky-600" /> Bloque condicional: Presencial
                  </label>
                  <textarea
                    rows={3}
                    value={bloquePresencial}
                    onChange={e => setBloquePresencial(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-sky-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1">
                    <Video className="w-3 h-3 text-emerald-600" /> Bloque condicional: Videollamada
                  </label>
                  <textarea
                    rows={3}
                    value={bloqueVideollamada}
                    onChange={e => setBloqueVideollamada(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  2. Plantilla — "Recordar por WhatsApp"
                </label>
                <textarea
                  rows={5}
                  value={tplRecordatorio}
                  onChange={e => setTplRecordatorio(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 font-sans leading-relaxed outline-none focus:border-sky-600"
                />
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={handleGuardarPlantillas}
                  className="px-5 py-2 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 shadow-xs"
                >
                  Guardar Plantillas
                </button>
              </div>
            </div>
          </div>

          {/* Previsualización en Vivo de WhatsApp (Presencial y Virtual) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-bold text-emerald-900 block mb-2 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" /> Vista previa mensaje Presencial:
              </span>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 text-xs text-slate-800 whitespace-pre-line leading-relaxed shadow-2xs">
                {vistaPreviaConfirmacionPresencial}
              </div>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4 shadow-2xs">
              <span className="text-xs font-bold text-emerald-900 block mb-2 flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-emerald-700" /> Vista previa mensaje Videollamada:
              </span>
              <div className="bg-white p-3.5 rounded-xl border border-emerald-200/80 text-xs text-slate-800 whitespace-pre-line leading-relaxed shadow-2xs">
                {vistaPreviaConfirmacionVirtual}
              </div>
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
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs max-w-2xl space-y-4">
          <h3 className="text-sm font-bold text-slate-900 pb-1 border-b border-slate-100">
            Feriados Nacionales de Argentina
          </h3>
          <p className="text-xs text-slate-500">
            Por defecto los feriados están bloqueados en el portal del paciente. Podés marcar individualmente alguno como laborable si atendés.
          </p>

          <div className="divide-y divide-slate-100">
            {holidays.map(h => (
              <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-semibold text-slate-900">{h.nombre}</span>
                  <div className="text-[11px] text-slate-500 font-mono">{h.fecha}</div>
                </div>

                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                  h.laborable ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                }`}>
                  {h.laborable ? 'Laborable' : 'No laborable'}
                </span>
              </div>
            ))}
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
