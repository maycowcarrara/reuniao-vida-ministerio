import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
import { doc, onSnapshot, runTransaction } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import {
    getConfiguredOwnerEmail,
    getConfiguredDataOwnerUid,
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
        admin: 'Administrador',
        user: 'Usuário',
        placeholder: 'email@gmail.com',
        add: 'Adicionar',
        remove: 'Remover acesso',
        empty: 'Nenhum usuário adicional cadastrado.',
        ownerOnly: 'Somente administradores podem adicionar ou remover usuários.',
        adminManagement: 'Administradores podem adicionar e remover usuários. Somente o proprietário define outros administradores.',
        makeAdmin: 'Tornar administrador',
        removeAdmin: 'Remover como administrador',
        invalidEmail: 'Informe um email válido.',
        duplicateEmail: 'Este email já possui acesso.',
        ownerEmail: 'O proprietário já possui acesso permanente.',
        confirmAdd: 'Adicionar {email} como usuário desta congregação?',
        confirmRemove: 'Remover o acesso de {email}?',
        confirmPromote: 'Promover {email} a administrador?',
        confirmDemote: 'Remover {email} da função de administrador?',
        saved: 'Acesso atualizado.',
        loadError: 'Não foi possível carregar os usuários autorizados.',
        saveError: 'Não foi possível atualizar o acesso.'
    },
    es: {
        title: 'Control de usuarios',
        description: 'Los usuarios autorizados acceden a esta misma congregación. El registro no crea otra congregación.',
        owner: 'Propietario',
        admin: 'Administrador',
        user: 'Usuario',
        placeholder: 'correo@gmail.com',
        add: 'Agregar',
        remove: 'Quitar acceso',
        empty: 'No hay usuarios adicionales registrados.',
        ownerOnly: 'Solo los administradores pueden agregar o quitar usuarios.',
        adminManagement: 'Los administradores pueden agregar y quitar usuarios. Solo el propietario define otros administradores.',
        makeAdmin: 'Hacer administrador',
        removeAdmin: 'Quitar como administrador',
        invalidEmail: 'Introduzca un correo válido.',
        duplicateEmail: 'Este correo ya tiene acceso.',
        ownerEmail: 'El propietario ya tiene acceso permanente.',
        confirmAdd: '¿Agregar a {email} como usuario de esta congregación?',
        confirmRemove: '¿Quitar el acceso de {email}?',
        confirmPromote: '¿Promover a {email} como administrador?',
        confirmDemote: '¿Quitar a {email} del rol de administrador?',
        saved: 'Acceso actualizado.',
        loadError: 'No fue posible cargar los usuarios autorizados.',
        saveError: 'No fue posible actualizar el acceso.'
    }
};

export default function UserAccessManager({ lang = 'pt', onRoleChange }) {
    const texts = COPY[lang === 'es' ? 'es' : 'pt'];
    const dataOwnerUid = getConfiguredDataOwnerUid();
    const ownerUid = getConfiguredOwnerUid();
    const ownerEmail = getConfiguredOwnerEmail();
    const currentUser = auth.currentUser;
    const isOwner = isConfiguredOwner(currentUser);
    const currentEmail = normalizeAccessEmail(currentUser?.email);
    const [emails, setEmails] = useState([]);
    const [admins, setAdmins] = useState([]);
    const [emailInput, setEmailInput] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const accessRef = useMemo(
        () => dataOwnerUid ? doc(db, 'users', dataOwnerUid, 'configuracoes', 'acessos') : null,
        [dataOwnerUid]
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
            const nextAdmins = Array.isArray(snapshot.data()?.admins)
                ? snapshot.data().admins.map(normalizeAccessEmail).filter(Boolean)
                : [];
            setEmails([...new Set(nextEmails)].sort());
            setAdmins([...new Set(nextAdmins)].sort());
            setLoading(false);
        }, (error) => {
            console.error('Erro ao carregar acessos:', error);
            setLoading(false);
            toast.error(error, texts.loadError);
        });
    }, [accessRef, currentUser, texts.loadError]);

    const canManage = isOwner || admins.includes(currentEmail);
    const accessRole = isOwner ? 'owner' : admins.includes(currentEmail) ? 'admin' : 'user';

    useEffect(() => {
        onRoleChange?.(accessRole);
    }, [accessRole, onRoleChange]);

    const updateAccess = async (updater) => {
        if (!accessRef || !canManage) return;

        setSaving(true);
        try {
            await runTransaction(db, async (transaction) => {
                const snapshot = await transaction.get(accessRef);
                const currentEmails = Array.isArray(snapshot.data()?.emails)
                    ? snapshot.data().emails.map(normalizeAccessEmail).filter(Boolean)
                    : [];
                const currentAdmins = Array.isArray(snapshot.data()?.admins)
                    ? snapshot.data().admins.map(normalizeAccessEmail).filter(Boolean)
                    : [];
                const next = updater({
                    emails: [...new Set(currentEmails)],
                    admins: [...new Set(currentAdmins)]
                });

                transaction.set(accessRef, {
                    ownerUid,
                    emails: [...new Set(next.emails.map(normalizeAccessEmail).filter(Boolean))].sort(),
                    admins: [...new Set(next.admins.map(normalizeAccessEmail).filter(Boolean))].sort(),
                    updatedAtIso: new Date().toISOString()
                });
            });
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
        if (!window.confirm(texts.confirmAdd.replace('{email}', email))) return;

        await updateAccess((current) => ({
            ...current,
            emails: [...current.emails, email]
        }));
        setEmailInput('');
    };

    const handleRemove = async (email) => {
        if (!window.confirm(texts.confirmRemove.replace('{email}', email))) return;

        await updateAccess((current) => ({
            emails: current.emails.filter((item) => item !== email),
            admins: isOwner
                ? current.admins.filter((item) => item !== email)
                : current.admins
        }));
    };

    const handleToggleAdmin = async (email) => {
        if (!isOwner) return;
        const emailIsAdmin = admins.includes(email);
        const confirmationText = emailIsAdmin ? texts.confirmDemote : texts.confirmPromote;
        if (!window.confirm(confirmationText.replace('{email}', email))) return;

        await updateAccess((current) => ({
            ...current,
            admins: emailIsAdmin
                ? current.admins.filter((item) => item !== email)
                : [...current.admins, email]
        }));
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
                ) : emails.map((email) => {
                    const emailIsAdmin = admins.includes(email);
                    const canRemoveEmail = canManage && (isOwner || !emailIsAdmin);

                    return (
                    <div key={email} className="flex items-center gap-2 px-4 py-3">
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-slate-700">{email}</p>
                            <p className={`text-[10px] font-black uppercase tracking-widest ${emailIsAdmin ? 'text-cyan-700' : 'text-slate-400'}`}>
                                {emailIsAdmin ? texts.admin : texts.user}
                            </p>
                        </div>
                        {isOwner && (
                            <button
                                type="button"
                                onClick={() => handleToggleAdmin(email)}
                                disabled={saving}
                                className={`rounded-xl p-2 transition disabled:opacity-40 ${emailIsAdmin ? 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100' : 'text-slate-400 hover:bg-cyan-50 hover:text-cyan-700'}`}
                                title={emailIsAdmin ? texts.removeAdmin : texts.makeAdmin}
                                aria-label={`${emailIsAdmin ? texts.removeAdmin : texts.makeAdmin}: ${email}`}
                            >
                                <ShieldCheck size={17} />
                            </button>
                        )}
                        {canRemoveEmail && (
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
                    );
                })}
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
            {canManage && (
                <p className="mt-3 text-xs font-semibold text-slate-500">{texts.adminManagement}</p>
            )}
        </section>
    );
}
