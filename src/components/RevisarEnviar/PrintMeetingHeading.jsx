import React from 'react';
import qrcode from 'qrcode-generator';

// O mesmo endereço principal usado para compartilhar o aplicativo, sem /quadro.
const siteUrl = `https://${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'rvm-sbssc'}.web.app`;
const qr = qrcode(0, 'M');
qr.addData(siteUrl);
qr.make();
const quietZone = 4;
const size = qr.getModuleCount() + quietZone * 2;
const modules = [];
for (let row = 0; row < qr.getModuleCount(); row++) {
    for (let col = 0; col < qr.getModuleCount(); col++) {
        if (qr.isDark(row, col)) modules.push(`M${col + quietZone},${row + quietZone}h1v1h-1z`);
    }
}
const path = modules.join('');

export default function PrintMeetingHeading({ children, showQr = false, lang = 'pt' }) {
    const label = lang === 'es' ? 'Tablero digital' : 'Quadro digital';
    return (
        <div className={`re-print-heading${showQr ? ' re-print-heading-with-qr' : ''}`}>
            <div className="re-print-heading-copy">{children}</div>
            {showQr && (
                <a className="re-print-qr" href={siteUrl} aria-label={`${label}: ${siteUrl}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
                        <rect width={size} height={size} fill="#fff" />
                        <path d={path} fill="#000" />
                    </svg>
                </a>
            )}
        </div>
    );
}
