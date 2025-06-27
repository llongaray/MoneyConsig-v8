from django.urls import path
from .views import *

app_name = 'moneyplus'

urlpatterns = [
    path('', render_infocliente, name='render_moneyplus'),
    path('upload-base/', render_uploadbase, name='render_uploadBase'),



    path('api/get/baseclientes/', api_get_baseclientes, name='api_get_baseclientes'),
    path('api/get/cliente/', api_get_cliente, name='api_get_cliente'),
    path('api/uploadbase/', api_get_uploadbase, name='api_get_uploadbase'),
    path('api/create-equipe/', api_create_equipe, name='api_create_equipe'),

    path('api/post/csv-clientes/', api_upload_csv_clientes, name='api_upload_csv_clientes'),
    path('api/post/tabulacao/', api_post_tabulacao, name='api_post_tabulacao'),
    # GET  /moneyplus/api/get/agendamentos/
    path('api/get/agendamentos/', api_get_agendamentos, name='api_get_agendamentos'),
    # POST /moneyplus/api/post/agendamento/
    path('api/post/agendamento/', api_post_agendamento, name='api_post_agendamento'),
    path('api/post/confirm_agendamento/', api_post_confirm_agendamento , name='api_post_confirm_agendamento'),

    
    path('api/campaign-create/', api_create_campaign, name='api_create_campaign'),
    path('api/campaign-list/', api_list_campaigns, name='api_list_campaigns'),
]
