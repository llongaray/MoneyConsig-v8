# apps/usuarios/urls.py

from django.urls import path
from .views import *

app_name = 'usuarios'

urlpatterns = [
    path('login/', login_view, name='login'),
    path('logout/', logout_view, name='logout'),
    path('perfil/', perfil_view, name='perfil_usuario'),
    path('api/perfil/get/', api_perfil_get, name='api_perfil_get'),

    # 1. Página de permissões
    path('permissions/', render_permissionacess, name='render_permissionacess'),

    # 2. GET: lista todos os acessos
    path('api/acessos/', api_get_acessos, name='api_get_acessos'),

    # 3. GET: lista grupos de acessos
    path('api/grupos-acessos/', api_get_groupsacesses, name='api_get_groupsacesses'),

    # 4. GET: lista usuários e seus acessos
    path('api/users-acessos/', api_get_useracess, name='api_get_useracess'),

    # 5. POST: cria novo grupo de acessos
    path('api/grupos-acessos/new/', api_post_newgroupacess, name='api_post_newgroupacess'),

    # 6. POST: cria novo acesso
    path('api/acessos/new/', api_post_newacesse, name='api_post_newacesse'),

    # 7. POST: registra acessos para um usuário
    path('api/users-acessos/register/', api_post_registeracessosuser, name='api_post_registeracessosuser'),

    # 8. POST: registra acessos para múltiplos usuários
    path('api/users-acessos/register-multiple/', api_post_registeracessosusers, name='api_post_registeracessosusers'),

    # 9. POST: adiciona acessos para múltiplos usuários (sem substituir existentes)
    path('api/users-acessos/add-multiple/', api_post_addacessosusers, name='api_post_addacessosusers'),

    path('api/users-info/', api_get_infouser, name='api_get_infouser'),

    # Alertas TI
    path('alertas-ti/', render_alert_ti, name='render_alert_ti'),
    path('api/alertas/novo/', api_post_alert_ti, name='api_post_alert_ti'),
    path('api/alertas/verificar/', api_get_alert_ti, name='api_get_alert_ti'),
    path('api/alertas/verificar/<int:alerta_id>/', api_get_alert_ti, name='api_get_alert_ti_specific'),
    path('api/alertas/marcar-visto/<int:alerta_id>/', api_marcar_alerta_visto, name='api_marcar_alerta_visto'),

    path('api/destinatarios/<str:tipo>/', api_get_destinatarios, name='api_get_destinatarios'),

    # Configurações do usuário
    path('configuracoes/', render_configuracoes, name='render_configuracoes'),
    path('api/configuracoes/get/', api_get_configuracoes, name='api_get_configuracoes'),
    path('api/configuracoes/update/', api_post_configuracoes, name='api_post_configuracoes'),
]