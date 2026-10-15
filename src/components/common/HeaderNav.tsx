import React from 'react';
import {
  Calendar,
  ExternalLink,
  RotateCcw,
  UserCheck,
  Stethoscope,
  Smartphone,
  LayoutDashboard,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

export const HeaderNav: React.FC = () => {
  const { professional, activeZone, setActiveZone, resetToDemoData } = useApp();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-700 via-sky-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-sky-600/20">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-slate-900 tracking-tight">MediTurnos</span>
                <span className="text-[11px] font-semibold tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-100">
                  HITO 1
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                Turnero Digital para Especialistas de la Salud
              </p>
            </div>
          </div>

          {/* Selector de Zonas: Dashboard vs Portal */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveZone('dashboard')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeZone === 'dashboard'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard Profesional</span>
            </button>
            <button
              onClick={() => setActiveZone('portal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeZone === 'portal'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Portal Paciente</span>
            </button>
          </div>

          {/* Doctor Activo, PWA Install & Reset Demo */}
          <div className="flex items-center gap-2.5">
            <PWAInstallButton variant="outline" label="Instalar App" className="hidden sm:flex" />

            <div className="hidden lg:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-900">
                {professional.titulo} {professional.nombre}
              </span>
              <span className="text-[11px] text-slate-500">
                {professional.especialidad} · M.N. {professional.matriculaNacional}
              </span>
            </div>

            <button
              onClick={() => {
                if (window.confirm('¿Reiniciar todos los datos a la demo original de Lic. Martín Benítez?')) {
                  resetToDemoData();
                }
              }}
              title="Reiniciar datos demo"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors border border-transparent hover:border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};
