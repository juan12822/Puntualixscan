/* =========================================================
   PUNTUALIXSCAN ENTERPRISE
   CONFIGURACIÓN INSTITUCIONAL
   ========================================================= */

"use strict";


const Configuracion = (() => {


    /* =====================================================
       ESTADO
    ===================================================== */

    const STORAGE_KEY =
        "puntualixscan.configuracion";


    let inicializado =
        false;

    let profesoresActualizando =
        false;

    let intervaloProfesores =
        null;


    /* =====================================================
       SELECTOR
    ===================================================== */

    const $ = (id) =>
        document.getElementById(id);


    /* =====================================================
       CONFIGURACIÓN POR DEFECTO
    ===================================================== */

    const DEFAULT_CONFIG = {

        nombreInstitucion:
            "Institución Educativa Maestro Arenas Betancur",

        anoLectivo:
            new Date().getFullYear(),

        zonaHoraria:
            "America/Bogota",

        descripcionInstitucion:
            "Sistema institucional para gestión de estudiantes y control de asistencia mediante código QR.",

        confirmaciones:
            true,

        notificaciones:
            true,

        sonido:
            true,

        autoactualizacion:
            true

    };


    /* =====================================================
       INICIO
    ===================================================== */

    async function iniciar() {


        if (
            inicializado
        ) {

            return;

        }


        inicializado =
            true;


        cargarConfiguracion();


        configurarEventos();


        await cargarUsuario();


        await comprobarSistema();


        await cargarSolicitudes();

        await iniciarGestionPorteros();

        await iniciarMonitoreoProfesores();


        actualizarInterfaz();


    }


    /* =====================================================
       DOM READY
    ===================================================== */

    document.addEventListener(
        "DOMContentLoaded",
        iniciar
    );


    /* =====================================================
       EVENTOS
    ===================================================== */

    function configurarEventos() {


        $("btnGuardarInstitucion")
            ?.addEventListener(
                "click",
                guardarInstitucion
            );


        $("btnRestaurarInstitucion")
            ?.addEventListener(
                "click",
                restaurarInstitucion
            );


        $("btnGuardarPreferencias")
            ?.addEventListener(
                "click",
                guardarPreferencias
            );


        $("listaSolicitudes")
            ?.addEventListener(
                "click",
                gestionarSolicitud
            );

        $("btnActualizarProfesoresEnLinea")
            ?.addEventListener(
                "click",
                cargarProfesoresActivos
            );

        $("formCrearPortero")
            ?.addEventListener(
                "submit",
                crearPortero
            );

        $("btnActualizarPorteros")
            ?.addEventListener(
                "click",
                cargarPorteros
            );


        $("btnCerrarSesion")
            ?.addEventListener(
                "click",
                cerrarSesion
            );


        document
            .querySelectorAll(
                ".switch input"
            )
            .forEach(
                elemento => {

                    elemento.addEventListener(
                        "change",
                        actualizarInterfaz
                    );

                }
            );

    }


    /* =====================================================
       CARGAR CONFIGURACIÓN
    ===================================================== */

    function cargarConfiguracion() {


        let configuracion =
            null;


        try {

            const guardada =
                localStorage.getItem(
                    STORAGE_KEY
                );


            if (
                guardada
            ) {

                configuracion =
                    JSON.parse(
                        guardada
                    );

            }

        } catch (error) {

            console.warn(
                "No se pudo leer la configuración:",
                error
            );

        }


        const config = {

            ...DEFAULT_CONFIG,

            ...(configuracion || {})

        };


        ponerValor(
            "nombreInstitucion",
            config.nombreInstitucion
        );


        ponerValor(
            "anoLectivoConfig",
            config.anoLectivo
        );


        ponerValor(
            "zonaHoraria",
            config.zonaHoraria
        );


        ponerValor(
            "descripcionInstitucion",
            config.descripcionInstitucion
        );


        ponerChecked(
            "preferenciaConfirmaciones",
            config.confirmaciones
        );


        ponerChecked(
            "preferenciaNotificaciones",
            config.notificaciones
        );


        ponerChecked(
            "preferenciaSonido",
            config.sonido
        );


        ponerChecked(
            "preferenciaAutoactualizacion",
            config.autoactualizacion
        );

    }


    /* =====================================================
       OBTENER CONFIGURACIÓN ACTUAL
    ===================================================== */

    function obtenerConfiguracion() {


        return {

            nombreInstitucion:
                obtenerValor(
                    "nombreInstitucion"
                ) ||
                DEFAULT_CONFIG.nombreInstitucion,


            anoLectivo:
                Number(
                    obtenerValor(
                        "anoLectivoConfig"
                    )
                ) ||
                DEFAULT_CONFIG.anoLectivo,


            zonaHoraria:
                obtenerValor(
                    "zonaHoraria"
                ) ||
                DEFAULT_CONFIG.zonaHoraria,


            descripcionInstitucion:
                obtenerValor(
                    "descripcionInstitucion"
                ) ||
                DEFAULT_CONFIG.descripcionInstitucion,


            confirmaciones:
                obtenerChecked(
                    "preferenciaConfirmaciones"
                ),


            notificaciones:
                obtenerChecked(
                    "preferenciaNotificaciones"
                ),


            sonido:
                obtenerChecked(
                    "preferenciaSonido"
                ),


            autoactualizacion:
                obtenerChecked(
                    "preferenciaAutoactualizacion"
                )

        };

    }


    /* =====================================================
       GUARDAR INSTITUCIÓN
    ===================================================== */

    async function guardarInstitucion() {


        const nombre =
            obtenerValor(
                "nombreInstitucion"
            ).trim();


        const ano =
            Number(
                obtenerValor(
                    "anoLectivoConfig"
                )
            );


        const descripcion =
            obtenerValor(
                "descripcionInstitucion"
            ).trim();


        if (
            !nombre
        ) {

            notificar(
                "Debes ingresar el nombre de la institución.",
                "warning"
            );


            return;

        }


        if (
            !ano ||
            ano < 2020 ||
            ano > 2100
        ) {

            notificar(
                "El año lectivo no es válido.",
                "warning"
            );


            return;

        }


        if (
            !descripcion
        ) {

            notificar(
                "Debes ingresar una descripción.",
                "warning"
            );


            return;

        }


        const configuracion =
            obtenerConfiguracion();


        guardarLocalmente(
            configuracion
        );


        actualizarInterfaz();


        notificar(
            "La información institucional fue guardada correctamente.",
            "success"
        );

    }


    /* =====================================================
       RESTAURAR
    ===================================================== */

    async function restaurarInstitucion() {


        const confirmado =
            await confirmar(
                "Restaurar configuración",
                "¿Deseas restaurar los datos institucionales predeterminados?"
            );


        if (
            !confirmado
        ) {

            return;

        }


        ponerValor(
            "nombreInstitucion",
            DEFAULT_CONFIG.nombreInstitucion
        );


        ponerValor(
            "anoLectivoConfig",
            DEFAULT_CONFIG.anoLectivo
        );


        ponerValor(
            "zonaHoraria",
            DEFAULT_CONFIG.zonaHoraria
        );


        ponerValor(
            "descripcionInstitucion",
            DEFAULT_CONFIG.descripcionInstitucion
        );


        const configuracion =
            obtenerConfiguracion();


        guardarLocalmente(
            configuracion
        );


        notificar(
            "La configuración institucional fue restaurada.",
            "success"
        );

    }


    /* =====================================================
       GUARDAR PREFERENCIAS
    ===================================================== */

    function guardarPreferencias() {


        const configuracion =
            obtenerConfiguracion();


        guardarLocalmente(
            configuracion
        );


        actualizarInterfaz();


        notificar(
            "Las preferencias fueron guardadas correctamente.",
            "success"
        );

    }


    /* =====================================================
       GUARDAR LOCAL
    ===================================================== */

    function guardarLocalmente(
        configuracion
    ) {


        try {


            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    configuracion
                )
            );


        } catch (error) {


            console.error(
                "No se pudo guardar la configuración:",
                error
            );


            notificar(
                "No fue posible guardar la configuración.",
                "error"
            );

        }

    }


    /* =====================================================
       CARGAR USUARIO
    ===================================================== */

    async function cargarUsuario() {


        const correo =
            $("correoAdministrador");


        if (!correo) {

            return;

        }


        try {


            let usuario =
                null;


            /* -----------------------------------------
               SESIÓN SUPABASE
            ----------------------------------------- */

            if (
                window.PUNTUALIXSCAN?.client
            ) {


                const {
                    data
                } =
                    await window.PUNTUALIXSCAN.client.auth.getUser();


                if (
                    data?.user
                ) {

                    usuario =
                        data.user;

                }

            }


            /* -----------------------------------------
               RESPALDO LOCAL
            ----------------------------------------- */

            if (
                !usuario
            ) {


                const local =
                    localStorage.getItem(
                        "usuario"
                    );


                if (
                    local
                ) {

                    try {

                        usuario =
                            JSON.parse(
                                local
                            );

                    } catch {

                        usuario =
                            null;

                    }

                }

            }


            if (
                usuario
            ) {


                correo.value =
                    usuario.email ||
                    usuario.correo ||
                    "Administrador";


                const nombre =
                    usuario.nombre ||
                    usuario.name ||
                    "Administrador";


                const rol =
                    usuario.rol ||
                    "Administrador";


                ponerTexto(
                    "usuarioNombre",
                    nombre
                );


                ponerTexto(
                    "usuarioRol",
                    rol
                );

            } else {


                correo.value =
                    "Sesión institucional";


            }


        } catch (error) {


            console.warn(
                "No se pudo obtener el usuario:",
                error
            );


            correo.value =
                "Administrador";

        }

    }


    async function iniciarMonitoreoProfesores() {

        const panel =
            $("panelProfesoresConectados");

        const client =
            window.PUNTUALIXSCAN?.client;

        if (!panel || !client) {
            return;
        }

        try {
            const resultado =
                await client.rpc("es_administrador");

            if (resultado.error) {
                throw resultado.error;
            }

            if (resultado.data !== true) {
                panel.hidden = true;
                return;
            }

            panel.hidden = false;
            await cargarProfesoresActivos();

            intervaloProfesores =
                window.setInterval(
                    cargarProfesoresActivos,
                    30000
                );

        } catch (error) {
            console.error(
                "No se pudo verificar el acceso al estado de profesores:",
                error
            );

            panel.hidden = true;
        }

    }

    async function iniciarGestionPorteros() {

        const panel =
            $("panelGestionPorteros");

        const client =
            window.PUNTUALIXSCAN?.client;

        if (!panel || !client) {
            return;
        }

        try {
            const { data, error } =
                await client.rpc("es_administrador");

            if (error) {
                throw error;
            }

            if (data !== true) {
                panel.hidden = true;
                return;
            }

            panel.hidden = false;
            await cargarPorteros();
        } catch (error) {
            console.error(
                "No se pudo verificar el acceso a la gestión de porteros:",
                error
            );
            panel.hidden = true;
        }
    }


    async function crearPortero(evento) {

        evento.preventDefault();

        const client =
            window.PUNTUALIXSCAN?.client;

        const form =
            $("formCrearPortero");

        const boton =
            $("btnCrearPortero");

        const nombre =
            String($("nombrePortero")?.value || "").trim();

        const correo =
            String($("correoPortero")?.value || "").trim().toLowerCase();

        const password =
            String($("clavePortero")?.value || "");

        if (!client || !form || !boton) {
            return;
        }

        if (nombre.length < 2 || nombre.length > 100) {
            notificar("El nombre debe tener entre 2 y 100 caracteres.", "warning");
            return;
        }

        if (
            correo.length > 254 ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)
        ) {
            notificar("Ingresa un correo de contacto válido.", "warning");
            return;
        }

        if (password.length < 8 || password.length > 72) {
            notificar("La contraseña debe tener entre 8 y 72 caracteres.", "warning");
            return;
        }

        boton.disabled = true;

        try {
            const { data, error } =
                await client.functions.invoke(
                    "crear-portero",
                    {
                        body: {
                            nombre,
                            correo,
                            password
                        }
                    }
                );

            if (error) {
                throw error;
            }

            if (!data?.codigo) {
                throw new Error("La función no devolvió el código del portero.");
            }

            const resultado =
                $("resultadoCrearPortero");

            const texto =
                resultado?.querySelector("span");

            if (resultado && texto) {
                texto.textContent =
                    `Portero creado. Código de acceso: ${data.codigo}. La contraseña inicial es la que acabas de definir.`;
                resultado.hidden = false;
            }

            form.reset();
            await cargarPorteros();
            notificar("El portero fue creado correctamente.", "success");
        } catch (error) {
            console.error("No se pudo crear el portero:", error);

            let errorMessage =
                String(error?.message || "");

            const response = error?.context;
            if (response && typeof response.clone === "function") {
                try {
                    const body = await response.clone().json();
                    const serverMessage =
                        body?.error ||
                        body?.message ||
                        body?.msg;
                    if (typeof serverMessage === "string" && serverMessage.trim()) {
                        errorMessage = `${serverMessage.trim()} (HTTP ${response.status})`;
                    }
                } catch (parseError) {
                    console.warn(
                        "No se pudo leer el detalle devuelto por crear-portero:",
                        parseError
                    );
                }
            }

            const fetchError =
                error?.name === "FunctionsFetchError" ||
                /failed to send a request|failed to fetch|networkerror/i.test(errorMessage);

            notificar(
                fetchError
                    ? "No se pudo conectar con la Edge Function crear-portero. Confirma que ejecutaste `supabase functions deploy crear-portero --project-ref dejuztyypfxtejfjfmlp`, que estás conectado a Internet y vuelve a cargar la página. Si ya la desplegaste, vuelve a desplegarla para actualizar CORS."
                    : errorMessage
                        ? `No se pudo crear el portero: ${errorMessage}`
                        : "No se pudo crear el portero. Verifica la conexión y que hayas ejecutado supabase-porteros.sql.",
                "error"
            );
        } finally {
            boton.disabled = false;
        }
    }


    async function cargarPorteros() {

        const client =
            window.PUNTUALIXSCAN?.client;

        const contenedor =
            $("listaPorteros");

        if (!client || !contenedor) {
            return;
        }

        mostrarEstadoPorteros("Cargando porteros...");

        try {
            const { data, error } = await client
                .from("usuarios")
                .select("codigo, nombre")
                .eq("rol", "portero")
                .not("codigo", "is", null)
                .order("nombre", { ascending: true });

            if (error) {
                throw error;
            }

            if (!data?.length) {
                mostrarEstadoPorteros("Todavía no hay porteros creados.");
                return;
            }

            contenedor.innerHTML = data.map(portero => `
                <div class="approval-item">
                    <div class="approval-details">
                        <strong>${escaparHTML(portero.nombre)}</strong>
                        <span>Código: ${escaparHTML(portero.codigo)}</span>
                    </div>
                </div>
            `).join("");
        } catch (error) {
            console.error("No se pudo cargar la lista de porteros:", error);
            mostrarEstadoPorteros(
                "No se pudo cargar la lista. Verifica que hayas ejecutado supabase-porteros.sql."
            );
        }
    }


    function mostrarEstadoPorteros(mensaje) {

        const contenedor =
            $("listaPorteros");

        if (!contenedor) {
            return;
        }

        const texto =
            document.createElement("p");

        texto.className =
            "approval-empty";

        texto.textContent =
            mensaje;

        contenedor.replaceChildren(texto);
    }


    async function cargarProfesoresActivos() {

        if (profesoresActualizando) {
            return;
        }

        const panel =
            $("panelProfesoresConectados");

        const client =
            window.PUNTUALIXSCAN?.client;

        const contenedor =
            $("listaProfesoresEnLinea");

        if (!panel || panel.hidden || !client || !contenedor) {
            return;
        }

        profesoresActualizando = true;

        const boton =
            $("btnActualizarProfesoresEnLinea");

        if (boton) {
            boton.disabled = true;
        }

        mostrarEstadoProfesores(
            "Actualizando estado de profesores..."
        );

        try {
            const profesores =
                await obtenerProfesoresAprobados(client);

            const { data: presencias, error } = await client
                .from("presencia_profesores")
                .select("usuario_id, ultima_actividad, pagina");

            if (error) {
                throw error;
            }

            renderizarProfesoresActivos(
                profesores,
                Array.isArray(presencias) ? presencias : []
            );

            ponerTexto(
                "actualizadoProfesoresEnLinea",
                `Actualizado ${new Intl.DateTimeFormat(
                    "es-CO",
                    {
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZone: "America/Bogota"
                    }
                ).format(new Date())}`
            );

        } catch (error) {
            console.error(
                "No se pudo cargar el estado de profesores:",
                error
            );

            mostrarEstadoProfesores(
                "No se pudo cargar el estado. Verifica que hayas ejecutado supabase-presencia-profesores.sql en Supabase y vuelve a intentar."
            );

        } finally {
            profesoresActualizando = false;

            if (boton) {
                boton.disabled = false;
            }
        }

    }


    async function obtenerProfesoresAprobados(client) {

        const profesores = [];
        const pageSize = 500;

        for (
            let inicio = 0;
            ;
            inicio += pageSize
        ) {
            const { data, error } = await client
                .from("usuarios")
                .select("id, nombre, correo")
                .eq("rol", "profesor")
                .eq("estado", "aprobado")
                .order("nombre", { ascending: true })
                .range(inicio, inicio + pageSize - 1);

            if (error) {
                throw error;
            }

            const pagina =
                Array.isArray(data)
                    ? data
                    : [];

            profesores.push(...pagina);

            if (pagina.length < pageSize) {
                return profesores;
            }
        }

    }


    function renderizarProfesoresActivos(
        profesores,
        presencias
    ) {

        const contenedor =
            $("listaProfesoresEnLinea");

        if (!contenedor) {
            return;
        }

        const presenciaPorUsuario =
            new Map(
                presencias.map(
                    presencia => [
                        String(presencia.usuario_id),
                        presencia
                    ]
                )
            );

        const ahora =
            Date.now();

        const registros =
            profesores.map(profesor => {
                const presencia =
                    presenciaPorUsuario.get(
                        String(profesor.id)
                    );

                const tiempo =
                    presencia
                        ? Date.parse(presencia.ultima_actividad)
                        : NaN;

                const diferencia =
                    ahora - tiempo;

                return {
                    profesor,
                    presencia,
                    enLinea:
                        Number.isFinite(tiempo) &&
                        diferencia >= -30000 &&
                        diferencia <= 120000
                };
            });

        ponerTexto(
            "totalProfesoresAprobados",
            profesores.length
        );

        ponerTexto(
            "totalProfesoresEnLinea",
            registros.filter(
                registro => registro.enLinea
            ).length
        );

        contenedor.replaceChildren();

        if (!registros.length) {
            mostrarEstadoProfesores(
                "No hay profesores con acceso aprobado."
            );
            return;
        }

        const fragmento =
            document.createDocumentFragment();

        registros.forEach(
            ({
                profesor,
                presencia,
                enLinea
            }) => {
                const fila =
                    document.createElement("div");

                fila.className =
                    "approval-item";

                const datos =
                    document.createElement("div");

                datos.className =
                    "approval-details";

                const nombre =
                    document.createElement("strong");

                nombre.textContent =
                    profesor.nombre ||
                    "Profesor sin nombre";

                const correo =
                    document.createElement("span");

                correo.textContent =
                    profesor.correo ||
                    "Sin correo registrado";

                const actividad =
                    document.createElement("span");

                actividad.textContent =
                    presencia
                        ? `${enLinea ? "En uso:" : "Última actividad:"} ${etiquetaPagina(presencia.pagina)} · ${formatearActividad(presencia.ultima_actividad)}`
                        : "Sin actividad registrada en la plataforma";

                datos.append(
                    nombre,
                    correo,
                    actividad
                );

                const estado =
                    document.createElement("span");

                estado.className =
                    `profesor-presencia-status ${
                        enLinea
                            ? "is-online"
                            : "is-offline"
                    }`;

                estado.textContent =
                    enLinea
                        ? "En línea"
                        : "Desconectado";

                fila.append(
                    datos,
                    estado
                );

                fragmento.appendChild(fila);
            }
        );

        contenedor.appendChild(fragmento);

    }


    function mostrarEstadoProfesores(mensaje) {

        const contenedor =
            $("listaProfesoresEnLinea");

        if (!contenedor) {
            return;
        }

        const texto =
            document.createElement("p");

        texto.className =
            "approval-empty";

        texto.textContent =
            mensaje;

        contenedor.replaceChildren(texto);

    }


    function etiquetaPagina(pagina) {

        const etiquetas = {
            "dashboard.html": "Panel principal",
            "estudiantes.html": "Estudiantes",
            "scanner.html": "Escáner QR",
            "reportes.html": "Reportes",
            "credencial.html": "Credenciales",
            "configuracion.html": "Configuración",
            aplicacion: "Plataforma"
        };

        return etiquetas[pagina] ||
            "Plataforma";

    }


    function formatearActividad(fecha) {

        const instante =
            new Date(fecha);

        if (
            Number.isNaN(
                instante.getTime()
            )
        ) {
            return "hora no disponible";
        }

        return new Intl.DateTimeFormat(
            "es-CO",
            {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Bogota"
            }
        ).format(instante);

    }


    /* =====================================================
       SOLICITUDES DE ACCESO
    ===================================================== */

    async function cargarSolicitudes() {

        const contenedor = $("listaSolicitudes");
        const client = window.PUNTUALIXSCAN?.client;

        if (!contenedor || !client) {
            return;
        }

        try {
            const { data, error } = await client
                .from("usuarios")
                .select("id, nombre, correo, documento, rol, estado, curso")
                .eq("estado", "pendiente");

            if (error) {
                throw error;
            }

            mostrarSolicitudes(data || []);
        } catch (error) {
            console.warn("No se pudieron cargar las solicitudes:", error);
            contenedor.innerHTML =
                `<p class="approval-empty">No se pudieron cargar las solicitudes: ${escaparHTML(error.message || "verifica los permisos de Supabase")}.</p>`;
        }
    }


    function mostrarSolicitudes(solicitudes) {

        const contenedor = $("listaSolicitudes");
        const pendientes = solicitudes.filter(
            solicitud =>
                solicitud.estado === "pendiente" &&
                ["estudiante", "profesor"].includes(
                    String(solicitud.rol || "").toLowerCase()
                )
        );

        if (!pendientes.length) {
                contenedor.innerHTML =
                    '<p class="approval-empty">No hay solicitudes pendientes.</p>';
                return;
        }

        contenedor.innerHTML = pendientes.map(solicitud => `
                <div class="approval-item">
                    <div class="approval-details">
                        <strong>${escaparHTML(solicitud.nombre || "Sin nombre")}</strong>
                        <span>Documento: ${escaparHTML(solicitud.documento || "Sin documento")} · ${escaparHTML(solicitud.correo || "")} · ${escaparHTML(solicitud.rol || "")} · ${escaparHTML(solicitud.curso || "Sin curso")}</span>
                    </div>
                    <div class="approval-actions">
                        <button class="approval-accept" data-estado="aprobado" data-id="${solicitud.id}">Aprobar</button>
                        <button class="approval-reject" data-estado="rechazado" data-id="${solicitud.id}">Rechazar</button>
                    </div>
                </div>
        `).join("");
    }


    async function gestionarSolicitud(evento) {

        const boton = evento.target.closest("button[data-id]");
        const client = window.PUNTUALIXSCAN?.client;

        if (!boton || !client) {
            return;
        }

        boton.disabled = true;

        try {
            const { error } = await client.rpc(
                "actualizar_estado_registro",
                {
                    usuario_id: boton.dataset.id,
                    nuevo_estado: boton.dataset.estado
                }
            );

            if (error) {
                throw error;
            }

            await cargarSolicitudes();
            notificar("La solicitud fue actualizada.", "success");
        } catch (error) {
            boton.disabled = false;
            console.error("No se pudo actualizar la solicitud:", error);
            const detalle = [
                error?.message,
                error?.details,
                error?.hint
            ].filter(Boolean).join(" ");
            notificar(
                detalle
                    ? `No se pudo actualizar la solicitud: ${detalle}`
                    : "No se pudo actualizar la solicitud.",
                "error"
            );
        }
    }


    function escaparHTML(valor) {
        return String(valor || "").replace(/[&<>'"]/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "'": "&#39;",
            "\"": "&quot;"
        }[caracter]));
    }


    /* =====================================================
       COMPROBAR SISTEMA
    ===================================================== */

    async function comprobarSistema() {


        ponerTexto(
            "estadoServidor",
            "Conectado"
        );


        ponerTexto(
            "estadoStorage",
            "Activo"
        );


        ponerTexto(
            "estadoSeguridad",
            "Protegido"
        );


        const baseDatos =
            $("estadoBaseDatos");


        if (!baseDatos) {

            return;

        }


        try {


            let client =
                null;


            if (
                window.PUNTUALIXSCAN?.client
            ) {

                client =
                    window.PUNTUALIXSCAN.client;

            } else if (
                window.supabaseClient
            ) {

                client =
                    window.supabaseClient;

            }


            if (
                !client
            ) {

                throw new Error(
                    "Cliente no disponible"
                );

            }


            const {
                error
            } =
                await client

                    .from(
                        "estudiantes"
                    )

                    .select(
                        "documento",
                        {
                            count: "exact",
                            head: true
                        }
                    );


            if (
                error
            ) {

                throw error;

            }


            baseDatos.textContent =
                "Conectada";


        } catch (error) {


            console.warn(
                "Base de datos:",
                error
            );


            baseDatos.textContent =
                "Revisar";

        }

    }


    /* =====================================================
       ACTUALIZAR INTERFAZ
    ===================================================== */

    function actualizarInterfaz() {


        const estado =
            obtenerChecked(
                "preferenciaNotificaciones"
            );


        if (
            !estado
        ) {

            console.info(
                "Notificaciones desactivadas por el administrador."
            );

        }

    }


    /* =====================================================
       CERRAR SESIÓN
    ===================================================== */

    async function cerrarSesion(
        evento
    ) {


        if (
            evento
        ) {

            evento.preventDefault();

        }


        const confirmado =
            await confirmar(
                "Cerrar sesión",
                "¿Deseas salir del sistema?"
            );


        if (
            !confirmado
        ) {

            return;

        }


        try {


            if (
                window.PUNTUALIXSCAN?.auth?.logout
            ) {

                await window.PUNTUALIXSCAN.auth.logout();

            } else if (
                window.PUNTUALIXSCAN?.client
            ) {

                await window.PUNTUALIXSCAN.client.auth.signOut();

            } else if (
                window.supabaseClient
            ) {

                await window.supabaseClient.auth.signOut();

            }


        } catch (error) {


            console.warn(
                "Error cerrando sesión:",
                error
            );

        }


        localStorage.removeItem(
            "usuario"
        );


        window.location.replace(
            "login.html"
        );

    }


    /* =====================================================
       CONFIRMAR
    ===================================================== */

    async function confirmar(
        titulo,
        texto
    ) {


        if (
            window.Swal
        ) {


            const resultado =
                await Swal.fire({

                    icon:
                        "question",

                    title:
                        titulo,

                    text:
                        texto,

                    showCancelButton:
                        true,

                    confirmButtonText:
                        "Confirmar",

                    cancelButtonText:
                        "Cancelar",

                    confirmButtonColor:
                        "#123b85",

                    cancelButtonColor:
                        "#8a96a8"

                });


            return resultado.isConfirmed;

        }


        return window.confirm(
            `${titulo}\n\n${texto}`
        );

    }


    /* =====================================================
       NOTIFICAR
    ===================================================== */

    function notificar(
        texto,
        icono
    ) {


        if (
            window.Swal
        ) {


            Swal.fire({

                icon:
                    icono,

                title:
                    "Puntualixscan",

                text:
                    texto,

                confirmButtonColor:
                    "#123b85"

            });


        } else {


            alert(
                texto
            );

        }

    }


    /* =====================================================
       HELPERS
    ===================================================== */

    function obtenerValor(
        id
    ) {


        const elemento =
            $(id);


        return elemento
            ? elemento.value
            : "";

    }


    function ponerValor(
        id,
        valor
    ) {


        const elemento =
            $(id);


        if (
            elemento
        ) {

            elemento.value =
                valor ?? "";

        }

    }


    function obtenerChecked(
        id
    ) {


        const elemento =
            $(id);


        return elemento
            ? Boolean(
                elemento.checked
            )
            : false;

    }


    function ponerChecked(
        id,
        valor
    ) {


        const elemento =
            $(id);


        if (
            elemento
        ) {

            elemento.checked =
                Boolean(
                    valor
                );

        }

    }


    function ponerTexto(
        id,
        texto
    ) {


        const elemento =
            $(id);


        if (
            elemento
        ) {

            elemento.textContent =
                texto ?? "";

        }

    }


    /* =====================================================
       API
    ===================================================== */

    return {

        iniciar,

        obtenerConfiguracion

    };

})();


/* =========================================================
   COMPATIBILIDAD
========================================================= */

window.PuntualixscanConfiguracion =
    Configuracion;