import React, { useState } from 'react';
import { Download, Plus, Share2, X } from 'lucide-react';
import { useSectionMessages } from '../i18n';
import { usePwaInstall } from '../hooks/usePwaInstall';

function IosInstallInstructions({ texts, onClose }) {
    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 no-print">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl">
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
                    <div>
                        <h3 className="text-base font-black text-slate-900">{texts.iosTitle}</h3>
                        <p className="mt-1 text-sm leading-relaxed text-slate-500">{texts.iosIntro}</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                        aria-label={texts.close}
                        title={texts.close}
                    >
                        <X size={18} />
                    </button>
                </div>

                <ol className="space-y-3 px-5 py-4 text-sm font-bold text-slate-700">
                    <li className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Share2 size={16} />
                        </span>
                        <span className="pt-1">{texts.iosStepShare}</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Plus size={17} />
                        </span>
                        <span className="pt-1">{texts.iosStepAdd}</span>
                    </li>
                    <li className="flex items-start gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Download size={16} />
                        </span>
                        <span className="pt-1">{texts.iosStepConfirm}</span>
                    </li>
                </ol>

                <div className="border-t border-slate-100 px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-700"
                    >
                        {texts.close}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function PwaInstallButton({ variant = 'header' }) {
    const texts = useSectionMessages('pwaInstall');
    const { canInstall, installMode, promptInstall } = usePwaInstall();
    const [showIosInstructions, setShowIosInstructions] = useState(false);

    if (!canInstall) return null;

    const handleClick = async () => {
        if (installMode === 'ios') {
            setShowIosInstructions(true);
            return;
        }

        await promptInstall();
    };

    const isSidebar = variant === 'sidebar';

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                title={texts.installApp}
                aria-label={texts.installApp}
                className={isSidebar
                    ? 'flex w-full items-center gap-3 px-2 py-2 text-sm font-bold text-green-300 hover:text-green-100 hover:bg-green-800/30 border border-green-800/30 rounded-md transition-colors'
                    : 'inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/20 px-2.5 text-white shadow-sm transition-all hover:bg-white/30 active:scale-95'
                }
            >
                <Download size={isSidebar ? 16 : 17} />
                <span className={isSidebar ? '' : 'text-[10px] font-black uppercase tracking-wider'}>
                    {isSidebar ? texts.installApp : texts.installShort}
                </span>
            </button>

            {showIosInstructions && (
                <IosInstallInstructions
                    texts={texts}
                    onClose={() => setShowIosInstructions(false)}
                />
            )}
        </>
    );
}
