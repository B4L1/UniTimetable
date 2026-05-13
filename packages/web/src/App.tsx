// Main App component

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAppStore } from './stores/appStore';
import Timetable from './components/Timetable';
import Planner from './components/Planner';
import Settings from './components/Settings';
import BackgroundSelector from './components/backgrounds/BackgroundSelector';
import Welcome from './components/Welcome';
import PrivacyPolicy from './components/PrivacyPolicy';
import ImportSubjectModal from './components/ImportSubjectModal';
import Dock, { type DockItemData } from './components/Dock';
import MobileMenu from './components/MobileMenu';
import { useMediaQuery } from './hooks/useMediaQuery';
import { formatClassName } from './utils/format';
import type { BackgroundTheme } from '@shared/lib/types';
import { setSubjectPalette, DEFAULT_SUBJECT_COLORS } from '@shared/index';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import './index.css';

type Tab = 'timetable' | 'planner' | 'settings' | 'privacy';

// Theme list for cycling
const BACKGROUND_THEMES: BackgroundTheme[] = [
  'none', 'sapientia', 'aurora', 'pixel-blast',
  'iridescence', 'liquid-chrome', 'faulty-terminal'
];

// All themes except sapientia are dark
const DARK_THEMES: BackgroundTheme[] = BACKGROUND_THEMES.filter(t => t !== 'sapientia');

// localStorage key for remembering the last dark theme used
const LAST_DARK_THEME_KEY = 'uni-last-dark-theme';

/** Wrap a state update in a View Transition if the browser supports it */
function withViewTransition(update: () => void) {
  if (typeof document !== 'undefined' && 'startViewTransition' in document) {
    (document as any).startViewTransition(update);
  } else {
    update();
  }
}

/** Toggle between sapientia (light) and the last dark theme, with smooth animation */
function buildToggleTheme(
  currentTheme: BackgroundTheme,
  updatePreferences: (p: Partial<{ backgroundTheme: BackgroundTheme }>) => void,
) {
  const isLight = currentTheme === 'sapientia';
  if (isLight) {
    // Switching to dark — restore the last used dark theme
    const stored = localStorage.getItem(LAST_DARK_THEME_KEY) as BackgroundTheme | null;
    const target = (stored && DARK_THEMES.includes(stored)) ? stored : 'none';
    withViewTransition(() => updatePreferences({ backgroundTheme: target }));
  } else {
    // Switching to light — remember current dark theme first
    localStorage.setItem(LAST_DARK_THEME_KEY, currentTheme);
    withViewTransition(() => updatePreferences({ backgroundTheme: 'sapientia' }));
  }
}

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
  const { initialize, isLoading, preferences, updatePreferences, selectedClass, isFirstLaunch, isFaultyTerminalUnlocked, user } = useAppStore();
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

  // Derive active tab from pathname
  const activeTab: Tab = useMemo(() => {
    const path = location.pathname;
    if (path === '/planner') return 'planner';
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

  // Toggle Light/Dark theme — restores last dark theme when switching back
  const toggleTheme = () => buildToggleTheme(preferences.backgroundTheme, updatePreferences);

  // Handle save from dock (calls Planner's save function)
  const handleSave = () => {
    if (plannerSaveRef.current) {
      plannerSaveRef.current();
    }
  };

  // Sync theme color palette synchronously before children render
  useMemo(() => {
    // Apply Sapientia specific class colors
    if (preferences.backgroundTheme === 'sapientia') {
      const sapientiaPalette = [
        '#719EB5', // Muted Blue
        '#7CA193', // Sage Green
        '#C66953', // Terracotta Red
        '#968DCA', // Soft Purple
        '#E99F79', // Peach Orange
        '#89B4B4', // Dusty Teal
        '#C48696', // Dusty Rose
        '#D0A55D', // Muted Gold
        '#92A374', // Faded Olive
        '#7D8DAB', // Dusty Indigo
        '#B49082', // Warm Taupe
        '#8FA4C2', // Periwinkle
      ];
      setSubjectPalette(sapientiaPalette);
    } else {
      setSubjectPalette(null); // Reset to default vibrant palette
    }

  }, [preferences.backgroundTheme]);

  // Handle DOM mutations safely after render
  useEffect(() => {
    document.body.dataset.theme = preferences.backgroundTheme;
  }, [preferences.backgroundTheme]);

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
            />
          )
        }
      />
    </Routes>
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
}

function MainAppLayout({
  activeTab, setActiveTab, preferences, updatePreferences, selectedClass,
  isFirstLaunch, selectionCount, setSelectionCount, plannerSearchQuery,
  setPlannerSearchQuery, includeCrossMajor, setIncludeCrossMajor,
  isSaving, setIsSaving, isMobileMenuOpen, setIsMobileMenuOpen,
  showImportModal, setShowImportModal, isMobile, plannerSaveRef
}: MainLayoutProps) {

  const handleSave = () => {
    if (plannerSaveRef.current) {
      plannerSaveRef.current();
    }
  };

  if (isFirstLaunch || !selectedClass) {
    return <Welcome />;
  }

  // Build dock items
  const dockItems: DockItemData[] = [
    {
      icon: <CalendarIcon />,
      label: 'Órarend',
      onClick: () => setActiveTab('timetable'),
      active: activeTab === 'timetable',
    },
    {
      icon: <EditIcon />,
      label: 'Tervező',
      onClick: () => setActiveTab('planner'),
      active: activeTab === 'planner',
    },
    {
      icon: <SettingsIcon />,
      label: 'Beállítások',
      onClick: () => setActiveTab('settings'),
      active: activeTab === 'settings',
    },
    ...(activeTab === 'timetable' ? [{
      icon: <ClockIcon />,
      label: 'Idő jelző',
      onClick: () => updatePreferences({ showTimeIndicator: !preferences.showTimeIndicator }),
      active: preferences.showTimeIndicator,
      variant: 'toggle',
    } as DockItemData] : []),
    {
      icon: preferences.backgroundTheme !== 'sapientia' ? <SunIcon /> : <MoonIcon />,
      label: preferences.backgroundTheme !== 'sapientia' ? 'Világos mód' : 'Sötét mód',
      onClick: () => buildToggleTheme(preferences.backgroundTheme, updatePreferences),
    },
  ];

  if (activeTab === 'planner') {
    dockItems.push({
      icon: <ManageIcon />,
      label: 'Tárgy kezelés',
      onClick: () => setShowImportModal(true),
      className: 'manage-subjects-btn',
    });
    dockItems.push({
      icon: <SaveIcon />,
      label: isSaving ? 'Mentés...' : 'Mentés',
      onClick: handleSave,
    });
  }

  return (
    <div className="app-container">
      {/* Background */}
      <BackgroundSelector theme={preferences.backgroundTheme} />

      {/* Header */}
      <header className="app-header glass-header">
        <div className="header-left">
          <h1>📅 UniTimetable</h1>
          {selectedClass && (
            <div className="header-badges">
              <span className="class-badge">
                {formatClassName(selectedClass.name)}
              </span>
              {activeTab === 'planner' && selectionCount > 0 && !isMobile && (
                <span className="count-badge">
                  {selectionCount} óra
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
          <Dock items={dockItems} itemSize={42}>
            {activeTab === 'planner' && (
              <>
                <input
                  type="text"
                  className="planner-search-input"
                  value={plannerSearchQuery}
                  onChange={(e) => setPlannerSearchQuery(e.target.value)}
                  placeholder="Típus keresés..."
                  style={{
                    minWidth: '140px',
                    maxWidth: '200px',
                    width: '14vw',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    height: '42px', // Match Dock item size
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <label className="planner-search-label" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: 'var(--text-primary)',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: 'rgba(26, 26, 36, 0.6)',
                  padding: '0 12px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  height: '42px', // Match Dock item size
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(40, 40, 50, 0.8)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(26, 26, 36, 0.6)'}
                >
                  <input
                    type="checkbox"
                    checked={includeCrossMajor}
                    onChange={(e) => setIncludeCrossMajor(e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: '14px', height: '14px' }}
                  />
                  <span style={{ whiteSpace: 'nowrap' }}>Bővített</span>
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
        items={dockItems.map(item => ({
          ...item,
          isActive: item.active
        }))}
      />

      {/* Content */}
      <main className="app-content">
        {activeTab === 'timetable' && <Timetable />}
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
        {activeTab === 'settings' && <Settings onNavigateToPrivacy={() => setActiveTab('privacy')} />}
        {activeTab === 'privacy' && <PrivacyPolicy onBack={() => setActiveTab('settings')} />}
      </main>

      <ImportSubjectModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
      />
    </div >
  );
}

export default App;
