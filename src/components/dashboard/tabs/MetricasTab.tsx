import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  DollarSign,
  Users,
  CalendarCheck,
  AlertOctagon,
  FileSpreadsheet,
  Download,
  CreditCard,
  Video,
  MapPin,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../../../context/AppContext';
import { formatearMoneda } from '../../../modules/format';

export const MetricasTab: React.FC = () => {
  const { appointments, services, coverages, professional, exportarGoogleSheetsData, exportarCsvTurnos } = useApp();

  const [periodo, setPeriodo] = useState<'mes_actual' | 'historico'>('historico');

  // Cálculo de Métricas y KPIs
  const metricas = useMemo(() => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    const turnosFiltrados = appointments.filter(a => {
      if (periodo === 'mes_actual') {
        const d = new Date(a.inicio);
        return d.getMonth() === mesActual && d.getFullYear() === anioActual;
      }
      return true;
    });

    const totalTurnos = turnosFiltrados.length;
    const atendidos = turnosFiltrados.filter(a => a.estado === 'atendido').length;
    const pendientes = turnosFiltrados.filter(a => a.estado === 'pendiente').length;
    const ausentes = turnosFiltrados.filter(a => a.estado === 'ausente').length;
    const cancelados = turnosFiltrados.filter(a => a.estado === 'cancelado').length;
    const reprogramados = turnosFiltrados.filter(a => a.estado === 'reprogramado').length;

    // Tasa de Ausentismo (No-Show): ausentes / (atendidos + ausentes)
    const baseAsistencia = atendidos + ausentes;
    const tasaAusentismo = baseAsistencia > 0 ? ((ausentes / baseAsistencia) * 100).toFixed(1) : '0.0';
    const tasaAsistencia = baseAsistencia > 0 ? ((atendidos / baseAsistencia) * 100).toFixed(1) : '0.0';

    // Financiero: Cobro de arancel completo
    const turnosPagados = turnosFiltrados.filter(a => a.estadoPago === 'pagado');
    const totalRecaudadoCentavos = turnosPagados.reduce((sum, a) => sum + (a.precioCentavos || 0), 0);

    const turnosSinPago = turnosFiltrados.filter(a => a.estadoPago === 'sin_pago' && a.estado !== 'cancelado');
    const totalPendienteCobroCentavos = turnosSinPago.reduce((sum, a) => sum + (a.precioCentavos || 0), 0);

    // Desglose por Modalidad
    const presenciales = turnosFiltrados.filter(a => a.modalidad === 'presencial').length;
    const videollamadas = turnosFiltrados.filter(a => a.modalidad === 'videollamada').length;

    // Desglose por Cobertura Médica
    const mapaCoberturas = new Map<string, { nombre: string; cantidad: number; totalCentavos: number }>();
    turnosFiltrados.forEach(a => {
      const cobNombre = a.pacienteCobertura || 'Particular (sin obra social)';
      const actual = mapaCoberturas.get(cobNombre) || { nombre: cobNombre, cantidad: 0, totalCentavos: 0 };
      actual.cantidad += 1;
      actual.totalCentavos += a.precioCentavos || 0;
      mapaCoberturas.set(cobNombre, actual);
    });
    const rankingCoberturas = Array.from(mapaCoberturas.values()).sort((a, b) => b.cantidad - a.cantidad);

    // Desglose por Servicios
    const mapaServicios = new Map<string, { nombre: string; cantidad: number; totalCentavos: number; duracionMin: number }>();
    turnosFiltrados.forEach(a => {
      const srv = services.find(s => s.id === a.serviceId);
      const srvNombre = srv?.nombre || 'Consulta General';
      const actual = mapaServicios.get(srvNombre) || {
        nombre: srvNombre,
        cantidad: 0,
        totalCentavos: 0,
        duracionMin: srv?.duracionMin || 30,
      };
      actual.cantidad += 1;
      actual.totalCentavos += a.precioCentavos || 0;
      mapaServicios.set(srvNombre, actual);
    });
    const rankingServicios = Array.from(mapaServicios.values()).sort((a, b) => b.cantidad - a.cantidad);

    return {
      totalTurnos,
      atendidos,
      pendientes,
      ausentes,
      cancelados,
      reprogramados,
      tasaAusentismo,
      tasaAsistencia,
      totalRecaudadoCentavos,
      totalPendienteCobroCentavos,
      presenciales,
      videollamadas,
      rankingCoberturas,
      rankingServicios,
    };
  }, [appointments, services, periodo]);

  return (
    <div className="space-y-6">
      
      {/* HEADER DE MÉTRICAS & ACCIONES DE RESPALDO */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">
                Métricas, Rendimiento y Finanzas
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Indicadores clave de ausentismo, facturación de aranceles completos y demanda de consultas médicas.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Período */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPeriodo('historico')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  periodo === 'historico'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Histórico total
              </button>
              <button
                type="button"
                onClick={() => setPeriodo('mes_actual')}
                className={`px-3 py-1.5 rounded-lg transition-all ${
                  periodo === 'mes_actual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Mes actual
              </button>
            </div>

            {/* Exportar a Google Sheets */}
            <button
              type="button"
              onClick={exportarGoogleSheetsData}
              title="Descargar matriz compatible con Google Sheets y Google Drive"
              className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Google Sheets (.tsv)</span>
            </button>

            {/* Exportar CSV */}
            <button
              type="button"
              onClick={() => exportarCsvTurnos(appointments)}
              title="Descargar CSV tradicional con separador ; para Excel"
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-4 h-4 text-slate-500" />
              <span>Excel (.csv)</span>
            </button>
          </div>
        </div>
      </div>

      {/* TARJETAS KPI PRINCIPALES */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Recaudado Total */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cobrado</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-2 tabular-nums">
            {formatearMoneda(metricas.totalRecaudadoCentavos)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Aranceles completos percibidos
          </p>
        </div>

        {/* Pendiente de Cobro */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pendiente Cobro</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-700 mt-2 tabular-nums">
            {formatearMoneda(metricas.totalPendienteCobroCentavos)}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Consultas no liquidadas aún
          </p>
        </div>

        {/* Tasa de Asistencia */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Asistencia Efectiva</span>
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-lg">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-sky-700 mt-2 tabular-nums">
            {metricas.tasaAsistencia}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metricas.atendidos} pacientes completados
          </p>
        </div>

        {/* Tasa de Ausentismo (No-Show) */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Tasa Ausentismo</span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-700 mt-2 tabular-nums">
            {metricas.tasaAusentismo}%
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metricas.ausentes} pacientes no asistieron
          </p>
        </div>
      </div>

      {/* BLOQUE DE DATOS DE COBRO Y ARANCELES */}
      <div className="bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200/80 rounded-2xl p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-sky-600 text-white rounded-xl shadow-xs shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Canal de Cobro y Transferencia Bancaria
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Datos de cuenta informados a los pacientes para abonar el arancel de las consultas.
              </p>
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-xl border border-sky-200 text-xs text-slate-700 shrink-0">
            <div className="font-semibold text-slate-900">Datos de cobro activos:</div>
            <div className="mt-1 font-mono text-[11px] text-sky-800">Alias: {professional.aliasCobro}</div>
            <div className="text-[11px] text-slate-500">Titular: {professional.titularCobro}</div>
          </div>
        </div>
      </div>

      {/* DETALLE GRÁFICO: SERVICIOS Y COBERTURAS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* SERVICIOS MÁS SOLICITADOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-sky-600" />
              <span>Demanda por Servicio / Prestación</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {metricas.rankingServicios.length} activos
            </span>
          </div>

          <div className="space-y-4">
            {metricas.rankingServicios.map(s => {
              const porcentaje = metricas.totalTurnos > 0 ? ((s.cantidad / metricas.totalTurnos) * 100).toFixed(0) : 0;
              return (
                <div key={s.nombre} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{s.nombre}</span>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{s.cantidad} turnos</span>
                      <span className="text-slate-400 ml-1.5">({porcentaje}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-sky-600 rounded-full transition-all"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{s.duracionMin} minutos</span>
                    <span>Total facturable: {formatearMoneda(s.totalCentavos)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DISTRIBUCIÓN POR COBERTURA MÉDICA */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-600" />
              <span>Distribución por Obra Social / Particular</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              {metricas.rankingCoberturas.length} coberturas
            </span>
          </div>

          <div className="space-y-4">
            {metricas.rankingCoberturas.map(c => {
              const porcentaje = metricas.totalTurnos > 0 ? ((c.cantidad / metricas.totalTurnos) * 100).toFixed(0) : 0;
              return (
                <div key={c.nombre} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{c.nombre}</span>
                    <div className="text-right">
                      <span className="font-bold text-slate-900">{c.cantidad} pacientes</span>
                      <span className="text-slate-400 ml-1.5">({porcentaje}%)</span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-600 rounded-full transition-all"
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Participación: {porcentaje}%</span>
                    <span>Arancel acordado: {formatearMoneda(c.totalCentavos)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* MODALIDADES & ESTADOS DE TURNOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Modalidades */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Modalidades de Atención</span>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                <MapPin className="w-4 h-4 text-sky-600" />
                <span>Presenciales: <strong>{metricas.presenciales}</strong></span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                <Video className="w-4 h-4 text-emerald-600" />
                <span>Videollamadas: <strong>{metricas.videollamadas}</strong></span>
              </div>
            </div>
          </div>
          <div className="text-right text-xs text-slate-400 font-medium">
            Total {metricas.totalTurnos} citas
          </div>
        </div>

        {/* Resumen de Estados */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Ciclo de Vida</span>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                {metricas.atendidos} Atendidos
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                {metricas.pendientes} Pendientes
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200 font-semibold">
                {metricas.ausentes} Ausentes
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-semibold">
                {metricas.cancelados} Cancelados
              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
