from django.urls import path
from .views import *

app_name = 'funcionarios'

urlpatterns = [
    
    # Rotas de Renderização de Páginas
    path('administrativo/', render_administrativo, name='render_administrativo'),
    path('novo/', render_novofuncionario, name='render_novofuncionario'),
    path('editar/', render_editfuncionario, name='render_editfuncionario'),
   
    path('api/get/infogeral/', api_get_infogeral, name='api_get_infogeral'),
    path('api/get/infogeralemp/', api_get_infogeralemp, name='api_get_infogeralemp'),
    path('api/get/infofuncionarios/', api_get_infofuncionarios, name='api_get_infofuncionarios'),
    path('api/get/funcionario/<int:funcionario_id>/', api_get_funcionario, name='api_get_funcionario'),
    path('api/download/arquivo/<int:arquivo_id>/', download_arquivo_funcionario, name='api_download_arquivo'),
    
    path('api/get/userfuncionario/<int:user_id>/', api_get_userFuncionario, name='api_get_userFuncionario'),
    path('api/post/empresa/', api_post_empresa, name='api_post_empresa'),
    path('api/post/loja/', api_post_loja, name='api_post_loja'),
    path('api/post/departamento/', api_post_departamento, name='api_post_departamento'),
    path('api/post/setor/', api_post_setor, name='api_post_setor'),
    path('api/post/equipe/', api_post_equipe, name='api_post_equipe'),
    path('api/post/cargo/', api_post_cargo, name='api_post_cargo'),
    path('api/post/horario/', api_post_horario, name='api_post_horario'),
    path('api/post/userfuncionario/', api_post_userfuncionario, name='api_post_userfuncionario'),
    path('api/edit/funcionario/', api_edit_funcionario, name='api_edit_funcionario'),
    path('api/get/infocardsnovo/', api_get_infocardsnovo, name='api_get_infocardsnovo'),
    path('api/get/comissao/', api_get_comissao, name='api_get_comissao'),
    path('api/post/novaregracomissao/', api_post_novaregracomissao, name='api_post_novaregracomissao'),
    path('api/post/produto/', api_post_novoproduto, name='api_post_novoproduto'),

    # Rotas para o Dashboard de Funcionários
    path('dashboard/', render_dashboard, name='render_dashboard'),
    path('api/get/dashboard/', api_get_dashboard, name='api_get_dashboard'),

    # Rotas para Comunicados
    path('comunicados/form/', render_formscomunicados, name='render_formscomunicados'),
    path('comunicados/visualizar/', render_comunicados_visualizacao, name='render_comunicados_visualizacao'),
    path('api/comunicados/add/', api_post_addcomunicados, name='api_post_addcomunicados'),
    path('api/comunicados/list/', api_get_comunicados, name='api_get_comunicados'),
    path('api/comunicados/<int:comunicado_id>/marcar-lido/', api_post_marcarcomolido_comunicado, name='api_post_marcarcomolido_comunicado'),
    path('api/comunicados/download/<int:arquivo_id>/', download_arquivo_comunicado, name='api_download_arquivo_comunicado'),
    path('api/get/destinatarios/', api_get_destinatarios, name='api_get_destinatarios'),
    path('api/get/infosgerais/', api_get_infosgerais, name='api_get_infosgerais'),

    # Rotas para Sistema de Presença
    path('presenca/', render_presenca, name='render_presenca'),
    path('presenca/relatorio/', render_relatorio_presenca, name='render_relatorio_presenca'),
    path('api/presenca/registros/', api_get_registros_presenca, name='api_get_registros_presenca'),
    path('api/presenca/registrar/', api_post_registro_presenca, name='api_post_registro_presenca'),
    path('api/presenca/relatorio/', api_get_relatorio_presenca, name='api_get_relatorio_presenca_data'),
    path('api/presenca/funcionarios/', api_rh_get_funcionarios_para_filtro_presenca, name='api_rh_get_funcionarios_para_filtro_presenca'),
    path('api/presenca/equipes/', api_rh_get_equipes_para_filtro_presenca, name='api_rh_get_equipes_para_filtro_presenca'),
    path('api/ausencias-atrasos/', api_get_ausencias_atrasos, name='api_get_ausencias_atrasos'),
    
    # API temporária para teste de captura de IP
    path('api/test/ip/', api_test_ip_capture, name='api_test_ip_capture'),
]
