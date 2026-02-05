import React from 'react';
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";

export default function Login() {
    const handleLogin = async () => {
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Erro login:", error);
            alert("Erro ao conectar com Google.");
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
                <h1 className="text-3xl font-bold mb-2 text-blue-800">Vida e Ministério</h1>
                <p className="text-gray-500 mb-8">Gerenciador de Designações</p>

                <button
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-4 px-6 rounded-xl transition-all shadow-sm group"
                >
                    <img
                        src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
                        alt="G"
                        className="w-6 h-6 group-hover:scale-110 transition-transform"
                    />
                    Entrar com Google
                </button>
                <p className="mt-6 text-xs text-gray-400">Seus dados serão sincronizados na nuvem.</p>
            </div>
        </div>
    );
}