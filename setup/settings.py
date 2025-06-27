import os
from pathlib import Path
from dotenv import load_dotenv


load_dotenv()

# Definição do diretório base do projeto
BASE_DIR = Path(__file__).resolve().parent.parent

# Configurações gerais do projeto

# Chave secreta para segurança
SECRET_KEY = str(os.getenv('SECRET_KEY'))

# Debug ativado para ambiente de desenvolvimento
DEBUG = True

# Hosts permitidos durante o desenvolvimento
ALLOWED_HOSTS = ['168.231.97.235', '127.0.0.1', '0.0.0.0', '192.168.18.236', '192.168.18.223', '192.168.18.171', '192.168.18.246', '192.168.18.246:8000', 'borealpoa.dyndns.org', 'borealpoa.dyndns.org:8000', '186.214.123.244', 'money.local', 'local.host', 'sistema.moneypromotora.com.br', '192.168.18.167']

CSRF_TRUSTED_ORIGINS = [
    'https://192.168.18.246',
    'http://192.168.18.246',
    'http://192.168.18.246:8000',
    'http://borealpoa.dyndns.org:8000',
    'https://sistema.moneypromotora.com.br',
    'http://sistema.moneypromotora.com.br',
    'http://168.231.97.235:7000',
    'http://168.231.97.235',
]



# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'custom_tags_app',
    'apps.funcionarios.apps.FuncionariosConfig',
    'apps.siape.apps.SiapeConfig',
    'apps.inss.apps.InssConfig',
    'apps.usuarios.apps.UsuariosConfig',
    'apps.moneyplus.apps.MoneyplusConfig',
    'apps.administrativo.apps.AdministrativoConfig',
    'apps.juridico.apps.JuridicoConfig',
    'apps.marketing.apps.MarketingConfig',
]

AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'custom_tags_app.middleware.SetorRedirectMiddleware',
    'custom_tags_app.middleware.PresencaAutoMiddleware',  # Middleware para captura automática de presença com IP real
]

ROOT_URLCONF = 'setup.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            os.path.join(BASE_DIR, '.templates'),
            os.path.join(BASE_DIR, '.templates/apps'),
            os.path.join(BASE_DIR, '.templates/partials')
        ],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'setup.wsgi.application'

# Database
#DATABASES = {
#    'default': {
#        'ENGINE': 'django.db.backends.sqlite3',
#        'NAME': BASE_DIR / 'db.sqlite3',
#    }
#}

DATABASES = {
    'default': {
        'ENGINE':   'django.db.backends.mysql',
        'NAME':     'moneylinkpro',
        'USER':     'moneylink',
        'PASSWORD': 'M@k9m3p1',
        'HOST':     '127.0.0.1',    # ou 'SEU_IP_SERVIDOR' para acesso externo 🌐
        'PORT':     '3306',
        'OPTIONS': {
            'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            'charset': 'utf8mb4',
        },
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'pt-br'

TIME_ZONE = 'America/Sao_Paulo'

USE_I18N = True

# Desativando o suporte a timezone para evitar problemas com o MySQL
USE_TZ = False

# Configurações de arquivos estáticos
STATIC_URL = '/static/'

STATICFILES_DIRS = [
    os.path.join(BASE_DIR, 'static'),
    os.path.join(BASE_DIR, 'static', 'img'),
    os.path.join(BASE_DIR, 'static', 'img', 'apps'),
    os.path.join(BASE_DIR, 'static', 'img', 'geral'),
    os.path.join(BASE_DIR, 'static', 'css'),
    os.path.join(BASE_DIR, 'static', 'css', 'apps'),
    os.path.join(BASE_DIR, 'static', 'css', 'partials'),
    os.path.join(BASE_DIR, 'static', 'js'),
    os.path.join(BASE_DIR, 'static', 'js', 'apps'),
    os.path.join(BASE_DIR, 'static', 'files'),
]

STATIC_ROOT = BASE_DIR / 'staticfiles'

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Configuração de opções de frame X-Frame
X_FRAME_OPTIONS = "SAMEORIGIN"

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO',
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': True,
        },
        'custom_tags_app': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}


CSRF_COOKIE_SECURE = False  # Permite CSRF em HTTP
SESSION_COOKIE_SECURE = False  # Permite sessões sem HTTPS
CSRF_USE_SESSIONS = True  # Usa a sessão para validar CSRF
CSRF_COOKIE_HTTPONLY = False  # Permite acesso ao cookie via JavaScript
CSRF_COOKIE_NAME = "csrftoken"  # Nome do cookie CSRF padrão
CSRF_COOKIE_DOMAIN = None  # Permite CSRF funcionar sem um domínio específico
CSRF_COOKIE_SAMESITE = None  # Permite CSRF funcionar em qualquer contexto
CSRF_COOKIE_PATH = '/'  # Cookie disponível em todo o site

# Em settings.py, logo abaixo de ALLOWED_HOSTS:
LOGIN_URL = '/autenticacao/login/'
LOGIN_REDIRECT_URL = '/'      # (ou outra URL padrão depois do login)
LOGOUT_REDIRECT_URL = '/autenticacao/login/'

# Configurações para captura correta de IP real através de proxies
USE_X_FORWARDED_HOST = True
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# Lista de headers confiáveis para captura de IP real
# Usado quando o Django está atrás de um proxy/load balancer
TRUSTED_IP_HEADERS = [
    'HTTP_X_FORWARDED_FOR',
    'HTTP_X_REAL_IP', 
    'HTTP_CF_CONNECTING_IP',  # Cloudflare
    'HTTP_X_CLUSTER_CLIENT_IP',
    'REMOTE_ADDR'
]