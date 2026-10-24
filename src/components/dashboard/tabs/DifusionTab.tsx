import React, { useEffect, useRef, useState } from 'react';
import {
  Share2,
  QrCode,
  Copy,
  Check,
  Send,
  Printer,
  Download,
  AlertTriangle,
  ExternalLink,
  Pause,
  Play,
  Instagram,
  FileText,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useApp } from '../../../context/AppContext';
import { esSlugReservado, esSlugValido } from '../../../data/mappers';

export const DifusionTab: React.FC = () => {
  const { professional, toggleAgendaPausa, updateProfessional } = useApp();

  const [copiadoEnlace, setCopiadoEnlace] = useState(false);
  const [copiadoTextoWa, setCopiadoTextoWa] = useState(false);
  const [copiadoBio, setCopiadoBio] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [slugInput, setSlugInput] = useState(professional.slug);
  const [modoImpresionA4, setModoImpresionA4] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  const urlReserva = `${window.location.origin}#/${professional.slug}`;
  const urlPermanente = `${window.location.origin}#/r/${professional.publicId}`;

  // Generar código QR dinámico
  useEffect(() => {
    // Generar con la URL permanente para que persista aunque cambie el slug (Regla D-15)
    QRCode.toDataURL(urlReserva, {
      width: 400,
      margin: 2,
      color: {
        dark: '#0369A1', // Azul médico
        light: '#FFFFFF',
      },
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error(err));
  }, [urlReserva]);

  const textoWhatsApp = `¡Hola! Podés reservar tu turno con ${professional.titulo} ${professional.nombre} (${professional.especialidad}) de forma online en cualquier momento ingresando al enlace: ${urlReserva}`;

  const textoBio = `🩺 ${professional.titulo} ${professional.nombre} | ${professional.especialidad}\n📅 Turnos online 24/7 sin registrarte:\n👉 ${urlReserva}`;

  const handleCopiar = (texto: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(texto);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  const handleDescargarQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `QR-MediTurnos-${professional.slug}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleGuardarSlug = () => {
    const clean = slugInput
      .toLowerCase()
      .trim();
    if (!esSlugValido(clean)) {
      alert('El enlace debe tener entre 3 y 50 caracteres y solo contener letras minúsculas, números y guiones (sin guiones al inicio ni al final).');
      return;
    }
    if (esSlugReservado(clean)) {
      alert('Este enlace no está disponible. Elegí otro.');
      return;
    }
    updateProfessional({ slug: clean });
    alert('Enlace personalizado actualizado.');
  };

  return (
    <div className="space-y-6">

      {/* BANNER DE PAUSA DE AGENDA ONLINE (Regla 1.10) */}
      <div
        className={`p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          professional.agendaPausada
            ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              professional.agendaPausada ? 'bg-amber-200 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {professional.agendaPausada ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 text-emerald-600" />}
          </div>
          <div>
            <h4 className="font-bold text-sm">
              {professional.agendaPausada ? 'Agenda Online Pausada' : 'Agenda Online Abierta y Activa'}
            </h4>
            <p className="text-xs text-slate-500">
              {professional.agendaPausada
                ? 'Los pacientes no pueden reservar nuevos turnos en este momento desde tu enlace.'
                : 'Cualquier paciente puede acceder a tu enlace o escanear el QR para reservar turnos.'}
            </p>
          </div>
        </div>

        <button
          onClick={toggleAgendaPausa}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
            professional.agendaPausada
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
              : 'bg-amber-600 text-white hover:bg-amber-700 shadow-xs'
          }`}
        >
          {professional.agendaPausada ? 'Reanudar Agenda' : 'Pausar Agenda Online'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMNA IZQUIERDA: ENLACE PÚBLICO Y MENSAJES DE DIFUSIÓN */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* Tarjeta Enlace Público */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Share2 className="w-4 h-4 text-sky-600" />
              <span>Tu Enlace de Reserva Online</span>
            </h3>

            <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-500 font-mono truncate flex-1">
                {urlReserva}
              </span>
              <button
                onClick={() => handleCopiar(urlReserva, setCopiadoEnlace)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1 shrink-0 shadow-2xs"
              >
                {copiadoEnlace ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiadoEnlace ? '¡Copiado!' : 'Copiar'}</span>
              </button>
            </div>

            {/* Editor de Slug */}
            <div className="pt-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Personalizar enlace (Slug):
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-mono">mediturnos.app/</span>
                <input
                  type="text"
                  value={slugInput}
                  onChange={e => setSlugInput(e.target.value)}
                  className="text-xs p-2 rounded-lg border border-slate-200 flex-1 font-mono outline-none focus:border-sky-600"
                />
                <button
                  onClick={handleGuardarSlug}
                  className="px-3 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800"
                >
                  Guardar
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Los carteles con código QR ya impresos seguirán funcionando siempre porque usan tu identificador permanente inmutable ({professional.publicId}).
              </p>
            </div>
          </div>

          {/* Difusión por WhatsApp */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600" />
              <span>Mensaje listo para reenviar a pacientes</span>
            </h4>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-sans">
              {textoWhatsApp}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => handleCopiar(textoWhatsApp, setCopiadoTextoWa)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-2xs"
              >
                {copiadoTextoWa ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiadoTextoWa ? 'Copiado' : 'Copiar texto'}</span>
              </button>
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(textoWhatsApp)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex items-center gap-1 shadow-2xs"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Compartir por WhatsApp</span>
              </a>
            </div>
          </div>

          {/* Difusión en Redes / Bio de Instagram */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <h4 className="font-bold text-xs text-slate-900 flex items-center gap-2">
              <Instagram className="w-4 h-4 text-pink-600" />
              <span>Texto para perfil de Instagram / Google Perfil de Negocio</span>
            </h4>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700 whitespace-pre-line leading-relaxed font-sans">
              {textoBio}
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => handleCopiar(textoBio, setCopiadoBio)}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 shadow-2xs"
              >
                {copiadoBio ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiadoBio ? 'Copiado' : 'Copiar para Bio'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* COLUMNA DERECHA: CÓDIGO QR Y CARTEL A4 DE SALA DE ESPERA */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs text-center space-y-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4 text-sky-600" />
              <span>Código QR de tu Consultorio</span>
            </h3>

            {/* Visualización del QR */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 inline-block shadow-inner">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="QR MediTurnos"
                  className="w-48 h-48 mx-auto rounded-lg shadow-xs"
                />
              ) : (
                <div className="w-48 h-48 bg-slate-200 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400">
                  Generando QR...
                </div>
              )}
              <span className="text-[11px] font-bold text-sky-800 tracking-wider uppercase block mt-2">
                Escaneá para reservar tu turno
              </span>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleDescargarQr}
                className="w-full py-2.5 px-4 bg-sky-600 text-white rounded-xl text-xs font-bold hover:bg-sky-700 transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar Imagen PNG</span>
              </button>

              <button
                onClick={() => setModoImpresionA4(true)}
                className="w-full py-2.5 px-4 bg-white border border-slate-200 text-slate-800 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-all shadow-2xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-slate-600" />
                <span>Ver Cartel A4 para Sala de Espera</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* MODAL / VISTA DE CARTEL A4 IMPRIMIBLE (Regla 1.10) */}
      {modoImpresionA4 && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl border border-slate-200 max-h-[95vh] overflow-y-auto text-center space-y-6">
            
            {/* Cabecera del Cartel A4 */}
            <div className="border-b-2 border-slate-100 pb-5">
              <span className="text-xs font-bold tracking-widest uppercase text-sky-600 block mb-1">
                {professional.especialidad}
              </span>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                {professional.titulo} {professional.nombre}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                M.N. {professional.matriculaNacional} · M.P. {professional.matriculaProvincial}
              </p>
            </div>

            {/* QR Grande */}
            <div className="py-2">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 inline-block shadow-sm">
                <img src={qrDataUrl} alt="QR Cartel" className="w-64 h-64 mx-auto rounded-xl" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-4">
                Escaneá con tu celular para reservar tu próximo turno
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Rápido, sin descargar aplicaciones ni crear cuenta.
              </p>
            </div>

            {/* Pie del cartel */}
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-400">
              Powered by MediTurnos · Turnero Digital
            </div>

            {/* Botones de acción del modal */}
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={() => setModoImpresionA4(false)}
                className="px-5 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Cerrar
              </button>
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 flex items-center gap-2 shadow-xs"
              >
                <Printer className="w-4 h-4" /> Imprimir Cartel
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
