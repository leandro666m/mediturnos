import React, { useState } from 'react';
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2, Tablet } from 'lucide-react';
import { usePWAInstall } from '../../modules/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'compact';
  label?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'secondary',
  label,
}) => {
  const { isInstallable, isInstalled, isIOS, isMobileOrTablet, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // Si ya está ejecutándose como aplicación instalada, no mostramos el botón
  if (isInstalled) {
    return 
  /*     <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        <span>App Instalada</span>
      </span> */
    
  }

  const defaultLabel = label || (isMobileOrTablet ? 'Instalar App' : 'Instalar en Móvil / PC');

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  const getButtonStyles = () => {
    if (variant === 'primary') {
      return 'bg-gradient-to-r from-sky-600 to-teal-600 hover:from-sky-700 hover:to-teal-700 text-white shadow-sm shadow-sky-600/25';
    }
    if (variant === 'outline') {
      return 'bg-white hover:bg-slate-50 text-sky-700 border border-sky-300 shadow-2xs';
    }
    if (variant === 'compact') {
      return 'p-1.5 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg';
    }
    return 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs';
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`flex items-center gap-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
          variant === 'compact' ? 'p-1.5' : 'px-3.5 py-2'
        } ${getButtonStyles()} ${className}`}
        title="Instalar MediTurnos como aplicación PWA en tu tablet, celular o computadora"
      >
        <Download className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        {variant !== 'compact' && <span>{defaultLabel}</span>}
      </button>

      {/* MODAL GUÍA DE INSTALACIÓN PWA (Para iOS Safari y navegadores sin prompt automático) */}
      {showGuide && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-teal-500 text-white flex items-center justify-center shadow-sm">
                  {isMobileOrTablet ? <Smartphone className="w-5 h-5" /> : <Tablet className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Instalar MediTurnos Profesional
                  </h3>
                  <p className="text-xs text-slate-500">
                    Accedé a tu agenda como una app nativa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              // Instrucciones específicas para iPhone / iPad en Safari
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  En iOS (iPhone o iPad), podés agregar la aplicación directamente a tu pantalla de inicio desde Safari:
                </p>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Tocá el botón Compartir
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        Es el ícono <Share className="w-3.5 h-3.5 text-sky-600 inline" /> en la barra inferior de Safari.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Deslizá y elegí "Agregar a pantalla de inicio"
                      </span>
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        Aparece con el ícono <PlusSquare className="w-3.5 h-3.5 text-sky-600 inline" /> en las opciones del menú.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Tocá "Agregar" arriba a la derecha
                      </span>
                      <span className="text-[11px] text-slate-500">
                        ¡Listo! MediTurnos se abrirá en pantalla completa como una aplicación.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Instrucciones para Android / Chrome / Edge / Desktop
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Para instalar MediTurnos en tu dispositivo y usarla sin abrir el navegador:
                </p>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Abrí el menú del navegador (tres puntos ⋮)
                      </span>
                      <span className="text-[11px] text-slate-500">
                        En la esquina superior o inferior derecha de Chrome / Edge / Samsung Internet.
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Seleccioná "Instalar aplicación" o "Agregar a la pantalla principal"
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Confirmá la instalación para crear el acceso directo en tu móvil, tablet o PC.
                      </span>
                    </div>
                  </div>
                </div>

                {isInstallable && (
                  <button
                    type="button"
                    onClick={async () => {
                      await install();
                      setShowGuide(false);
                    }}
                    className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>Intentar instalación automática ahora</span>
                  </button>
                )}
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
