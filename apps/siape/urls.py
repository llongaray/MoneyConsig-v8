from django.urls import path
from .views import *

app_name = 'siape'

urlpatterns = [
    # Rotas da API (seguindo o padrão api/METHOD/...)
    path('api/get/cards/', api_cards, name='api_get_cards'), # Atualizado
    path('api/get/podium/', api_podium, name='api_get_podium'), # Atualizado
    path('api/get/ficha-cliente/', api_get_ficha_cliente, name='api_get_ficha_cliente'), # Atualizado
    path('api/post/importar-csv/', api_post_importar_csv, name='api_post_importar_csv'), # Já segue o padrão
    path('api/post/siape/campanha/', api_post_campanha, name='api_post_campanha'), # Atualizado
    path('api/post/agendamento-cliente/', api_post_agend_cliente, name='api_post_agend_cliente'), # Já segue o padrão
    path('api/get/agendamentos-cliente/', api_get_agendamentos_cliente, name='api_get_agendamentos_cliente'), # Já segue o padrão
    path('api/get/infocliente/', api_get_infocliente, name='api_get_infocliente'), # Já segue o padrão
    path('api/post/confirm-agendamento/', api_post_confirm_agend, name='api_post_confirm_agend'), # Já segue o padrão
    path('api/get/info-camp/', api_get_info_camp, name='api_get_info_camp'), # Atualizado

    # Novas Rotas da API (Financeiro - seguindo o padrão api/METHOD/...)
    path('api/get/info/', api_get_infosiape, name='api_get_infosiape'), # Atualizado
    path('api/get/registros-tac/', api_get_registrosTac, name='api_get_registrosTac'), # Atualizado
    path('api/get/cards-tac/', api_get_cardstac, name='api_get_cardstac'), # Atualizado
    path('api/post/novo-tac/', api_post_novotac, name='api_post_novotac'), # Atualizado
    path('api/get/nome-cliente/', api_get_nomecliente, name='api_get_nomecliente'), # Atualizado

    # Nova rota para excluir débitos de campanha
    path('api/post/excluir-debitos-campanha/', api_post_excluir_debitos_campanha, name='api_post_excluir_debitos_campanha'),
    
    # APIs Dashboard Agendamentos
    path('api/get/dashboard-agendamentos-overview/', api_get_dashboard_agendamentos_overview, name='api_get_dashboard_agendamentos_overview'),
    path('api/get/agendamentos-detalhes/', api_get_agendamentos_detalhes, name='api_get_agendamentos_detalhes'),
    path('api/get/funcionarios-lista/', api_get_funcionarios_lista, name='api_get_funcionarios_lista'),
    path('api/get/relatorio-agendamentos/', api_get_relatorio_agendamentos, name='api_get_relatorio_agendamentos'),
    path('api/post/editar-observacao-agendamento/', api_post_editar_observacao_agendamento, name='api_post_editar_observacao_agendamento'),
    
    # APIs para Edição de Agendamentos
    path('api/get/detalhes-agendamento/', api_get_detalhes_agendamento, name='api_get_detalhes_agendamento'),
    path('api/post/editar-agendamento/', api_post_editar_agendamento, name='api_post_editar_agendamento'),
    
    # APIs Sistema de Tabulação
    path('api/get/tabulacao-cliente/', api_get_tabulacao_cliente, name='api_get_tabulacao_cliente'),
    path('api/post/atualizar-tabulacao/', api_post_atualizar_tabulacao, name='api_post_atualizar_tabulacao'),
    
    # APIs Sistema de Dados de Negociação
    path('api/get/dados-negociacao/', api_get_dados_negociacao, name='api_get_dados_negociacao'),
    path('api/post/salvar-dados-negociacao/', api_post_salvar_dados_negociacao, name='api_post_salvar_dados_negociacao'),
    path('api/post/upload-arquivo-negociacao/', api_post_upload_arquivo_negociacao, name='api_post_upload_arquivo_negociacao'),
    
    # APIs Sistema de Documentos
    path('api/get/documentos-cliente/', api_get_documentos_cliente, name='api_get_documentos_cliente'),
    path('api/post/upload-documento/', api_post_upload_documento, name='api_post_upload_documento'),
    
    # APIs Sistema de Telefones
    path('api/get/telefones-cliente/', api_get_telefones_cliente, name='api_get_telefones_cliente'),
    path('api/post/adicionar-telefone/', api_post_adicionar_telefone, name='api_post_adicionar_telefone'),
    path('api/post/remover-telefone/', api_post_remover_telefone, name='api_post_remover_telefone'),
    
    # APIs CRM Kanban
    path('api/get/kanban-dados/', api_get_kanban_dados, name='api_get_kanban_dados'),
    path('api/get/kanban-teste/', api_get_kanban_teste, name='api_get_kanban_teste'),
    path('api/post/mover-card-kanban/', api_post_mover_card_kanban, name='api_post_mover_card_kanban'),
    path('api/get/detalhes-card-kanban/', api_get_detalhes_card_kanban, name='api_get_detalhes_card_kanban'),
    path('api/post/criar-tabulacoes-automaticas/', api_post_criar_tabulacoes_automaticas, name='api_post_criar_tabulacoes_automaticas'),
    
    # APIs para Filtros e Controle de Presença
    path('api/get/setores-para-filtro/', api_get_setores_para_filtro, name='api_get_setores_para_filtro'),
    path('api/get/equipes-para-filtro/', api_get_equipes_para_filtro, name='api_get_equipes_para_filtro'),
    path('api/get/presenca-ausencias/', api_get_presenca_ausencias, name='api_get_presenca_ausencias'),
    
    # APIs para horários de checagem
    path('api/get/coordenadores-horarios-disponiveis/', api_get_coordenadores_horarios_disponiveis, name='api_get_coordenadores_horarios_disponiveis'),
    path('api/get/horarios-disponiveis-coordenador/', api_get_horarios_disponiveis_coordenador, name='api_get_horarios_disponiveis_coordenador'),
    
    # Rotas de páginas (não precisam seguir o padrão da API)
    path('ranking/', render_ranking, name='ranking'),
    path('consulta-cliente/', render_consulta_cliente, name='consulta_cliente'),
    path('export-register-money/', export_register_money, name='export_register_money'),
    path('campanhas-siape/', render_campanha_Siape, name='campanhas_siape'),
    path('financeiro/', render_financeiro, name='financeiro'), # Rota para a página Financeiro
    path('dashboard-agendamentos/', render_dashboard_agendamentos, name='dashboard_agendamentos'), # Dashboard de Agendamentos
    path('crm-kanban/', render_crm_kanban, name='crm_kanban'), # CRM Kanban
]
