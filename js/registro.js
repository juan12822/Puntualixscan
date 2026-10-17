document.addEventListener('DOMContentLoaded', () => {
    const userTypeButtons = document.querySelectorAll('[data-user-type]');
    const roleInput = document.getElementById('tipoUsuario');
    const roleLabel = document.getElementById('roleLabel');
    const form = document.getElementById('formRegistro');
    const adminRegistrationNotice = document.getElementById('adminRegistrationNotice');
    const cursoField = document.getElementById('cursoField');
    const cursoLabel = document.getElementById('cursoLabel');
    const cursoInput = document.getElementById('curso');
    const gradoGrupoField = document.getElementById('gradoGrupoField');
    const gradoRegistro = document.getElementById('gradoRegistro');
    const grupoRegistro = document.getElementById('grupoRegistro');

    let selectedUserType = '';

    function setUserType(userType) {
        if (userType !== 'estudiante' && userType !== 'administracion') return;

        selectedUserType = userType;
        const esEstudiante = userType === 'estudiante';
        roleInput.value = esEstudiante ? 'estudiante' : 'profesor';
        roleLabel.textContent = esEstudiante ? 'Estudiante' : 'Profesor';
        adminRegistrationNotice.hidden = esEstudiante;
        form.hidden = false;
        cursoField.style.display = esEstudiante ? 'none' : 'flex';
        cursoLabel.textContent = esEstudiante ? 'Grado y grupo' : 'Curso / Área';
        cursoInput.required = !esEstudiante;
        gradoGrupoField.style.display = esEstudiante ? 'grid' : 'none';
        gradoRegistro.required = esEstudiante;
        grupoRegistro.required = esEstudiante;

        userTypeButtons.forEach((button) => {
            const active = button.dataset.userType === userType;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
    }

    userTypeButtons.forEach((button) => {
        button.addEventListener('click', () => setUserType(button.dataset.userType));
    });

    async function registrarEnSupabase(datos) {
        const client = window.PUNTUALIXSCAN?.client;

        if (!client) {
            throw new Error('No se pudo conectar con Supabase.');
        }

        const { data: authData, error: authError } = await client.auth.signUp({
            email: datos.correo,
            password: datos.clave,
            options: {
                data: {
                    nombre: datos.nombre,
                    rol: datos.tipo,
                    tipo: datos.tipo,
                    documento: datos.documento,
                    telefono: datos.telefono,
                    curso: datos.curso
                }
            }
        });

        if (authError) {
            throw authError;
        }

        if (!authData?.user) {
            throw new Error('Supabase no devolvió el usuario registrado.');
        }

        return authData;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!selectedUserType) {
            Swal.fire({
                icon: 'warning',
                title: 'Selecciona el tipo de usuario',
                text: 'Elige Estudiante o Administración antes de continuar.',
                confirmButtonColor: '#165dff'
            });
            return;
        }

        const nombre = document.getElementById('nombreCompleto').value.trim();
        const documento = document.getElementById('documento').value.trim();
        const correo = document.getElementById('correoRegistro').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const tipo = selectedUserType === 'administracion' ? 'profesor' : 'estudiante';
        const curso = tipo === 'estudiante'
            ? `${gradoRegistro.value}-${grupoRegistro.value}`
            : cursoInput.value.trim();
        const clave = document.getElementById('claveRegistro').value.trim();

        if (!nombre || !documento || !correo || !telefono || !curso || !clave) {
            Swal.fire({
                icon: 'warning',
                title: 'Faltan datos',
                text: 'Completa todos los campos para registrar el usuario.',
                confirmButtonColor: '#165dff'
            });
            return;
        }

        if (tipo === 'estudiante' && (!gradoRegistro.value || !grupoRegistro.value)) {
            Swal.fire({
                icon: 'warning',
                title: 'Grado y grupo requeridos',
                text: 'Selecciona el grado y el grupo del estudiante.',
                confirmButtonColor: '#165dff'
            });
            return;
        }

        if (clave.length < 6) {
            Swal.fire({
                icon: 'warning',
                title: 'Contraseña corta',
                text: 'La contraseña debe tener al menos 6 caracteres.',
                confirmButtonColor: '#165dff'
            });
            return;
        }

        const datos = {
            nombre,
            documento,
            correo,
            telefono,
            curso,
            clave,
            tipo
        };

        try {
            await registrarEnSupabase(datos);
        } catch (error) {
            console.error('Error registrando usuario en Supabase:', error);
            Swal.fire({
                icon: 'error',
                title: 'No se pudo registrar el usuario',
                text: error.message || 'Supabase rechazó el registro. Verifica los datos e inténtalo nuevamente.',
                confirmButtonColor: '#165dff'
            });
            return;
        }

        Swal.fire({
            icon: 'info',
            title: `Registro recibido, ${nombre}`,
            text: 'Tu solicitud fue enviada correctamente y está pendiente de revisión y aprobación por parte de un administrador. Podrás iniciar sesión cuando tu cuenta sea aprobada.',
            confirmButtonColor: '#165dff'
        }).then(() => {
            window.location.href = 'login.html';
        });
    });
});
