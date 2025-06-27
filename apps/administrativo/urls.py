from django.urls import path
# Importa todas as views do módulo atual (py)
# Embora funcional, para clareza e evitar conflitos, importações explícitas são geralmente preferíveis.
# Ex: from .views import render_dashboard, api_get_dashboard, ... , render_reembolso, api_get_inforeembolso, etc.
from .views import *
from apps.funcionarios.views import render_comunicados  # Importando a view de comunicados

app_name = 'administrativo'

urlpatterns = [
    # --- Dashboard ---
    # URL para renderizar a página HTML do dashboard
    path('dashboard/', render_dashboard, name='dashboard'),
    # URL para a API que fornece os dados do dashboard

    # --- Controle de Metas ---
    # Página HTML
    path('metas/', render_controlemetas, name='render_controlemetas'),
    # API para listar metas (GET)
    path('api/metas/', api_get_metas, name='api_get_metas'),
    # API para criar nova meta (POST)
    path('api/metas/nova/', api_post_novameta, name='api_post_novameta'),
    # API para atualizar o status da meta (POST)
    path('api/metas/atualizar-status/', api_post_attmeta, name='api_post_attmeta'),
    # Adicionar URLs para editar/deletar metas se necessário

    # --- Controle de Reembolsos ---
    # Página HTML para controle de reembolsos
    path('reembolso/', render_reembolso, name='reembolso'),
    # API para buscar dados de reembolso (GET)
    path('api/reembolso/info/', api_get_inforeembolso, name='api_get_inforeembolso'),
    # API para registrar um novo reembolso (POST)
    path('api/reembolso/registrar/', api_post_addreembolso, name='api_post_addreembolso'),
    # API para reverter (desativar) um reembolso (POST)
    path('api/reembolso/reverter/', api_post_reverterreembolso, name='api_post_reverterreembolso'),

    # --- Importação de CSVs ---
    # Página HTML para importação de CSVs
    # --- Importação de CSVs ---
    path('importar-csvs/', render_importscsvs, name='render_importscsvs'),
    path('api/csv/funcionarios/', api_post_csvfuncionarios, name='api_post_csvfuncionarios'),
    path('api/csv/clientec2/',      api_post_csvclientec2,   name='api_post_csvclientec2'),
    path('api/csv/agendamento/',    api_post_csvagendamento, name='api_post_csvagendamento'),
    path('api/csv/financeiro/',     api_post_csvfinanceiro,  name='api_post_csvfinanceiro'),

    path('api/campanhas/', api_get_minhasCampanhas, name='api_get_minhasCampanhas'),
    path('api/campanhas/criar/', api_post_criarCampanha, name='api_post_criarCampanha'),
    path('api/campanhas/banners/', api_get_banners_campanhas, name='api_get_bannersCampanhas'),
    path('api/campanhas/atualizar-status/', api_post_atualizar_status_campanha, name='api_post_atualizar_status_campanha'),

    # Dashboard APIs
    path('api/dashboard/financeiro/', api_get_dashboard_financeiro, name='api_get_dashboard_financeiro'),
    path('api/dashboard/lojas/', api_get_dashboard_lojas, name='api_get_dashboard_lojas'),
    path('api/dashboard/rh/', api_get_dashboard_rh, name='api_get_dashboard_rh'),
    path('api/dashboard/metas/', api_get_dashboard_metas, name='api_get_dashboard_metas'),
    path('api/dashboard/siape/', api_get_dashboard_siape, name='api_get_dashboard_siape'),

    # --- Comunicados ---
    path('', render_comunicados, name='render_comunicados'),  # Nova URL para comunicados
]