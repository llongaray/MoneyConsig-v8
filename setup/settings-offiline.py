import os
from pathlib import Path
from dotenv import load_dotenv


load_dotenv()

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# SECURITY WARNING: keep the secret key used in production secret!
SECRET_KEY = str(os.getenv('SECRET_KEY'))

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = True

# Application definition
ALLOWED_HOSTS = [
    '168.231.97.235', 
    '127.0.0.1', 
    '0.0.0.0', 
    '192.168.18.236', 
    '192.168.18.223', 
    '192.168.18.171', 
    '192.168.18.246', 
    'borealpoa.dyndns.org', 
    '186.214.123.244', 
    'money.local', 
    'local.host', 
    'sistema.moneypromotora.com.br', 
    '192.168.18.167'
]

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
    
    # Custom apps
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

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'custom_tags_app.middleware.SetorRedirectMiddleware',
]

ROOT_URLCONF = 'setup.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [
            BASE_DIR / '.templates',
            BASE_DIR / '.templates' / 'apps',
            BASE_DIR / '.templates' / 'partials',
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
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.mysql',
        'NAME': 'teste-moneylink',
        'USER': 'testmoneylink',
        'PASSWORD': 'moneylink@2025',
        'HOST': '127.0.0.1',
        'PORT': '3306',
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

# Authentication
AUTHENTICATION_BACKENDS = [
    'django.contrib.auth.backends.ModelBackend',
]

LOGIN_URL = '/autenticacao/login/'
LOGIN_REDIRECT_URL = '/'
LOGOUT_REDIRECT_URL = '/autenticacao/login/'

# Internationalization
LANGUAGE_CODE = 'pt-br'
TIME_ZONE = 'America/Sao_Paulo'
USE_I18N = True
USE_TZ = False  # Desativado para compatibilidade com MySQL

# Static files (CSS, JavaScript, Images)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STATICFILES_DIRS = [
    BASE_DIR / 'static',
]

# Media files
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Security settings
X_FRAME_OPTIONS = "SAMEORIGIN"

# CSRF settings
CSRF_COOKIE_SECURE = False  # Para desenvolvimento em HTTP
SESSION_COOKIE_SECURE = False  # Para desenvolvimento em HTTP
CSRF_USE_SESSIONS = True
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_NAME = "csrftoken"
CSRF_COOKIE_DOMAIN = None
CSRF_COOKIE_SAMESITE = None
CSRF_COOKIE_PATH = '/'

# Logging
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