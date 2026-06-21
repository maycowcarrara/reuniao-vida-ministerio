import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
    getConfiguredOwnerEmail,
    getConfiguredOwnerUid,
    isConfiguredOwner,
    normalizeAccessEmail
} from '../services/adminAccess';
import { toast } from '../utils/toast';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const COPY = {
    pt: {
        title: 'Controle de usuários',
        description: 'Os usuários autorizados acessam esta mesma congregação. O cadastro não cria uma nova congregação.',
        owner: 'Proprietário',
        additional: 'Usuários adicionais',
        placeholder: 'email@gmail.com',
        add: 'Adicionar',
        remove: 'Remover acesso',
        empty: 'Nenhum usuário adicional cadastrado.',
        ownerOnly: 'Somente o proprietário pode adicionar ou remover usuários.',
        invalidEmail: 'Informe um email válido.',
        duplicateEmail: 'Este email já possui acesso.',
        ownerEmail: 'O proprietário já possui acesso permanente.',
        saved: 'Acesso atualizado.',
        loadError: 'Não foi possível carregar os usuários autorizados.',
        saveError: 'Não foi possível atualizar o acesso.'
    },
    es: {
        title: 'Control de usuarios',
        description: 'Los usuarios autorizados acceden a esta misma congregación. El registro no crea otra congregación.',
        owner: 'Propietario',
        additional: 'Usuarios adicionales',
        placeholder: 'correo@gmail.com',
        add: 'Agregar',
        remove: 'Quitar acceso',
        empty: 'No hay usuarios adicionales registrados.',
        ownerOnly: 'Solo el propietario puede agregar o quitar usuarios.',
        invalidEmail: 'Introduzca un correo válido.',
        duplicateEmail: 'Este correo ya tiene acceso.',
        ownerEmail: 'El propietario ya tiene acceso permanente.',
        saved: 'Acceso actualizado.',
        loadError: 'No fue posible cargar los usuarios autorizados.',
        saveError: 'No fue posible actualizar el acceso.'
    }
};

export default function UserAccessManager({ lang = 'pt' }) {
    const texts = COPY[lang === 'es' ? 'es' : 'pt'];
    const ownerUid = getConfiguredOwnerUid();
    const ownerEmail = getConfiguredOwnerEmail();
    const currentUser = auth.currentUser;
    const canManage = isConfiguredOwner(currentUser);
    const [emails, setEmails] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const accessRef = useMemo(
        () => ownerUid ? doc(db, 'users', ownerUid, 'configuracoes', 'acessos') : null,
        [ownerUid]
    );

    useEffect(() => {
        if (!accessRef || !currentUser) {
            setLoading(false);
            return undefined;
        }

        return onSnapshot(accessRef, (snapshot) => {
            const nextEmails = Array.isArray(snapshot.data()?.emails)
                ? snapshot.data().emails.map(normalizeAccessEmail).filter(Boolean)
                : [];
            setEmails([...new Set(nextEmails)].sort());
            setLoading(false);
        }, (error) => {
            console.error('Erro ao carregar acessos:', error);
            setLoading(false);
            toast.error(error, texts.loadError);
        });
    }, [accessRef, currentUser, texts.loadError]);

    const saveEmails = async (nextEmails) => {
        if (!accessRef || !canManage) return;

        setSaving(true);
        try {
            await setDoc(accessRef, {
                ownerUid,
                emails: [...new Set(nextEmails.map(normalizeAccessEmail).filter(Boolean))].sort(),
                updatedAtIso: new Date().toISOString()
            }, { merge: false });
            toast.success(texts.saved);
        } catch (error) {
            console.error('Erro ao salvar acessos:', error);
            toast.error(error, texts.saveError);
        } finally {
            setSaving(false);
        }
    };

    const handleAdd = async (event) => {
        event.preventDefault();
        const email = normalizeAccessEmail(emailInput);

        if (!EMAIL_PATTERN.test(email)) {
            toast.info(texts.invalidEmail);
            return;
        }
        if (email === ownerEmail) {
            toast.info(texts.ownerEmail);
            return;
        }
        if (emails.includes(email)) {
            toast.info(texts.duplicateEmail);
            return;
        }

        await saveEmails([...emails, email]);
        setEmailInput('');
    };

    const handleRemove = async (email) => {
        await saveEmails(emails.filter((item) => item !== email));
    };

    return (
        <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:rounded-[2rem] sm:p-8">
            <div className="absolute left-0 top-0 h-full w-1.5 bg-cyan-500" />
            <div className="mb-5 flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                    <Users size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">{texts.title}</h3>
                    <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">{texts.description}</p>
                </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3 px-4 py-3">
                    <ShieldCheck size={18} className="shrink-0 text-emerald-600" />
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-slate-800">{ownerEmail}</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">{texts.owner}</p>
                    </div>
                </div>

                {loading ? (
                    <div className="px-4 py-4 text-sm font-medium text-slate-400">...</div>
                ) : emails.length === 0 ? (
                    <div className="px-4 py-4 text-sm font-medium text-slate-400">{texts.empty}</div>
                ) : emails.map((email) => (
                    <div key={email} className="flex items-center gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-700">{email}</p>
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{texts.additional}</p>
                        </div>
                        {canManage && (
                            <button
                                type="button"
                                onClick={() => handleRemove(email)}
                                disabled={saving}
                                className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                                title={texts.remove}
                                aria-label={`${texts.remove}: ${email}`}
                            >
                                <Trash2 size={17} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {canManage ? (
                <form onSubmit={handleAdd} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                        type="email"
                        value={emailInput}
                        onChange={(event) => setEmailInput(event.target.value)}
                        placeholder={texts.placeholder}
                        disabled={saving}
                        className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-base font-semibold text-slate-800 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-2 focus:ring-cyan-100 sm:text-sm"
                    />
                    <button
                        type="submit"
                        disabled={saving || !emailInput.trim()}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-600 px-5 py-3 text-sm font-black text-white transition hover:bg-cyan-700 disabled:opacity-40"
                    >
                        <UserPlus size={17} /> {texts.add}
                    </button>
                </form>
            ) : (
                <p className="mt-4 text-xs font-semibold text-slate-500">{texts.ownerOnly}</p>
            )}
        </section>
    );
}
