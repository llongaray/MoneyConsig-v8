from django.urls import path
from .views import *

app_name = 'inss'

urlpatterns = [
    # Renderização das Páginas Principais
    path('agendamento/', render_agendamento, name='agendamento'),
    path('loja/', render_loja, name='loja'),
    path('financeiro/', render_financeiro, name='financeiro'),
    path('dashboard/', render_dashboard, name='dashboard'),
    path('all_forms/', render_inss_forms, name='all_forms'),
    path('ranking/', render_ranking, name='ranking'),
    path('acoes/', render_acoesinss, name='acoes'),

    # APIs GET
    path('api/get/submodal-cliente/', api_get_submodal_cliente, name='api_get_submodal_cliente'),
    path('api/get/agendados/', api_get_agendados, name='api_get_agendados'),
    path('api/get/reagendados/', api_get_reagendados, name='api_get_reagendados'),
    path('api/get/atrasados/', api_get_atrasados, name='api_get_atrasados'),
    path('api/get/emloja/', api_get_emloja, name='api_get_emloja'),
    path('api/get/infogeral/', api_get_infogeral, name='api_get_infogeral'),
    path('api/get/info-loja-funcionario/', api_get_infolojaefuncionario, name='api_get_infolojaefuncionario'),
    path('api/get/cpfclientenome/', api_get_cpfclientenome, name='api_get_cpfclientenome'),
    path('api/get/acoes/', api_get_acoes, name='api_get_acoes'),
    path('api/get/arquivosacoes/<int:acao_id>/', api_get_arquivosacoes, name='api_get_arquivosacoes'),
    path('api/get/info_processo/<int:acao_id>/', api_get_info_processo, name='api_get_info_processo'),
    
    # APIs para a página de loja
    path('api/get/agendadosHoje/', api_get_agendadosHoje, name='api_get_agendadosHoje'),
    path('api/get/agendPendentes/', api_get_agendPendentes, name='api_get_agendPendentes'),
    path('api/get/infocliente/', api_get_infocliente, name='api_get_infocliente'),
    
    # APIs para TAC
    path('api/get/tac/', api_get_tac, name='api_get_tac'),
    path('api/post/tac/', api_post_tac, name='api_post_tac'),
    path('api/post/attvalortac/', api_post_attvalortac, name='api_post_attvalortac'),

    # APIs POST
    path('api/post/confirmagem/', api_post_confirmagem, name='api_post_confirmagem'),
    path('api/post/agendamento/', api_post_agendamento, name='api_post_agendamento'),
    path('api/post/novavenda/', api_post_novavenda, name='api_post_novavenda'),
    path('api/post/addvenda/', api_post_addvenda, name='api_post_addvenda'),
    path('api/post/finalizaratendimento/', api_post_finalizaratendimento, name='api_post_finalizaratendimento'),
    path('api/post/adicionaracao/', api_post_adicionaracao, name='api_post_adicionaracao'),
    path('api/post/acao/', api_post_adicionaracao, name='api_post_acao'),
    path('api/post/clienterua_acao/', api_post_clienterua_acao, name='api_post_clienterua_acao'),
    path('api/post/arquivo/', api_post_arquivo, name='api_post_arquivo'),

    # APIs de Ranking e Cards
    path('api/inss/cards/', api_get_cards, name='api_cards'),
    path('api/inss/cards/<str:periodo>/', api_get_cards, name='api_cards_periodo'),
    path('api/inss/podium/', api_get_podium, name='api_podium'),
    path('api/inss/podium/<str:periodo>/', api_get_podium, name='api_podium_periodo'),
    path('api/inss/tabela/', api_get_tabela, name='api_tabela'),
    path('api/inss/tabela/<str:periodo>/', api_get_tabela, name='api_tabela_periodo'),
    path('api/export/agendamentos-csv/', export_agendamentos_csv, name='export_agendamentos_csv'),

    # APIs do Dashboard
    path('api/dashboard/', api_get_dashboard, name='api_get_dashboard_default'),
    path('api/dashboard/<str:periodo>/', api_get_dashboard, name='api_get_dashboard_periodo'),
    
    # APIs Financeiro
    path('api/get/cardsfinanceiro/', api_get_cardsfinanceiro, name='api_get_cardsfinanceiro'),
    path('api/get/historicopagamentos/', api_get_historicopagamentos, name='api_get_historicopagamentos'),
    path('api/get/clientesAtrasadoLoja/', api_get_clientesAtrasadoLoja, name='api_get_clientesAtrasadoLoja'),
]
