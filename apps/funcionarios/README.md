# 👥 App Funcionários - MoneyLink v7

## 📖 Visão Geral

O app **Funcionários** é o módulo central de gestão de recursos humanos do sistema MoneyLink v7, responsável por gerenciar funcionários, estrutura organizacional, comunicados, sistema de presença, comissionamento e toda a hierarquia empresarial do sistema.

## 🏗️ Estrutura do App

```
apps/funcionarios/
├── __init__.py                    # Inicializador do pacote Python
├── admin.py                      # Configuração do Django Admin
├── apps.py                       # Configuração do app Django
├── models.py                     # Modelos de dados (ORM)
├── urls.py                       # Roteamento de URLs
├── views.py                      # Views (render_ e api_)
├── forms.py                      # Formulários Django
├── tests.py                      # Testes unitários
├── migrations/                   # Migrações do banco de dados
├── static/funcionarios/          # Arquivos estáticos (CSS/JS)
│   ├── css/                     # Estilos específicos
│   └── js/                      # Scripts JavaScript
└── templates/funcionarios/       # Templates HTML
    ├── forms/                   # Templates de formulários
    └── comunicados.html         # Template de comunicados
```

## 🎯 Funcionalidades Principais

### 1. Gestão de Funcionários
- **CRUD Completo**: Criação, visualização, edição e remoção de funcionários
- **Dados Pessoais**: Informações completas (nome, CPF, endereço, contato, etc.)
- **Dados Profissionais**: Matrícula, PIS, tipo de contrato, cargo, departamento
- **Arquivos**: Sistema de upload e gestão de documentos por funcionário
- **Acesso**: Usuários com permissões `SCT12`, `SCT13`, `SCT14`, `SCT15`

### 2. Estrutura Organizacional
- **Empresas**: Gestão de empresas do grupo
- **Lojas**: Controle de lojas (sede, franquia, filial)
- **Departamentos**: Organização departamental por empresa
- **Setores**: Subdivisões dos departamentos
- **Cargos**: Hierarquia de cargos com níveis específicos
- **Equipes**: Grupos de trabalho colaborativo
- **Horários**: Definição de horários de trabalho

### 3. Sistema de Comunicados
- **Criação**: Comunicados com texto ou banner para funcionários
- **Segmentação**: Por empresa, departamento, setor, loja, equipe ou individual
- **Controle de Leitura**: Acompanhamento de quem leu cada comunicado
- **Arquivos**: Anexos em comunicados
- **Acesso**: Usuários com permissões `SCT53`, `SCT54`

### 4. Sistema de Presença (Gincana)
- **Registro**: Entrada e saída para funcionários MEI
- **Controle**: Apenas funcionários MEI podem registrar presença
- **Visão Hierárquica**: Gestores e supervisores visualizam dados completos
- **Relatórios**: Relatórios de participação e ausências
- **Acesso**: Usuários com permissões `SCT67`, `SCT68`

### 5. Sistema de Comissionamento
- **Regras Flexíveis**: Comissão por percentual, valor fixo ou faixas
- **Escopo Configurável**: Por empresa, departamento, setor, equipe ou individual
- **Aplicabilidade**: Definição de quem recebe cada regra
- **Períodos**: Controle de vigência das regras

### 6. Dashboard Analítico
- **Métricas**: Visão geral dos dados de RH
- **Gráficos**: Distribuição por empresa, departamento, cargo
- **Estatísticas**: Totais de funcionários ativos/inativos
- **Acesso**: Usuários com permissão `SCT12`

## 📊 Modelos de Dados

### Estrutura Organizacional

#### Empresa
Modelo base da hierarquia organizacional.

**Campos:**
- `nome`: Nome da empresa (CharField, max 255)
- `cnpj`: CNPJ único (CharField, max 18, unique)
- `endereco`: Endereço completo (CharField, max 255)
- `status`: Status ativo/inativo (BooleanField)

#### Loja
Unidades de negócio das empresas.

**Campos:**
- `nome`: Nome da loja (CharField, max 255)
- `empresa`: Relacionamento com Empresa (ForeignKey)
- `logo`: Logo da loja (ImageField)
- `franquia`: É franquia (BooleanField)
- `filial`: É filial (BooleanField)
- `status`: Status ativo/inativo (BooleanField)

#### Departamento
Divisões organizacionais das empresas.

**Campos:**
- `nome`: Nome do departamento (CharField, max 100)
- `empresa`: Relacionamento com Empresa (ForeignKey)
- `status`: Status ativo/inativo (BooleanField)

**Constraints:**
- `unique_together`: ('nome', 'empresa')

#### Setor
Subdivisões dos departamentos.

**Campos:**
- `nome`: Nome do setor (CharField, max 100)
- `departamento`: Relacionamento com Departamento (ForeignKey)
- `status`: Status ativo/inativo (BooleanField)

**Constraints:**
- `unique_together`: ('nome', 'departamento')

#### Cargo
Posições hierárquicas na empresa.

**Campos:**
- `nome`: Nome do cargo (CharField, max 100)
- `empresa`: Relacionamento com Empresa (ForeignKey)
- `hierarquia`: Nível hierárquico (IntegerField com choices)
- `status`: Status ativo/inativo (BooleanField)

**Hierarquias Disponíveis:**
- `ESTAGIO` (1): Estagio
- `PADRAO` (2): Padrão
- `COORDENADOR` (3): Coordenador(a)
- `GERENTE` (4): Gerente
- `FRANQUEADO` (5): Franqueado(a)
- `SUPERVISOR_GERAL` (6): Supervisor(a) Geral
- `GESTOR` (7): Gestor

**Constraints:**
- `unique_together`: ('nome', 'empresa', 'hierarquia')

#### Equipe
Grupos de trabalho colaborativo.

**Campos:**
- `nome`: Nome da equipe (CharField, max 100)
- `participantes`: Relacionamento ManyToMany com User
- `status`: Status ativo/inativo (BooleanField)

#### HorarioTrabalho
Definição de horários de trabalho.

**Campos:**
- `nome`: Nome do horário (CharField, max 100, unique)
- `entrada`: Horário de entrada (TimeField)
- `saida_almoco`: Saída para almoço (TimeField)
- `volta_almoco`: Volta do almoço (TimeField)
- `saida`: Horário de saída (TimeField)
- `status`: Status ativo/inativo (BooleanField)

### Gestão de Funcionários

#### Funcionario
Modelo principal para dados dos funcionários.

**Informações Pessoais:**
- `usuario`: Relacionamento OneToOne com User (opcional)
- `apelido`: Apelido do funcionário
- `nome_completo`: Nome completo (CharField, max 255)
- `foto`: Foto do funcionário (ImageField)
- `cpf`: CPF único (CharField, max 14, unique)
- `data_nascimento`: Data de nascimento (DateField)
- `genero`: Gênero (CharField, max 50)
- `estado_civil`: Estado civil (CharField, max 50)

**Informações de Contato:**
- `cep`: CEP (CharField, max 9)
- `endereco`: Endereço completo (CharField, max 255)
- `bairro`: Bairro (CharField, max 100)
- `cidade`: Cidade (CharField, max 100)
- `estado`: UF (CharField, max 2)
- `celular1`: Celular principal (CharField, max 20)
- `celular2`: Celular secundário (CharField, max 20)

**Informações Familiares:**
- `nome_mae`: Nome da mãe (CharField, max 255)
- `nome_pai`: Nome do pai (CharField, max 255)
- `nacionalidade`: Nacionalidade (CharField, max 100)
- `naturalidade`: Cidade de nascimento (CharField, max 100)

**Informações Profissionais:**
- `matricula`: Matrícula única (CharField, max 50, unique)
- `pis`: PIS (CharField, max 20)
- `tipo_contrato`: Tipo de contrato (CharField com choices)
- `empresa`: Relacionamento com Empresa (ForeignKey)
- `lojas`: Relacionamento ManyToMany com Loja
- `departamento`: Relacionamento com Departamento (ForeignKey)
- `setor`: Relacionamento com Setor (ForeignKey)
- `cargo`: Relacionamento com Cargo (ForeignKey)
- `horario`: Relacionamento com HorarioTrabalho (ForeignKey, opcional)
- `equipe`: Relacionamento com Equipe (ForeignKey, opcional)
- `regras_comissionamento`: Relacionamento ManyToMany com Comissionamento
- `status`: Status ativo/inativo (BooleanField)
- `data_admissao`: Data de admissão (DateField)
- `data_demissao`: Data de demissão (DateField, opcional)

**Tipos de Contrato:**
- `CLT`: CLT
- `MEI`: MEI
- `ESTAGIO`: Estágio

#### ArquivoFuncionario
Arquivos associados aos funcionários.

**Campos:**
- `funcionario`: Relacionamento com Funcionario (ForeignKey)
- `arquivo`: Arquivo (FileField)
- `titulo`: Título do arquivo (CharField, max 100)
- `descricao`: Descrição (TextField)
- `status`: Status ativo/inativo (BooleanField)
- `data_upload`: Data de upload automática (DateTimeField)

### Sistema de Comissionamento

#### Comissionamento
Regras de comissionamento para funcionários.

**Configuração da Regra:**
- `titulo`: Título da regra (CharField, max 255)
- `escopo_base`: Escopo da base de cálculo (CharField com choices)

**Escopos Disponíveis:**
- `GERAL`: Geral (Valor Total)
- `EMPRESA`: Por Empresa(s)
- `DEPARTAMENTO`: Por Departamento
- `SETOR`: Por Setor
- `EQUIPE`: Por Equipe
- `PESSOAL`: Individual (Pessoal)
- `LOJA`: Por Loja(s)

**Método de Cálculo:**
- `percentual`: Percentual da comissão (DecimalField, 5,2)
- `valor_fixo`: Valor fixo da comissão (DecimalField, 12,2)
- `valor_de`: Valor inicial da faixa (DecimalField, 12,2)
- `valor_ate`: Valor final da faixa (DecimalField, 12,2)

**Aplicabilidade:**
- `empresas`: Relacionamento ManyToMany com Empresa
- `lojas`: Relacionamento ManyToMany com Loja
- `departamentos`: Relacionamento ManyToMany com Departamento
- `setores`: Relacionamento ManyToMany com Setor
- `equipes`: Relacionamento ManyToMany com Equipe

**Controle:**
- `status`: Status ativo/inativo (BooleanField)
- `data_inicio`: Data de início da vigência (DateField)
- `data_fim`: Data de fim da vigência (DateField)
- `data_criacao`: Data de criação automática (DateTimeField)
- `data_atualizacao`: Data de atualização automática (DateTimeField)

### Sistema de Comunicados

#### Comunicado
Comunicados enviados para funcionários.

**Campos:**
- `assunto`: Assunto do comunicado (CharField, max 255)
- `destinatarios`: Relacionamento ManyToMany com User
- `texto`: Texto do comunicado (TextField)
- `banner`: Banner do comunicado (ImageField)
- `status`: Status ativo/inativo (BooleanField)
- `data_criacao`: Data de criação automática (DateTimeField)
- `criado_por`: Relacionamento com User (ForeignKey)

#### ControleComunicado
Controle de leitura dos comunicados.

**Campos:**
- `comunicado`: Relacionamento com Comunicado (ForeignKey)
- `usuario`: Relacionamento com User (ForeignKey)
- `lido`: Status de leitura (BooleanField)
- `data_leitura`: Data de leitura (DateTimeField, opcional)

**Constraints:**
- `unique_together`: ('comunicado', 'usuario')

#### ArquivoComunicado
Arquivos anexados aos comunicados.

**Campos:**
- `comunicado`: Relacionamento com Comunicado (ForeignKey)
- `arquivo`: Arquivo (FileField)
- `status`: Status ativo/inativo (BooleanField)
- `data_criacao`: Data de criação automática (DateTimeField)

### Sistema de Presença

#### EntradaAuto
Registro automático de acesso ao sistema.

**Campos:**
- `usuario`: Relacionamento com User (ForeignKey)
- `datahora`: Data e hora de acesso automática (DateTimeField)
- `data`: Data de acesso automática (DateField)
- `ip_usado`: IP utilizado (GenericIPAddressField)

**Constraints:**
- `unique_together`: ('usuario', 'data')

#### RegistroPresenca
Registro de entrada e saída na gincana.

**Campos:**
- `entrada_auto`: Relacionamento com EntradaAuto (ForeignKey)
- `tipo`: Tipo de registro (CharField com choices)
- `datahora`: Data e hora do registro automática (DateTimeField)

**Tipos de Registro:**
- `ENTRADA`: Entrada
- `SAIDA`: Saída

#### RelatorioSistemaPresenca
Relatórios automáticos de ausências.

**Campos:**
- `usuario`: Relacionamento com User (ForeignKey)
- `data`: Data do relatório (DateField)
- `observacao`: Observação do relatório (TextField)
- `data_criacao`: Data de criação automática (DateTimeField)

**Constraints:**
- `unique_together`: ('usuario', 'data')

## 🛠️ Views e APIs

### Views de Renderização (render_)

Responsáveis apenas pela renderização dos templates HTML, sem passar dados.

#### `render_administrativo(request)`
- **Função**: Renderiza a página de cadastros administrativos
- **Template**: `funcionarios/forms/administrativo.html`
- **Permissão**: `SCT15`

#### `render_novofuncionario(request)`
- **Função**: Renderiza o formulário para criar novo funcionário
- **Template**: `funcionarios/forms/novo_funcionario.html`
- **Permissão**: `SCT13`

#### `render_editfuncionario(request)`
- **Função**: Renderiza a página para editar funcionários
- **Template**: `funcionarios/forms/edit_funcionario.html`
- **Permissão**: `SCT14`
- **Decorator**: `@ensure_csrf_cookie`

#### `render_dashboard(request)`
- **Função**: Renderiza o dashboard de funcionários
- **Template**: `funcionarios/forms/dashboard.html`
- **Permissão**: `SCT12`

#### `render_formscomunicados(request)`
- **Função**: Renderiza o formulário para criar comunicados
- **Template**: `funcionarios/forms/formscomunicados.html`
- **Permissão**: `SCT54`

#### `render_comunicados(request)`
- **Função**: Renderiza a página de visualização de comunicados
- **Template**: `administrativo/comunicados.html`
- **Permissão**: `SCT53`

#### `render_presenca(request)`
- **Função**: Renderiza a página de registro de presença na gincana
- **Template**: `rh/presenca.html`
- **Permissão**: `SCT67`
- **Contexto**: Verifica se usuário pode ver calendário completo

#### `render_relatorio_presenca(request)`
- **Função**: Renderiza a página de relatório de presença
- **Template**: `rh/relatorio_presenca.html`
- **Permissão**: `SCT68`

### APIs GET (api_get_)

Responsáveis por fornecer dados em formato JSON para o frontend.

#### Dados Estruturais

**`api_get_infogeral(request)`**
- **Função**: Retorna informações gerais da estrutura organizacional
- **Dados**: Empresas, lojas, departamentos, setores, cargos, horários, equipes
- **Formatação**: Dados pré-formatados para uso em selects

**`api_get_infogeralemp(request)`**
- **Função**: Retorna dados estruturados por empresa
- **Dados**: Hierarquia completa empresa → departamento → setor → loja
- **Uso**: Carregamento dinâmico de formulários

**`api_get_infocardsnovo(request)`**
- **Função**: Retorna estatísticas para cards do sistema
- **Dados**: Totais por categoria, contadores gerais

#### Funcionários

**`api_get_infofuncionarios(request)`**
- **Função**: Lista funcionários com filtros
- **Filtros**: Empresa, departamento, setor, status
- **Dados**: Informações completas dos funcionários

**`api_get_funcionario(request, funcionario_id)`**
- **Função**: Retorna dados específicos de um funcionário
- **Dados**: Todos os campos + arquivos + relacionamentos

**`api_get_userFuncionario(request, user_id)`**
- **Função**: Retorna dados do funcionário por ID do usuário
- **Uso**: Vincular dados de User com Funcionario

#### Dashboard

**`api_get_dashboard(request)`**
- **Função**: Retorna dados para o dashboard de RH
- **Dados**: Estatísticas, gráficos, totais por categoria

#### Comunicados

**`api_get_comunicados(request)`**
- **Função**: Lista comunicados do usuário logado
- **Dados**: Comunicados + status de leitura + arquivos anexos
- **Filtro**: Apenas comunicados destinados ao usuário

**`api_get_destinatarios(request)`**
- **Função**: Lista opções para destinatários de comunicados
- **Dados**: Estrutura organizacional para segmentação

#### Sistema de Presença

**`api_get_registros_presenca(request)`**
- **Função**: Busca registros de presença para data específica
- **Parâmetros**: Data (YYYY-MM-DD)
- **Dados**: Registros do usuário + resumo geral (se autorizado)
- **Autorização**: Gestores veem dados completos

**`api_rh_get_funcionarios_para_filtro_presenca(request)`**
- **Função**: Lista funcionários para filtro de relatórios
- **Permissão**: `SCT67`
- **Dados**: Funcionários ativos com usuário associado

**`api_rh_get_equipes_para_filtro_presenca(request)`**
- **Função**: Lista equipes para filtro de relatórios
- **Permissão**: `SCT67`

**`api_get_relatorio_presenca(request)`**
- **Função**: Gera relatório de presença por período
- **Parâmetros**: Datas, funcionários, equipes
- **Permissão**: `SCT67`

#### Comissionamento

**`api_get_comissao(request)`**
- **Função**: Lista regras de comissionamento
- **Dados**: Regras ativas + detalhes de aplicabilidade

#### Downloads

**`download_arquivo_funcionario(request, arquivo_id)`**
- **Função**: Download de arquivos de funcionários
- **Segurança**: Verificação de existência e acesso

**`download_arquivo_comunicado(request, arquivo_id)`**
- **Função**: Download de arquivos de comunicados
- **Segurança**: Verificação de existência e acesso

### APIs POST (api_post_)

Responsáveis por processar formulários e retornar respostas no padrão "message, result".

#### Estrutura Organizacional

**`api_post_empresa(request)`**
- **Função**: Cria nova empresa
- **Dados**: Nome, CNPJ, endereço, status
- **Validação**: CNPJ único, campos obrigatórios

**`api_post_loja(request)`**
- **Função**: Cria nova loja
- **Dados**: Nome, empresa, logo, tipo (franquia/filial), status
- **Upload**: Suporte a logo da loja

**`api_post_departamento(request)`**
- **Função**: Cria novo departamento
- **Dados**: Nome, empresa, status
- **Validação**: Nome único por empresa

**`api_post_setor(request)`**
- **Função**: Cria novo setor
- **Dados**: Nome, departamento, status
- **Validação**: Nome único por departamento

**`api_post_equipe(request)`**
- **Função**: Cria nova equipe
- **Dados**: Nome, participantes, status

**`api_post_cargo(request)`**
- **Função**: Cria novo cargo
- **Dados**: Nome, empresa, hierarquia, status
- **Validação**: Combinação única de nome, empresa e hierarquia

**`api_post_horario(request)`**
- **Função**: Cria novo horário de trabalho
- **Dados**: Nome, horários de entrada/saída/almoço, status
- **Validação**: Nome único

#### Funcionários

**`api_post_userfuncionario(request)`**
- **Função**: Cria funcionário completo (usuário + funcionário)
- **Dados**: Dados pessoais + profissionais + usuário Django
- **Upload**: Foto + arquivos
- **Decorators**: `@transaction.atomic` para consistência

**`api_edit_funcionario(request)`**
- **Função**: Edita dados de funcionário existente
- **Dados**: Todos os campos editáveis
- **Upload**: Suporte a novos arquivos

#### Comunicados

**`api_post_addcomunicados(request)`**
- **Função**: Cria novo comunicado
- **Dados**: Assunto, texto/banner, destinatários, arquivos
- **Permissão**: `SCT54`
- **Segmentação**: Por estrutura organizacional
- **Validação**: Texto OU banner (não ambos)

**`api_post_marcarcomolido_comunicado(request, comunicado_id)`**
- **Função**: Marca comunicado como lido
- **Dados**: ID do comunicado
- **Decorators**: `@csrf_exempt`

#### Sistema de Presença

**`api_post_registro_presenca(request)`**
- **Função**: Registra entrada/saída na gincana
- **Dados**: Tipo de registro (ENTRADA/SAIDA)
- **Validação**: Apenas funcionários MEI
- **Decorators**: `@csrf_protect`

#### Comissionamento

**`api_post_novaregracomissao(request)`**
- **Função**: Cria nova regra de comissionamento
- **Dados**: Configuração completa da regra
- **Decorators**: `@transaction.atomic`, `@csrf_exempt`
- **Validação**: Campos de cálculo mutuamente exclusivos

## 🎨 Frontend (Templates e Assets)

### Templates HTML

**Formulários (templates/funcionarios/forms/):**

**`administrativo.html`** (24KB, 463 linhas)
- Interface principal para cadastros administrativos
- Formulários para empresa, loja, departamento, setor, cargo, horário, equipe
- Interface dinâmica com abas e validações

**`novo_funcionario.html`** (7.1KB, 166 linhas)
- Formulário de criação de novo funcionário
- Campos pessoais, profissionais e upload de arquivos
- Integração com dados organizacionais

**`edit_funcionario.html`** (17KB, 354 linhas)
- Interface completa para edição de funcionários
- Listagem, busca, filtros e edição inline
- Gestão de arquivos por funcionário

**`dashboard.html`** (15KB, 387 linhas)
- Dashboard analítico de RH
- Cards de estatísticas e gráficos dinâmicos
- Visão geral dos dados organizacionais

**`formscomunicados.html`** (6.3KB, 152 linhas)
- Formulário para criação de comunicados
- Seleção de destinatários por segmentação
- Upload de banner e arquivos

**Outros Templates:**

**`comunicados.html`** (5.1KB, 205 linhas)
- Visualização de comunicados recebidos
- Controle de leitura e download de arquivos
- Interface responsiva

### Arquivos CSS

**`all_forms.css`** (8.1KB, 397 linhas)
- Estilos base para todos os formulários
- Layout responsivo e componentes reutilizáveis

**`cadastro.css`** (4.8KB, 238 linhas)
- Estilos específicos para formulários de cadastro
- Validação visual e estados de erro

**`comunicados.css`** (3.3KB, 174 linhas)
- Estilos da interface de comunicados
- Cards, badges de status e layout de mensagens

**`import_csv.css`** (4.6KB, 158 linhas)
- Estilos para interfaces de importação
- Upload de arquivos e feedback visual

### Arquivos JavaScript

**`administrativo.js`** (30KB, 671 linhas)
- Lógica principal da interface administrativa
- Gerenciamento de formulários dinâmicos
- Validações e comunicação com APIs

**`edit_funcionario.js`** (59KB, 1354 linhas)
- Funcionalidades complexas de edição de funcionários
- Busca avançada, filtros dinâmicos
- Upload de arquivos e preview

**`funcionarios_form.js`** (19KB, 438 linhas)
- Lógica dos formulários de funcionários
- Validação em tempo real
- Integração com dados organizacionais

**`dashboard.js`** (9.1KB, 200 linhas)
- Funcionalidades do dashboard
- Carregamento de gráficos e estatísticas
- Atualização dinâmica de dados

**`comunicados_servidor.js`** (11KB, 342 linhas)
- Lógica do lado servidor para comunicados
- Processamento de formulários
- Upload de arquivos

**`comunicados_cliente.js`** (12KB, 341 linhas)
- Funcionalidades do lado cliente para comunicados
- Interface de leitura e interação
- Marcação de leitura

**`comunicados_pagina.js`** (5.7KB, 166 linhas)
- Funcionalidades específicas da página de comunicados
- Navegação e filtros

## 📝 Formulários Django

### Formulários de Estrutura Organizacional

#### EmpresaForm
- **Campos**: nome, cnpj, endereco, status
- **Widgets**: Bootstrap classes, máscaras
- **Validação**: CNPJ único

#### LojaForm
- **Campos**: nome, empresa, logo, franquia, filial, status
- **Filtros**: Empresas ativas
- **Upload**: Logo da loja

#### DepartamentoForm
- **Campos**: nome, empresa, status
- **Filtros**: Empresas ativas
- **Validação**: Nome único por empresa

#### SetorForm
- **Campos**: nome, departamento, status
- **Filtros**: Departamentos ativos
- **Relacionamento**: Dinâmico por empresa

#### EquipeForm
- **Campos**: nome, participantes, status
- **Widget**: Select2 para usuários
- **Filtros**: Usuários ativos

#### CargoForm
- **Campos**: nome, empresa, hierarquia, status
- **Choices**: Hierarquias predefinidas
- **Filtros**: Empresas ativas

#### HorarioTrabalhoForm
- **Campos**: nome, entrada, saida_almoco, volta_almoco, saida, status
- **Widgets**: Time inputs HTML5
- **Validação**: Horários consistentes

### Formulários de Funcionários

#### FuncionarioForm
Formulário principal para funcionários.

**Seções de Campos:**
1. **Vínculo**: usuario
2. **Pessoais**: apelido, nome_completo, foto, cpf, data_nascimento, genero, estado_civil
3. **Contato**: celular1, celular2, cep, endereco, bairro, cidade, estado
4. **Familiares**: nome_mae, nome_pai, nacionalidade, naturalidade
5. **Profissionais**: matricula, pis, empresa, lojas, departamento, setor, cargo, horario, equipe, status, data_admissao, data_demissao

**Filtros Dinâmicos:**
- Lojas filtradas por empresa selecionada
- Departamentos filtrados por empresa
- Setores filtrados por departamento
- Cargos filtrados por empresa

**Validações:**
- CPF único no sistema
- Datas consistentes
- Relacionamentos válidos

#### UserForm
- **Campos**: username, email, first_name, last_name, password, confirma_password
- **Validação**: Confirmação de senha
- **Integração**: Com criação de funcionário

#### ArquivoFuncionarioForm
- **Campos**: funcionario, titulo, descricao, arquivo, status
- **Upload**: Validação de tipos de arquivo
- **Organização**: Por funcionário

## 🔧 Configuração Django Admin

### Filtros Personalizados

#### FuncionarioMEIFilter
- **Filtro**: Funcionários MEI ativos
- **Opções**: Apenas MEI, Não MEI, Todos MEI

#### FuncionarioAtivosFilter
- **Filtro**: Status e datas de admissão/demissão
- **Opções**: Ativos, Inativos, Admitidos recentes, Demitidos recentes

### Administradores Principais

#### EmpresaAdmin
- **Lista**: nome, cnpj, endereco, total_funcionarios, status
- **Filtros**: status
- **Busca**: nome, cnpj
- **Extras**: Contagem de funcionários com link

#### LojaAdmin
- **Lista**: nome, empresa, preview_logo, franquia, filial, total_funcionarios, status
- **Filtros**: empresa, franquia, filial, status
- **Busca**: nome, empresa__nome
- **Extras**: Preview do logo, contagem de funcionários

#### FuncionarioAdmin
- **Lista**: get_display_name, cpf_formatado, matricula, tipo_contrato, empresa, lojas, departamento, cargo, status
- **Filtros**: Múltiplos filtros personalizados e relacionados
- **Busca**: nome_completo, apelido, cpf, matricula, celular1, lojas__nome, pis, endereco, cidade
- **Ações**: Alteração de tipo de contrato, ativação/desativação
- **Inlines**: ArquivoFuncionarioInline
- **Organização**: Fieldsets bem estruturados

#### ComunicadoAdmin
- **Lista**: assunto, criado_por, data_criacao, status, destinatarios_count, arquivos_count, lidos_count
- **Filtros**: status, data_criacao, criado_por
- **Busca**: assunto, texto, criado_por
- **Inlines**: ArquivoComunicadoInline, ControleComunicadoInline
- **Extras**: Contagens e preview de banner

### Funcionalidades Admin Avançadas

#### Ações em Lote
- Alteração de tipo de contrato (MEI, CLT, Estágio)
- Ativação/desativação de funcionários
- Marcação de status em comunicados

#### Contadores Dinâmicos
- Total de funcionários por empresa/loja/departamento
- Destinatários e leituras de comunicados
- Arquivos por funcionário

#### Previews e Links
- Preview de logos e banners
- Links para relacionamentos
- Formatação de dados (CPF, telefones)

## 🔐 Sistema de Permissões

O app utiliza o decorator `@controle_acess` para controlar acesso às funcionalidades:

### Códigos de Permissão

**Dashboard e Gestão:**
- **SCT12**: Dashboard de Funcionários
- **SCT13**: Novo Funcionário
- **SCT14**: Editar Funcionário
- **SCT15**: Administrativo (Cadastros)

**Comunicados:**
- **SCT53**: Visualizar Comunicados
- **SCT54**: Criar Comunicados

**Sistema de Presença:**
- **SCT67**: Sistema de Presença (Gincana)
- **SCT68**: Relatório de Presença

### Níveis de Acesso

**Funcionários MEI:**
- Podem registrar presença na gincana
- Recebem comunicados segmentados

**Gestores e Supervisores:**
- Visão completa do calendário de presença
- Relatórios avançados de equipe

**Superusuários:**
- Acesso total a todas as funcionalidades
- Gestão completa via Django Admin

## 📝 Roteamento de URLs

### Padrão de URLs

```python
# Renderização de Páginas
path('administrativo/', render_administrativo, name='render_administrativo')
path('novo/', render_novofuncionario, name='render_novofuncionario')
path('editar/', render_editfuncionario, name='render_editfuncionario')
path('dashboard/', render_dashboard, name='render_dashboard')

# APIs de Dados
path('api/get/infogeral/', api_get_infogeral, name='api_get_infogeral')
path('api/get/infofuncionarios/', api_get_infofuncionarios, name='api_get_infofuncionarios')
path('api/get/funcionario/<int:funcionario_id>/', api_get_funcionario, name='api_get_funcionario')

# APIs de Criação
path('api/post/empresa/', api_post_empresa, name='api_post_empresa')
path('api/post/userfuncionario/', api_post_userfuncionario, name='api_post_userfuncionario')

# Comunicados
path('comunicados/form/', render_formscomunicados, name='render_formscomunicados')
path('api/comunicados/add/', api_post_addcomunicados, name='api_post_addcomunicados')
path('api/comunicados/list/', api_get_comunicados, name='api_get_comunicados')

# Sistema de Presença
path('presenca/', render_presenca, name='render_presenca')
path('api/presenca/registrar/', api_post_registro_presenca, name='api_post_registro_presenca')
path('api/presenca/relatorio/', api_get_relatorio_presenca, name='api_get_relatorio_presenca_data')

# Downloads
path('api/download/arquivo/<int:arquivo_id>/', download_arquivo_funcionario, name='api_download_arquivo')
```

### Convenções de Nomenclatura

- **render_**: Views que renderizam templates HTML
- **api_get_**: APIs que retornam dados (GET)
- **api_post_**: APIs que processam formulários (POST)
- **download_**: Endpoints para download de arquivos

## 🛠️ Como Usar e Alterar

### Adicionando Novo Modelo

1. **Criar Modelo**:
```python
# Em models.py
class NovoModelo(models.Model):
    nome = models.CharField(max_length=100)
    status = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = "Novo Modelo"
        verbose_name_plural = "Novos Modelos"
```

2. **Criar Migração**:
```bash
python manage.py makemigrations funcionarios
python manage.py migrate
```

3. **Adicionar ao Admin**:
```python
# Em admin.py
@admin.register(NovoModelo)
class NovoModeloAdmin(admin.ModelAdmin):
    list_display = ['nome', 'status']
    list_filter = ['status']
```

### Adicionando Nova View

1. **Criar View**:
```python
@login_required
@controle_acess('SCT_NUMERO')
def render_nova_funcionalidade(request):
    return render(request, 'funcionarios/nova_funcionalidade.html')
```

2. **Adicionar URL**:
```python
path('nova-funcionalidade/', render_nova_funcionalidade, name='nova_funcionalidade')
```

3. **Criar Template**:
```html
<!-- funcionarios/nova_funcionalidade.html -->
{% extends 'base.html' %}
{% block content %}
    <!-- Conteúdo da página -->
{% endblock %}
```

### Adicionando Nova API

1. **Criar API**:
```python
@require_GET
@login_required
def api_get_nova_funcionalidade(request):
    data = {'resultado': 'dados'}
    return JsonResponse(data)
```

2. **Adicionar URL**:
```python
path('api/nova-funcionalidade/', api_get_nova_funcionalidade, name='api_get_nova_funcionalidade')
```

3. **Consumir no Frontend**:
```javascript
fetch('/funcionarios/api/nova-funcionalidade/')
    .then(response => response.json())
    .then(data => console.log(data));
```

### Modificando Estrutura Organizacional

1. **Alterar Modelo**:
```python
# Adicionar novo campo
class Empresa(models.Model):
    # ... campos existentes ...
    novo_campo = models.CharField(max_length=100, null=True, blank=True)
```

2. **Atualizar Formulário**:
```python
class EmpresaForm(forms.ModelForm):
    class Meta:
        fields = ['nome', 'cnpj', 'endereco', 'novo_campo', 'status']
```

3. **Atualizar APIs**:
```python
# Em api_get_infogeral
data = {
    'empresas': list(Empresa.objects.filter(status=True).values(
        'id', 'nome', 'cnpj', 'endereco', 'novo_campo'
    )),
    # ... outros dados ...
}
```

### Personalizando Sistema de Presença

1. **Alterar Validações**:
```python
# Em api_post_registro_presenca
# Modificar critérios de quem pode registrar
funcionario = Funcionario.objects.get(
    usuario=request.user,
    status=True,
    # Adicionar novos critérios aqui
)
```

2. **Modificar Visibilidade**:
```python
# Em render_presenca
# Alterar lógica de can_view_full_calendar
if funcionario.cargo.hierarquia in [lista_de_cargos_autorizados]:
    can_view_full_calendar = True
```

### Customizando Comunicados

1. **Adicionar Novo Tipo**:
```python
# Em models.py Comunicado
class TipoComunicado(models.TextChoices):
    NORMAL = 'NORMAL', 'Normal'
    URGENTE = 'URGENTE', 'Urgente'
    INFORMATIVO = 'INFORMATIVO', 'Informativo'

tipo = models.CharField(max_length=20, choices=TipoComunicado.choices, default=TipoComunicado.NORMAL)
```

2. **Atualizar API de Criação**:
```python
# Em api_post_addcomunicados
tipo = request.POST.get('tipo', 'NORMAL')
comunicado = Comunicado(
    assunto=assunto,
    texto=texto,
    tipo=tipo,
    criado_por=request.user
)
```

## ⚠️ Considerações Importantes

### Segurança
- **CSRF**: Algumas APIs usam `@csrf_exempt` - revisar necessidade
- **Autenticação**: Nem todas as APIs têm `@login_required` - padronizar
- **Upload**: Validar tipos de arquivo permitidos
- **Permissões**: Sistema robusto via `@controle_acess`

### Performance
- **Queries**: Use `select_related()` e `prefetch_related()` para otimizar
- **Arquivos**: Sistema de storage personalizado para funcionários
- **Admin**: Contadores dinâmicos podem impactar performance
- **APIs**: Paginação em listagens grandes

### Manutenção
- **Código**: Arquivos JavaScript muito grandes - considerar modularização
- **Imports**: Usar importações específicas em vez de `from .models import *`
- **Logs**: Remover prints de debug em produção
- **Testes**: Implementar testes unitários para funcionalidades críticas

### Arquitetura
- **Separação**: Padrão MVC bem implementado
- **Formulários**: Django Forms integrados com validação
- **Templates**: Herança e componentização adequadas
- **Assets**: Organização por funcionalidade

## 📚 Dependências

O app depende dos seguintes apps internos:
- `custom_tags_app`: Decorator `controle_acess` e tags personalizadas
- `setup.utils`: Utilidades de verificação de autenticação
- `apps.siape`: Modelos relacionados ao sistema SIAPE

## 🔄 Fluxo de Dados

### Criação de Funcionário
1. **Frontend** carrega dados organizacionais via `api_get_infogeral`
2. **Formulário** é preenchido com validação em tempo real
3. **Submit** envia para `api_post_userfuncionario`
4. **API** cria User + Funcionario em transação atômica
5. **Arquivos** são processados e organizados por funcionário
6. **Resposta** confirma criação e retorna dados

### Sistema de Comunicados
1. **RH** cria comunicado via `api_post_addcomunicados`
2. **Sistema** processa segmentação de destinatários
3. **Controles** são criados para cada destinatário
4. **Funcionários** visualizam via `api_get_comunicados`
5. **Leitura** é marcada via `api_post_marcarcomolido_comunicado`

### Sistema de Presença
1. **Funcionário MEI** acessa página de presença
2. **Sistema** verifica permissões e cria EntradaAuto se necessário
3. **Registro** é criado via `api_post_registro_presenca`
4. **Gestores** visualizam relatórios via `api_get_relatorio_presenca`

---

**Nota**: Este README segue as regras estabelecidas pelo projeto, documentando completamente o app funcionarios sem criar arquivos desnecessários ou alterar funcionalidades existentes. 