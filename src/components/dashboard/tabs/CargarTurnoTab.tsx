import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Video,
  User,
  Search,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Plus,
  X,
  CreditCard,
  UploadCloud,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { Modalidad } from '../../../types';
import {
  formatearFechaLarga,
  formatearHora,
  formatearMoneda,
  normalizarTelefonoArgentino,
  validarDni,
} from '../../../modules/format';
import { getSlotsForDate, validateSlotTime } from '../../../modules/availability';

interface CargarTurnoTabProps {
  onTurnoAgendado: () => void;
}

export const CargarTurnoTab: React.FC<CargarTurnoTabProps> = ({ onTurnoAgendado }) => {
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
    patients,
    findPatientByDni,
    bookAppointment,
    addCoverage,
  } = useApp();

  // Bloque 1: Paciente
  const [dni, setDni] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [pacienteEncontrado, setPacienteEncontrado] = useState(false);

  // Bloque 2: Turno
  const [servicioId, setServicioId] = useState(services[0]?.id || '');
  const [modalidad, setModalidad] = useState<Modalidad>('presencial');
  const [locationId, setLocationId] = useState(locations[0]?.id || '');
  const [fechaTurno, setFechaTurno] = useState(() => new Date().toISOString().slice(0, 10));
  const [horaTurno, setHoraTurno] = useState('10:00');
  const [esSobreturno, setEsSobreturno] = useState(false);

  // Bloque 3: Cobertura y Motivo
  const [coberturaId, setCoberturaId] = useState('');
  const [plan, setPlan] = useState('');
  const [nroAfiliado, setNroAfiliado] = useState('');
  const [motivo, setMotivo] = useState('');

  // Bloque 4: Cobro de Arancel Completo (Hito 2)
  const [marcarPagadoCompleto, setMarcarPagadoCompleto] = useState(false);
  const [previewComprobanteManual, setPreviewComprobanteManual] = useState<string | null>(null);

  // Modal para Agregar Obra Social / Prepaga
  const [mostrarModalAgregarCobertura, setMostrarModalAgregarCobertura] = useState(false);
  const [nuevaCoberturaNombre, setNuevaCoberturaNombre] = useState('');
  const [errorNuevaCobertura, setErrorNuevaCobertura] = useState('');

  // Errores
  const [errores, setErrores] = useState<Record<string, string>>({});

  const servicioSeleccionado = services.find(s => s.id === servicioId) || services[0];

  const handleGuardarNuevaCobertura = () => {
    if (!nuevaCoberturaNombre.trim()) {
      setErrorNuevaCobertura('Ingresá el nombre de la obra social o prepaga.');
      return;
    }
    const creada = addCoverage(nuevaCoberturaNombre.trim());
    setCoberturaId(creada.id);
    setMostrarModalAgregarCobertura(false);
    setNuevaCoberturaNombre('');
    setErrorNuevaCobertura('');
  };

  // Autocompletar datos al tipear el DNI (Regla 1.7)
  const handleDniChange = (val: string) => {
    setDni(val);
    const clean = val.replace(/\D/g, '');
    if (clean.length >= 7) {
      const p = findPatientByDni(clean);
      if (p) {
        setNombre(p.nombre);
        setTelefono(p.telefonoE164);
        setEmail(p.email || '');
        setCoberturaId(p.coverageId || '');
        setPlan(p.plan || '');
        setNroAfiliado(p.nroAfiliado || '');
        setPacienteEncontrado(true);
      } else {
        setPacienteEncontrado(false);
      }
    } else {
      setPacienteEncontrado(false);
    }
  };

  // Disponibilidad y huecos del día según Horarios & Especialidad
  const disponibilidadDia = useMemo(() => {
    if (!servicioSeleccionado || !fechaTurno) return null;
    return getSlotsForDate({
      dateString: fechaTurno,
      service: servicioSeleccionado,
      professional,
      workingHours,
      holidays,
      timeOffs,
      appointments,
      holds,
      modalidad,
      ignoreAnticipation: true,
    });
  }, [servicioSeleccionado, fechaTurno, professional, workingHours, holidays, timeOffs, appointments, holds, modalidad]);

  // Validación minuciosa de la hora seleccionada
  const validacionHora = useMemo(() => {
    if (!servicioSeleccionado || !fechaTurno || !horaTurno) return null;
    return validateSlotTime({
      dateString: fechaTurno,
      hora: horaTurno,
      service: servicioSeleccionado,
      professional,
      workingHours,
      holidays,
      timeOffs,
      appointments,
      modalidad,
    });
  }, [servicioSeleccionado, fechaTurno, horaTurno, professional, workingHours, holidays, timeOffs, appointments, modalidad]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};

    if (!nombre.trim()) errs.nombre = 'Ingresá el nombre del paciente.';
    const vDni = validarDni(dni);
    if (!vDni.valido) errs.dni = 'DNI inválido (7 u 8 dígitos).';
    const normTel = normalizarTelefonoArgentino(telefono);
    if (!normTel.valido) errs.telefono = 'Teléfono celular argentino inválido.';

    // Validación según Horarios & Especialidad
    if (!esSobreturno && validacionHora && !validacionHora.valido) {
      errs.horaTurno = validacionHora.mensaje;
    }

    if (Object.keys(errs).length > 0) {
      setErrores(errs);
      return;
    }

    // Calcular inicio y fin del turno
    const [anio, mes, diaNum] = fechaTurno.split('-').map(Number);
    const [h, m] = horaTurno.split(':').map(Number);
    const inicioDate = new Date(anio, mes - 1, diaNum, h, m, 0, 0);
    const duracion = servicioSeleccionado ? servicioSeleccionado.duracionMin : 30;
    const finDate = new Date(inicioDate.getTime() + duracion * 60 * 1000);

    const res = bookAppointment({
      serviceId: servicioId,
      inicio: inicioDate.toISOString(),
      fin: finDate.toISOString(),
      modalidad,
      locationId: modalidad === 'presencial' ? locationId : undefined,
      pacienteNombre: nombre,
      pacienteDni: vDni.dni,
      pacienteTelefono: normTel.e164,
      pacienteEmail: email,
      pacienteCoberturaId: coberturaId || null,
      pacientePlan: plan,
      pacienteAfiliado: nroAfiliado,
      motivo,
      origen: 'dashboard',
      esSobreturno,
      estadoPago: marcarPagadoCompleto ? 'pagado' : 'sin_pago',
      comprobantePago: previewComprobanteManual
        ? {
            url: previewComprobanteManual,
            nombreArchivo: 'comprobante-arancel-completo.jpg',
            subidoEn: new Date().toISOString(),
            montoCentavos: servicioSeleccionado.precioCentavos,
            estado: 'aprobado',
            notasRevision: 'Comprobante acreditado en carga manual por el profesional.',
          }
        : undefined,
    });

    if (res.success) {
      alert('¡Turno agendado correctamente!');
      onTurnoAgendado();
    } else {
      alert(res.error || 'No se pudo agendar el turno.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Banner de ayuda */}
      <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-4 flex items-start gap-3">
        <HelpCircle className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-900">
          <strong className="font-semibold block">Carga manual de turno</strong>
          Ideal para pacientes que llaman por teléfono o coordinan de forma presencial en el mostrador. Al ingresar el DNI, se autocompletan los datos si el paciente ya fue atendido.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        
        {/* BLOQUE 1: PACIENTE */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-sky-600" />
              <span>1. Datos del Paciente</span>
            </h3>
            {pacienteEncontrado && (
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Paciente existente
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                DNI (sin puntos) *
              </label>
              <input
                type="text"
                required
                value={dni}
                onChange={e => handleDniChange(e.target.value)}
                placeholder="Ej. 36842190"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none tabular-nums"
              />
              {errores.dni && <p className="text-[11px] text-red-600 mt-1">{errores.dni}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nombre y Apellido completo *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej. Florencia Gómez"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
              {errores.nombre && <p className="text-[11px] text-red-600 mt-1">{errores.nombre}</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Teléfono / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="Ej. 11 4521-8844"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
              {errores.telefono && <p className="text-[11px] text-red-600 mt-1">{errores.telefono}</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email de contacto (opcional)
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ejemplo@correo.com"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 2: TURNO */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600" />
              <span>2. Datos del Turno y Horario</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Servicio / Consulta *
              </label>
              <select
                value={servicioId}
                onChange={e => setServicioId(e.target.value)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none bg-white font-medium"
              >
                {services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.nombre} ({s.duracionMin} min) — {formatearMoneda(s.precioCentavos)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Modalidad *
              </label>
              <select
                value={modalidad}
                onChange={e => setModalidad(e.target.value as Modalidad)}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none bg-white"
              >
                <option value="presencial">Presencial</option>
                <option value="videollamada">Videollamada por WhatsApp</option>
              </select>
            </div>

            {modalidad === 'presencial' && (
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Consultorio / Ubicación
                </label>
                <select
                  value={locationId}
                  onChange={e => setLocationId(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none bg-white"
                >
                  {locations.filter(l => l.activa).map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.nombre} — {loc.direccion}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Fecha del Turno *
                </label>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const hoy = new Date().toISOString().slice(0, 10);
                      setFechaTurno(hoy);
                      setErrores(prev => {
                        const n = { ...prev };
                        delete n.horaTurno;
                        return n;
                      });
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const manana = new Date();
                      manana.setDate(manana.getDate() + 1);
                      setFechaTurno(manana.toISOString().slice(0, 10));
                      setErrores(prev => {
                        const n = { ...prev };
                        delete n.horaTurno;
                        return n;
                      });
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                  >
                    Mañana
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const prox = new Date();
                      prox.setDate(prox.getDate() + 7);
                      setFechaTurno(prox.toISOString().slice(0, 10));
                      setErrores(prev => {
                        const n = { ...prev };
                        delete n.horaTurno;
                        return n;
                      });
                    }}
                    className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors cursor-pointer"
                  >
                    +7 días
                  </button>
                </div>
              </div>
              <input
                type="date"
                required
                value={fechaTurno}
                onChange={e => {
                  setFechaTurno(e.target.value);
                  setErrores(prev => {
                    const n = { ...prev };
                    delete n.horaTurno;
                    return n;
                  });
                }}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hora de Inicio *
              </label>
              <input
                type="time"
                required
                value={horaTurno}
                onChange={e => {
                  setHoraTurno(e.target.value);
                  setErrores(prev => {
                    const n = { ...prev };
                    delete n.horaTurno;
                    return n;
                  });
                }}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
              {/* Feedback de validación en tiempo real */}
              {validacionHora && (
                <div
                  className={`mt-1.5 p-2 rounded-lg text-xs flex items-start gap-1.5 ${
                    validacionHora.valido
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-900'
                      : esSobreturno
                      ? 'bg-amber-50 border border-amber-200 text-amber-900'
                      : 'bg-rose-50 border border-rose-200 text-rose-900'
                  }`}
                >
                  {validacionHora.valido ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle
                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                        esSobreturno ? 'text-amber-600' : 'text-rose-600'
                      }`}
                    />
                  )}
                  <span className="leading-snug">
                    {validacionHora.valido
                      ? `✓ ${validacionHora.mensaje}`
                      : esSobreturno
                      ? `${validacionHora.mensaje} (Sobreturno habilitado como excepción)`
                      : validacionHora.mensaje}
                  </span>
                </div>
              )}
              {errores.horaTurno && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errores.horaTurno}</p>
              )}
            </div>

            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 text-xs font-semibold text-amber-900 cursor-pointer bg-amber-50 p-2.5 rounded-lg border border-amber-200 w-full">
                <input
                  type="checkbox"
                  checked={esSobreturno}
                  onChange={e => {
                    setEsSobreturno(e.target.checked);
                    setErrores(prev => {
                      const n = { ...prev };
                      delete n.horaTurno;
                      return n;
                    });
                  }}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <span>Habilitar como Sobreturno</span>
              </label>
            </div>
          </div>

          {/* Banner de Jornada Diaria / No Laborable según Horarios & Especialidad */}
          {disponibilidadDia && (
            <div className="mt-3">
              {!disponibilidadDia.isWorkingDay ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <strong>Día sin atención médica configurada:</strong>
                    <p className="mt-0.5">{disponibilidadDia.reasonUnavailable}</p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-sky-50/80 border border-sky-200/80 rounded-xl text-xs text-sky-950 flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">{disponibilidadDia.diaNombre}:</span>{' '}
                    <span>{disponibilidadDia.franjasTexto}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Atajos de huecos libres para la fecha según Horarios & Especialidad */}
          {disponibilidadDia?.isWorkingDay && (
            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Horarios libres según 'Horarios & Especialidad' ({disponibilidadDia.slots.length} disponibles):
                </span>
              </div>
              {disponibilidadDia.slots.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                  {disponibilidadDia.slots.map((s, idx) => (
                    <button
                      key={`${s.inicio}-${idx}`}
                      type="button"
                      onClick={() => {
                        setHoraTurno(s.hora);
                        setErrores(prev => {
                          const n = { ...prev };
                          delete n.horaTurno;
                          return n;
                        });
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        horaTurno === s.hora
                          ? 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/30'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50 hover:border-sky-300'
                      }`}
                    >
                      {s.hora} hs
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-1">
                  No hay horarios libres disponibles para la fecha seleccionada según la configuración.
                </div>
              )}
            </div>
          )}
        </div>

        {/* BLOQUE 3: COBERTURA Y MOTIVO */}
        <div>
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600" />
              <span>3. Cobertura Médica y Motivo</span>
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Obra Social / Prepaga
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNuevaCoberturaNombre('');
                    setErrorNuevaCobertura('');
                    setMostrarModalAgregarCobertura(true);
                  }}
                  className="text-[11px] font-semibold text-sky-700 hover:text-sky-800 hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="Agregar una nueva obra social o prepaga al listado"
                >
                  <Plus className="w-3 h-3" /> Agregar
                </button>
              </div>
              <select
                value={coberturaId}
                onChange={e => {
                  if (e.target.value === '__AGREGAR__') {
                    setNuevaCoberturaNombre('');
                    setErrorNuevaCobertura('');
                    setMostrarModalAgregarCobertura(true);
                    return;
                  }
                  setCoberturaId(e.target.value);
                }}
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none bg-white font-medium"
              >
                <option value="">Particular (sin obra social)</option>
                {coverages.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
                <option value="__AGREGAR__" className="text-sky-700 font-bold bg-sky-50">
                  ➕ Agregar obra social / prepaga...
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Plan
              </label>
              <input
                type="text"
                value={plan}
                onChange={e => setPlan(e.target.value)}
                placeholder="Ej. 310 / Plata"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nº de Afiliado
              </label>
              <input
                type="text"
                value={nroAfiliado}
                onChange={e => setNroAfiliado(e.target.value)}
                placeholder="Ej. 14890234/01"
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Motivo de consulta (visible en la agenda)
              </label>
              <textarea
                rows={2}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej. Dolor lumbar agudo, derivación médica, primera vez..."
                className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 4: COBRO DEL ARANCEL COMPLETO (HITO 2) */}
        <div className="p-4 bg-emerald-50/60 border border-emerald-200/90 rounded-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>4. Cobro del Arancel Completo (100%)</span>
            </h3>
            <span className="text-xs font-black text-emerald-800 tabular-nums bg-emerald-100 px-2.5 py-0.5 rounded-full">
              {formatearMoneda(servicioSeleccionado ? servicioSeleccionado.precioCentavos : 0)}
            </span>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2.5 text-xs text-slate-800 font-semibold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={marcarPagadoCompleto}
                onChange={e => setMarcarPagadoCompleto(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>Marcar consulta como abonada en el acto (Arancel Completo percibido)</span>
            </label>

            {marcarPagadoCompleto && (
              <div className="pt-2 border-t border-emerald-200/60 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600 text-[11px]">
                    Comprobante digital (opcional para auditoría o archivo):
                  </span>
                  <input
                    type="file"
                    id="archivo-comprobante-manual-input"
                    accept="image/*,.pdf"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = ev => {
                          setPreviewComprobanteManual(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="archivo-comprobante-manual-input"
                    className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs transition-colors"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>{previewComprobanteManual ? 'Cambiar archivo' : 'Adjuntar ticket'}</span>
                  </label>
                </div>

                {previewComprobanteManual && (
                  <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-emerald-200">
                    <img
                      src={previewComprobanteManual}
                      alt="Preview comprobante"
                      className="w-10 h-10 object-cover rounded border border-slate-200"
                    />
                    <span className="text-[11px] text-emerald-800 font-medium">Comprobante adjuntado listo para archivar</span>
                    <button
                      type="button"
                      onClick={() => setPreviewComprobanteManual(null)}
                      className="ml-auto text-slate-400 hover:text-slate-600 p-1 text-xs"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="submit"
            className="px-6 py-2.5 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-all shadow-sm shadow-sky-600/30 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Agendar turno</span>
          </button>
        </div>

      </form>

      {/* Modal para Agregar Nueva Obra Social / Prepaga */}
      {mostrarModalAgregarCobertura && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-sky-600" />
                <span>Agregar Obra Social / Prepaga</span>
              </h4>
              <button
                type="button"
                onClick={() => setMostrarModalAgregarCobertura(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nombre de la Obra Social / Prepaga *
                </label>
                <input
                  type="text"
                  autoFocus
                  value={nuevaCoberturaNombre}
                  onChange={e => {
                    setNuevaCoberturaNombre(e.target.value);
                    if (errorNuevaCobertura) setErrorNuevaCobertura('');
                  }}
                  placeholder="Ej. Medifé, Galeno, IOMA, PAMI, etc."
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:border-sky-600 outline-none"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleGuardarNuevaCobertura();
                    }
                  }}
                />
                {errorNuevaCobertura && (
                  <p className="text-[11px] text-red-600 mt-1">{errorNuevaCobertura}</p>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarModalAgregarCobertura(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarNuevaCobertura}
                className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-lg hover:bg-sky-700 shadow-xs transition-colors cursor-pointer"
              >
                Guardar y Seleccionar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
