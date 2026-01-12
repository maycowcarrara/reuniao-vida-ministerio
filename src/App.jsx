import React, { useState } from 'react';
import Importador from './components/Importador';
import ListaAlunos from './components/ListaAlunos';
import estudantesData from './data/estudantes.json';
import { Calendar, Users, Printer, LayoutDashboard, Menu } from 'lucide-react';

function App() {
  const [abaAtiva, setAbaAtiva] = useState('importar');
  const [programacao, setProgramacao] = useState(null);
  const [parteSelecionada, setParteSelecionada] = useState(null);
  const [alunos, setAlunos] = useState(estudantesData);

  // Filtro de alunos (mantido da versão anterior)
  const alunosFiltrados = alunos.filter(aluno => {
    if (!parteSelecionada) return true;
    const titulo = parteSelecionada.titulo.toLowerCase();
    if (titulo.includes('leitura')) return aluno.genero === 'M';
    if (titulo.includes('joias')) return aluno.privilegios.includes('anciao') || aluno.privilegios.includes('servo');
    return true; 
  });

  // Componente de Botão do Menu (para evitar repetição)
  const MenuButton = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setAbaAtiva(id)} 
      className={`w-full flex items-center gap-3 px-6 py-4 transition-all duration-200 border-l-4
        ${abaAtiva === id 
          ? 'bg-blue-800 border-white text-white shadow-inner' 
          : 'border-transparent text-blue-100 hover:bg-blue-600 hover:text-white'
        }`}
    >
      <Icon size={20} />
      <span className="font-medium tracking-wide">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen w-full bg-gray-100 font-sans text-gray-900 overflow-hidden">
      
      {/* SIDEBAR (Esquerda) */}
      <aside className="w-72 bg-jw-blue flex flex-col shadow-2xl z-10 shrink-0">
        <div className="p-8 border-b border-blue-500/30">
          <h1 className="text-2xl font-bold text-white tracking-tight leading-none">
            Vida e<br/>Ministério
          </h1>
          <div className="mt-2 flex items-center gap-2 text-blue-200 text-sm">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Cong. Palmas PR
          </div>
        </div>
        
        <nav className="flex-1 py-6 space-y-1">
          <MenuButton id="importar" icon={Calendar} label="Importar" />
          <MenuButton id="designar" icon={LayoutDashboard} label="Designar Partes" />
          <MenuButton id="alunos" icon={Users} label="Alunos" />
        </nav>

        <div className="p-6 text-center text-blue-300 text-xs border-t border-blue-500/30">
          Versão Local 1.0
        </div>
      </aside>

      {/* ÁREA PRINCIPAL (Direita) */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50">
        {/* Cabeçalho Superior */}
        <header className="h-20 bg-white shadow-sm flex items-center justify-between px-8 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 capitalize">
              {abaAtiva === 'importar' && 'Importar Programação'}
              {abaAtiva === 'designar' && 'Painel de Designações'}
              {abaAtiva === 'alunos' && 'Gerenciamento de Alunos'}
            </h2>
            <p className="text-sm text-gray-500">Gerencie a reunião do meio de semana</p>
          </div>
          
          <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 hover:bg-gray-50 hover:border-gray-400 transition shadow-sm">
            <Printer size={18} /> 
            Imprimir Quadro
          </button>
        </header>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto p-8 scroll-smooth">
          <div className="max-w-7xl mx-auto">
            {abaAtiva === 'importar' && (
              <Importador onImportComplete={(dados) => { setProgramacao(dados); setAbaAtiva('designar'); }} />
            )}

            {abaAtiva === 'designar' && (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Coluna da Programação */}
                <div className="xl:col-span-2 space-y-6">
                  {programacao ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                        <h3 className="font-bold text-lg text-gray-700">Semana: {programacao.semana}</h3>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {programacao.partes.map((parte, idx) => (
                          <div 
                            key={idx}
                            onClick={() => setParteSelecionada(parte)}
                            className={`p-5 cursor-pointer transition-all duration-200 hover:bg-blue-50 group
                              ${parteSelecionada === parte ? 'bg-blue-50 border-l-4 border-jw-blue' : 'border-l-4 border-transparent'}
                            `}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-xs font-bold px-2 py-1 rounded uppercase tracking-wider
                                ${parte.titulo.includes('Joias') ? 'bg-gray-200 text-gray-600' : 
                                  parte.titulo.includes('Leitura') ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}
                              `}>
                                {parte.tipo === 'estudante' ? 'Estudante' : 'Parte'}
                              </span>
                              <span className="text-gray-400 font-mono text-sm">{parte.tempo} min</span>
                            </div>
                            <h4 className="text-gray-800 font-semibold text-lg group-hover:text-blue-700">{parte.titulo}</h4>
                            {parte.licao && (
                              <div className="mt-2 inline-flex items-center text-sm text-jw-ministerio font-medium bg-orange-50 px-2 py-1 rounded">
                                📚 {parte.licao}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl border-2 border-dashed border-gray-300 text-gray-400">
                      <Calendar size={64} className="mb-4 opacity-20" />
                      <p className="text-lg">Nenhuma programação importada.</p>
                      <button onClick={() => setAbaAtiva('importar')} className="mt-4 text-jw-blue hover:underline">
                        Ir para Importação
                      </button>
                    </div>
                  )}
                </div>

                {/* Coluna de Sugestões */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col h-[calc(100vh-12rem)] sticky top-0">
                  <div className="p-4 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                      <Users size={18} className="text-jw-blue"/> 
                      {parteSelecionada ? 'Alunos Sugeridos' : 'Selecione uma parte'}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4">
                    <ListaAlunos alunos={alunosFiltrados} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;