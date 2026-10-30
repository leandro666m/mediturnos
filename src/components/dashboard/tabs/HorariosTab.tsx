import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Calendar,
  Settings,
  Plus,
  Minus,
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
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Holiday, Modalidad, ModalidadFranja, Service, WorkingHours } from '../../../types';
import { formatearFechaLarga, formatearMoneda } from '../../../modules/format';
import {
  BLOQUE_PRESENCIAL_DEFAULT,
  BLOQUE_VIDEOLLAMADA_DEFAULT,
  construirEnlaceWhatsApp,
  CUERPO_CANCELACION_DEFAULT,
  CUERPO_CONFIRMACION_DEFAULT,
  CUERPO_RECORDATORIO_DEFAULT,
  CUERPO_REPROGRAMACION_DEFAULT,
  resolverPlantillaMensaje,
} from '../../../modules/messaging';
import { createDataId } from '../../../data/ids';
import { isSupabaseConfigured } from '../../../data/supabaseClient';

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
  const [plazoCancelacionHoras, setPlazoCancelacionHoras] = useState(
    professional.parametros.plazoCancelacionHoras ?? 24
  );

  // Servicios
  const [modalServicio, setModalServicio] = useState<(Partial<Service> & { duracionMin?: number | ''; precioCentavos?: number | '' }) | null>(null);

  // WhatsApp Templates
  const [tplConfirmacion, setTplConfirmacion] = useState(() => {
    return templates.find(t => t.tipo === 'confirmacion')?.cuerpo || CUERPO_CONFIRMACION_DEFAULT;
  });
  const [tplRecordatorio, setTplRecordatorio] = useState(() => {
    return templates.find(t => t.tipo === 'recordatorio')?.cuerpo || CUERPO_RECORDATORIO_DEFAULT;
  });
  const [tplReprogramacion, setTplReprogramacion] = useState(() => {
    return templates.find(t => t.tipo === 'reprogramacion')?.cuerpo || CUERPO_REPROGRAMACION_DEFAULT;
  });
  const [tplCancelacion, setTplCancelacion] = useState(() => {
    return templates.find(t => t.tipo === 'cancelacion')?.cuerpo || CUERPO_CANCELACION_DEFAULT;
  });
  const [bloquePresencial, setBloquePresencial] = useState(() => {
    return templates.find(t => t.tipo === 'confirmacion')?.bloquePresencial || BLOQUE_PRESENCIAL_DEFAULT;
  });
  const [bloqueVideollamada, setBloqueVideollamada] = useState(() => {
    return templates.find(t => t.tipo === 'confirmacion')?.bloqueVideollamada || BLOQUE_VIDEOLLAMADA_DEFAULT;
  });
  const [bloquePresencialRec, setBloquePresencialRec] = useState(() => {
    return (
      templates.find(t => t.tipo === 'recordatorio')?.bloquePresencial ||
      templates.find(t => t.tipo === 'confirmacion')?.bloquePresencial ||
      BLOQUE_PRESENCIAL_DEFAULT
    );
  });
  const [bloqueVideollamadaRec, setBloqueVideollamadaRec] = useState(() => {
    return (
      templates.find(t => t.tipo === 'recordatorio')?.bloqueVideollamada ||
      templates.find(t => t.tipo === 'confirmacion')?.bloqueVideollamada ||
      BLOQUE_VIDEOLLAMADA_DEFAULT
    );
  });

  // Las plantillas autenticadas llegan después del primer render, cuando termina la hidratación.
  // Actualizar el formulario en ese momento evita que los campos queden vacíos.
  useEffect(() => {
    const confirmacion = templates.find(t => t.tipo === 'confirmacion');
    const recordatorio = templates.find(t => t.tipo === 'recordatorio');
    const reprogramacion = templates.find(t => t.tipo === 'reprogramacion');
    const cancelacion = templates.find(t => t.tipo === 'cancelacion');
    setTplConfirmacion(confirmacion?.cuerpo || CUERPO_CONFIRMACION_DEFAULT);
    setTplRecordatorio(recordatorio?.cuerpo || CUERPO_RECORDATORIO_DEFAULT);
    setTplReprogramacion(reprogramacion?.cuerpo || CUERPO_REPROGRAMACION_DEFAULT);
    setTplCancelacion(cancelacion?.cuerpo || CUERPO_CANCELACION_DEFAULT);
    const presencial = confirmacion?.bloquePresencial || BLOQUE_PRESENCIAL_DEFAULT;
    const videollamada = confirmacion?.bloqueVideollamada || BLOQUE_VIDEOLLAMADA_DEFAULT;
    setBloquePresencial(presencial);
    setBloqueVideollamada(videollamada);
    setBloquePresencialRec(recordatorio?.bloquePresencial || presencial);
    setBloqueVideollamadaRec(recordatorio?.bloqueVideollamada || videollamada);
  }, [templates]);

  // Feriados Nacionales y Asuetos
  const [filtroFeriado, setFiltroFeriado] = useState<'todos' | 'laborables' | 'no_laborables'>('todos');
  const [modalNuevoFeriado, setModalNuevoFeriado] = useState(false);
  const [nuevoFeriadoFecha, setNuevoFeriadoFecha] = useState('');
  const [nuevoFeriadoNombre, setNuevoFeriadoNombre] = useState('');
  const [nuevoFeriadoLaborable, setNuevoFeriadoLaborable] = useState(false);
  const [errorNuevoFeriado, setErrorNuevoFeriado] = useState('');
  const [sincronizandoFeriados, setSincronizandoFeriados] = useState(false);
  const [estadoSincronizacionFeriados, setEstadoSincronizacionFeriados] = useState('');

  const sincronizarFeriadosNacionales = async () => {
    setSincronizandoFeriados(true);
    setEstadoSincronizacionFeriados('');

    try {
      const anioActual = new Date().getFullYear();
      const anios = [anioActual, anioActual + 1];
      const respuestas = await Promise.all(anios.map(async anio => {
        const response = await fetch(`https://api.argentinadatos.com/v1/feriados/${anio}`);
        if (!response.ok) throw new Error(`No se pudieron consultar los feriados de ${anio}.`);
        return response.json() as Promise<Array<{ fecha: string; nombre: string }>>;
      }));

      const existentesPorFecha = new Map(holidays.map(feriado => [feriado.fecha, feriado]));
      const esUuid = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const nacionales = respuestas.flat().filter(feriado =>
        /^\d{4}-\d{2}-\d{2}$/.test(feriado.fecha) && typeof feriado.nombre === 'string' && feriado.nombre.trim()
      );
      const fechasNacionales = new Set(nacionales.map(feriado => feriado.fecha));
      const sincronizados: Holiday[] = nacionales.map(feriado => {
        const existente = existentesPorFecha.get(feriado.fecha);
        return {
          id: existente && (!isSupabaseConfigured || esUuid(existente.id))
            ? existente.id
            : createDataId('hol_nacional_'),
          fecha: feriado.fecha,
          nombre: feriado.nombre.trim(),
          laborable: existente?.laborable ?? false,
        };
      });
      const personalizados = holidays
        .filter(feriado => !fechasNacionales.has(feriado.fecha))
        .map(feriado => isSupabaseConfigured && !esUuid(feriado.id)
          ? { ...feriado, id: createDataId('hol_custom_') }
          : feriado);

      updateHolidays([...sincronizados, ...personalizados]);
      setEstadoSincronizacionFeriados(`Se actualizaron ${sincronizados.length} feriados nacionales (${anioActual} y ${anioActual + 1}).`);
    } catch (error) {
      setEstadoSincronizacionFeriados(error instanceof Error ? error.message : 'No se pudieron actualizar los feriados. Intentá nuevamente.');
    } finally {
      setSincronizandoFeriados(false);
    }
  };

  const handleCrearFeriadoPersonalizado = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoFeriadoFecha || !nuevoFeriadoNombre.trim()) {
      setErrorNuevoFeriado('Ingresá la fecha y el nombre del feriado o asueto.');
      return;
    }
    const nuevo: Holiday = {
      id: createDataId('hol_custom_'),
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
  const textareaPresencialRef = useRef<HTMLTextAreaElement>(null);
  const textareaVideollamadaRef = useRef<HTMLTextAreaElement>(null);

  const textareaRecordatorioRef = useRef<HTMLTextAreaElement>(null);
  const textareaPresencialRecRef = useRef<HTMLTextAreaElement>(null);
  const textareaVideollamadaRecRef = useRef<HTMLTextAreaElement>(null);

  // Destino activo para la inserción de variables en Plantilla 1 ("Confirmar por WhatsApp")
  const [targetConfirmacion, setTargetConfirmacion] = useState<'cuerpo' | 'presencial' | 'videollamada'>('cuerpo');

  // Destino activo para la inserción de variables en Plantilla 2 ("Recordar por WhatsApp")
  const [targetRecordatorio, setTargetRecordatorio] = useState<'cuerpo' | 'presencial' | 'videollamada'>('cuerpo');

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

  const handleInsertarEnConfirmacion = (variable: string) => {
    if (targetConfirmacion === 'presencial') {
      if (variable === '{bloque_modalidad}') return;
      insertarVariableEnCursor(
        textareaPresencialRef.current,
        bloquePresencial,
        setBloquePresencial,
        variable
      );
    } else if (targetConfirmacion === 'videollamada') {
      if (variable === '{bloque_modalidad}') return;
      insertarVariableEnCursor(
        textareaVideollamadaRef.current,
        bloqueVideollamada,
        setBloqueVideollamada,
        variable
      );
    } else {
      insertarVariableEnCursor(
        textareaConfirmacionRef.current,
        tplConfirmacion,
        setTplConfirmacion,
        variable
      );
    }
  };

  const handleInsertarEnRecordatorio = (variable: string) => {
    if (targetRecordatorio === 'presencial') {
      if (variable === '{bloque_modalidad}') return;
      insertarVariableEnCursor(
        textareaPresencialRecRef.current,
        bloquePresencialRec,
        setBloquePresencialRec,
        variable
      );
    } else if (targetRecordatorio === 'videollamada') {
      if (variable === '{bloque_modalidad}') return;
      insertarVariableEnCursor(
        textareaVideollamadaRecRef.current,
        bloqueVideollamadaRec,
        setBloqueVideollamadaRec,
        variable
      );
    } else {
      insertarVariableEnCursor(
        textareaRecordatorioRef.current,
        tplRecordatorio,
        setTplRecordatorio,
        variable
      );
    }
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

  // Actualizar esquema de franjas horarias
  const handleToggleDiaActivo = (diaNum: number) => {
    const franjas = workingHours.filter(wh => wh.diaSemana === diaNum);
    if (franjas.length > 0) {
      const algunActivo = franjas.some(wh => wh.activo);
      const nuevoEstado = !algunActivo;
      const actualizadas = workingHours.map(wh =>
        wh.diaSemana === diaNum ? { ...wh, activo: nuevoEstado } : wh
      );
      updateWorkingHours(actualizadas);
    } else {
      // Crear nueva franja para el día
      const defaultLocId = locations.find(l => l.activa)?.id || locations[0]?.id;
      const nueva: WorkingHours = {
        id: createDataId('wh_'),
        diaSemana: diaNum,
        horaInicio: '09:00',
        horaFin: '18:00',
        modalidad: 'presencial',
        descansos: [],
        locationId: defaultLocId,
        activo: true,
      };
      updateWorkingHours([...workingHours, nueva]);
    }
  };

  // Validación de solapamiento entre franjas horarias activas del mismo día (restricción franjas_sin_solapamiento)
  const haySolapamiento = (
    candidata: { id?: string; diaSemana: number; horaInicio: string; horaFin: string; activo: boolean },
    lista: WorkingHours[]
  ): boolean => {
    if (!candidata.activo) return false;
    return lista.some(otra => {
      if (otra.id === candidata.id || !otra.activo || otra.diaSemana !== candidata.diaSemana) {
        return false;
      }
      return candidata.horaInicio < otra.horaFin && candidata.horaFin > otra.horaInicio;
    });
  };

  const [errorFranjaMsg, setErrorFranjaMsg] = useState<string | null>(null);

  const mostrarErrorFranja = (msg: string) => {
    setErrorFranjaMsg(msg);
    setTimeout(() => setErrorFranjaMsg(null), 4500);
  };

  const handleAgregarFranja = (diaNum: number, franjaAnterior?: WorkingHours) => {
    const franjasActivasDia = workingHours.filter(wh => wh.diaSemana === diaNum && wh.activo);
    let inicio = '14:00';
    let fin = '18:00';

    if (franjasActivasDia.length > 0) {
      // Tomamos la hora fin más tardía
      const maxFin = franjasActivasDia.reduce((max, f) => (f.horaFin > max ? f.horaFin : max), '00:00');
      if (maxFin < '20:00') {
        inicio = maxFin;
        const [h, m] = maxFin.split(':').map(Number);
        const finH = Math.min(23, h + 3);
        fin = `${String(finH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      } else {
        inicio = '08:00';
        fin = '10:00';
      }
    }

    const defaultLocId = franjaAnterior?.locationId || locations.find(l => l.activa)?.id || locations[0]?.id;

    const nueva: WorkingHours = {
      id: createDataId('wh_'),
      diaSemana: diaNum,
      horaInicio: inicio,
      horaFin: fin,
      modalidad: franjaAnterior?.modalidad || 'presencial',
      descansos: [],
      locationId: defaultLocId,
      activo: true,
    };

    if (haySolapamiento(nueva, workingHours)) {
      mostrarErrorFranja('No se pudo agregar el horario automáticamente porque se solapa con otro horario activo existente.');
      return;
    }

    updateWorkingHours([...workingHours, nueva]);
  };

  // Mensaje de feedback temporal para guardados
  const [guardadoMsg, setGuardadoMsg] = useState<string | null>(null);

  const mostrarMensajeGuardado = (msg: string) => {
    setGuardadoMsg(msg);
    setTimeout(() => setGuardadoMsg(null), 3000);
  };

  const handleEliminarFranja = (franjaId: string, _diaNum: number) => {
    updateWorkingHours(workingHours.filter(wh => wh.id !== franjaId));
  };

  const handleUpdateFranja = (id: string, campo: keyof WorkingHours, valor: any) => {
    const actual = workingHours.find(wh => wh.id === id);
    if (!actual) return;

    const candidata = { ...actual, [campo]: valor };

    if (campo === 'horaInicio' || campo === 'horaFin') {
      if (candidata.horaInicio >= candidata.horaFin) {
        mostrarErrorFranja('La hora de inicio debe ser anterior a la hora de fin.');
        return;
      }
      if (candidata.activo && haySolapamiento(candidata, workingHours)) {
        mostrarErrorFranja('No se pueden solapar franjas horarias activas para el mismo día (restricción franjas_sin_solapamiento de base de datos).');
        return;
      }
    }

    if (campo === 'activo' && valor === true) {
      if (haySolapamiento(candidata, workingHours)) {
        mostrarErrorFranja('No podés activar esta franja porque se solapa con otro horario ya activo para este día.');
        return;
      }
    }

    const actualizadas = workingHours.map(wh => {
      if (wh.id !== id) return wh;
      const updated = { ...wh, [campo]: valor };
      if (campo === 'modalidad' && (valor === 'presencial' || valor === 'ambas') && !updated.locationId) {
        updated.locationId = locations.find(l => l.activa)?.id || locations[0]?.id;
      }
      return updated;
    });
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
        plazoCancelacionHoras,
      },
    });
    mostrarMensajeGuardado('Parámetros globales guardados correctamente.');
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
          bloquePresencial: bloquePresencialRec,
          bloqueVideollamada: bloqueVideollamadaRec,
        };
      }
      if (t.tipo === 'reprogramacion') {
        return {
          ...t,
          cuerpo: tplReprogramacion,
        };
      }
      if (t.tipo === 'cancelacion') {
        return {
          ...t,
          cuerpo: tplCancelacion,
        };
      }
      return t;
    });

    if (!actualizadas.some(t => t.tipo === 'reprogramacion')) {
      actualizadas.push({
        id: createDataId('tpl_reprog'),
        professionalId: professional.id,
        tipo: 'reprogramacion',
        cuerpo: tplReprogramacion,
        bloquePresencial: '',
        bloqueVideollamada: '',
      });
    }
    if (!actualizadas.some(t => t.tipo === 'cancelacion')) {
      actualizadas.push({
        id: createDataId('tpl_cancel'),
        professionalId: professional.id,
        tipo: 'cancelacion',
        cuerpo: tplCancelacion,
        bloquePresencial: '',
        bloqueVideollamada: '',
      });
    }

    updateTemplates(actualizadas);
    mostrarMensajeGuardado('Plantillas de WhatsApp guardadas con éxito.');
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
      alias: professional.aliasCobro || '',
      direccion: locations[0]?.direccion,
      link_maps: locations[0]?.mapsUrl,
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
      alias: professional.aliasCobro || '',
      modalidad: 'videollamada',
    }
  );

  const vistaPreviaRecordatorioPresencial = resolverPlantillaMensaje(
    tplRecordatorio,
    bloquePresencialRec,
    bloqueVideollamadaRec,
    {
      paciente: 'Florencia Gómez',
      profesional: `${professional.titulo} ${professional.nombre}`,
      fecha: 'Jueves 15 de octubre',
      hora: '10:00 hs',
      servicio: 'Consulta Kinefiátrica Inicial',
      valor: '$28.000',
      alias: professional.aliasCobro || '',
      direccion: locations[0]?.direccion,
      link_maps: locations[0]?.mapsUrl,
      modalidad: 'presencial',
    }
  );

  const vistaPreviaRecordatorioVirtual = resolverPlantillaMensaje(
    tplRecordatorio,
    bloquePresencialRec,
    bloqueVideollamadaRec,
    {
      paciente: 'Carlos Bianchi',
      profesional: `${professional.titulo} ${professional.nombre}`,
      fecha: 'Viernes 16 de octubre',
      hora: '17:30 hs',
      servicio: 'Teleconsulta de Seguimiento',
      valor: '$19.000',
      alias: professional.aliasCobro || '',
      modalidad: 'videollamada',
    }
  );

  const renderBotonProbarWhatsApp = (mensaje: string) => {
    const telPrivado = professional.telefonoContactoPrivado;
    const enlace = construirEnlaceWhatsApp(telPrivado || '', mensaje);

    if (!telPrivado || !enlace.valido) {
      return (
        <button
          type="button"
          onClick={() => {
            alert(
              'Para probar el mensaje en WhatsApp enviándotelo a vos mismo, cargá tu número de teléfono celular en el "Perfil del Profesional" (icono de usuario arriba a la derecha).'
            );
          }}
          className="text-[11px] font-semibold text-slate-500 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
          title="Configurá tu celular en tu Perfil para enviarte mensajes de prueba"
        >
          <Send className="w-3 h-3 text-slate-400" />
          <span>Probar en WhatsApp</span>
          <span className="text-[10px] text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200">
            Sin tel. en perfil
          </span>
        </button>
      );
    }

    return (
      <a
        href={enlace.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 cursor-pointer"
        title={`Abrir WhatsApp para enviarte una prueba a tu propio chat (${enlace.telefonoDisplay})`}
      >
        <Send className="w-3 h-3 text-emerald-600" />
        <span>Probar en WhatsApp</span>
        <span className="text-[10px] text-emerald-600/80 font-normal">
          ({enlace.telefonoDisplay})
        </span>
      </a>
    );
  };

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

      {guardadoMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{guardadoMsg}</span>
        </div>
      )}

      {errorFranjaMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorFranjaMsg}</span>
        </div>
      )}

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
                    className={`p-4 rounded-2xl border transition-all ${
                      diaActivo ? 'bg-white border-slate-200 shadow-2xs' : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col gap-3">
                      {/* Cabecera del día */}
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2.5 cursor-pointer font-bold text-sm text-slate-900 select-none">
                          <input
                            type="checkbox"
                            checked={diaActivo}
                            onChange={() => handleToggleDiaActivo(d.num)}
                            className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 cursor-pointer"
                          />
                          <span>{d.nombre}</span>
                        </label>

                        {!diaActivo ? (
                          <span className="text-xs text-slate-400 font-medium italic">
                            No atiende este día
                          </span>
                        ) : franjasDia.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleAgregarFranja(d.num)}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg transition-colors cursor-pointer"
                            title={`Agregar franja de horario para el día ${d.nombre}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Agregar horario</span>
                          </button>
                        ) : null}
                      </div>

                      {/* Filas de combo configs para este día */}
                      {diaActivo && (
                        <div className="space-y-2.5 pt-2 border-t border-slate-100">
                          {franjasDia.map(franja => {
                            const requiereUbicacion =
                              franja.modalidad === 'presencial' || franja.modalidad === 'ambas';

                            return (
                              <div
                                key={franja.id}
                                className="flex flex-wrap items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs"
                              >
                                {/* Horario: __ a __ */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-slate-600 font-medium">Horario:</span>
                                  <input
                                    type="time"
                                    value={franja.horaInicio}
                                    onChange={e => handleUpdateFranja(franja.id, 'horaInicio', e.target.value)}
                                    className="bg-white border border-slate-300 focus:border-sky-600 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none tabular-nums shadow-2xs"
                                  />
                                  <span className="text-slate-400 font-medium">a</span>
                                  <input
                                    type="time"
                                    value={franja.horaFin}
                                    onChange={e => handleUpdateFranja(franja.id, 'horaFin', e.target.value)}
                                    className="bg-white border border-slate-300 focus:border-sky-600 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 outline-none tabular-nums shadow-2xs"
                                  />
                                </div>

                                <span className="text-slate-300 hidden md:inline">|</span>

                                {/* Modalidad: ___ */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="text-slate-600 font-medium">Modalidad:</span>
                                  <select
                                    value={franja.modalidad}
                                    onChange={e =>
                                      handleUpdateFranja(franja.id, 'modalidad', e.target.value as ModalidadFranja)
                                    }
                                    className="bg-white border border-slate-300 focus:border-sky-600 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800 outline-none cursor-pointer shadow-2xs"
                                  >
                                    <option value="presencial">Solo Presencial</option>
                                    <option value="videollamada">Solo Videollamada</option>
                                    <option value="ambas">Ambas modalidades</option>
                                  </select>
                                </div>

                                {/* Desplegable de Ubicaciones / Direcciones si es Presencial o Ambas */}
                                {requiereUbicacion && (
                                  <>
                                    <span className="text-slate-300 hidden lg:inline">|</span>
                                    <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                                      <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                                      <span className="text-slate-600 font-medium shrink-0">Ubicación:</span>
                                      {locations.length > 0 ? (
                                        <select
                                          value={
                                            franja.locationId ||
                                            locations.find(l => l.activa)?.id ||
                                            locations[0]?.id ||
                                            ''
                                          }
                                          onChange={e => handleUpdateFranja(franja.id, 'locationId', e.target.value)}
                                          className="w-full bg-white border border-slate-300 focus:border-sky-600 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-800 outline-none cursor-pointer truncate shadow-2xs"
                                        >
                                          {locations.map(loc => (
                                            <option key={loc.id} value={loc.id}>
                                              {loc.nombre} {!loc.activa ? '(Pausada)' : ''} — {loc.direccion}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px] font-medium border border-amber-200">
                                          Sin direcciones cargadas en Perfil
                                        </span>
                                      )}
                                    </div>
                                  </>
                                )}

                                {/* Botón '+' y '-' para cada combo config (limpio, sin etiquetas duplicadas ++ o - -) */}
                                <div className="flex items-center gap-1.5 ml-auto shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleAgregarFranja(d.num, franja)}
                                    className="w-7 h-7 flex items-center justify-center bg-white hover:bg-sky-50 text-sky-700 hover:text-sky-800 border border-slate-200 hover:border-sky-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                    title="Agregar otro horario (+)"
                                    aria-label="Agregar otro horario"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleEliminarFranja(franja.id, d.num)}
                                    className="w-7 h-7 flex items-center justify-center bg-white hover:bg-rose-50 text-slate-500 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition-colors cursor-pointer shadow-2xs"
                                    title="Quitar este horario (-)"
                                    aria-label="Quitar este horario"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
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
                    id: createDataId('srv_'),
                    nombre: '',
                    descripcion: '',
                    duracionMin: 30,
                    precioCentavos: 2000000,
                    mostrarPrecio: true,
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
                  {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}', '{valor}', '{alias}', '{direccion}', '{link_maps}', '{bloque_modalidad}'].map(
                    v => {
                      const esBloqueModalidad = v === '{bloque_modalidad}';
                      const deshabilitado = esBloqueModalidad && targetConfirmacion !== 'cuerpo';

                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={deshabilitado}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleInsertarEnConfirmacion(v)}
                          title={
                            deshabilitado
                              ? 'El bloque de modalidad solo puede insertarse en el cuerpo principal'
                              : `Insertar ${v} donde esté el cursor`
                          }
                          className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                            deshabilitado
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                              : 'bg-white border border-slate-200 text-sky-800 hover:bg-sky-50 hover:border-sky-300'
                          }`}
                        >
                          {v}
                        </button>
                      );
                    }
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
                  onFocus={() => setTargetConfirmacion('cuerpo')}
                  onClick={() => setTargetConfirmacion('cuerpo')}
                  onKeyUp={() => setTargetConfirmacion('cuerpo')}
                  onChange={e => setTplConfirmacion(e.target.value)}
                  className={`w-full text-xs p-3 rounded-xl border font-sans leading-relaxed outline-none transition-all ${
                    targetConfirmacion === 'cuerpo'
                      ? 'border-sky-500 ring-2 ring-sky-100 focus:border-sky-600'
                      : 'border-slate-200 focus:border-sky-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Bloque Condicional Presencial */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    targetConfirmacion === 'presencial'
                      ? 'border-sky-400 bg-sky-50/20 ring-1 ring-sky-200 shadow-2xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>Bloque condicional: Presencial</span>
                  </label>

                  {/* Variables directas para Presencial */}
                  <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px]">
                    <span className="text-slate-400 font-medium mr-0.5">Insertar:</span>
                    {['{direccion}', '{link_maps}', '{paciente}', '{fecha}', '{hora}', '{servicio}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setTargetConfirmacion('presencial');
                          insertarVariableEnCursor(
                            textareaPresencialRef.current,
                            bloquePresencial,
                            setBloquePresencial,
                            v
                          );
                        }}
                        title={`Insertar ${v} en el cursor`}
                        className="px-1.5 py-0.5 bg-white hover:bg-sky-50 text-sky-800 border border-slate-200 hover:border-sky-300 rounded font-mono text-[10px] font-semibold cursor-pointer shadow-2xs active:scale-95"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={textareaPresencialRef}
                    rows={3}
                    value={bloquePresencial}
                    onFocus={() => setTargetConfirmacion('presencial')}
                    onClick={() => setTargetConfirmacion('presencial')}
                    onKeyUp={() => setTargetConfirmacion('presencial')}
                    onChange={e => setBloquePresencial(e.target.value)}
                    placeholder="ej. 📍 Lugar: {direccion}\n🗺️ Google Maps: {link_maps}"
                    className={`w-full text-xs p-2.5 rounded-lg border outline-none bg-white transition-all ${
                      targetConfirmacion === 'presencial'
                        ? 'border-sky-500 ring-2 ring-sky-100'
                        : 'border-slate-200 focus:border-sky-600'
                    }`}
                  />
                </div>

                {/* Bloque Condicional Videollamada */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    targetConfirmacion === 'videollamada'
                      ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-200 shadow-2xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1 mb-1.5">
                    <Video className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bloque condicional: Videollamada</span>
                  </label>

                  {/* Variables directas para Videollamada */}
                  <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px]">
                    <span className="text-slate-400 font-medium mr-0.5">Insertar:</span>
                    {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}', '{valor}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setTargetConfirmacion('videollamada');
                          insertarVariableEnCursor(
                            textareaVideollamadaRef.current,
                            bloqueVideollamada,
                            setBloqueVideollamada,
                            v
                          );
                        }}
                        title={`Insertar ${v} en el cursor`}
                        className="px-1.5 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded font-mono text-[10px] font-semibold cursor-pointer shadow-2xs active:scale-95"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={textareaVideollamadaRef}
                    rows={3}
                    value={bloqueVideollamada}
                    onFocus={() => setTargetConfirmacion('videollamada')}
                    onClick={() => setTargetConfirmacion('videollamada')}
                    onKeyUp={() => setTargetConfirmacion('videollamada')}
                    onChange={e => setBloqueVideollamada(e.target.value)}
                    placeholder="ej. 📞 Videollamada por WhatsApp: te llamaremos a la hora de tu turno."
                    className={`w-full text-xs p-2.5 rounded-lg border outline-none bg-white transition-all ${
                      targetConfirmacion === 'videollamada'
                        ? 'border-emerald-500 ring-2 ring-emerald-100'
                        : 'border-slate-200 focus:border-emerald-600'
                    }`}
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
                    {renderBotonProbarWhatsApp(vistaPreviaConfirmacionPresencial)}
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
                    {renderBotonProbarWhatsApp(vistaPreviaConfirmacionVirtual)}
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
                  {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}', '{direccion}', '{link_maps}', '{bloque_modalidad}'].map(
                    v => {
                      const esBloqueModalidad = v === '{bloque_modalidad}';
                      const deshabilitado = esBloqueModalidad && targetRecordatorio !== 'cuerpo';

                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={deshabilitado}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => handleInsertarEnRecordatorio(v)}
                          title={
                            deshabilitado
                              ? 'El bloque de modalidad solo puede insertarse en el cuerpo principal'
                              : `Insertar ${v} donde esté el cursor`
                          }
                          className={`px-2.5 py-1 rounded font-mono text-[11px] font-semibold transition-all shadow-2xs active:scale-95 cursor-pointer ${
                            deshabilitado
                              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
                              : 'bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300'
                          }`}
                        >
                          {v}
                        </button>
                      );
                    }
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
                  onFocus={() => setTargetRecordatorio('cuerpo')}
                  onClick={() => setTargetRecordatorio('cuerpo')}
                  onKeyUp={() => setTargetRecordatorio('cuerpo')}
                  onChange={e => setTplRecordatorio(e.target.value)}
                  className={`w-full text-xs p-3 rounded-xl border font-sans leading-relaxed outline-none transition-all ${
                    targetRecordatorio === 'cuerpo'
                      ? 'border-emerald-500 ring-2 ring-emerald-100 focus:border-emerald-600'
                      : 'border-slate-200 focus:border-sky-600'
                  }`}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Bloque Condicional Presencial (Recordatorio) */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    targetRecordatorio === 'presencial'
                      ? 'border-sky-400 bg-sky-50/20 ring-1 ring-sky-200 shadow-2xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-sky-600" />
                    <span>Bloque condicional: Presencial</span>
                  </label>

                  {/* Variables directas para Presencial */}
                  <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px]">
                    <span className="text-slate-400 font-medium mr-0.5">Insertar:</span>
                    {['{direccion}', '{link_maps}', '{paciente}', '{fecha}', '{hora}', '{servicio}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setTargetRecordatorio('presencial');
                          insertarVariableEnCursor(
                            textareaPresencialRecRef.current,
                            bloquePresencialRec,
                            setBloquePresencialRec,
                            v
                          );
                        }}
                        title={`Insertar ${v} en el cursor`}
                        className="px-1.5 py-0.5 bg-white hover:bg-sky-50 text-sky-800 border border-slate-200 hover:border-sky-300 rounded font-mono text-[10px] font-semibold cursor-pointer shadow-2xs active:scale-95"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={textareaPresencialRecRef}
                    rows={3}
                    value={bloquePresencialRec}
                    onFocus={() => setTargetRecordatorio('presencial')}
                    onClick={() => setTargetRecordatorio('presencial')}
                    onKeyUp={() => setTargetRecordatorio('presencial')}
                    onChange={e => setBloquePresencialRec(e.target.value)}
                    placeholder="ej. 📍 Lugar: {direccion}\n🗺️ Google Maps: {link_maps}"
                    className={`w-full text-xs p-2.5 rounded-lg border outline-none bg-white transition-all ${
                      targetRecordatorio === 'presencial'
                        ? 'border-sky-500 ring-2 ring-sky-100'
                        : 'border-slate-200 focus:border-sky-600'
                    }`}
                  />
                </div>

                {/* Bloque Condicional Videollamada (Recordatorio) */}
                <div
                  className={`p-3 rounded-xl border transition-all ${
                    targetRecordatorio === 'videollamada'
                      ? 'border-emerald-400 bg-emerald-50/20 ring-1 ring-emerald-200 shadow-2xs'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1 mb-1.5">
                    <Video className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Bloque condicional: Videollamada</span>
                  </label>

                  {/* Variables directas para Videollamada */}
                  <div className="flex flex-wrap items-center gap-1 mb-2 text-[10px]">
                    <span className="text-slate-400 font-medium mr-0.5">Insertar:</span>
                    {['{paciente}', '{profesional}', '{fecha}', '{hora}', '{servicio}'].map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => {
                          setTargetRecordatorio('videollamada');
                          insertarVariableEnCursor(
                            textareaVideollamadaRecRef.current,
                            bloqueVideollamadaRec,
                            setBloqueVideollamadaRec,
                            v
                          );
                        }}
                        title={`Insertar ${v} en el cursor`}
                        className="px-1.5 py-0.5 bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 rounded font-mono text-[10px] font-semibold cursor-pointer shadow-2xs active:scale-95"
                      >
                        + {v}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={textareaVideollamadaRecRef}
                    rows={3}
                    value={bloqueVideollamadaRec}
                    onFocus={() => setTargetRecordatorio('videollamada')}
                    onClick={() => setTargetRecordatorio('videollamada')}
                    onKeyUp={() => setTargetRecordatorio('videollamada')}
                    onChange={e => setBloqueVideollamadaRec(e.target.value)}
                    placeholder="ej. 📞 Videollamada por WhatsApp: te llamaremos a la hora de tu turno."
                    className={`w-full text-xs p-2.5 rounded-lg border outline-none bg-white transition-all ${
                      targetRecordatorio === 'videollamada'
                        ? 'border-emerald-500 ring-2 ring-emerald-100'
                        : 'border-slate-200 focus:border-emerald-600'
                    }`}
                  />
                </div>
              </div>

              {/* Vistas previas en vivo del Recordatorio */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div className="bg-slate-50/80 border border-slate-200 rounded-xl p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      <span>Vista previa del recordatorio (Presencial):</span>
                    </span>
                    {renderBotonProbarWhatsApp(vistaPreviaRecordatorioPresencial)}
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
                    {renderBotonProbarWhatsApp(vistaPreviaRecordatorioVirtual)}
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed shadow-2xs font-sans">
                    {vistaPreviaRecordatorioVirtual}
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* SECCIÓN 3: PLANTILLA REPROGRAMAR POR WHATSAPP */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[11px] font-bold">3</span>
                  <span>Plantilla — "Reprogramar por WhatsApp"</span>
                </h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cuerpo del mensaje al reprogramar un turno
                </label>
                <textarea
                  rows={4}
                  value={tplReprogramacion}
                  onChange={e => setTplReprogramacion(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-amber-500 font-sans leading-relaxed outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Variables disponibles: {'{paciente}'}, {'{profesional}'}, {'{fecha}'}, {'{hora}'}, {'{servicio}'}, {'{link_autogestion}'}
                </p>
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* SECCIÓN 4: PLANTILLA CANCELAR POR WHATSAPP */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center text-[11px] font-bold">4</span>
                  <span>Plantilla — "Cancelar por WhatsApp"</span>
                </h4>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cuerpo del mensaje al cancelar un turno
                </label>
                <textarea
                  rows={4}
                  value={tplCancelacion}
                  onChange={e => setTplCancelacion(e.target.value)}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 focus:border-rose-500 font-sans leading-relaxed outline-none transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Variables disponibles: {'{paciente}'}, {'{profesional}'}, {'{fecha}'}, {'{hora}'}, {'{motivo}'}
                </p>
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

            <div className="sm:col-span-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plazo límite para cancelar o reprogramar turnos (Horas previas)
              </label>
              <select
                value={plazoCancelacionHoras}
                onChange={e => {
                  const val = Number(e.target.value);
                  setPlazoCancelacionHoras(val);
                  updateProfessional({
                    parametros: {
                      ...professional.parametros,
                      plazoCancelacionHoras: val,
                    },
                  });
                }}
                className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-white"
              >
                <option value={4}>4 horas antes</option>
                <option value={12}>12 horas antes</option>
                <option value={24}>24 horas antes (Estándar recomendado)</option>
                <option value={48}>48 horas antes (2 días)</option>
                <option value={72}>72 horas antes (3 días)</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Si un paciente intenta cancelar o reprogramar su turno faltando menos de estas horas, el sistema se lo impedirá indicando que debe comunicarse por teléfono o WhatsApp.
              </p>
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

            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={sincronizarFeriadosNacionales}
                disabled={sincronizandoFeriados}
                className="px-3 py-1.5 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait shrink-0"
                title="Consulta los feriados nacionales del año actual y el siguiente"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoFeriados ? 'animate-spin' : ''}`} />
                <span>{sincronizandoFeriados ? 'Consultando…' : 'Actualizar feriados'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setNuevoFeriadoFecha('');
                  setNuevoFeriadoNombre('');
                  setNuevoFeriadoLaborable(false);
                  setErrorNuevoFeriado('');
                  setModalNuevoFeriado(true);
                }}
                className="px-3 py-1.5 bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Agregar Feriado / Asueto</span>
              </button>
            </div>
          </div>

          {estadoSincronizacionFeriados && (
            <p role="status" className={`text-xs ${estadoSincronizacionFeriados.startsWith('Se actualizaron') ? 'text-emerald-700' : 'text-rose-700'}`}>
              {estadoSincronizacionFeriados}
            </p>
          )}
          <p className="text-[11px] text-slate-500 -mt-3">
            Datos consultados en <a href="https://api.argentinadatos.com/v1/feriados/" target="_blank" rel="noreferrer" className="underline hover:text-sky-700">ArgentinaDatos</a>.
          </p>

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
                    value={modalServicio.duracionMin ?? 30}
                    onChange={e => setModalServicio({ ...modalServicio, duracionMin: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="w-full p-2 border border-slate-200 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valor en Pesos</label>
                  <input
                    type="number"
                    value={modalServicio.precioCentavos === '' ? '' : (modalServicio.precioCentavos ?? 2000000) / 100}
                    onChange={e => setModalServicio({ ...modalServicio, precioCentavos: e.target.value === '' ? '' : Number(e.target.value) * 100 })}
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
                  if (
                    modalServicio.nombre?.trim() &&
                    modalServicio.duracionMin !== '' &&
                    Number.isFinite(modalServicio.duracionMin) &&
                    modalServicio.duracionMin! > 0 &&
                    modalServicio.precioCentavos !== '' &&
                    Number.isFinite(modalServicio.precioCentavos) &&
                    modalServicio.precioCentavos! >= 0
                  ) {
                    const servicioGuardado: Service = {
                      ...modalServicio,
                      nombre: modalServicio.nombre.trim(),
                      duracionMin: modalServicio.duracionMin!,
                      precioCentavos: modalServicio.precioCentavos!,
                    } as Service;
                    const idx = services.findIndex(s => s.id === modalServicio.id);
                    if (idx >= 0) {
                      const copy = [...services];
                      copy[idx] = servicioGuardado;
                      updateServices(copy);
                    } else {
                      updateServices([...services, servicioGuardado]);
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
