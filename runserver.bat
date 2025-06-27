@echo off
REM ---------------------------------------------------------
REM runserver.bat – ativa o venv (se existir) e sobe o servidor
REM ---------------------------------------------------------

echo Procurando virtualenv...
set "VENV_ACTIVATE="

if exist "venv\Scripts\activate.bat" (
    set "VENV_ACTIVATE=venv\Scripts\activate.bat"
) else if exist ".venv\Scripts\activate.bat" (
    set "VENV_ACTIVATE=.venv\Scripts\activate.bat"
)

if defined VENV_ACTIVATE (
    echo ✔︎ Encontrado virtualenv: %VENV_ACTIVATE%
    echo Ativando virtualenv...
    call "%VENV_ACTIVATE%"
    echo Virtualenv ativado.
    echo.
    echo Iniciando servidor Django...
    python manage.py runserver
) else (
    echo ⚠️  Nenhum virtualenv encontrado em "venv" ou ".venv". Abortando execução.
)

echo.
echo Fim do script. Pressione qualquer tecla para fechar...
pause >nul
