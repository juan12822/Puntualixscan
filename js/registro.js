document.addEventListener('DOMContentLoaded', () => {
    const roleButtons = document.querySelectorAll('.role-option');
    const roleInput = document.getElementById('tipoUsuario');
    const roleLabel = document.getElementById('roleLabel');
    const form = document.getElementById('formRegistro');
    const client = window.PUNTUALIXSCAN?.client;
    const cursoField = document.getElementById('cursoField');
    const cursoLabel = document.getElementById('cursoLabel');
    const cursoInput = document.getElementById('curso');
    const gradoGrupoField = document.getElementById('gradoGrupoField');
    const gradoRegistro = document.getElementById('gradoRegistro');
    const grupoRegistro = document.getElementById('grupoRegistro');

    const roleNames = {
        estudiante: 'Estudiante',
        profesor: 'Profesor',
        administrador: 'Administrador'
    };

    function setRole(role) {
        const validRole = roleNames[role] ? role : 'estudiante';
        roleInput.value = validRole;
        roleLabel.textContent = roleNames[validRole];
        const esEstudiante = validRole === 'estudiante';
        cursoField.style.display = esEstudiante ? 'none' : 'flex';
        cursoLabel.textContent = esEstudiante ? 'Grado y grupo' : 'Curso / Área';
        cursoInput.required = !esEstudiante;
        gradoGrupoField.style.display = esEstudiante ? 'grid' : 'none';
        gradoRegistro.required = esEstudiante;
        grupoRegistro.required = esEstudiante;

        roleButtons.forEach((button) => {
            const active = button.dataset.role === validRole;
            button.classList.toggle('active', active);
        });
    }

    roleButtons.forEach((button) => {
        button.addEventListener('click', () => setRole(button.dataset.role));
    });

    setRole(roleInput.value);

    async function verificarEstudianteRegistrado(correo, documento) {
        if (!client) {
            throw new Error('No se pudo conectar con la base de datos de estudiantes.');
        }

        const { data, error } = await client
            .from('estudiantes')
            .select('id')
            .ilike('correo', correo.trim())
            .eq('documento', documento.trim())
            .limit(1)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return Boolean(data);
    }

    async function registrarEnSupabase(datos) {
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

        const nombre = document.getElementById('nombreCompleto').value.trim();
        const documento = document.getElementById('documento').value.trim();
        const correo = document.getElementById('correoRegistro').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const tipo = roleInput.value;
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

        if (tipo === 'estudiante') {
            try {
                const estudianteExiste = await verificarEstudianteRegistrado(
                    correo,
                    documento
                );

                if (!estudianteExiste) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Datos no coinciden',
                        text: 'El correo y el documento deben coincidir con el mismo estudiante registrado en la base de datos.',
                        confirmButtonColor: '#165dff'
                    });
                    return;
                }
            } catch (error) {
                console.error('Error verificando estudiante:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudieron validar los datos',
                    text: 'No fue posible consultar la base de datos de estudiantes. Inténtalo nuevamente.',
                    confirmButtonColor: '#165dff'
                });
                return;
            }
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
            icon: 'success',
            title: 'Usuario registrado',
            text: `Se creó correctamente la cuenta de ${roleNames[tipo]} en Supabase. Revisa tu correo si requiere confirmación.`,
            confirmButtonColor: '#165dff'
        }).then(() => {
            window.location.href = 'login.html';
        });
    });
});
