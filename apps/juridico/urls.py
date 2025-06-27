from django.urls import path
from .views import *

app_name = 'juridico'

urlpatterns = [
    path('acoes/', render_acoes, name='acoes'),
    path('acoes/limpa-nome/', render_limpa_nome, name='limpa_nome'),
    path('acoes/adicionar/', render_addacao, name='adicionar_acao'),
    path('minhas-acoes/', render_minhas_acoes, name='minhas_acoes'),
    path('api/acoes/adicionar/', api_post_addacao, name='api_post_addacao'),
    path('api/info-geral/', api_get_infogeral, name='api_get_infogeral'),
    path('api/cpf-cliente/', api_get_cpfcliente, name='api_get_cpfcliente'),
    path('api/tabelaacoes/', api_get_tabelaacoes, name='api_get_tabelaacoes'),
    path('api/tabelaacoes-limpanome/', api_get_tabelaacoes_limpanome, name='api_get_tabelaacoes_limpanome'),
    path('api/lista-acoes/', api_get_lista_acoes, name='api_get_lista_acoes'),
    path('api/minhas-acoes/', api_get_minhas_acoes, name='api_get_minhas_acoes'),
    path('api/minhas-acoes-completa/', api_get_minhas_acoes_completa, name='api_get_minhas_acoes_completa'),
    path('api/acoes-com-advogado/', api_get_acoes_com_advogado, name='api_get_acoes_com_advogado'),
    path('api_get_acao/<int:acao_id>/', api_get_acao, name='api_get_acao'),
    path('api_get_documento/<int:doc_id>/', api_get_documento, name='api_get_documento'),
    path('api/acoes/atualizar-status/', api_post_attstatus, name='api_post_attstatus'),
    path('api/acoes/inativar/', api_post_inativaracao, name='api_post_inativaracao'),
    path('api/acoes/reativar/', api_post_reativaracao, name='api_post_reativaracao'),
    path('api/acoes/editar/', api_post_editaracao, name='api_post_editaracao'),
    path('api/acoes/atualizar-sentenca/', api_post_atualizar_sentenca, name='api_post_atualizar_sentenca'),
    path('api/acoes/upload-documento-acao/', api_upload_documento_acao, name='api_upload_documento_acao'),
    path('api/acoes/upload-arquivo-acao/', api_upload_arquivo_acao, name='api_upload_arquivo_acao'),
    path('api_get_documento_acao/<int:doc_id>/', api_get_documento_acao, name='api_get_documento_acao'),
    path('api/pagamentosacoes/', api_get_pagamentosacoes, name='api_get_pagamentosacoes'),
    path('api/acoes/assumir/', api_post_assumir_acao, name='api_post_assumir_acao'),
    path('pagamentos/', render_pagamentos, name='pagamentos'),
    path('api/registrar-pagamento/', api_post_registrar_pagamento, name='api_post_registrar_pagamento'),
    path('api/detalhes-pagamento/<int:registro_pagamento_id>/', api_get_detalhes_pagamento, name='api_detalhes_pagamento'),
    path('api/visualizar-arquivo/<int:arquivo_id>/', api_get_vizualizararquivo, name='api_get_vizualizararquivo'),

    # URLs para o novo Dashboard de Ações
    path('dashboard/', render_dashboardacoes, name='dashboard_acoes'),
    path('api/get_dashboardacoes/', api_get_dashboardacoes, name='api_get_dashboardacoes'),

    # URLs para Processos
    path('api/processos-acao/<int:acao_id>/', api_get_processos_acao, name='api_get_processos_acao'),
    path('api/processos/criar/', api_post_criar_processo, name='api_post_criar_processo'),
    path('api/processos/editar/', api_post_editar_processo, name='api_post_editar_processo'),
    path('api/processos/<int:processo_id>/', api_get_processo, name='api_get_processo'),
    path('api/processos/upload-arquivo/', api_upload_arquivo_processo, name='api_upload_arquivo_processo'),
    path('api/arquivo-processo/<int:arquivo_id>/', api_get_arquivo_processo, name='api_get_arquivo_processo'),
    
    # URLs para servir arquivos diretamente (visualização em nova aba)
    path('serve/arquivo-acao/<int:arquivo_id>/', serve_arquivo_acao, name='serve_arquivo_acao'),
    path('serve/documento-acao/<int:documento_id>/', serve_documento_acao, name='serve_documento_acao'),
    path('serve/arquivo-processo/<int:arquivo_id>/', serve_arquivo_processo, name='serve_arquivo_processo'),
    
    # URLs para download forçado de arquivos
    path('download/arquivo-acao/<int:arquivo_id>/', download_arquivo_acao, name='download_arquivo_acao'),
    path('download/documento-acao/<int:documento_id>/', download_documento_acao, name='download_documento_acao'),
    path('download/arquivo-processo/<int:arquivo_id>/', download_arquivo_processo, name='download_arquivo_processo'),
]
