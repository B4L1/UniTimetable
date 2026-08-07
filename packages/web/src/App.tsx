// Main App component

import React, { useEffect, useState, useRef, useMemo, Suspense, lazy } from 'react';
import { useAppStore } from './stores/appStore';
import Timetable from './components/Timetable';
import Planner from './components/Planner';

// Phase 4 stepper — lazy: the timetable is the critical path (B10 budget)
const PlannerWizard = lazy(() => import('./components/PlannerWizard'));
import Settings from './components/Settings';
import BackgroundSelector from './components/backgrounds/BackgroundSelector';
import Welcome from './components/Welcome';
import PrivacyPolicy from './components/PrivacyPolicy';
import ImportSubjectModal from './components/ImportSubjectModal';
import Dock, { type DockItemData } from './components/Dock';
import MobileMenu from './components/MobileMenu';
import ToastHost from './components/Toast';
import ConfirmDialog from './components/ConfirmDialog';
import { useMediaQuery } from './hooks/useMediaQuery';
import { formatClassName } from './utils/format';
import { toggleLightDark, isLightTheme } from './utils/theme';
import { setSubjectPalette, assignSubjectColors } from '@shared/index';
import { countTo } from './motion';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import './index.css';

type Tab = 'timetable' | 'planner' | 'wizard' | 'settings' | 'privacy';

// Clean SVG icons
const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const SettingsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const DownloadIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const CalendarExportIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M12 14v6" />
    <polyline points="9 17 12 20 15 17" />
  </svg>
);

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.7L19.5 10l-5.6 1.3L12 17l-1.9-5.7L4.5 10l5.6-1.3L12 3z" />
    <path d="M19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9L19 15z" />
  </svg>
);

const ManageIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
    <line x1="17" y1="14" x2="17" y2="21" />
    <line x1="14" y1="17.5" x2="21" y2="17.5" />
  </svg>
);

function App() {
  const { initialize, isLoading, preferences, updatePreferences, selectedClass, isFirstLaunch, user } = useAppStore();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [plannerSearchQuery, setPlannerSearchQuery] = useState('');
  const [includeCrossMajor, setIncludeCrossMajor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const plannerSaveRef = useRef<(() => void) | null>(null);
  const timetableExportRef = useRef<(() => Promise<void>) | null>(null);
  const timetableExportIcsRef = useRef<(() => void) | null>(null);

  // Derive active tab from pathname
  const activeTab: Tab = useMemo(() => {
    const path = location.pathname;
    if (path === '/planner') return 'planner';
    if (path === '/wizard') return 'wizard';
    if (path === '/settings') return 'settings';
    if (path === '/privacy') return 'privacy';
    return 'timetable';
  }, [location.pathname]);

  const setActiveTab = (tab: Tab) => {
    if (tab === 'timetable') navigate('/');
    else navigate(`/${tab}`);
  };

  // Initialize store on mount
  useEffect(() => {
    initialize();
  }, []);

  // Assign subject colors synchronously before children render.
  // v3: one muted palette for every theme (spec §4.3) — assignments stay
  // deterministic and identical to the mobile app / widget.
  useMemo(() => {
    setSubjectPalette(null);
    const entries = useAppStore.getState().timetableEntries;
    if (entries.length > 0) {
      assignSubjectColors(entries.map(e => e.subject_name));
    }
  }, []);

  // Handle DOM mutations safely after render
  useEffect(() => {
    document.body.dataset.theme = preferences.colorTheme;
  }, [preferences.colorTheme]);

  if (isLoading) {
    return (
      <div className="app-container">
        <div className="loading-container">
          <div className="spinner" />
          <span>Betöltés...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={!user ? <Login /> : <Navigate to="/" />} />
        <Route path="/onboarding" element={user && !user.selectionId ? <Onboarding /> : <Navigate to="/" />} />
        <Route
          path="*"
          element={
            !user ? (
              <Navigate to="/login" />
            ) : !user.selectionId ? (
              <Navigate to="/onboarding" />
            ) : (
              <MainAppLayout
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                preferences={preferences}
                updatePreferences={updatePreferences}
                selectedClass={selectedClass}
                isFirstLaunch={isFirstLaunch}
                selectionCount={selectionCount}
                setSelectionCount={setSelectionCount}
                plannerSearchQuery={plannerSearchQuery}
                setPlannerSearchQuery={setPlannerSearchQuery}
                includeCrossMajor={includeCrossMajor}
                setIncludeCrossMajor={setIncludeCrossMajor}
                isSaving={isSaving}
                setIsSaving={setIsSaving}
                isMobileMenuOpen={isMobileMenuOpen}
                setIsMobileMenuOpen={setIsMobileMenuOpen}
                showImportModal={showImportModal}
                setShowImportModal={setShowImportModal}
                isMobile={isMobile}
                plannerSaveRef={plannerSaveRef}
                timetableExportRef={timetableExportRef}
                timetableExportIcsRef={timetableExportIcsRef}
              />
            )
          }
        />
      </Routes>
      {/* Mounted once, above every route, so any component can call
          showToast()/confirmDialog() without being a child of whatever used
          to own that UI (see stores/toastStore.ts, stores/confirmStore.ts). */}
      <ToastHost />
      <ConfirmDialog />
    </>
  );
}

interface MainLayoutProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  preferences: any;
  updatePreferences: (prefs: any) => void;
  selectedClass: any;
  isFirstLaunch: boolean;
  selectionCount: number;
  setSelectionCount: (n: number) => void;
  plannerSearchQuery: string;
  setPlannerSearchQuery: (s: string) => void;
  includeCrossMajor: boolean;
  setIncludeCrossMajor: (b: boolean) => void;
  isSaving: boolean;
  setIsSaving: (b: boolean) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (b: boolean) => void;
  showImportModal: boolean;
  setShowImportModal: (b: boolean) => void;
  isMobile: boolean;
  plannerSaveRef: React.MutableRefObject<(() => void) | null>;
  timetableExportRef: React.MutableRefObject<(() => Promise<void>) | null>;
  timetableExportIcsRef: React.MutableRefObject<(() => void) | null>;
}

function MainAppLayout({
  activeTab, setActiveTab, preferences, updatePreferences, selectedClass,
  isFirstLaunch, selectionCount, setSelectionCount, plannerSearchQuery,
  setPlannerSearchQuery, includeCrossMajor, setIncludeCrossMajor,
  isSaving, setIsSaving, isMobileMenuOpen, setIsMobileMenuOpen,
  showImportModal, setShowImportModal, isMobile, plannerSaveRef, timetableExportRef,
  timetableExportIcsRef,
}: MainLayoutProps) {

  /**
   * The planner's "N óra" count tweens rather than snapping.
   *
   * This is the one thing in the app that anime.js does and neither CSS nor
   * motion/react can: tween a plain number and write it into a text node.
   * countTo() no-ops for deltas under 3, so adding a single class doesn't
   * trigger a pointless roll — only bulk changes (loading a saved plan,
   * generating one) actually animate.
   */
  const countRef = useRef<HTMLSpanElement>(null);
  useEffect(() => countTo(countRef.current, selectionCount), [selectionCount]);

  const handleSave = () => {
    if (plannerSaveRef.current) {
      plannerSaveRef.current();
    }
  };

  const handleExportImage = () => {
    if (timetableExportRef.current) {
      timetableExportRef.current();
    }
  };

  const handleExportIcs = () => {
    if (timetableExportIcsRef.current) {
      timetableExportIcsRef.current();
    }
  };

  if (isFirstLaunch || !selectedClass) {
    return <Welcome />;
  }

  // Constant block: tabs + settings + theme toggle. These are ALWAYS the
  // rightmost items in this exact order, so they never move on tab switch —
  // all tab-specific items enter/leave on their LEFT.
  const constantItems: DockItemData[] = [
    {
      id: 'tab-timetable',
      icon: <CalendarIcon />,
      label: 'Órarend',
      onClick: () => setActiveTab('timetable'),
      active: activeTab === 'timetable',
    },
    {
      id: 'tab-planner',
      icon: <EditIcon />,
      label: 'Tervező',
      onClick: () => setActiveTab('planner'),
      active: activeTab === 'planner',
    },
    {
      id: 'tab-settings',
      icon: <SettingsIcon />,
      label: 'Beállítások',
      onClick: () => setActiveTab('settings'),
      active: activeTab === 'settings',
    },
    {
      id: 'theme-toggle',
      icon: !isLightTheme(preferences.colorTheme) ? <SunIcon /> : <MoonIcon />,
      label: !isLightTheme(preferences.colorTheme) ? 'Világos mód' : 'Sötét mód',
      onClick: () => toggleLightDark(preferences.colorTheme, updatePreferences),
    },
  ];

  const tabSpecificItems: DockItemData[] = [];
  if (activeTab === 'timetable') {
    tabSpecificItems.push(
      { id: 'time-indicator', icon: <ClockIcon />, label: 'Idő jelző', onClick: () => updatePreferences({ showTimeIndicator: !preferences.showTimeIndicator }), active: preferences.showTimeIndicator, variant: 'toggle' } as DockItemData,
      { id: 'export-image', icon: <DownloadIcon />, label: 'Exportálás képként', onClick: handleExportImage } as DockItemData,
      { id: 'export-ics', icon: <CalendarExportIcon />, label: 'Exportálás naptárba (.ics)', onClick: handleExportIcs } as DockItemData,
    );
  }
  if (activeTab === 'planner') {
    // The wizard lives on the planner tab (it replaces this planner in
    // Phase 5) — not a permanent tab.
    tabSpecificItems.push(
      {
        id: 'open-wizard',
        icon: <SparklesIcon />,
        label: 'Generáló',
        onClick: () => setActiveTab('wizard'),
      },
      {
        id: 'manage-subjects',
        icon: <ManageIcon />,
        label: 'Tárgy kezelés',
        onClick: () => setShowImportModal(true),
        className: 'manage-subjects-btn',
      },
      {
        id: 'save',
        icon: <SaveIcon />,
        label: isSaving ? 'Mentés...' : 'Mentés',
        onClick: handleSave,
      },
    );
  }

  // Mobile menu: constants first read better in a vertical list.
  const menuItems: DockItemData[] = [...constantItems, ...tabSpecificItems];

  return (
    <div className="app-container">
      {/* Animated background effect (device-local, off by default) */}
      <BackgroundSelector />

      {/* Header */}
      <header className="app-header panel-header">
        <div className="header-left">
          <h1>📅 UniTimetable</h1>
          {selectedClass && (
            <div className="header-badges">
              <span className="class-badge">
                {formatClassName(selectedClass.name)}
              </span>
              {activeTab === 'planner' && selectionCount > 0 && !isMobile && (
                <span className="count-badge">
                  {/* The number is tweened by anime.js (see the effect above);
                      React only renders the initial value and the unit. */}
                  <span ref={countRef}>{selectionCount}</span> óra
                </span>
              )}
            </div>
          )}
        </div>

        {isMobile ? (
          <button
            className="burger-btn"
            onClick={() => setIsMobileMenuOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              padding: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        ) : (
          <Dock items={constantItems} extras={tabSpecificItems} extrasKey={activeTab} itemSize={42}>
            {activeTab === 'planner' && (
              <>
                <input
                  type="text"
                  className="planner-search-input"
                  value={plannerSearchQuery}
                  onChange={(e) => setPlannerSearchQuery(e.target.value)}
                  placeholder="Típus keresés..."
                />
                {/* Hover/focus styling lives in index.css now — the inline
                    onMouseEnter/Leave handlers it replaces couldn't respond to
                    the theme and hardcoded the old dark surface colours. */}
                <label className="planner-search-label">
                  <input
                    type="checkbox"
                    checked={includeCrossMajor}
                    onChange={(e) => setIncludeCrossMajor(e.target.checked)}
                  />
                  <span>Bővített</span>
                </label>
              </>
            )}
          </Dock>
        )}
      </header>

      {/* Mobile Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        items={menuItems.map(item => ({
          ...item,
          isActive: item.active
        }))}
      />

      {/* Content — the timetable route is hard no-scroll (spec §2.1).
          The wizard renders as a modal OVER the timetable, so both mount. */}
      <main className={`app-content${activeTab === 'timetable' || activeTab === 'wizard' ? ' app-content--fixed' : ''}`}>
        {(activeTab === 'timetable' || activeTab === 'wizard') && <Timetable onExportRef={timetableExportRef} onExportIcsRef={timetableExportIcsRef} />}
        {activeTab === 'planner' && (
          <Planner
            onSaveRef={plannerSaveRef}
            onCountChange={setSelectionCount}
            onSavingChange={setIsSaving}
            classTypeSearch={plannerSearchQuery}
            onClassTypeSearchChange={setPlannerSearchQuery}
            includeCrossMajor={includeCrossMajor}
            onIncludeCrossMajorChange={setIncludeCrossMajor}
          />
        )}
        {activeTab === 'wizard' && (
          <Suspense fallback={<div className="loading-container"><div className="spinner" /></div>}>
            <PlannerWizard />
          </Suspense>
        )}
        {activeTab === 'settings' && <Settings onNavigateToPrivacy={() => setActiveTab('privacy')} />}
        {activeTab === 'privacy' && <PrivacyPolicy onBack={() => setActiveTab('settings')} />}
      </main>

      <ImportSubjectModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div>
  );
}

export default App;
