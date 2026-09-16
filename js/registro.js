document.addEventListener('DOMContentLoaded', () => {
    const roleButtons = document.querySelectorAll('.role-option');
    const roleInput = document.getElementById('tipoUsuario');
    const roleLabel = document.getElementById('roleLabel');
    const form = document.getElementById('formRegistro');

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

    form.addEventListener('submit', (event) => {
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

        const usuarios = JSON.parse(localStorage.getItem('usuariosPuntualixscan') || '[]');

        const existe = usuarios.some((usuario) => usuario.correo.toLowerCase() === correo.toLowerCase());
        if (existe) {
            Swal.fire({
                icon: 'error',
                title: 'Usuario ya existe',
                text: 'Este correo ya está registrado en el sistema.',
                confirmButtonColor: '#165dff'
            });
            return;
        }

        const nuevoUsuario = {
            id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
            nombre,
            documento,
            correo,
            telefono,
            curso,
            clave,
            tipo,
            fechaRegistro: new Date().toISOString()
        };

        usuarios.push(nuevoUsuario);
        localStorage.setItem('usuariosPuntualixscan', JSON.stringify(usuarios));

        Swal.fire({
            icon: 'success',
            title: 'Usuario registrado',
            text: `Se creó correctamente la cuenta de ${roleNames[tipo]}.`,
            confirmButtonColor: '#165dff'
        }).then(() => {
            window.location.href = 'login.html';
        });
    });
});
