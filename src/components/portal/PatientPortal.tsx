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

  // Formulario del Paciente (Paso 3)
  const [nombre, setNombre] = useState('');
  const [dni, setDni] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [coberturaId, setCoberturaId] = useState(coverages[0]?.id || '');
  const [plan, setPlan] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [aceptaConsentimiento, setAceptaConsentimiento] = useState(false);
  const [erroresFormulario, setErroresFormulario] = useState<Record<string, string>>({});

  // Turno confirmado (Paso 4)
  const [turnoConfirmado, setTurnoConfirmado] = useState<Appointment | null>(null);

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

  // Avanzar del Paso 2 al Paso 3 creando la Reserva Temporal (Hold)
  const handleAvanzarPaso3 = () => {
    if (!huecoSeleccionado || !servicioSeleccionado) return;

    // Crear Hold
    const res = createHold(
      servicioSeleccionado.id,
      huecoSeleccionado.inicio,
      huecoSeleccionado.fin,
      modalidadElegida,
      modalidadElegida === 'presencial' ? direccionElegidaId : undefined
    );

    if (!res.success || !res.hold) {
      alert(res.error || 'No se pudo reservar el horario seleccionado.');
      return;
    }

    setHoldActivoId(res.hold.id);
    setTiempoRestanteHold(600); // 10 min
    setPaso(3);
  };

  // Enviar y Confirmar Turno (Paso 3 -> Paso 4)
  const handleConfirmarReserva = (e: React.FormEvent) => {
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

    const res = bookAppointment({
      holdId: holdActivoId || undefined,
      serviceId: servicioSeleccionado.id,
      inicio: huecoSeleccionado.inicio,
      fin: huecoSeleccionado.fin,
      modalidad: modalidadElegida,
      locationId: modalidadElegida === 'presencial' ? direccionElegidaId : undefined,
      pacienteNombre: nombre,
      pacienteDni: validDni.dni,
      pacienteTelefono: normTel.e164,
      pacienteEmail: email,
      pacienteCoberturaId: coberturaId,
      pacientePlan: plan,
      pacienteAfiliado: nroAfiliado,
      motivo,
      origen: 'portal',
    });

    if (!res.success || !res.appointment) {
      alert(res.error || 'Ocurrió un error al confirmar tu turno. Probá nuevamente.');
      return;
    }

    setTurnoConfirmado(res.appointment);
    setPaso(4);
  };

  // Mensaje para confirmar por WhatsApp
  const mensajeWhatsApp = useMemo(() => {
    if (!turnoConfirmado) return '';
    const tpl = templates.find(t => t.tipo === 'confirmacion');
    const dir = locations.find(l => l.id === turnoConfirmado.locationId);
    const variables = prepararVariablesDesdeTurno(
      turnoConfirmado,
      professional,
      servicioSeleccionado || undefined,
      dir?.direccion,
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

                                {srv.modalidades.includes('presencial') && (
                                  <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <MapPin className="w-3 h-3 text-sky-600" />
                                    <span>Presencial</span>
                                  </span>
                                )}

                                {srv.modalidades.includes('videollamada') && (
                                  <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                    <Video className="w-3 h-3 text-emerald-600" />
                                    <span>Videollamada</span>
                                  </span>
                                )}
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
                            {huecosManana.map(h => {
                              const isSlotSelected = huecoSeleccionado?.inicio === h.inicio;
                              return (
                                <button
                                  key={h.inicio}
                                  type="button"
                                  onClick={() => {
                                    setHuecoSeleccionado(h);
                                    if (h.modalidades.length === 1) {
                                      setModalidadElegida(h.modalidades[0]);
                                    }
                                    if (h.locationIds && h.locationIds.length > 0) {
                                      setDireccionElegidaId(h.locationIds[0]);
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
                                        <Video className="w-2.5 h-2.5" /> Virtual
                                      </>
                                    ) : h.modalidades.includes('presencial') && !h.modalidades.includes('videollamada') ? (
                                      <>
                                        <MapPin className="w-2.5 h-2.5" /> Presencial
                                      </>
                                    ) : (
                                      'Pres./Virtual'
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
                            {huecosTarde.map(h => {
                              const isSlotSelected = huecoSeleccionado?.inicio === h.inicio;
                              return (
                                <button
                                  key={h.inicio}
                                  type="button"
                                  onClick={() => {
                                    setHuecoSeleccionado(h);
                                    if (h.modalidades.length === 1) {
                                      setModalidadElegida(h.modalidades[0]);
                                    }
                                    if (h.locationIds && h.locationIds.length > 0) {
                                      setDireccionElegidaId(h.locationIds[0]);
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
                                        <Video className="w-2.5 h-2.5" /> Virtual
                                      </>
                                    ) : h.modalidades.includes('presencial') && !h.modalidades.includes('videollamada') ? (
                                      <>
                                        <MapPin className="w-2.5 h-2.5" /> Presencial
                                      </>
                                    ) : (
                                      'Pres./Virtual'
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

                      {/* Información y Confirmación del Lugar de Atención Presencial */}
                      {modalidadElegida === 'presencial' && (
                        <div className="mt-3.5 p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 text-xs">
                          <div className="flex items-start gap-2.5">
                            <MapPin className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[11px] font-bold text-sky-800 uppercase tracking-wide block mb-1">
                                Consultorio de atención presencial:
                              </span>
                              {huecoSeleccionado?.locationIds && huecoSeleccionado.locationIds.length === 1 ? (
                                <div>
                                  <span className="font-bold text-slate-800 block text-xs">
                                    {locations.find(l => l.id === direccionElegidaId)?.nombre || 'Consultorio'}
                                  </span>
                                  <span className="text-slate-600 block text-xs mt-0.5">
                                    {locations.find(l => l.id === direccionElegidaId)?.direccion}
                                  </span>
                                  {locations.find(l => l.id === direccionElegidaId)?.indicaciones && (
                                    <span className="text-[11px] text-slate-500 italic block mt-1">
                                      Indicaciones: {locations.find(l => l.id === direccionElegidaId)?.indicaciones}
                                    </span>
                                  )}
                                </div>
                              ) : locations.filter(l => l.activa).length > 1 ? (
                                <select
                                  value={direccionElegidaId}
                                  onChange={e => setDireccionElegidaId(e.target.value)}
                                  className="w-full text-xs bg-white border border-slate-300 focus:border-sky-600 rounded-lg p-2 text-slate-800 font-medium shadow-2xs"
                                >
                                  {locations.filter(l => l.activa).map(loc => (
                                    <option key={loc.id} value={loc.id}>
                                      {loc.nombre} — {loc.direccion}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div>
                                  <span className="font-bold text-slate-800 block text-xs">
                                    {locations[0]?.nombre || 'Consultorio'}
                                  </span>
                                  <span className="text-slate-600 block text-xs mt-0.5">
                                    {locations[0]?.direccion}
                                  </span>
                                </div>
                              )}

                              {/* Enlace a Google Maps para la ubicación seleccionada */}
                              {(() => {
                                const locSel =
                                  locations.find(l => l.id === direccionElegidaId) || locations[0];
                                if (!locSel?.mapsUrl) return null;
                                return (
                                  <div className="mt-2 pt-2 border-t border-sky-100 flex items-center">
                                    <a
                                      href={locSel.mapsUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-sky-700 hover:text-sky-900 hover:underline"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-sky-600" />
                                      <span>Ver ubicación en Google Maps</span>
                                    </a>
                                  </div>
                                );
                              })()}
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
                    {modalidadElegida === 'presencial' && (() => {
                      const locActual =
                        locations.find(l => l.id === direccionElegidaId) || locations[0];
                      return (
                        <div className="flex flex-col gap-1 pt-0.5">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-500 shrink-0">Consultorio:</span>
                            <span className="font-semibold text-slate-800 text-right">
                              {locActual ? `${locActual.nombre} · ${locActual.direccion}` : 'Consultorio'}
                            </span>
                          </div>
                          {locActual?.mapsUrl && (
                            <div className="flex justify-end">
                              <a
                                href={locActual.mapsUrl}
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
                      );
                    })()}
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
                          {coverages.map(cov => (
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
              {paso === 4 && turnoConfirmado && (
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
                        locations.find(l => l.id === turnoConfirmado.locationId) || locations[0];
                      return (
                        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-slate-100">
                          <div className="flex justify-between items-start">
                            <span className="text-slate-500">Lugar:</span>
                            <span className="font-semibold text-slate-800 text-right">
                              {locActual ? `${locActual.nombre} · ${locActual.direccion}` : 'Consultorio'}
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

    </div>
  );
};
