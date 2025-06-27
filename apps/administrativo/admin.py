from django.contrib import admin
from django.utils.html import format_html, mark_safe
from django.urls import reverse
from .models import ControleCampanha

@admin.action(description="Marcar campanhas selecionadas como Ativas")
def make_active(modeladmin, request, queryset):
    updated = queryset.update(status=True)
    modeladmin.message_user(request, f"{updated} campanha(s) ativada(s).")

@admin.action(description="Marcar campanhas selecionadas como Inativas")
def make_inactive(modeladmin, request, queryset):
    updated = queryset.update(status=False)
    modeladmin.message_user(request, f"{updated} campanha(s) desativada(s).")

@admin.register(ControleCampanha)
class ControleCampanhaAdmin(admin.ModelAdmin):
    list_display = (
        'titulo', 
        'categoria',
        'formatted_scope',
        'data_inicio', 
        'data_final', 
        'status',
        'banner_thumb',
    )
    list_editable    = ('status',)
    list_filter      = ('categoria', 'status', 'data_inicio', 'data_final')
    search_fields    = ('titulo',)
    date_hierarchy   = 'data_inicio'
    ordering         = ('-data_inicio',)
    actions          = [make_active, make_inactive]

    # Muda os ManyToMany para widgets de autocomplete
    filter_horizontal = ()
    autocomplete_fields = ('empresas', 'departamentos', 'setores', 'lojas', 'equipes', 'cargos')

    readonly_fields = ('data_criacao', 'banner_preview_large')
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('titulo', 'banner', 'banner_preview_large', 'categoria', 'status'),
        }),
        ('Datas e Horários', {
            'fields': ('data_inicio', 'hora_inicio', 'data_final', 'hora_final'),
        }),
        ('Escopo da Campanha', {
            'classes': ('collapse',),
            'fields': ('empresas', 'departamentos', 'setores', 'lojas', 'equipes', 'cargos'),
            'description': mark_safe(
                "<small>Deixe em branco para aplicar a <strong>todos</strong> no nível selecionado.</small>"
            ),
        }),
        ('Auditoria', {
            'classes': ('collapse',),
            'fields': ('data_criacao',),
        }),
    )

    def banner_thumb(self, obj):
        if not obj.banner:
            return "-"
        url  = obj.banner.url
        return format_html(
            '<a href="{}" target="_blank">'
            ' <img src="{}" style="height:40px; border-radius:4px;"/>'
            '</a>', url, url
        )
    banner_thumb.short_description = 'Banner'

    def banner_preview_large(self, obj):
        if not obj.banner:
            return "-"
        url = obj.banner.url
        return format_html(
            '<div style="max-width:200px;">'
            '  <img src="{}" style="width:100%; border:1px solid #ccc; border-radius:4px;" />'
            '</div>', url
        )
    banner_preview_large.short_description = 'Pré‑visualização'

    def formatted_scope(self, obj):
        """
        Monta uma string resumida do escopo da campanha
        ex: [Geral] ou [Empresas: 1,3] [Lojas:5]
        """
        parts = []
        if obj.categoria == 'GERAL':
            return "Geral"
        mapping = {
            'EMPRESA':      obj.empresas,
            'DEPARTAMENTO': obj.departamentos,
            'SETOR':        obj.setores,
            'LOJA':         obj.lojas,
            'EQUIPE':       obj.equipes,
            'CARGO':        obj.cargos,
        }
        qs = mapping.get(obj.categoria)
        if qs is not None:
            ids = list(qs.values_list('id', flat=True))
            parts.append(f"{obj.get_categoria_display()}: {', '.join(map(str, ids))}")
        return mark_safe("<br/>".join(parts)) or "-"
    formatted_scope.short_description = 'Escopo'

    class Media:
        css = {
            'all': ('admin/css/custom_controle_campanha.css',)
        }
        js = ('admin/js/custom_controle_campanha.js',)
