// Main App component

import React, { useEffect, useState, useRef } from 'react';
import { useAppStore } from './stores/appStore';
import Timetable from './components/Timetable';
import Planner from './components/Planner';
import Settings from './components/Settings';
import BackgroundSelector from './components/backgrounds/BackgroundSelector';
import Welcome from './components/Welcome';
import Dock, { type DockItemData } from './components/Dock';
import MobileMenu from './components/MobileMenu';
import { useMediaQuery } from './hooks/useMediaQuery';
import { formatClassName } from './utils/format';
import type { BackgroundTheme } from '@shared/lib/types';
import { setSubjectPalette, DEFAULT_SUBJECT_COLORS } from '@shared/index';
import './index.css';

type Tab = 'timetable' | 'planner' | 'settings';

// Theme list for cycling
const BACKGROUND_THEMES: BackgroundTheme[] = [
  'none', 'sapientia', 'silk', 'aurora', 'pixel-blast',
  'beams', 'dither', 'iridescence', 'liquid-chrome', 'faulty-terminal'
];

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

const PaletteIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
    <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
    <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
    <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

function App() {
  const { initialize, isLoading, preferences, updatePreferences, selectedClass, isFirstLaunch, isFaultyTerminalUnlocked } = useAppStore();
  const [activeTab, setActiveTab] = useState<Tab>('timetable');
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [plannerSearchQuery, setPlannerSearchQuery] = useState('');
  const [includeCrossMajor, setIncludeCrossMajor] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');
  const plannerSaveRef = useRef<(() => void) | null>(null);

  // Initialize store on mount
  useEffect(() => {
    initialize();
  }, []);

  // Cycle to next theme
  const cycleTheme = () => {
    const availableThemes = BACKGROUND_THEMES.filter(t => t !== 'faulty-terminal' || isFaultyTerminalUnlocked);
    const currentIndex = availableThemes.indexOf(preferences.backgroundTheme);
    // If current theme is not in available (e.g. was locked and now we are here? shouldn't happen), default to 0
    // If current theme is faulty-terminal and it IS in available, we find it.

    let nextIndex = (currentIndex + 1) % availableThemes.length;
    if (currentIndex === -1) nextIndex = 0; // Fallback

    updatePreferences({ backgroundTheme: availableThemes[nextIndex] });
  };

  // Handle save from dock (calls Planner's save function)
  const handleSave = () => {
    if (plannerSaveRef.current) {
      plannerSaveRef.current();
    }
  };

  // Sync theme to body dataset and update color palette
  useEffect(() => {
    document.body.dataset.theme = preferences.backgroundTheme;

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
    {
      icon: <ClockIcon />,
      label: 'Idő jelző',
      onClick: () => updatePreferences({ showTimeIndicator: !preferences.showTimeIndicator }),
      active: preferences.showTimeIndicator,
      variant: 'toggle',
    },
    {
      icon: <PaletteIcon />,
      label: 'Téma váltás',
      onClick: cycleTheme,
    },
  ];

  // Add save button only on planner page
  if (activeTab === 'planner') {
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
              {activeTab === 'planner' && selectionCount > 0 && (
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
                  value={plannerSearchQuery}
                  onChange={(e) => setPlannerSearchQuery(e.target.value)}
                  placeholder="Típus keresés..."
                  style={{
                    minWidth: '140px',
                    maxWidth: '200px',
                    width: '14vw',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    background: 'rgba(26, 26, 36, 0.6)',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    height: '42px', // Match Dock item size
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
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
        {activeTab === 'settings' && <Settings />}
      </main>
    </div >
  );
}

export default App;

