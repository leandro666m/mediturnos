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

function MediTurnosApp() {
  const { activeZone, setActiveZone, professional } = useApp();

  // Detección de ruta inicial por hash (#/[slug] o #/app)
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes(professional.slug) || hash.startsWith('#/r/')) {
      setActiveZone('portal');
    } else if (hash.includes('/app')) {
      setActiveZone('dashboard');
    }
  }, [professional.slug, setActiveZone]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900 selection:bg-sky-500 selection:text-white">
      {/* <HeaderNav /> */}
      <div className="flex-1">
        {activeZone === 'dashboard' ? <DoctorDashboard /> : <PatientPortal />}
      </div>
      <OfflineIndicator />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MediTurnosApp />
    </AppProvider>
  );
}
