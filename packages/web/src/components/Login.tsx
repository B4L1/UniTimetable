import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
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

const Login: React.FC = () => {
    const navigate = useNavigate();
    const { setUser, preferences, updatePreferences } = useAppStore();
    const [isAuthenticating, setIsAuthenticating] = React.useState(false);

    const isLight = isLightTheme(preferences.colorTheme);

    const toggleTheme = () => toggleLightDark(preferences.colorTheme, updatePreferences);

    const handleLogin = useGoogleLogin({
        onSuccess: async (tokenResponse: any) => {
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
        onError: (error: any) => {
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
            <div className="login-card glass-card">
                <h1>📅 UniTimetable</h1>
                <p className="login-subtitle">Jelentkezz be az egyetemi fiókoddal</p>

                <div className="google-btn-wrapper">
                    <button 
                        className="custom-google-btn" 
                        onClick={() => handleLogin()}
                    >
                        <img 
                            src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" 
                            alt="Google" 
                            className="google-icon" 
                        />
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
