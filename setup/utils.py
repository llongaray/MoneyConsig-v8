# setup/utils.py
from django.shortcuts import redirect

def get_user_group_id(user):
    if user.is_authenticated:
        if user.groups.filter(id=3).exists():
            return 3
        elif user.groups.filter(id=2).exists():
            return 2
        elif user.groups.filter(id=1).exists():
            return 1
    return None

def verificar_autenticacao(view_func):
    """
    Decorador para verificar se o usuário está autenticado.
    Se não estiver, redireciona para a página de login.
    """
    def _wrapped_view(request, *args, **kwargs):
        if not request.user.is_authenticated:
            print('Usuário não autenticado')
            return redirect('usuarios:login')
        return view_func(request, *args, **kwargs)
    return _wrapped_view