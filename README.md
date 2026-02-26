# 📅 Gerenciador da Reunião Vida e Ministério

> Um sistema intuitivo, moderno e focado em produtividade para auxiliar o Superintendente da Reunião Vida e Ministério na gestão de designações, notificações e impressão de programações.

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Objetivo do Projeto

Desenvolver uma ferramenta ágil baseada em nuvem (Firebase - Serverless) que garante que **usuários leigos** possam operar o sistema com extrema facilidade. O foco absoluto é a **Experiência do Usuário (UX)**, automação de tarefas repetitivas, prevenção de erros de designação e flexibilidade, conectando a administração da congregação diretamente aos publicadores.

---

## ✨ Funcionalidades Principais

### 🚀 PWA com Sincronização Offline Aprimorada

- **Funcionamento sem Internet:** O sistema conta com Service Workers avançados que permitem que o Superintendente continue a editar e designar partes mesmo 100% offline.
- **Sincronização Automática:** As edições feitas localmente entram em uma fila e são sincronizadas de forma invisível e automática com o Firebase assim que a conexão de internet é restabelecida.

### 📱 Quadro de Anúncios Virtual (Publicadores)

Uma interface *Mobile-First* desenvolvida para os irmãos da congregação acessarem pelo próprio celular:

- **Roteamento Inteligente:** O sistema detecta automaticamente se quem está acessando é o Administrador ou um publicador, direcionando para a tela correta sem atritos.
- **Acesso Seguro:** Proteção de privacidade por PIN numérico para evitar a exposição dos nomes na internet aberta.
- **Agenda com 1 Clique:** Botão dinâmico que permite ao publicador salvar a sua designação direto no *Google Calendar*, já preenchido com tempo, seção, ajudante e leitor.
- **Filtro Inteligente:** Barra de pesquisa onde o irmão digita o próprio nome e o quadro oculta todo o resto, mostrando apenas as suas partes.
- **Destaques Automáticos:** Extração inteligente dos números dos cânticos, selos de "Semana Atual" e banners visuais automáticos para eventos especiais (Ex: Visita do Superintendente de Circuito ou Assembleias).

### 👥 Gestão Inteligente e Importação

- **Importação Automatizada (Scraper):** Módulo que busca e importa a programação das partes diretamente das fontes oficiais, eliminando o trabalho manual de "copiar e colar".
- **Cadastro Completo:** Nome, contato, privilégios teocráticos e suporte a **Foto de Perfil (Avatar)** via *Copy & Paste* (com compressão automática em Base64).
- **Gestão de Ausências:** Possibilidade de cadastrar períodos de indisponibilidade. O sistema bloqueia automaticamente a designação do aluno nessas datas.
- **Painel Estatístico Dinâmico:** Visualização de totais de alunos, divididos por gênero, ausentes na semana e lista de alunos "esquecidos" (há mais de 60 dias sem parte).

### 🤖 Motor de Designação e Programação

- **Sugestão Algorítmica:** Um motor inteligente que sugere o melhor aluno para uma parte com base em:
  - **Privilégios:** (Ex: Apenas Anciãos/Servos para Tesouros e Orações).
  - **Gênero:** Força o ajudante a ser do mesmo gênero do estudante automaticamente.
  - **Rodízio Justo:** Prioriza matematicamente quem está há mais tempo sem receber partes.
- **Interface Drag & Drop:** Arraste alunos da barra lateral diretamente para os "slots" da programação.
- **Validação de Conflitos (Anti-Duplicação):** Alertas visuais em tempo real se um aluno for designado para duas partes na mesma semana.

### 📢 Integrações e Notificações Avançadas

- **API Google Agenda:** Sincronização oficial e automática das partes diretamente com uma agenda do Google, exportando todas as partes com os dias, horários e detalhes perfeitamente configurados.
- **E-mail Automático (EmailJS):** Disparo de e-mails em lote diretamente do sistema utilizando a plataforma **EmailJS**, enviando a notificação detalhada da designação sem depender de um cliente de e-mail local.
- **WhatsApp Dinâmico:** Geração de mensagens preenchidas com nome, data, parte e ajudante, prontas para envio em um clique via `wa.me`.

### 🖨️ Impressão Física

Geração nativa de PDFs perfeitos para folha A4 com layouts dinâmicos:

1. **Layout Padrão (1 a 2 semanas):** Estilo visual com cores oficiais e formatação amigável.
2. **Layout Condensado (4 a 5 semanas):** Versão econômica de alta densidade para agrupar o mês inteiro em uma única folha de papel para o mural físico.

---

## 🚀 Próximos Passos (Roadmap)

Apesar de altamente funcional e robusto, o projeto continua em evolução:

1. **Agrupamento Familiar:** Ligar cadastros de marido e esposa para facilitar designações casadas (ou forçar que ambos não tenham partes simultâneas caso precisem cuidar dos filhos).
2. **Geração de Relatórios Anuais:** Dashboards avançados para análise profunda do uso de privilégios e rodízio de alunos ao longo do ano teocrático.

---

## 🛠️ Tecnologias Utilizadas

### Linguagens e Frameworks

![JavaScript](https://img.shields.io/badge/javascript-%23323330.svg?style=for-the-badge&logo=javascript&logoColor=%23F7DF1E)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)

### Estilização e UI

![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![HTML5](https://img.shields.io/badge/html5-%23E34F26.svg?style=for-the-badge&logo=html5&logoColor=white)

### Backend e Hospedagem

![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)

### APIs e Integrações

![Google Calendar](https://img.shields.io/badge/Google%20Calendar-%234285F4.svg?style=for-the-badge&logo=google-calendar&logoColor=white)
![EmailJS](https://img.shields.io/badge/EmailJS-FCA253?style=for-the-badge&logo=minutemailer&logoColor=white)

---

## 📂 Estrutura de Dados (Exemplo)

O sistema utiliza uma estrutura JSON leve e otimizada no Firestore:

```json
{
  "configuracoes": {
    "nome_cong": "Sua Congregação",
    "horario": "19:30",
    "idioma": "pt",
    "eventosAnuais": []
  },
  "alunos": [
    {
      "id": "uuid",
      "nome": "João Silva",
      "tipo": "anciao",
      "telefone": "5511999999999",
      "email": "joao@email.com",
      "avatar": "data:image/jpeg;base64,/9j/4AAQSkZJ...", 
      "datasIndisponiveis": [
        { "inicio": "2024-12-20", "fim": "2025-01-05", "motivo": "Férias" }
      ],
      "historico": [ 
        { "data": "2024-10-10", "parte": "leitura", "ajudante": "" } 
      ]
    }
  ]
}
```

## 🔧 Como Executar Localmente

Certifique-se de ter o [Node.js](https://nodejs.org/) instalado.

1. Clone o repositório:
   **Bash**

   ```
   git clone [https://github.com/seu-usuario/reuniao-vida-ministerio.git](https://github.com/seu-usuario/reuniao-vida-ministerio.git)
   ```
2. Entre na pasta:
   **Bash**

   ```
   cd reuniao-vida-ministerio
   ```
3. Instale as dependências:
   **Bash**

   ```
   npm install
   ```
4. Configure as chaves do Firebase, Google Calendar e EmailJS no seu arquivo de ambiente (`.env`).
5. Rode o projeto:
   **Bash**

   ```
   npm run dev
   ```

---

## 🤝 Contribuição

Contribuições são muito bem-vindas! Sinta-se à vontade para abrir *issues* relatando bugs ou sugerir (e implementar) novas funcionalidades baseadas na experiência real de uso nas congregações.

---

**Nota Legal:** Este software não é uma ferramenta oficial da Watch Tower Bible and Tract Society of Pennsylvania. É uma ferramenta auxiliar de código aberto, desenvolvida por voluntários para simplificar o fluxo de trabalho local.
