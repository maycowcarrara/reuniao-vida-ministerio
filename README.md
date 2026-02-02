
# 📅 Gerenciador da Reunião Vida e Ministério

> Um sistema intuitivo, local e focado em privacidade para auxiliar o Superintendente da Reunião Vida e Ministério na gestão de designações, notificações e impressão de programações.

[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🎯 Objetivo do Projeto

Desenvolver uma ferramenta que rode localmente (sem necessidade de servidores complexos ou banco de dados na nuvem), utilizando arquivos simples (JSON/TXT), garantindo que **usuários leigos** possam operar o sistema com facilidade. O foco é a **Experiência do Usuário (UX)**, automação de tarefas repetitivas e flexibilidade na impressão.

---

## ✨ Funcionalidades Principais

### 🏢 Gestão da Congregação

- **Configuração Simples:** Cadastro do nome da congregação, dia e horário da reunião.
- **Multi-idioma:** Suporte inicial para Português, preparado para expansão (i18n).

### 👥 Gestão de Alunos

- **Cadastro Completo:** Nome, telefone, e-mail e privilégios (Servo Ministerial, Ancião, Publicador).
- **Histórico Inteligente:**
  - Visualização rápida de quantos dias faz que o aluno não recebe uma parte.
  - Histórico das designações do último ano.
  - Identificação visual de quem pode ser Ajudante ou Leitor.

### 📅 Programação e Designações

- **Importação Flexível:**
  - Importação via "Copiar e Colar" da programação do site JW.org.
  - *(Futuro)* Crawler para buscar a programação automaticamente.
- **Encaixe Inteligente:** Interface visual para alocar alunos nas partes (Tesouros, Faça Seu Melhor, Nossa Vida Cristã).

### 📢 Notificações (Faça seu Melhor)

- **WhatsApp:** Geração automática de mensagens com link direto (`wa.me`) para envio em um clique.
- **E-mail:** Integração via `mailto` ou API para envio direto das designações.

### 🖨️ Impressão e Quadro de Anúncios

O sistema gera PDFs prontos para impressão em folha A4 com dois layouts distintos:

1. **Layout Padrão (Fiel ao PDF):** Estilo visual semelhante às planilhas tradicionais, com cores e formatação oficial, 2 semanas por página.
2. **Layout Condensado (Econômico):** Versão simplificada que agrupa 4 a 5 semanas em uma única folha A4, ideal para economia de papel e visualização rápida.

---

## 🚀 Inovações e Melhorias (Roadmap)

Como diferencial, este projeto visa implementar:

1. **Sugestão Algorítmica:** O sistema sugerirá automaticamente o melhor aluno para a parte, baseando-se na data da última designação e no tipo de estudante, evitando repetições e favorecendo o rodízio justo.
2. **Validação de Conflitos:** Alertas visuais se um aluno for designado para duas partes no mesmo dia ou em datas muito próximas.
3. **Backup Automático:** Exportação fácil de todo o banco de dados (JSON) para que o usuário não perca seus dados se trocar de computador.
4. **Modo PWA (Progressive Web App):** Permitir que o sistema seja instalado no computador como um aplicativo nativo, funcionando offline.
5. **Interface "Drag and Drop":** Arrastar alunos da lista lateral diretamente para a parte na programação da semana.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend:** React.js
- **Build Tool:** Vite
- **Estilização:** CSS Modules / Tailwind (foco em impressão `@media print`)
- **Persistência de Dados:** LocalStorage e File System Access API (JSON local)
- **Geração de PDF:** CSS Print nativo (para máxima compatibilidade e leveza)

---

## 📂 Estrutura de Arquivos (Dados)

O sistema utiliza uma estrutura de dados simples baseada em JSON para facilitar a portabilidade:

```json
{
  "congregacao": { ... },
  "alunos": [
    {
      "id": "uuid",
      "nome": "João Silva",
      "contato": { "celular": "...", "email": "..." },
      "privilegios": ["leitor", "ajudante"],
      "historico": [ { "data": "2023-10-10", "parte": "Leitura da Bíblia" } ]
    }
  ],
  "programacao": [ ... ]
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
4. Rode o projeto:
   **Bash**

   ```
   npm run dev
   ```

---

## 🤝 Contribuição

Contribuições são bem-vindas! Sinta-se à vontade para abrir issues relatando bugs ou sugerindo novas funcionalidades baseadas na experiência real de uso nas congregações.

---

**Nota:** Este software não é uma ferramenta oficial da Watch Tower Bible and Tract Society of Pennsylvania. É uma ferramenta auxiliar desenvolvida por voluntários para uso pessoal e local.
