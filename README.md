
# 📅 Gerenciador da Reunião Vida e Ministério (V3)

> Um sistema moderno, inteligente e sincronizado na nuvem para auxiliar na gestão das designações da Reunião Vida e Ministério.

## 🚀 Sobre o Projeto

O **Gerenciador da Reunião Vida e Ministério** evoluiu de uma ferramenta local para uma **Web App Progressiva (PWA)** robusta. Ele automatiza o fluxo de trabalho do superintendente, desde a importação da programação até a notificação dos alunos, garantindo que os dados estejam seguros na nuvem, mas acessíveis offline.

O foco é a  **Experiência do Usuário (UX)** , reduzindo horas de trabalho manual para minutos de gerenciamento intuitivo.

## ✨ Funcionalidades Principais

### 🧠 Inteligência e Automação

* **Parser Inteligente:** Importa a programação diretamente do JW.org (HTML ou Texto). O sistema entende automaticamente seções ("Tesouros", "Vida Cristã"), tempos e cânticos, suportando  **Português e Espanhol** .
* **Assistente de Sugestão:** Um algoritmo que sugere o melhor aluno para cada parte, baseando-se na data da última designação e no histórico, promovendo um rodízio justo.
* **Detecção de Conflitos:** Alerta visual imediato se um aluno já estiver designado para outra parte na mesma semana.

### ☁️ Sincronização e Dados

* **Backend Firebase:** Autenticação segura (Google/Email) e banco de dados Firestore em tempo real.
* **Modo Offline (PWA):** Graças ao cache persistente do Firestore, o app funciona mesmo sem internet e sincroniza quando a conexão volta.
* **Backup e Restauração:** Ferramentas para exportar/importar dados em JSON ou resetar a conta com segurança.

### 🖨️ Impressão e Comunicação

* **Layouts de Impressão Flexíveis:**
  * Folha Padrão (Semelhante ao original).
  * Modo Econômico (4 ou 5 semanas por página A4).
* **Notificações em 1 Clique:** Botões dedicados para enviar designações via **WhatsApp** (com link direto) ou  **E-mail** , já com o texto da mensagem formatado.

---

## 🛠️ Stack Tecnológica

O projeto foi construído com as tecnologias mais recentes do ecossistema JavaScript (2025):

* **Core:** React 19 + Vite.
* **Estilização:** Tailwind CSS v4 (Configuração "Zero-runtime" otimizada).
* **Ícones:** Lucide React.
* **Manipulação de Dados:** Lodash & Date-fns.
* **Parsing:** Cheerio (para processamento robusto de HTML/Texto).
* **Backend as a Service:** Firebase Authentication & Firestore.

---

## 📂 Estrutura do Projeto

**Bash**

```
src/
├── components/       # Componentes de UI (Dashboard, Designar, Impressão)
├── data/             # Constantes e dados estáticos
├── hooks/            # Hooks customizados (useGerenciadorDados)
├── services/         # Configuração do Firebase
├── utils/            # Lógica pura
│   ├── importador/   # Parsers e Regex para o JW.org
│   └── revisarEnviar/# Geradores de links (Zap/Mail) e datas
└── App.jsx           # Componente Raiz e Roteamento
```

---

## 🔧 Instalação e Configuração

### Pré-requisitos

* Node.js (v18+)
* Conta no Firebase (Google Cloud)

### Passo a Passo

1. **Clone o repositório:**
   **Bash**

   ```
   git clone https://github.com/seu-usuario/reuniao-vida-ministerio.git
   cd reuniao-vida-ministerio
   ```
2. **Instale as dependências:**
   **Bash**

   ```
   npm install
   ```
3. **Configuração do Firebase:**

   * Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
   * Habilite o **Authentication** e o  **Firestore Database** .
   * Substitua as credenciais em `src/services/firebase.js` com as do seu projeto:

   **JavaScript**

   ```
   const firebaseConfig = {
     apiKey: "SUA_API_KEY",
     authDomain: "SEU_PROJECT.firebaseapp.com",
     projectId: "SEU_PROJECT_ID",
     // ...
   };
   ```
4. **Execute localmente:**
   **Bash**

   ```
   npm run dev
   ```

---

## 📖 Guia de Uso Rápido

1. **Dashboard:** Visão geral da semana atual e atalhos rápidos.
2. **Importar:** Copie o texto da reunião no site JW.org e cole na área de importação. O sistema processará as partes automaticamente.
3. **Designar:**
   * Clique nos "slots" vazios.
   * Use a **Lâmpada 💡** para ver sugestões automáticas baseadas no histórico.
   * Observe os alertas ⚠️ de conflito.
4. **Revisar e Enviar:**
   * Selecione quantas semanas deseja imprimir por folha.
   * Clique nos ícones de WhatsApp/Email para notificar os designados.
   * Grave o histórico para atualizar a contagem de "dias desde a última parte".

---

## 🛡️ Aviso Legal

Este software é uma ferramenta auxiliar desenvolvida por voluntários e **não é um aplicativo oficial** da Watch Tower Bible and Tract Society of Pennsylvania. O uso é pessoal e a responsabilidade pelos dados inseridos é do usuário.

---

## 🤝 Contribuição

Pull Requests são bem-vindos! Se você tem ideias para melhorar o algoritmo de sugestão ou novos layouts de impressão:

1. Faça um Fork do projeto.
2. Crie uma Branch para sua Feature (`git checkout -b feature/NovaFeature`).
3. Commit suas mudanças (`git commit -m 'Adiciona NovaFeature'`).
4. Push para a Branch (`git push origin feature/NovaFeature`).
5. Abra um Pull Request.

---

Desenvolvido com ❤️
