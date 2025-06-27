from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.core.exceptions import ValidationError
from decimal import Decimal
from .models import (
    Campanha, Cliente, Debito, Produto, RegisterMoney, RegisterMeta,
    AgendamentoFichaCliente, Reembolso, TabulacaoAgendamento,
    HistoricoTabulacaoAgendamento, DocumentoCliente, TelefoneCliente,
    DadosNegociacao, ArquivoNegociacao, HorarioChecagem
)

# Importações auxiliares
try:
    from apps.funcionarios.models import Funcionario
except ImportError:
    Funcionario = None

# Filtros personalizados para TabulacaoAgendamento
class StatusTabulacaoFilter(admin.SimpleListFilter):
    title = 'Status da Tabulação'
    parameter_name = 'status_tabulacao'

    def lookups(self, request, model_admin):
        return (
            ('SEM_RESPOSTA', 'Sem Resposta'),
            ('EM_NEGOCIACAO', 'Em Negociação'),
            ('REVERSAO', 'Reversão'),
            ('REVERTIDO', 'Revertido'),
            ('DESISTIU', 'Desistiu'),
            ('CHECAGEM', 'Checagem'),
            ('CHECAGEM_OK', 'Checagem OK'),
            ('ALTO_RISCO', 'Alto Risco'),
            ('CONCLUIDO_PG', 'Concluído PG'),
        )

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(status=self.value())

class StatusAgendamentoFilter(admin.SimpleListFilter):
    title = 'Status do Agendamento'
    parameter_name = 'status_agendamento'

    def lookups(self, request, model_admin):
        return (
            ('AGENDADO', 'Agendado'),
            ('CONFIRMADO', 'Confirmado'),
            ('FECHOU', 'Fechou negócio'),
            ('NAO_QUIS', 'Não quis'),
        )

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(agendamento__status=self.value())

class UFClienteFilter(admin.SimpleListFilter):
    title = 'UF do Cliente'
    parameter_name = 'uf_cliente'

    def lookups(self, request, model_admin):
        ufs = Cliente.objects.values_list('uf', flat=True).distinct().order_by('uf')
        return [(uf, uf) for uf in ufs if uf]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(agendamento__cliente__uf=self.value())

class SituacaoFuncionalFilter(admin.SimpleListFilter):
    title = 'Situação Funcional'
    parameter_name = 'situacao_funcional'

    def lookups(self, request, model_admin):
        situacoes = Cliente.objects.values_list('situacao_funcional', flat=True).distinct().order_by('situacao_funcional')
        return [(sit, sit) for sit in situacoes if sit]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(agendamento__cliente__situacao_funcional=self.value())

class TemDadosNegociacaoFilter(admin.SimpleListFilter):
    title = 'Tem Dados de Negociação'
    parameter_name = 'tem_dados_negociacao'

    def lookups(self, request, model_admin):
        return (
            ('sim', 'Sim'),
            ('nao', 'Não'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'sim':
            return queryset.filter(dados_negociacao__isnull=False).distinct()
        elif self.value() == 'nao':
            return queryset.filter(dados_negociacao__isnull=True)
        return queryset

class PeriodoDataFilter(admin.SimpleListFilter):
    title = 'Período de Criação'
    parameter_name = 'periodo_criacao'

    def lookups(self, request, model_admin):
        return (
            ('hoje', 'Hoje'),
            ('ontem', 'Ontem'),
            ('semana', 'Última Semana'),
            ('mes', 'Último Mês'),
            ('trimestre', 'Último Trimestre'),
        )

    def queryset(self, request, queryset):
        from django.utils import timezone
        from datetime import timedelta
        
        hoje = timezone.now().date()
        
        if self.value() == 'hoje':
            return queryset.filter(data_criacao__date=hoje)
        elif self.value() == 'ontem':
            ontem = hoje - timedelta(days=1)
            return queryset.filter(data_criacao__date=ontem)
        elif self.value() == 'semana':
            semana_atras = hoje - timedelta(days=7)
            return queryset.filter(data_criacao__date__gte=semana_atras)
        elif self.value() == 'mes':
            mes_atras = hoje - timedelta(days=30)
            return queryset.filter(data_criacao__date__gte=mes_atras)
        elif self.value() == 'trimestre':
            trimestre_atras = hoje - timedelta(days=90)
            return queryset.filter(data_criacao__date__gte=trimestre_atras)
        return queryset

@admin.register(Campanha)
class CampanhaAdmin(admin.ModelAdmin):
    list_display = ('id', 'nome', 'get_setor_nome', 'data_criacao', 'status', 'get_total_debitos')
    list_filter = ('status', 'setor', 'data_criacao')
    search_fields = ('nome', 'setor__nome')
    list_editable = ('status',)
    date_hierarchy = 'data_criacao'
    ordering = ('-data_criacao', 'nome')
    autocomplete_fields = ('setor',)
    list_select_related = ('setor',)

    @admin.display(description='Setor', ordering='setor__nome')
    def get_setor_nome(self, obj):
        return obj.setor.nome if obj.setor else 'Sem Setor'

    @admin.display(description='Total Débitos')
    def get_total_debitos(self, obj):
        count = obj.debitos.count()
        return format_html('<span style="font-weight: bold;">{}</span>', count)


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('id', 'nome', 'cpf', 'uf', 'situacao_funcional', 'get_renda_formatted', 'get_total_saldo_formatted', 'get_agendamentos_count')
    list_filter = ('uf', 'situacao_funcional', 'rjur')
    search_fields = ('nome', 'cpf')
    readonly_fields = ('total_util', 'total_saldo')
    list_per_page = 50
    
    fieldsets = (
        ('Informações Pessoais', {
            'fields': ('nome', 'cpf', 'uf', 'rjur', 'situacao_funcional')
        }),
        ('Dados Financeiros - Margem 5%', {
            'fields': (
                'renda_bruta',
                ('bruta_5', 'util_5', 'saldo_5'),
                ('brutaBeneficio_5', 'utilBeneficio_5', 'saldoBeneficio_5'),
            ),
            'classes': ('collapse',)
        }),
        ('Dados Financeiros - Margem 35%', {
            'fields': (
                ('bruta_35', 'util_35', 'saldo_35'),
            ),
            'classes': ('collapse',)
        }),
        ('Totais Calculados', {
            'fields': (
                ('total_util', 'total_saldo')
            ),
            'classes': ('collapse',)
        })
    )
    ordering = ('nome',)

    @admin.display(description='Renda Bruta', ordering='renda_bruta')
    def get_renda_formatted(self, obj):
        if obj.renda_bruta is not None:
            try:
                if isinstance(obj.renda_bruta, (int, float, Decimal)):
                    valor = float(obj.renda_bruta)
                else:
                    valor = float(str(obj.renda_bruta))
                return format_html('<span style="color: green; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.renda_bruta}'
        return '-'

    @admin.display(description='Total Saldo', ordering='total_saldo')
    def get_total_saldo_formatted(self, obj):
        if obj.total_saldo is not None:
            try:
                if isinstance(obj.total_saldo, (int, float, Decimal)):
                    valor = float(obj.total_saldo)
                else:
                    valor = float(str(obj.total_saldo))
                return format_html('<span style="color: blue; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.total_saldo}'
        return '-'

    @admin.display(description='Agendamentos')
    def get_agendamentos_count(self, obj):
        count = obj.agendamentos.count()
        if count > 0:
            url = reverse('admin:siape_agendamentofichacliente_changelist')
            return format_html('<a href="{}?cliente__id={}" style="color: #007cba;">{} agendamento(s)</a>', url, obj.id, count)
        return '0'


@admin.register(Debito)
class DebitoAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_nome', 'get_campanha_nome', 'matricula', 'banco', 'orgao', 'get_parcela_formatted', 'prazo_restante', 'tipo_contrato')
    list_filter = ('banco', 'tipo_contrato', 'campanha', 'orgao', 'campanha__status')
    search_fields = ('matricula', 'num_contrato', 'cliente__nome', 'cliente__cpf', 'banco', 'orgao')
    autocomplete_fields = ('cliente', 'campanha')
    list_select_related = ('cliente', 'campanha')
    ordering = ('cliente__nome', '-campanha__data_criacao')
    list_per_page = 50

    @admin.display(description='Cliente', ordering='cliente__nome')
    def get_cliente_nome(self, obj):
        return obj.cliente.nome if obj.cliente else 'N/A'

    @admin.display(description='Campanha', ordering='campanha__nome')
    def get_campanha_nome(self, obj):
        return obj.campanha.nome if obj.campanha else 'N/A'

    @admin.display(description='Parcela', ordering='parcela')
    def get_parcela_formatted(self, obj):
        if obj.parcela is not None:
            try:
                if isinstance(obj.parcela, (int, float, Decimal)):
                    valor = float(obj.parcela)
                else:
                    valor = float(str(obj.parcela))
                return format_html('<span style="color: #d63384; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.parcela}'
        return '-'


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    list_display = ('id', 'nome', 'descricao', 'ativo', 'data_criacao', 'get_registros_count')
    list_filter = ('ativo', 'data_criacao')
    search_fields = ('nome', 'descricao')
    list_editable = ('ativo',)
    ordering = ('nome',)

    @admin.display(description='Registros')
    def get_registros_count(self, obj):
        count = obj.registermoney_set.count()
        return format_html('<span style="font-weight: bold;">{}</span>', count)


@admin.register(RegisterMoney)
class RegisterMoneyAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_user_display', 'get_loja_nome', 'get_produto_nome', 'cpf_cliente', 'get_valor_formatted', 'status', 'data')
    list_filter = ('status', 'loja', 'produto', 'data', 'empresa', 'departamento', 'setor', 'equipe')
    search_fields = (
        'user__username',
        'user__first_name',
        'user__last_name',
        'user__funcionario__apelido',
        'cpf_cliente',
        'produto__nome',
        'loja__nome'
    )
    date_hierarchy = 'data'
    autocomplete_fields = ('user', 'loja', 'produto', 'empresa', 'departamento', 'setor', 'equipe')
    list_select_related = ('user', 'loja', 'produto', 'empresa', 'departamento', 'setor', 'equipe')
    list_editable = ('status',)
    readonly_fields = ('data',)
    ordering = ('-data',)
    list_per_page = 50
    
    fieldsets = (
        ('Informações do Registro', {
            'fields': ('user', 'cpf_cliente', 'produto', 'valor_est', 'status')
        }),
        ('Localização', {
            'fields': ('loja',)
        }),
        ('Associação Organizacional', {
            'fields': ('empresa', 'departamento', 'setor', 'equipe'),
            'classes': ('collapse',)
        }),
        ('Data do Registro', {
            'fields': ('data',),
            'classes': ('collapse',)
        })
    )

    @admin.display(description='Usuário', ordering='user__username')
    def get_user_display(self, obj):
        if Funcionario:
            try:
                funcionario = getattr(obj.user, 'funcionario', None)
                if funcionario:
                    return funcionario.apelido or funcionario.nome_completo or obj.user.username
                else:
                    return obj.user.username
            except AttributeError:
                return obj.user.username
            except Exception:
                return f"Erro ao buscar funcionário (User ID: {obj.user_id})"
        else:
            return obj.user.username

    @admin.display(description='Loja', ordering='loja__nome')
    def get_loja_nome(self, obj):
        return obj.loja.nome if obj.loja else 'N/A'

    @admin.display(description='Produto', ordering='produto__nome')
    def get_produto_nome(self, obj):
        return obj.produto.nome if obj.produto else 'N/A'

    @admin.display(description='Valor', ordering='valor_est')
    def get_valor_formatted(self, obj):
        if obj.valor_est is not None:
            try:
                if isinstance(obj.valor_est, (int, float, Decimal)):
                    valor = float(obj.valor_est)
                else:
                    valor = float(str(obj.valor_est))
                return format_html('<span style="color: green; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.valor_est}'
        return '-'


@admin.register(RegisterMeta)
class RegisterMetaAdmin(admin.ModelAdmin):
    list_display = ('id', 'titulo', 'get_valor_formatted', 'categoria', 'get_target_display', 'data_inicio', 'data_fim', 'status')
    list_filter = ('categoria', 'status', 'setor', 'equipe')
    search_fields = ('titulo', 'setor__nome', 'equipe__nome')
    filter_horizontal = ('equipe',)
    date_hierarchy = 'data_inicio'
    autocomplete_fields = ('setor', 'equipe')
    list_editable = ('status',)
    ordering = ('-data_inicio', 'categoria')
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('titulo', 'valor', 'categoria')
        }),
        ('Período da Meta', {
            'fields': ('data_inicio', 'data_fim')
        }),
        ('Alvo da Meta (Configuração)', {
            'description': "Selecione Setor OU Equipe(s) conforme a Categoria.",
            'fields': ('setor', 'equipe', 'status')
        }),
         ('Datas de Controle', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('data_criacao',)

    @admin.display(description='Valor', ordering='valor')
    def get_valor_formatted(self, obj):
        if obj.valor is not None:
            try:
                if isinstance(obj.valor, (int, float, Decimal)):
                    valor = float(obj.valor)
                else:
                    valor = float(str(obj.valor))
                return format_html('<span style="color: #0066cc; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.valor}'
        return '-'

    @admin.display(description='Alvo (Setor/Equipe)', ordering='categoria')
    def get_target_display(self, obj):
        if obj.categoria == 'SETOR' and obj.setor:
            return f"Setor: {obj.setor.nome}"
        elif obj.categoria == 'OUTROS' and obj.equipe.exists():
            return f"Equipe(s): {', '.join([e.nome for e in obj.equipe.all()])}"
        elif obj.categoria == 'GERAL':
             return "Geral"
        return obj.get_categoria_display()


@admin.register(AgendamentoFichaCliente)
class AgendamentoFichaClienteAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_nome', 'get_usuario_display', 'data', 'hora', 'get_telefone_formatted', 'status', 'get_tabulacao_status', 'data_criacao')
    list_filter = ('status', 'data', 'usuario')
    search_fields = ('cliente__nome', 'cliente__cpf', 'usuario__username', 'usuario__first_name', 'usuario__last_name', 'telefone_contato')
    date_hierarchy = 'data'
    autocomplete_fields = ('cliente', 'usuario')
    readonly_fields = ('data_criacao',)
    list_select_related = ('cliente', 'usuario')
    ordering = ('-data', '-hora')
    list_per_page = 50
    
    fieldsets = (
        ('Agendamento', {
            'fields': ('cliente', 'usuario', ('data', 'hora'), 'telefone_contato')
        }),
        ('Status e Observações', {
            'fields': ('status', 'observacao')
        }),
        ('Informações do Sistema', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        })
    )

    @admin.display(description='Cliente', ordering='cliente__nome')
    def get_cliente_nome(self, obj):
        if obj.cliente:
            url = reverse('admin:siape_cliente_change', args=[obj.cliente.id])
            return format_html('<a href="{}" style="color: #007cba;">{}</a>', url, obj.cliente.nome)
        return "N/A"

    @admin.display(description='Usuário Agendou', ordering='usuario__username')
    def get_usuario_display(self, obj):
        if obj.usuario and Funcionario:
            try:
                funcionario = getattr(obj.usuario, 'funcionario', None)
                if funcionario:
                    return funcionario.apelido or funcionario.nome_completo or obj.usuario.username
                else:
                    return obj.usuario.username
            except Exception:
                return obj.usuario.username
        return obj.usuario.username if obj.usuario else 'Sistema'

    @admin.display(description='Telefone')
    def get_telefone_formatted(self, obj):
        if obj.telefone_contato:
            return format_html('<span style="color: #28a745; font-weight: bold;">{}</span>', obj.telefone_contato)
        return '-'

    @admin.display(description='Tabulação')
    def get_tabulacao_status(self, obj):
        try:
            if hasattr(obj, 'tabulacao') and obj.tabulacao:
                status_colors = {
                    'SEM_RESPOSTA': '#6c757d',
                    'EM_NEGOCIACAO': '#ffc107',
                    'REVERSAO': '#dc3545',
                    'REVERTIDO': '#fd7e14',
                    'DESISTIU': '#dc3545',
                    'CHECAGEM': '#17a2b8',
                    'CHECAGEM_OK': '#20c997',
                    'ALTO_RISCO': '#dc3545',
                    'CONCLUIDO_PG': '#28a745'
                }
                color = status_colors.get(obj.tabulacao.status, '#6c757d')
                return format_html('<span style="color: {}; font-weight: bold;">{}</span>', 
                                 color, obj.tabulacao.get_status_display())
            return format_html('<span style="color: #6c757d;">Sem Tabulação</span>')
        except:
            return '-'


@admin.register(Reembolso)
class ReembolsoAdmin(admin.ModelAdmin):
    list_display = ('registermoney_id', 'get_registermoney_display', 'data_reembolso', 'status')
    list_filter = ('status', 'data_reembolso')
    search_fields = (
        'registermoney__cpf_cliente',
        'registermoney__produto__nome',
        'registermoney__user__username',
        'registermoney__user__first_name',
        'registermoney__user__last_name',
    )
    date_hierarchy = 'data_reembolso'
    autocomplete_fields = ('registermoney',)
    list_select_related = ('registermoney',)
    ordering = ('-data_reembolso',)

    @admin.display(description='RegisterMoney', ordering='registermoney__cpf_cliente')
    def get_registermoney_display(self, obj):
        if obj.registermoney:
            return f"CPF: {obj.registermoney.cpf_cliente} - {obj.registermoney.produto.nome if obj.registermoney.produto else 'N/A'}"
        return 'N/A'

    fieldsets = (
        ('Informações do Reembolso', {
            'fields': ('registermoney', 'data_reembolso', 'status')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        })
    )


@admin.register(TabulacaoAgendamento)
class TabulacaoAgendamentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_agendamento_display', 'get_status_colored', 'get_usuario_responsavel', 'data_criacao', 'data_atualizacao', 'get_dados_negociacao', 'status')
    list_filter = (
        StatusTabulacaoFilter,
        StatusAgendamentoFilter,
        UFClienteFilter,
        SituacaoFuncionalFilter,
        TemDadosNegociacaoFilter,
        PeriodoDataFilter,
        ('data_criacao', admin.DateFieldListFilter),
        ('data_atualizacao', admin.DateFieldListFilter),
        ('agendamento__data', admin.DateFieldListFilter),
        'agendamento__usuario',
        'usuario_responsavel',
    )
    search_fields = (
        'agendamento__cliente__nome', 
        'agendamento__cliente__cpf', 
        'usuario_responsavel__username',
        'usuario_responsavel__first_name',
        'usuario_responsavel__last_name',
        'agendamento__usuario__username',
        'agendamento__usuario__first_name',
        'agendamento__usuario__last_name',
        'observacoes',
        'agendamento__telefone_contato',
        'agendamento__observacao'
    )
    autocomplete_fields = ('agendamento', 'usuario_responsavel')
    list_select_related = ('agendamento__cliente', 'usuario_responsavel', 'agendamento__usuario')
    date_hierarchy = 'data_atualizacao'
    ordering = ('-data_atualizacao',)
    list_per_page = 100
    list_editable = ('status',)
    actions = [
        'mover_para_em_negociacao', 
        'mover_para_checagem', 
        'mover_para_concluido', 
        'mover_para_desistiu',
        'mover_para_sem_resposta',
        'mover_para_reversao',
        'mover_para_revertido',
        'mover_para_alto_risco',
        'exportar_selecionados'
    ]
    
    fieldsets = (
        ('Informações da Tabulação', {
            'fields': ('agendamento', 'status', 'usuario_responsavel')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('data_criacao', 'data_atualizacao')

    @admin.display(description='Agendamento', ordering='agendamento__cliente__nome')
    def get_agendamento_display(self, obj):
        if obj.agendamento and obj.agendamento.cliente:
            url = reverse('admin:siape_agendamentofichacliente_change', args=[obj.agendamento.id])
            return format_html('<a href="{}" style="color: #007cba;">{} - {} {}</a>', 
                             url, obj.agendamento.cliente.nome, obj.agendamento.data, obj.agendamento.hora)
        return "N/A"

    @admin.display(description='Status', ordering='status')
    def get_status_colored(self, obj):
        status_colors = {
            'SEM_RESPOSTA': '#6c757d',
            'EM_NEGOCIACAO': '#ffc107',
            'REVERSAO': '#dc3545',
            'REVERTIDO': '#fd7e14',
            'DESISTIU': '#dc3545',
            'CHECAGEM': '#17a2b8',
            'CHECAGEM_OK': '#20c997',
            'ALTO_RISCO': '#dc3545',
            'CONCLUIDO_PG': '#28a745'
        }
        color = status_colors.get(obj.status, '#6c757d')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', 
                         color, obj.get_status_display())

    @admin.display(description='Usuário Responsável', ordering='usuario_responsavel__username')
    def get_usuario_responsavel(self, obj):
        if obj.usuario_responsavel and Funcionario:
            try:
                funcionario = getattr(obj.usuario_responsavel, 'funcionario', None)
                if funcionario:
                    return funcionario.apelido or funcionario.nome_completo or obj.usuario_responsavel.username
                else:
                    return obj.usuario_responsavel.username
            except Exception:
                return obj.usuario_responsavel.username
        return obj.usuario_responsavel.username if obj.usuario_responsavel else 'Sistema'

    @admin.display(description='Dados Negociação')
    def get_dados_negociacao(self, obj):
        try:
            dados = obj.dados_negociacao.all()
            if dados.exists():
                count = dados.count()
                url = reverse('admin:siape_dadosnegociacao_changelist')
                return format_html('<a href="{}?tabulacao__id={}" style="color: #007cba;">{} registro(s)</a>', 
                                 url, obj.id, count)
            return '0'
        except:
            return '-'

    @admin.action(description='Mover para Em Negociação')
    def mover_para_em_negociacao(self, request, queryset):
        updated = queryset.update(status='EM_NEGOCIACAO')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Em Negociação".')

    @admin.action(description='Mover para Checagem')
    def mover_para_checagem(self, request, queryset):
        updated = queryset.update(status='CHECAGEM')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Checagem".')

    @admin.action(description='Mover para Concluído PG')
    def mover_para_concluido(self, request, queryset):
        updated = queryset.update(status='CONCLUIDO_PG')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Concluído PG".')

    @admin.action(description='Mover para Desistiu')
    def mover_para_desistiu(self, request, queryset):
        updated = queryset.update(status='DESISTIU')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Desistiu".')

    @admin.action(description='Mover para Sem Resposta')
    def mover_para_sem_resposta(self, request, queryset):
        updated = queryset.update(status='SEM_RESPOSTA')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Sem Resposta".')

    @admin.action(description='Mover para Reversão')
    def mover_para_reversao(self, request, queryset):
        updated = queryset.update(status='REVERSAO')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Reversão".')

    @admin.action(description='Mover para Revertido')
    def mover_para_revertido(self, request, queryset):
        updated = queryset.update(status='REVERTIDO')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Revertido".')

    @admin.action(description='Mover para Alto Risco')
    def mover_para_alto_risco(self, request, queryset):
        updated = queryset.update(status='ALTO_RISCO')
        self.message_user(request, f'{updated} tabulação(ões) movida(s) para "Alto Risco".')

    @admin.action(description='Exportar Selecionados')
    def exportar_selecionados(self, request, queryset):
        import csv
        from django.http import HttpResponse
        
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = 'attachment; filename="tabulacoes_export.csv"'
        
        writer = csv.writer(response)
        writer.writerow([
            'ID', 'Cliente', 'CPF', 'Status Tabulação', 'Status Agendamento', 
            'Data Agendamento', 'Hora Agendamento', 'Usuário Responsável',
            'Data Criação', 'Data Atualização', 'Observações'
        ])
        
        for obj in queryset:
            writer.writerow([
                obj.id,
                obj.agendamento.cliente.nome if obj.agendamento and obj.agendamento.cliente else '',
                obj.agendamento.cliente.cpf if obj.agendamento and obj.agendamento.cliente else '',
                obj.get_status_display(),
                obj.agendamento.get_status_display() if obj.agendamento else '',
                obj.agendamento.data if obj.agendamento else '',
                obj.agendamento.hora if obj.agendamento else '',
                obj.usuario_responsavel.username if obj.usuario_responsavel else '',
                obj.data_criacao.strftime('%d/%m/%Y %H:%M') if obj.data_criacao else '',
                obj.data_atualizacao.strftime('%d/%m/%Y %H:%M') if obj.data_atualizacao else '',
                obj.observacoes or ''
            ])
        
        self.message_user(request, f'{queryset.count()} registro(s) exportado(s) com sucesso.')
        return response

    def get_queryset(self, request):
        """
        Otimiza as consultas incluindo related fields para melhor performance
        """
        return super().get_queryset(request).select_related(
            'agendamento__cliente',
            'usuario_responsavel',
            'agendamento__usuario'
        ).prefetch_related('dados_negociacao')


@admin.register(HistoricoTabulacaoAgendamento)
class HistoricoTabulacaoAgendamentoAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_agendamento_display', 'get_status_change', 'get_usuario_display', 'data_alteracao')
    list_filter = ('status_anterior', 'status_novo', 'data_alteracao')
    search_fields = ('agendamento__cliente__nome', 'agendamento__cliente__cpf', 'usuario__username')
    autocomplete_fields = ('agendamento', 'usuario')
    list_select_related = ('agendamento__cliente', 'usuario')
    date_hierarchy = 'data_alteracao'
    ordering = ('-data_alteracao',)
    
    fieldsets = (
        ('Alteração de Status', {
            'fields': ('agendamento', 'status_anterior', 'status_novo', 'usuario')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        }),
        ('Data da Alteração', {
            'fields': ('data_alteracao',),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('data_alteracao',)

    @admin.display(description='Agendamento', ordering='agendamento__cliente__nome')
    def get_agendamento_display(self, obj):
        if obj.agendamento and obj.agendamento.cliente:
            return f"{obj.agendamento.cliente.nome} - {obj.agendamento.data}"
        return "N/A"

    @admin.display(description='Mudança de Status')
    def get_status_change(self, obj):
        status_anterior = obj.get_status_anterior_display() if obj.status_anterior else "Novo"
        status_novo = obj.get_status_novo_display()
        
        colors = {
            'SEM_RESPOSTA': '#6c757d', 'EM_NEGOCIACAO': '#ffc107', 'REVERSAO': '#dc3545',
            'REVERTIDO': '#fd7e14', 'DESISTIU': '#dc3545', 'CHECAGEM': '#17a2b8',
            'CHECAGEM_OK': '#20c997', 'ALTO_RISCO': '#dc3545', 'CONCLUIDO_PG': '#28a745'
        }
        
        color_anterior = colors.get(obj.status_anterior, '#6c757d')
        color_novo = colors.get(obj.status_novo, '#6c757d')
        
        return format_html(
            '<span style="color: {};">{}</span> → <span style="color: {}; font-weight: bold;">{}</span>',
            color_anterior, status_anterior, color_novo, status_novo
        )

    @admin.display(description='Usuário', ordering='usuario__username')
    def get_usuario_display(self, obj):
        if obj.usuario and Funcionario:
            try:
                funcionario = getattr(obj.usuario, 'funcionario', None)
                if funcionario:
                    return funcionario.apelido or funcionario.nome_completo or obj.usuario.username
                else:
                    return obj.usuario.username
            except Exception:
                return obj.usuario.username
        return obj.usuario.username if obj.usuario else 'Sistema'


@admin.register(DocumentoCliente)
class DocumentoClienteAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_nome', 'nome_documento', 'tipo_documento', 'get_usuario_upload', 'data_upload', 'ativo', 'get_ativo_status')
    list_filter = ('tipo_documento', 'ativo', 'data_upload')
    search_fields = ('cliente__nome', 'cliente__cpf', 'nome_documento', 'usuario_upload__username')
    autocomplete_fields = ('cliente', 'usuario_upload')
    list_select_related = ('cliente', 'usuario_upload')
    date_hierarchy = 'data_upload'
    ordering = ('-data_upload',)
    list_editable = ('ativo',)
    
    fieldsets = (
        ('Informações do Documento', {
            'fields': ('cliente', 'nome_documento', 'tipo_documento', 'arquivo', 'ativo')
        }),
        ('Upload', {
            'fields': ('usuario_upload', 'data_upload')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        })
    )
    readonly_fields = ('data_upload',)

    @admin.display(description='Cliente', ordering='cliente__nome')
    def get_cliente_nome(self, obj):
        if obj.cliente:
            url = reverse('admin:siape_cliente_change', args=[obj.cliente.id])
            return format_html('<a href="{}" style="color: #007cba;">{}</a>', url, obj.cliente.nome)
        return "N/A"

    @admin.display(description='Usuário Upload', ordering='usuario_upload__username')
    def get_usuario_upload(self, obj):
        if obj.usuario_upload and Funcionario:
            try:
                funcionario = getattr(obj.usuario_upload, 'funcionario', None)
                if funcionario:
                    return funcionario.apelido or funcionario.nome_completo or obj.usuario_upload.username
                else:
                    return obj.usuario_upload.username
            except Exception:
                return obj.usuario_upload.username
        return obj.usuario_upload.username if obj.usuario_upload else 'Sistema'

    @admin.display(description='Status', ordering='ativo')
    def get_ativo_status(self, obj):
        if obj.ativo:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Ativo</span>')
        return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Inativo</span>')


@admin.register(TelefoneCliente)
class TelefoneClienteAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_nome', 'get_numero_formatted', 'tipo', 'origem', 'principal', 'get_principal_status', 'get_usuario_cadastro', 'data_cadastro', 'ativo', 'get_ativo_status')
    list_filter = ('tipo', 'origem', 'principal', 'ativo', 'data_cadastro')
    search_fields = ('cliente__nome', 'cliente__cpf', 'numero', 'usuario_cadastro__username', 'agendamento_origem__id')
    autocomplete_fields = ('cliente', 'usuario_cadastro', 'agendamento_origem')
    list_select_related = ('cliente', 'usuario_cadastro', 'agendamento_origem')
    date_hierarchy = 'data_cadastro'
    ordering = ('-principal', '-data_cadastro')
    list_editable = ('principal', 'ativo')
    actions = ['ativar_registros', 'inativar_registros']
    
    fieldsets = (
        ('Informações do Telefone', {
            'fields': ('cliente', 'numero', 'tipo', 'principal', 'ativo')
        }),
        ('Origem do Cadastro', {
            'fields': ('origem', 'agendamento_origem'),
            'description': 'Se origem for "AGENDAMENTO", selecione o agendamento correspondente.'
        }),
        ('Cadastro', {
            'fields': ('usuario_cadastro', 'data_cadastro')
        }),
        ('Observações', {
            'fields': ('observacoes',)
        })
    )
    readonly_fields = ('data_cadastro',)

    @admin.display(description='Cliente', ordering='cliente__nome')
    def get_cliente_nome(self, obj):
        if obj.cliente:
            url = reverse('admin:siape_cliente_change', args=[obj.cliente.id])
            return format_html('<a href="{}" style="color: #007cba;">{}</a>', url, obj.cliente.nome)
        return "N/A"

    @admin.display(description='Número', ordering='numero')
    def get_numero_formatted(self, obj):
        return format_html('<span style="color: #28a745; font-weight: bold;">{}</span>', obj.numero)

    @admin.display(description='Principal', ordering='principal')
    def get_principal_status(self, obj):
        if obj.principal:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Principal</span>')
        return format_html('<span style="color: #6c757d;">Secundário</span>')

    @admin.display(description='Status', ordering='ativo')
    def get_ativo_status(self, obj):
        if obj.ativo:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Ativo</span>')
        return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Inativo</span>')

    @admin.display(description='Usuário Cadastro', ordering='usuario_cadastro__username')
    def get_usuario_cadastro(self, obj):
        if obj.usuario_cadastro and Funcionario:
            try:
                funcionario = getattr(obj.usuario_cadastro, 'funcionario', None)
                if funcionario:
                    return funcionario.apelido or funcionario.nome_completo or obj.usuario_cadastro.username
                else:
                    return obj.usuario_cadastro.username
            except Exception:
                return obj.usuario_cadastro.username
        return obj.usuario_cadastro.username if obj.usuario_cadastro else 'Sistema'

    @admin.action(description='Ativar registros selecionados')
    def ativar_registros(self, request, queryset):
        updated = queryset.update(ativo=True)
        self.message_user(request, f'{updated} registro(s) ativado(s) com sucesso.')

    @admin.action(description='Inativar registros selecionados')
    def inativar_registros(self, request, queryset):
        updated = queryset.update(ativo=False)
        self.message_user(request, f'{updated} registro(s) inativado(s) com sucesso.')


class ArquivoNegociacaoInline(admin.TabularInline):
    """
    Inline para exibir arquivos de negociação dentro do admin de DadosNegociacao
    """
    model = ArquivoNegociacao
    extra = 0
    readonly_fields = ('data_criacao', 'data_ultima_modificacao', 'get_tamanho_arquivo')
    fields = ('titulo_arquivo', 'arquivo', 'get_tamanho_arquivo', 'status', 'data_criacao')

    @admin.display(description='Tamanho')
    def get_tamanho_arquivo(self, obj):
        if obj and obj.arquivo:
            return obj.get_tamanho_arquivo()
        return '-'


@admin.register(DadosNegociacao)
class DadosNegociacaoAdmin(admin.ModelAdmin):
    # Correção para erro SafeString em formatação de valores monetários - v2
    list_display = ('id', 'get_agendamento_display', 'get_tabulacao_status', 'banco_nome', 'get_valor_liberado_formatted', 'get_parcela_nova_formatted', 'get_arquivos_count', 'data_criacao', 'status', 'get_status_display')
    list_filter = ('status', 'banco_nome', 'data_criacao', 'tabulacao__status')
    search_fields = (
        'agendamento__cliente__nome',
        'agendamento__cliente__cpf', 
        'banco_nome',
        'descricao'
    )
    autocomplete_fields = ('agendamento', 'tabulacao')
    list_select_related = ('agendamento__cliente', 'tabulacao')
    date_hierarchy = 'data_criacao'
    ordering = ('-data_criacao',)
    list_editable = ('status',)
    inlines = [ArquivoNegociacaoInline]
    list_per_page = 30
    actions = ['ativar_registros', 'inativar_registros']
    
    fieldsets = (
        ('Vinculação', {
            'fields': ('agendamento', 'tabulacao', 'status')
        }),
        ('Dados Bancários', {
            'fields': ('banco_nome', 'valor_liberado', 'saldo_devedor', 'troco', 'tc')
        }),
        ('Parcelas e Prazos', {
            'fields': (
                ('parcela_atual', 'parcela_nova'),
                ('prazo_atual', 'prazo_acordado')
            )
        }),
        ('Descrição da Negociação', {
            'fields': ('descricao',)
        }),
        ('Controle Temporal', {
            'fields': ('data_criacao', 'data_ultima_modificacao'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('data_criacao', 'data_ultima_modificacao')

    @admin.display(description='Agendamento', ordering='agendamento__cliente__nome')
    def get_agendamento_display(self, obj):
        if obj.agendamento and obj.agendamento.cliente:
            url = reverse('admin:siape_agendamentofichacliente_change', args=[obj.agendamento.id])
            return format_html('<a href="{}" style="color: #007cba;">{} - {} {}</a>', 
                             url, obj.agendamento.cliente.nome, obj.agendamento.data, obj.agendamento.hora)
        return "N/A"

    @admin.display(description='Status Tabulação', ordering='tabulacao__status')
    def get_tabulacao_status(self, obj):
        if obj.tabulacao:
            status_colors = {
                'EM_NEGOCIACAO': '#ffc107',
                'REVERSAO': '#dc3545',
                'CHECAGEM': '#17a2b8',
                'FINALIZADO': '#28a745'
            }
            color = status_colors.get(obj.tabulacao.status, '#6c757d')
            return format_html('<span style="color: {}; font-weight: bold;">{}</span>', 
                             color, obj.tabulacao.get_status_display())
        return "N/A"

    @admin.display(description='Valor Liberado', ordering='valor_liberado')
    def get_valor_liberado_formatted(self, obj):
        if obj.valor_liberado is not None:
            try:
                if isinstance(obj.valor_liberado, (int, float, Decimal)):
                    valor = float(obj.valor_liberado)
                else:
                    valor = float(str(obj.valor_liberado))
                return format_html('<span style="color: #28a745; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.valor_liberado}'
        return '-'

    @admin.display(description='Parcela Nova', ordering='parcela_nova')
    def get_parcela_nova_formatted(self, obj):
        if obj.parcela_nova is not None:
            try:
                if isinstance(obj.parcela_nova, (int, float, Decimal)):
                    valor = float(obj.parcela_nova)
                else:
                    valor = float(str(obj.parcela_nova))
                return format_html('<span style="color: #17a2b8; font-weight: bold;">R$ {:,.2f}</span>', valor)
            except (ValueError, TypeError):
                return f'R$ {obj.parcela_nova}'
        return '-'

    @admin.display(description='Arquivos')
    def get_arquivos_count(self, obj):
        count = obj.arquivos.filter(status=True).count()
        if count > 0:
            url = reverse('admin:siape_arquivonegociacao_changelist')
            return format_html('<a href="{}?dados_negociacao__id={}" style="color: #007cba;">{} arquivo(s)</a>', 
                             url, obj.id, count)
        return '0'

    @admin.display(description='Status', ordering='status')
    def get_status_display(self, obj):
        if obj.status:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Ativo</span>')
        return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Inativo</span>')

    @admin.action(description='Ativar registros selecionados')
    def ativar_registros(self, request, queryset):
        updated = queryset.update(status=True)
        self.message_user(request, f'{updated} registro(s) ativado(s) com sucesso.')

    @admin.action(description='Inativar registros selecionados')
    def inativar_registros(self, request, queryset):
        updated = queryset.update(status=False)
        self.message_user(request, f'{updated} registro(s) inativado(s) com sucesso.')


@admin.register(ArquivoNegociacao)
class ArquivoNegociacaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_dados_negociacao_display', 'titulo_arquivo', 'get_tamanho_arquivo', 'data_criacao', 'status', 'get_status_display')
    list_filter = ('status', 'data_criacao', 'dados_negociacao__banco_nome')
    search_fields = (
        'titulo_arquivo',
        'dados_negociacao__agendamento__cliente__nome',
        'dados_negociacao__agendamento__cliente__cpf',
        'dados_negociacao__banco_nome'
    )
    autocomplete_fields = ('dados_negociacao',)
    list_select_related = ('dados_negociacao__agendamento__cliente',)
    date_hierarchy = 'data_criacao'
    ordering = ('-data_criacao',)
    list_editable = ('status',)
    list_per_page = 50
    actions = ['ativar_registros', 'inativar_registros']
    
    fieldsets = (
        ('Informações do Arquivo', {
            'fields': ('dados_negociacao', 'titulo_arquivo', 'arquivo', 'status')
        }),
        ('Informações do Arquivo', {
            'fields': ('get_arquivo_info',),
            'classes': ('collapse',)
        }),
        ('Controle Temporal', {
            'fields': ('data_criacao', 'data_ultima_modificacao'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('data_criacao', 'data_ultima_modificacao', 'get_arquivo_info')

    @admin.display(description='Dados da Negociação', ordering='dados_negociacao__agendamento__cliente__nome')
    def get_dados_negociacao_display(self, obj):
        if obj.dados_negociacao and obj.dados_negociacao.agendamento and obj.dados_negociacao.agendamento.cliente:
            cliente_nome = obj.dados_negociacao.agendamento.cliente.nome
            banco_info = f" - {obj.dados_negociacao.banco_nome}" if obj.dados_negociacao.banco_nome else ""
            url = reverse('admin:siape_dadosnegociacao_change', args=[obj.dados_negociacao.id])
            return format_html('<a href="{}" style="color: #007cba;">{}{}</a>', url, cliente_nome, banco_info)
        return "N/A"

    @admin.display(description='Tamanho do Arquivo')
    def get_tamanho_arquivo(self, obj):
        tamanho = obj.get_tamanho_arquivo()
        if 'MB' in tamanho and float(tamanho.split()[0]) > 10:
            return format_html('<span style="color: #dc3545; font-weight: bold;">{}</span>', tamanho)
        return tamanho

    @admin.display(description='Status', ordering='status')
    def get_status_display(self, obj):
        if obj.status:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Ativo</span>')
        return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Inativo</span>')

    @admin.display(description='Informações do Arquivo')
    def get_arquivo_info(self, obj):
        if obj.arquivo:
            return format_html(
                '<strong>Nome:</strong> {}<br>'
                '<strong>Tamanho:</strong> {}<br>'
                '<strong>URL:</strong> <a href="{}" target="_blank">Visualizar arquivo</a>',
                obj.arquivo.name,
                obj.get_tamanho_arquivo(),
                obj.arquivo.url
            )
        return 'Nenhum arquivo'

    @admin.action(description='Ativar registros selecionados')
    def ativar_registros(self, request, queryset):
        updated = queryset.update(status=True)
        self.message_user(request, f'{updated} registro(s) ativado(s) com sucesso.')

    @admin.action(description='Inativar registros selecionados')
    def inativar_registros(self, request, queryset):
        updated = queryset.update(status=False)
        self.message_user(request, f'{updated} registro(s) inativado(s) com sucesso.')


@admin.register(HorarioChecagem)
class HorarioChecagemAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_coordenador_display', 'get_consultor_display', 'get_cliente_info', 'data', 'hora', 'get_status_checagem_colored', 'get_status_ativo', 'data_criacao')
    list_filter = ('status_checagem', 'status', 'data', 'data_criacao')
    search_fields = (
        'coordenador__username',
        'coordenador__first_name', 
        'coordenador__last_name',
        'consultor__username',
        'consultor__first_name',
        'consultor__last_name',
        'agendamento__cliente__nome',
        'agendamento__cliente__cpf'
    )
    autocomplete_fields = ('coordenador', 'consultor', 'agendamento', 'tabulacao')
    list_select_related = ('coordenador', 'consultor', 'agendamento__cliente', 'tabulacao')
    date_hierarchy = 'data'
    ordering = ('-data', '-hora')
    list_per_page = 50
    actions = ['ativar_registros', 'inativar_registros']
    
    fieldsets = (
        ('Usuários Envolvidos', {
            'fields': ('coordenador', 'consultor')
        }),
        ('Agendamento e Tabulação', {
            'fields': ('agendamento', 'tabulacao')
        }),
        ('Data e Hora da Checagem', {
            'fields': ('data', 'hora')
        }),
        ('Observações', {
            'fields': ('observacao_consultor', 'observacao_coordenador'),
            'classes': ('collapse',)
        }),
        ('Status e Controle', {
            'fields': ('status_checagem', 'status')
        }),
        ('Controle Temporal', {
            'fields': ('data_criacao', 'data_ultima_modificacao'),
            'classes': ('collapse',)
        })
    )
    readonly_fields = ('data_criacao', 'data_ultima_modificacao')

    @admin.display(description='Coordenador', ordering='coordenador__username')
    def get_coordenador_display(self, obj):
        if obj.coordenador:
            try:
                # Tenta buscar o funcionário para mostrar o apelido
                if hasattr(obj.coordenador, 'funcionario_profile') and obj.coordenador.funcionario_profile:
                    funcionario = obj.coordenador.funcionario_profile
                    nome = funcionario.apelido or funcionario.nome_completo.split()[0]
                    hierarquia = funcionario.cargo.get_hierarquia_display() if funcionario.cargo else ""
                    url = reverse('admin:auth_user_change', args=[obj.coordenador.id])
                    return format_html('<a href="{}" style="color: #007cba;">{} ({})</a>', url, nome, hierarquia)
                else:
                    url = reverse('admin:auth_user_change', args=[obj.coordenador.id])
                    return format_html('<a href="{}" style="color: #007cba;">{}</a>', url, obj.coordenador.username)
            except:
                return obj.coordenador.username
        return "N/A"

    @admin.display(description='Consultor', ordering='consultor__username')
    def get_consultor_display(self, obj):
        if obj.consultor:
            try:
                # Tenta buscar o funcionário para mostrar o apelido
                if hasattr(obj.consultor, 'funcionario_profile') and obj.consultor.funcionario_profile:
                    funcionario = obj.consultor.funcionario_profile
                    nome = funcionario.apelido or funcionario.nome_completo.split()[0]
                    url = reverse('admin:auth_user_change', args=[obj.consultor.id])
                    return format_html('<a href="{}" style="color: #17a2b8;">{}</a>', url, nome)
                else:
                    url = reverse('admin:auth_user_change', args=[obj.consultor.id])
                    return format_html('<a href="{}" style="color: #17a2b8;">{}</a>', url, obj.consultor.username)
            except:
                return obj.consultor.username
        return "N/A"

    @admin.display(description='Cliente', ordering='agendamento__cliente__nome')
    def get_cliente_info(self, obj):
        if obj.agendamento and obj.agendamento.cliente:
            cliente = obj.agendamento.cliente
            url = reverse('admin:siape_agendamentofichacliente_change', args=[obj.agendamento.id])
            return format_html('<a href="{}" style="color: #28a745;">{}</a><br><small>{}</small>', 
                             url, cliente.nome, cliente.cpf)
        return "N/A"

    @admin.display(description='Status Checagem', ordering='status_checagem')
    def get_status_checagem_colored(self, obj):
        status_colors = {
            'EM_ESPERA': '#ffc107',
            'EM_ANDAMENTO': '#17a2b8',
            'FINALIZADO': '#28a745'
        }
        color = status_colors.get(obj.status_checagem, '#6c757d')
        return format_html('<span style="color: {}; font-weight: bold;">{}</span>', 
                         color, obj.get_status_checagem_display())

    @admin.display(description='Ativo', ordering='status')
    def get_status_ativo(self, obj):
        if obj.status:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Ativo</span>')
        return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Inativo</span>')

    def get_queryset(self, request):
        """
        Otimiza as consultas incluindo related fields
        """
        return super().get_queryset(request).select_related(
            'coordenador',
            'consultor', 
            'agendamento__cliente',
            'tabulacao'
        )

    def save_model(self, request, obj, form, change):
        """
        Executa validações adicionais antes de salvar
        """
        try:
            obj.full_clean()  # Executa o método clean() do modelo
            super().save_model(request, obj, form, change)
        except ValidationError as e:
            # Re-levanta o erro para ser tratado pelo admin
            raise e

    @admin.action(description='Ativar registros selecionados')
    def ativar_registros(self, request, queryset):
        updated = queryset.update(status=True)
        self.message_user(request, f'{updated} registro(s) ativado(s) com sucesso.')

    @admin.action(description='Inativar registros selecionados')
    def inativar_registros(self, request, queryset):
        updated = queryset.update(status=False)
        self.message_user(request, f'{updated} registro(s) inativado(s) com sucesso.')
