import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Video,
  User,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  CalendarPlus,
  Send,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Smartphone,
  Info,
  Check,
  Download,
  X,
  Share,
  PlusSquare,
  ExternalLink,
  CreditCard,
  Copy,
  Search,
  FileText,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { usePWAInstall } from '../../modules/usePWAInstall';
import { calculateAvailability } from '../../modules/availability';
import {
  formatearFechaLarga,
  formatearHora,
  formatearMoneda,
  normalizarTelefonoArgentino,
  validarDni,
} from '../../modules/format';
import {
  construirEnlaceWhatsApp,
  prepararVariablesDesdeTurno,
  resolverPlantillaMensaje,
} from '../../modules/messaging';
import { generarArchivoIcs } from '../../modules/calendar';
import { Appointment, HuecoDisponibilidad, Modalidad, Service } from '../../types';
import { traducirErrorBase } from '../../data/mappers';
import { INITIAL_LOCATIONS } from '../../data/mockData';

export const PatientPortal: React.FC = () => {
  const {
    professional,
    locations,
    services,
    workingHours,
    holidays,
    timeOffs,
    coverages,
    appointments,
    holds,
    templates,
    sessionToken,
    createHold,
    releaseHold,
    bookAppointment,
    uploadPaymentProof,
    portalCrearHold,
    portalConfirmarTurno,
    portalVerTurno,
    portalCancelarTurno,
    portalReprogramarTurno,
  } = useApp();

  // Estados del flujo de reserva
  const [paso, setPaso] = useState<1 | 2 | 3 | 4>(1);
  const [servicioSeleccionado, setServicioSeleccionado] = useState<Service | null>(null);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>('');
  const [huecoSeleccionado, setHuecoSeleccionado] = useState<HuecoDisponibilidad | null>(null);
  const [modalidadElegida, setModalidadElegida] = useState<Modalidad>('presencial');
  const [direccionElegidaId, setDireccionElegidaId] = useState<string>(locations[0]?.id || '');
  const [holdActivoId, setHoldActivoId] = useState<string | null>(null);
  const [tiempoRestanteHold, setTiempoRestanteHold] = useState<number>(600); // 10 min en segundos

  // Consultorio de atención presencial resuelto de forma determinista y reactiva
  const consultorioPresencial = useMemo(() => {
    // 1. Si el hueco seleccionado tiene una ubicación específica configurada
    if (huecoSeleccionado?.locationIds && huecoSeleccionado.locationIds.length > 0) {
      const locHueco = locations.find(l => l.id === huecoSeleccionado.locationIds[0]);
      if (locHueco) return locHueco;
    }
    // 2. Si el usuario seleccionó una ubicación específica en el selector
    if (direccionElegidaId) {
      const locElegida = locations.find(l => l.id === direccionElegidaId);
      if (locElegida) return locElegida;
    }
    // 3. Primera ubicación activa en la lista
    const locActiva = locations.find(l => l.activa);
    if (locActiva) return locActiva;
    // 4. Primera ubicación en lista
    if (locations.length > 0) return locations[0];
    // 5. Fallback canónico si no hubiese sedes en memoria
    return INITIAL_LOCATIONS[0];
  }, [huecoSeleccionado, direccionElegidaId, locations]);

  // Mantener direccionElegidaId sincronizado reactivamente con consultorioPresencial
  useEffect(() => {
    if (consultorioPresencial?.id && (!direccionElegidaId || !locations.some(l => l.id === direccionElegidaId))) {
      setDireccionElegidaId(consultorioPresencial.id);
    }
  }, [consultorioPresencial?.id, direccionElegidaId, locations]);

  // Sedes disponibles para el hueco seleccionado en Paso 2
  const ubicacionesPresencialesDisponibles = useMemo(() => {
    if (!huecoSeleccionado) return [];
    if (huecoSeleccionado.locationIds && huecoSeleccionado.locationIds.length > 0) {
      const filtradas = locations.filter(l => l.activa && huecoSeleccionado.locationIds.includes(l.id));
      if (filtradas.length > 0) return filtradas;
    }
    return locations.filter(l => l.activa);
  }, [huecoSeleccionado, locations]);

  // Formulario del Paciente (Paso 3)
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [coberturaId, setCoberturaId] = useState<string>(''); // "" = Particular (sin obra social)
  const [plan, setPlan] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [aceptaConsentimiento, setAceptaConsentimiento] = useState(false);
  const [erroresFormulario, setErroresFormulario] = useState<Record<string, string>>({});

  // Turno confirmado (Paso 4)
  const [turnoConfirmado, setTurnoConfirmado] = useState<Appointment | null>(null);

  // Estados de Pagos Digitales (Hito 2 - Arancel Completo)
  const [copiadoAlias, setCopiadoAlias] = useState(false);
  const [copiadoCbu, setCopiadoCbu] = useState(false);
  const [previewComprobante, setPreviewComprobante] = useState<string | null>(null);
  const [nombreArchivoSubido, setNombreArchivoSubido] = useState<string>('comprobante-transferencia.jpg');
  const [feedbackComprobantePaciente, setFeedbackComprobantePaciente] = useState<string | null>(null);

  // Modal para consultar / autogestión de turnos reservados (Soporta búsqueda por DNI o Manage Token)
  const [modalConsultarTurno, setModalConsultarTurno] = useState(false);
  const [dniConsulta, setDniConsulta] = useState('');
  const [dniPacienteConsultado, setDniPacienteConsultado] = useState<string | null>(null);
  const [turnoSeleccionadoParaReprogramar, setTurnoSeleccionadoParaReprogramar] = useState<Appointment | null>(null);
  const [turnoSeleccionadoParaCancelar, setTurnoSeleccionadoParaCancelar] = useState<Appointment | null>(null);
  const [errorConsulta, setErrorConsulta] = useState('');
  const [modoReprogramar, setModoReprogramar] = useState(false);
  const [fechaReprogramar, setFechaReprogramar] = useState('');
  const [huecoReprogramar, setHuecoReprogramar] = useState<HuecoDisponibilidad | null>(null);
  const [modalidadReprogramar, setModalidadReprogramar] = useState<Modalidad>('presencial');
  const [sedeReprogramarId, setSedeReprogramarId] = useState<string>('');
  const [motivoCancelacion, setMotivoCancelacion] = useState('');
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false);
  const [mensajeExitoAutogestion, setMensajeExitoAutogestion] = useState<string | null>(null);

  // Turno confirmado sincronizado reactivamente
  const turnoConfirmadoActual = useMemo(() => {
    if (!turnoConfirmado) return null;
    return appointments.find(a => a.id === turnoConfirmado.id) || turnoConfirmado;
  }, [turnoConfirmado, appointments]);

  // Turnos reservados en el período de "Horizonte máximo de reserva" para el paciente consultado
  const horizonteDias = professional.parametros.horizonteDias || 30;

  const turnosConsultados = useMemo(() => {
    if (!dniPacienteConsultado) return [];

    // Inicio del horizonte: inicio del día actual (00:00:00)
    const inicioHorizonte = new Date();
    inicioHorizonte.setHours(0, 0, 0, 0);

    // Fin del horizonte: hoy + horizonteDias (23:59:59.999)
    const finHorizonte = new Date(inicioHorizonte);
    finHorizonte.setDate(finHorizonte.getDate() + horizonteDias);
    finHorizonte.setHours(23, 59, 59, 999);

    const inicioMs = inicioHorizonte.getTime();
    const finMs = finHorizonte.getTime();

    // Turnos reservados = activos, no cancelados y no reprogramados dentro del horizonte
    return appointments
      .filter(a => {
        if (a.pacienteDni !== dniPacienteConsultado) return false;
        if (a.estado === 'cancelado' || a.estado === 'reprogramado') return false;
        const appIni = new Date(a.inicio).getTime();
        return appIni >= inicioMs && appIni <= finMs;
      })
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
  }, [dniPacienteConsultado, appointments, horizonteDias]);

  // Último turno agendado dentro del horizonte (único candidato a reprogramación si es Pendiente)
  const ultimoTurnoReservado = useMemo(() => {
    if (turnosConsultados.length === 0) return null;
    return turnosConsultados[turnosConsultados.length - 1];
  }, [turnosConsultados]);

  // Turno en reprogramación sincronizado reactivamente
  const turnoReprogramandoActual = useMemo(() => {
    if (!turnoSeleccionadoParaReprogramar) return null;
    return appointments.find(a => a.id === turnoSeleccionadoParaReprogramar.id) || turnoSeleccionadoParaReprogramar;
  }, [turnoSeleccionadoParaReprogramar, appointments]);

  // Historial de otros turnos del paciente (anteriores o cancelados)
  const historialOtrosTurnos = useMemo(() => {
    if (!dniPacienteConsultado) return [];
    return appointments.filter(
      a => a.pacienteDni === dniPacienteConsultado && !turnosConsultados.some(tc => tc.id === a.id)
    );
  }, [dniPacienteConsultado, appointments, turnosConsultados]);

  // Vista en marco de celular vs full width
  const [modoMarcoMovil, setModoMarcoMovil] = useState(false);

  // Soporte PWA para el paciente
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [mostrarAlertaInstalar, setMostrarAlertaInstalar] = useState(false);
  const [mostrarGuiaPWA, setMostrarGuiaPWA] = useState(false);

  // Para el Portal del paciente: tamaño 'Estandar' por defecto, y botón en la esquina de 'aA' para pasar a 'Grande'
  const [tamanoFuentePaciente, setTamanoFuentePaciente] = useState<'estandar' | 'grande'>('estandar');

  useEffect(() => {
    // Al abrir el portal del paciente siempre inicia en 'predeterminado' (Estándar), o 'grande' si el paciente presiona aA
    const size = tamanoFuentePaciente === 'grande' ? 'grande' : 'predeterminado';
    document.documentElement.setAttribute('data-text-size', size);

    return () => {
      // Al salir del portal del paciente, restaurar el tamaño elegido por el profesional en su dashboard
      document.documentElement.setAttribute('data-text-size', professional.tamanoTexto || 'predeterminado');
    };
  }, [tamanoFuentePaciente, professional.tamanoTexto]);

  const toggleTamanoFuentePaciente = () => {
    setTamanoFuentePaciente(prev => (prev === 'grande' ? 'estandar' : 'grande'));
  };

  // Seleccionar primer servicio por defecto si no hay
  useEffect(() => {
    if (!servicioSeleccionado && services.length > 0) {
      const primerActivo = services.find(s => s.activo) || services[0];
      setServicioSeleccionado(primerActivo);
    }
  }, [services, servicioSeleccionado]);

  // Cálculo de disponibilidad en tiempo real usando el motor puro
  const diasDisponibles = useMemo(() => {
    if (!servicioSeleccionado) return [];
    return calculateAvailability({
      professional,
      service: servicioSeleccionado,
      workingHours,
      holidays,
      timeOffs,
      appointments,
      holds,
      currentSessionToken: sessionToken,
    });
  }, [professional, servicioSeleccionado, workingHours, holidays, timeOffs, appointments, holds, sessionToken]);

  // Seleccionar automáticamente la primera fecha con turnos
  useEffect(() => {
    if (diasDisponibles.length > 0 && !fechaSeleccionada) {
      setFechaSeleccionada(diasDisponibles[0].fecha);
    }
  }, [diasDisponibles, fechaSeleccionada]);

  // Manejo del cronómetro del Hold (10 minutos)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (holdActivoId && tiempoRestanteHold > 0 && paso === 3) {
      timer = setInterval(() => {
        setTiempoRestanteHold(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            alert('El tiempo de reserva de 10 minutos ha expirado. Por favor selecciona el horario nuevamente.');
            setPaso(2);
            setHoldActivoId(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [holdActivoId, tiempoRestanteHold, paso]);

  const diaActualObj = diasDisponibles.find(d => d.fecha === fechaSeleccionada);

  // Separar huecos en Mañana y Tarde
  const { huecosManana, huecosTarde } = useMemo(() => {
    if (!diaActualObj) return { huecosManana: [], huecosTarde: [] };
    const manana = diaActualObj.huecos.filter(h => {
      const hora = new Date(h.inicio).getHours();
      return hora < 13;
    });
    const tarde = diaActualObj.huecos.filter(h => {
      const hora = new Date(h.inicio).getHours();
      return hora >= 13;
    });
    return { huecosManana: manana, huecosTarde: tarde };
  }, [diaActualObj]);

  const buscarTurnoPorTokenOId = async (tokenOId: string) => {
    try {
      const cleanToken = tokenOId.trim();
      const appt = appointments.find(
        a =>
          a.manageToken === cleanToken ||
          a.id === cleanToken ||
          a.id.slice(4).toUpperCase() === cleanToken.replace('#', '').toUpperCase()
      );
      if (appt) {
        setDniConsulta(appt.pacienteDni);
        setDniPacienteConsultado(appt.pacienteDni);
        setModalConsultarTurno(true);
        setErrorConsulta('');
        return true;
      }
      const res = await portalVerTurno({ p_token: cleanToken });
      if (res && res.turno_id) {
        const found = appointments.find(a => a.id === res.turno_id || a.manageToken === cleanToken);
        if (found) {
          setDniConsulta(found.pacienteDni);
          setDniPacienteConsultado(found.pacienteDni);
          setModalConsultarTurno(true);
          setErrorConsulta('');
          return true;
        }
      }
    } catch (e: any) {
      setErrorConsulta(traducirErrorBase(e?.message || 'turno_no_encontrado'));
    }
    return false;
  };

  useEffect(() => {
    const checkHash = () => {
      const hash = window.location.hash;
      if (hash.includes('/turno/')) {
        const token = hash.split('/turno/')[1]?.split('?')[0];
        if (token) {
          buscarTurnoPorTokenOId(token);
        }
      }
    };
    checkHash();
    window.addEventListener('hashchange', checkHash);
    return () => window.removeEventListener('hashchange', checkHash);
  }, [appointments]);

  // Avanzar del Paso 2 al Paso 3 creando la Reserva Temporal (Hold vía RPC de portal)
  const handleAvanzarPaso3 = async () => {
    if (!huecoSeleccionado || !servicioSeleccionado) return;

    try {
      const res = await portalCrearHold({
        p_ref: professional.slug,
        p_servicio_id: servicioSeleccionado.id,
        p_inicio: huecoSeleccionado.inicio,
        p_modalidad: modalidadElegida,
        p_sede_id: modalidadElegida === 'presencial' ? (direccionElegidaId || consultorioPresencial.id) : undefined,
        p_session_id: sessionToken,
      });

      if (!res || !res.hold_id) {
        alert(traducirErrorBase('horario_ocupado'));
        return;
      }

      setHoldActivoId(res.hold_id);
      setTiempoRestanteHold(600); // 10 min
      setPaso(3);
    } catch (err: any) {
      alert(traducirErrorBase(err?.message || 'horario_ocupado'));
    }
  };

  // Enviar y Confirmar Turno (Paso 3 -> Paso 4 vía RPC de portal)
  const handleConfirmarReserva = async (e: React.FormEvent) => {
    e.preventDefault();
    const errores: Record<string, string> = {};

    if (!nombre.trim()) errores.nombre = 'Ingresá tu nombre y apellido.';
    
    const validDni = validarDni(dni);
    if (!validDni.valido) errores.dni = 'Revisá el DNI: son 7 u 8 números, sin puntos.';

    const normTel = normalizarTelefonoArgentino(telefono);
    if (!normTel.valido) {
      errores.telefono = 'Revisá el número: tiene que ser un celular argentino (ej. 11 2345-6789).';
    }

    if (!aceptaConsentimiento) {
      errores.consentimiento = 'Para reservar necesitás aceptar el tratamiento de datos.';
    }

    if (Object.keys(errores).length > 0) {
      setErroresFormulario(errores);
      return;
    }

    if (!servicioSeleccionado || !huecoSeleccionado) return;

    try {
      const res = await portalConfirmarTurno({
        p_ref: professional.slug,
        p_hold_id: holdActivoId || '',
        p_session_id: sessionToken,
        p_dni: validDni.dni,
        p_nombre: nombre.trim(),
        p_telefono_e164: normTel.e164,
        p_email: email.trim() || undefined,
        p_cobertura_id: coberturaId ? coberturaId : null,
        p_plan: plan.trim() || undefined,
        p_nro_afiliado: nroAfiliado.trim() || undefined,
        p_motivo: motivo.trim() || undefined,
      });

      if (!res || !res.turno_id) {
        alert(traducirErrorBase('error_general'));
        return;
      }

      const apptConfirmado: Appointment = appointments.find(a => a.id === res.turno_id) || {
        id: res.turno_id,
        professionalId: professional.id,
        patientId: 'pat_' + validDni.dni,
        serviceId: servicioSeleccionado.id,
        locationId: modalidadElegida === 'presencial' ? (direccionElegidaId || consultorioPresencial.id) : undefined,
        pacienteNombre: nombre.trim(),
        pacienteDni: validDni.dni,
        pacienteTelefono: normTel.e164,
        pacienteEmail: email.trim() || undefined,
        pacienteCobertura: coverages.find(c => c.id === coberturaId)?.nombre || 'Particular',
        pacientePlan: plan.trim() || undefined,
        pacienteAfiliado: nroAfiliado.trim() || undefined,
        inicio: res.inicio || huecoSeleccionado.inicio,
        fin: res.fin || huecoSeleccionado.fin,
        estado: 'pendiente',
        estadoPago: 'sin_pago',
        precioCentavos: servicioSeleccionado.precioCentavos,
        origen: 'portal',
        esSobreturno: false,
        modalidad: (res.modalidad as Modalidad) || modalidadElegida,
        motivo: motivo.trim() || undefined,
        manageToken: res.manage_token,
        creadoEn: new Date().toISOString(),
      };

      setTurnoConfirmado(apptConfirmado);
      setPaso(4);
    } catch (err: any) {
      alert(traducirErrorBase(err?.message || 'error_general'));
    }
  };

  // Mensaje para confirmar por WhatsApp
  const mensajeWhatsApp = useMemo(() => {
    if (!turnoConfirmado) return '';
    const tpl = templates.find(t => t.tipo === 'confirmacion');
    const dir =
      locations.find(l => l.id === turnoConfirmado.locationId) ||
      (turnoConfirmado.modalidad === 'presencial' ? consultorioPresencial : undefined);
    const variables = prepararVariablesDesdeTurno(
      turnoConfirmado,
      professional,
      servicioSeleccionado || undefined,
      dir ? `${dir.nombre} · ${dir.direccion}` : undefined,
      dir?.mapsUrl
    );

    return resolverPlantillaMensaje(
      tpl?.cuerpo || '',
      tpl?.bloquePresencial || '',
      tpl?.bloqueVideollamada || '',
      variables
    );
  }, [turnoConfirmado, templates, locations, professional, servicioSeleccionado]);

  const enlaceWa = useMemo(() => {
    if (!turnoConfirmado || !mensajeWhatsApp) return null;
    return construirEnlaceWhatsApp(turnoConfirmado.pacienteTelefono, mensajeWhatsApp);
  }, [turnoConfirmado, mensajeWhatsApp]);

  const formatMinutosSegundos = (segundos: number) => {
    const m = Math.floor(segundos / 60);
    const s = segundos % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Disponibilidad para reprogramar el turno consultado
  const diasDisponiblesReprog = useMemo(() => {
    if (!turnoReprogramandoActual) return [];
    const srv = services.find(s => s.id === turnoReprogramandoActual.serviceId) || services[0];
    if (!srv) return [];
    return calculateAvailability({
      professional,
      service: srv,
      workingHours,
      holidays,
      timeOffs,
      appointments: appointments.filter(a => a.id !== turnoReprogramandoActual.id),
      holds,
      currentSessionToken: sessionToken,
      excludeAppointmentId: turnoReprogramandoActual.id,
    });
  }, [turnoReprogramandoActual, services, professional, workingHours, holidays, timeOffs, appointments, holds, sessionToken]);

  const diaReprogObj = useMemo(() => {
    if (!fechaReprogramar) return null;
    return diasDisponiblesReprog.find(d => d.fecha === fechaReprogramar) || null;
  }, [fechaReprogramar, diasDisponiblesReprog]);

  // Separar huecos de reprogramación en Mañana y Tarde
  const { huecosReprogManana, huecosReprogTarde } = useMemo(() => {
    if (!diaReprogObj) return { huecosReprogManana: [], huecosReprogTarde: [] };
    const manana = diaReprogObj.huecos.filter(h => {
      const hora = new Date(h.inicio).getHours();
      return hora < 13;
    });
    const tarde = diaReprogObj.huecos.filter(h => {
      const hora = new Date(h.inicio).getHours();
      return hora >= 13;
    });
    return { huecosReprogManana: manana, huecosReprogTarde: tarde };
  }, [diaReprogObj]);

  // Sedes disponibles para el hueco de reprogramación seleccionado
  const ubicacionesReprogPresenciales = useMemo(() => {
    if (!huecoReprogramar) return [];
    if (huecoReprogramar.locationIds && huecoReprogramar.locationIds.length > 0) {
      const filtradas = locations.filter(l => l.activa && huecoReprogramar.locationIds.includes(l.id));
      if (filtradas.length > 0) return filtradas;
    }
    return locations.filter(l => l.activa);
  }, [huecoReprogramar, locations]);

  // Consultorio presencial resuelto para reprogramación
  const consultorioReprogPresencial = useMemo(() => {
    if (huecoReprogramar?.locationIds && huecoReprogramar.locationIds.length > 0) {
      if (sedeReprogramarId && huecoReprogramar.locationIds.includes(sedeReprogramarId)) {
        const found = locations.find(l => l.id === sedeReprogramarId);
        if (found) return found;
      }
      const locHueco = locations.find(l => l.id === huecoReprogramar.locationIds[0]);
      if (locHueco) return locHueco;
    }
    if (sedeReprogramarId) {
      const found = locations.find(l => l.id === sedeReprogramarId);
      if (found) return found;
    }
    const locActiva = locations.find(l => l.activa);
    if (locActiva) return locActiva;
    return locations[0] || INITIAL_LOCATIONS[0];
  }, [huecoReprogramar, sedeReprogramarId, locations]);

  // Al abrir el modo reprogramar, autoseleccionar el primer día con turnos y la modalidad del turno actual
  useEffect(() => {
    if (modoReprogramar && diasDisponiblesReprog.length > 0) {
      if (!fechaReprogramar || !diasDisponiblesReprog.some(d => d.fecha === fechaReprogramar)) {
        setFechaReprogramar(diasDisponiblesReprog[0].fecha);
        setHuecoReprogramar(null);
      }
      if (turnoReprogramandoActual && !huecoReprogramar) {
        setModalidadReprogramar(turnoReprogramandoActual.modalidad);
        if (turnoReprogramandoActual.locationId) {
          setSedeReprogramarId(turnoReprogramandoActual.locationId);
        }
      }
    }
  }, [modoReprogramar, diasDisponiblesReprog]);

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6 flex flex-col items-center">
      
      {/* Botón flotante para alternar vista móvil y botón PWA */}
      <div className="w-full max-w-2xl mb-4 flex justify-between items-center text-xs text-slate-500">
        <div className="flex items-center gap-1.5 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Portal del Paciente en vivo (PWA)</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Botón aA para alternar entre tamaño Estándar y Grande */}
          <button
            type="button"
            onClick={toggleTamanoFuentePaciente}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-bold transition-all cursor-pointer shadow-2xs ${
              tamanoFuentePaciente === 'grande'
                ? 'bg-sky-600 border-sky-600 text-white'
                : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
            title={
              tamanoFuentePaciente === 'grande'
                ? 'Tamaño actual: Grande. Clic para volver a Estándar'
                : 'Aumentar tamaño de letra a Grande (aA)'
            }
          >
            <span className="text-xs font-black tracking-tight">aA</span>
            <span className="text-[11px] font-medium hidden sm:inline">
              {tamanoFuentePaciente === 'grande' ? 'Grande' : 'Estándar'}
            </span>
          </button>

          {!isInstalled && (
            <button
              type="button"
              onClick={() => setMostrarAlertaInstalar(true)}
              className="p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium shadow-2xs transition-colors cursor-pointer"
              title="Instalar App en tu dispositivo"
            >
              <Download className="w-4 h-4 text-sky-600" />
            </button>
          )}

          <button
            onClick={() => setModoMarcoMovil(!modoMarcoMovil)}
            className="flex items-center gap-1.5 px-3 py-1 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 font-medium shadow-2xs cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{modoMarcoMovil ? 'Ver pantalla completa' : 'Simular vista smartphone'}</span>
          </button>
        </div>
      </div>

      {/* Contenedor Principal (simulador de móvil o contenedor responsivo) */}
      <div
        className={`w-full bg-white transition-all shadow-md rounded-2xl border border-slate-200/80 overflow-hidden ${
          modoMarcoMovil
            ? 'max-w-[400px] border-4 border-slate-800 shadow-2xl rounded-3xl min-h-[750px]'
            : 'max-w-2xl'
        }`}
      >
        
        {/* CABECERA INSTITUCIONAL DEL PROFESIONAL (D-17: SIN TELÉFONO PRIVADO) */}
        <div className="bg-gradient-to-b from-sky-900 to-sky-800 text-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-sky-200 text-xs font-semibold tracking-wide uppercase">
                {professional.especialidad}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-0.5">
                {professional.titulo} {professional.nombre}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sky-100/90 mt-1.5">
                <span>M.N. {professional.matriculaNacional}</span>
                <span>·</span>
                <span>M.P. {professional.matriculaProvincial}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Botón en la esquina de 'aA' para pasar al tamaño 'Grande' */}
              <button
                type="button"
                onClick={toggleTamanoFuentePaciente}
                className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all cursor-pointer shadow-xs ${
                  tamanoFuentePaciente === 'grande'
                    ? 'bg-white text-sky-900 border-white font-black scale-105'
                    : 'bg-white/10 hover:bg-white/20 active:scale-95 text-white border-white/20 font-bold'
                }`}
                title={
                  tamanoFuentePaciente === 'grande'
                    ? 'Texto Grande activado. Tocar para volver a Estándar'
                    : 'Tocar para agrandar tamaño de texto (aA)'
                }
                aria-label="Alternar tamaño de texto entre Estándar y Grande"
              >
                <span className="text-xs sm:text-sm font-black tracking-tighter">aA</span>
              </button>

              {/* Botón de instalar app - SOLO con el ícono (con confirmación al tocar) */}
              {!isInstalled && (
                <button
                  type="button"
                  onClick={() => setMostrarAlertaInstalar(true)}
                  className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer shadow-xs"
                  title="Instalar App"
                  aria-label="Instalar App"
                >
                  <Download className="w-5 h-5 text-sky-200 hover:text-white" />
                </button>
              )}

              {/* Foto de perfil del profesional */}
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-white border border-white/20 shrink-0 overflow-hidden shadow-sm">
                {professional.fotoPerfil ? (
                  <img
                    src={professional.fotoPerfil}
                    alt={professional.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-6 h-6 text-sky-200" />
                )}
              </div>
            </div>
          </div>

          {/* Direcciones de atención */}
          <div className="mt-4 pt-3 border-t border-sky-700/60 flex flex-col gap-2 text-xs text-sky-100">
            {locations.filter(l => l.activa).map(loc => (
              <div key={loc.id} className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                  <span className="truncate">
                    <strong className="text-white font-semibold">{loc.nombre}:</strong> {loc.direccion}
                  </span>
                </div>
                {loc.mapsUrl && (
                  <a
                    href={loc.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 hover:text-white underline shrink-0 transition-colors"
                    title={`Abrir ${loc.nombre} en Google Maps`}
                  >
                    <span>Ver en Google Maps</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Fila de acción rápida: Consultar turno reservado o subir comprobante */}
          <div className="mt-3.5 pt-3 border-t border-sky-700/60 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs text-sky-100/90 font-medium">
              ¿Ya tenés un turno reservado?
            </span>
            <button
              type="button"
              onClick={() => {
                setModalConsultarTurno(true);
                setErrorConsulta('');
                setMensajeExitoAutogestion(null);
                setModoReprogramar(false);
                setTurnoSeleccionadoParaReprogramar(null);
                setMostrarModalCancelar(false);
                setTurnoSeleccionadoParaCancelar(null);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white border border-white/25 hover:border-white/40 text-xs font-semibold transition-all cursor-pointer shadow-xs"
              title="Consultar turnos reservados o autogestión"
            >
              <Search className="w-3.5 h-3.5 text-sky-200" />
              <span>Consultar mis turnos</span>
            </button>
          </div>

          {/* Estado de Agenda Pausada (Regla 1.4) */}
          {professional.agendaPausada && (
            <div className="mt-4 p-3 bg-amber-500/20 border border-amber-400/40 rounded-xl flex items-center gap-2 text-xs text-amber-100">
              <AlertCircle className="w-4 h-4 text-amber-300 shrink-0" />
              <span>La agenda online se encuentra pausada temporalmente. Por favor consultá más tarde.</span>
            </div>
          )}
        </div>

        {/* BARRA DE 3 PASOS (Si la agenda está pausada, no se muestra reserva) */}
        {professional.agendaPausada ? (
          <div className="p-8 text-center text-slate-600">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-slate-800">Agenda Pausada</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              El profesional no está recibiendo nuevas reservas online en este momento. Los turnos ya reservados se mantienen sin cambios.
            </p>
          </div>
        ) : (
          <>
            {paso < 4 && (
              <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-200">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <div
                    onClick={() => paso > 1 && setPaso(1)}
                    className={`flex items-center gap-1.5 cursor-pointer ${
                      paso === 1 ? 'text-sky-700' : 'text-slate-500'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                      paso === 1 ? 'bg-sky-600 text-white' : paso > 1 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {paso > 1 ? '✓' : '1'}
                    </span>
                    <span>Consulta</span>
                  </div>

                  <div className="h-0.5 flex-1 mx-2 bg-slate-200"></div>

                  <div
                    onClick={() => paso > 2 && setPaso(2)}
                    className={`flex items-center gap-1.5 ${
                      paso === 2 ? 'text-sky-700' : paso > 2 ? 'text-slate-700 cursor-pointer' : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                      paso === 2 ? 'bg-sky-600 text-white' : paso > 2 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {paso > 2 ? '✓' : '2'}
                    </span>
                    <span>Fecha y hora</span>
                  </div>

                  <div className="h-0.5 flex-1 mx-2 bg-slate-200"></div>

                  <div
                    className={`flex items-center gap-1.5 ${
                      paso === 3 ? 'text-sky-700' : 'text-slate-400'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${
                      paso === 3 ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}>
                      3
                    </span>
                    <span>Tus datos</span>
                  </div>
                </div>
              </div>
            )}

            {/* CONTENIDO DE CADA PASO */}
            <div className="p-4 sm:p-6">
              
              {/* ========================================================
                  PASO 1: SELECCIÓN DE CONSULTA / SERVICIO
                 ======================================================== */}
              {paso === 1 && (
                <div>
                  <div className="mb-4">
                    <h2 className="text-lg font-bold text-slate-900">Elegí la consulta</h2>
                    <p className="text-xs text-slate-500">
                      Seleccioná el motivo o tipo de atención que necesitás.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {services.filter(s => s.activo).map(srv => {
                      const isSelected = servicioSeleccionado?.id === srv.id;
                      return (
                        <div
                          key={srv.id}
                          onClick={() => {
                            setServicioSeleccionado(srv);
                            setPaso(2);
                          }}
                          className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                            isSelected
                              ? 'border-sky-600 bg-sky-50/50 ring-2 ring-sky-600/20 shadow-xs'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm text-slate-900 leading-snug">
                                {srv.nombre}
                              </h3>
                              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                {srv.descripcion}
                              </p>

                              <div className="flex flex-wrap items-center gap-2 mt-2.5 text-xs text-slate-600">
                                <span className="flex items-center gap-1 font-medium bg-slate-100 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3 h-3 text-slate-500" />
                                  <span>{srv.duracionMin} min</span>
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              {srv.mostrarPrecio && (
                                <div className="text-sm font-bold text-slate-900 tabular-nums">
                                  {formatearMoneda(srv.precioCentavos)}
                                </div>
                              )}
                              <span className="inline-flex items-center text-xs font-semibold text-sky-600 mt-2 hover:text-sky-700">
                                Elegir <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ========================================================
                  PASO 2: SELECCIÓN DE FECHA Y HORARIO
                 ======================================================== */}
              {paso === 2 && (
                <div>
                  {/* Resumen del servicio elegido con enlace para cambiar */}
                  <div className="flex items-center justify-between p-3 bg-sky-50/70 border border-sky-100 rounded-xl mb-4 text-xs">
                    <div>
                      <span className="text-slate-500">Consulta:</span>{' '}
                      <strong className="text-slate-900">{servicioSeleccionado?.nombre}</strong>
                      <span className="text-slate-500 ml-1.5">({servicioSeleccionado?.duracionMin} min)</span>
                    </div>
                    <button
                      onClick={() => setPaso(1)}
                      className="text-sky-700 font-semibold hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  <div className="mb-3">
                    <h2 className="text-lg font-bold text-slate-900">Elegí fecha y horario</h2>
                    <p className="text-xs text-slate-500">
                      Horarios en hora oficial de Argentina.
                    </p>
                  </div>

                  {/* Tira Horizontal de Días */}
                  <div className="mb-4">
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                      {diasDisponibles.slice(0, 14).map(dia => {
                        const isSelected = dia.fecha === fechaSeleccionada;
                        return (
                          <button
                            key={dia.fecha}
                            type="button"
                            onClick={() => {
                              setFechaSeleccionada(dia.fecha);
                              setHuecoSeleccionado(null);
                            }}
                            className={`flex flex-col items-center justify-center min-w-[70px] py-2.5 px-2 rounded-xl border transition-all text-xs shrink-0 ${
                              isSelected
                                ? 'bg-sky-600 text-white border-sky-600 shadow-sm font-semibold'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <span className="text-[10px] tracking-wider uppercase opacity-85">
                              {dia.diaSemanaCorto}
                            </span>
                            <span className="text-lg font-bold my-0.5 tabular-nums">
                              {dia.diaNumero}
                            </span>
                            <span className="text-[10px] opacity-85">
                              {dia.mesCorto}
                            </span>
                            <span className={`text-[9px] mt-1 px-1.5 py-0.2 rounded-full ${
                              isSelected ? 'bg-sky-700 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {dia.cantidad} {dia.cantidad === 1 ? 'turno' : 'turnos'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Grilla de Horarios del día seleccionado */}
                  {diaActualObj ? (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-slate-800">
                          {diaActualObj.fechaLegible}
                        </span>
                        <span className="text-xs text-slate-500">
                          {diaActualObj.cantidad} disponibles
                        </span>
                      </div>

                      {/* Mañana */}
                      {huecosManana.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Mañana
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {huecosManana.map((h, idx) => {
                              const isSlotSelected = huecoSeleccionado?.inicio === h.inicio;
                              return (
                                <button
                                  key={`${h.inicio}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setHuecoSeleccionado(h);
                                    if (h.modalidades.length === 1) {
                                      setModalidadElegida(h.modalidades[0]);
                                    }
                                    if (h.locationIds && h.locationIds.length > 0) {
                                      setDireccionElegidaId(h.locationIds[0]);
                                    } else {
                                      setDireccionElegidaId(consultorioPresencial.id);
                                    }
                                  }}
                                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                                    isSlotSelected
                                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-600/30'
                                      : 'bg-white text-slate-800 border-slate-200 hover:border-sky-300 hover:bg-sky-50/40'
                                  }`}
                                >
                                  <span className="font-bold tabular-nums text-sm">
                                    {formatearHora(h.inicio).replace(' hs', '')}
                                  </span>
                                  <span className={`text-[10px] flex items-center gap-1 ${
                                    isSlotSelected ? 'text-sky-100' : 'text-slate-500'
                                  }`}>
                                    {h.modalidades.includes('videollamada') && !h.modalidades.includes('presencial') ? (
                                      <>
                                        <Video className="w-2.5 h-2.5" /> Videollamada
                                      </>
                                    ) : h.modalidades.includes('presencial') && !h.modalidades.includes('videollamada') ? (
                                      <>
                                        <MapPin className="w-2.5 h-2.5" /> Presencial
                                      </>
                                    ) : (
                                      'Pres./Videollamada'
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Tarde */}
                      {huecosTarde.length > 0 && (
                        <div className="mb-4">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                            Tarde
                          </span>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {huecosTarde.map((h, idx) => {
                              const isSlotSelected = huecoSeleccionado?.inicio === h.inicio;
                              return (
                                <button
                                  key={`${h.inicio}-${idx}`}
                                  type="button"
                                  onClick={() => {
                                    setHuecoSeleccionado(h);
                                    if (h.modalidades.length === 1) {
                                      setModalidadElegida(h.modalidades[0]);
                                    }
                                    if (h.locationIds && h.locationIds.length > 0) {
                                      setDireccionElegidaId(h.locationIds[0]);
                                    } else {
                                      setDireccionElegidaId(consultorioPresencial.id);
                                    }
                                  }}
                                  className={`py-2 px-2.5 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center justify-center gap-0.5 ${
                                    isSlotSelected
                                      ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-600/30'
                                      : 'bg-white text-slate-800 border-slate-200 hover:border-sky-300 hover:bg-sky-50/40'
                                  }`}
                                >
                                  <span className="font-bold tabular-nums text-sm">
                                    {formatearHora(h.inicio).replace(' hs', '')}
                                  </span>
                                  <span className={`text-[10px] flex items-center gap-1 ${
                                    isSlotSelected ? 'text-sky-100' : 'text-slate-500'
                                  }`}>
                                    {h.modalidades.includes('videollamada') && !h.modalidades.includes('presencial') ? (
                                      <>
                                        <Video className="w-2.5 h-2.5" /> Videollamada
                                      </>
                                    ) : h.modalidades.includes('presencial') && !h.modalidades.includes('videollamada') ? (
                                      <>
                                        <MapPin className="w-2.5 h-2.5" /> Presencial
                                      </>
                                    ) : (
                                      'Pres./Videollamada'
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Elección de Modalidad si el horario admite ambas */}
                      {huecoSeleccionado && huecoSeleccionado.modalidades.length > 1 && (
                        <div className="mt-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                          <label className="text-xs font-bold text-slate-800 block mb-2">
                            ¿Cómo preferís atenderte?
                          </label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setModalidadElegida('presencial')}
                              className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                modalidadElegida === 'presencial'
                                  ? 'bg-white border-sky-600 text-sky-700 shadow-xs ring-1 ring-sky-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <MapPin className="w-4 h-4 text-sky-600" />
                              <span>Presencial</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setModalidadElegida('videollamada')}
                              className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                                modalidadElegida === 'videollamada'
                                  ? 'bg-white border-emerald-600 text-emerald-700 shadow-xs ring-1 ring-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              <Video className="w-4 h-4 text-emerald-600" />
                              <span>Videollamada</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Información y Confirmación del Lugar de Atención Presencial (SOLO una vez seleccionado día y horario) */}
                      {huecoSeleccionado && modalidadElegida === 'presencial' && (
                        <div className="mt-3.5 p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 text-xs">
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wide block mb-1">
                                Consultorio de atención presencial:
                              </span>
                              
                              {/* Selector de sede SOLO si hay más de 1 sede activa para este día y horario */}
                              {ubicacionesPresencialesDisponibles.length > 1 && (
                                <select
                                  value={consultorioPresencial.id}
                                  onChange={e => setDireccionElegidaId(e.target.value)}
                                  className="w-full text-xs bg-white border border-slate-300 focus:border-sky-600 rounded-lg p-2 text-slate-800 font-medium shadow-2xs mb-2"
                                >
                                  {ubicacionesPresencialesDisponibles.map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                      {loc.nombre} — {loc.direccion}
                                    </option>
                                  ))}
                                </select>
                              )}

                              <div>
                                <span className="font-bold text-slate-800 block text-xs">
                                  {consultorioPresencial.nombre}
                                </span>
                                <span className="text-slate-600 block text-xs mt-0.5">
                                  {consultorioPresencial.direccion}
                                </span>
                                {consultorioPresencial.indicaciones && (
                                  <span className="text-[11px] text-slate-500 italic block mt-1">
                                    Indicaciones: {consultorioPresencial.indicaciones}
                                  </span>
                                )}
                              </div>

                              {/* Enlace a Google Maps para la ubicación seleccionada */}
                              {consultorioPresencial.mapsUrl && (
                                <div className="mt-2 pt-2 border-t border-sky-100 flex items-center">
                                  <a
                                    href={consultorioPresencial.mapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                    <span>Ver ubicación en Google Maps</span>
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <div className="p-6 text-center text-slate-500 bg-slate-50 rounded-xl">
                      No hay turnos disponibles para el día seleccionado.
                    </div>
                  )}

                  {/* Botón de acción hacia Paso 3 */}
                  <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setPaso(1)}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Atrás
                    </button>

                    <button
                      type="button"
                      disabled={!huecoSeleccionado}
                      onClick={handleAvanzarPaso3}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                        huecoSeleccionado
                          ? 'bg-sky-600 text-white hover:bg-sky-700 shadow-sm shadow-sky-600/30'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <span>Completar mis datos</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* ========================================================
                  PASO 3: TUS DATOS + CRONÓMETRO DE RESERVA TEMPORAL
                 ======================================================== */}
              {paso === 3 && (
                <div>
                  {/* Cronómetro visual de reserva temporal (Hold 10m - Regla 2.4) */}
                  <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3 mb-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-amber-900">
                      <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                      <span>Horario reservado por <strong>{formatMinutosSegundos(tiempoRestanteHold)}</strong> min</span>
                    </div>
                    <button
                      onClick={() => {
                        if (holdActivoId) releaseHold(holdActivoId);
                        setHoldActivoId(null);
                        setPaso(2);
                      }}
                      className="text-amber-800 font-semibold hover:underline"
                    >
                      Cambiar
                    </button>
                  </div>

                  {/* Resumen del turno reservado */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 mb-4 text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Consulta:</span>
                      <span className="font-semibold text-slate-800">{servicioSeleccionado?.nombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha y Hora:</span>
                      <span className="font-semibold text-slate-800">
                        {huecoSeleccionado && formatearFechaLarga(huecoSeleccionado.inicio)} a las {huecoSeleccionado && formatearHora(huecoSeleccionado.inicio)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Modalidad:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {modalidadElegida === 'presencial' ? 'Presencial' : 'Videollamada por WhatsApp'}
                      </span>
                    </div>
                    {modalidadElegida === 'presencial' && (
                      <div className="flex flex-col gap-1 pt-0.5">
                        <div className="flex justify-between items-start">
                          <span className="text-slate-500 shrink-0">Consultorio:</span>
                          <span className="font-semibold text-slate-800 text-right">
                            {consultorioPresencial.nombre} · {consultorioPresencial.direccion}
                          </span>
                        </div>
                        {consultorioPresencial.indicaciones && (
                          <div className="text-[11px] text-slate-500 text-right italic">
                            Indicaciones: {consultorioPresencial.indicaciones}
                          </div>
                        )}
                        {consultorioPresencial.mapsUrl && (
                          <div className="flex justify-end">
                            <a
                              href={consultorioPresencial.mapsUrl}
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
                    )}
                    {servicioSeleccionado?.mostrarPrecio && (
                      <div className="flex justify-between pt-1 border-t border-slate-200">
                        <span className="text-slate-500">Valor consulta:</span>
                        <span className="font-bold text-slate-900 tabular-nums">
                          {formatearMoneda(servicioSeleccionado.precioCentavos)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Formulario */}
                  <form onSubmit={handleConfirmarReserva} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Nombre y Apellido *
                      </label>
                      <input
                        type="text"
                        required
                        value={nombre}
                        onChange={e => {
                          setNombre(e.target.value);
                          if (erroresFormulario.nombre) setErroresFormulario(prev => ({ ...prev, nombre: '' }));
                        }}
                        placeholder="Ej. Florencia Gómez"
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none"
                      />
                      {erroresFormulario.nombre && (
                        <p className="text-[11px] text-red-600 mt-1">{erroresFormulario.nombre}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          DNI (sin puntos) *
                        </label>
                        <input
                          type="text"
                          required
                          inputMode="numeric"
                          value={dni}
                          onChange={e => {
                            setDni(e.target.value);
                            if (erroresFormulario.dni) setErroresFormulario(prev => ({ ...prev, dni: '' }));
                          }}
                          placeholder="Ej. 36842190"
                          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none tabular-nums"
                        />
                        {erroresFormulario.dni && (
                          <p className="text-[11px] text-red-600 mt-1">{erroresFormulario.dni}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          WhatsApp / Teléfono *
                        </label>
                        <input
                          type="tel"
                          required
                          value={telefono}
                          onChange={e => {
                            setTelefono(e.target.value);
                            if (erroresFormulario.telefono) setErroresFormulario(prev => ({ ...prev, telefono: '' }));
                          }}
                          placeholder="Ej. 11 4521-8844"
                          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none"
                        />
                        {erroresFormulario.telefono && (
                          <p className="text-[11px] text-red-600 mt-1">{erroresFormulario.telefono}</p>
                        )}
                      </div>
                    </div>

                    {/* Aviso específico de videollamada según regla 1.4 */}
                    {modalidadElegida === 'videollamada' && (
                      <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] text-emerald-900 flex items-start gap-2">
                        <Video className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                        <span>
                          <strong>Videollamada:</strong> El profesional te llamará por WhatsApp a este número a la hora del turno.
                        </span>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Email (opcional)
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Cobertura Médica / Obra Social
                        </label>
                        <select
                          value={coberturaId}
                          onChange={e => setCoberturaId(e.target.value)}
                          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none bg-white"
                        >
                          <option value="">Particular (sin obra social)</option>
                          {coverages
                            .filter(cov => cov.id !== 'cov-part')
                            .map(cov => (
                              <option key={cov.id} value={cov.id}>
                                {cov.nombre}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Plan o Nº Afiliado (opcional)
                        </label>
                        <input
                          type="text"
                          value={plan}
                          onChange={e => setPlan(e.target.value)}
                          placeholder="Ej. Plan 310 / Nro credencial"
                          className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Motivo de consulta (opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={motivo}
                        onChange={e => setMotivo(e.target.value)}
                        placeholder="Breve descripción de dolores, estudios previos o motivo..."
                        className="w-full text-xs p-2 rounded-lg border border-slate-200 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none"
                      />
                    </div>

                    {/* Checkbox de consentimiento Ley 25.326 */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={aceptaConsentimiento}
                          onChange={e => {
                            setAceptaConsentimiento(e.target.checked);
                            if (erroresFormulario.consentimiento) {
                              setErroresFormulario(prev => ({ ...prev, consentimiento: '' }));
                            }
                          }}
                          className="mt-0.5 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        <span>
                          Acepto el tratamiento de mis datos de salud para la coordinación y recordatorio de mi turno médico conforme a la política de privacidad.
                        </span>
                      </label>
                      {erroresFormulario.consentimiento && (
                        <p className="text-[11px] text-red-600 mt-1">{erroresFormulario.consentimiento}</p>
                      )}
                    </div>

                    {/* Botones */}
                    <div className="mt-6 flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => {
                          if (holdActivoId) releaseHold(holdActivoId);
                          setHoldActivoId(null);
                          setPaso(2);
                        }}
                        className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" /> Cambiar horario
                      </button>

                      <button
                        type="submit"
                        className="px-6 py-2.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition-all shadow-sm shadow-sky-600/30 flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirmar turno</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ========================================================
                  PASO 4: CONFIRMACIÓN EXITOSA
                 ======================================================== */}
              {paso === 4 && turnoConfirmado && turnoConfirmadoActual && (
                <div className="text-center py-2">
                  <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xs">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>

                  <h2 className="text-xl font-bold text-slate-900">¡Tu turno está reservado!</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Te esperamos en el consultorio. Te dejamos el resumen para agendar.
                  </p>

                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 mt-5 text-left text-xs space-y-2">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="text-slate-500">Código de Turno:</span>
                      <span className="font-mono font-bold text-slate-800 text-sm">#{turnoConfirmado.id.slice(4, 10).toUpperCase()}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Profesional:</span>
                      <span className="font-semibold text-slate-800">{professional.titulo} {professional.nombre}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Consulta:</span>
                      <span className="font-semibold text-slate-800">{servicioSeleccionado?.nombre}</span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Fecha y Hora:</span>
                      <span className="font-semibold text-slate-800">
                        {formatearFechaLarga(turnoConfirmado.inicio)} · {formatearHora(turnoConfirmado.inicio)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-slate-500">Modalidad:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {turnoConfirmado.modalidad === 'presencial' ? 'Presencial' : 'Videollamada por WhatsApp'}
                      </span>
                    </div>

                    {turnoConfirmado.modalidad === 'presencial' && (() => {
                      const locActual =
                        locations.find(l => l.id === turnoConfirmado.locationId) || consultorioPresencial;
                      return (
                        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-500">Lugar:</span>
                            <span className="font-semibold text-slate-800 text-right">
                              {locActual.nombre} · {locActual.direccion}
                            </span>
                          </div>
                          {locActual?.indicaciones && (
                            <div className="text-[11px] text-slate-500 text-right italic">
                              Indicaciones: {locActual.indicaciones}
                            </div>
                          )}
                          {locActual?.mapsUrl && (
                            <div className="flex justify-end pt-1">
                              <a
                                href={locActual.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
                              >
                                <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                <span>Abrir ubicación en Google Maps</span>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* ========================================================
                      HITO 2: PAGO DE ARANCEL COMPLETO & COMPROBANTE DIGITAL
                     ======================================================== */}
                  <div className="mt-5 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 border border-emerald-200/90 rounded-2xl p-4 sm:p-5 text-left shadow-2xs space-y-4">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-emerald-200/70">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
                          <CreditCard className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-tight">
                            Abonar Consulta — Arancel Completo (100%)
                          </h3>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            Pago previo requerido para confirmar y coordinar la atención
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full block mb-1">
                          Arancel Completo
                        </span>
                        <span className="text-base sm:text-lg font-black text-emerald-800 tabular-nums">
                          {formatearMoneda(turnoConfirmadoActual.precioCentavos)}
                        </span>
                      </div>
                    </div>

                    {/* Datos de transferencia bancaria / Mercado Pago */}
                    <div className="bg-white rounded-xl p-3.5 border border-emerald-200/80 text-xs space-y-2.5 shadow-2xs">
                      <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Datos para transferir o pagar con Mercado Pago</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {/* Alias */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">Alias</span>
                            <span className="font-mono font-bold text-slate-900 text-xs">{professional.aliasCobro}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(professional.aliasCobro || '');
                              setCopiadoAlias(true);
                              setTimeout(() => setCopiadoAlias(false), 2500);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiadoAlias ? '¡Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>

                        {/* CBU */}
                        <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div className="truncate mr-2">
                            <span className="text-[10px] text-slate-400 block font-semibold uppercase">CBU / CVU</span>
                            <span className="font-mono font-bold text-slate-900 text-[11px] truncate block">
                              {professional.cbu || '0070012300000045892147'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(professional.cbu || '0070012300000045892147');
                              setCopiadoCbu(true);
                              setTimeout(() => setCopiadoCbu(false), 2500);
                            }}
                            className="px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs shrink-0"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiadoCbu ? '¡Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 gap-2">
                        <span><strong>Titular:</strong> {professional.titularCobro}</span>
                        <span><strong>Banco:</strong> {professional.banco || 'Banco Galicia / Mercado Pago'}</span>
                        <span><strong>CUIT:</strong> {professional.cuit || '20-33894210-9'}</span>
                      </div>
                    </div>

                    {/* Estado del Comprobante si ya fue enviado */}
                    {turnoConfirmadoActual.comprobantePago ? (
                      <div className="p-3.5 rounded-xl border text-xs space-y-2 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {turnoConfirmadoActual.comprobantePago.estado === 'pendiente_revision' && (
                              <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                            )}
                            {turnoConfirmadoActual.comprobantePago.estado === 'aprobado' && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            )}
                            {turnoConfirmadoActual.comprobantePago.estado === 'rechazado' && (
                              <AlertCircle className="w-4 h-4 text-rose-600" />
                            )}
                            <span className="font-bold text-slate-900">
                              {turnoConfirmadoActual.comprobantePago.estado === 'pendiente_revision'
                                ? 'Comprobante recibido — Pendiente de verificación'
                                : turnoConfirmadoActual.comprobantePago.estado === 'aprobado'
                                ? '¡Pago Aprobado y Acreditado!'
                                : 'Comprobante observado'}
                            </span>
                          </div>

                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            turnoConfirmadoActual.comprobantePago.estado === 'pendiente_revision'
                              ? 'bg-amber-100 text-amber-900 border border-amber-300'
                              : turnoConfirmadoActual.comprobantePago.estado === 'aprobado'
                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                              : 'bg-rose-100 text-rose-900 border border-rose-300'
                          }`}>
                            {turnoConfirmadoActual.comprobantePago.estado === 'pendiente_revision'
                              ? 'En revisión'
                              : turnoConfirmadoActual.comprobantePago.estado === 'aprobado'
                              ? 'Aprobado ✓'
                              : 'Observado'}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600">
                          {turnoConfirmadoActual.comprobantePago.estado === 'pendiente_revision' &&
                            'Tu comprobante por el arancel completo fue recibido exitosamente. El profesional verificará el impacto bancario y te confirmará por WhatsApp.'}
                          {turnoConfirmadoActual.comprobantePago.estado === 'aprobado' &&
                            'El profesional verificó tu transferencia bancaria. Tu turno se encuentra 100% coordinado y pagado.'}
                          {turnoConfirmadoActual.comprobantePago.estado === 'rechazado' &&
                            `Observación del consultorio: "${turnoConfirmadoActual.comprobantePago.notasRevision || 'Comprobante no válido'}". Por favor subí un nuevo comprobante abajo.`}
                        </p>

                        {turnoConfirmadoActual.comprobantePago.url && (
                          <div className="pt-1 flex items-center gap-2">
                            <img
                              src={turnoConfirmadoActual.comprobantePago.url}
                              alt="Comprobante"
                              className="w-14 h-14 object-cover rounded-lg border border-slate-200 shadow-2xs"
                            />
                            <div className="text-[11px] text-slate-500 font-mono">
                              <div>{turnoConfirmadoActual.comprobantePago.nombreArchivo || 'comprobante.jpg'}</div>
                              <div className="text-[10px] text-slate-400">
                                Importe: {formatearMoneda(turnoConfirmadoActual.comprobantePago.montoCentavos)}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Formulario para Subir Comprobante */
                      <div className="bg-white rounded-xl p-3.5 border border-emerald-200/80 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                            <UploadCloud className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Adjuntar Comprobante de Transferencia</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            JPG, PNG o PDF
                          </span>
                        </div>

                        {feedbackComprobantePaciente && (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-lg flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{feedbackComprobantePaciente}</span>
                          </div>
                        )}

                        <div className="border border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-emerald-500 transition-colors bg-slate-50/50">
                          <input
                            type="file"
                            id="paciente-comprobante-input"
                            accept="image/*,.pdf"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setNombreArchivoSubido(file.name);
                                const reader = new FileReader();
                                reader.onload = ev => {
                                  setPreviewComprobante(ev.target?.result as string);
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                            className="hidden"
                          />
                          <label
                            htmlFor="paciente-comprobante-input"
                            className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                          >
                            <CreditCard className="w-6 h-6 text-emerald-600" />
                            <span className="text-xs font-bold text-emerald-700">
                              Tocá acá para seleccionar tu comprobante
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Foto del ticket o captura de pantalla de la transferencia
                            </span>
                          </label>
                        </div>

                        {previewComprobante && (
                          <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 truncate">
                              <img
                                src={previewComprobante}
                                alt="Preview"
                                className="w-12 h-12 object-cover rounded border border-slate-200 shrink-0"
                              />
                              <div className="truncate text-xs">
                                <span className="font-bold text-slate-800 block truncate">{nombreArchivoSubido}</span>
                                <span className="text-[11px] text-emerald-700 font-semibold">Listo para enviar</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewComprobante(null);
                              }}
                              className="text-slate-400 hover:text-slate-600 p-1 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        <button
                          type="button"
                          disabled={!previewComprobante}
                          onClick={() => {
                            if (!previewComprobante) return;
                            uploadPaymentProof(turnoConfirmadoActual.id, {
                              url: previewComprobante,
                              nombreArchivo: nombreArchivoSubido,
                              montoCentavos: turnoConfirmadoActual.precioCentavos,
                            });
                            setFeedbackComprobantePaciente('¡Comprobante enviado al consultorio con éxito!');
                            setPreviewComprobante(null);
                          }}
                          className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                            previewComprobante
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-emerald-600/30'
                              : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Comprobante al Consultorio</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Acciones de WhatsApp y Calendario */}
                  <div className="mt-5 flex flex-col gap-2.5">
                    {enlaceWa?.valido && (
                      <a
                        href={enlaceWa.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/30 transition-all"
                      >
                        <Send className="w-4 h-4" />
                        <span>Confirmar por WhatsApp con el consultorio</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const dir = locations.find(l => l.id === turnoConfirmado.locationId);
                        generarArchivoIcs(turnoConfirmado, professional, servicioSeleccionado || undefined, dir?.direccion);
                      }}
                      className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-2xs transition-all"
                    >
                      <CalendarPlus className="w-4 h-4 text-sky-600" />
                      <span>Agregar a mi Calendario (.ics)</span>
                    </button>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setTurnoConfirmado(null);
                        setHuecoSeleccionado(null);
                        setPaso(1);
                      }}
                      className="text-xs text-sky-700 hover:underline font-semibold"
                    >
                      ← Reservar otro turno
                    </button>
                  </div>
                </div>
              )}

            </div>
          </>
        )}

      </div>

      {/* ALERTA DE CONFIRMACIÓN PARA INSTALAR LA APP (Regla: sólo ícono, alerta al tocar) */}
      {mostrarAlertaInstalar && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-600 flex items-center justify-center mx-auto mb-3 shadow-inner">
              <Download className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center">
              ¿Deseas instalar la App?
            </h3>
            <p className="text-xs text-slate-500 text-center mt-2 leading-relaxed">
              Instalá MediTurnos en tu dispositivo para acceder rápidamente a tus turnos, recordatorios e información de contacto sin necesidad de abrir el navegador web.
            </p>
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setMostrarAlertaInstalar(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  setMostrarAlertaInstalar(false);
                  if (isInstallable) {
                    const ok = await install();
                    if (!ok) setMostrarGuiaPWA(true);
                  } else {
                    setMostrarGuiaPWA(true);
                  }
                }}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Sí, instalar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GUÍA MANUAL PARA INSTALAR PWA */}
      {mostrarGuiaPWA && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Cómo instalar MediTurnos</h3>
                  <p className="text-[11px] text-slate-500">Agregá la aplicación a tu pantalla</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarGuiaPWA(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs text-slate-600">
                <p>En tu iPhone o iPad (Safari):</p>
                <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <li>Tocá el botón <strong>Compartir</strong> (ícono <Share className="w-3.5 h-3.5 inline text-sky-600" /> en la barra inferior de Safari).</li>
                  <li>Deslizá hacia abajo y seleccioná <strong>"Agregar a pantalla de inicio"</strong> (<PlusSquare className="w-3.5 h-3.5 inline text-sky-600" />).</li>
                  <li>Tocá <strong>"Agregar"</strong> arriba a la derecha.</li>
                </ol>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-slate-600">
                <p>En Android, Windows o macOS:</p>
                <ol className="list-decimal list-inside space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <li>Tocá el menú del navegador (tres puntos <strong>⋮</strong> arriba o abajo a la derecha).</li>
                  <li>Elegí <strong>"Instalar aplicación"</strong> o <strong>"Agregar a la pantalla principal"</strong>.</li>
                  <li>Confirmá la instalación para crear el acceso directo en tu dispositivo.</li>
                </ol>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setMostrarGuiaPWA(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONSULTAR TURNO Y SUBIR COMPROBANTE (Hito 2 - Autogestión) */}
      {modalConsultarTurno && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 my-8 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Header del Modal */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-tight">
                    Consultar mi Turno
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verificá tu reserva y enviá tu comprobante de pago
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalConsultarTurno(false);
                  setDniPacienteConsultado(null);
                  setErrorConsulta('');
                  setModoReprogramar(false);
                  setTurnoSeleccionadoParaReprogramar(null);
                  setMostrarModalCancelar(false);
                  setTurnoSeleccionadoParaCancelar(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Formulario de Búsqueda por DNI o Código */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ingresá tu DNI (sin puntos) o código de turno
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={dniConsulta}
                    onChange={e => setDniConsulta(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const clean = dniConsulta.trim();
                        if (!clean) {
                          setErrorConsulta('Por favor ingresá tu DNI o código de turno.');
                          return;
                        }
                        setErrorConsulta('');
                        setMensajeExitoAutogestion(null);
                        setModoReprogramar(false);
                        setTurnoSeleccionadoParaReprogramar(null);
                        setMostrarModalCancelar(false);
                        setTurnoSeleccionadoParaCancelar(null);

                        let dniEncontrado = '';
                        const apptPorToken = appointments.find(
                          a =>
                            a.manageToken === clean ||
                            a.id.toLowerCase() === clean.toLowerCase() ||
                            a.id.slice(4).toLowerCase() === clean.replace('#', '').toLowerCase()
                        );

                        if (apptPorToken) {
                          dniEncontrado = apptPorToken.pacienteDni;
                        } else {
                          const digits = clean.replace(/\D/g, '');
                          if (digits) {
                            dniEncontrado = digits;
                          }
                        }

                        if (!dniEncontrado) {
                          setErrorConsulta('No encontramos turnos con esos datos. Verificá el DNI o código ingresado.');
                          setDniPacienteConsultado(null);
                          return;
                        }

                        const delPaciente = appointments.filter(a => a.pacienteDni === dniEncontrado);
                        if (delPaciente.length === 0) {
                          setErrorConsulta(`No encontramos turnos registrados para el DNI ${dniEncontrado}.`);
                          setDniPacienteConsultado(null);
                          return;
                        }

                        setDniPacienteConsultado(dniEncontrado);
                      }
                    }}
                    placeholder="Ej. 32198540 o código de turno"
                    className="flex-1 text-xs p-2.5 rounded-xl border border-slate-300 focus:border-sky-600 focus:ring-1 focus:ring-sky-600 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const clean = dniConsulta.trim();
                      if (!clean) {
                        setErrorConsulta('Por favor ingresá tu DNI o código de turno.');
                        return;
                      }
                      setErrorConsulta('');
                      setMensajeExitoAutogestion(null);
                      setModoReprogramar(false);
                      setTurnoSeleccionadoParaReprogramar(null);
                      setMostrarModalCancelar(false);
                      setTurnoSeleccionadoParaCancelar(null);

                      let dniEncontrado = '';
                      const apptPorToken = appointments.find(
                        a =>
                          a.manageToken === clean ||
                          a.id.toLowerCase() === clean.toLowerCase() ||
                          a.id.slice(4).toLowerCase() === clean.replace('#', '').toLowerCase()
                      );

                      if (apptPorToken) {
                        dniEncontrado = apptPorToken.pacienteDni;
                      } else {
                        const digits = clean.replace(/\D/g, '');
                        if (digits) {
                          dniEncontrado = digits;
                        }
                      }

                      if (!dniEncontrado) {
                        setErrorConsulta('No encontramos turnos con esos datos. Verificá el DNI o código ingresado.');
                        setDniPacienteConsultado(null);
                        return;
                      }

                      const delPaciente = appointments.filter(a => a.pacienteDni === dniEncontrado);
                      if (delPaciente.length === 0) {
                        setErrorConsulta(`No encontramos turnos registrados para el DNI ${dniEncontrado}.`);
                        setDniPacienteConsultado(null);
                        return;
                      }

                      setDniPacienteConsultado(dniEncontrado);
                    }}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Buscar</span>
                  </button>
                </div>

                {errorConsulta && (
                  <p className="text-[11px] text-rose-600 mt-1.5 font-medium">{errorConsulta}</p>
                )}
                {mensajeExitoAutogestion && (
                  <div className="p-2.5 mt-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{mensajeExitoAutogestion}</span>
                  </div>
                )}
              </div>

              {/* Si se consultó un paciente */}
              {dniPacienteConsultado && (
                <div className="space-y-4">
                  {turnosConsultados.length === 0 ? (
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl text-center text-xs space-y-2">
                      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                      <strong className="text-slate-800 block text-sm">
                        Sin turnos reservados en el período activo
                      </strong>
                      <p className="text-slate-500 max-w-sm mx-auto">
                        No registrás turnos reservados para el DNI <strong>{dniPacienteConsultado}</strong> dentro del período de <strong>Horizonte máximo de reserva ({horizonteDias} días)</strong>.
                      </p>
                      {historialOtrosTurnos.length > 0 && (
                        <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200/60 mt-2">
                          Tenés {historialOtrosTurnos.length} {historialOtrosTurnos.length === 1 ? 'turno' : 'turnos'} en el historial (pasados o cancelados).
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Cabecera informativa de los turnos en el horizonte */}
                      <div className="bg-sky-50/70 border border-sky-200 rounded-2xl p-3.5 space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-sky-900 uppercase tracking-wider block">
                              Paciente: {turnosConsultados[0]?.pacienteNombre}
                            </span>
                            <span className="text-slate-600 text-[11px]">
                              DNI {dniPacienteConsultado}
                            </span>
                          </div>
                          <span className="px-3 py-1 bg-sky-600 text-white rounded-full text-xs font-bold shadow-2xs">
                            {turnosConsultados.length} {turnosConsultados.length === 1 ? 'turno reservado' : 'turnos reservados'}
                          </span>
                        </div>

                        <div className="pt-2 border-t border-sky-100 flex items-start gap-1.5 text-[11px] text-sky-900/90 leading-relaxed">
                          <Info className="w-3.5 h-3.5 text-sky-700 shrink-0 mt-0.5" />
                          <span>
                            Turnos en el <strong>Horizonte máximo de reserva ({horizonteDias} días)</strong>. Únicamente el <strong>último turno agendado en estado Pendiente</strong> es reprogramable online.
                          </span>
                        </div>
                      </div>

                      {/* Lista de todos los turnos reservados en el horizonte */}
                      <div className="space-y-3.5">
                        {turnosConsultados.map((appt, idx) => {
                          const esElUltimo = ultimoTurnoReservado !== null && appt.id === ultimoTurnoReservado.id;
                          const esPendiente = appt.estado === 'pendiente';
                          const esReprogramable = esElUltimo && esPendiente;
                          const plazoHs = professional.parametros.plazoCancelacionHoras ?? 24;
                          const iniMs = new Date(appt.inicio).getTime();
                          const dentroDePlazo = (iniMs - plazoHs * 3600 * 1000) > Date.now();
                          const locActual = locations.find(l => l.id === appt.locationId) || consultorioPresencial;

                          return (
                            <div
                              key={appt.id}
                              className={`border rounded-2xl p-4 bg-slate-50 space-y-3.5 text-xs transition-all ${
                                esElUltimo
                                  ? 'border-sky-300 ring-2 ring-sky-100 bg-white'
                                  : 'border-slate-200'
                              }`}
                            >
                              {/* Cabecera del turno */}
                              <div className="flex flex-wrap items-start justify-between gap-2 pb-2.5 border-b border-slate-200">
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-[11px] text-slate-500 font-mono font-bold">
                                      TURNO #{appt.id.slice(4, 10).toUpperCase()}
                                    </span>
                                    <span className="text-slate-300">·</span>
                                    <span className="text-[11px] font-bold text-slate-700">
                                      {idx + 1}º de {turnosConsultados.length}
                                    </span>

                                    {esElUltimo ? (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-200 uppercase tracking-tight">
                                        ★ Último turno agendado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                        Turno anterior
                                      </span>
                                    )}
                                  </div>
                                  <strong className="text-sm text-slate-900 block">{appt.pacienteNombre}</strong>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                    appt.estado === 'atendido'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : appt.estado === 'pendiente'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}>
                                    {appt.estado.toUpperCase()}
                                  </span>
                                </div>
                              </div>

                              {/* Datos del turno */}
                              <div className="grid grid-cols-2 gap-2 text-slate-700">
                                <div>
                                  <span className="text-slate-400 block text-[11px]">Fecha y Hora:</span>
                                  <span className="font-semibold text-slate-900">
                                    {formatearFechaLarga(appt.inicio)} · {formatearHora(appt.inicio)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[11px]">Modalidad:</span>
                                  <span className="font-semibold text-slate-900 capitalize">
                                    {appt.modalidad === 'presencial' ? 'Presencial' : 'Videollamada'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[11px]">Servicio:</span>
                                  <span className="font-semibold text-slate-900">
                                    {services.find(s => s.id === appt.serviceId)?.nombre || 'Consulta'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400 block text-[11px]">Arancel Completo:</span>
                                  <span className="font-bold text-slate-900 tabular-nums">
                                    {formatearMoneda(appt.precioCentavos)}
                                  </span>
                                </div>
                              </div>

                              {/* Ubicación Presencial */}
                              {appt.modalidad === 'presencial' && (
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs">
                                  <div className="flex items-start gap-2.5">
                                    <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">
                                        Ubicación de atención presencial:
                                      </span>
                                      <span className="font-bold text-slate-900 block text-xs">
                                        {locActual.nombre}
                                      </span>
                                      <span className="text-slate-600 block text-xs mt-0.5">
                                        {locActual.direccion}
                                      </span>
                                      {locActual.indicaciones && (
                                        <span className="text-[11px] text-slate-500 italic block mt-1">
                                          Indicaciones: {locActual.indicaciones}
                                        </span>
                                      )}
                                      {locActual.mapsUrl && (
                                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center">
                                          <a
                                            href={locActual.mapsUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                                          >
                                            <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                            <span>Ver ubicación en Google Maps</span>
                                          </a>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Aviso Videollamada */}
                              {appt.modalidad === 'videollamada' && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
                                  <Video className="w-4 h-4 text-emerald-700 shrink-0" />
                                  <span>Videollamada: El profesional se comunicará por WhatsApp al horario del turno.</span>
                                </div>
                              )}

                              {/* Estado del Pago y Comprobante */}
                              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                                <div className="flex justify-between items-center">
                                  <span className="font-bold text-slate-800">Estado del Pago:</span>
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    appt.estadoPago === 'pagado'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {appt.estadoPago === 'pagado' ? 'PAGADO ✓' : 'PENDIENTE DE PAGO'}
                                  </span>
                                </div>

                                {appt.comprobantePago ? (
                                  <div className="pt-2 border-t border-slate-100 text-[11px]">
                                    <div className="flex items-center justify-between font-semibold">
                                      <span>Comprobante Digital:</span>
                                      <span className={`${
                                        appt.comprobantePago.estado === 'aprobado'
                                          ? 'text-emerald-700'
                                          : appt.comprobantePago.estado === 'pendiente_revision'
                                          ? 'text-amber-700'
                                          : 'text-rose-700'
                                      }`}>
                                        {appt.comprobantePago.estado === 'aprobado'
                                          ? 'Aprobado ✓'
                                          : appt.comprobantePago.estado === 'pendiente_revision'
                                          ? 'En revisión...'
                                          : 'Observado ✗'}
                                      </span>
                                    </div>
                                    {appt.comprobantePago.notasRevision && (
                                      <div className="text-slate-500 italic mt-1">
                                        «{appt.comprobantePago.notasRevision}»
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-2">
                                    <p>
                                      No registrás comprobante cargado. Podés transferir con alias <strong>{professional.aliasCobro}</strong> y subir tu comprobante acá:
                                    </p>
                                    <div className="border border-dashed border-emerald-300 rounded-xl p-3 text-center bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors">
                                      <input
                                        type="file"
                                        id={`consulta-comprobante-${appt.id}`}
                                        accept="image/*,.pdf"
                                        onChange={e => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onload = ev => {
                                              const url = ev.target?.result as string;
                                              uploadPaymentProof(appt.id, {
                                                url,
                                                nombreArchivo: file.name,
                                                montoCentavos: appt.precioCentavos,
                                              });
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                        className="hidden"
                                      />
                                      <label
                                        htmlFor={`consulta-comprobante-${appt.id}`}
                                        className="cursor-pointer flex flex-col items-center justify-center gap-1"
                                      >
                                        <UploadCloud className="w-5 h-5 text-emerald-600" />
                                        <span className="font-bold text-emerald-800 text-xs">
                                          Adjuntar comprobante para este turno
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          Foto o captura de pantalla (JPG, PNG o PDF)
                                        </span>
                                      </label>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Autogestión de Turno: Cancelar / Reprogramar según regla de último turno y estado Pendiente */}
                              {appt.estado === 'pendiente' && (
                                <div className="pt-2 border-t border-slate-200 space-y-3">
                                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                                    <span>Plazo de autogestión:</span>
                                    <span className="font-semibold text-slate-700">
                                      Hasta {plazoHs} hs previas
                                    </span>
                                  </div>

                                  {dentroDePlazo ? (
                                    <div className="space-y-2.5">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {/* Botón Reprogramar: SOLO SI ES EL ÚLTIMO Y DE ESTADO PENDIENTE */}
                                        {esReprogramable ? (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (modoReprogramar && turnoSeleccionadoParaReprogramar?.id === appt.id) {
                                                setModoReprogramar(false);
                                                setTurnoSeleccionadoParaReprogramar(null);
                                              } else {
                                                setTurnoSeleccionadoParaReprogramar(appt);
                                                setModoReprogramar(true);
                                                setMostrarModalCancelar(false);
                                                setTurnoSeleccionadoParaCancelar(null);
                                              }
                                            }}
                                            className="py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                          >
                                            <Clock className="w-3.5 h-3.5 text-amber-700" />
                                            <span>
                                              {modoReprogramar && turnoSeleccionadoParaReprogramar?.id === appt.id
                                                ? 'Ocultar Reprogramación'
                                                : 'Reprogramar Turno (Último)'}
                                            </span>
                                          </button>
                                        ) : (
                                          <div
                                            className="py-2 px-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-xl text-[11px] font-medium flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
                                            title="Por política de agenda, únicamente el último turno reservado puede ser reprogramado online"
                                          >
                                            <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>No reprogramable (solo el último)</span>
                                          </div>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (mostrarModalCancelar && turnoSeleccionadoParaCancelar?.id === appt.id) {
                                              setMostrarModalCancelar(false);
                                              setTurnoSeleccionadoParaCancelar(null);
                                            } else {
                                              setTurnoSeleccionadoParaCancelar(appt);
                                              setMostrarModalCancelar(true);
                                              setModoReprogramar(false);
                                              setTurnoSeleccionadoParaReprogramar(null);
                                            }
                                          }}
                                          className="py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                                        >
                                          <X className="w-3.5 h-3.5 text-rose-600" />
                                          <span>Cancelar Turno</span>
                                        </button>
                                      </div>

                                      {/* Panel de Cancelación para este turno */}
                                      {mostrarModalCancelar && turnoSeleccionadoParaCancelar?.id === appt.id && (
                                        <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl space-y-2">
                                          <span className="font-bold text-xs text-rose-900 block">
                                            ¿Estás seguro de cancelar el turno #{appt.id.slice(4, 10).toUpperCase()} del {formatearFechaLarga(appt.inicio)} a las {formatearHora(appt.inicio)}?
                                          </span>
                                          <input
                                            type="text"
                                            value={motivoCancelacion}
                                            onChange={e => setMotivoCancelacion(e.target.value)}
                                            placeholder="Motivo de cancelación (opcional)"
                                            className="w-full text-xs p-2 rounded-lg border border-rose-200 bg-white outline-none focus:border-rose-400"
                                          />
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={async () => {
                                                try {
                                                  const res = await portalCancelarTurno({
                                                    p_token: appt.manageToken || appt.id,
                                                    p_motivo: motivoCancelacion.trim() || 'Cancelado por el paciente desde el portal',
                                                  });
                                                  if (res && res.turno_id) {
                                                    setMostrarModalCancelar(false);
                                                    setTurnoSeleccionadoParaCancelar(null);
                                                    setMotivoCancelacion('');
                                                    setMensajeExitoAutogestion('El turno fue cancelado correctamente.');
                                                    setTimeout(() => setMensajeExitoAutogestion(null), 5000);
                                                  }
                                                } catch (err: any) {
                                                  alert(traducirErrorBase(err?.message || 'error_general'));
                                                }
                                              }}
                                              className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                                            >
                                              Confirmar Cancelación
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setMostrarModalCancelar(false);
                                                setTurnoSeleccionadoParaCancelar(null);
                                              }}
                                              className="px-3 py-2 bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                                            >
                                              Volver
                                            </button>
                                          </div>
                                        </div>
                                      )}

                                      {/* Panel de Reprogramación: SOLO PARA EL ÚLTIMO TURNO */}
                                      {modoReprogramar && turnoSeleccionadoParaReprogramar?.id === appt.id && (
                                        <div className="p-3.5 bg-white border border-amber-300 rounded-2xl space-y-3.5 shadow-2xs">
                                          <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                                            <div>
                                              <span className="font-bold text-xs text-slate-900 block">
                                                Elegí nueva fecha y horario para tu último turno (#{appt.id.slice(4, 10).toUpperCase()})
                                              </span>
                                              <span className="text-[11px] text-slate-500">
                                                Basado en la disponibilidad actual de la agenda
                                              </span>
                                            </div>
                                            <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                              Reprogramación
                                            </span>
                                          </div>

                                          {diasDisponiblesReprog.length > 0 ? (
                                            <>
                                              {/* Tira Horizontal de Días */}
                                              <div className="overflow-x-auto pb-1.5 scrollbar-none">
                                                <div className="flex gap-2 min-w-max">
                                                  {diasDisponiblesReprog.slice(0, 14).map(dia => {
                                                    const isSelected = dia.fecha === fechaReprogramar;
                                                    return (
                                                      <button
                                                        key={dia.fecha}
                                                        type="button"
                                                        onClick={() => {
                                                          setFechaReprogramar(dia.fecha);
                                                          setHuecoReprogramar(null);
                                                        }}
                                                        className={`flex flex-col items-center justify-center min-w-[65px] py-2 px-1.5 rounded-xl border transition-all text-xs cursor-pointer ${
                                                          isSelected
                                                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm font-semibold'
                                                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                                                        }`}
                                                      >
                                                        <span className="text-[10px] tracking-wider uppercase opacity-85">
                                                          {dia.diaSemanaCorto}
                                                        </span>
                                                        <span className="text-base font-bold my-0.5 tabular-nums">
                                                          {dia.diaNumero}
                                                        </span>
                                                        <span className="text-[10px] opacity-85">
                                                          {dia.mesCorto}
                                                        </span>
                                                        <span className={`text-[9px] mt-1 px-1.5 py-0.2 rounded-full ${
                                                          isSelected ? 'bg-amber-700 text-white' : 'bg-white text-slate-600 border border-slate-200'
                                                        }`}>
                                                          {dia.cantidad} {dia.cantidad === 1 ? 'turno' : 'turnos'}
                                                        </span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>

                                              {/* Grilla de Horarios del día seleccionado */}
                                              {diaReprogObj ? (
                                                <div className="space-y-3 pt-1">
                                                  <div className="flex items-center justify-between text-xs">
                                                    <span className="font-semibold text-slate-800">
                                                      {diaReprogObj.fechaLegible}
                                                    </span>
                                                    <span className="text-slate-500 text-[11px]">
                                                      {diaReprogObj.cantidad} disponibles
                                                    </span>
                                                  </div>

                                                  {/* Mañana */}
                                                  {huecosReprogManana.length > 0 && (
                                                    <div>
                                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                        Mañana
                                                      </span>
                                                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                                        {huecosReprogManana.map((h, hIdx) => {
                                                          const isSlotSelected = huecoReprogramar?.inicio === h.inicio;
                                                          return (
                                                            <button
                                                              key={`reprog-m-${h.inicio}-${hIdx}`}
                                                              type="button"
                                                              onClick={() => {
                                                                setHuecoReprogramar(h);
                                                                if (h.modalidades.length === 1) {
                                                                  setModalidadReprogramar(h.modalidades[0]);
                                                                } else if (!h.modalidades.includes(modalidadReprogramar)) {
                                                                  setModalidadReprogramar(h.modalidades[0]);
                                                                }
                                                                if (h.locationIds && h.locationIds.length > 0) {
                                                                  setSedeReprogramarId(h.locationIds[0]);
                                                                }
                                                              }}
                                                              className={`py-2 px-1.5 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                                                                isSlotSelected
                                                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-600/30'
                                                                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
                                                              }`}
                                                            >
                                                              <span className="font-bold tabular-nums text-xs sm:text-sm">
                                                                {formatearHora(h.inicio).replace(' hs', '')}
                                                              </span>
                                                              <span className={`text-[10px] flex items-center gap-0.5 ${
                                                                isSlotSelected ? 'text-amber-100' : 'text-slate-500'
                                                              }`}>
                                                                {h.modalidades.includes('videollamada') && !h.modalidades.includes('presencial') ? (
                                                                  <>
                                                                    <Video className="w-2.5 h-2.5" /> Videollamada
                                                                  </>
                                                                ) : h.modalidades.includes('presencial') && !h.modalidades.includes('videollamada') ? (
                                                                  <>
                                                                    <MapPin className="w-2.5 h-2.5" /> Presencial
                                                                  </>
                                                                ) : (
                                                                  'Pres./Videollamada'
                                                                )}
                                                              </span>
                                                            </button>
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Tarde */}
                                                  {huecosReprogTarde.length > 0 && (
                                                    <div>
                                                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                                        Tarde
                                                      </span>
                                                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                                                        {huecosReprogTarde.map((h, hIdx) => {
                                                          const isSlotSelected = huecoReprogramar?.inicio === h.inicio;
                                                          return (
                                                            <button
                                                              key={`reprog-t-${h.inicio}-${hIdx}`}
                                                              type="button"
                                                              onClick={() => {
                                                                setHuecoReprogramar(h);
                                                                if (h.modalidades.length === 1) {
                                                                  setModalidadReprogramar(h.modalidades[0]);
                                                                } else if (!h.modalidades.includes(modalidadReprogramar)) {
                                                                  setModalidadReprogramar(h.modalidades[0]);
                                                                }
                                                                if (h.locationIds && h.locationIds.length > 0) {
                                                                  setSedeReprogramarId(h.locationIds[0]);
                                                                }
                                                              }}
                                                              className={`py-2 px-1.5 rounded-lg border text-xs font-medium transition-all text-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                                                                isSlotSelected
                                                                  ? 'bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-600/30'
                                                                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-amber-400 hover:bg-amber-50/40'
                                                              }`}
                                                            >
                                                              <span className="font-bold tabular-nums text-xs sm:text-sm">
                                                                {formatearHora(h.inicio).replace(' hs', '')}
                                                              </span>
                                                              <span className={`text-[10px] flex items-center gap-0.5 ${
                                                                isSlotSelected ? 'text-amber-100' : 'text-slate-500'
                                                              }`}>
                                                                {h.modalidades.includes('videollamada') && !h.modalidades.includes('presencial') ? (
                                                                  <>
                                                                    <Video className="w-2.5 h-2.5" /> Videollamada
                                                                  </>
                                                                ) : h.modalidades.includes('presencial') && !h.modalidades.includes('videollamada') ? (
                                                                  <>
                                                                    <MapPin className="w-2.5 h-2.5" /> Presencial
                                                                  </>
                                                                ) : (
                                                                  'Pres./Videollamada'
                                                                )}
                                                              </span>
                                                            </button>
                                                          );
                                                        })}
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Modalidad si el horario admite ambas */}
                                                  {huecoReprogramar && huecoReprogramar.modalidades.length > 1 && (
                                                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                                                      <label className="text-[11px] font-bold text-slate-800 block mb-1.5">
                                                        ¿Cómo preferís atenderte?
                                                      </label>
                                                      <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                          type="button"
                                                          onClick={() => setModalidadReprogramar('presencial')}
                                                          className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                            modalidadReprogramar === 'presencial'
                                                              ? 'bg-white border-amber-600 text-amber-800 shadow-2xs ring-1 ring-amber-500'
                                                              : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
                                                          }`}
                                                        >
                                                          <MapPin className="w-3.5 h-3.5 text-amber-600" />
                                                          <span>Presencial</span>
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={() => setModalidadReprogramar('videollamada')}
                                                          className={`p-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                                            modalidadReprogramar === 'videollamada'
                                                              ? 'bg-white border-emerald-600 text-emerald-800 shadow-2xs ring-1 ring-emerald-500'
                                                              : 'bg-white/80 text-slate-600 border-slate-200 hover:bg-white'
                                                          }`}
                                                        >
                                                          <Video className="w-3.5 h-3.5 text-emerald-600" />
                                                          <span>Videollamada</span>
                                                        </button>
                                                      </div>
                                                    </div>
                                                  )}

                                                  {/* Videollamada notice */}
                                                  {huecoReprogramar && modalidadReprogramar === 'videollamada' && (
                                                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-center gap-2">
                                                      <Video className="w-4 h-4 text-emerald-700 shrink-0" />
                                                      <span>Videollamada: El profesional se comunicará por WhatsApp al horario del turno.</span>
                                                    </div>
                                                  )}

                                                  {/* Ubicación Presencial */}
                                                  {huecoReprogramar && modalidadReprogramar === 'presencial' && (
                                                    <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs">
                                                      <div className="flex items-start gap-2">
                                                        <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                                        <div className="flex-1 min-w-0">
                                                          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide block mb-1">
                                                            Consultorio de atención presencial:
                                                          </span>

                                                          {ubicacionesReprogPresenciales.length > 1 && (
                                                            <select
                                                              value={consultorioReprogPresencial.id}
                                                              onChange={e => setSedeReprogramarId(e.target.value)}
                                                              className="w-full text-xs bg-white border border-slate-300 focus:border-amber-600 rounded-lg p-2 text-slate-800 font-medium shadow-2xs mb-2"
                                                            >
                                                              {ubicacionesReprogPresenciales.map(loc => (
                                                                <option key={loc.id} value={loc.id}>
                                                                  {loc.nombre} — {loc.direccion}
                                                                </option>
                                                              ))}
                                                            </select>
                                                          )}

                                                          <div>
                                                            <span className="font-bold text-slate-800 block text-xs">
                                                              {consultorioReprogPresencial.nombre}
                                                            </span>
                                                            <span className="text-slate-600 block text-xs mt-0.5">
                                                              {consultorioReprogPresencial.direccion}
                                                            </span>
                                                            {consultorioReprogPresencial.indicaciones && (
                                                              <span className="text-[11px] text-slate-500 italic block mt-1">
                                                                Indicaciones: {consultorioReprogPresencial.indicaciones}
                                                              </span>
                                                            )}
                                                          </div>

                                                          {consultorioReprogPresencial.mapsUrl && (
                                                            <div className="mt-2 pt-2 border-t border-amber-200/60 flex items-center">
                                                              <a
                                                                href={consultorioReprogPresencial.mapsUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-950 hover:underline"
                                                              >
                                                                <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                                                                <span>Ver ubicación en Google Maps</span>
                                                              </a>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl text-xs">
                                                  No hay turnos disponibles para el día seleccionado.
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <div className="p-4 text-center text-slate-500 bg-slate-50 rounded-xl text-xs">
                                              No hay turnos disponibles para reprogramar en la agenda actualmente.
                                            </div>
                                          )}

                                          {/* Botón confirmar reprogramación */}
                                          <button
                                            type="button"
                                            disabled={!huecoReprogramar}
                                            onClick={async () => {
                                              if (!huecoReprogramar) return;
                                              try {
                                                const holdRes = await portalCrearHold({
                                                  p_ref: professional.slug,
                                                  p_servicio_id: appt.serviceId,
                                                  p_inicio: huecoReprogramar.inicio,
                                                  p_modalidad: modalidadReprogramar,
                                                  p_sede_id: modalidadReprogramar === 'presencial' ? (sedeReprogramarId || consultorioReprogPresencial.id) : undefined,
                                                  p_session_id: sessionToken,
                                                });

                                                const res = await portalReprogramarTurno({
                                                  p_token: appt.manageToken || appt.id,
                                                  p_hold_id: holdRes.hold_id,
                                                  p_session_id: sessionToken,
                                                });

                                                if (res && res.turno_id) {
                                                  setModoReprogramar(false);
                                                  setTurnoSeleccionadoParaReprogramar(null);
                                                  setHuecoReprogramar(null);
                                                  setFechaReprogramar('');
                                                  setMensajeExitoAutogestion('¡Turno reprogramado exitosamente!');
                                                  setTimeout(() => setMensajeExitoAutogestion(null), 5000);
                                                }
                                              } catch (err: any) {
                                                alert(traducirErrorBase(err?.message || 'error_general'));
                                              }
                                            }}
                                            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                                              huecoReprogramar
                                                ? 'bg-amber-600 hover:bg-amber-700 text-white cursor-pointer'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                            }`}
                                          >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Confirmar Cambio de Turno</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                      <span>
                                        El plazo límite para cancelar o reprogramar online ({plazoHs} hs previas) ha vencido. Por favor contactate por WhatsApp con el consultorio.
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Contacto por WhatsApp para este turno */}
                              <div className="pt-1 flex flex-col gap-2">
                                <a
                                  href={`https://wa.me/${appt.pacienteTelefono}?text=${encodeURIComponent(
                                    `Hola ${professional.titulo} ${professional.nombre}, te escribo por mi turno #${appt.id.slice(4, 10).toUpperCase()} del ${formatearFechaLarga(appt.inicio)} a las ${formatearHora(appt.inicio)}.`
                                  )}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Contactar al consultorio por WhatsApp por este turno</span>
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setModalConsultarTurno(false);
                    setDniPacienteConsultado(null);
                    setErrorConsulta('');
                    setModoReprogramar(false);
                    setTurnoSeleccionadoParaReprogramar(null);
                    setMostrarModalCancelar(false);
                    setTurnoSeleccionadoParaCancelar(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
