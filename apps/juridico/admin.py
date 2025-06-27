from django.contrib import admin
from django.utils.html import format_html
from .models import ClienteAcao, Acoes, RegistroPagamentos, RegistroPagamentosFeitos, ArquivosAcoesINSS, DocsAcaoINSS

@admin.register(ClienteAcao)
class ClienteAcaoAdmin(admin.ModelAdmin):
    list_display = ('id', 'nome', 'cpf', 'contato', 'data_criacao', 'data_atualizacao')
    search_fields = ('nome', 'cpf', 'contato')
    list_filter = ('data_criacao', 'data_atualizacao')
    readonly_fields = ('data_criacao', 'data_atualizacao')
    ordering = ('-data_criacao',)
    fieldsets = (
        ('Informações Pessoais', {
            'fields': ('nome', 'cpf', 'contato')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        })
    )

@admin.register(Acoes)
class AcoesAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_cpf_display', 'get_cliente_nome_display', 'tipo_acao', 
                   'status_emcaminhamento', 'motivo_incompleto', 'status', 'get_vendedor_display', 'get_advogado_display', 'data_criacao')
    list_filter = ('status', 'status_emcaminhamento', 'tipo_acao', 'data_criacao', 'vendedor_responsavel', 'advogado_responsavel')
    search_fields = ('cliente__nome', 'cliente__cpf', 'numero_protocolo', 'vendedor_responsavel__username', 'advogado_responsavel__username')
    readonly_fields = ()
    ordering = ('-data_criacao',)
    list_editable = ('status', 'status_emcaminhamento')
    autocomplete_fields = ['cliente', 'vendedor_responsavel', 'advogado_responsavel']
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('cliente', 'tipo_acao', 'status_emcaminhamento', 'motivo_incompleto', 'status', 'motivo_inatividade')
        }),
        ('Responsáveis', {
            'fields': ('vendedor_responsavel', 'advogado_responsavel')
        }),
        ('Informações do Processo', {
            'fields': ('numero_protocolo', 'senha_inss', 'sentenca', 'grau_sentenca', 
                      'valor_sentenca', 'data_sentenca')
        }),
        ('Recursos', {
            'fields': ('recurso_primeiro_grau', 'data_recurso_primeiro_grau', 
                      'resultado_recurso_primeiro_grau', 'recurso_segundo_grau',
                      'data_recurso_segundo_grau', 'resultado_recurso_segundo_grau')
        }),
        ('Cancelamento/Inativação', {
            'fields': ('data_cancelamento', 'motivo_cancelamento')
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        })
    )

    def get_cliente_nome_display(self, obj):
        return obj.cliente.nome if obj.cliente else '-'
    get_cliente_nome_display.short_description = 'Nome do Cliente'

    def get_cliente_cpf_display(self, obj):
        return obj.cliente.cpf if obj.cliente else '-'
    get_cliente_cpf_display.short_description = 'CPF'

    def get_vendedor_display(self, obj):
        return obj.vendedor_responsavel.get_full_name() if obj.vendedor_responsavel else '-'
    get_vendedor_display.short_description = 'Vendedor Responsável'

    def get_advogado_display(self, obj):
        return obj.advogado_responsavel.get_full_name() if obj.advogado_responsavel else '-'
    get_advogado_display.short_description = 'Advogado Responsável'

@admin.register(RegistroPagamentos)
class RegistroPagamentosAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_nome_display', 'get_cliente_cpf_display', 'tipo_pagamento', 
                   'valor_total', 'valor_entrada', 'parcelas_totais', 'parcelas_pagas', 
                   'parcelas_restantes', 'status', 'data_criacao')
    list_filter = ('tipo_pagamento', 'status', 'data_criacao')
    search_fields = ('acao_inss__cliente__nome', 'acao_inss__cliente__cpf')
    readonly_fields = ('data_criacao', 'data_atualizacao')
    ordering = ('-data_criacao',)
    list_editable = ('status',)
    autocomplete_fields = ['acao_inss']
    fieldsets = (
        ('Informações do Pagamento', {
            'fields': ('acao_inss', 'tipo_pagamento', 'valor_total', 'valor_entrada')
        }),
        ('Parcelas', {
            'fields': ('parcelas_totais', 'parcelas_pagas', 'parcelas_restantes')
        }),
        ('Status', {
            'fields': ('status',)
        }),
        ('Datas', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        })
    )

    def get_cliente_nome_display(self, obj):
        return obj.acao_inss.cliente.nome if obj.acao_inss and obj.acao_inss.cliente else '-'
    get_cliente_nome_display.short_description = 'Nome do Cliente'

    def get_cliente_cpf_display(self, obj):
        return obj.acao_inss.cliente.cpf if obj.acao_inss and obj.acao_inss.cliente else '-'
    get_cliente_cpf_display.short_description = 'CPF'

@admin.register(RegistroPagamentosFeitos)
class RegistroPagamentosFeitosAdmin(admin.ModelAdmin):
    list_display = ('id', 'get_cliente_nome_display', 'get_cliente_cpf_display', 'valor_pago', 
                   'parcela_paga', 'data_pagamento', 'flg_atrasado', 'flg_acordo', 'tipo_acordo')
    list_filter = ('flg_atrasado', 'flg_acordo', 'tipo_acordo', 'data_pagamento')
    search_fields = ('registro_pagamento__acao_inss__cliente__nome', 
                    'registro_pagamento__acao_inss__cliente__cpf')
    readonly_fields = ('data_pagamento',)
    ordering = ('-data_pagamento',)
    list_editable = ('flg_atrasado', 'flg_acordo', 'tipo_acordo')
    autocomplete_fields = ['registro_pagamento']
    fieldsets = (
        ('Informações do Pagamento', {
            'fields': ('registro_pagamento', 'valor_pago', 'parcela_paga')
        }),
        ('Status do Pagamento', {
            'fields': ('flg_atrasado', 'flg_acordo', 'tipo_acordo', 'juros_atrasado_mensal')
        }),
        ('Observações', {
            'fields': ('observacao',)
        }),
        ('Datas', {
            'fields': ('data_pagamento',),
            'classes': ('collapse',)
        })
    )

    def get_cliente_nome_display(self, obj):
        return obj.registro_pagamento.acao_inss.cliente.nome if obj.registro_pagamento and obj.registro_pagamento.acao_inss and obj.registro_pagamento.acao_inss.cliente else '-'
    get_cliente_nome_display.short_description = 'Nome do Cliente'

    def get_cliente_cpf_display(self, obj):
        return obj.registro_pagamento.acao_inss.cliente.cpf if obj.registro_pagamento and obj.registro_pagamento.acao_inss and obj.registro_pagamento.acao_inss.cliente else '-'
    get_cliente_cpf_display.short_description = 'CPF'

@admin.register(ArquivosAcoesINSS)
class ArquivosAcoesINSSAdmin(admin.ModelAdmin):
    list_display = ('id', 'acao_inss', 'titulo', 'data_import', 'get_file_link')
    search_fields = ('titulo', 'acao_inss__cliente__cpf', 'acao_inss__cliente__nome')
    readonly_fields = ('data_import', 'get_file_link')
    ordering = ('-data_import',)
    autocomplete_fields = ['acao_inss']
    fieldsets = (
        ('Informações do Arquivo', {
            'fields': ('acao_inss', 'titulo', 'file')
        }),
        ('Datas', {
            'fields': ('data_import',),
            'classes': ('collapse',)
        })
    )

    def get_file_link(self, obj):
        if obj.file:
            return format_html('<a href="{}" target="_blank">Visualizar Arquivo</a>', obj.file.url)
        return '-'
    get_file_link.short_description = 'Arquivo'

@admin.register(DocsAcaoINSS)
class DocsAcaoINSSAdmin(admin.ModelAdmin):
    list_display = ('id', 'acao_inss', 'titulo', 'data_import', 'get_file_link')
    search_fields = ('titulo', 'acao_inss__cliente__cpf', 'acao_inss__cliente__nome')
    readonly_fields = ('data_import', 'get_file_link')
    ordering = ('-data_import',)
    autocomplete_fields = ['acao_inss']
    fieldsets = (
        ('Informações do Documento', {
            'fields': ('acao_inss', 'titulo', 'file')
        }),
        ('Datas', {
            'fields': ('data_import',),
            'classes': ('collapse',)
        })
    )

    def get_file_link(self, obj):
        if obj.file:
            return format_html('<a href="{}" target="_blank">Visualizar Documento</a>', obj.file.url)
        return '-'
    get_file_link.short_description = 'Documento'
