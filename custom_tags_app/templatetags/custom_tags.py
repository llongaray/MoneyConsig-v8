from django import template
from django.urls import reverse
from django.core.exceptions import ObjectDoesNotExist
from ..permissions import get_user_info
from django.contrib.auth.models import Group

register = template.Library()

@register.simple_tag
def get_user_permissions(user):
    """
    Retorna o nível de permissão e o setor para o usuário autenticado.
    Para 'Administrador(a)' e 'Suporte', o setor não é necessário.
    """
    if not user.is_authenticated:
        return {'level': 0, 'setor': None}

    # Define o nível de permissão
    if user.groups.filter(name='Administrador(a)').exists():
        return {'level': 4, 'setor': None}
    elif user.groups.filter(name='Suporte').exists():
        return {'level': 3, 'setor': None}
    elif user.groups.filter(name='Supervisor(a)').exists():
        if user.groups.filter(name='SIAPE').exists():
            return {'level': 2, 'setor': 'SIAPE'}
        elif user.groups.filter(name='INSS').exists():
            return {'level': 2, 'setor': 'INSS'}
        elif user.groups.filter(name='LOJAS').exists():
            return {'level': 2, 'setor': 'LOJAS'}
    elif user.groups.filter(name='Atendente').exists():
        if user.groups.filter(name='SIAPE').exists():
            return {'level': 1, 'setor': 'SIAPE'}
        elif user.groups.filter(name='INSS').exists():
            return {'level': 1, 'setor': 'INSS'}
        elif user.groups.filter(name='LOJAS').exists():
            return {'level': 1, 'setor': 'LOJAS'}

    return {'level': 0, 'setor': None}

@register.simple_tag
def get_user_cargo(user):
    print(f"\n----- Obtendo cargo para o usuário: {user.username} -----")
    funcionario, departamento_nome, cargo, nivel = get_user_info(user)
    if funcionario:
        print(f"Funcionário: {funcionario}")
        print(f"Departamento: {departamento_nome}")
        print(f"Cargo: {cargo}")
        print(f"Nível: {nivel}")
        return {'departamento': departamento_nome, 'nivel': nivel, 'cargo': str(cargo)}
    else:
        print(f"Aviso: Usuário {user.username} não tem um funcionário associado.")
        return {'departamento': None, 'nivel': None, 'cargo': None}

@register.simple_tag
def can_view_button(user, button_type):
    """
    Verifica se o usuário pode ver determinado botão baseado em seu nível
    """
    funcionario, departamento_nome, cargo, nivel = get_user_info(user)
    
    if user.is_superuser:
        return True
        
    if not nivel:
        return False
        
    # Define a hierarquia de níveis
    niveis_hierarquia = {
        'TOTAL': 5,
        'SUPERVISOR GERAL': 4,
        'COORDENADOR': 3,
        'GERENTE': 2,
        'PADRÃO': 1,
        'ESTÁGIO': 0
    }
    
    # Pega o nível do usuário
    nivel_usuario = niveis_hierarquia.get(nivel, 0)
    
    # Define os níveis mínimos para cada tipo de botão
    niveis_minimos = {
        'consulta': 0,  # ESTÁGIO e acima
        'campanha': 5,  # TOTAL apenas
        'registro': 4,  # SUPERVISOR GERAL e acima
        'meta': 4       # SUPERVISOR GERAL e acima
    }
    
    # Verifica o nível mínimo necessário
    nivel_minimo = niveis_minimos.get(button_type, 5)  # Default para TOTAL
    
    return nivel_usuario >= nivel_minimo

@register.simple_tag
def get_user_groups(user):
    """
    Retorna os grupos do usuário e verifica permissões especiais
    """
    if not user.is_authenticated:
        return {'groups': [], 'is_admin': False}
        
    grupos = [group.name for group in user.groups.all()]
    is_admin = user.is_superuser or 'ADMINISTRAÇÃO' in grupos
    
    print(f"\n----- Obtendo grupos para o usuário: {user.username} -----")
    print(f"Grupos: {grupos}")
    print(f"É admin: {is_admin}")
    
    return {
        'groups': grupos,
        'is_admin': is_admin
    }

@register.simple_tag
def can_view_inss_button(user, button_type):
    """
    Verifica permissões específicas para botões do INSS
    """
    if user.is_superuser:
        return True
        
    funcionario, departamento_nome, cargo, nivel = get_user_info(user)
    
    # Função auxiliar para extrair o cargo base (antes do ' - ')
    def get_base_cargo(nome_cargo):
        return nome_cargo.split(' - ')[0] if ' - ' in nome_cargo else nome_cargo
    
    # Verifica se o usuário está no grupo correspondente
    is_atendente = any(get_base_cargo(group.name) == 'ATENDENTE' for group in user.groups.all())
    is_vendedor_loja = any(get_base_cargo(group.name) == 'VENDEDOR(A) LOJA' for group in user.groups.all())
    is_supervisor = any(group.name == 'VENDEDOR(A) - SUPERVISOR GERAL' for group in user.groups.all())
    
    # Verifica também o cargo do funcionário
    if cargo:
        cargo_grupo = Group.objects.get(id=cargo.id)
        cargo_base = get_base_cargo(cargo_grupo.name)
        is_atendente = is_atendente or cargo_base == 'ATENDENTE'
        is_vendedor_loja = is_vendedor_loja or cargo_base == 'VENDEDOR(A) LOJA'
        is_supervisor = is_supervisor or cargo_grupo.name == 'VENDEDOR(A) - SUPERVISOR GERAL'
    
    # Define permiss��es por tipo de botão
    if button_type in ['agendamento', 'confirmacao', 'reagendamento']:
        return is_atendente
    
    elif button_type in ['clientes_loja', 'todos_agendamentos']:
        return is_vendedor_loja
    
    elif button_type == 'agendamentos_tac':
        return is_vendedor_loja and is_supervisor
    
    return False

@register.simple_tag
def can_view_funcionarios_button(user, button_type):
    """
    Verifica permissões específicas para botões da área de funcionários
    """
    if user.is_superuser:
        return True
        
    funcionario, departamento_nome, cargo, nivel = get_user_info(user)
    
    # Verifica se o usuário está no departamento RH ou grupo RH
    is_rh = False
    if departamento_nome == 'RH' or user.groups.filter(name='RH').exists():
        is_rh = True
    
    # Verifica se o usuário é do TI (cargo ou grupo)
    is_ti = False
    if cargo and cargo.grupo.name == 'TI' or user.groups.filter(name='TI').exists():
        is_ti = True
    
    # Botões que requerem apenas RH
    rh_buttons = [
        'cadastro_funcionario',
        'cadastro_empresa',
        'cadastro_loja',
        'cadastro_departamento',
        'cadastro_cargo',
        'cadastro_horario',
        'lista_funcionarios'
    ]
    
    # Botões que requerem TI
    ti_buttons = [
        'cadastro_usuario',
        'associar_grupos'
    ]
    
    if button_type in rh_buttons:
        return is_rh
    elif button_type in ti_buttons:
        return is_ti
        
    return False


@register.simple_tag
def can_view_moneyplus(user):
    """
    Verifica se o usuário participa de alguma equipe ativa.
    """
    if not user.is_authenticated:
        return False

    return user.equipes.filter(status=True).exists()