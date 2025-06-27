from django.contrib import admin
from django.utils.html import format_html
from .models import (
    DBCliente, FGTSCliente, Equipe, DBCampanha,
    DBDebito, ControleClientesCampanha, AgendamentoCliente
)

# Inlines
class DebitoInline(admin.TabularInline):
    model = DBDebito
    extra = 0
    fields = ('produto', 'matricula', 'valor_parcela', 'campanha')
    raw_id_fields = ('campanha',)

class ControleInline(admin.TabularInline):
    model = ControleClientesCampanha
    extra = 0
    fields = ('user', 'status', 'created_at')
    readonly_fields = ('created_at',)
    raw_id_fields = ('user', 'campanha', 'db_cliente', 'fgts_cliente')

class AgendamentoInline(admin.TabularInline):
    model = AgendamentoCliente
    extra = 0
    fields = ('dia_agendamento', 'hora', 'responsavel', 'status')
    readonly_fields = ('data_criacao',)

# ModelAdmins
@admin.register(DBCliente)
class DBClienteAdmin(admin.ModelAdmin):
    list_display = ('nome_completo', 'cpf', 'produto', 'campanha', 'situacao_funcional')
    search_fields = ('nome_completo', 'cpf')
    list_filter = ('produto', 'campanha', 'situacao_funcional')
    raw_id_fields = ('campanha',)
    inlines = [DebitoInline, ControleInline, AgendamentoInline]
    fieldsets = (
        ('Identificação', {
            'fields': ('produto', 'campanha', 'nome_completo', 'cpf', 'data_nasc', 'idade')
        }),
        ('Dados Gerais', {
            'fields': ('cidade', 'uf', 'cep')
        }),
        ('Contatos', {
            'fields': (('celular_1', 'flg_wts_1'), ('celular_2', 'flg_wts_2'), ('celular_3', 'flg_wts_3'))
        }),
        ('Empréstimos e Cartões', {
            'fields': (
                ('liberacao_emprestimo', 'qtd_emprestimos'),
                ('rmc_saldo', 'rcc_saldo'),
                ('rmc_bruta', 'rmc_util', 'rcc_bruta', 'rcc_util'),
                ('trinta_cinco_bruta', 'trinta_cinco_util', 'trinta_cinco_saldo')
            )
        }),
        ('Descontos', {
            'fields': ('flg_desconto', 'taxa_associativa', 'parcela')
        }),
        ('SIAPE Específico', {
            'fields': ('rjur', 'situacao_funcional', 'total_credito', 'total_debitos', 'total_liquido', 'margem_disponivel_geral')
        }),
    )

@admin.register(FGTSCliente)
class FGTSClienteAdmin(admin.ModelAdmin):
    list_display = ('nome', 'cpf', 'campanha', 'tipo', 'idade')
    search_fields = ('nome', 'cpf')
    list_filter = ('campanha', 'tipo', 'flag_fgts')
    raw_id_fields = ('campanha',)
    inlines = [ControleInline, AgendamentoInline]
    fieldsets = (
        (None, {
            'fields': ('cpf', 'nome', 'campanha', 'tipo', 'idade', 'data_nascimento')
        }),
        ('Endereço', {
            'fields': ('logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf', 'cep')
        }),
        ('Dados FGTS', {
            'fields': ('salario', 'saldo_aproximado', 'data_admissao', 'razao_social', 'tempo_contribuicao')
        }),
        ('Extras', {
            'fields': ('demografica', 'possivel_profissao', 'score', 'flag_fgts')
        }),
        ('Contatos', {
            'fields': (('cel1', 'procon_cel1', 'fl_whatsapp_cel1'), ('cel2', 'procon_cel2', 'fl_whatsapp_cel2'), 'email1')
        }),
    )

@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ('nome', 'status')
    search_fields = ('nome',)
    filter_horizontal = ('participantes',)

@admin.register(DBCampanha)
class DBCampanhaAdmin(admin.ModelAdmin):
    list_display = ('nome', 'data_criacao', 'status')
    search_fields = ('nome',)
    list_filter = ('status',)
    filter_horizontal = ('equipes',)

@admin.register(DBDebito)
class DBDebitoAdmin(admin.ModelAdmin):
    list_display = ('cliente_link', 'produto', 'matricula', 'valor_parcela', 'campanha')
    search_fields = ('cliente__nome_completo', 'matricula')
    list_filter = ('produto', 'campanha')
    raw_id_fields = ('cliente', 'campanha')

    def cliente_link(self, obj):
        if obj.cliente:
            url = f"/admin/moneyplus/dbcliente/{obj.cliente.id}/change/"
            return format_html('<a href="{}">{}</a>', url, obj.cliente.nome_completo)
        return '-'
    cliente_link.short_description = 'Cliente'

@admin.register(ControleClientesCampanha)
class ControleClientesCampanhaAdmin(admin.ModelAdmin):
    list_display = ('cliente_display', 'campanha', 'user', 'status', 'created_at')
    search_fields = ('db_cliente__nome_completo', 'fgts_cliente__nome')
    list_filter = ('status', 'campanha', 'user')
    raw_id_fields = ('db_cliente', 'fgts_cliente', 'campanha', 'user')

    def cliente_display(self, obj):
        cliente = obj.db_cliente or obj.fgts_cliente
        return getattr(cliente, 'nome_completo', None) or getattr(cliente, 'nome', '')
    cliente_display.short_description = 'Cliente'

@admin.register(AgendamentoCliente)
class AgendamentoClienteAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente_display', 'campanha', 'dia_agendamento', 'hora', 'responsavel', 'status')
    search_fields = ('db_cliente__nome_completo', 'fgts_cliente__nome')
    list_filter = ('status', 'campanha', 'dia_agendamento')
    raw_id_fields = ('db_cliente', 'fgts_cliente', 'campanha')

    def cliente_display(self, obj):
        cliente = obj.db_cliente or obj.fgts_cliente
        return getattr(cliente, 'nome_completo', None) or getattr(cliente, 'nome', '')
    cliente_display.short_description = 'Cliente'