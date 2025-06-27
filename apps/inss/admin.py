from django.contrib import admin
from django.utils import timezone
from datetime import timedelta
import calendar
from django.db import models

from .models import ClienteAgendamento, Agendamento, PresencaLoja


# --- FILTROS CUSTOMIZADOS ---

class DataAgendamentoFilter(admin.SimpleListFilter):
    title = 'Data do Agendamento'
    parameter_name = 'dia_agendado_range'

    def lookups(self, request, model_admin):
        return (
            ('hoje', 'Hoje'),
            ('ontem', 'Ontem'),
            ('semana', 'Esta Semana'),
            ('mes', 'Este Mês'),
            ('mes_anterior', 'Mês Anterior'),
            ('proxima_semana', 'Próxima Semana'),
            ('proximo_mes', 'Próximo Mês'),
            ('ultimos_7_dias', 'Últimos 7 Dias'),
            ('ultimos_30_dias', 'Últimos 30 Dias'),
        )

    def queryset(self, request, queryset):
        today = timezone.now().date()
        val = self.value()
        if val == 'hoje':
            return queryset.filter(dia_agendado__date=today)
        if val == 'ontem':
            return queryset.filter(dia_agendado__date=today - timedelta(days=1))
        if val == 'semana':
            start = today - timedelta(days=today.weekday())
            end = start + timedelta(days=6)
            return queryset.filter(dia_agendado__date__range=(start, end))
        if val == 'mes':
            start = today.replace(day=1)
            last = calendar.monthrange(today.year, today.month)[1]
            end = today.replace(day=last)
            return queryset.filter(dia_agendado__date__range=(start, end))
        if val == 'mes_anterior':
            year, month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
            start = today.replace(year=year, month=month, day=1)
            last = calendar.monthrange(year, month)[1]
            end = today.replace(year=year, month=month, day=last)
            return queryset.filter(dia_agendado__date__range=(start, end))
        if val == 'proxima_semana':
            start = today + timedelta(days=(7 - today.weekday()))
            end = start + timedelta(days=6)
            return queryset.filter(dia_agendado__date__range=(start, end))
        if val == 'proximo_mes':
            year, month = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
            start = today.replace(year=year, month=month, day=1)
            last = calendar.monthrange(year, month)[1]
            end = today.replace(year=year, month=month, day=last)
            return queryset.filter(dia_agendado__date__range=(start, end))
        if val == 'ultimos_7_dias':
            return queryset.filter(dia_agendado__date__gte=today - timedelta(days=7))
        if val == 'ultimos_30_dias':
            return queryset.filter(dia_agendado__date__gte=today - timedelta(days=30))
        return queryset


class TabulacaoAgendamentoFilter(admin.SimpleListFilter):
    title = 'Tabulação do Agendamento'
    parameter_name = 'tabulacao_agendamento'

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        raw = qs.values_list('tabulacao_agendamento', flat=True)
        unique = sorted({v.strip() for v in raw if v and v.strip()})
        return [(u, u) for u in unique]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(tabulacao_agendamento=self.value())
        return queryset


class DataPresencaFilter(admin.SimpleListFilter):
    title = 'Data da Presença'
    parameter_name = 'data_presenca_range'

    # Reuse same lookups as DataAgendamentoFilter
    def lookups(self, request, model_admin):
        return DataAgendamentoFilter.lookups(self, request, model_admin)

    def queryset(self, request, queryset):
        today = timezone.now().date()
        val = self.value()
        field = 'data_presenca__date'
        if val == 'hoje':
            return queryset.filter(**{field: today})
        if val == 'ontem':
            return queryset.filter(**{field: today - timedelta(days=1)})
        if val == 'semana':
            start = today - timedelta(days=today.weekday()); end = start + timedelta(days=6)
            return queryset.filter(**{f"{field}__range": (start, end)})
        if val == 'mes':
            start = today.replace(day=1); last = calendar.monthrange(today.year, today.month)[1]
            end = today.replace(day=last)
            return queryset.filter(**{f"{field}__range": (start, end)})
        if val == 'mes_anterior':
            year, month = (today.year - 1, 12) if today.month == 1 else (today.year, today.month - 1)
            start = today.replace(year=year, month=month, day=1)
            last = calendar.monthrange(year, month)[1]; end = today.replace(year=year, month=month, day=last)
            return queryset.filter(**{f"{field}__range": (start, end)})
        if val == 'proxima_semana':
            start = today + timedelta(days=(7 - today.weekday())); end = start + timedelta(days=6)
            return queryset.filter(**{f"{field}__range": (start, end)})
        if val == 'proximo_mes':
            year, month = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
            start = today.replace(year=year, month=month, day=1)
            last = calendar.monthrange(year, month)[1]; end = today.replace(year=year, month=month, day=last)
            return queryset.filter(**{f"{field}__range": (start, end)})
        if val == 'ultimos_7_dias':
            return queryset.filter(**{f"{field}__gte": today - timedelta(days=7)})
        if val == 'ultimos_30_dias':
            return queryset.filter(**{f"{field}__gte": today - timedelta(days=30)})
        return queryset


class TabulacaoVendaFilter(admin.SimpleListFilter):
    title = 'Tabulação da Venda'
    parameter_name = 'tabulacao_venda'

    def lookups(self, request, model_admin):
        qs = model_admin.get_queryset(request)
        raw = qs.values_list('tabulacao_venda', flat=True)
        unique = sorted({v.strip() for v in raw if v and v.strip()})
        return [(u, u) for u in unique]

    def queryset(self, request, queryset):
        if self.value():
            return queryset.filter(tabulacao_venda=self.value())
        return queryset


class ValorTacFilter(admin.SimpleListFilter):
    title = 'Possui Valor TAC'
    parameter_name = 'tem_valor_tac'

    def lookups(self, request, model_admin):
        return (
            ('sim', 'Sim'),
            ('nao', 'Não'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'sim':
            return queryset.filter(valor_tac__isnull=False).exclude(valor_tac=0)
        if self.value() == 'nao':
            return queryset.filter(valor_tac__isnull=True) | queryset.filter(valor_tac=0)
        return queryset


# --- REGISTROS NO ADMIN ---

@admin.register(ClienteAgendamento)
class ClienteAgendamentoAdmin(admin.ModelAdmin):
    list_display = ('nome_completo', 'cpf', 'numero', 'flg_whatsapp', 'status')
    list_filter = ('status', 'flg_whatsapp')
    search_fields = ('nome_completo', 'cpf', 'numero')
    list_editable = ('status', 'flg_whatsapp')
    list_per_page = 50
    actions = ['ativar_clientes', 'desativar_clientes']

    def ativar_clientes(self, request, queryset):
        updated = queryset.update(status=True)
        self.message_user(request, f'{updated} clientes ativados com sucesso.')
    ativar_clientes.short_description = 'Ativar clientes selecionados'

    def desativar_clientes(self, request, queryset):
        updated = queryset.update(status=False)
        self.message_user(request, f'{updated} clientes desativados com sucesso.')
    desativar_clientes.short_description = 'Desativar clientes selecionados'


@admin.register(Agendamento)
class AgendamentoAdmin(admin.ModelAdmin):
    list_display = (
        'id', 'get_cliente_nome', 'get_cliente_cpf', 'dia_agendado',
        'loja', 'get_atendente_username', 'tabulacao_agendamento',
        'data_criacao'
    )
    list_filter = (
        DataAgendamentoFilter,
        TabulacaoAgendamentoFilter,
        'loja',
        'atendente_agendou',
    )
    search_fields = (
        'cliente_agendamento__nome_completo',
        'cliente_agendamento__cpf',
        'loja__nome',
        'atendente_agendou__username',
        'atendente_agendou__first_name',
        'atendente_agendou__last_name'
    )
    date_hierarchy = 'dia_agendado'
    autocomplete_fields = ('cliente_agendamento', 'loja', 'atendente_agendou')
    ordering = ('-dia_agendado',)
    readonly_fields = ('data_criacao',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'cliente_agendamento', 'loja', 'atendente_agendou'
        )

    @admin.display(description='Cliente', ordering='cliente_agendamento__nome_completo')
    def get_cliente_nome(self, obj):
        return obj.cliente_agendamento.nome_completo if obj.cliente_agendamento else '-'

    @admin.display(description='CPF Cliente', ordering='cliente_agendamento__cpf')
    def get_cliente_cpf(self, obj):
        return obj.cliente_agendamento.cpf if obj.cliente_agendamento else '-'

    @admin.display(description='Atendente', ordering='atendente_agendou__username')
    def get_atendente_username(self, obj):
        return obj.atendente_agendou.username if obj.atendente_agendou else '-'


@admin.register(PresencaLoja)
class PresencaLojaAdmin(admin.ModelAdmin):
    list_display = (
        'get_cliente_info', 'get_agendamento_info', 'loja_comp', 'vendedor',
        'tabulacao_venda', 'status_pagamento', 'valor_tac',
        'cliente_rua', 'data_presenca'
    )
    list_filter = (
        TabulacaoVendaFilter,
        'status_pagamento',
        ValorTacFilter,
        'cliente_rua',
        'loja_comp',
        'vendedor',
        DataPresencaFilter,
        'subsidio',
        'acao',
        'associacao',
        'aumento'
    )
    search_fields = (
        'agendamento__cliente_agendamento__nome_completo',
        'agendamento__cliente_agendamento__cpf',
        'cliente_agendamento__nome_completo',
        'cliente_agendamento__cpf',
        'vendedor__username',
        'tipo_negociacao',
        'banco'
    )
    autocomplete_fields = ('agendamento', 'cliente_agendamento', 'loja_comp', 'vendedor')
    ordering = ('-data_presenca',)
    readonly_fields = ('data_presenca', 'data_pagamento')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'agendamento__cliente_agendamento',
            'cliente_agendamento',
            'loja_comp',
            'vendedor'
        )

    @admin.display(description='Cliente')
    def get_cliente_info(self, obj):
        if obj.agendamento and obj.agendamento.cliente_agendamento:
            return obj.agendamento.cliente_agendamento
        if obj.cliente_agendamento:
            return obj.cliente_agendamento
        return '-'

    @admin.display(description='Agendamento ID')
    def get_agendamento_info(self, obj):
        return obj.agendamento.id if obj.agendamento else 'N/A (Cliente Rua)'

    def changelist_view(self, request, extra_context=None):
        # Obtém o queryset filtrado que será exibido na lista
        cl = self.get_changelist_instance(request)
        queryset = cl.get_queryset(request)
        
        # Calcula a soma dos valores TAC (ignorando valores nulos)
        total_tac = queryset.filter(valor_tac__isnull=False).aggregate(
            total=models.Sum('valor_tac')
        )['total'] or 0
        
        # Formata o valor para exibição
        formatted_total = f"R$ {total_tac:.2f}".replace('.', ',')
        
        # Prepara o contexto extra
        extra_context = extra_context or {}
        extra_context['total_tac'] = formatted_total
        
        # Obtém o número de resultados para exibir junto com a soma
        count = queryset.count()
        extra_context['subtitle'] = f"{count} Presenças/Resultados em Loja - Total TAC: {formatted_total}"
        
        # Chama o método original com o contexto extra
        return super().changelist_view(request, extra_context=extra_context)
