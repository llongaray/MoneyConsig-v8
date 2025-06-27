from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from django.utils.safestring import mark_safe
from .models import Orgao, Produto, Material, DownloadsMaterial

# Register your models here.

@admin.register(Orgao)
class OrgaoAdmin(admin.ModelAdmin):
    """
    Configuração do admin para o modelo Orgao
    """
    list_display = ['titulo', 'data_criacao', 'status', 'total_produtos']
    list_filter = ['status', 'data_criacao']
    search_fields = ['titulo']
    ordering = ['-data_criacao']
    list_per_page = 20
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('titulo', 'status')
        }),
        ('Dados do Sistema', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['data_criacao']
    
    def total_produtos(self, obj):
        """Mostra a quantidade de produtos vinculados ao órgão"""
        count = obj.produtos.count()
        if count > 0:
            url = reverse('admin:marketing_produto_changelist') + f'?orgao__id__exact={obj.id}'
            return format_html('<a href="{}">{} produtos</a>', url, count)
        return '0 produtos'
    total_produtos.short_description = 'Total de Produtos'


@admin.register(Produto)
class ProdutoAdmin(admin.ModelAdmin):
    """
    Configuração do admin para o modelo Produto
    """
    list_display = ['titulo', 'orgao', 'data_criacao', 'status', 'total_materiais', 'total_downloads']
    list_filter = ['status', 'orgao', 'data_criacao']
    search_fields = ['titulo', 'orgao__titulo']
    ordering = ['-data_criacao']
    list_per_page = 20
    autocomplete_fields = ['orgao']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('titulo', 'orgao', 'status')
        }),
        ('Dados do Sistema', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['data_criacao']
    
    def total_materiais(self, obj):
        """Mostra a quantidade de materiais vinculados ao produto"""
        count = obj.materiais.count()
        if count > 0:
            url = reverse('admin:marketing_material_changelist') + f'?produto__id__exact={obj.id}'
            return format_html('<a href="{}">{} materiais</a>', url, count)
        return '0 materiais'
    total_materiais.short_description = 'Total de Materiais'
    
    def total_downloads(self, obj):
        """Mostra o total de downloads do produto"""
        count = DownloadsMaterial.contar_downloads_produto(obj.id)
        if count > 0:
            url = reverse('admin:marketing_downloadsmaterial_changelist') + f'?produto__id__exact={obj.id}'
            return format_html('<a href="{}">{} downloads</a>', url, count)
        return '0 downloads'
    total_downloads.short_description = 'Total de Downloads'


@admin.register(Material)
class MaterialAdmin(admin.ModelAdmin):
    """
    Configuração do admin para o modelo Material
    """
    list_display = ['titulo', 'produto', 'preview_banner', 'data_criacao', 'status', 'total_downloads']
    list_filter = ['status', 'produto__orgao', 'produto', 'data_criacao']
    search_fields = ['titulo', 'produto__titulo', 'produto__orgao__titulo']
    ordering = ['-data_criacao']
    list_per_page = 20
    autocomplete_fields = ['produto']
    
    fieldsets = (
        ('Informações Básicas', {
            'fields': ('titulo', 'produto', 'status')
        }),
        ('Arquivos', {
            'fields': ('banner', 'arquivo')
        }),
        ('Dados do Sistema', {
            'fields': ('data_criacao',),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['data_criacao']
    
    def preview_banner(self, obj):
        """Mostra uma prévia do banner no admin"""
        if obj.banner:
            return format_html(
                '<img src="{}" style="max-width: 50px; max-height: 50px; border-radius: 4px;" />',
                obj.banner.url
            )
        return '—'
    preview_banner.short_description = 'Preview'
    
    def total_downloads(self, obj):
        """Mostra o total de downloads do material"""
        count = DownloadsMaterial.contar_downloads_material(obj.id)
        if count > 0:
            url = reverse('admin:marketing_downloadsmaterial_changelist') + f'?material__id__exact={obj.id}'
            return format_html('<a href="{}">{} downloads</a>', url, count)
        return '0 downloads'
    total_downloads.short_description = 'Downloads'


class DownloadsMaterialInline(admin.TabularInline):
    """
    Inline para mostrar downloads nos materiais
    """
    model = DownloadsMaterial
    extra = 0
    readonly_fields = ['data', 'usuario', 'ip_usuario', 'produto']
    can_delete = False
    
    def has_add_permission(self, request, obj=None):
        return False


@admin.register(DownloadsMaterial)
class DownloadsMaterialAdmin(admin.ModelAdmin):
    """
    Configuração do admin para o modelo DownloadsMaterial
    """
    list_display = ['material', 'produto', 'usuario', 'data', 'ip_usuario', 'status']
    list_filter = [
        'status', 
        'data', 
        'produto__orgao',
        'produto',
        ('material', admin.RelatedOnlyFieldListFilter),
        ('usuario', admin.RelatedOnlyFieldListFilter)
    ]
    search_fields = [
        'material__titulo', 
        'produto__titulo', 
        'produto__orgao__titulo',
        'usuario__username',
        'usuario__first_name',
        'usuario__last_name'
    ]
    ordering = ['-data']
    list_per_page = 50
    date_hierarchy = 'data'
    
    fieldsets = (
        ('Download', {
            'fields': ('material', 'produto', 'usuario', 'status')
        }),
        ('Informações Técnicas', {
            'fields': ('data', 'ip_usuario'),
            'classes': ('collapse',)
        }),
    )
    
    readonly_fields = ['data', 'ip_usuario']
    autocomplete_fields = ['material', 'produto', 'usuario']
    
    def get_queryset(self, request):
        """Otimiza as consultas com select_related"""
        return super().get_queryset(request).select_related(
            'material', 'produto', 'produto__orgao', 'usuario'
        )
    
    def has_add_permission(self, request):
        """Remove a possibilidade de adicionar downloads manualmente"""
        return False
    
    def has_change_permission(self, request, obj=None):
        """Permite apenas visualização e mudança de status"""
        return True
    
    def get_readonly_fields(self, request, obj=None):
        """Define campos readonly baseado no objeto"""
        if obj:  # Editando um registro existente
            return ['material', 'produto', 'usuario', 'data', 'ip_usuario']
        return self.readonly_fields


# Configurações adicionais do admin
admin.site.site_header = "MoneyLink - Administração de Marketing"
admin.site.site_title = "MoneyLink Admin"
admin.site.index_title = "Painel de Administração - Marketing"

# Adicionando inlines aos outros admins
MaterialAdmin.inlines = [DownloadsMaterialInline]

# Configurando autocomplete fields para melhor performance
OrgaoAdmin.search_fields = ['titulo']
ProdutoAdmin.search_fields = ['titulo', 'orgao__titulo']
