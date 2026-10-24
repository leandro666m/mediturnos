import { Appointment, Modalidad, Professional, Service } from '../types';
import {
  formatearFechaLarga,
  formatearHora,
  formatearMoneda,
  normalizarTelefonoArgentino,
} from './format';

export const BLOQUE_PRESENCIAL_DEFAULT =
  '📍 Lugar: {direccion}\n🗺️ Google Maps: {link_maps}\n📂 Si tenés estudios impresos o en PDF, llevalos a la consulta. ¡Te esperamos!';

export const BLOQUE_VIDEOLLAMADA_DEFAULT =
  '📞 Videollamada por WhatsApp: te vamos a llamar a este número a la hora de tu turno.\n📂 Si tenés estudios en PDF, tenelos a mano para reenviarlos en la consulta. ¡Nos vemos!';

export const CUERPO_CONFIRMACION_DEFAULT =
  `Hola {paciente} 🙋‍♂️ Tu turno con {profesional} el 📆 {fecha} ⌚ {hora} quedará confirmado una vez abonado.

Alias: {alias}

Valor: {valor}

🩺 Consulta: {servicio}

{bloque_modalidad}

⏰ Te recordaremos un par de horas antes 😉`;

export const CUERPO_RECORDATORIO_DEFAULT =
  `Hola {paciente} 🙋‍♂️ Te escribo del consultorio de {profesional} para recordarte tu turno:

📆 Fecha: {fecha}

⌚ Horario: {hora}

🩺 Consulta: {servicio}

{bloque_modalidad}

Por favor avisanos con anticipación si necesitás reprogramar. ¡Muchas gracias!`;

export const CUERPO_REPROGRAMACION_DEFAULT =
  `Hola {paciente} 🙋‍♂️ Te confirmamos que tu turno con {profesional} ha sido reprogramado:

📆 Nueva Fecha: {fecha}

⌚ Nuevo Horario: {hora}

🩺 Consulta: {servicio}

{bloque_modalidad}

¡Te esperamos!`;

export const CUERPO_CANCELACION_DEFAULT =
  `Hola {paciente} 🙋‍♂️ Te informamos que tu turno con {profesional} del 📆 {fecha} a las ⌚ {hora} ha sido cancelado.

Podés ingresar nuevamente al enlace del consultorio para elegir un nuevo horario cuando lo desees:
👉 {link_gestionar}`;

export interface RenderVariables {
  paciente: string;
  profesional: string;
  fecha: string;
  hora: string;
  servicio: string;
  valor: string;
  alias: string;
  direccion?: string;
  link_maps?: string;
  link_gestionar?: string;
  modalidad: Modalidad;
}

/**
 * Resuelve una plantilla de mensaje reemplazando variables y bloques condicionales (I-06)
 */
export function resolverPlantillaMensaje(
  cuerpo: string,
  bloquePresencial: string,
  bloqueVideollamada: string,
  variables: RenderVariables
): string {
  // 1. Resolver el bloque de modalidad según corresponda
  const bloqueElegido =
    variables.modalidad === 'presencial' ? bloquePresencial : bloqueVideollamada;

  // Si hay link_maps y el bloque no tiene la variable {link_maps}, añadirlo a la dirección
  let direccionConMaps = variables.direccion || 'Consultorio';
  if (variables.modalidad === 'presencial' && variables.link_maps && !bloqueElegido.includes('{link_maps}')) {
    direccionConMaps = `${direccionConMaps}\n🗺️ Google Maps: ${variables.link_maps}`;
  }

  // Reemplazar {direccion} y {link_maps} dentro del bloque si aplica
  let bloqueResuelto = bloqueElegido
    .replace(/{direccion}/g, direccionConMaps)
    .replace(/{link_maps}/g, variables.link_maps || '')
    .trim();

  // Si no hay link_maps, limpiar líneas sueltas de Google Maps en el bloque
  if (!variables.link_maps) {
    bloqueResuelto = bloqueResuelto.replace(/🗺️ Google Maps:.*\n?/g, '');
  }

  // 2. Reemplazar {bloque_modalidad} en el cuerpo principal
  let texto = cuerpo.replace(/{bloque_modalidad}/g, bloqueResuelto);

  // 3. Reemplazar variables comunes
  texto = texto
    .replace(/{paciente}/g, variables.paciente)
    .replace(/{profesional}/g, variables.profesional)
    .replace(/{fecha}/g, variables.fecha)
    .replace(/{hora}/g, variables.hora)
    .replace(/{servicio}/g, variables.servicio)
    .replace(/{valor}/g, variables.valor)
    .replace(/{alias}/g, variables.alias);

  if (variables.direccion) {
    texto = texto.replace(/{direccion}/g, variables.direccion);
  } else {
    // Eliminar líneas de dirección sueltas si no aplica
    texto = texto.replace(/📍 Lugar:.*\n?/g, '');
  }

  if (variables.link_maps) {
    texto = texto.replace(/{link_maps}/g, variables.link_maps);
  } else {
    texto = texto.replace(/🗺️ Google Maps:.*\n?/g, '').replace(/{link_maps}/g, '');
  }

  if (variables.link_gestionar) {
    texto = texto.replace(/{link_gestionar}/g, variables.link_gestionar);
  } else {
    texto = texto.replace(/{link_gestionar}/g, '');
  }

  return texto.trim();
}

/**
 * Verifica si la hora actual cae en el horario de descanso configurado (quiet hours, por defecto 22:00 a 08:00)
 */
export function estaEnHorarioDescanso(
  quietHoursInicio = '22:00',
  quietHoursFin = '08:00',
  ahora = new Date()
): boolean {
  const horaActual = ahora.getHours() + ahora.getMinutes() / 60;
  const [iniH, iniM] = quietHoursInicio.split(':').map(Number);
  const [finH, finM] = quietHoursFin.split(':').map(Number);
  const inicio = iniH + iniM / 60;
  const fin = finH + finM / 60;

  // Si cruza la medianoche (ej 22:00 a 08:00)
  if (inicio > fin) {
    return horaActual >= inicio || horaActual < fin;
  }
  return horaActual >= inicio && horaActual < fin;
}

/**
 * Genera el enlace oficial para abrir en WhatsApp (Fase 1)
 * IMPORTANTE: Usa https://api.whatsapp.com/send directamente en vez del acortador wa.me
 * para evitar el bug de redirección HTTP 302 de wa.me que corrompe caracteres UTF-8 multibyte
 * (como emojis 🙋‍♂️, 📆, ⌚, 🩺, ⏰, 😉, 📍, 📂) transformándolos en caracteres de reemplazo .
 */
export function construirEnlaceWhatsApp(telefonoRaw: string, mensaje: string): {
  url: string;
  valido: boolean;
  telefonoDisplay: string;
} {
  const norm = normalizarTelefonoArgentino(telefonoRaw);
  if (!norm.valido || !norm.e164SinPlus) {
    return {
      url: '',
      valido: false,
      telefonoDisplay: telefonoRaw,
    };
  }

  const textoCodificado = encodeURIComponent(mensaje);
  const url = `https://api.whatsapp.com/send?phone=${norm.e164SinPlus}&text=${textoCodificado}`;

  return {
    url,
    valido: true,
    telefonoDisplay: norm.display,
  };
}

/**
 * Prepara las variables de renderizado a partir de un turno y los datos del profesional
 */
export function prepararVariablesDesdeTurno(
  turno: Appointment,
  profesional: Professional,
  servicio?: Service,
  direccionTexto?: string,
  linkMaps?: string
): RenderVariables {
  return {
    paciente: turno.pacienteNombre,
    profesional: `${profesional.titulo} ${profesional.nombre}`,
    fecha: formatearFechaLarga(turno.inicio),
    hora: formatearHora(turno.inicio),
    servicio: servicio?.nombre || 'Consulta Profesional',
    valor: formatearMoneda(turno.precioCentavos),
    alias: profesional.aliasCobro || 'alias.profesional.mp',
    direccion: direccionTexto || 'Consultorio',
    link_maps: linkMaps,
    modalidad: turno.modalidad,
    link_gestionar: turno.manageToken ? `https://mediturnos.app/gestionar/${turno.manageToken}` : undefined,
  };
}
