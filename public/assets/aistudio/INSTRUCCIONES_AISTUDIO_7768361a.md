# MediTurnos · Instrucciones para sincronizar el frontend con la base de datos (Supabase)

> Documento para pegar en Google AI Studio. Define el **contrato de datos** que el frontend debe respetar.
> Las migraciones SQL (`supabase/migrations/`) son la fuente de verdad: ante cualquier duda, manda la base.

## 0. Objetivo y alcance

La app pasa de guardar todo en `localStorage` (con Drive como respaldo) a usar **PostgreSQL en Supabase** como base principal. Esta tarea es la **Fase 1: alinear el modelo del frontend con el esquema**.

**Hacer**
1. Actualizar `src/types/index.ts` según la sección 2.
2. Crear una capa de mapeo `src/data/mappers.ts` (camelCase ↔ snake_case) según la sección 3.
3. Quitar del frontend la lógica que ahora vive en la base (sección 4).
4. Adaptar el flujo del portal público al contrato de funciones (sección 5).

**No hacer**
- No cambiar el diseño ni la experiencia de usuario.
- No conectar todavía Supabase Auth ni reemplazar `localStorage`: la persistencia actual debe seguir funcionando detrás de una interfaz (`DataRepository`) que más adelante se reemplaza por Supabase sin tocar los componentes.
- No poner nunca la clave `service_role` en el código del navegador ni en variables con prefijo `VITE_`.

### Decisiones ya tomadas (no reabrir)

| # | Decisión |
|---|---|
| 1 | Paciente y profesional tienen **un solo campo `nombre`** (nombre completo). No hay `apellido`. |
| 2 | **Particular = `cobertura_id` nulo.** No existe una cobertura "Particular" sembrada. |
| 3 | El plazo de **cancelación y reprogramación por el paciente** es el mismo: **24 h por defecto**, configurable por profesional (`plazoCancelacionHoras`). |
| 4 | **Sobreturnos** solo con `esSobreturno = true` y solo creados desde el dashboard (nunca desde el portal). |
| 5 | **Borrar pacientes, turnos, fichas, notas o auditoría está bloqueado** por diseño. Un turno se cancela, no se borra. |
| 6 | El portal **reenvía la IP real** del visitante al límite de frecuencia (sección 6). |

---

## 1. Convenciones generales

| Tema | Regla |
|---|---|
| IDs | UUID (string). El `id` del profesional es el `id` de su usuario de autenticación. |
| Fechas/horas | `timestamptz` ⇄ string ISO 8601 en UTC. Horas del día (`time`) llegan como `"HH:MM:SS"`: **recortar a `"HH:MM"`** al leer. |
| Dinero | Siempre en **centavos** (entero). Moneda por defecto `ARS`. |
| Teléfono | Formato E.164: `^\+[1-9][0-9]{7,14}$` (ej. `+5493456123456`). |
| DNI | `^[0-9A-Za-z]{5,20}$`. Guardar en mayúsculas, sin puntos ni espacios. |
| Nombres de campos | Frontend: camelCase. Base: snake_case. Convertir **solo** en `mappers.ts`. |
| Slug del profesional | `^[a-z0-9]+(-[a-z0-9]+)*$`, 3–100 caracteres. **Reservados** (rechazar en el formulario): `app, api, login, logout, registro, admin, auth, _next, public, static, assets, sw, manifest, portal, turno`. |
| CBU/CVU | Exactamente 22 dígitos o vacío. |
| `grillaMin` | Solo 15, 20, 30, 45 o 60. |

---

## 2. Cambios en `src/types/index.ts`

### 2.1 Tipos nuevos / modificados

```ts
export type EstadoPago = 'sin_pago' | 'pagado' | 'exento';   // 'exento' es nuevo; 'sin_pago' ⇄ 'pendiente' en la base
export type ActorCambio = 'paciente' | 'profesional' | 'sistema';

export interface Professional {
  // …campos actuales…
  nombre: string;            // nombre completo (sin apellido aparte)
  parametros: {
    // …campos actuales…
    plazoCancelacionHoras: number;   // default 24. Aplica a CANCELAR y a REPROGRAMAR
  };
}

export interface Patient {
  // …campos actuales…
  nombre: string;            // nombre completo, un solo campo
  coverageId: string | null; // null = Particular   (antes: string obligatorio)
}

export interface Appointment {
  // …campos actuales…
  canceladoPor?: 'paciente' | 'profesional' | 'sistema';
  notasCancelacion?: string;     // nuevo
}

export interface MessageTemplate {
  // …campos actuales…
  tipo: 'confirmacion' | 'recordatorio' | 'reprogramacion' | 'cancelacion'; // los dos últimos son nuevos
}
```

### 2.2 Cobertura "Particular"
- Dejar de sembrar una cobertura con `tipo: 'particular'`.
- En el selector de cobertura, mostrar **"Particular" como primera opción fija** que guarda `coverageId = null`.
- `Appointment.pacienteCobertura` se deriva: nombre de la cobertura o `"Particular"` si es `null`.
- **Migración de datos existentes en localStorage:** si hay una cobertura `tipo === 'particular'`, poner `coverageId = null` en los pacientes que la usaban y eliminar esa cobertura de la lista.

### 2.3 Campos "embebidos" de `Appointment`
`pacienteNombre`, `pacienteDni`, `pacienteTelefono`, `pacienteEmail`, `pacienteCobertura`, `pacientePlan`, `pacienteAfiliado` pasan a ser **solo de presentación** (view model). Se arman uniendo turno + paciente + cobertura. **No se persisten.**

---

## 3. Mapa de campos frontend ⇄ base

### 3.1 `Professional` ⇄ `profesionales`

| Frontend | Base | Notas |
|---|---|---|
| `id` | `id` | = id del usuario autenticado |
| `publicId` | `public_id` | Inmutable (ruta permanente del QR) |
| `slug` | `slug` | Ver reservados |
| `nombre` | `nombre` | Nombre completo |
| `titulo`, `especialidad` | `titulo`, `especialidad` | Obligatorios, sin valor por defecto |
| `matriculaNacional` / `matriculaProvincial` | `matricula_nacional` / `matricula_provincial` | Opcionales |
| `aliasCobro` | `alias_mp` | |
| `titularCobro` | `titular_cuenta` | |
| `cbu` | `cbu_cvu` | 22 dígitos |
| `cuit`, `banco` | `cuit`, `banco` | |
| `zonaHoraria` | `zona_horaria` | Default `America/Argentina/Buenos_Aires` |
| `agendaPausada` | `agenda_pausada` | |
| `telefonoContactoPrivado` | `telefono_contacto` | **Privado**: el portal nunca lo recibe |
| `fotoPerfil` | `foto_perfil_path` | **Cambia**: ya no es base64/URL. Es una ruta en el bucket público `fotos-perfil` (`<profesional_id>/<archivo>`). URL pública vía `storage.from('fotos-perfil').getPublicUrl(path)` |
| `tamanoTexto` | `tamano_texto` | `minimo` \| `predeterminado` \| `grande` |
| `parametros.grillaMin` | `intervalo_turnos_min` | |
| `parametros.anticipacionMinHoras` | `anticipacion_minima_hs` | |
| `parametros.horizonteDias` | `horizonte_maximo_dias` | 1–365 |
| `parametros.margenMin` | `margen_entre_turnos_min` | |
| `parametros.quietHoursInicio` / `Fin` | `horario_silencio_inicio` / `_fin` | |
| `parametros.plazoCancelacionHoras` | `plazo_cancelacion_hs` | Default 24 |

### 3.2 `Location` ⇄ `sedes`
`id`, `nombre`, `direccion`, `indicaciones`, `mapsUrl` → `maps_url`, `activa` (idénticos salvo `maps_url`).

### 3.3 `Service` ⇄ `servicios`

| Frontend | Base | Notas |
|---|---|---|
| `duracionMin` | `duracion_min` | 5–480 |
| `precioCentavos` | `arancel_centavos` | |
| `mostrarPrecio` | `mostrar_precio` | Si es `false`, el portal recibe el arancel en `null` |
| `modalidades: Modalidad[]` | `modalidad` | `['presencial']`→`'presencial'`; `['videollamada']`→`'videollamada'`; ambas→`'ambas'`. **No se admite lista vacía.** |
| `descripcion`, `nombre`, `activo` | idem | |

### 3.4 `WorkingHours` ⇄ `franjas_horarias` + `descansos_horarios`

| Frontend | Base | Notas |
|---|---|---|
| `diaSemana` | `dia_semana` | 1=lunes … 7=domingo |
| `horaInicio` / `horaFin` | `hora_inicio` / `hora_fin` | Recortar `:SS` |
| `modalidad: ModalidadFranja` | `modalidad_permitida` | |
| `locationId` | `sede_id` | Opcional |
| `descansos[]` `{inicio, fin}` | filas de `descansos_horarios` (`hora_inicio`, `hora_fin`) | Una fila por descanso |

La base **rechaza franjas activas superpuestas** el mismo día: validar también en el formulario.

### 3.5 `TimeOff` ⇄ `ausencias`
`tipo` idem; `motivo` idem. **Conversión de fechas** (usando `zonaHoraria` del profesional):
- `inicio = "YYYY-MM-DD"` → `inicio_utc` = 00:00 locales de ese día, pasado a UTC.
- `fin = "YYYY-MM-DD"` → `fin_utc` = 00:00 locales del **día siguiente** (el fin es exclusivo).
- `inicio`/`fin` `"YYYY-MM-DDTHH:mm"` → esa hora local convertida a UTC.
- Al leer, invertir la conversión. Requisito: `inicio_utc < fin_utc`.

### 3.6 `Holiday` ⇄ `feriados_profesional`
Solo se guarda lo que el profesional decide. `{ fecha, nombre, laborable }` idénticos. Único por `(profesional, fecha)`. El calendario oficial de feriados sigue viniendo de la API pública, no de la base.

### 3.7 `Coverage` ⇄ `coberturas`
`{ id, nombre, tipo }` idénticos. `nombre` único por profesional. `tipo` admite `obra_social | prepaga | particular | otro` (no usar `particular`, ver 2.2).

### 3.8 `Patient` ⇄ `pacientes`

| Frontend | Base | Notas |
|---|---|---|
| `professionalId` | `profesional_id` | |
| `dni` | `dni` | Único por profesional |
| `nombre` | `nombre` | Un solo campo |
| `telefonoE164` | `telefono_e164` | |
| `email` | `email` | |
| `coverageId` | `cobertura_id` | `null` = Particular |
| `plan`, `nroAfiliado` | `plan`, `nro_afiliado` | |
| `notasInternas` | `notas_administrativas` | |
| `creadoEn` | `created_at` | |

Al crear un paciente la base crea automáticamente su **ficha clínica** (relación 1:1).

### 3.9 `Appointment` ⇄ `turnos`

| Frontend | Base | Notas |
|---|---|---|
| `patientId`, `serviceId`, `locationId` | `paciente_id`, `servicio_id`, `sede_id` | Deben pertenecer al mismo profesional (la base lo exige) |
| `modalidad` | `modalidad` | Solo `presencial` o `videollamada` (nunca `ambas`) |
| `inicio` / `fin` | `inicio_utc` / `fin_utc` | |
| `estado` | `estado` | `pendiente, atendido, ausente, cancelado, reprogramado` |
| `estadoPago` | `estado_pago` | `sin_pago`⇄`pendiente`, `pagado`⇄`pagado`, `exento`⇄`exento` |
| `precioCentavos` | `arancel_centavos` | |
| `motivo` | `motivo_consulta` | |
| `origen` | `origen` | `portal` \| `dashboard` |
| `esSobreturno` | `es_sobreturno` | Solo `true` con `origen = 'dashboard'` |
| `reprogramadoDe` | `turno_origen_id` | Está en el turno **nuevo** y apunta al viejo |
| `reprogramadoA` | *(derivado)* | Buscar el turno cuyo `turno_origen_id` = este id |
| `canceladoPor` / `notasCancelacion` | `cancelado_por` / `notas_cancelacion` | |
| `manageToken` | *(no se guarda en claro)* | Ver sección 5.3 |
| `comprobantePago` | — | **No existe todavía** en la base (Hito 2) |

### 3.10 `AppointmentStatusHistory` ⇄ `auditoria_turnos` (solo lectura)
`desde` ⇄ `estado_anterior` (`null` ⇒ `'creacion'`), `hacia` ⇄ `estado_nuevo`, `actor` idem, `en` ⇄ `created_at`, `motivo` ⇄ `motivo_cambio`. **La escribe la base automáticamente**; el frontend ya no debe crear estos registros.

### 3.11 `AppointmentHold` ⇄ `bloqueos_temporales`
El hold lo crea la función `portal_crear_hold`. El frontend solo guarda lo que devuelve: `hold_id`, `inicio`, `fin`, `expira` (= `venceEn`). `sessionToken` ⇄ `session_id`: generar con `crypto.randomUUID()` (mínimo 16, máximo 100 caracteres) y conservarlo mientras dure la sesión de reserva. **El hold dura 10 minutos y lo define el servidor.** Un nuevo hold de la misma sesión reemplaza al anterior.

### 3.12 `MessageTemplate` ⇄ `plantillas_mensajes`

| Frontend | Base |
|---|---|
| `tipo` | `tipo_mensaje` |
| `cuerpo` | `cuerpo_plantilla` |
| `bloquePresencial` | `bloque_presencial` |
| `bloqueVideollamada` | `bloque_videollamada` |
| *(sin equivalente)* | `canal` (usar `'whatsapp'`), `titulo` (dejar nulo), `activo` |

Único por `(profesional, tipo, canal)`.

### 3.13 `ConsultationNote` ⇄ `notas_evolucion`

| Frontend | Base | Notas |
|---|---|---|
| `patientId` | vía `fichas_clinicas.paciente_id` | La nota cuelga de la **ficha** del paciente (`ficha_id`). Resolver con un join |
| `appointmentId` | `turno_id` | |
| `atendidoEn` | `fecha_atencion` | |
| `especialidad` | `especialidad` | |
| `contenidoJson` (string) | `contenido_tiptap` (jsonb) | `JSON.parse` al leer, `JSON.stringify` al armar el formulario si hace falta |
| `textoPlano` | `texto_plano` | |
| `version` | `version` | **La incrementa la base** en cada edición: el frontend no debe sumarla |
| `actualizadoEn` | `updated_at` | |
| `adjuntos` | filas de `adjuntos_paciente` con `nota_id` | |

Los campos SOAP (`subjetivo_s`, `objetivo_o`, `evaluacion_a`, `plan_p`) existen pero la app actual no los usa: dejarlos nulos.

### 3.14 `NoteAttachment` ⇄ `adjuntos_paciente`

| Frontend | Base | Notas |
|---|---|---|
| `nombre` | `nombre_archivo` | |
| `tipoMime` | `tipo_mime` | Permitidos: pdf, jpeg, png, webp, dicom (máx. 20 MB) |
| `tamanoBytes` | `tamano_bytes` | |
| `url` | `storage_path` | **Cambia**: ruta `<profesional_id>/<paciente_id>/<archivo>` en el bucket **privado** `adjuntos-clinicos`. Para mostrar, pedir una URL firmada (`createSignedUrl`). No guardar base64 |
| `driveFileId` | `drive_file_id` | `driveWebViewLink` no se guarda: se deriva |

---

## 4. Lógica que ya NO debe vivir en el frontend

| Antes | Ahora |
|---|---|
| Generar el historial de estados | Lo escribe la base (trigger). Solo leer |
| Crear la ficha clínica al crear un paciente | La crea la base |
| Generar `manageToken` | Lo genera el servidor y lo entrega **una sola vez** |
| Incrementar `version` de notas | La base |
| Decidir si un horario está libre como "fuente de verdad" | La base lo valida. Se puede seguir calculando disponibilidad en el cliente **para mostrar**, pero el servidor revalida siempre |
| Fijar la duración del hold | 10 min, definidos por el servidor |
| Borrar pacientes, turnos, fichas, notas | **Prohibido** (ver abajo) |

**Eliminar de la UI** los botones "Eliminar paciente / turno / nota". Alternativas: el turno se **cancela** (`estado = 'cancelado'`, `canceladoPor = 'profesional'`, `notasCancelacion`); el paciente no se borra.

**Reprogramar desde el dashboard:** marcar el turno viejo `estado = 'reprogramado'` e insertar uno nuevo con `turno_origen_id = <id del viejo>` y `origen = 'dashboard'`.

**Errores de acceso directo a tablas** (el dashboard usa `supabase-js`), mapear así:

| Código | Significado | Mensaje sugerido |
|---|---|---|
| `23P01` | Horario superpuesto | "Ese horario ya está ocupado." |
| `23505` | Duplicado (DNI, slug, cobertura) | "Ya existe un registro con ese valor." |
| `23514` | No cumple una regla (teléfono, DNI, slug reservado…) | "Revisá el formato del dato ingresado." |
| `23503` | Referencia inválida | "El dato relacionado no existe." |
| `23001` | Borrado bloqueado | "Este dato no se puede eliminar." |
| `42501` | Sin permiso | "No tenés permiso para esta acción." |

---

## 5. Portal público del paciente: contrato de funciones

El paciente **no accede a ninguna tabla**. Todo pasa por estas funciones (`supabase.rpc('<nombre>', { …parámetros })`). Los parámetros llevan prefijo `p_`.

### 5.1 Flujo de reserva

1. **`portal_agenda_publica`** `(p_ref, p_desde, p_hasta, p_session_id?)`
   - `p_ref` = slug o `public_id` del profesional. Rango máximo: 62 días.
   - Devuelve `{ profesional, servicios, sedes, coberturas, franjas, ocupados, feriados }`.
   - `ocupados` = lista de `{inicio, fin}` (turnos, holds ajenos y ausencias) **sin datos de pacientes**.
   - `profesional` nunca trae teléfono ni CBU. `servicios[].arancel_centavos` es `null` si `mostrar_precio = false`.
   - Con esto el cliente arma `DiaDisponible`/`HuecoDisponibilidad` con la lógica actual.
2. **`portal_crear_hold`** `(p_ref, p_servicio_id, p_inicio, p_modalidad, p_sede_id, p_session_id, p_ip?)` → `{ hold_id, inicio, fin, expira }`.
   - `p_modalidad`: `presencial` o `videollamada`. `p_sede_id` es obligatorio si es presencial y el profesional tiene sedes activas.
3. **`portal_confirmar_turno`** `(p_ref, p_hold_id, p_session_id, p_dni, p_nombre, p_telefono_e164, p_email?, p_cobertura_id?, p_plan?, p_nro_afiliado?, p_motivo?, p_ip?)`
   - Devuelve `{ turno_id, manage_token, inicio, fin, modalidad, servicio, arancel_centavos, sede, datos_cobro }`.
   - `p_cobertura_id` nulo = Particular. `datos_cobro` (`alias`, `titular`) solo viene si el arancel es mayor que 0.
   - **Si el DNI ya existe, los datos del paciente NO se modifican** (evita que un tercero pise un teléfono ajeno). Mostrar siempre el mismo mensaje de éxito.

### 5.2 Autogestión con token
- **`portal_ver_turno`** `(p_token)` → `{ turno_id, servicio_id, inicio, fin, estado, modalidad, servicio, profesional, slug, sede, plazo_cancelacion_hs, puede_cancelar, puede_reprogramar, reprogramado_a }`.
- **`portal_cancelar_turno`** `(p_token, p_motivo?, p_ip?)` → `{ turno_id, estado }`.
- **`portal_reprogramar_turno`** `(p_token, p_hold_id, p_session_id, p_ip?)` → `{ turno_id, turno_anterior_id, manage_token, inicio, fin, modalidad, servicio, sede }`.

**Reprogramar paso a paso:**
1. `portal_ver_turno(token)`; si `puede_reprogramar` es `false`, ocultar el botón y mostrar el plazo (`plazo_cancelacion_hs`).
2. Mostrar la agenda del mismo profesional con `portal_agenda_publica`.
3. `portal_crear_hold` usando **el mismo `servicio_id`** que devolvió `portal_ver_turno`.
4. `portal_reprogramar_turno` con ese `hold_id`. Guardar el **nuevo** `manage_token`.
5. No se puede reprogramar a un horario que se superponga con el propio turno actual.

El plazo es el mismo para cancelar y reprogramar: `inicio − plazo_cancelacion_hs > ahora`.

### 5.3 `manage_token`
- Se entrega en claro **solo** en la respuesta de `portal_confirmar_turno` y `portal_reprogramar_turno`. La base guarda únicamente su hash: **el dashboard no puede recuperarlo**.
- El enlace del paciente es `/turno/<manage_token>` (por eso `turno` es un slug reservado).

### 5.4 Errores del portal
PostgREST responde `{ code: "PT409", message: "horario_ocupado" }`. **Decidir por `message`** y mostrar texto en español:

| `message` | HTTP | Texto sugerido |
|---|---|---|
| `demasiados_intentos` | 429 | "Hiciste demasiados intentos. Probá de nuevo en unos minutos." |
| `profesional_no_encontrado` / `servicio_no_disponible` / `sede_no_disponible` | 404 | "No encontramos lo que buscás." |
| `turno_no_encontrado` | 404 | "No encontramos ese turno. Revisá el enlace." |
| `sesion_invalida` / `modalidad_invalida` / `sede_requerida` / `datos_invalidos` / `rango_invalido` | 400 | "Revisá los datos ingresados." |
| `agenda_pausada` | 409 | "El profesional no está tomando turnos por ahora." |
| `modalidad_no_disponible` | 409 | "Ese servicio no se ofrece en esa modalidad." |
| `fuera_de_anticipacion` / `fuera_de_horizonte` / `horario_no_disponible` | 409 | "Ese horario ya no está disponible. Elegí otro." |
| `horario_ocupado` | 409 | "Ese horario se acaba de ocupar. Elegí otro." |
| `turno_no_cancelable` / `turno_no_reprogramable` | 409 | "Este turno ya no se puede modificar." |
| `servicio_distinto` | 409 | "El nuevo horario debe ser del mismo servicio." |
| `fuera_de_plazo` | 403 | "Pasó el plazo para cancelar o reprogramar. Comunicate con el consultorio." |
| `reserva_vencida` | 410 | "Tu reserva venció. Elegí el horario de nuevo." |

---

## 6. IP real del visitante (decisión: se reenvía)

El límite de frecuencia y la auditoría necesitan la IP del paciente. Si el navegador llama directo a Supabase, la base usa el **último** valor de `x-forwarded-for` (agregado por el gateway; no falseable). Pero si el portal pasa por un servidor propio, ese servidor debe **reenviar la IP real**:

1. Crear endpoints de servidor `/api/portal/*` (Vercel Functions / route handlers) que envuelvan las funciones `portal_*`.
2. En el endpoint, leer la IP del visitante **solo de los encabezados de la plataforma** (`x-real-ip`, o el primer valor de `x-forwarded-for` que agrega Vercel). Nunca de un campo enviado por el cliente.
3. Llamar a Supabase con la clave **`service_role`** (variable de entorno **solo de servidor**, `SUPABASE_SERVICE_ROLE_KEY`, jamás con prefijo `VITE_`) y pasar la IP en **`p_ip`**.
4. La base solo confía en `p_ip` cuando la llamada viene con `service_role`; si llega desde `anon`, lo **ignora**.
5. Cuando todo el portal pase por el servidor, se puede cerrar el acceso directo del navegador (sentencia `revoke` comentada al final de la migración 6).

Variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (públicas); `SUPABASE_SERVICE_ROLE_KEY` (secreta, solo servidor).

---

## 7. Fuera de alcance (no implementar todavía)

- Comprobantes de pago (`comprobantePago`) y su revisión.
- Cola de sincronización con Google Drive y tokens OAuth cifrados (Drive sigue funcionando como hoy).
- Reemplazo de Firebase Auth por Supabase Auth: es necesario para que RLS funcione (`auth.uid()`), pero es un paso posterior.

## 8. Checklist de aceptación

- [ ] `Patient.nombre` y `Professional.nombre` son un solo campo; no queda `apellido` en tipos, formularios ni portal.
- [ ] `Patient.coverageId` admite `null` y "Particular" se muestra como opción fija.
- [ ] `EstadoPago` incluye `exento` y se mapea `sin_pago ⇄ pendiente`.
- [ ] `mappers.ts` convierte todas las entidades de la sección 3 en ambos sentidos, recortando `HH:MM:SS` a `HH:MM`.
- [ ] `TimeOff` se convierte a rangos UTC según la zona horaria del profesional.
- [ ] No hay botones de eliminar paciente, turno ni nota; cancelar y reprogramar funcionan.
- [ ] El frontend ya no genera historial de estados, `manageToken` ni `version`.
- [ ] El portal usa `portal_*`; los errores se muestran en español según la tabla 5.4.
- [ ] Existe el flujo de reprogramación con el mismo plazo que la cancelación.
- [ ] Ninguna clave `service_role` aparece en código de cliente ni en variables `VITE_*`.
- [ ] La app sigue funcionando con la persistencia actual (localStorage + Drive) detrás de `DataRepository`.
