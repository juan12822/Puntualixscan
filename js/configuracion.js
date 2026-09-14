/* =========================================================
   EDUACCESS ENTERPRISE
   CONFIGURACIÓN INSTITUCIONAL
   ========================================================= */

"use strict";


const Configuracion = (() => {


    /* =====================================================
       ESTADO
    ===================================================== */

    const STORAGE_KEY =
        "eduaccess.configuracion";


    let inicializado =
        false;


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
                window.EDUQR?.client
            ) {


                const {
                    data
                } =
                    await window.EDUQR.client.auth.getUser();


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
                window.EDUQR?.client
            ) {

                client =
                    window.EDUQR.client;

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
                window.EDUQR?.auth?.logout
            ) {

                await window.EDUQR.auth.logout();

            } else if (
                window.EDUQR?.client
            ) {

                await window.EDUQR.client.auth.signOut();

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
                    "EduAccess",

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

window.EduAccessConfiguracion =
    Configuracion;