from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from django.db.models import Count, Q
from django.contrib.auth.models import User
from .models import *
import os


# --- Filtros Personalizados ---

class FuncionarioMEIFilter(admin.SimpleListFilter):
    """Filtro personalizado para funcionários MEI"""
    title = 'Funcionários MEI Ativos'
    parameter_name = 'mei_ativo'

    def lookups(self, request, model_admin):
        return (
            ('sim', 'Apenas MEI Ativos'),
            ('nao', 'Não MEI ou Inativos'),
            ('todos_mei', 'Todos os MEI'),
        )

    def queryset(self, request, queryset):
        if self.value() == 'sim':
            return queryset.filter(tipo_contrato='MEI', status=True)
        elif self.value() == 'nao':
            return queryset.exclude(tipo_contrato='MEI', status=True)
        elif self.value() == 'todos_mei':
            return queryset.filter(tipo_contrato='MEI')
        return queryset


class FuncionarioAtivosFilter(admin.SimpleListFilter):
    """Filtro para status do funcionário"""
    title = 'Status do Funcionário'
    parameter_name = 'status_funcionario'

    def lookups(self, request, model_admin):
        return (
            ('ativo', 'Ativos'),
            ('inativo', 'Inativos'),
            ('admitidos_recente', 'Admitidos nos últimos 30 dias'),
            ('demitidos_recente', 'Demitidos nos últimos 30 dias'),
        )

    def queryset(self, request, queryset):
        from django.utils import timezone
        from datetime import timedelta
        
        if self.value() == 'ativo':
            return queryset.filter(status=True)
        elif self.value() == 'inativo':
            return queryset.filter(status=False)
        elif self.value() == 'admitidos_recente':
            data_limite = timezone.now().date() - timedelta(days=30)
            return queryset.filter(data_admissao__gte=data_limite)
        elif self.value() == 'demitidos_recente':
            data_limite = timezone.now().date() - timedelta(days=30)
            return queryset.filter(data_demissao__gte=data_limite)
        return queryset


# --- Inlines ---

class ArquivoFuncionarioInline(admin.TabularInline):
    """Inline para arquivos dos funcionários"""
    model = ArquivoFuncionario
    extra = 0
    readonly_fields = ['data_upload', 'get_arquivo_tamanho']
    fields = ['titulo', 'arquivo', 'get_arquivo_tamanho', 'status', 'data_upload']
    
    def get_arquivo_tamanho(self, obj):
        return obj.get_tamanho_arquivo() if obj.pk else '—'
    get_arquivo_tamanho.short_description = 'Tamanho'


class ControleComunicadoInline(admin.TabularInline):
    """Inline para controle de comunicados"""
    model = ControleComunicado
    extra = 0
    readonly_fields = ['data_leitura']
    fields = ['usuario', 'lido', 'data_leitura']


class ArquivoComunicadoInline(admin.TabularInline):
    """Inline para arquivos de comunicados"""
    model = ArquivoComunicado
    extra = 1
    fields = ['arquivo', 'status']


# --- Administradores dos Modelos ---

@admin.register(Empresa)
class EmpresaAdmin(admin.ModelAdmin):
    list_display = ['nome', 'cnpj', 'endereco', 'total_funcionarios', 'status']
    search_fields = ['nome', 'cnpj']
    list_filter = ['status']
    list_editable = ['status']
    ordering = ['nome']
    
    fieldsets = (
        ('Informações da Empresa', {
            'fields': ('nome', 'cnpj', 'endereco', 'status')
        }),
    )
    
    @admin.display(description='Total Funcionários', ordering='funcionarios_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'funcionarios_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?empresa__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'
    
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            funcionarios_count=Count('funcionarios', filter=Q(funcionarios__status=True))
        )


@admin.register(Loja)
class LojaAdmin(admin.ModelAdmin):
    list_display = ['nome', 'empresa', 'preview_logo', 'franquia', 'filial', 'total_funcionarios', 'status']
    list_filter = ['empresa', 'franquia', 'filial', 'status']
    search_fields = ['nome', 'empresa__nome']
    list_editable = ['status', 'franquia', 'filial']
    autocomplete_fields = ['empresa']
    ordering = ['empresa__nome', 'nome']
    
    fieldsets = (
        ('Informações da Loja', {
            'fields': ('nome', 'empresa', 'logo')
        }),
        ('Configurações', {
            'fields': ('franquia', 'filial', 'status')
        }),
    )
    
    @admin.display(description='Logo', ordering='logo')
    def preview_logo(self, obj):
        if obj.logo:
            return format_html(
                '<img src="{}" style="max-width: 50px; max-height: 50px; border-radius: 4px;" />',
                obj.logo.url
            )
        return '—'
    
    @admin.display(description='Total Funcionários', ordering='funcionarios_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'funcionarios_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?lojas__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('empresa').annotate(
            funcionarios_count=Count('funcionarios', filter=Q(funcionarios__status=True))
        )


@admin.register(Departamento)
class DepartamentoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'empresa', 'total_setores', 'total_funcionarios', 'status']
    list_filter = ['empresa', 'status']
    search_fields = ['nome', 'empresa__nome']
    list_editable = ['status']
    autocomplete_fields = ['empresa']
    ordering = ['empresa__nome', 'nome']
    
    @admin.display(description='Total Setores', ordering='setores_count')
    def total_setores(self, obj):
        count = getattr(obj, 'setores_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_setor_changelist') + f'?departamento__id__exact={obj.id}'
            return format_html('<a href="{}">{} setores</a>', url, count)
        return '0 setores'
    
    @admin.display(description='Total Funcionários', ordering='funcionarios_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'funcionarios_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?departamento__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('empresa').annotate(
            setores_count=Count('setores', filter=Q(setores__status=True)),
            funcionarios_count=Count('funcionarios', filter=Q(funcionarios__status=True))
        )


@admin.register(Setor)
class SetorAdmin(admin.ModelAdmin):
    list_display = ['nome', 'departamento_nome', 'empresa_nome', 'total_funcionarios', 'status']
    list_filter = ['departamento__empresa', 'departamento', 'status']
    search_fields = ['nome', 'departamento__nome', 'departamento__empresa__nome']
    list_editable = ['status']
    autocomplete_fields = ['departamento']
    ordering = ['departamento__empresa__nome', 'departamento__nome', 'nome']

    @admin.display(description='Departamento', ordering='departamento__nome')
    def departamento_nome(self, obj):
        return obj.departamento.nome if obj.departamento else '—'

    @admin.display(description='Empresa', ordering='departamento__empresa__nome')
    def empresa_nome(self, obj):
        return obj.departamento.empresa.nome if obj.departamento and obj.departamento.empresa else '—'
    
    @admin.display(description='Total Funcionários', ordering='funcionarios_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'funcionarios_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?setor__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'departamento', 'departamento__empresa'
        ).annotate(
            funcionarios_count=Count('funcionarios', filter=Q(funcionarios__status=True))
        )


@admin.register(Equipe)
class EquipeAdmin(admin.ModelAdmin):
    list_display = ['nome', 'total_participantes', 'total_funcionarios', 'status']
    list_filter = ['status']
    search_fields = ['nome']
    list_editable = ['status']
    filter_horizontal = ['participantes']
    ordering = ['nome']

    @admin.display(description='Participantes', ordering='participantes_count')
    def total_participantes(self, obj):
        count = getattr(obj, 'participantes_count', 0)
        if count > 0:
            return format_html('<strong>{}</strong> participantes', count)
        return '0 participantes'
    
    @admin.display(description='Funcionários', ordering='membros_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'membros_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?equipe__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            participantes_count=Count('participantes'),
            membros_count=Count('membros', filter=Q(membros__status=True))
        )


@admin.register(Cargo)
class CargoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'empresa', 'get_hierarquia_display', 'total_funcionarios', 'status']
    list_filter = ['empresa', 'hierarquia', 'status']
    search_fields = ['nome', 'empresa__nome']
    list_editable = ['status']
    autocomplete_fields = ['empresa']
    ordering = ['empresa__nome', 'hierarquia', 'nome']

    @admin.display(description='Nível Hierárquico', ordering='hierarquia')
    def get_hierarquia_display(self, obj):
        return obj.get_hierarquia_display()
    
    @admin.display(description='Total Funcionários', ordering='funcionarios_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'funcionarios_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?cargo__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'
    
    def get_queryset(self, request):
        return super().get_queryset(request).select_related('empresa').annotate(
            funcionarios_count=Count('funcionarios', filter=Q(funcionarios__status=True))
        )


@admin.register(HorarioTrabalho)
class HorarioTrabalhoAdmin(admin.ModelAdmin):
    list_display = ['nome', 'entrada', 'saida_almoco', 'volta_almoco', 'saida', 'get_carga_horaria', 'total_funcionarios', 'status']
    search_fields = ['nome']
    list_filter = ['status']
    list_editable = ['status']
    ordering = ['nome']
    
    @admin.display(description='Carga Horária')
    def get_carga_horaria(self, obj):
        """Calcula e exibe a carga horária diária"""
        try:
            from datetime import datetime, timedelta
            
            # Converte os horários para datetime para calcular
            base_date = datetime(2000, 1, 1)  # Data base qualquer
            entrada = datetime.combine(base_date.date(), obj.entrada)
            saida_almoco = datetime.combine(base_date.date(), obj.saida_almoco)
            volta_almoco = datetime.combine(base_date.date(), obj.volta_almoco)
            saida = datetime.combine(base_date.date(), obj.saida)
            
            # Calcula o tempo trabalhado
            periodo_manha = saida_almoco - entrada
            periodo_tarde = saida - volta_almoco
            total_trabalho = periodo_manha + periodo_tarde
            
            # Converte para horas e minutos
            horas = total_trabalho.seconds // 3600
            minutos = (total_trabalho.seconds % 3600) // 60
            
            return f"{horas:02d}h{minutos:02d}"
        except:
            return "—"
    
    @admin.display(description='Total Funcionários', ordering='funcionarios_count')
    def total_funcionarios(self, obj):
        count = getattr(obj, 'funcionarios_count', 0)
        if count > 0:
            url = reverse('admin:funcionarios_funcionario_changelist') + f'?horario__id__exact={obj.id}'
            return format_html('<a href="{}">{} funcionários</a>', url, count)
        return '0 funcionários'
    
    def get_queryset(self, request):
        return super().get_queryset(request).annotate(
            funcionarios_count=Count('funcionarios', filter=Q(funcionarios__status=True))
        )


@admin.register(Funcionario)
class FuncionarioAdmin(admin.ModelAdmin):
    list_display = [
        'get_display_name', 'cpf_formatado', 'matricula', 'get_tipo_contrato_display', 
        'empresa', 'get_lojas', 'departamento', 'cargo', 'get_status_display'
    ]
    list_filter = [
        FuncionarioMEIFilter, FuncionarioAtivosFilter, 'tipo_contrato', 'empresa', 
        'departamento', 'setor', 'cargo', 'equipe', 'status', 'lojas', 
        'data_admissao', 'data_demissao'
    ]
    search_fields = [
        'nome_completo', 'apelido', 'cpf', 'matricula', 'celular1', 
        'lojas__nome', 'pis', 'endereco', 'cidade'
    ]
    list_per_page = 25
    autocomplete_fields = ['empresa', 'departamento', 'setor', 'cargo', 'horario', 'equipe', 'usuario']
    filter_horizontal = ['lojas', 'regras_comissionamento']
    readonly_fields = ['get_foto_preview']
    actions = [
        'marcar_como_mei', 'marcar_como_clt', 'marcar_como_estagio', 
        'ativar_funcionarios', 'desativar_funcionarios'
    ]
    inlines = [ArquivoFuncionarioInline]

    fieldsets = (
        ('Informações Pessoais', {
            'fields': (
                'get_foto_preview', 'foto', 'nome_completo', 'apelido', 'cpf', 
                'data_nascimento', 'genero', 'estado_civil'
            )
        }),
        ('Informações de Contato', {
            'fields': (
                'cep', 'endereco', 'bairro', 'cidade', 'estado', 
                'celular1', 'celular2'
            ),
            'classes': ('collapse',)
        }),
        ('Informações Familiares', {
            'fields': ('nome_mae', 'nome_pai', 'nacionalidade', 'naturalidade'),
            'classes': ('collapse',)
        }),
        ('Informações Profissionais', {
            'fields': (
                'usuario', 'matricula', 'pis', 'tipo_contrato', 'empresa', 'lojas',
                'departamento', 'setor', 'cargo', 'horario', 'equipe', 'status'
            )
        }),
        ('Datas Importantes', {
            'fields': ('data_admissao', 'data_demissao'),
            'classes': ('collapse',)
        }),
        ('Comissionamento', {
            'fields': ('regras_comissionamento',),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Nome', ordering='nome_completo')
    def get_display_name(self, obj):
        display = obj.apelido if obj.apelido else (obj.nome_completo.split()[0] if obj.nome_completo else 'Sem Nome')
        if obj.foto:
            return format_html(
                '<img src="{}" style="width: 30px; height: 30px; border-radius: 50%; margin-right: 8px; vertical-align: middle;" /><strong>{}</strong>',
                obj.foto.url, display
            )
        return display

    @admin.display(description='CPF', ordering='cpf')
    def cpf_formatado(self, obj):
        if obj.cpf and len(obj.cpf) == 11:
            return f"{obj.cpf[:3]}.{obj.cpf[3:6]}.{obj.cpf[6:9]}-{obj.cpf[9:]}"
        return obj.cpf

    @admin.display(description='Tipo Contrato', ordering='tipo_contrato')
    def get_tipo_contrato_display(self, obj):
        if obj.tipo_contrato:
            cores = {
                'CLT': '#28a745',  # Verde
                'MEI': '#ffc107',  # Amarelo
                'ESTAGIO': '#17a2b8'  # Azul
            }
            cor = cores.get(obj.tipo_contrato, '#6c757d')
            return format_html(
                '<span style="color: {}; font-weight: bold;">{}</span>',
                cor, obj.get_tipo_contrato_display()
            )
        return '—'

    @admin.display(description='Lojas')
    def get_lojas(self, obj):
        lojas = obj.lojas.all()[:3]  # Limita a 3 para não sobrecarregar
        nomes = [loja.nome for loja in lojas]
        if obj.lojas.count() > 3:
            nomes.append(f"... (+{obj.lojas.count() - 3})")
        return ", ".join(nomes) if nomes else "—"

    @admin.display(description='Status', ordering='status')
    def get_status_display(self, obj):
        if obj.status:
            return format_html('<span style="color: #28a745; font-weight: bold;">✓ Ativo</span>')
        else:
            return format_html('<span style="color: #dc3545; font-weight: bold;">✗ Inativo</span>')

    @admin.display(description='Foto')
    def get_foto_preview(self, obj):
        if obj.foto:
            return mark_safe(f'<img src="{obj.foto.url}" style="max-width: 100px; max-height: 100px; border-radius: 8px;" />')
        return 'Sem foto'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'empresa', 'departamento', 'setor', 'cargo', 'horario', 'equipe', 'usuario'
        ).prefetch_related('lojas', 'regras_comissionamento')

    # Actions
    @admin.action(description="Alterar para MEI")
    def marcar_como_mei(self, request, queryset):
        updated = queryset.update(tipo_contrato='MEI')
        self.message_user(request, f'{updated} funcionário(s) foram alterados para MEI.')

    @admin.action(description="Alterar para CLT")
    def marcar_como_clt(self, request, queryset):
        updated = queryset.update(tipo_contrato='CLT')
        self.message_user(request, f'{updated} funcionário(s) foram alterados para CLT.')

    @admin.action(description="Alterar para Estágio")
    def marcar_como_estagio(self, request, queryset):
        updated = queryset.update(tipo_contrato='ESTAGIO')
        self.message_user(request, f'{updated} funcionário(s) foram alterados para Estágio.')

    @admin.action(description="Ativar funcionários selecionados")
    def ativar_funcionarios(self, request, queryset):
        updated = queryset.update(status=True)
        self.message_user(
            request, f'{updated} funcionário(s) foram ativados.',
            level='success' if updated > 0 else 'warning'
        )

    @admin.action(description="Desativar funcionários selecionados")
    def desativar_funcionarios(self, request, queryset):
        updated = queryset.update(status=False)
        self.message_user(
            request, f'{updated} funcionário(s) foram desativados.',
            level='success' if updated > 0 else 'warning'
        )


@admin.register(ArquivoFuncionario)
class ArquivoFuncionarioAdmin(admin.ModelAdmin):
    list_display = ['titulo', 'funcionario_nome', 'get_arquivo_tamanho', 'data_upload', 'status']
    list_filter = [
        'status', 'data_upload',
        'funcionario__tipo_contrato',
        ('funcionario__empresa', admin.RelatedOnlyFieldListFilter),
        ('funcionario__departamento', admin.RelatedOnlyFieldListFilter),
        ('funcionario__setor', admin.RelatedOnlyFieldListFilter),
        ('funcionario__cargo', admin.RelatedOnlyFieldListFilter),
        ('funcionario__equipe', admin.RelatedOnlyFieldListFilter),
        'funcionario__status',
    ]
    search_fields = [
        'titulo', 'descricao', 'funcionario__nome_completo', 
        'funcionario__apelido', 'funcionario__cpf'
    ]
    list_editable = ['status']
    autocomplete_fields = ['funcionario']
    readonly_fields = ['data_upload', 'get_arquivo_tamanho']
    list_per_page = 25
    actions = ['mark_active', 'mark_inactive']
    ordering = ['-data_upload']

    fieldsets = (
        ('Informações do Arquivo', {
            'fields': ('titulo', 'descricao', 'arquivo', 'status')
        }),
        ('Vinculação', {
            'fields': ('funcionario',)
        }),
        ('Metadados', {
            'fields': ('data_upload', 'get_arquivo_tamanho'),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Tamanho', ordering='arquivo')
    def get_arquivo_tamanho(self, obj):
        return obj.get_tamanho_arquivo()

    @admin.display(description='Funcionário', ordering='funcionario__nome_completo')
    def funcionario_nome(self, obj):
        return obj.get_nome_funcionario()

    @admin.action(description="Marcar selecionados como Ativos")
    def mark_active(self, request, queryset):
        updated = queryset.update(status=True)
        self.message_user(request, f'{updated} arquivo(s) foram marcados como ativos.')

    @admin.action(description="Marcar selecionados como Inativos")
    def mark_inactive(self, request, queryset):
        updated = queryset.update(status=False)
        self.message_user(request, f'{updated} arquivo(s) foram marcados como inativos.')

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('funcionario')


@admin.register(Comissionamento)
class ComissionamentoAdmin(admin.ModelAdmin):
    list_display = [
        'titulo', 'escopo_base', 'percentual', 'valor_fixo',
        'status', 'data_inicio', 'data_fim', 'data_criacao'
    ]
    list_filter = [
        'status', 'escopo_base', 'data_inicio', 'data_fim',
        ('empresas', admin.RelatedOnlyFieldListFilter),
        ('lojas', admin.RelatedOnlyFieldListFilter),
        ('departamentos', admin.RelatedOnlyFieldListFilter),
        ('setores', admin.RelatedOnlyFieldListFilter),
        ('equipes', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = ['titulo']
    list_editable = ['status']
    filter_horizontal = ['empresas', 'lojas', 'departamentos', 'setores', 'equipes']
    readonly_fields = ['data_criacao', 'data_atualizacao']
    ordering = ['-status', '-data_criacao', 'titulo']
    list_per_page = 20

    fieldsets = (
        ('Configuração da Regra', {
            'fields': ('titulo', 'escopo_base', 'status')
        }),
        ('Método de Cálculo', {
            'description': "Defina como a comissão será calculada. Preencha Percentual OU Valor Fixo. Use os campos 'Valor De/Até' para faixas.",
            'fields': ('percentual', 'valor_fixo', 'valor_de', 'valor_ate')
        }),
        ('Aplicabilidade (Filtros)', {
            'description': "Selecione as entidades onde esta regra se aplica. Se vazio, pode aplicar-se a todas (dependendo de outros filtros).",
            'fields': ('empresas', 'lojas', 'departamentos', 'setores', 'equipes')
        }),
        ('Vigência', {
            'fields': ('data_inicio', 'data_fim'),
            'classes': ('collapse',)
        }),
        ('Auditoria', {
            'fields': ('data_criacao', 'data_atualizacao'),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        return super().get_queryset(request)


@admin.register(Comunicado)
class ComunicadoAdmin(admin.ModelAdmin):
    list_display = [
        'assunto', 'criado_por', 'data_criacao', 'status', 
        'get_destinatarios_count', 'get_arquivos_count', 'get_lidos_count'
    ]
    list_filter = [
        'status', 'data_criacao',
        ('criado_por', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'assunto', 'texto', 'criado_por__username',
        'criado_por__first_name', 'criado_por__last_name'
    ]
    list_editable = ['status']
    filter_horizontal = ['destinatarios']
    readonly_fields = ['data_criacao', 'get_preview_banner']
    ordering = ['-data_criacao']
    list_per_page = 20
    inlines = [ArquivoComunicadoInline, ControleComunicadoInline]

    fieldsets = (
        ('Comunicado', {
            'fields': ('assunto', 'texto', 'banner', 'get_preview_banner', 'status')
        }),
        ('Destinatários', {
            'fields': ('destinatarios',)
        }),
        ('Auditoria', {
            'fields': ('criado_por', 'data_criacao'),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Destinatários', ordering='destinatarios_count')
    def get_destinatarios_count(self, obj):
        count = getattr(obj, 'destinatarios_count', 0)
        return f"{count} destinatários"

    @admin.display(description='Arquivos', ordering='arquivos_count')
    def get_arquivos_count(self, obj):
        count = getattr(obj, 'arquivos_count', 0)
        if count > 0:
            return format_html('<strong>{}</strong> arquivos', count)
        return '0 arquivos'
    
    @admin.display(description='Lidos', ordering='lidos_count')
    def get_lidos_count(self, obj):
        total = getattr(obj, 'destinatarios_count', 0)
        lidos = getattr(obj, 'lidos_count', 0)
        if total > 0:
            porcentagem = (lidos / total) * 100
            return format_html(
                '<span style="color: {};">{}/{} ({:.1f}%)</span>',
                '#28a745' if porcentagem > 70 else '#ffc107' if porcentagem > 30 else '#dc3545',
                lidos, total, porcentagem
            )
        return '0/0'

    @admin.display(description='Preview do Banner')
    def get_preview_banner(self, obj):
        if obj.banner:
            return mark_safe(f'<img src="{obj.banner.url}" style="max-width: 200px; max-height: 100px; border-radius: 8px;" />')
        return 'Sem banner'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('criado_por').annotate(
            destinatarios_count=Count('destinatarios'),
            arquivos_count=Count('arquivos'),
            lidos_count=Count('controles', filter=Q(controles__lido=True))
        )


@admin.register(ControleComunicado)
class ControleComunicadoAdmin(admin.ModelAdmin):
    list_display = ['comunicado_assunto', 'usuario_nome', 'lido', 'data_leitura']
    list_filter = [
        'lido', 'data_leitura',
        ('comunicado', admin.RelatedOnlyFieldListFilter),
        ('usuario', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'comunicado__assunto', 'usuario__username',
        'usuario__first_name', 'usuario__last_name'
    ]
    list_editable = ['lido']
    readonly_fields = ['data_leitura']
    ordering = ['-data_leitura']
    list_per_page = 25

    fieldsets = (
        ('Controle de Leitura', {
            'fields': ('comunicado', 'usuario', 'lido', 'data_leitura')
        }),
    )
    
    @admin.display(description='Comunicado', ordering='comunicado__assunto')
    def comunicado_assunto(self, obj):
        return obj.comunicado.assunto
    
    @admin.display(description='Usuário', ordering='usuario__username')
    def usuario_nome(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('comunicado', 'usuario')


@admin.register(ArquivoComunicado)
class ArquivoComunicadoAdmin(admin.ModelAdmin):
    list_display = [
        'get_nome_arquivo', 'comunicado_assunto', 'get_tamanho_arquivo',
        'data_criacao', 'status'
    ]
    list_filter = [
        'status', 'data_criacao',
        ('comunicado', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = ['arquivo', 'comunicado__assunto']
    list_editable = ['status']
    readonly_fields = ['data_criacao', 'get_tamanho_arquivo']
    ordering = ['-data_criacao']
    list_per_page = 25

    fieldsets = (
        ('Arquivo', {
            'fields': ('comunicado', 'arquivo', 'get_tamanho_arquivo', 'status')
        }),
        ('Auditoria', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Arquivo', ordering='arquivo')
    def get_nome_arquivo(self, obj):
        if obj.arquivo:
            return os.path.basename(obj.arquivo.name)
        return '—'
    
    @admin.display(description='Comunicado', ordering='comunicado__assunto')
    def comunicado_assunto(self, obj):
        return obj.comunicado.assunto

    @admin.display(description='Tamanho', ordering='arquivo')
    def get_tamanho_arquivo(self, obj):
        try:
            if obj.arquivo and hasattr(obj.arquivo, 'size'):
                tamanho = obj.arquivo.size
                if tamanho < 1024:
                    return f"{tamanho} bytes"
                elif tamanho < 1024 * 1024:
                    return f"{tamanho/1024:.1f} KB"
                else:
                    return f"{tamanho/(1024*1024):.1f} MB"
            return "Arquivo não disponível"
        except:
            return "Erro ao calcular tamanho"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('comunicado')


@admin.register(EntradaAuto)
class EntradaAutoAdmin(admin.ModelAdmin):
    list_display = ['usuario_nome', 'data', 'datahora', 'ip_usado', 'get_funcionario_info']
    list_filter = [
        'data', 'datahora',
        ('usuario', admin.RelatedOnlyFieldListFilter),
        'usuario__funcionario_profile__tipo_contrato',
        ('usuario__funcionario_profile__empresa', admin.RelatedOnlyFieldListFilter),
        ('usuario__funcionario_profile__equipe', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'usuario__username', 'usuario__first_name', 'usuario__last_name',
        'usuario__funcionario_profile__nome_completo', 'ip_usado'
    ]
    # Agora os campos são editáveis pois removemos auto_now_add=True
    list_editable = ['data', 'datahora']
    ordering = ['-datahora']
    list_per_page = 50
    date_hierarchy = 'data'

    fieldsets = (
        ('Informações de Entrada Automática', {
            'fields': ('usuario', 'ip_usado')
        }),
        ('Datas e Horários', {
            'fields': ('data', 'datahora'),
            'description': 'Você pode editar estes campos quando necessário.'
        }),
    )
    actions = ['editar_data_hora_entrada']

    @admin.action(description="Editar data e hora de entradas selecionadas")
    def editar_data_hora_entrada(self, request, queryset):
        """Action personalizada para editar data e hora de entradas automáticas"""
        from django.shortcuts import render, redirect
        from django import forms
        from django.contrib import messages
        from datetime import datetime
        
        class EditarDataHoraForm(forms.Form):
            data = forms.DateField(
                label="Nova Data",
                widget=forms.DateInput(attrs={'type': 'date'}),
                help_text="Formato: DD/MM/AAAA"
            )
            datahora = forms.DateTimeField(
                label="Nova Data e Hora",
                widget=forms.DateTimeInput(attrs={'type': 'datetime-local'}),
                help_text="Formato: DD/MM/AAAA HH:MM"
            )
        
        if 'aplicar' in request.POST:
            form = EditarDataHoraForm(request.POST)
            if form.is_valid():
                nova_data = form.cleaned_data['data']
                nova_datahora = form.cleaned_data['datahora']
                
                count = 0
                for entrada in queryset:
                    # Atualizar diretamente no banco para contornar auto_now_add
                    entrada.__class__.objects.filter(pk=entrada.pk).update(
                        data=nova_data,
                        datahora=nova_datahora
                    )
                    count += 1
                
                messages.success(
                    request, 
                    f'{count} entrada(s) automática(s) foram atualizadas com sucesso.'
                )
                return redirect(request.get_full_path())
        else:
            form = EditarDataHoraForm()
        
        return render(
            request,
            'admin/funcionarios/editar_data_hora.html',
            {
                'form': form,
                'entradas': queryset,
                'title': 'Editar Data e Hora das Entradas Automáticas'
            }
        )

    @admin.display(description='Usuário', ordering='usuario__username')
    def usuario_nome(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username

    @admin.display(description='Info Funcionário', ordering='usuario__funcionario_profile__tipo_contrato')
    def get_funcionario_info(self, obj):
        try:
            funcionario = obj.usuario.funcionario_profile
            if funcionario:
                info = f"{funcionario.get_tipo_contrato_display() or 'N/A'}"
                if funcionario.empresa:
                    info += f" - {funcionario.empresa.nome}"
                return info
            return "Sem perfil de funcionário"
        except:
            return "N/A"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'usuario', 'usuario__funcionario_profile', 'usuario__funcionario_profile__empresa'
        )


@admin.register(RegistroPresenca)
class RegistroPresencaAdmin(admin.ModelAdmin):
    list_display = ['get_usuario_nome', 'data_entrada', 'tipo', 'datahora', 'get_funcionario_info']
    list_filter = [
        'tipo', 'datahora', 'entrada_auto__data',
        ('entrada_auto__usuario', admin.RelatedOnlyFieldListFilter),
        'entrada_auto__usuario__funcionario_profile__tipo_contrato',
        ('entrada_auto__usuario__funcionario_profile__empresa', admin.RelatedOnlyFieldListFilter),
        ('entrada_auto__usuario__funcionario_profile__equipe', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'entrada_auto__usuario__username', 'entrada_auto__usuario__first_name',
        'entrada_auto__usuario__last_name', 'entrada_auto__usuario__funcionario_profile__nome_completo'
    ]
    # Agora o campo datahora é editável pois removemos auto_now_add=True
    list_editable = ['tipo', 'datahora']
    ordering = ['-datahora']
    list_per_page = 50
    date_hierarchy = 'datahora'

    fieldsets = (
        ('Informações do Registro de Presença', {
            'fields': ('entrada_auto', 'tipo', 'datahora')
        }),
    )
    actions = ['editar_data_hora_registro']

    @admin.action(description="Editar data e hora de registros selecionados")
    def editar_data_hora_registro(self, request, queryset):
        """Action personalizada para editar data e hora de registros de presença"""
        from django.shortcuts import render, redirect
        from django import forms
        from django.contrib import messages
        from datetime import datetime
        
        class EditarDataHoraRegistroForm(forms.Form):
            datahora = forms.DateTimeField(
                label="Nova Data e Hora",
                widget=forms.DateTimeInput(attrs={'type': 'datetime-local'}),
                help_text="Formato: DD/MM/AAAA HH:MM"
            )
        
        if 'aplicar' in request.POST:
            form = EditarDataHoraRegistroForm(request.POST)
            if form.is_valid():
                nova_datahora = form.cleaned_data['datahora']
                
                count = 0
                for registro in queryset:
                    # Atualizar diretamente no banco para contornar auto_now_add
                    registro.__class__.objects.filter(pk=registro.pk).update(
                        datahora=nova_datahora
                    )
                    count += 1
                
                messages.success(
                    request, 
                    f'{count} registro(s) de presença foram atualizados com sucesso.'
                )
                return redirect(request.get_full_path())
        else:
            form = EditarDataHoraRegistroForm()
        
        return render(
            request,
            'admin/funcionarios/editar_data_hora_registro.html',
            {
                'form': form,
                'registros': queryset,
                'title': 'Editar Data e Hora dos Registros de Presença'
            }
        )

    @admin.display(description='Usuário', ordering='entrada_auto__usuario__username')
    def get_usuario_nome(self, obj):
        return obj.entrada_auto.usuario.get_full_name() or obj.entrada_auto.usuario.username

    @admin.display(description='Data de Entrada', ordering='entrada_auto__data')
    def data_entrada(self, obj):
        return obj.entrada_auto.data.strftime('%d/%m/%Y')

    @admin.display(description='Info Funcionário', ordering='entrada_auto__usuario__funcionario_profile__tipo_contrato')
    def get_funcionario_info(self, obj):
        try:
            funcionario = obj.entrada_auto.usuario.funcionario_profile
            if funcionario:
                info = f"{funcionario.get_tipo_contrato_display() or 'N/A'}"
                if funcionario.empresa:
                    info += f" - {funcionario.empresa.nome}"
                return info
            return "Sem perfil de funcionário"
        except:
            return "N/A"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'entrada_auto', 'entrada_auto__usuario', 
            'entrada_auto__usuario__funcionario_profile',
            'entrada_auto__usuario__funcionario_profile__empresa'
        )


@admin.register(RelatorioSistemaPresenca)
class RelatorioSistemaPresencaAdmin(admin.ModelAdmin):
    list_display = ['get_usuario_nome', 'data', 'observacao_resumida', 'data_criacao', 'get_funcionario_info']
    list_filter = [
        'data', 'data_criacao',
        ('usuario', admin.RelatedOnlyFieldListFilter),
        'usuario__funcionario_profile__tipo_contrato',
        ('usuario__funcionario_profile__empresa', admin.RelatedOnlyFieldListFilter),
        ('usuario__funcionario_profile__equipe', admin.RelatedOnlyFieldListFilter),
    ]
    search_fields = [
        'usuario__username', 'usuario__first_name', 'usuario__last_name',
        'usuario__funcionario_profile__nome_completo', 'observacao'
    ]
    list_editable = ['data']
    readonly_fields = ['data_criacao']
    ordering = ['-data_criacao']
    list_per_page = 50
    date_hierarchy = 'data'

    fieldsets = (
        ('Informações do Relatório', {
            'fields': ('usuario', 'data', 'observacao')
        }),
        ('Auditoria', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        }),
    )

    @admin.display(description='Usuário', ordering='usuario__username')
    def get_usuario_nome(self, obj):
        return obj.usuario.get_full_name() or obj.usuario.username

    @admin.display(description='Observação', ordering='observacao')
    def observacao_resumida(self, obj):
        if len(obj.observacao) > 50:
            return obj.observacao[:50] + "..."
        return obj.observacao

    @admin.display(description='Info Funcionário', ordering='usuario__funcionario_profile__tipo_contrato')
    def get_funcionario_info(self, obj):
        try:
            funcionario = obj.usuario.funcionario_profile
            if funcionario:
                info = f"{funcionario.get_tipo_contrato_display() or 'N/A'}"
                if funcionario.empresa:
                    info += f" - {funcionario.empresa.nome}"
                return info
            return "Sem perfil de funcionário"
        except:
            return "N/A"

    def get_queryset(self, request):
        return super().get_queryset(request).select_related(
            'usuario', 'usuario__funcionario_profile', 'usuario__funcionario_profile__empresa'
        )


# --- Configurações do Site Admin ---

admin.site.site_header = "MoneyLink - Administração de Funcionários"
admin.site.site_title = "MoneyLink Admin"
admin.site.index_title = "Painel de Administração - Funcionários"
