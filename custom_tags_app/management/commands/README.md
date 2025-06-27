# Scripts de Gerenciamento de Banco de Dados SQLite

Este documento fornece instruções detalhadas sobre scripts de gerenciamento para limpeza e transferência de dados em bancos SQLite. Os scripts foram desenvolvidos para facilitar a manutenção e migração de dados entre diferentes instâncias do sistema.

## Desenvolvedor
Desenvolvido por: llongaray77

## 1. Limpeza de Débitos (limpar_debitos.py)

Script para limpar registros das tabelas `DebitoMargem`, `Cliente` e `InformacoesPessoais` de forma segura e controlada.

### Modelos Necessários:
- `DebitoMargem`: Tabela principal que será limpa
- `Cliente`: Informações cadastrais dos clientes
- `InformacoesPessoais`: Dados pessoais dos clientes

### Como Executar:
```bash
python manage.py limpar_debitos [opções]
```

### Opções Disponíveis:
- `--backup`: Cria backup em CSV antes da limpeza
- `--force`: Executa sem pedir confirmação

### Exemplos:
1. Com backup:
```bash
python manage.py limpar_debitos --backup
```

2. Forçar execução:
```bash
python manage.py limpar_debitos --force
```

## 2. Transferência de Débitos (transferir_debitos.py)

Script para transferir dados completos entre dois bancos SQLite diferentes, mantendo relacionamentos e integridade dos dados.

### Modelos Necessários:
- `InformacoesPessoais`: Dados pessoais dos clientes
- `Cliente`: Informações cadastrais
- `DebitoMargem`: Registros de débitos
- `Campanha`: Informações de campanhas

### Como Executar:
```bash
python manage.py transferir_debitos --origem /path/origem.sqlite3 --destino /path/destino.sqlite3 [opções]
```

### Opções Disponíveis:
- `--origem`: (Obrigatório) Caminho do banco de origem
- `--destino`: (Obrigatório) Caminho do banco de destino
- `--force`: Executa sem confirmação
- `--log`: Gera arquivo de log

### Exemplos:
1. Transferência básica:
```bash
python manage.py transferir_debitos --origem /dados/db1.sqlite3 --destino /dados/db2.sqlite3
```

2. Com log:
```bash
python manage.py transferir_debitos --origem /dados/db1.sqlite3 --destino /dados/db2.sqlite3 --log
```

## Conclusão

Estes scripts foram desenvolvidos para facilitar a manutenção e migração de dados do sistema. A limpeza de débitos permite uma gestão eficiente dos registros, enquanto a transferência possibilita a migração segura entre diferentes bancos de dados. Ambos os scripts incluem medidas de segurança como confirmações de usuário, backups opcionais e logs detalhados.

Para garantir o uso correto, sempre verifique as dependências necessárias e faça backups antes de executar operações de limpeza ou transferência. Em caso de dúvidas ou problemas, consulte os logs gerados ou entre em contato com o desenvolvedor.
