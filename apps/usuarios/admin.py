# apps/usuarios/admin.py

from django.contrib import admin
from django.contrib.auth.models import User, Group
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin, GroupAdmin as BaseGroupAdmin
from django.utils.translation import gettext_lazy as _
from django.contrib.admin.widgets import FilteredSelectMultiple

from .models import Acesso, GroupsAcessos, ControleAcessos, AlertaTI, AlertaTIVisto, ConfiguracaoUsuario

# -------------------------
# Custom UserAdmin
# -------------------------
class UserAdmin(BaseUserAdmin):
    list_display = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff', 'is_active')
    list_filter  = ('is_staff', 'is_active', 'is_superuser', 'groups')
    fieldsets    = (
        (None, {'fields': ('username', 'password')}),
        (_('Personal info'),    {'fields': ('first_name', 'last_name', 'email')}),
        (_('Permissions'),      {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
        (_('Important dates'),  {'fields': ('last_login', 'date_joined')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username','email','password1','password2','first_name','last_name'),
        }),
    )
    search_fields     = ('username','email','first_name','last_name')
    ordering          = ('id','username')
    filter_horizontal = ('groups','user_permissions')

# -------------------------
# Custom GroupAdmin
# -------------------------
class CustomGroupAdmin(BaseGroupAdmin):
    list_display   = ('id','name')
    search_fields  = ('name',)
    ordering       = ('id','name')

# Desregistrando e registrando User e Group
admin.site.unregister(User)
admin.site.register(User, UserAdmin)

admin.site.unregister(Group)
admin.site.register(Group, CustomGroupAdmin)

# -------------------------
# AcessoAdmin
# -------------------------
@admin.register(Acesso)
class AcessoAdmin(admin.ModelAdmin):
    list_display   = ('id','nome','tipo','data_criacao','status')
    list_filter    = ('tipo','status')
    search_fields  = ('nome',)
    ordering       = ('tipo','nome')  # agrupa por tipo e ordena alfabeticamente

# -------------------------
# GroupsAcessosAdmin
# -------------------------
@admin.register(GroupsAcessos)
class GroupsAcessosAdmin(admin.ModelAdmin):
    list_display       = ('id','titulo','data_criacao','status')
    list_filter        = ('status',)
    search_fields      = ('titulo',)
    ordering           = ('titulo',)
    filter_horizontal  = ('acessos',)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == 'acessos':
            kwargs['queryset'] = Acesso.objects.filter(status=True).order_by('tipo','nome')
            kwargs['widget']   = FilteredSelectMultiple('Acessos', is_stacked=False)
        return super().formfield_for_manytomany(db_field, request, **kwargs)

# -------------------------
# ControleAcessosAdmin
# -------------------------
@admin.register(ControleAcessos)
class ControleAcessosAdmin(admin.ModelAdmin):
    list_display       = ('id','user','data_criacao','status')
    list_filter        = ('status',)
    search_fields      = ('user__username',)
    ordering           = ('user__username',)
    filter_horizontal  = ('acessos',)

    def formfield_for_manytomany(self, db_field, request, **kwargs):
        if db_field.name == 'acessos':
            kwargs['queryset'] = Acesso.objects.filter(status=True).order_by('tipo','nome')
            kwargs['widget']   = FilteredSelectMultiple('Acessos', is_stacked=False)
        return super().formfield_for_manytomany(db_field, request, **kwargs)

# -------------------------
# AlertaTIVistoAdmin
# -------------------------
@admin.register(AlertaTIVisto)
class AlertaTIVistoAdmin(admin.ModelAdmin):
    list_display = ('id', 'alerta', 'usuario', 'data_visualizacao')
    list_filter = ('data_visualizacao', 'usuario')
    search_fields = ('alerta__mensagem', 'usuario__username')
    ordering = ('-data_visualizacao',)
    readonly_fields = ('data_visualizacao',)
    
    fieldsets = (
        (None, {
            'fields': ('alerta', 'usuario')
        }),
        ('Informações de Visualização', {
            'fields': ('data_visualizacao',),
            'classes': ('collapse',)
        }),
    )

# -------------------------
# AlertaTIAdmin
# -------------------------
@admin.register(AlertaTI)
class AlertaTIAdmin(admin.ModelAdmin):
    list_display = ('id', 'mensagem', 'criado_por', 'data_criacao', 'ativo', 'total_destinatarios', 'total_vistos')
    list_filter = ('ativo', 'data_criacao', 'criado_por')
    search_fields = ('mensagem', 'criado_por__username')
    ordering = ('-data_criacao',)
    filter_horizontal = ('destinatarios',)
    readonly_fields = ('data_criacao', 'total_destinatarios', 'total_vistos')
    
    fieldsets = (
        (None, {
            'fields': ('mensagem', 'audio', 'ativo')
        }),
        ('Destinatários', {
            'fields': ('destinatarios',)
        }),
        ('Estatísticas', {
            'fields': ('total_destinatarios', 'total_vistos'),
            'classes': ('collapse',)
        }),
        ('Informações Adicionais', {
            'fields': ('criado_por', 'data_criacao'),
            'classes': ('collapse',)
        }),
    )
    
    def total_destinatarios(self, obj):
        return obj.destinatarios.count()
    total_destinatarios.short_description = 'Total de Destinatários'
    
    def total_vistos(self, obj):
        return obj.vistos.count()
    total_vistos.short_description = 'Total de Visualizações'
    
    def save_model(self, request, obj, form, change):
        if not change:  # Se for uma nova criação
            obj.criado_por = request.user
        super().save_model(request, obj, form, change)

# -------------------------
# ConfiguracaoUsuarioAdmin
# -------------------------
@admin.register(ConfiguracaoUsuario)
class ConfiguracaoUsuarioAdmin(admin.ModelAdmin):
    list_display = ('user', 'modo_escuro', 'manter_menu_aberto', 'data_atualizacao')
    list_filter = ('modo_escuro', 'manter_menu_aberto', 'data_atualizacao')
    search_fields = ('user__username', 'user__first_name', 'user__last_name')
    readonly_fields = ('data_atualizacao',)
