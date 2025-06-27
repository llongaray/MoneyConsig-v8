from django.shortcuts import redirect
from django.urls import reverse
from django.utils import timezone
from django.utils.deprecation import MiddlewareMixin

def get_client_ip_middleware(request):
    """
    Função para obter o IP real do cliente no middleware, considerando proxies e load balancers.
    """
    import ipaddress
    
    # Lista de headers para verificar em ordem de prioridade
    ip_headers = [
        'HTTP_X_FORWARDED_FOR',
        'HTTP_X_REAL_IP',
        'HTTP_CF_CONNECTING_IP',     # Cloudflare
        'HTTP_X_CLUSTER_CLIENT_IP',
        'HTTP_X_FORWARDED',
        'HTTP_FORWARDED_FOR',
        'HTTP_FORWARDED',
        'REMOTE_ADDR'
    ]
    
    def is_valid_ip(ip_str):
        """Verifica se o IP é válido e não é privado/local"""
        try:
            ip_obj = ipaddress.ip_address(ip_str.strip())
            # Exclui IPs privados, localhost e multicast
            return not (ip_obj.is_private or ip_obj.is_loopback or 
                       ip_obj.is_multicast or ip_obj.is_reserved)
        except (ipaddress.AddressValueError, ValueError):
            return False
    
    def extract_first_public_ip(ip_list):
        """Extrai o primeiro IP público de uma lista de IPs"""
        for ip in ip_list.split(','):
            ip = ip.strip()
            if ip and is_valid_ip(ip):
                return ip
        return None
    
    # Verifica cada header em ordem de prioridade
    for header in ip_headers:
        ip_value = request.META.get(header)
        if ip_value:
            # Se o header contém múltiplos IPs (separados por vírgula)
            if ',' in ip_value:
                public_ip = extract_first_public_ip(ip_value)
                if public_ip:
                    return public_ip
            else:
                # Verifica se o IP único é válido e público
                ip_clean = ip_value.strip()
                if is_valid_ip(ip_clean):
                    return ip_clean
    
    # Se não encontrou nenhum IP público, usa REMOTE_ADDR mesmo que seja privado
    fallback_ip = request.META.get('REMOTE_ADDR', 'IP não disponível')
    return fallback_ip

class SetorRedirectMiddleware:
    """
    Middleware para redirecionar usuários com base em seu departamento.
    Redireciona funcionários do departamento jurídico para o dashboard jurídico.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Processa apenas se o usuário estiver autenticado e a URL for a raiz
        if request.user.is_authenticated and request.path == '/':
            try:
                # Tenta obter o funcionário associado ao usuário
                funcionario = request.user.funcionario_profile
                
                # Verifica se o funcionário existe e tem um departamento
                if funcionario and funcionario.departamento:
                    # Se o departamento for "JURIDICO", redireciona para o dashboard jurídico
                    if funcionario.departamento.nome.upper() == 'JURIDICO':
                        return redirect(reverse('juridico:dashboard_acoes'))
            except Exception as e:
                # Se ocorrer algum erro, apenas continua o fluxo normal
                pass

        # Continua o processamento normal para outros casos
        return self.get_response(request)

class PresencaAutoMiddleware(MiddlewareMixin):
    """
    Middleware para criar automaticamente EntradaAuto quando um funcionário acessa o sistema.
    Captura o IP real do cliente considerando proxies e load balancers.
    """
    
    def process_request(self, request):
        """
        Verifica se o usuário é um funcionário autenticado e cria/atualiza EntradaAuto.
        """
        # Só processa se o usuário estiver autenticado
        if not request.user.is_authenticated:
            return None
            
        try:
            # Verifica se o usuário é um funcionário ativo
            funcionario = getattr(request.user, 'funcionario_profile', None)
            if not funcionario or not funcionario.status:
                return None
            
            # Importa os modelos necessários
            from apps.funcionarios.models import EntradaAuto
            
            # Data atual
            hoje = timezone.now().date()
            
            # Verifica se já existe entrada para hoje
            entrada_auto, created = EntradaAuto.objects.get_or_create(
                usuario=request.user,
                data=hoje,
                defaults={
                    'ip_usado': get_client_ip_middleware(request),
                    'datahora': timezone.now()
                }
            )
            
            # Se já existe mas o IP é diferente, atualiza
            if not created:
                current_ip = get_client_ip_middleware(request)
                if entrada_auto.ip_usado != current_ip:
                    entrada_auto.ip_usado = current_ip
                    entrada_auto.save(update_fields=['ip_usado'])
                    
        except Exception as e:
            # Log do erro mas não interrompe o fluxo da aplicação
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Erro no PresencaAutoMiddleware: {e}")
            
        return None
