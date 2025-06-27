from django import forms
from django.contrib.auth.models import User, Group
from django.core.exceptions import ValidationError
from .models import (
    Funcionario, Empresa, Loja, Departamento, Setor, Equipe, 
    Cargo, HorarioTrabalho, ArquivoFuncionario
)

# --- Formulários de Configuração (Empresa, Loja, Depto, Setor, Cargo, Horario, Equipe) ---

class EmpresaForm(forms.ModelForm):
    class Meta:
        model = Empresa
        fields = ['nome', 'cnpj', 'endereco', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'cnpj': forms.TextInput(attrs={'class': 'form-control'}), # Adicionar máscara se necessário
            'endereco': forms.TextInput(attrs={'class': 'form-control'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }

class LojaForm(forms.ModelForm):
    class Meta:
        model = Loja
        fields = ['nome', 'empresa', 'logo', 'franquia', 'filial', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'empresa': forms.Select(attrs={'class': 'form-control'}),
            'logo': forms.ClearableFileInput(attrs={'class': 'form-control-file'}),
            'franquia': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'filial': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['empresa'].queryset = Empresa.objects.filter(status=True)

class DepartamentoForm(forms.ModelForm):
    class Meta:
        model = Departamento
        fields = ['nome', 'empresa', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'empresa': forms.Select(attrs={'class': 'form-control'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['empresa'].queryset = Empresa.objects.filter(status=True)

class SetorForm(forms.ModelForm):
    class Meta:
        model = Setor
        fields = ['nome', 'departamento', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'departamento': forms.Select(attrs={'class': 'form-control'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtra departamentos ativos
        self.fields['departamento'].queryset = Departamento.objects.filter(status=True)
        # Opcional: filtrar por empresa selecionada (requer JS ou passagem de empresa)
        # empresa_id = self.initial.get('empresa') or getattr(self.instance, 'departamento.empresa_id', None)
        # if empresa_id:
        #     self.fields['departamento'].queryset = Departamento.objects.filter(status=True, empresa_id=empresa_id)

class EquipeForm(forms.ModelForm):
    class Meta:
        model = Equipe
        fields = ['nome', 'participantes', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'participantes': forms.SelectMultiple(attrs={'class': 'form-control select2'}), # Usar Select2 ou similar
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
        filter_horizontal = ('participantes',)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Filtra usuários ativos
        self.fields['participantes'].queryset = User.objects.filter(is_active=True)

class CargoForm(forms.ModelForm):
    class Meta:
        model = Cargo
        fields = ['nome', 'empresa', 'hierarquia', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'empresa': forms.Select(attrs={'class': 'form-control'}),
            'hierarquia': forms.Select(attrs={'class': 'form-control'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }
        
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['empresa'].queryset = Empresa.objects.filter(status=True)

class HorarioTrabalhoForm(forms.ModelForm):
    class Meta:
        model = HorarioTrabalho
        fields = ['nome', 'entrada', 'saida_almoco', 'volta_almoco', 'saida', 'status']
        widgets = {
            'nome': forms.TextInput(attrs={'class': 'form-control'}),
            'entrada': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control'}),
            'saida_almoco': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control'}),
            'volta_almoco': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control'}),
            'saida': forms.TimeInput(format='%H:%M', attrs={'type': 'time', 'class': 'form-control'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }

# --- Formulário Principal do Funcionário ---

class FuncionarioForm(forms.ModelForm):
    class Meta:
        model = Funcionario
        fields = [
            # Vinculo
            'usuario',
            # Pessoal
            'apelido', 'nome_completo', 'foto', 'cpf', 'data_nascimento', 'genero', 'estado_civil',
            # Contato
            'celular1', 'celular2', 'cep', 'endereco', 'bairro', 'cidade', 'estado', 
            # Filiação / Origem
            'nome_mae', 'nome_pai', 'nacionalidade', 'naturalidade',
            # Profissional
            'matricula', 'pis', 'empresa', 'lojas', 'departamento', 'setor', 'cargo', 
            'horario', 'equipe', 'status', 'data_admissao', 'data_demissao'
            # Adicionar campos de documentos (RG, CNH, CTPS, etc.) se forem reativados no modelo
        ]
        widgets = {
            # Datas
            'data_nascimento': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'form-control'}),
            'data_admissao': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'form-control'}),
            'data_demissao': forms.DateInput(format='%Y-%m-%d', attrs={'type': 'date', 'class': 'form-control'}),
            # Arquivos
            'foto': forms.ClearableFileInput(attrs={'class': 'form-control-file'}),
            # Checkbox
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
            # Selects (serão configurados no __init__)
            'empresa': forms.Select(attrs={'class': 'form-control'}),
            'lojas': forms.CheckboxSelectMultiple(attrs={'class': 'form-check-input'}),
            'departamento': forms.Select(attrs={'class': 'form-control'}),
            'setor': forms.Select(attrs={'class': 'form-control'}),
            'cargo': forms.Select(attrs={'class': 'form-control'}),
            'horario': forms.Select(attrs={'class': 'form-control'}),
            'equipe': forms.Select(attrs={'class': 'form-control'}),
            'usuario': forms.Select(attrs={'class': 'form-control select2'}), # Para busca de usuário
            'genero': forms.TextInput(attrs={'class': 'form-control'}), # Ou Select se tiver choices fixos
            'estado_civil': forms.TextInput(attrs={'class': 'form-control'}), # Ou Select
            'estado': forms.TextInput(attrs={'class': 'form-control', 'maxlength': 2}),
            # Campos de texto padrão
            'apelido': forms.TextInput(attrs={'class': 'form-control'}),
            'nome_completo': forms.TextInput(attrs={'class': 'form-control'}),
            'cpf': forms.TextInput(attrs={'class': 'form-control'}), # Adicionar máscara
            'celular1': forms.TextInput(attrs={'class': 'form-control'}), # Adicionar máscara
            'celular2': forms.TextInput(attrs={'class': 'form-control'}), # Adicionar máscara
            'cep': forms.TextInput(attrs={'class': 'form-control'}), # Adicionar máscara/JS
            'endereco': forms.TextInput(attrs={'class': 'form-control'}),
            'bairro': forms.TextInput(attrs={'class': 'form-control'}),
            'cidade': forms.TextInput(attrs={'class': 'form-control'}),
            'nome_mae': forms.TextInput(attrs={'class': 'form-control'}),
            'nome_pai': forms.TextInput(attrs={'class': 'form-control'}),
            'nacionalidade': forms.TextInput(attrs={'class': 'form-control'}),
            'naturalidade': forms.TextInput(attrs={'class': 'form-control'}),
            'matricula': forms.TextInput(attrs={'class': 'form-control'}),
            'pis': forms.TextInput(attrs={'class': 'form-control'}),
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        empresa = self.instance.empresa if self.instance and self.instance.pk else None
        departamento = self.instance.departamento if self.instance and self.instance.pk else None

        # Filtrar Querysets baseado na empresa (se aplicável)
        self.fields['empresa'].queryset = Empresa.objects.filter(status=True)
        self.fields['lojas'].queryset = Loja.objects.filter(status=True)
        self.fields['departamento'].queryset = Departamento.objects.filter(status=True)
        self.fields['setor'].queryset = Setor.objects.filter(status=True)
        self.fields['cargo'].queryset = Cargo.objects.filter(status=True)
        self.fields['horario'].queryset = HorarioTrabalho.objects.filter(status=True)
        self.fields['equipe'].queryset = Equipe.objects.filter(status=True)
        self.fields['usuario'].queryset = User.objects.filter(is_active=True)

        # Filtragem dependente (ex: Lojas da Empresa selecionada)
        if empresa:
            self.fields['lojas'].queryset = Loja.objects.filter(empresa=empresa, status=True)
            self.fields['departamento'].queryset = Departamento.objects.filter(empresa=empresa, status=True)
            self.fields['cargo'].queryset = Cargo.objects.filter(empresa=empresa, status=True)
        else:
            # Se nenhuma empresa selecionada (novo funcionário), mostrar apenas os não vinculados ou todos?
            # Ou exigir seleção de empresa primeiro (via JS)
            self.fields['lojas'].queryset = Loja.objects.none()
            self.fields['departamento'].queryset = Departamento.objects.none()
            self.fields['cargo'].queryset = Cargo.objects.none()
            self.fields['setor'].queryset = Setor.objects.none()

        # Filtrar Setores do Departamento selecionado
        if departamento:
             self.fields['setor'].queryset = Setor.objects.filter(departamento=departamento, status=True)
        # else: # Se o departamento não estiver selecionado ainda
        #     self.fields['setor'].queryset = Setor.objects.none()
        
        # Adicionar lógica JS no template para atualizar Lojas, Deptos, Setores, Cargos 
        # dinamicamente quando a Empresa ou Departamento mudar.

    # Adicionar validações específicas (clean_cpf, clean_matricula, etc.) se necessário
    def clean_cpf(self):
        cpf = self.cleaned_data.get('cpf')
        # Adicionar lógica para remover máscara e validar CPF
        return cpf

# --- Formulários de Usuário --- 

class UserForm(forms.ModelForm):
    confirma_password = forms.CharField(widget=forms.PasswordInput(attrs={'class': 'form-control'}), label='Confirme a Senha')

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name', 'password'] # Adicionado first_name, last_name
        widgets = {
            'username': forms.TextInput(attrs={'class': 'form-control'}),
            'email': forms.EmailInput(attrs={'class': 'form-control'}),
            'first_name': forms.TextInput(attrs={'class': 'form-control'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control'}),
            'password': forms.PasswordInput(attrs={'class': 'form-control'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get("password")
        confirma_password = cleaned_data.get("confirma_password")

        if password and confirma_password and password != confirma_password:
            self.add_error('confirma_password', "As senhas não coincidem.")
        return cleaned_data

class UserGroupForm(forms.Form):
    user = forms.ModelChoiceField(
        queryset=User.objects.all(), 
        required=True, 
        widget=forms.Select(attrs={'class': 'form-control'})
    )
    groups = forms.ModelMultipleChoiceField(
        queryset=Group.objects.all(), 
        required=False, # Tornar opcional?
        widget=forms.CheckboxSelectMultiple # Ou SelectMultiple com Select2
    )
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['user'].queryset = User.objects.filter(is_active=True)

# --- Formulário para Arquivos do Funcionário ---

class ArquivoFuncionarioForm(forms.ModelForm):
    class Meta:
        model = ArquivoFuncionario
        fields = ['funcionario', 'titulo', 'descricao', 'arquivo', 'status']
        widgets = {
            'funcionario': forms.Select(attrs={'class': 'form-control'}), # Usar Select2 ou autocomplete
            'titulo': forms.TextInput(attrs={'class': 'form-control'}),
            'descricao': forms.Textarea(attrs={'class': 'form-control', 'rows': 3}),
            'arquivo': forms.ClearableFileInput(attrs={'class': 'form-control-file'}),
            'status': forms.CheckboxInput(attrs={'class': 'form-check-input'})
        }

    def __init__(self, *args, **kwargs):
        funcionario_instance = kwargs.pop('funcionario_instance', None)
        super().__init__(*args, **kwargs)
        # Se um funcionário específico está sendo editado, filtra o campo
        if funcionario_instance:
             self.fields['funcionario'].queryset = Funcionario.objects.filter(pk=funcionario_instance.pk)
             self.fields['funcionario'].initial = funcionario_instance
             self.fields['funcionario'].widget = forms.HiddenInput()
        else:
            # Permite selecionar qualquer funcionário ativo
            self.fields['funcionario'].queryset = Funcionario.objects.filter(status=True)

# Remover Formulários antigos/não utilizados (FuncionarioForm antigo, DepartamentoForm/CargoForm com Groups)
