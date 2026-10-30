import React, { useEffect, useState } from 'react';
import {
  Calendar,
  PlusCircle,
  Users,
  Clock,
  Share2,
  FileDown,
  ExternalLink,
  Settings,
  MapPin,
  Shield,
  Stethoscope,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AgendaTab } from './tabs/AgendaTab';
import { CargarTurnoTab } from './tabs/CargarTurnoTab';
import { PacientesTab } from './tabs/PacientesTab';
import { HorariosTab } from './tabs/HorariosTab';
import { DifusionTab } from './tabs/DifusionTab';
import { MetricasTab } from './tabs/MetricasTab';
import { PerfilModal } from './PerfilModal';
import { PWAInstallButton } from '../common/PWAInstallButton';

export const DoctorDashboard: React.FC = () => {
  const { professional, locations, appointments, exportarCsvTurnos, setActiveZone, isDriveConnected, isConnectingDrive, connectGoogleDrive } = useApp();

  type DashboardTab = 'agenda' | 'nuevo_turno' | 'pacientes' | 'horarios' | 'difusion' | 'metricas';
  const tabStorageKey = `mediturnos_dashboard_tab_${professional.id}`;
  const perfilModalStorageKey = `mediturnos_perfil_modal_${professional.id}`;
  const [tabActiva, setTabActiva] = useState<DashboardTab>(() => {
    try {
      const savedTab = sessionStorage.getItem(tabStorageKey);
      return savedTab && ['agenda', 'nuevo_turno', 'pacientes', 'horarios', 'difusion', 'metricas'].includes(savedTab) ? savedTab as DashboardTab : 'agenda';
    } catch {
      return 'agenda';
    }
  });
  const [pacientePreseleccionadoId, setPacientePreseleccionadoId] = useState<string | null>(null);
  const [modalPerfilAbierto, setModalPerfilAbierto] = useState(() => {
    try {
      return sessionStorage.getItem(perfilModalStorageKey) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(tabStorageKey, tabActiva);
    } catch {
      // La navegación sigue funcionando si el navegador bloquea el almacenamiento de sesión.
    }
  }, [tabActiva, tabStorageKey]);

  useEffect(() => {
    try {
      sessionStorage.setItem(perfilModalStorageKey, String(modalPerfilAbierto));
    } catch {
      // La navegación sigue funcionando si el navegador bloquea el almacenamiento de sesión.
    }
  }, [modalPerfilAbierto, perfilModalStorageKey]);

  const handleVerFichaPaciente = (pacienteId: string) => {
    setPacientePreseleccionadoId(pacienteId);
    setTabActiva('pacientes');
  };

  return (
    <div className="min-h-screen bg-slate-200 pb-16">

      {/* HEADER PRINCIPAL DEL DASHBOARD (Regla 1.5) */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

            {/* Identificación del profesional */}
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-sky-700 to-sky-500 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-sky-600/20 shrink-0 overflow-hidden">
                {professional.fotoPerfil ? (
                  <img
                    src={professional.fotoPerfil}
                    alt={professional.nombre}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  professional.nombre.charAt(0)
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                    {professional.titulo} {professional.nombre}
                  </h1>
                  <button
                    onClick={() => setModalPerfilAbierto(true)}
                    className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Editar Perfil y Configuración"
                  >
                    <Settings className="w-4 h-4" />
                  </button>

                  {/* Botón para reconectar con Google Drive */}
                  <button
                    type="button"
                    title={isDriveConnected ? 'Conectado a Google Drive' : 'Reconectar a Google Drive'}
                    disabled={isConnectingDrive || isDriveConnected}
                    onClick={async () => await connectGoogleDrive()}
                    className={`px-4 py-2 ${isDriveConnected ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-100 border border-red-200'} rounded-xl text-xs font-bold text-slate-800 shadow-2xs flex items-center gap-2 shrink-0 cursor-pointer transition-all disabled:opacity-60`}
                  >
                    {isConnectingDrive ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-600" />
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
                            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                            <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
                            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                          </svg>
                        </>
                      )}
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                  <span className="font-semibold text-sky-800">{professional.especialidad}</span>
                  <span>·</span>
                  <span>M.N. {professional.matriculaNacional}</span>
                  <span>·</span>
                  <span>M.P. {professional.matriculaProvincial}</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400 mt-1">
                  {locations.filter(l => l.activa).map(loc => (
                    <span key={loc.id} className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{loc.nombre}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Acciones Rápidas del Header */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Instalar App PWA */}
              <PWAInstallButton variant="outline" label="Instalar App" />

              {/* Ver portal como paciente */}
              <button
                onClick={() => setActiveZone('portal')}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>Ver portal como paciente</span>
              </button>

              {/* Exportar CSV (Regla 1.5) */}
              {/* <button
                onClick={() => exportarCsvTurnos(appointments)}
                title="Descargar agenda completa en archivo CSV para Excel"
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all"
              >
                <FileDown className="w-3.5 h-3.5 text-slate-500" />
                <span>Exportar CSV</span>
              </button> */}

              {/* Cargar nuevo turno */}
              <button
                onClick={() => setTabActiva('nuevo_turno')}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-sky-600/30 transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nuevo turno</span>
              </button>
            </div>

          </div>

          {/* Barra de Pestañas (Tabs principales) */}
          <div className="flex items-center gap-1 sm:gap-2 mt-6 border-b border-slate-200 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setTabActiva('agenda')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${tabActiva === 'agenda'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Agenda & Turnos</span>
            </button>

            <button
              onClick={() => setTabActiva('nuevo_turno')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${tabActiva === 'nuevo_turno'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <PlusCircle className="w-4 h-4" />
              <span>Cargar turno</span>
            </button>

            <button
              onClick={() => setTabActiva('pacientes')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${tabActiva === 'pacientes'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Users className="w-4 h-4" />
              <span>Pacientes y Notas</span>
            </button>

            <button
              onClick={() => setTabActiva('horarios')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${tabActiva === 'horarios'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Clock className="w-4 h-4" />
              <span>Horarios & Especialidad</span>
            </button>

            <button
              onClick={() => setTabActiva('difusion')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${tabActiva === 'difusion'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <Share2 className="w-4 h-4" />
              <span>Difusión y QR</span>
            </button>

            <button
              onClick={() => setTabActiva('metricas')}
              className={`pb-3 px-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${tabActiva === 'metricas'
                ? 'border-sky-600 text-sky-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Métricas & Reportes</span>
            </button>
          </div>

        </div>
      </div>

      {/* CONTENIDO DE LA PESTAÑA ACTIVA */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {tabActiva === 'agenda' && (
          <AgendaTab
            onVerFichaPaciente={handleVerFichaPaciente}
            onCargarNuevoTurno={() => setTabActiva('nuevo_turno')}
          />
        )}

        {tabActiva === 'nuevo_turno' && (
          <CargarTurnoTab onTurnoAgendado={() => setTabActiva('agenda')} />
        )}

        {tabActiva === 'pacientes' && (
          <PacientesTab pacientePreseleccionadoId={pacientePreseleccionadoId} />
        )}

        {tabActiva === 'horarios' && <HorariosTab />}

        {tabActiva === 'difusion' && <DifusionTab />}

        {tabActiva === 'metricas' && <MetricasTab />}
      </main>

      {/* MODAL PERFIL */}
      <PerfilModal
        isOpen={modalPerfilAbierto}
        onClose={() => setModalPerfilAbierto(false)}
      />

    </div>
  );
};
