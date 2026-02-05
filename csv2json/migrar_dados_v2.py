import json
import pandas as pd
from datetime import datetime

# CONFIGURAÇÃO DOS ARQUIVOS
ARQUIVO_CSV = 'Programação Reunião Meio de Semana - Congregação Palmas PR - Designações (1).csv'
ARQUIVO_SAIDA = 'banco_de_dados_atualizado.json'

# Mapeamento de Cargos (CSV -> Chave JSON)
# Nota: 'Irmão Habilitado' (CSV) é mapeado para 'irmao_hab' conforme sua especificação
TYPE_MAP = {
    'Ancião': 'anciao',
    'Servo Ministerial': 'servo',
    'Varão Habilitado': 'irmao_hab',
    'Irmão Habilitado': 'irmao_hab', # Compatibilidade com o CSV atual
    'Irmão': 'irmao',
    'Irmã Experiente': 'irma_exp',
    'Irmã Limitada': 'irma_lim',
    'Irmã': 'irma',
    'Desabilitado': 'desab'
}

def map_part(part_name):
    """
    Normaliza os nomes das partes para o padrão do sistema.
    """
    if not isinstance(part_name, str):
        return ''
    
    p = part_name.strip()
    
    # Remove o prefixo "A-" se existir (ex: A-Discurso -> Discurso)
    clean_p = p[2:] if p.startswith('A-') else p
    
    # Regras de Mapeamento
    if clean_p == 'Leitura':
        return 'leitura'
    # Adicionado 'ExplicandoCrenças' como 'parte' conforme solicitado
    elif clean_p in ['FazendoDiscípulos', 'CultivandoInteresse', 'IniciandoConversas', 'ExplicandoCrenças']:
        return 'parte'
    # Adicionado 'Discurso' explicitamente como 'discurso'
    elif clean_p == 'Discurso':
        return 'discurso'
    elif clean_p == 'Ajudante':
        return 'ajudante'
        
    return clean_p

def format_date(date_str):
    """Converte DD/MM/YYYY para YYYY-MM-DD"""
    if pd.isna(date_str):
        return None
    try:
        return datetime.strptime(str(date_str), '%d/%m/%Y').strftime('%Y-%m-%d')
    except:
        return None

def main():
    print(f"Lendo CSV: {ARQUIVO_CSV}...")
    try:
        # Lê o CSV pulando a primeira linha (cabeçalho de resumo)
        df = pd.read_csv(ARQUIVO_CSV, header=1)
    except FileNotFoundError:
        print("ERRO: Arquivo CSV não encontrado. Verifique o nome.")
        return

    # Estrutura Base Nova (Limpa)
    db = {
        "meta_dados": {
            "versao_sistema": "1.2",
            "data_criacao": datetime.now().strftime("%Y-%m-%d"),
            "congregacao": "Palmas PR" # Padrão
        },
        "configuracoes": {
            "nome_cong": "Palmas PR",
            "idioma": "PT-BR",
            "dia_reuniao": "Quarta-feira",
            "horario": "19:30"
        },
        "historico_reunioes": [], # Começa vazio
        "alunos": []
    }

    new_alunos = []
    student_id = 1

    # Processamento
    for index, row in df.iterrows():
        nome = row['Nomes']
        if pd.isna(nome):
            continue
            
        # Mapear cargo
        tipo_csv = row['Tipo']
        tipo = TYPE_MAP.get(tipo_csv, 'desab')
        
        # Contatos
        email = row['E-mail'] if not pd.isna(row['E-mail']) else ""
        telefone = row['WhatsApp'] if not pd.isna(row['WhatsApp']) else ""
        
        historico = []
        
        # Índices das colunas de histórico (Data, Tipo, Ajudante)
        # Baseado no layout: Data(3), Tipo(4), ..., AjudanteNome(6)
        start_indices = [3, 7, 11, 15, 19, 23, 27]
        
        for i in start_indices:
            if i >= len(df.columns):
                break
                
            date_val = row.iloc[i]
            part_val = row.iloc[i+1] # Coluna Tipo da parte
            helper_val = row.iloc[i+3] # Coluna Nome do Ajudante
            
            formatted_date = format_date(date_val)
            
            if formatted_date and not pd.isna(part_val):
                mapped_part = map_part(part_val)
                helper_name = helper_val if not pd.isna(helper_val) else ""
                
                historico.append({
                    "data": formatted_date,
                    "parte": mapped_part,
                    "ajudante": helper_name
                })
        
        # Ordenar histórico por data (mais recente primeiro)
        historico.sort(key=lambda x: x['data'], reverse=True)

        # Criar Objeto Aluno
        aluno = {
            "id": student_id,
            "nome": nome,
            "tipo": tipo,
            "email": email,
            "telefone": telefone,
            "observacoes": "",
            "historico": historico
        }
        
        new_alunos.append(aluno)
        student_id += 1

    db['alunos'] = new_alunos

    # Salvar JSON
    with open(ARQUIVO_SAIDA, 'w', encoding='utf-8') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)

    print(f"SUCESSO! Novo banco de dados gerado com {len(new_alunos)} alunos.")
    print(f"Arquivo salvo como: {ARQUIVO_SAIDA}")

if __name__ == "__main__":
    main()