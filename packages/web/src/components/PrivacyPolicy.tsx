import React from 'react';

interface PrivacyPolicyProps {
    onBack: () => void;
}

export default function PrivacyPolicy({ onBack }: PrivacyPolicyProps) {
    return (
        <div className="prose-page">
            {/* Header / Back Button */}
            <div className="prose-page-header">
                <button
                    onClick={onBack}
                    className="btn"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="12" x2="5" y2="12"></line>
                        <polyline points="12 19 5 12 12 5"></polyline>
                    </svg>
                    Vissza
                </button>
                <h1 className="prose-page-title">Adatkezelés és Biztonság</h1>
            </div>

            {/* Privacy Content */}
            <div className="panel prose-panel">

                <section>
                    <h2 className="prose-heading">
                        <span>🔒</span> Személyes Adatok & Beállítások
                    </h2>
                    <p className="prose-body">
                        A UniTimetable tervező teljes mértékben <strong>lokálisan</strong>, a te böngésződben tárolja az összes személyes adatot (mint például a kiválasztott tantárgyak, a megjelenés téma beállításai és a saját megjegyzéseid).
                        Ezek az adatok soha nem kerülnek továbbításra semmilyen külső szerverre, és kizárólag a te eszközödön léteznek a böngésződ <code>localStorage</code>-ában.
                    </p>
                </section>

                <hr className="prose-rule" />

                <section>
                    <h2 className="prose-heading">
                        <span>📅</span> Órarendi Adatbázis
                    </h2>
                    <p className="prose-body">
                        A nyers órarendi adatokat (tantárgyak, tanárok, időpontok) az alkalmazás induláskor egy nyilvános, biztonságos online tárolóból tölti le. Ez egy egyirányú olvasás; az eszközöd csak lekéri a legfrissebb egyetemi struktúrát, hogy felépítse belőle a tervező felületet.
                    </p>
                </section>

                <hr className="prose-rule" />

                <section>
                    <h2 className="prose-heading">
                        <span>🛡️</span> Nyílt Forráskód
                    </h2>
                    <p className="prose-body">
                        Az alkalmazás forráskódja publikus. A teljes kód megtekinthető és ellenőrizhető a projekt hivatalos GitHub oldalán, így bárki meggyőződhet a biztonságos adatkezelésről, de a kódmódosítás külső személyek számára nem engedélyezett. Nincsenek rejtett analitikák vagy nyomkövetők.
                    </p>
                </section>

            </div>
        </div>
    );
}
