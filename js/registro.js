document.addEventListener('DOMContentLoaded', () => {
    const roleButtons = document.querySelectorAll('.role-option');
    const roleInput = document.getElementById('tipoUsuario');
    const roleLabel = document.getElementById('roleLabel');
    const form = document.getElementById('formRegistro');
    const client = window.PUNTUALIXSCAN?.client;

    const roleNames = {
        estudiante: 'Estudiante',
        profesor: 'Profesor',
        administrador: 'Administrador'
    };

    function setRole(role) {
        const validRole = roleNames[role] ? role : 'estudiante';
        roleInput.value = validRole;
        roleLabel.textContent = roleNames[validRole];

        roleButtons.forEach((button) => {
            const active = button.dataset.role === validRole;
            button.classList.toggle('active', active);
        });
    }

    roleButtons.forEach((button) => {
        button.addEventListener('click', () => setRole(button.dataset.role));
    });

    async function verificarEstudianteRegistrado(correo) {
        if (!client) {
            throw new Error('No se pudo conectar con la base de datos de estudiantes.');
        }

        const { data, error } = await client
            .from('estudiantes')
            .select('id')
            .ilike('correo', correo)
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

        const { error: profileError } = await client
            .from('usuarios')
            .insert({
                nombre: datos.nombre,
                correo: datos.correo,
                rol: datos.tipo
            });

        if (profileError) {
            throw profileError;
        }

        return authData;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const nombre = document.getElementById('nombreCompleto').value.trim();
        const documento = document.getElementById('documento').value.trim();
        const correo = document.getElementById('correoRegistro').value.trim();
        const telefono = document.getElementById('telefono').value.trim();
        const curso = document.getElementById('curso').value.trim();
        const clave = document.getElementById('claveRegistro').value.trim();
        const tipo = roleInput.value;

        if (!nombre || !documento || !correo || !telefono || !curso || !clave) {
            Swal.fire({
                icon: 'warning',
                title: 'Faltan datos',
                text: 'Completa todos los campos para registrar el usuario.',
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
                const estudianteExiste = await verificarEstudianteRegistrado(correo);

                if (!estudianteExiste) {
                    Swal.fire({
                        icon: 'warning',
                        title: 'Estudiante no registrado',
                        text: 'El correo debe estar registrado previamente en la base de datos de estudiantes.',
                        confirmButtonColor: '#165dff'
                    });
                    return;
                }
            } catch (error) {
                console.error('Error verificando estudiante:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'No se pudo validar el correo',
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
