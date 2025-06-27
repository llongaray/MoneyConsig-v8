# customtags/templatetags/permissionsacess.py

from functools import wraps
from django import template
from django.contrib.auth.models import User
from django.shortcuts import redirect
from apps.usuarios.models import ControleAcessos, Acesso

register = template.Library()

def user_has_access(user: User, code: str) -> bool:
    """
    Retorna True se:
    - user.is_superuser
    - usuário autenticado e possui o acesso <TIPO><ID>
    """
    # print(f"DEBUG: Checking access for user: {user} with code: {code}")
    if not user or not user.is_authenticated:
        # print(f"DEBUG: User {user} is not authenticated. Access denied.")
        return False
    if user.is_superuser:
        # print(f"DEBUG: User {user} is superuser. Access granted.")
        return True

    # extrai tipo e id, garantindo que testamos prefixos mais longos primeiro
    tipos = sorted([t for t, _ in Acesso.TIPO_CHOICES], key=len, reverse=True)
    acesso_id = None
    tipo_code = None

    # print(f"DEBUG: Attempting to parse code: {code}")
    for tipo in tipos:
        if code.startswith(tipo):
            try:
                acesso_id = int(code[len(tipo):])
                tipo_code = tipo
                # print(f"DEBUG: Parsed code: tipo={tipo_code}, id={acesso_id}")
            except ValueError:
                # print(f"DEBUG: ValueError parsing ID from code: {code}. Access denied.")
                return False
            break

    if acesso_id is None or tipo_code is None:
        # print(f"DEBUG: Could not parse type or ID from code: {code}. Access denied.")
        return False

    # verifica Acesso ativo
    acesso_exists = Acesso.objects.filter(id=acesso_id, tipo=tipo_code, status=True).exists()
    # print(f"DEBUG: Checking if Acesso (id={acesso_id}, tipo={tipo_code}) is active: {acesso_exists}")
    if not acesso_exists:
        # print(f"DEBUG: Acesso (id={acesso_id}, tipo={tipo_code}) is not active. Access denied.")
        return False

    # checa no ControleAcessos
    has_controle_acesso = ControleAcessos.objects.filter(
        user=user,
        status=True,
        acessos__id=acesso_id
    ).exists()
    # print(f"DEBUG: Checking ControleAcessos for user {user} and Acesso id {acesso_id}: {has_controle_acesso}")
    # print(f"DEBUG: Final access result for user {user} and code {code}: {has_controle_acesso}")
    return has_controle_acesso


def controle_acess(code):
    """
    Decorator para views:
      @controle_acess('CT3')
      def minha_view(request): ...
    Usuário sem permissão é redirecionado para '/' ou para o dashboard jurídico se for do setor jurídico.
    """
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped(request, *args, **kwargs):
            # print(f"DEBUG: controle_acess decorator applied to view: {view_func.__name__} with code: {code}")
            if user_has_access(request.user, code):
                # print(f"DEBUG: User {request.user} has access to view {view_func.__name__}. Proceeding.")
                return view_func(request, *args, **kwargs)
            
            # Verifica se o usuário é do departamento jurídico
            try:
                if request.user.is_authenticated and hasattr(request.user, 'funcionario_profile'):
                    funcionario = request.user.funcionario_profile
                    if funcionario and funcionario.departamento and funcionario.departamento.nome.upper() == 'JURIDICO':
                        # Redireciona para o dashboard jurídico
                        return redirect('juridico:dashboard_acoes')
            except Exception:
                # Se ocorrer algum erro, continua com o redirecionamento padrão
                pass
                
            # print(f"DEBUG: User {request.user} does NOT have access to view {view_func.__name__}. Redirecting to '/'.")
            return redirect('/')
        return _wrapped
    return decorator


@register.simple_tag
def has_access(user, code):
    # print(f"DEBUG: has_access simple_tag called for user: {user} with code: {code}")
    return user_has_access(user, code)


@register.filter(name='has_access')
def has_access_filter(user, code):
    # print(f"DEBUG: has_access filter called for user: {user} with code: {code}")
    return user_has_access(user, code)
