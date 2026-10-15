import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Tablet, Sparkles } from 'lucide-react';
import { usePWAInstall } from '../../modules/usePWAInstall';
import { PWAInstallButton } from './PWAInstallButton';

export const PWAInstallBanner: React.FC = () => {
  const { isInstalled, isMobileOrTablet } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const isDismissed = localStorage.getItem('mediturnos_pwa_banner_dismissed') === 'true';
      setDismissed(isDismissed);
    } catch {
      // Ignorar
    }
  }, []);

  // Si ya está instalada o el usuario cerró el banner, no mostrarlo
  if (isInstalled || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem('mediturnos_pwa_banner_dismissed', 'true');
    } catch {
      // Ignorar
    }
  };

  return (
    <div className="bg-gradient-to-r from-sky-900 via-sky-800 to-teal-800 text-white rounded-2xl p-4 sm:p-5 shadow-sm border border-sky-700/50 mb-6 relative overflow-hidden">
      {/* Círculos decorativos de fondo */}
      <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute left-1/2 -top-12 w-32 h-32 bg-teal-400/10 rounded-full blur-xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5 pr-8 sm:pr-0">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center text-sky-200 border border-white/10 shrink-0">
            {isMobileOrTablet ? (
              <Smartphone className="w-6 h-6 text-sky-300" />
            ) : (
              <Tablet className="w-6 h-6 text-sky-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-teal-300 bg-teal-900/50 px-2 py-0.5 rounded-full border border-teal-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> PWA Móvil & Tablet
              </span>
              <span className="text-xs text-sky-200">Acceso directo en tu dispositivo</span>
            </div>
            <h4 className="font-bold text-sm sm:text-base text-white mt-1">
              Instalá el Dashboard de MediTurnos en tu móvil o tablet
            </h4>
            <p className="text-xs text-sky-100/90 mt-0.5 max-w-2xl leading-relaxed">
              Trabajá como en una app nativa: abrí tu agenda, gestioná turnos y cargá notas clínicas directamente desde tu pantalla de inicio, sin tener que ingresar al navegador ni buscar la web.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <PWAInstallButton
            variant="primary"
            label="Instalar Aplicación"
            className="w-full sm:w-auto justify-center"
          />
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 text-sky-200/70 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
            title="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
