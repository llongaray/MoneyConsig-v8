from django.contrib.auth.decorators import login_required
from django.http import HttpResponse
from django.core.exceptions import ObjectDoesNotExist
from django.contrib.auth.models import Group
from apps.funcionarios.models import Funcionario, Departamento, Cargo
import logging
from django.shortcuts import redirect
from django.contrib import messages

logger = logging.getLogger(__name__)

def get_user_info(user):
    try:
        funcionario = Funcionario.objects.get(usuario_id=user.id)
        departamento = funcionario.departamento
        cargo = funcionario.cargo
        if departamento:
            departamento_nome = departamento.grupo.name
        else:
            departamento_nome = None
        nivel = cargo.nivel if cargo else None
        return funcionario, departamento_nome, cargo, nivel
    except ObjectDoesNotExist:
        return None, None, None, None

def check_access(departamento, nivel_minimo):
    def decorator(view_func):
        @login_required
        def _wrapped_view(request, *args, **kwargs):
            user = request.user
            # print(f"\n----- Verificando acesso para o usuário: {user.username} -----")
            
            if user.is_superuser or user.groups.filter(name='ADMINISTRAÇÃO').exists():
                # print(f"Usuário {user.username} é superuser ou pertence ao grupo ADMINISTRAÇÃO. Acesso concedido.")
                return view_func(request, *args, **kwargs)

            funcionario, departamento_nome, cargo, nivel = get_user_info(user)
            
            if not funcionario:
                # print(f"Erro: Usuário {user.username} não tem um funcionário associado.")
                messages.error(request, "Usuário não tem um funcionário associado.")
                return redirect('siape:ranking')

            # print(f"Funcionário: {funcionario}")
            # print(f"Departamento: {departamento_nome}")
            # print(f"Cargo: {cargo}")
            # print(f"Nível: {nivel}")

            # Verifica se o usuário pertence ao departamento ou ao grupo correspondente
            pertence_ao_departamento = departamento_nome == departamento
            pertence_ao_grupo = user.groups.filter(name=departamento).exists()

            if not (pertence_ao_departamento or pertence_ao_grupo) and departamento != 'TODOS':
                # print(f"Acesso negado. Usuário não pertence ao departamento ou grupo {departamento}.")
                messages.error(request, f"Acesso negado. Você não pertence ao departamento {departamento}.")
                return redirect('siape:ranking')

            niveis_hierarquia = {
                'ESTAGIO': 1,
                'PADRÃO': 2,
                'GERENTE': 3,
                'COORDENADOR': 4,
                'SUPERVISOR GERAL': 5,
                'TOTAL': 6
            }
            
            nivel_usuario = niveis_hierarquia.get(nivel, 0)
            nivel_minimo_req = niveis_hierarquia.get(nivel_minimo, 6)
            
            if nivel_usuario < nivel_minimo_req:
                # print(f"Acesso negado. Nível do usuário ({nivel}) é inferior ao requerido ({nivel_minimo}).")
                messages.error(request, f"Acesso negado. Nível mínimo requerido: {nivel_minimo}.")
                return redirect('geral:ranking', {'mensagem': {'texto': f"Acesso negado. Nível mínimo requerido: {nivel_minimo}.", 'classe': 'error'}})

            # print(f"Acesso concedido para {user.username}.")
            return view_func(request, *args, **kwargs)

        return _wrapped_view
    return decorator

def check_access_light(view_func):
    @login_required
    def _wrapped_view(request, *args, **kwargs):
        user = request.user
        # print(f"\n----- Acesso leve verificado para o usuário: {user.username} -----")
        funcionario, departamento_nome, cargo, nivel = get_user_info(user)
        #if funcionario:
            # print(f"Funcionário: {funcionario}")
            # print(f"Departamento: {departamento_nome}")
            # print(f"Cargo: {cargo}")
            # print(f"Nível: {nivel}")
        #else:
            # print(f"Aviso: Usuário {user.username} não tem um funcionário associado.")
        
        return view_func(request, *args, **kwargs)
    return _wrapped_view

def is_rh_or_superuser(user):
    """Verifica se o usuário é superusuário ou pertence ao RH."""
    if not user.is_authenticated:
        return False
    if user.is_superuser:
        return True

    # Verifica se pertence ao grupo RH ou ao departamento RH (via Funcionario)
    if user.groups.filter(name='RH').exists():
        return True

    funcionario, departamento_nome, _, _ = get_user_info(user)
    if departamento_nome == 'RH': # Certifique-se que 'RH' é o nome correto
        return True

    return False
