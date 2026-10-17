import {
  Calendar,
  Clock,
  MapPin,
  Video,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Send,
  Bell,
  RefreshCw,
  CreditCard,
  User,
  ExternalLink,
  ChevronDown,
  History,
  Receipt,
  Eye,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Appointment, EstadoTurno } from '../../../types';
import {
  formatearFechaCorta,
  formatearFechaLarga,
  formatearHora,
  formatearMoneda,
} from '../../../modules/format';
import {
  construirEnlaceWhatsApp,
  estaEnHorarioDescanso,
  prepararVariablesDesdeTurno,
  resolverPlantillaMensaje,
} from '../../../modules/messaging';
import { getSlotsForDate, validateSlotTime } from '../../../modules/availability';

interface AgendaTabProps {
  onVerFichaPaciente: (pacienteId: string) => void;
  onCargarNuevoTurno: () => void;
}

export const AgendaTab: React.FC<AgendaTabProps> = ({ onVerFichaPaciente, onCargarNuevoTurno }) => {
  const {
    professional,
    appointments,
    services,
    locations,
    templates,
    workingHours,
    holidays,
    timeOffs,
    changeAppointmentStatus,
    setAppointmentPayment,
    rescheduleAppointment,
    reviewPaymentProof,
    uploadPaymentProof,
  } = useApp();

  // Filtros
  const [filtroFecha, setFiltroFecha] = useState<'hoy' | 'manana' | 'proximos7' | 'todos'>('hoy');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [busqueda, setBusqueda] = useState('');

  // Modal de Reprogramación
  const [turnoAReprogramar, setTurnoAReprogramar] = useState<Appointment | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('10:00');
  const [esSobreturnoReprog, setEsSobreturnoReprog] = useState(false);
  const [errorReprog, setErrorReprog] = useState('');

  // Modal de Historial
  const [turnoHistorial, setTurnoHistorial] = useState<Appointment | null>(null);

  // Modal de Comprobante de Pago Digital (Hito 2 - Arancel Completo)
  const [turnoComprobante, setTurnoComprobante] = useState<Appointment | null>(null);
  const [modoRechazarComp, setModoRechazarComp] = useState(false);
  const [motivoRechazoComp, setMotivoRechazoComp] = useState('');
  const [feedbackComprobante, setFeedbackComprobante] = useState<string | null>(null);
  const [imagenAmpliada, setImagenAmpliada] = useState(false);
  const [modoSubirManual, setModoSubirManual] = useState(false);
  const [previewManual, setPreviewManual] = useState<string | null>(null);

  // Turno de comprobante actualizado reactivamente
  const turnoComprobanteActual = useMemo(() => {
    if (!turnoComprobante) return null;
    return appointments.find(a => a.id === turnoComprobante.id) || turnoComprobante;
  }, [turnoComprobante, appointments]);

  // Disponibilidad y validación en tiempo real para Reprogramación
  const servicioTurnoReprog = useMemo(() => {
    if (!turnoAReprogramar) return null;
    return services.find(s => s.id === turnoAReprogramar.serviceId) || services[0];
  }, [turnoAReprogramar, services]);

  const disponibilidadReprog = useMemo(() => {
    if (!turnoAReprogramar || !nuevaFecha || !servicioTurnoReprog) return null;
    return getSlotsForDate({
      dateString: nuevaFecha,
      service: servicioTurnoReprog,
      professional,
      workingHours,
      holidays,
      timeOffs,
      appointments,
      excludeAppointmentId: turnoAReprogramar.id,
      modalidad: turnoAReprogramar.modalidad,
      ignoreAnticipation: true,
    });
  }, [turnoAReprogramar, nuevaFecha, servicioTurnoReprog, professional, workingHours, holidays, timeOffs, appointments]);

  const validacionHoraReprog = useMemo(() => {
    if (!turnoAReprogramar || !nuevaFecha || !nuevaHora || !servicioTurnoReprog) return null;
    return validateSlotTime({
      dateString: nuevaFecha,
      hora: nuevaHora,
      service: servicioTurnoReprog,
      professional,
      workingHours,
      holidays,
      timeOffs,
      appointments,
      excludeAppointmentId: turnoAReprogramar.id,
      modalidad: turnoAReprogramar.modalidad,
    });
  }, [turnoAReprogramar, nuevaFecha, nuevaHora, servicioTurnoReprog, professional, workingHours, holidays, timeOffs, appointments]);

  // Filtrado de turnos
  const turnosFiltrados = useMemo(() => {
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
    const mananaInicio = new Date(hoyInicio);
    mananaInicio.setDate(mananaInicio.getDate() + 1);
    const pasadoMananaInicio = new Date(mananaInicio);
    pasadoMananaInicio.setDate(pasadoMananaInicio.getDate() + 1);
    const limite7dias = new Date(hoyInicio);
    limite7dias.setDate(limite7dias.getDate() + 7);

    return appointments.filter(app => {
      const fechaTurno = new Date(app.inicio);

      // Filtro de Fecha
      if (filtroFecha === 'hoy') {
        if (fechaTurno < hoyInicio || fechaTurno >= mananaInicio) return false;
      } else if (filtroFecha === 'manana') {
        if (fechaTurno < mananaInicio || fechaTurno >= pasadoMananaInicio) return false;
      } else if (filtroFecha === 'proximos7') {
        if (fechaTurno < hoyInicio || fechaTurno > limite7dias) return false;
      }

      // Filtro de Estado
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'pagado') {
          if (app.estadoPago !== 'pagado') return false;
        } else if (filtroEstado === 'sin_pago') {
          if (app.estadoPago !== 'sin_pago' || app.estado === 'cancelado') return false;
        } else if (filtroEstado === 'comprobante_pendiente') {
          if (app.comprobantePago?.estado !== 'pendiente_revision') return false;
        } else if (app.estado !== filtroEstado) {
          return false;
        }
      }

      // Búsqueda por texto (Nombre, DNI, Teléfono)
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const coincideNombre = app.pacienteNombre.toLowerCase().includes(q);
        const coincideDni = app.pacienteDni.includes(q);
        const coincideTel = app.pacienteTelefono.includes(q);
        const coincideEmail = app.pacienteEmail?.toLowerCase().includes(q);
        if (!coincideNombre && !coincideDni && !coincideTel && !coincideEmail) return false;
      }

      return true;
    }).sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  }, [appointments, filtroFecha, filtroEstado, busqueda]);

  // Contadores para el filtro HOY
  const contadoresHoy = useMemo(() => {
    const ahora = new Date();
    const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0);
    const mananaInicio = new Date(hoyInicio);
    mananaInicio.setDate(mananaInicio.getDate() + 1);

    const turnosHoy = appointments.filter(a => {
      const d = new Date(a.inicio);
      return d >= hoyInicio && d < mananaInicio && a.estado !== 'reprogramado';
    });

    return {
      total: turnosHoy.length,
      atendidos: turnosHoy.filter(a => a.estado === 'atendido').length,
      pendientes: turnosHoy.filter(a => a.estado === 'pendiente').length,
      ausentes: turnosHoy.filter(a => a.estado === 'ausente').length,
    };
  }, [appointments]);

  // Manejo de envío manual de WhatsApp (Confirmar / Recordar)
  const handleEnviarWhatsApp = (turno: Appointment, tipo: 'confirmacion' | 'recordatorio') => {
    const tpl = templates.find(t => t.tipo === tipo);
    const srv = services.find(s => s.id === turno.serviceId);
    const dir = locations.find(l => l.id === turno.locationId);

    const variables = prepararVariablesDesdeTurno(turno, professional, srv, dir?.direccion, dir?.mapsUrl);
    const textoMensaje = resolverPlantillaMensaje(
      tpl?.cuerpo || '',
      tpl?.bloquePresencial || '',
      tpl?.bloqueVideollamada || '',
      variables
    );

    // Advertencia de horario de descanso si aplica (22:00 a 08:00 - Regla 2.15)
    if (estaEnHorarioDescanso(professional.parametros.quietHoursInicio, professional.parametros.quietHoursFin)) {
      const continuar = window.confirm(
        'Aviso: Actualmente es horario de descanso (22:00 a 08:00 hs). ¿Deseas abrir WhatsApp de todos modos?'
      );
      if (!continuar) return;
    }

    const { url, valido } = construirEnlaceWhatsApp(turno.pacienteTelefono, textoMensaje);
    if (!valido || !url) {
      alert('Número telefónico inválido para enviar mensaje.');
      return;
    }

    window.open(url, '_blank');
  };

  const handleConfirmarReprogramacion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!turnoAReprogramar || !nuevaFecha || !nuevaHora) return;

    // Validación contra la disponibilidad de Horarios & Especialidad
    if (!esSobreturnoReprog && validacionHoraReprog && !validacionHoraReprog.valido) {
      setErrorReprog(validacionHoraReprog.mensaje);
      return;
    }

    const [anio, mes, dia] = nuevaFecha.split('-').map(Number);
    const [hora, min] = nuevaHora.split(':').map(Number);
    const inicio = new Date(anio, mes - 1, dia, hora, min, 0, 0);

    const srv = services.find(s => s.id === turnoAReprogramar.serviceId);
    const duracion = srv ? srv.duracionMin : 30;
    const fin = new Date(inicio.getTime() + duracion * 60 * 1000);

    const res = rescheduleAppointment(
      turnoAReprogramar.id,
      inicio.toISOString(),
      fin.toISOString(),
      esSobreturnoReprog
    );
    if (res.success) {
      setTurnoAReprogramar(null);
      setErrorReprog('');
      setEsSobreturnoReprog(false);
    } else {
      setErrorReprog(res.error || 'No se pudo reprogramar.');
    }
  };

  return (
    <div className="space-y-6">

      {/* TARJETAS RESUMEN DE HOY (Regla 1.5) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => {
            setFiltroFecha('hoy');
            setFiltroEstado('todos');
          }}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filtroFecha === 'hoy' && filtroEstado === 'todos'
              ? 'bg-sky-50/80 border-sky-300 ring-2 ring-sky-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Turnos Hoy</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{contadoresHoy.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Agendados para la fecha</div>
        </div>

        <div
          onClick={() => {
            setFiltroFecha('hoy');
            setFiltroEstado('atendido');
          }}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filtroFecha === 'hoy' && filtroEstado === 'atendido'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Atendidos</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{contadoresHoy.atendidos}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Consultas completadas</div>
        </div>

        <div
          onClick={() => {
            setFiltroFecha('hoy');
            setFiltroEstado('pendiente');
          }}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filtroFecha === 'hoy' && filtroEstado === 'pendiente'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Pendientes</div>
          <div className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{contadoresHoy.pendientes}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Por atender hoy</div>
        </div>

        <div
          onClick={() => {
            setFiltroFecha('hoy');
            setFiltroEstado('ausente');
          }}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            filtroFecha === 'hoy' && filtroEstado === 'ausente'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-xs'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Ausentes</div>
          <div className="text-2xl font-bold text-rose-700 mt-1 tabular-nums">{contadoresHoy.ausentes}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">No se presentaron</div>
        </div>
      </div>

      {/* BARRA DE FILTROS Y BÚSQUEDA */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        
        {/* Filtros de Fecha */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg self-start">
          <button
            onClick={() => setFiltroFecha('hoy')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtroFecha === 'hoy' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Hoy
          </button>
          <button
            onClick={() => setFiltroFecha('manana')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtroFecha === 'manana' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Mañana
          </button>
          <button
            onClick={() => setFiltroFecha('proximos7')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtroFecha === 'proximos7' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Próximos 7 días
          </button>
          <button
            onClick={() => setFiltroFecha('todos')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              filtroFecha === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Todos
          </button>
        </div>

        {/* Desplegable de Estado y Buscador */}
        <div className="flex flex-1 items-center gap-2 max-w-lg">
          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value)}
            className="text-xs bg-white border border-slate-200 rounded-lg py-2 px-2.5 text-slate-800 font-medium shrink-0 cursor-pointer"
          >
            <option value="todos">Todos los estados</option>
            <option value="comprobante_pendiente">💳 Comprobantes por revisar</option>
            <option value="pendiente">Solo Pendientes</option>
            <option value="atendido">Solo Atendidos</option>
            <option value="ausente">Solo Ausentes</option>
            <option value="cancelado">Solo Cancelados</option>
            <option value="reprogramado">Solo Reprogramados</option>
            <option value="sin_pago">Pendientes de cobro</option>
            <option value="pagado">Con Pago Confirmado</option>
          </select>

          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar paciente, DNI, teléfono..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
            />
          </div>
        </div>

      </div>

      {/* LISTADO DE TURNOS / CARDS (Regla 1.6) */}
      <div className="space-y-3">
        {turnosFiltrados.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">No hay turnos para este filtro</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Probá cambiando la fecha o el estado seleccionado, o cargá un turno nuevo.
            </p>
            <button
              onClick={onCargarNuevoTurno}
              className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition-all shadow-xs"
            >
              Cargar nuevo turno
            </button>
          </div>
        ) : (
          turnosFiltrados.map(turno => {
            const srv = services.find(s => s.id === turno.serviceId);
            const loc = locations.find(l => l.id === turno.locationId);
            const estaPagado = turno.estadoPago === 'pagado';
            const esTerminal = ['atendido', 'ausente', 'cancelado', 'reprogramado'].includes(turno.estado);

            return (
              <div
                key={turno.id}
                className={`bg-white rounded-xl border p-4 transition-all shadow-2xs hover:shadow-xs ${
                  turno.estado === 'cancelado'
                    ? 'opacity-60 border-slate-200 bg-slate-50/50'
                    : turno.estado === 'reprogramado'
                    ? 'opacity-70 border-slate-200 bg-slate-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Bloque Izquierdo: Horario, Paciente y Servicio */}
                  <div className="flex items-start gap-4">
                    {/* Badge de Horario */}
                    <div className="flex flex-col items-center justify-center min-w-[70px] p-2 bg-slate-50 rounded-xl border border-slate-200/80 shrink-0">
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        {formatearHora(turno.inicio).replace(' hs', '')}
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {formatearHora(turno.fin)}
                      </span>
                      {filtroFecha !== 'hoy' && (
                        <span className="text-[10px] font-semibold text-sky-700 mt-1">
                          {formatearFechaCorta(turno.inicio)}
                        </span>
                      )}
                    </div>

                    {/* Datos del Paciente y Servicio */}
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onVerFichaPaciente(turno.patientId)}
                          className="font-bold text-sm text-slate-900 hover:text-sky-700 flex items-center gap-1 transition-colors"
                        >
                          <span>{turno.pacienteNombre}</span>
                          <ExternalLink className="w-3 h-3 text-slate-400" />
                        </button>

                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600 tabular-nums">DNI {turno.pacienteDni}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-600">{turno.pacienteTelefono}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <strong className="text-slate-800">{srv?.nombre || 'Consulta'}</strong>
                        <span>({srv?.duracionMin} min)</span>
                        <span>·</span>
                        <span className="font-semibold tabular-nums text-slate-900">
                          {formatearMoneda(turno.precioCentavos)}
                        </span>
                        <span>·</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[11px]">
                          {turno.pacienteCobertura || 'Particular'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          {turno.modalidad === 'presencial' ? (
                            <>
                              <MapPin className="w-3.5 h-3.5 text-sky-600" />
                              <span>{loc?.nombre || 'Consultorio Presencial'}</span>
                            </>
                          ) : (
                            <>
                              <Video className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-medium">Videollamada por WhatsApp</span>
                            </>
                          )}
                        </span>

                        {turno.esSobreturno && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                            Sobreturno
                          </span>
                        )}

                        {turno.motivo && (
                          <span className="text-slate-500 italic max-w-md truncate">
                            «{turno.motivo}»
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bloque Derecho: Controles de Estado, Pago y WhatsApp (Regla 1.6) */}
                  <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    
                    {/* Badge / Botón Comprobante Digital (Hito 2 - Arancel Completo) */}
                    {turno.comprobantePago ? (
                      <button
                        type="button"
                        onClick={() => {
                          setTurnoComprobante(turno);
                          setModoRechazarComp(false);
                          setMotivoRechazoComp('');
                          setModoSubirManual(false);
                          setFeedbackComprobante(null);
                        }}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition-all shadow-2xs ${
                          turno.comprobantePago.estado === 'pendiente_revision'
                            ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200 animate-pulse'
                            : turno.comprobantePago.estado === 'aprobado'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                        }`}
                        title="Ver comprobante de transferencia del arancel completo"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {turno.comprobantePago.estado === 'pendiente_revision'
                            ? '💳 Revisar Comprobante'
                            : turno.comprobantePago.estado === 'aprobado'
                            ? '✓ Comprobante Aprobado'
                            : '✗ Comprobante Rechazado'}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setTurnoComprobante(turno);
                          setModoRechazarComp(false);
                          setMotivoRechazoComp('');
                          setModoSubirManual(true);
                          setFeedbackComprobante(null);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-800 hover:bg-slate-50 text-xs font-semibold cursor-pointer transition-all"
                        title="Adjuntar o registrar comprobante de pago digital"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>Adjuntar pago</span>
                      </button>
                    )}

                    {/* Checkbox Confirmado / Pagado */}
                    <label
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-all ${
                        estaPagado
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={estaPagado}
                        onChange={e => setAppointmentPayment(turno.id, e.target.checked)}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>{estaPagado ? 'Pagado ✓' : 'Marcar Pagado'}</span>
                    </label>

                    {/* Botón WhatsApp Confirmar */}
                    <button
                      type="button"
                      disabled={estaPagado || esTerminal}
                      onClick={() => handleEnviarWhatsApp(turno, 'confirmacion')}
                      title="Enviar confirmación y datos de pago por WhatsApp"
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        estaPagado || esTerminal
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:bg-emerald-50 text-emerald-700 border-emerald-200 hover:border-emerald-300'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Confirmar</span>
                    </button>

                    {/* Botón WhatsApp Recordar */}
                    <button
                      type="button"
                      disabled={esTerminal}
                      onClick={() => handleEnviarWhatsApp(turno, 'recordatorio')}
                      title="Enviar recordatorio de turno por WhatsApp"
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                        esTerminal
                          ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                          : 'bg-white hover:bg-sky-50 text-sky-700 border-sky-200 hover:border-sky-300'
                      }`}
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>Recordar</span>
                    </button>

                    {/* Selector de Estado del Turno */}
                    <div className="relative">
                      <select
                        value={turno.estado}
                        onChange={e => {
                          const nuevoEstado = e.target.value as EstadoTurno;
                          if (nuevoEstado === 'cancelado') {
                            if (!window.confirm('¿Confirmás cancelar este turno? Se liberará el horario.')) return;
                          }
                          changeAppointmentStatus(turno.id, nuevoEstado);
                        }}
                        className={`text-xs font-bold py-1.5 px-3 rounded-lg border outline-none cursor-pointer appearance-none pr-7 ${
                          turno.estado === 'pendiente'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : turno.estado === 'atendido'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : turno.estado === 'ausente'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : turno.estado === 'cancelado'
                            ? 'bg-slate-100 text-slate-600 border-slate-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        <option value="pendiente">Pendiente</option>
                        <option value="atendido">Atendido</option>
                        <option value="ausente">Ausente</option>
                        <option value="cancelado">Cancelado</option>
                        <option value="reprogramado" disabled>Reprogramado</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
                    </div>

                    {/* Botón Reprogramar */}
                    {!esTerminal && (
                      <button
                        type="button"
                        onClick={() => {
                          setTurnoAReprogramar(turno);
                          setNuevaFecha(turno.inicio.slice(0, 10));
                          setNuevaHora(turno.inicio.slice(11, 16));
                          setEsSobreturnoReprog(false);
                          setErrorReprog('');
                        }}
                        title="Reprogramar fecha u horario"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    )}

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* MODAL DE REPROGRAMACIÓN SUJETO A HORARIOS & ESPECIALIDAD */}
      {turnoAReprogramar && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto p-6 shadow-2xl border border-slate-200">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-sky-600" />
                  <span>Reprogramar Turno</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Los nuevos horarios están sujetos a las disponibilidades cargadas en <strong>Horarios & Especialidad</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTurnoAReprogramar(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Tarjeta del Turno Original */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 mb-4 flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">{turnoAReprogramar.pacienteNombre}</div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  {servicioTurnoReprog?.nombre || 'Consulta'} ({servicioTurnoReprog?.duracionMin || 30} min) ·{' '}
                  <span className="capitalize">{turnoAReprogramar.modalidad}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">Turno actual</span>
                <span className="font-semibold text-slate-800">
                  {formatearFechaCorta(turnoAReprogramar.inicio)} a las {formatearHora(turnoAReprogramar.inicio)}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmarReprogramacion} className="space-y-4">
              {/* Selección de Fecha */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Nueva Fecha *
                  </label>
                  {/* Atajos de Fecha */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const hoy = new Date().toISOString().slice(0, 10);
                        setNuevaFecha(hoy);
                        setErrorReprog('');
                      }}
                      className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const manana = new Date();
                        manana.setDate(manana.getDate() + 1);
                        setNuevaFecha(manana.toISOString().slice(0, 10));
                        setErrorReprog('');
                      }}
                      className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      Mañana
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const proxSem = new Date();
                        proxSem.setDate(proxSem.getDate() + 7);
                        setNuevaFecha(proxSem.toISOString().slice(0, 10));
                        setErrorReprog('');
                      }}
                      className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                    >
                      +7 días
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  required
                  value={nuevaFecha}
                  onChange={e => {
                    setNuevaFecha(e.target.value);
                    setErrorReprog('');
                  }}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                />
              </div>

              {/* Banner de Jornada Diaria / No Laborable */}
              {disponibilidadReprog && (
                <div>
                  {!disponibilidadReprog.isWorkingDay ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Día sin atención médica configurada:</strong>
                        <p className="mt-0.5">{disponibilidadReprog.reasonUnavailable}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 bg-sky-50/80 border border-sky-200/80 rounded-xl text-xs text-sky-950 flex items-start gap-2">
                      <Calendar className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">{disponibilidadReprog.diaNombre}:</span>{' '}
                        <span>{disponibilidadReprog.franjasTexto}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Grilla de Huecos Libres Disponibles */}
              {disponibilidadReprog?.isWorkingDay && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Horarios disponibles para {nuevaFecha}:
                    </label>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {disponibilidadReprog.slots.length} huecos libres
                    </span>
                  </div>

                  {disponibilidadReprog.slots.length > 0 ? (
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl max-h-44 overflow-y-auto">
                      <div className="flex flex-wrap gap-1.5">
                        {disponibilidadReprog.slots.map(s => {
                          const isSelected = nuevaHora === s.hora;
                          return (
                            <button
                              key={s.inicio}
                              type="button"
                              onClick={() => {
                                setNuevaHora(s.hora);
                                setErrorReprog('');
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/30'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                              }`}
                            >
                              {s.hora} hs
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                      No hay turnos libres disponibles en la configuración para esta fecha.
                    </div>
                  )}
                </div>
              )}

              {/* Nueva Hora con Validación en Tiempo Real */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hora de Inicio *
                </label>
                <input
                  type="time"
                  required
                  value={nuevaHora}
                  onChange={e => {
                    setNuevaHora(e.target.value);
                    setErrorReprog('');
                  }}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600"
                />

                {/* Feedback de validación en tiempo real */}
                {validacionHoraReprog && (
                  <div
                    className={`mt-2 p-2.5 rounded-xl text-xs flex items-start gap-2 ${
                      validacionHoraReprog.valido
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border border-rose-200 text-rose-900'
                    }`}
                  >
                    {validacionHoraReprog.valido ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <span className="leading-snug">{validacionHoraReprog.mensaje}</span>
                  </div>
                )}
              </div>

              {/* Sobreturno como Excepción */}
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 cursor-pointer bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                  <input
                    type="checkbox"
                    checked={esSobreturnoReprog}
                    onChange={e => {
                      setEsSobreturnoReprog(e.target.checked);
                      setErrorReprog('');
                    }}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Habilitar como Sobreturno / Excepción de agenda</span>
                </label>
                {esSobreturnoReprog && (
                  <p className="text-[11px] text-amber-700 mt-1 pl-1">
                    Se forzará la reprogramación como excepción médica fuera de la grilla habitual.
                  </p>
                )}
              </div>

              {/* Mensaje de error general si ocurre */}
              {errorReprog && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorReprog}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600">
                Al confirmar, el turno original pasará a estado <strong>Reprogramado</strong> y quedará vinculado al nuevo horario.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTurnoAReprogramar(null);
                    setErrorReprog('');
                    setEsSobreturnoReprog(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!esSobreturnoReprog && validacionHoraReprog ? !validacionHoraReprog.valido : false}
                  className={`px-4 py-2 text-xs font-bold rounded-lg shadow-xs transition-all ${
                    !esSobreturnoReprog && validacionHoraReprog && !validacionHoraReprog.valido
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-sky-600 text-white hover:bg-sky-700 cursor-pointer'
                  }`}
                >
                  Confirmar Reprogramación
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          MODAL COMPROBANTE DE PAGO DIGITAL (HITO 2 - ARANCEL COMPLETO)
         ======================================================== */}
      {turnoComprobanteActual && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">
                    Comprobante de Pago Digital
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Arancel Completo (100%) · Consulta médica
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTurnoComprobante(null);
                  setModoRechazarComp(false);
                  setMotivoRechazoComp('');
                  setFeedbackComprobante(null);
                  setModoSubirManual(false);
                  setPreviewManual(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Feedback Message */}
            {feedbackComprobante && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{feedbackComprobante}</span>
              </div>
            )}

            {/* Resumen del Turno & Paciente */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs space-y-2 mb-5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Paciente:</span>
                <strong className="text-slate-900 text-sm">{turnoComprobanteActual.pacienteNombre}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[11px]">DNI:</span>
                  <span className="font-semibold text-slate-800">{turnoComprobanteActual.pacienteDni}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Teléfono WhatsApp:</span>
                  <span className="font-semibold text-slate-800">{turnoComprobanteActual.pacienteTelefono}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Servicio:</span>
                  <span className="font-semibold text-slate-800">
                    {services.find(s => s.id === turnoComprobanteActual.serviceId)?.nombre || 'Consulta'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Fecha y Hora:</span>
                  <span className="font-semibold text-slate-800">
                    {formatearFechaLarga(turnoComprobanteActual.inicio)} · {formatearHora(turnoComprobanteActual.inicio)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                <span className="text-slate-600 font-medium">Arancel Completo de la consulta:</span>
                <span className="text-base font-black text-slate-900 tabular-nums">
                  {formatearMoneda(turnoComprobanteActual.precioCentavos)}
                </span>
              </div>
            </div>

            {/* Estado del Comprobante si ya existe */}
            {turnoComprobanteActual.comprobantePago && !modoSubirManual ? (
              <div className="space-y-4">
                
                {/* Banner de Estado */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border text-xs">
                  <div className="flex items-center gap-2.5">
                    {turnoComprobanteActual.comprobantePago.estado === 'pendiente_revision' && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                    )}
                    <div>
                      <span className="font-bold block">
                        {turnoComprobanteActual.comprobantePago.estado === 'pendiente_revision'
                          ? 'Comprobante pendiente de revisión'
                          : turnoComprobanteActual.comprobantePago.estado === 'aprobado'
                          ? 'Comprobante verificado y aprobado'
                          : 'Comprobante rechazado'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Monto transferido: {formatearMoneda(turnoComprobanteActual.comprobantePago.montoCentavos)} (100% Arancel Completo)
                      </span>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                    turnoComprobanteActual.comprobantePago.estado === 'pendiente_revision'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300'
                      : turnoComprobanteActual.comprobantePago.estado === 'aprobado'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border border-rose-300'
                  }`}>
                    {turnoComprobanteActual.comprobantePago.estado === 'pendiente_revision'
                      ? 'Por Revisar'
                      : turnoComprobanteActual.comprobantePago.estado === 'aprobado'
                      ? 'Aprobado ✓'
                      : 'Rechazado ✗'}
                  </span>
                </div>

                {/* Notas de revisión si existen */}
                {turnoComprobanteActual.comprobantePago.notasRevision && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                    <strong className="block text-slate-700 mb-0.5">Observación registrada:</strong>
                    <span>{turnoComprobanteActual.comprobantePago.notasRevision}</span>
                  </div>
                )}

                {/* Previsualizador de Comprobante / Ticket de Transferencia */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-900 text-white shadow-inner">
                  <div className="bg-slate-800/80 px-4 py-2 border-b border-slate-700 flex items-center justify-between text-xs text-slate-300">
                    <span className="font-mono truncate">{turnoComprobanteActual.comprobantePago.nombreArchivo || 'comprobante-transferencia.jpg'}</span>
                    <button
                      type="button"
                      onClick={() => setImagenAmpliada(true)}
                      className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ampliar</span>
                    </button>
                  </div>

                  <div className="p-4 flex items-center justify-center bg-slate-950/60 min-h-[220px]">
                    {turnoComprobanteActual.comprobantePago.url ? (
                      <img
                        src={turnoComprobanteActual.comprobantePago.url}
                        alt="Comprobante de pago"
                        onClick={() => setImagenAmpliada(true)}
                        className="max-h-[260px] object-contain rounded-lg shadow-md cursor-pointer hover:opacity-95 transition-opacity"
                      />
                    ) : (
                      /* Voucher digital estilizado */
                      <div className="bg-white text-slate-900 p-5 rounded-xl max-w-sm w-full font-mono text-xs shadow-lg space-y-2">
                        <div className="text-center pb-2 border-b border-slate-200">
                          <p className="font-black text-sm text-sky-900">COMPROBANTE DE TRANSFERENCIA</p>
                          <p className="text-[10px] text-slate-500">Acreditación Inmediata</p>
                        </div>
                        <div className="space-y-1 text-[11px]">
                          <div><span className="text-slate-400">Destino:</span> {professional.titularCobro}</div>
                          <div><span className="text-slate-400">Alias:</span> {professional.aliasCobro}</div>
                          <div><span className="text-slate-400">CBU:</span> {professional.cbu || '0070012300000045892147'}</div>
                          <div className="pt-2 border-t border-slate-100 flex justify-between font-bold text-sm text-emerald-700">
                            <span>Importe:</span>
                            <span>{formatearMoneda(turnoComprobanteActual.comprobantePago.montoCentavos)}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pt-1">
                            Subido: {new Date(turnoComprobanteActual.comprobantePago.subidoEn).toLocaleString('es-AR')}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones de Revisión */}
                <div className="pt-2 space-y-3">
                  
                  {/* Si está en modo de rechazo */}
                  {modoRechazarComp ? (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl space-y-2">
                      <label className="block text-xs font-bold text-rose-900">
                        Motivo del rechazo del comprobante:
                      </label>
                      <input
                        type="text"
                        value={motivoRechazoComp}
                        onChange={e => setMotivoRechazoComp(e.target.value)}
                        placeholder="Ej. Monto insuficiente, transferencia no impactó, imagen ilegible"
                        className="w-full p-2 bg-white border border-rose-300 rounded-lg text-xs outline-none focus:ring-1 focus:ring-rose-500"
                      />
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => setMotivoRechazoComp('Transferencia aún no acreditada en cuenta bancaria')}
                          className="text-[10px] bg-white border border-rose-200 px-2 py-0.5 rounded text-rose-700 hover:bg-rose-100"
                        >
                          No acreditada
                        </button>
                        <button
                          type="button"
                          onClick={() => setMotivoRechazoComp('Comprobante borroso o ilegible')}
                          className="text-[10px] bg-white border border-rose-200 px-2 py-0.5 rounded text-rose-700 hover:bg-rose-100"
                        >
                          Borroso / Ilegible
                        </button>
                        <button
                          type="button"
                          onClick={() => setMotivoRechazoComp('El importe no coincide con el arancel completo')}
                          className="text-[10px] bg-white border border-rose-200 px-2 py-0.5 rounded text-rose-700 hover:bg-rose-100"
                        >
                          Importe incorrecto
                        </button>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setModoRechazarComp(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            reviewPaymentProof(
                              turnoComprobanteActual.id,
                              'rechazado',
                              motivoRechazoComp || 'Comprobante no válido o ilegible'
                            );
                            setFeedbackComprobante('Comprobante marcado como rechazado.');
                            setModoRechazarComp(false);
                          }}
                          className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                        >
                          Confirmar Rechazo
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            reviewPaymentProof(turnoComprobanteActual.id, 'aprobado');
                            setAppointmentPayment(turnoComprobanteActual.id, true);
                            setFeedbackComprobante('¡Pago aprobado y consulta marcada como Pagada!');
                          }}
                          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Aprobar Pago (Arancel Completo)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setModoRechazarComp(true)}
                          className="px-3.5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 hover:border-rose-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        >
                          Rechazar...
                        </button>
                      </div>

                      {/* Notificar por WhatsApp */}
                      <button
                        type="button"
                        onClick={() => {
                          const srvNom = services.find(s => s.id === turnoComprobanteActual.serviceId)?.nombre || 'consulta médica';
                          const msg = `Hola ${turnoComprobanteActual.pacienteNombre}, te confirmamos que recibimos y acreditamos correctamente tu comprobante de pago del arancel completo (${formatearMoneda(turnoComprobanteActual.precioCentavos)}) para tu turno de ${srvNom} del día ${formatearFechaLarga(turnoComprobanteActual.inicio)} a las ${formatearHora(turnoComprobanteActual.inicio)}. ¡Muchas gracias! ${professional.titulo} ${professional.nombre}`;
                          const urlWa = `https://wa.me/${turnoComprobanteActual.pacienteTelefono}?text=${encodeURIComponent(msg)}`;
                          window.open(urlWa, '_blank');
                        }}
                        className="px-3.5 py-2.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Notificar por WhatsApp</span>
                      </button>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs">
                    <button
                      type="button"
                      onClick={() => setModoSubirManual(true)}
                      className="text-sky-700 hover:underline font-semibold"
                    >
                      Reemplazar / Subir nuevo archivo...
                    </button>
                    <button
                      type="button"
                      onClick={() => setTurnoComprobante(null)}
                      className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer font-medium"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              /* MODO ADJUNTAR / SUBIR COMPROBANTE MANUALMENTE */
              <div className="space-y-4">
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-xs text-sky-900 leading-relaxed">
                  <strong>Adjuntar comprobante de pago:</strong> Podés cargar la captura de transferencia o ticket recibido del paciente. Al guardar, quedará vinculado al turno y podrá ser auditado en el historial y en Google Sheets.
                </div>

                <div className="border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center hover:border-sky-500 transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    id="archivo-comprobante-input"
                    accept="image/*,.pdf"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          setPreviewManual(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="archivo-comprobante-input"
                    className="cursor-pointer flex flex-col items-center justify-center gap-2"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center shadow-xs">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-sky-700 block">
                        Seleccionar imagen del comprobante
                      </span>
                      <span className="text-[11px] text-slate-500">
                        JPG, PNG o foto de ticket bancario
                      </span>
                    </div>
                  </label>
                </div>

                {previewManual && (
                  <div className="border border-slate-200 rounded-xl p-3 bg-white text-xs">
                    <p className="font-bold text-slate-700 mb-2">Vista previa seleccionada:</p>
                    <img
                      src={previewManual}
                      alt="Preview"
                      className="max-h-48 mx-auto rounded-lg object-contain shadow-xs border border-slate-100"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setModoSubirManual(false);
                      setPreviewManual(null);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const urlAUsar =
                        previewManual ||
                        'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=600&q=80';
                      uploadPaymentProof(turnoComprobanteActual.id, {
                        url: urlAUsar,
                        nombreArchivo: 'comprobante-arancel-completo.jpg',
                        montoCentavos: turnoComprobanteActual.precioCentavos,
                      });
                      setModoSubirManual(false);
                      setFeedbackComprobante('Comprobante adjuntado con éxito.');
                    }}
                    className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Guardar Comprobante
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* LIGHTBOX DE IMAGEN AMPLIADA */}
      {imagenAmpliada && turnoComprobanteActual?.comprobantePago?.url && (
        <div
          onClick={() => setImagenAmpliada(false)}
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={turnoComprobanteActual.comprobantePago.url}
              alt="Comprobante ampliado"
              className="max-h-[85vh] max-w-full object-contain rounded-xl shadow-2xl"
            />
            <span className="text-xs text-white/80 mt-3 font-semibold">
              Tocar en cualquier parte para cerrar
            </span>
          </div>
        </div>
      )}

    </div>
  );
};
