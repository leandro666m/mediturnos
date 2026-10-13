import React, { useEffect, useMemo, useState } from 'react';
import {
  User,
  Search,
  FileText,
  Clock,
  Calendar,
  Save,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  UploadCloud,
  File,
  Eye,
  Plus,
  BookOpen,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Sparkles,
  Phone,
  Mail,
  ShieldCheck,
  ChevronRight,
  X,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { ConsultationNote, NoteAttachment, Patient } from '../../../types';
import { formatearFechaCorta, formatearFechaLarga, formatearHora } from '../../../modules/format';

interface PacientesTabProps {
  pacientePreseleccionadoId?: string | null;
}

export const PacientesTab: React.FC<PacientesTabProps> = ({ pacientePreseleccionadoId }) => {
  const { patients, notes, professional, saveConsultationNote } = useApp();

  const [busqueda, setBusqueda] = useState('');
  const [pacienteSeleccionadoId, setPacienteSeleccionadoId] = useState<string>(
    pacientePreseleccionadoId || patients[0]?.id || ''
  );

  // Editor de Notas Clínicas
  const [notaTexto, setNotaTexto] = useState('');
  const [especialidadNota, setEspecialidadNota] = useState(professional.especialidad);
  const [adjuntos, setAdjuntos] = useState<NoteAttachment[]>([]);
  const [estadoGuardado, setEstadoGuardado] = useState<'guardado' | 'guardando' | 'offline'>('guardado');
  const [ultimaGuardada, setUltimaGuardada] = useState<string>('');

  // Modal de lectura de nota histórica
  const [notaLectura, setNotaLectura] = useState<ConsultationNote | null>(null);

  // Si cambia la preselección desde otra pestaña
  useEffect(() => {
    if (pacientePreseleccionadoId) {
      setPacienteSeleccionadoId(pacientePreseleccionadoId);
    }
  }, [pacientePreseleccionadoId]);

  const pacienteSeleccionado = useMemo(() => {
    return patients.find(p => p.id === pacienteSeleccionadoId) || patients[0];
  }, [patients, pacienteSeleccionadoId]);

  // Historial de notas del paciente
  const notasPaciente = useMemo(() => {
    if (!pacienteSeleccionado) return [];
    return notes
      .filter(n => n.patientId === pacienteSeleccionado.id)
      .sort((a, b) => new Date(b.atendidoEn).getTime() - new Date(a.atendidoEn).getTime());
  }, [notes, pacienteSeleccionado]);

  // Pacientes filtrados
  const pacientesFiltrados = useMemo(() => {
    if (!busqueda.trim()) return patients;
    const q = busqueda.toLowerCase().trim();
    return patients.filter(
      p =>
        p.nombre.toLowerCase().includes(q) ||
        p.dni.includes(q) ||
        p.telefonoE164.includes(q) ||
        p.email?.toLowerCase().includes(q)
    );
  }, [patients, busqueda]);

  // Cargar borrador al cambiar de paciente
  useEffect(() => {
    setNotaTexto('');
    setAdjuntos([]);
    setEstadoGuardado('guardado');
  }, [pacienteSeleccionadoId]);

  // Autoguardado con debounce de 1000ms (Regla 1.8 / 4.7)
  useEffect(() => {
    if (!notaTexto.trim()) return;

    setEstadoGuardado('guardando');
    const timer = setTimeout(() => {
      if (pacienteSeleccionado) {
        saveConsultationNote({
          patientId: pacienteSeleccionado.id,
          especialidad: especialidadNota,
          textoPlano: notaTexto,
          contenidoJson: JSON.stringify({ text: notaTexto }),
          adjuntos,
        });
        setEstadoGuardado('guardado');
        setUltimaGuardada(new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [notaTexto, adjuntos, especialidadNota, pacienteSeleccionado]);

  // Insertar plantilla SOAP rápida (Propuesta 1.8)
  const insertarPlantillaSoap = () => {
    const soapTemplate = `=== NOTA DE EVOLUCIÓN CLÍNICA ===
Fecha: ${formatearFechaLarga(new Date().toISOString())}

[S] SUBJETIVO:
El paciente refiere: 

[O] OBJETIVO:
Examen físico / Signos: 
Rango de movilidad / Palpación: 

[A] ANÁLISIS / DIAGNÓSTICO:
Evolución funcional: 

[P] PLAN TERAPÉUTICO:
Tratamiento realizado: 
Indicaciones domiciliarias: 
Próximo control: `;

    setNotaTexto(prev => (prev ? `${prev}\n\n${soapTemplate}` : soapTemplate));
  };

  // Simular subida de adjuntos (PDF / Estudios)
  const handleSubirAdjunto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const nuevoAdjunto: NoteAttachment = {
      id: 'att_' + Math.random().toString(36).slice(2, 8),
      nombre: file.name,
      tipoMime: file.type || 'application/pdf',
      tamanoBytes: file.size,
      url: URL.createObjectURL(file),
      subidoEn: new Date().toISOString(),
    };

    setAdjuntos(prev => [...prev, nuevoAdjunto]);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* COLUMNA IZQUIERDA: LISTA DE PACIENTES */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[750px]">
        
        {/* Cabecera y Buscador */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-sky-600" />
              <span>Directorio de Pacientes</span>
            </h3>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
              {patients.length} fichas
            </span>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, DNI..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-lg border border-slate-200 focus:border-sky-600 outline-none bg-white"
            />
          </div>
        </div>

        {/* Lista de Pacientes con scroll */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {pacientesFiltrados.map(p => {
            const isSelected = p.id === pacienteSeleccionado?.id;
            return (
              <div
                key={p.id}
                onClick={() => setPacienteSeleccionadoId(p.id)}
                className={`p-3.5 cursor-pointer transition-all flex items-center justify-between ${
                  isSelected ? 'bg-sky-50/80 border-l-4 border-sky-600' : 'hover:bg-slate-50'
                }`}
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">{p.nombre}</div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                    <span className="tabular-nums">DNI {p.dni}</span>
                    <span>·</span>
                    <span>{p.telefonoE164}</span>
                  </div>
                  {p.plan && (
                    <span className="text-[10px] text-sky-800 font-semibold bg-sky-100/60 px-1.5 py-0.2 rounded mt-1 inline-block">
                      {p.plan}
                    </span>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </div>
            );
          })}
        </div>

      </div>

      {/* COLUMNA DERECHA: FICHA CLÍNICA, EDITOR Y HISTORIA */}
      <div className="lg:col-span-8 space-y-6">
        
        {pacienteSeleccionado ? (
          <>
            {/* Header del Paciente */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{pacienteSeleccionado.nombre}</h2>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="font-semibold text-slate-800 tabular-nums">DNI {pacienteSeleccionado.dni}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {pacienteSeleccionado.telefonoE164}
                    </span>
                    {pacienteSeleccionado.email && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          {pacienteSeleccionado.email}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="text-right sm:self-center">
                  <span className="text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1 rounded-lg">
                    {pacienteSeleccionado.plan || 'Particular'}
                  </span>
                  {pacienteSeleccionado.nroAfiliado && (
                    <div className="text-[11px] text-slate-500 mt-1">
                      Afiliado: {pacienteSeleccionado.nroAfiliado}
                    </div>
                  )}
                </div>
              </div>

              {pacienteSeleccionado.notasInternas && (
                <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <strong className="text-slate-700">Observación clínica: </strong>
                  {pacienteSeleccionado.notasInternas}
                </div>
              )}
            </div>

            {/* EDITOR DE NOTAS CLÍNICAS (Regla 1.8 / 4.7) */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              
              {/* Barra de título y estado de autoguardado */}
              <div className="p-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Nueva Nota de Consulta / Evolución
                  </span>
                </div>

                {/* Indicador de 3 estados de guardado */}
                <div className="flex items-center gap-2 text-xs">
                  {estadoGuardado === 'guardando' ? (
                    <span className="text-amber-600 flex items-center gap-1 text-[11px] font-medium">
                      <Save className="w-3 h-3 animate-spin" /> Guardando...
                    </span>
                  ) : estadoGuardado === 'guardado' ? (
                    <span className="text-emerald-700 flex items-center gap-1 text-[11px] font-semibold">
                      <CheckCircle2 className="w-3 h-3" /> Guardado continuo {ultimaGuardada && `(${ultimaGuardada} hs)`}
                    </span>
                  ) : (
                    <span className="text-rose-600 flex items-center gap-1 text-[11px] font-medium">
                      <AlertCircle className="w-3 h-3" /> Sin conexión
                    </span>
                  )}

                  <button
                    onClick={insertarPlantillaSoap}
                    className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shadow-2xs"
                  >
                    <Sparkles className="w-3 h-3 text-sky-600" /> Plantilla SOAP
                  </button>
                </div>
              </div>

              {/* Barra de herramientas de formato estilo Tiptap */}
              <div className="p-2 border-b border-slate-100 bg-white flex flex-wrap items-center gap-1 text-slate-600">
                <button
                  type="button"
                  onClick={() => setNotaTexto(prev => prev + ' **negrita** ')}
                  className="p-1.5 hover:bg-slate-100 rounded text-xs font-bold"
                  title="Negrita"
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNotaTexto(prev => prev + ' *cursiva* ')}
                  className="p-1.5 hover:bg-slate-100 rounded text-xs"
                  title="Cursiva"
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNotaTexto(prev => prev + '\n- Item de lista')}
                  className="p-1.5 hover:bg-slate-100 rounded text-xs"
                  title="Lista con viñetas"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNotaTexto(prev => prev + '\n1. Item numerado')}
                  className="p-1.5 hover:bg-slate-100 rounded text-xs"
                  title="Lista numerada"
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setNotaTexto(prev => prev + '\n### Subtítulo\n')}
                  className="p-1.5 hover:bg-slate-100 rounded text-xs"
                  title="Título de sección"
                >
                  <Heading2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Área de texto de evolución clínica */}
              <div className="p-4">
                <textarea
                  rows={8}
                  value={notaTexto}
                  onChange={e => setNotaTexto(e.target.value)}
                  placeholder="Escribí aquí las notas clínicas de la consulta, anamnesis, tratamiento realizado, mediciones..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-sky-600 focus:ring-1 focus:ring-sky-600 font-sans leading-relaxed"
                />

                {/* Adjuntos */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                      <span>Estudios y Archivos Adjuntos (PDF / Imágenes)</span>
                    </span>

                    <label className="cursor-pointer text-xs font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Subir archivo
                      <input
                        type="file"
                        onChange={handleSubirAdjunto}
                        className="hidden"
                        accept=".pdf,.png,.jpg,.jpeg"
                      />
                    </label>
                  </div>

                  {adjuntos.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {adjuntos.map(att => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                        >
                          <File className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span className="font-medium text-slate-800 truncate max-w-[200px]">
                            {att.nombre}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            ({Math.round(att.tamanoBytes / 1024)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      No hay adjuntos en esta consulta. Podés adjuntar resonancias, análisis o radiografías.
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* HISTORIA CLÍNICA (Regla 1.8) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
              <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-sky-600" />
                <span>Historia Clínica Previa ({notasPaciente.length} registros)</span>
              </h3>

              {notasPaciente.length === 0 ? (
                <div className="text-center p-8 bg-slate-50 rounded-xl text-slate-400 text-xs">
                  Aún no hay evoluciones registradas para este paciente.
                </div>
              ) : (
                <div className="space-y-3">
                  {notasPaciente.map((nota, idx) => (
                    <div
                      key={nota.id}
                      className={`p-4 rounded-xl border transition-all ${
                        idx === 0
                          ? 'border-sky-200 bg-sky-50/30'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-bold text-slate-900">
                              {formatearFechaLarga(nota.atendidoEn)}
                            </span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600">{formatearHora(nota.atendidoEn)}</span>
                            {idx === 0 && (
                              <span className="text-[10px] bg-sky-100 text-sky-800 font-bold px-1.5 py-0.2 rounded">
                                Última consulta
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-700 mt-2 line-clamp-3 whitespace-pre-line">
                            {nota.textoPlano}
                          </p>

                          {nota.adjuntos.length > 0 && (
                            <div className="flex items-center gap-2 mt-2 text-xs text-sky-700">
                              <Paperclip className="w-3 h-3" />
                              <span>{nota.adjuntos.length} archivo(s) adjunto(s)</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setNotaLectura(nota)}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shrink-0 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Ver completa</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </>
        ) : (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-400">
            Seleccioná un paciente para ver su ficha clínica.
          </div>
        )}

      </div>

      {/* MODAL DE LECTURA DE NOTA CLÍNICA */}
      {notaLectura && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">
                  Evolución del {formatearFechaLarga(notaLectura.atendidoEn)}
                </h3>
                <span className="text-xs text-slate-500">
                  {formatearHora(notaLectura.atendidoEn)} · {notaLectura.especialidad}
                </span>
              </div>
              <button
                onClick={() => setNotaLectura(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 font-sans">
              {notaLectura.textoPlano}
            </div>

            {notaLectura.adjuntos.length > 0 && (
              <div className="mt-4">
                <span className="text-xs font-bold text-slate-700 block mb-2">Estudios adjuntos:</span>
                <div className="space-y-1.5">
                  {notaLectura.adjuntos.map(att => (
                    <div
                      key={att.id}
                      className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-sky-600" />
                        <span className="font-medium text-slate-800">{att.nombre}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {Math.round(att.tamanoBytes / 1024)} KB
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setNotaLectura(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
