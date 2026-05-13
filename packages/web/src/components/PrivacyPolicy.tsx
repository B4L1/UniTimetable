import React from 'react';

interface PrivacyPolicyProps {
    onBack: () => void;
}

export default function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
    return (
        <div style={{ padding: '80px 20px 100px', maxWidth: '800px', margin: '0 auto' }}>
            {/* Header / Back Button */}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
                <button
                    onClick={onBack}
                    className="btn"
                    style={{
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: '1px solid rgba(255, 255, 255, 0.2)',
                        padding: '8px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Vissza
                </button>
                <h1 style={{ margin: 0, fontSize: '1.5rem', color: 'var(--text-primary)' }}>Adatkezelés és Biztonság</h1>
            </div>

            {/* Privacy Content */}
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                <section>
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔒</span> Személyes Adatok & Beállítások
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        A UniTimetable tervező teljes mértékben <strong>lokálisan</strong>, a te böngésződben tárolja az összes személyes adatot (mint például a kiválasztott tantárgyak, a megjelenés téma beállításai és a saját megjegyzéseid).
                        Ezek az adatok soha nem kerülnek továbbításra semmilyen külső szerverre, és kizárólag a te eszközödön léteznek a böngésződ <code>localStorage</code>-ában.
                    </p>
                </section>

                <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />

                <section>
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>📅</span> Órarendi Adatbázis
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        A nyers órarendi adatokat (tantárgyak, tanárok, időpontok) az alkalmazás induláskor egy nyilvános, biztonságos online tárolóból tölti le. Ez egy egyirányú olvasás; az eszközöd csak lekéri a legfrissebb egyetemi struktúrát, hogy felépítse belőle a tervező felületet.
                    </p>
                </section>

                <div style={{ height: '1px', background: 'var(--border)', width: '100%' }} />

                <section>
                    <h2 style={{ fontSize: '1.2rem', color: 'var(--accent)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🛡️</span> Nyílt Forráskód
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        Az alkalmazás forráskódja publikus. A teljes kód megtekinthető és ellenőrizhető a projekt hivatalos GitHub oldalán, így bárki meggyőződhet a biztonságos adatkezelésről, de a kódmódosítás külső személyek számára nem engedélyezett. Nincsenek rejtett analitikák vagy nyomkövetők.
                    </p>
                </section>

            </div>
        </div>
    );
}
