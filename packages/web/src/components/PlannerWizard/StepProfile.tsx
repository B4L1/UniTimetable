// Step 1 — Profil: the existing onboarding data (faculty/year/group)
// embedded as a summary (Part E decision #3: embed, don't duplicate).

import { useAppStore } from '../../stores/appStore';
import { formatClassName } from '../../utils/format';
import { useWizardStore } from './wizardStore';

export default function StepProfile() {
    const { user, selectedClass, resetClassSelection } = useAppStore();
    const setStep = useWizardStore(s => s.setStep);

    const changeClass = async () => {
        if (window.confirm('Csoport módosítása? A tervező beállításai megmaradnak, de az órarended újra kell válaszd.')) {
            await resetClassSelection();
        }
    };

    return (
        <section className="wizard-panel">
            <h2>Profil</h2>
            <p className="wizard-hint">
                Ez alapján állítjuk össze a választható tárgyak listáját.
            </p>

            <div className="wizard-profile-card">
                {user?.picture && <img src={user.picture} alt="" className="wizard-avatar" />}
                <div className="wizard-profile-info">
                    <span className="wizard-profile-name">{user?.name ?? 'Vendég'}</span>
                    <span className="wizard-profile-meta">{user?.email}</span>
                    {selectedClass && (
                        <span className="wizard-profile-class">
                            {formatClassName(selectedClass.name)}.
                            {selectedClass.groupCode ? ` ${selectedClass.groupCode} csoport` : ''}
                        </span>
                    )}
                </div>
            </div>

            <div className="wizard-row">
                <button className="btn wizard-btn-secondary" onClick={changeClass}>
                    Csoport módosítása
                </button>
                <button className="btn btn-primary" onClick={() => setStep(1)}>
                    Rendben, tovább a tárgyakhoz
                </button>
            </div>
        </section>
    );
}
