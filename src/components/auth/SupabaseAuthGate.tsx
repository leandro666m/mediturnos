import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../../data/supabaseClient';
import type { Professional } from '../../types';

type ProfileRow = {
  id: string;
  public_id: string;
  slug: string;
  email: string;
  nombre: string;
  titulo: string;
  especialidad: string;
  matricula_nacional: string | null;
  matricula_provincial: string | null;
  telefono_contacto: string | null;
  cbu_cvu: string | null;
  alias_mp: string | null;
  titular_cuenta: string | null;
  cuit: string | null;
  banco: string | null;
  foto_perfil_path: string | null;
  tamano_texto: Professional['tamanoTexto'];
  zona_horaria: string;
  agenda_pausada: boolean;
  intervalo_turnos_min: number;
  anticipacion_minima_hs: number;
  horizonte_maximo_dias: number;
  margen_entre_turnos_min: number;
  plazo_cancelacion_hs: number;
};

function mapProfessional(row: ProfileRow): Professional {
  return {
    id: row.id,
    publicId: row.public_id,
    slug: row.slug,
    nombre: row.nombre,
    titulo: row.titulo,
    especialidad: row.especialidad,
    matriculaNacional: row.matricula_nacional || undefined,
    matriculaProvincial: row.matricula_provincial || undefined,
    telefonoContactoPrivado: row.telefono_contacto || undefined,
    cbu: row.cbu_cvu || undefined,
    aliasCobro: row.alias_mp || undefined,
    titularCobro: row.titular_cuenta || undefined,
    cuit: row.cuit || undefined,
    banco: row.banco || undefined,
    fotoPerfil: row.foto_perfil_path || undefined,
    tamanoTexto: row.tamano_texto || 'predeterminado',
    zonaHoraria: row.zona_horaria,
    agendaPausada: row.agenda_pausada,
    parametros: {
      grillaMin: row.intervalo_turnos_min,
      anticipacionMinHoras: row.anticipacion_minima_hs,
      horizonteDias: row.horizonte_maximo_dias,
      margenMin: row.margen_entre_turnos_min,
      plazoCancelacionHoras: row.plazo_cancelacion_hs,
    },
  };
}

function slugify(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function SupabaseAuthGate({ children }: { children: (profile: Professional) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Professional | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'profile'>('login');
  const [nombre, setNombre] = useState('');
  const [titulo, setTitulo] = useState('Lic.');
  const [especialidad, setEspecialidad] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    const loadSession = async (nextSession: Session | null) => {
      if (!alive) return;
      setSession(nextSession);
      setProfile(null);
      if (!nextSession) {
        setMode('login');
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data, error: queryError } = await supabase
        .from('profesionales').select('*').eq('id', nextSession.user.id).maybeSingle();
      if (!alive) return;
      if (queryError) {
        setError(`No se pudo leer el perfil: ${queryError.message}`);
      } else if (data) {
        setProfile(mapProfessional(data as ProfileRow));
        setMode('login');
        setError('');
      } else {
        setEmail(nextSession.user.email || '');
        setMode('profile');
      }
      setLoading(false);
    };
    supabase.auth.getSession().then(({ data }) => loadSession(data.session));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void loadSession(nextSession);
    });
    return () => {
      alive = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured || !supabase) {
    return <AuthCard>
      <h1 className="text-2xl font-bold">Conectar con Supabase local</h1>
      <p className="mt-3 text-sm text-slate-600">Faltan las variables de conexión. Crea `.env.local` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY`, y reinicia Vite.</p>
    </AuthCard>;
  }

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) setError(authError.message);
    setBusy(false);
  };

  const signUp = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    const { data, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) setError(authError.message);
    else if (!data.session) setNotice('Cuenta creada. Revisa el correo de Supabase local para confirmar el registro y luego inicia sesión.');
    else setMode('profile');
    setBusy(false);
  };

  const createProfile = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    setBusy(true); setError('');
    const normalizedSlug = slugify(`${nombre.slice(0, 80)}-${crypto.randomUUID().slice(0, 4)}`);
    const { data, error: insertError } = await supabase.from('profesionales').insert({
      id: session.user.id,
      email: session.user.email || email,
      nombre: nombre.trim(),
      titulo: titulo.trim(),
      especialidad: especialidad.trim(),
      slug: normalizedSlug,
    }).select('*').single();
    if (insertError) setError(`No se pudo crear el perfil: ${insertError.message}`);
    else setProfile(mapProfessional(data as ProfileRow));
    setBusy(false);
  };

  if (loading) return <AuthCard><p className="text-slate-600">Conectando con Supabase…</p></AuthCard>;

  if (session && profile) {
    return <>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900">
        <span>Sesión Supabase: {session.user.email}. Agenda, pacientes, configuración y notas guardan en la base; los adjuntos continúan gestionándose con Google Drive.</span>
        <button className="font-semibold underline" onClick={() => void supabase.auth.signOut()}>Cerrar sesión</button>
      </div>
      {children(profile)}
    </>;
  }

  return <AuthCard>
    <div className="mb-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">MediTurnos · Supabase local</p>
      <h1 className="mt-2 text-2xl font-bold text-slate-900">
        {mode === 'profile' ? 'Completa tu perfil profesional' : mode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">Esta etapa conecta Auth y el perfil. Los demás datos todavía no se guardan en la base.</p>
    </div>
    {mode === 'profile' ? <form onSubmit={createProfile} className="space-y-4">
      <Field label="Nombre completo" value={nombre} onChange={setNombre} required />
      <Field label="Título profesional" value={titulo} onChange={setTitulo} required />
      <Field label="Especialidad" value={especialidad} onChange={setEspecialidad} required />
      <button className="primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar perfil'}</button>
    </form> : <form onSubmit={mode === 'login' ? signIn : signUp} className="space-y-4">
      <Field label="Correo electrónico" type="email" value={email} onChange={setEmail} required />
      <Field label="Contraseña" type="password" value={password} onChange={setPassword} minLength={6} required />
      <button className="primary" disabled={busy}>{busy ? 'Procesando…' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}</button>
      <button type="button" className="w-full text-sm font-medium text-sky-700" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setNotice(''); }}>
        {mode === 'login' ? 'Crear una cuenta nueva' : 'Ya tengo cuenta'}
      </button>
    </form>}
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {session && error && <button className="mt-3 text-sm font-medium text-slate-600 underline" onClick={() => void supabase.auth.signOut()}>Cerrar esta sesión</button>}
    {notice && <p role="status" className="mt-4 rounded-lg bg-sky-50 p-3 text-sm text-sky-800">{notice}</p>}
  </AuthCard>;
}

function AuthCard({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
    <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">{children}</section>
  </main>;
}

function Field({ label, value, onChange, type = 'text', ...props }: {
  label: string; value: string; onChange: (value: string) => void; type?: string;
  required?: boolean; minLength?: number;
}) {
  return <label className="block text-sm font-medium text-slate-700">{label}
    <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
      type={type} value={value} onChange={event => onChange(event.target.value)} {...props} />
  </label>;
}
