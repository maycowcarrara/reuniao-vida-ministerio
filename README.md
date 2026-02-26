# 📅 Gerenciador da Reunião Vida e Ministério

> Um sistema intuitivo, moderno e focado em produtividade para auxiliar o Superintendente da Reunião Vida e Ministério na gestão de designações, notificações e impressão de programações.

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=white)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Objetivo do Projeto

Desenvolver uma ferramenta ágil baseada em nuvem (Firebase - Serverless) que garante que **usuários leigos** possam operar o sistema com extrema facilidade. O foco absoluto é a **Experiência do Usuário (UX)**, automação de tarefas repetitivas, prevenção de erros de designação e flexibilidade na geração de relatórios e impressões.

---

## ✨ Funcionalidades Principais

### 👥 Gestão Inteligente de Alunos

- **Cadastro Completo:** Nome, contato, privilégios teocráticos e suporte a **Foto de Perfil (Avatar)** via *Copy & Paste* (com compressão automática em Base64).
- **Gestão de Ausências:** Possibilidade de cadastrar períodos de férias ou viagens. O sistema bloqueia automaticamente a designação do aluno nessas datas.
- **Painel Estatístico Dinâmico:** Visualização rápida de totais de alunos, divididos por gênero, ausentes na semana e lista de alunos "esquecidos" (há mais de 60 dias sem parte).

### 🤖 Motor de Designação e Programação

- **Sugestão Algorítmica:** Um motor inteligente que sugere o melhor aluno para uma parte com base em:
  - **Privilégios:** (Ex: Apenas Anciãos/Servos para Tesouros e Orações).
  - **Gênero:** Força o ajudante a ser do mesmo gênero do estudante automaticamente.
  - **Rodízio Justo:** Prioriza matematicamente quem está há mais tempo sem receber partes.
- **Interface Drag & Drop:** Arraste alunos da barra lateral diretamente para os "slots" da programação.
- **Validação de Conflitos (Anti-Duplicação):** Alertas visuais em tempo real se um aluno for designado para duas partes na mesma semana (mesmo que em abas diferentes).

### 📢 Integrações e Notificações

- **Sincronização com Google Agenda:** Envio das partes designadas diretamente para o Google Calendar do Superintendente com apenas um clique.
- **WhatsApp Automático:** Geração de mensagens preenchidas com nome, data, parte e ajudante, prontas para envio em um clique via `wa.me`.
- **E-mail:** Integração nativa para envio de designações via `mailto`.

### 🖨️ Impressão e Quadro de Anúncios

Geração nativa de PDFs perfeitos para folha A4 com layouts dinâmicos:

1. **Layout Padrão (1 a 2 semanas):** Estilo visual semelhante às planilhas tradicionais, com cores oficiais e formatação amigável.
2. **Layout Condensado (4 a 5 semanas):** Versão econômica de alta densidade para agrupar o mês inteiro em uma única folha de papel.

---

## 🚀 Próximos Passos (Roadmap)

Apesar de altamente funcional, o projeto continua em evolução:

1. **Importação Automatizada:** Crawler para buscar a programação automaticamente do site oficial (JW.org), eliminando o "copiar e colar".
2. **Agrupamento Familiar:** Ligar cadastros de marido e esposa para facilitar designações casadas ou evitar conflitos de cuidado com filhos.
3. **Modo PWA Avançado:** Aprimorar o *Progressive Web App* para funcionamento 100% offline com sincronização posterior com o Firebase.
4. **Quadro de Anúncios Público:** Uma rota de visualização web *read-only* para os irmãos consultarem a programação atualizada no celular sem precisarem de PDF.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React.js + Vite
- **Estilização e UX:** Tailwind CSS + Lucide Icons
- **Backend & Persistência:** Firebase (JSON Tree / Serverless)
- **Integrações:** Google Calendar API
- **Arquitetura Visual:** CSS Print `@media print` nativo para performance e responsividade em impressões.

---

## 📂 Estrutura de Dados (Exemplo)

O sistema utiliza uma estrutura JSON leve e otimizada:

```json
{
  "configuracoes": {
    "nome_cong": "Sua Congregação",
    "horario": "19:30",
    "idioma": "pt"
  },
  "alunos": [
    {
      "id": "uuid",
      "nome": "João Silva",
      "tipo": "anciao",
      "telefone": "5511999999999",
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
4. Configure as chaves do Firebase e do Google Calendar no seu `.env` local.
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
