/**
 * Utilidades compartidas de formato y localización argentina (I-07)
 * Zona horaria canónica: America/Argentina/Buenos_Aires
 * Moneda: ARS ($22.000)
 */

export const TIMEZONE = 'America/Argentina/Buenos_Aires';

/**
 * Formatea centavos a pesos argentinos ($22.000)
 */
export function formatearMoneda(centavos: number): string {
  const pesos = Math.round(centavos / 100);
  const formatted = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(pesos);
  
  // Normalizar posibles espacios no separables de Intl
  return formatted.replace(/\s+/g, ' ');
}

/**
 * Formatea una fecha ISO a "15-oct-2026"
 */
export function formatearFechaCorta(isoString: string): string {
  const date = new Date(isoString);
  const d = date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  });
  return d.replace('.', '');
}

/**
 * Formatea una fecha ISO a "Jueves 15 de octubre"
 */
export function formatearFechaLarga(isoString: string): string {
  const date = new Date(isoString);
  const str = date.toLocaleDateString('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: TIMEZONE,
  });
  // Capitalizar primera letra: "Jueves 15 de octubre"
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Formatea una hora ISO a "10:00 hs"
 */
export function formatearHora(isoString: string): string {
  const date = new Date(isoString);
  const hora = date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  });
  return `${hora} hs`;
}

/**
 * Extrae sólo la hora "HH:mm"
 */
export function extraerHoraMinutos(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIMEZONE,
  });
}

/**
 * Normaliza y valida teléfono celular argentino a formato E.164 (+54 9...)
 * Soporta entradas como: 1123456789, 011 15 2345-6789, +5491123456789, 1523456789
 */
export function normalizarTelefonoArgentino(rawInput: string): {
  e164: string;
  display: string;
  e164SinPlus: string;
  valido: boolean;
} {
  // Limpiar caracteres no numéricos excepto + inicial
  const limpio = rawInput.trim();
  const soloNumeros = limpio.replace(/\D/g, '');

  if (!soloNumeros || soloNumeros.length < 8) {
    return { e164: '', display: rawInput, e164SinPlus: '', valido: false };
  }

  let numeroNacional = soloNumeros;

  // Si empieza con 549 (ej: 54911...)
  if (numeroNacional.startsWith('549')) {
    numeroNacional = numeroNacional.slice(3);
  } else if (numeroNacional.startsWith('54')) {
    numeroNacional = numeroNacional.slice(2);
  }

  // Si empieza con 0 (código de área nacional, ej 011), quitarlo
  if (numeroNacional.startsWith('0')) {
    numeroNacional = numeroNacional.slice(1);
  }

  // Si tiene el prefijo celular '15' después del área, manejar caso 1115...
  if (numeroNacional.startsWith('1115')) {
    numeroNacional = '11' + numeroNacional.slice(4);
  }

  // Un celular argentino estándar tiene 10 dígitos (ej. 11 2345 6789 o 351 123 4567)
  const esValido = numeroNacional.length >= 10 && numeroNacional.length <= 11;
  const e164 = `+549${numeroNacional}`;
  const e164SinPlus = `549${numeroNacional}`;

  // Formato display: +54 9 11 2345-6789
  let display = e164;
  if (numeroNacional.length === 10) {
    const area = numeroNacional.slice(0, 2);
    const parte1 = numeroNacional.slice(2, 6);
    const parte2 = numeroNacional.slice(6);
    display = `+54 9 ${area} ${parte1}-${parte2}`;
  }

  return {
    e164,
    display,
    e164SinPlus,
    valido: esValido,
  };
}

/**
 * Valida formato de DNI argentino (7 u 8 dígitos numéricos)
 */
export function validarDni(rawInput: string): { dni: string; display: string; valido: boolean } {
  const soloDigitos = rawInput.replace(/\D/g, '');
  const esValido = soloDigitos.length >= 7 && soloDigitos.length <= 8;

  let display = soloDigitos;
  if (esValido) {
    if (soloDigitos.length === 8) {
      display = `${soloDigitos.slice(0, 2)}.${soloDigitos.slice(2, 5)}.${soloDigitos.slice(5)}`;
    } else {
      display = `${soloDigitos.slice(0, 1)}.${soloDigitos.slice(1, 4)}.${soloDigitos.slice(4)}`;
    }
  }

  return {
    dni: soloDigitos,
    display,
    valido: esValido,
  };
}
