import React from 'react';
import { useGoogleLogin, type TokenResponse } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../stores/appStore';
import { fetchUserPreferences } from '@shared/index';
import { toggleLightDark, isLightTheme } from '../utils/theme';
import './Login.css';

const SunIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
);

/**
 * The official Google "G", inline.
 *
 * Was an <img> pointing at gstatic's `gsa_512dp.png` — the Google Search *app*
 * icon, which is a product icon rather than the sign-in mark Google's branding
 * guidelines call for. It also made the login button depend on a third-party
 * request that a slow network or a blocker could drop, leaving a broken-image
 * box on the one screen every user must get through.
 *
 * Inline SVG fixes both: correct mark, no network, sharp at any size.
 */
const GoogleGlyph = () => (
    <svg className="google-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        <path fill="none" d="M0 0h48v48H0z" />
    </svg>
);

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { setUser, preferences, updatePreferences } = useAppStore();
    const [isAuthenticating, setIsAuthenticating] = React.useState(false);

    const isLight = isLightTheme(preferences.colorTheme);

    const toggleTheme = () => toggleLightDark(preferences.colorTheme, updatePreferences);

    const handleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse: Omit<TokenResponse, 'error' | 'error_description' | 'error_uri'>) => {
            setIsAuthenticating(true);
            try {
                // Fetch user info using the access token
                const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
                });
                
                const decoded = await userInfoResponse.json();
                
                const email = decoded.email;
                const googleId = decoded.sub;
                const name = decoded.name;
                const picture = decoded.picture;

                // TEMP: Treat everyone as a student while no teachers use the app
                // TODO: Restore domain-based role assignment once teacher flow is needed
                const role: 'student' | 'teacher' = 'student';

                // 1. Fetch preferences from Supabase first
                const prefs = await fetchUserPreferences(email);
                const selectionId = prefs?.selected_class_id || '';

                // 2. Build complete user object
                const user = {
                    email,
                    name,
                    picture,
                    role,
                    googleId,
                    selectionId
                };

                // 3. Set user (this triggers App.tsx redirect)
                setUser(user);

                // TEMP: Always redirect to onboarding/class selection for now
                // TODO: Remove this when teachers start using the app
                // In the future, check if (selectionId) to skip onboarding for returning students
                navigate('/onboarding');
            } catch (err) {
                console.error('Failed to fetch user info:', err);
                setIsAuthenticating(false);
            }
        },
        onError: (error: Pick<TokenResponse, 'error' | 'error_description' | 'error_uri'>) => {
            console.log('Login Failed:', error);
            setIsAuthenticating(false);
        },
    });

    if (isAuthenticating) {
        return (
            <div className="login-container">
                <div className="loading-container">
                    <div className="spinner" />
                    <span>Bejelentkezés folyamatban...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <button className="theme-toggle-fab" onClick={toggleTheme}>
                {isLight ? <MoonIcon /> : <SunIcon />}
            </button>
            <div className="login-card panel">
                <h1>📅 UniTimetable</h1>
                <p className="login-subtitle">Jelentkezz be az egyetemi fiókoddal</p>

                <div className="google-btn-wrapper">
                    <button
                        className="custom-google-btn"
                        onClick={() => handleLogin()}
                    >
                        <GoogleGlyph />
                        <span>Bejelentkezés Google-fiókkal</span>
                    </button>
                </div>

                <p className="login-disclaimer">
                    Google-fiókodat kizárólag az órarended biztonságos összekapcsolására és eszközeid közötti szinkronizálására használjuk.
                    Mivel a Google hivatalos bejelentkezési felületét használjuk, jelszavadat soha nem látjuk és nem tároljuk az adatbázisunkban.
                </p>
            </div>
        </div>
    );
};

export default Login;
