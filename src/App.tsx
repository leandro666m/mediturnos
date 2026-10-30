/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { HeaderNav } from './components/common/HeaderNav';
import { DoctorDashboard } from './components/dashboard/DoctorDashboard';
import { PatientPortal } from './components/portal/PatientPortal';
import { OfflineIndicator } from './components/common/OfflineIndicator';
import { SupabaseAuthGate } from './components/auth/SupabaseAuthGate';
import { isPublicPortalHash, SupabasePublicPortalGate } from './components/auth/SupabasePublicPortalGate';
import { isSupabaseConfigured } from './data/supabaseClient';

function MediTurnosApp() {
  const { activeZone, setActiveZone, professional, dataLoaded, dataSyncError } = useApp();

  // Detección de ruta inicial por hash (#/[slug] o #/app)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes(professional.slug) || hash.startsWith('#/r/') || hash.startsWith('#/turno/')) {
      setActiveZone('portal');
    } else if (hash.includes('/app')) {
      setActiveZone('dashboard');
    }
  }, [professional.slug, setActiveZone]);

  if (!dataLoaded) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">Cargando tus datos desde Supabase…</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-sky-500 selection:text-white">
      {dataSyncError && <div role="alert" className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">Error de sincronización con Supabase: {dataSyncError}</div>}
      {/* <HeaderNav /> */}
      <div className="flex-1">
        {activeZone === 'dashboard' ? <DoctorDashboard /> : <PatientPortal />}
      </div>
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  if (isSupabaseConfigured) {
    if (isPublicPortalHash(window.location.hash)) {
      return <SupabasePublicPortalGate>
        {(professional, workspace) => <AppProvider initialProfessional={professional} publicWorkspace={workspace}><MediTurnosApp /></AppProvider>}
      </SupabasePublicPortalGate>;
    }
    return <SupabaseAuthGate>
      {profile => <AppProvider initialProfessional={profile}><MediTurnosApp /></AppProvider>}
    </SupabaseAuthGate>;
  }
  return (
    <AppProvider>
      <MediTurnosApp />
    </AppProvider>
  );
}
