import React, { useState } from 'react';
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Login() {
    const [carregando, setCarregando] = useState(false);

    const handleLogin = async () => {
        setCarregando(true);
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const emailLogado = result.user.email;

            // 🛑 AQUI ESTÃO OS E-MAILS AUTORIZADOS
            const emailsPermitidos = [
                'maycowcarrara@gmail.com',
                'carraramaycow@gmail.com'
            ];

            if (!emailsPermitidos.includes(emailLogado)) {
                // Se o e-mail não estiver na lista, desloga ele na hora!
                await auth.signOut();
                alert(`Acesso Restrito!\n\nO e-mail (${emailLogado}) não tem permissão para acessar o painel de administração.`);
            }
            // Se o e-mail estiver na lista, o hook de autenticação vai liberar a tela sozinho!

        } catch (error) {
            console.error("Erro login:", error);
            // Ignora o erro se o usuário apenas fechar a janelinha do Google
            if (error.code !== 'auth/popup-closed-by-user') {
                alert("Erro ao conectar com Google.");
            }
        } finally {
            setCarregando(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 relative font-sans">

            {/* Botão Voltar para a Tela Inicial (Novo) */}
            <div className="absolute top-6 left-6">
                <Link to="/" className="flex items-center gap-2 text-gray-500 hover:text-blue-600 transition font-bold text-sm bg-white px-4 py-2 rounded-full shadow-sm border border-gray-200">
                    <ArrowLeft size={16} /> Voltar ao Início
                </Link>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <h1 className="text-3xl font-bold mb-2 text-blue-800">Vida e Ministério</h1>
                <p className="text-gray-500 mb-8">Gerenciador de Designações</p>

                <button
                    onClick={handleLogin}
                    disabled={carregando}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-xl transition-all shadow-sm group disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {carregando ? (
                        <span className="text-blue-600">Verificando acesso...</span>
                    ) : (
                        <>
                            <img
                                src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                                alt="G"
                                className="w-6 h-6 group-hover:scale-110 transition-transform"
                            />
                            Entrar com Google
                        </>
                    )}
                </button>
                <p className="mt-6 text-xs text-gray-400">Seus dados serão sincronizados na nuvem.</p>
            </div>
        </div>
    );
}