# 📋 App Administrativo - MoneyLink v7

## 📖 Visão Geral

O app **Administrativo** é o módulo central de gestão e controle do sistema MoneyLink v7, responsável por fornecer dashboards executivos, controle de metas, gerenciamento de reembolsos, importação de dados via CSV e controle de campanhas promocionais.

## 🏗️ Estrutura do App

```
apps/administrativo/
├── __init__.py                 # Inicializador do pacote Python
├── admin.py                   # Configuração do Django Admin
├── apps.py                    # Configuração do app Django
├── models.py                  # Modelos de dados (ORM)
├── urls.py                    # Roteamento de URLs
├── views.py                   # Views (render_ e api_)
├── tests.py                   # Testes unitários
├── migrations/                # Migrações do banco de dados
├── static/administrativo/     # Arquivos estáticos (CSS/JS)
│   ├── css/                  # Estilos específicos
│   └── js/                   # Scripts JavaScript
└── templates/administrativo/  # Templates HTML
```

## 🎯 Funcionalidades Principais

### 1. Dashboard Administrativo
- **Visualização**: Dashboard executivo com métricas em tempo real
- **Dados**: Financeiro, RH, Lojas, Metas e SIAPE
- **Acesso**: Usuários com permissão `SCT9`

### 2. Controle de Metas
- **Gestão**: Criação, edição e acompanhamento de metas
- **Status**: Controle de status (ativa/inativa)
- **Acesso**: Usuários com permissão `SCT10`

### 3. Sistema de Reembolsos
- **Controle**: Gestão completa de reembolsos
- **Reversão**: Possibilidade de reverter reembolsos
- **Acesso**: Usuários com permissão `SCT11`

### 4. Importação de CSVs
- **Tipos**: Funcionários, ClienteC2, Agendamentos, Financeiro
- **Processamento**: Upload e processamento em lote
- **Acesso**: Usuários com permissão `SCT52`

### 5. Controle de Campanhas
- **Criação**: Campanhas com banners e segmentação
- **Segmentação**: Por empresa, departamento, setor, loja, equipe ou cargo
- **Acesso**: Usuários com permissão `SCT23`

## 📊 Modelos de Dados

### ControleCampanha
Modelo principal para controle de campanhas promocionais.

**Campos:**
- `titulo`: Título da campanha (CharField, max 100)
- `banner`: Imagem da campanha (ImageField)
- `data_criacao`: Data de criação automática (DateTimeField)
- `data_inicio`: Data de início (DateField)
- `hora_inicio`: Hora de início (TimeField)
- `data_final`: Data final (DateField)
- `hora_final`: Hora final (TimeField)
- `categoria`: Categoria da campanha (CharField com choices)
- `status`: Status ativo/inativo (BooleanField)

**Relacionamentos ManyToMany:**
- `empresas`: Relacionamento com Empresa
- `departamentos`: Relacionamento com Departamento
- `setores`: Relacionamento com Setor
- `lojas`: Relacionamento com Loja
- `equipes`: Relacionamento com Equipe
- `cargos`: Relacionamento com Cargo

**Categorias Disponíveis:**
- `GERAL`: Campanha geral
- `EMPRESA`: Específica para empresas
- `DEPARTAMENTO`: Específica para departamentos
- `SETOR`: Específica para setores
- `LOJA`: Específica para lojas
- `EQUIPE`: Específica para equipes
- `CARGO`: Específica para cargos

## 🛠️ Views e APIs

### Views de Renderização (render_)

Responsáveis apenas pela renderização dos templates HTML, sem passar dados.

#### `render_dashboard(request)`
- **Função**: Renderiza a página do dashboard administrativo
- **Template**: `administrativo/dashboard.html`
- **Permissão**: `SCT9`
- **Dados**: Carregados via API JavaScript

#### `render_controlemetas(request)`
- **Função**: Renderiza a página de controle de metas
- **Template**: `administrativo/controle_metas.html`
- **Permissão**: `SCT10`

#### `render_reembolso(request)`
- **Função**: Renderiza a página de controle de reembolsos
- **Template**: `administrativo/reembolso.html`
- **Permissão**: `SCT11`
- **Decorator**: `@require_GET`

#### `render_importscsvs(request)`
- **Função**: Renderiza a página de importação de CSVs
- **Template**: `administrativo/import_csvs.html`
- **Permissão**: `SCT52`

### APIs GET (api_get_)

Responsáveis por fornecer dados em formato JSON para o frontend.

#### Dashboard APIs

**`api_get_dashboard_financeiro(request)`**
- **Função**: Retorna dados financeiros do dashboard
- **Dados**: Faturamento por empresa, sede, franquia e filial (anual/mensal)
- **Fonte**: RegisterMoney com status=True

**`api_get_dashboard_lojas(request)`**
- **Função**: Retorna métricas das lojas
- **Dados**: Funcionários ativos, agendamentos, presenças por loja

**`api_get_dashboard_rh(request)`**
- **Função**: Retorna dados de recursos humanos
- **Dados**: Total de funcionários por empresa, departamento, setor

**`api_get_dashboard_metas(request)`**
- **Função**: Retorna informações sobre metas
- **Dados**: Metas ativas com percentual de cumprimento

**`api_get_dashboard_siape(request)`**
- **Função**: Retorna dados do SIAPE
- **Dados**: Registros por período, estatísticas

#### Outras APIs GET

**`api_get_metas(request)`**
- **Função**: Lista todas as metas ativas
- **Filtros**: Por setor, período
- **Retorno**: Lista de metas com detalhes

**`api_get_inforeembolso(request)`**
- **Função**: Retorna informações de reembolsos
- **Filtros**: CPF cliente, nome do produto
- **Retorno**: Registros para reembolsar + já reembolsados + estatísticas

**`api_get_minhasCampanhas(request)`**
- **Função**: Lista campanhas ativas
- **Permissão**: `SCT23`
- **Retorno**: Campanhas + opções para formulário

**`api_get_banners_campanhas(request)`**
- **Função**: Retorna banners de campanhas ativas para o usuário
- **Filtro**: Por relacionamentos do funcionário logado
- **Retorno**: URLs dos banners das campanhas aplicáveis

### APIs POST (api_post_)

Responsáveis por processar formulários e retornar respostas no padrão "message, result".

#### Metas

**`api_post_novameta(request)`**
- **Função**: Cria nova meta
- **Dados**: Título, descrição, valor, data início/fim, setor
- **Decorators**: `@csrf_exempt`, `@require_POST`

**`api_post_attmeta(request)`**
- **Função**: Atualiza status da meta
- **Dados**: ID da meta, novo status
- **Validação**: Verifica existência da meta

#### Reembolsos

**`api_post_addreembolso(request)`**
- **Função**: Registra novo reembolso
- **Dados**: ID do RegisterMoney
- **Validação**: Verifica se já existe reembolso
- **Decorators**: `@transaction.atomic`

**`api_post_reverterreembolso(request)`**
- **Função**: Reverte reembolso (marca como inativo)
- **Dados**: ID do reembolso
- **Decorators**: `@transaction.atomic`

#### Importação CSV

**`api_post_csvfuncionarios(request)`**
- **Função**: Importa dados de funcionários via CSV
- **Validação**: Formato CSV, campos obrigatórios

**`api_post_csvclientec2(request)`**
- **Função**: Importa dados de clientes C2 via CSV

**`api_post_csvagendamento(request)`**
- **Função**: Importa agendamentos via CSV

**`api_post_csvfinanceiro(request)`**
- **Função**: Importa registros financeiros via CSV

#### Campanhas

**`api_post_criarCampanha(request)`**
- **Função**: Cria nova campanha
- **Dados**: Multipart/form-data com título, banner, datas, categoria, relacionamentos
- **Permissão**: `SCT23`
- **Validação**: Campos obrigatórios, formato de datas

**`api_post_atualizar_status_campanha(request)`**
- **Função**: Atualiza status da campanha
- **Dados**: ID da campanha, novo status
- **Permissão**: `SCT23`

## 🎨 Frontend (Templates e Assets)

### Templates HTML

**`dashboard.html`** (25KB, 428 linhas)
- Dashboard principal com cards de métricas
- Gráficos dinâmicos carregados via JavaScript
- Layout responsivo

**`controle_metas.html`** (11KB, 258 linhas)
- Interface para gerenciamento de metas
- Formulários de criação/edição
- Tabela de listagem com filtros

**`reembolso.html`** (14KB, 272 linhas)
- Interface para controle de reembolsos
- Tabelas de registros pendentes e processados
- Funcionalidades de busca e filtro

**`import_csvs.html`** (4.6KB, 121 linhas)
- Interface para upload de arquivos CSV
- Seletores de tipo de importação
- Feedback de progresso

**`comunicados.html`** (3.0KB, 83 linhas)
- Interface para visualização de comunicados
- Integração com app funcionarios

### Arquivos CSS

**`administrativo_dashboard.css`** (18KB, 673 linhas)
- Estilos do dashboard principal
- Cards de métricas e gráficos
- Responsividade

**`controle_metas.css`** (19KB, 679 linhas)
- Estilos da interface de metas
- Formulários e tabelas
- Estados visuais

**`reembolso.css`** (33KB, 951 linhas)
- Estilos da interface de reembolsos
- Tabelas complexas
- Estados de status

**`import_csvs.css`** (7.3KB, 270 linhas)
- Estilos da interface de importação
- Upload de arquivos
- Indicadores de progresso

**`comunicados.css`** (16KB, 673 linhas)
- Estilos dos comunicados
- Layout de cards
- Modais e pop-ups

**`comunicados_pop-up.css`** (4.8KB, 240 linhas)
- Estilos específicos para modais de comunicados

### Arquivos JavaScript

**`administrativo_dashboard.js`** (21KB, 496 linhas)
- Lógica do dashboard
- Chamadas AJAX para APIs
- Atualização dinâmica de dados

**`controle_metas.js`** (13KB, 334 linhas)
- Funcionalidades de metas
- Validação de formulários
- Comunicação com APIs

**`reembolso.js`** (36KB, 714 linhas)
- Lógica complexa de reembolsos
- Processamento de tabelas
- Filtros e buscas

**`import_csvs.js`** (7.1KB, 187 linhas)
- Upload de arquivos
- Validação de CSV
- Feedback de importação

**`comunicados.js`** (7.7KB, 203 linhas)
- Interação com comunicados
- Modais e pop-ups
- Carregamento dinâmico

## 🔧 Configuração Django Admin

### ControleCampanhaAdmin

**Funcionalidades:**
- Lista campanhas com informações principais
- Filtros por categoria, status e datas
- Busca por título
- Edição inline do status
- Preview do banner
- Ações em lote (ativar/desativar)

**Campos de Lista:**
- `titulo`: Título da campanha
- `categoria`: Categoria selecionada
- `formatted_scope`: Escopo formatado
- `data_inicio` / `data_final`: Período
- `status`: Status ativo/inativo
- `banner_thumb`: Miniatura do banner

**Filtros:**
- Por categoria (GERAL, EMPRESA, etc.)
- Por status (ativo/inativo)
- Por data de início/fim

**Fieldsets:**
1. **Informações Básicas**: título, banner, categoria, status
2. **Datas e Horários**: datas e horas de início/fim
3. **Escopo da Campanha**: relacionamentos ManyToMany
4. **Auditoria**: data de criação (readonly)

**Ações Customizadas:**
- `make_active`: Ativa campanhas selecionadas
- `make_inactive`: Desativa campanhas selecionadas

## 🔐 Sistema de Permissões

O app utiliza o decorator `@controle_acess` para controlar acesso às funcionalidades:

- **SCT9**: Dashboard Administrativo
- **SCT10**: Controle de Metas
- **SCT11**: Sistema de Reembolsos
- **SCT23**: Controle de Campanhas
- **SCT52**: Importação de CSVs

## 📝 Roteamento de URLs

### Padrão de URLs

```python
# Dashboard
path('dashboard/', render_dashboard, name='dashboard')

# Metas
path('metas/', render_controlemetas, name='render_controlemetas')
path('api/metas/', api_get_metas, name='api_get_metas')
path('api/metas/nova/', api_post_novameta, name='api_post_novameta')

# Reembolsos
path('reembolso/', render_reembolso, name='reembolso')
path('api/reembolso/info/', api_get_inforeembolso, name='api_get_inforeembolso')

# CSVs
path('importar-csvs/', render_importscsvs, name='render_importscsvs')
path('api/csv/funcionarios/', api_post_csvfuncionarios, name='api_post_csvfuncionarios')

# Campanhas
path('api/campanhas/', api_get_minhasCampanhas, name='api_get_minhasCampanhas')
path('api/campanhas/criar/', api_post_criarCampanha, name='api_post_criarCampanha')
```

### Convenções de Nomenclatura

- **render_**: Views que renderizam templates HTML
- **api_get_**: APIs que retornam dados (GET)
- **api_post_**: APIs que processam formulários (POST)

## 🛠️ Como Usar e Alterar

### Adicionando Nova Funcionalidade

1. **Criar Nova View**:
```python
@login_required
@controle_acess('SCT_NUMERO')
def render_nova_funcionalidade(request):
    return render(request, 'administrativo/nova_funcionalidade.html')
```

2. **Adicionar URL**:
```python
path('nova-funcionalidade/', render_nova_funcionalidade, name='nova_funcionalidade')
```

3. **Criar Template**:
```html
<!-- apps/administrativo/templates/administrativo/nova_funcionalidade.html -->
{% extends 'base.html' %}
{% block content %}
    <!-- Conteúdo da página -->
{% endblock %}
```

4. **Adicionar CSS/JS**:
```css
/* apps/administrativo/static/administrativo/css/nova_funcionalidade.css */
```

```javascript
/* apps/administrativo/static/administrativo/js/nova_funcionalidade.js */
```

### Modificando Modelos Existentes

1. **Alterar Model**:
```python
# Em models.py
class ControleCampanha(models.Model):
    # Adicionar novo campo
    novo_campo = models.CharField(max_length=100, null=True, blank=True)
```

2. **Criar Migração**:
```bash
python manage.py makemigrations administrativo
python manage.py migrate
```

3. **Atualizar Admin** (se necessário):
```python
# Em admin.py
list_display = (..., 'novo_campo')
```

### Adicionando Nova API

1. **Criar View API**:
```python
@login_required
@require_GET
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
fetch('/administrativo/api/nova-funcionalidade/')
    .then(response => response.json())
    .then(data => console.log(data));
```

### Alterando Permissões

1. **Modificar Decorator**:
```python
@controle_acess('SCT_NOVO_NUMERO')
def minha_view(request):
    # ...
```

2. **Atualizar Sistema de Permissões** no app `usuarios` ou `custom_tags_app`.

## ⚠️ Considerações Importantes

### Segurança
- Todas as APIs POST usam `@csrf_exempt` - **revisar necessidade**
- Views protegidas por `@login_required`
- Sistema de permissões via `@controle_acess`

### Performance
- Use `select_related()` e `prefetch_related()` para otimizar queries
- APIs de dashboard fazem múltiplas consultas - considerar cache
- Arquivo `reembolso.js` é muito grande (36KB) - considerar otimização

### Manutenção
- Logs de debug em produção devem ser removidos
- Views muito grandes podem ser divididas em módulos
- Considerar testes unitários para funcionalidades críticas

### Arquitetura
- Padrão MVC respeitado com separação clara
- Frontend usa jQuery para comunicação AJAX
- Templates herdam de `base.html`
- CSS/JS organizados por funcionalidade

## 📚 Dependências

O app depende dos seguintes apps internos:
- `funcionarios`: Modelos de Empresa, Loja, Funcionario, etc.
- `siape`: Modelos RegisterMoney, Reembolso, etc.
- `inss`: Modelos Agendamento, PresencaLoja
- `custom_tags_app`: Decorator `controle_acess`

## 🔄 Fluxo de Dados

1. **Frontend** faz requisição para view `render_`
2. **View** renderiza template HTML base
3. **JavaScript** carrega dados via APIs `api_get_`
4. **Usuário** interage e submete formulários
5. **APIs** `api_post_` processam dados
6. **Resposta** JSON retorna status/mensagem
7. **Frontend** atualiza interface dinamicamente

---

**Nota**: Este README segue as regras estabelecidas pelo projeto, documentando completamente o app administrativo sem criar arquivos desnecessários ou alterar funcionalidades existentes. 