from django.urls import path
from . import views

app_name = 'marketing'

urlpatterns = [
    # URLs para renderização de páginas
    path('addmateriais/', views.render_addmateriais, name='render_addmateriais'),
    path('materiais/', views.render_materiais, name='render_materiais'),
    path('dashboard/', views.render_dashboard_materiais, name='render_dashboard_materiais'),

    # URLs para APIs GET
    path('api/get/materiais/', views.api_get_materiais, name='api_get_materiais'),
    path('api/get/infogeral/', views.api_get_infogeral, name='api_get_infogeral'),
    path('api/get/orgaos/', views.api_get_orgaos, name='api_get_orgaos'),
    path('api/get/dashboard/', views.api_get_dashboard_materiais, name='api_get_dashboard_materiais'),
    path('api/get/material/<int:material_id>/', views.api_get_material, name='api_get_material'),

    # URLs para APIs POST
    path('api/post/material/', views.api_post_material, name='api_post_material'),
    path('api/post/produto/', views.api_post_produto, name='api_post_produto'),
    path('api/post/orgao/', views.api_post_orgao, name='api_post_orgao'),
    path('api/post/download/', views.api_post_download, name='api_post_download'),
]
