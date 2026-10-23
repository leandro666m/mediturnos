import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  ConsultationNote,
  DriveFolderInfo,
  DriveUserInfo,
  Holiday,
  Location,
  MessageTemplate,
  NoteAttachment,
  Patient,
  Professional,
  Service,
  WorkingHours,
} from '../types';

// Inicializar Firebase App de forma única
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

const provider = new GoogleAuthProvider();
// Alcance de menor privilegio: solo archivos y carpetas creados o abiertos por esta app
provider.addScope('https://www.googleapis.com/auth/drive.file');

// Cache del token de acceso estrictamente en memoria (Regla de seguridad Workspace)
let cachedAccessToken: string | null = null;
let isSigningIn = false;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('No se pudo obtener el token de acceso de Google Drive.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Error al iniciar sesión con Google:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const setDriveAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const signOutGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// ----------------------------------------------------------------------------
// OPERACIONES CON LA API REST DE GOOGLE DRIVE (v3)
// ----------------------------------------------------------------------------

const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

/**
 * Busca un archivo o carpeta por nombre y padre opcional
 */
export const findDriveFile = async (
  name: string,
  parentId?: string,
  isFolder: boolean = false
): Promise<{ id: string; name: string; webViewLink?: string } | null> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('No hay sesión de Google activa.');

  let q = `name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  if (parentId) {
    q += ` and '${parentId}' in parents`;
  }
  if (isFolder) {
    q += ` and mimeType = 'application/vnd.google-apps.folder'`;
  }

  const res = await fetch(
    `${DRIVE_API_URL}?q=${encodeURIComponent(q)}&fields=files(id,name,webViewLink)&pageSize=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.error?.message || `Error ${res.status} al buscar en Drive`);
  }

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0];
  }
  return null;
};

/**
 * Crea una carpeta en Google Drive
 */
export const createDriveFolder = async (
  name: string,
  parentId?: string
): Promise<{ id: string; name: string; webViewLink: string }> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('No hay sesión de Google activa.');

  const metadata: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const res = await fetch(`${DRIVE_API_URL}?fields=id,name,webViewLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error ${res.status} al crear carpeta en Drive`);
  }

  return await res.json();
};

/**
 * Obtiene o crea una carpeta en Drive
 */
export const getOrCreateFolder = async (
  name: string,
  parentId?: string
): Promise<{ id: string; name: string; webViewLink: string }> => {
  const existing = await findDriveFile(name, parentId, true);
  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      webViewLink: existing.webViewLink || `https://drive.google.com/drive/folders/${existing.id}`,
    };
  }
  return await createDriveFolder(name, parentId);
};

/**
 * Crea o actualiza un archivo JSON en Google Drive
 */
export const saveJsonFileToDrive = async (
  fileName: string,
  jsonData: any,
  parentId: string
): Promise<{ id: string; name: string; webViewLink?: string }> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('No hay sesión de Google activa.');

  const existingFile = await findDriveFile(fileName, parentId, false);
  const content = JSON.stringify(jsonData, null, 2);

  if (existingFile) {
    // Actualizar contenido existente (PATCH simple de contenido multimedia)
    const updateRes = await fetch(
      `${DRIVE_UPLOAD_URL}/${existingFile.id}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: content,
      }
    );

    if (!updateRes.ok) {
      const err = await updateRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error al actualizar archivo ${fileName} en Drive`);
    }

    return existingFile;
  } else {
    // Crear archivo nuevo mediante subida multipart (metadata + contenido)
    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      parents: [parentId],
    };

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      content +
      closeDelimiter;

    const createRes = await fetch(
      `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      }
    );

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(err.error?.message || `Error al crear archivo ${fileName} en Drive`);
    }

    return await createRes.json();
  }
};

/**
 * Sube un archivo adjunto binario (PDF, JPG, PNG) a una carpeta de Drive
 */
export const uploadBinaryFileToDrive = async (
  file: File,
  parentId: string
): Promise<NoteAttachment> => {
  const token = getDriveAccessToken();
  if (!token) throw new Error('No hay sesión de Google activa.');

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = {
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    parents: [parentId],
  };

  const fileArrayBuffer = await file.arrayBuffer();

  const metadataPart =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type || 'application/octet-stream'}\r\n` +
    'Content-Transfer-Encoding: binary\r\n\r\n';

  const encoder = new TextEncoder();
  const metadataBuffer = encoder.encode(metadataPart);
  const closeDelimiterBuffer = encoder.encode(closeDelimiter);

  const totalLength =
    metadataBuffer.byteLength + fileArrayBuffer.byteLength + closeDelimiterBuffer.byteLength;
  const combinedBuffer = new Uint8Array(totalLength);

  combinedBuffer.set(metadataBuffer, 0);
  combinedBuffer.set(new Uint8Array(fileArrayBuffer), metadataBuffer.byteLength);
  combinedBuffer.set(
    closeDelimiterBuffer,
    metadataBuffer.byteLength + fileArrayBuffer.byteLength
  );

  const res = await fetch(
    `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,name,mimeType,size,webViewLink`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: combinedBuffer,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Error al subir adjunto ${file.name} a Drive`);
  }

  const uploaded = await res.json();

  return {
    id: 'att_' + Math.random().toString(36).slice(2, 8),
    nombre: uploaded.name || file.name,
    tipoMime: uploaded.mimeType || file.type,
    tamanoBytes: Number(uploaded.size) || file.size,
    url: uploaded.webViewLink || URL.createObjectURL(file),
    subidoEn: new Date().toISOString(),
    driveFileId: uploaded.id,
    driveWebViewLink: uploaded.webViewLink,
  };
};

/**
 * Estructura y sincroniza el árbol maestro completo en Google Drive
 */
export const syncEntireWorkspaceToDrive = async (params: {
  professional: Professional;
  locations: Location[];
  services: Service[];
  workingHours: WorkingHours[];
  holidays: Holiday[];
  patients: Patient[];
  appointments: any[];
  notes: ConsultationNote[];
  templates: MessageTemplate[];
}): Promise<{
  success: boolean;
  folders: DriveFolderInfo;
  filesSyncedCount: number;
  error?: string;
}> => {
  try {
    // 1. Crear / obtener carpeta maestra: MediTurnos_Data
    const masterFolder = await getOrCreateFolder('MediTurnos_Data');

    // 2. Crear / obtener subcarpetas estructurales
    const [configFolder, turnosFolder, pacientesFolder] = await Promise.all([
      getOrCreateFolder('_configuracion', masterFolder.id),
      getOrCreateFolder('_turnos', masterFolder.id),
      getOrCreateFolder('pacientes', masterFolder.id),
    ]);

    let filesCount = 0;

    // 3. Guardar archivos de configuración en _configuracion/
    await Promise.all([
      saveJsonFileToDrive(
        'profesional.json',
        {
          meta: {
            app: 'MediTurnos',
            esquemaVersion: '2.0-PostgreSQL-Compatible',
            actualizadoEn: new Date().toISOString(),
          },
          profesional: params.professional,
          direcciones: params.locations,
        },
        configFolder.id
      ),
      saveJsonFileToDrive(
        'servicios.json',
        {
          profesionalId: params.professional.id,
          actualizadoEn: new Date().toISOString(),
          servicios: params.services,
        },
        configFolder.id
      ),
      saveJsonFileToDrive(
        'horarios_atencion.json',
        {
          profesionalId: params.professional.id,
          actualizadoEn: new Date().toISOString(),
          franjasHorarias: params.workingHours,
          feriados: params.holidays,
        },
        configFolder.id
      ),
      saveJsonFileToDrive(
        'plantillas_mensajes.json',
        {
          profesionalId: params.professional.id,
          actualizadoEn: new Date().toISOString(),
          plantillas: params.templates,
        },
        configFolder.id
      ),
    ]);
    filesCount += 4;

    // 4. Guardar turnos en _turnos/ (activos vs históricos)
    const hoyIso = new Date().toISOString().slice(0, 10);
    const turnosActivos = params.appointments.filter(
      a => a.inicio.slice(0, 10) >= hoyIso && a.estado !== 'cancelado'
    );
    const turnosHistoricos = params.appointments.filter(
      a => a.inicio.slice(0, 10) < hoyIso || a.estado === 'cancelado'
    );

    await Promise.all([
      saveJsonFileToDrive(
        'turnos_activos.json',
        {
          profesionalId: params.professional.id,
          total: turnosActivos.length,
          actualizadoEn: new Date().toISOString(),
          turnos: turnosActivos,
        },
        turnosFolder.id
      ),
      saveJsonFileToDrive(
        'turnos_historicos.json',
        {
          profesionalId: params.professional.id,
          total: turnosHistoricos.length,
          actualizadoEn: new Date().toISOString(),
          turnos: turnosHistoricos,
        },
        turnosFolder.id
      ),
    ]);
    filesCount += 2;

    // 5. Guardar carpetas y fichas de cada paciente en pacientes/paciente_{DNI}_{Apellido}/
    for (const patient of params.patients) {
      const folderName = `paciente_${patient.dni}_${patient.nombre.trim().replace(/\s+/g, '_')}`;
      const patientFolder = await getOrCreateFolder(folderName, pacientesFolder.id);

      // Crear subcarpeta 'adjuntos' dentro del paciente
      await getOrCreateFolder('adjuntos', patientFolder.id);

      // Ficha clínica y notas del paciente
      const patientNotes = params.notes.filter(n => n.patientId === patient.id);
      const patientAppointments = params.appointments.filter(
        a => a.patientId === patient.id || a.pacienteDni === patient.dni
      );

      await saveJsonFileToDrive(
        'ficha_clinica.json',
        {
          paciente: patient,
          totalConsultas: patientNotes.length,
          totalTurnos: patientAppointments.length,
          actualizadoEn: new Date().toISOString(),
          notasEvolucion: patientNotes,
          resumenTurnos: patientAppointments.map(t => ({
            id: t.id,
            inicio: t.inicio,
            modalidad: t.modalidad,
            estado: t.estado,
            estadoPago: t.estadoPago,
            precioCentavos: t.precioCentavos,
          })),
        },
        patientFolder.id
      );
      filesCount += 1;
    }

    const foldersInfo: DriveFolderInfo = {
      masterFolderId: masterFolder.id,
      masterFolderUrl:
        masterFolder.webViewLink ||
        `https://drive.google.com/drive/folders/${masterFolder.id}`,
      configFolderId: configFolder.id,
      turnosFolderId: turnosFolder.id,
      pacientesFolderId: pacientesFolder.id,
    };

    return {
      success: true,
      folders: foldersInfo,
      filesSyncedCount: filesCount,
    };
  } catch (error: any) {
    console.error('Error durante la sincronización con Google Drive:', error);
    return {
      success: false,
      folders: { masterFolderId: '', masterFolderUrl: '' },
      filesSyncedCount: 0,
      error: error.message || 'Error desconocido al sincronizar con Google Drive',
    };
  }
};
