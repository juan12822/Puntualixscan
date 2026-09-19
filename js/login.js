/*
 * ============================================================
 * PUNTUALIXSCAN CONTROL
 * CONTROLADOR DE ACCESO INSTITUCIONAL
 * ============================================================
 *
 * Requiere:
 * - js/supabase.js
 * - SweetAlert2
 *
 * Compatible con:
 * - #formLogin
 * - #correo
 * - #clave
 * - #recordar
 * - .btn-login
 * - #iconoPassword
 *
 * ============================================================
 */

(function loginController(global) {

    "use strict";


    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const CONFIG = Object.freeze({

        dashboard:
            "dashboard.html",

        login:
            "login.html",

        minPasswordLength:
            1,

        rememberKey:
            "puntualixscan.remember",

        userKey:
            "usuario"
    });


    /* ========================================================
       SELECTORES
       ======================================================== */

    const SELECTORS = Object.freeze({

        form:
            "#formLogin",

        email:
            "#correo",

        password:
            "#clave",

        remember:
            "#recordar",

        submit:
            ".btn-login",

        passwordIcon:
            "#iconoPassword"
    });


    /* ========================================================
       ESTADO
       ======================================================== */

    const state = {

        initialized:
            false,

        submitting:
            false,

        redirecting:
            false
    };


    let elements =
        null;


    /* ========================================================
       OBTENER ELEMENTOS
       ======================================================== */

    function getElements() {

        const found =
            Object.fromEntries(

                Object.entries(
                    SELECTORS
                ).map(

                    (
                        [
                            key,
                            selector
                        ]
                    ) => [

                        key,

                        document.querySelector(
                            selector
                        )
                    ]
                )
            );


        if (
            !found.form
        ) {

            throw new Error(
                "No se encontró el formulario de acceso."
            );
        }


        if (
            !found.email
        ) {

            throw new Error(
                "No se encontró el campo de correo."
            );
        }


        if (
            !found.password
        ) {

            throw new Error(
                "No se encontró el campo de contraseña."
            );
        }


        if (
            !found.submit
        ) {

            throw new Error(
                "No se encontró el botón de acceso."
            );
        }


        return found;
    }


    /* ========================================================
       NOTIFICACIONES
       ======================================================== */

    async function notify(
        options
    ) {

        if (
            global.Swal &&
            typeof global.Swal.fire ===
                "function"
        ) {

            return global.Swal.fire(
                options
            );
        }


        const title =
            options?.title
                ? `${options.title}\n`
                : "";


        const text =
            options?.text ||
            "";


        global.alert(
            title +
            text
        );


        return null;
    }


    /* ========================================================
       NORMALIZAR CORREO
       ======================================================== */

    function normalizeEmail(
        value
    ) {

        return String(
            value || ""
        )
            .trim()
            .toLowerCase();
    }


    async function resolveLoginEmail(
        identifier
    ) {

        const value = String(
            identifier ||
            ""
        ).trim();

        if (
            global.PUNTUALIXSCAN?.utils?.isEmail(value)
        ) {

            return normalizeEmail(value);

        }

        const client =
            global.PUNTUALIXSCAN?.client;

        if (!client) {

            throw new Error(
                "No se pudo conectar con Supabase."
            );

        }

        const { data, error } =
            await client.rpc(
                "obtener_correo_por_documento",
                {
                    documento_buscar: value
                }
            );

        if (error) {

            throw error;

        }

        return normalizeEmail(data);
    }


    /* ========================================================
       VALIDAR CREDENCIALES
       ======================================================== */

    function validateCredentials(
        email,
        password
    ) {

        if (
            !email
        ) {

            return (
                "Ingresa tu correo institucional."
            );
        }


        if (
            !global.PUNTUALIXSCAN?.utils?.isEmail
        ) {

            return (
                "No está disponible el validador de correo."
            );
        }


        if (
            !global.PUNTUALIXSCAN.utils.isEmail(
                email
            )
        ) {

            return (
                "Verifica el formato de tu correo institucional."
            );
        }


        if (
            !password
        ) {

            return (
                "Ingresa tu contraseña."
            );
        }


        if (
            password.length <
            CONFIG.minPasswordLength
        ) {

            return (
                "La contraseña no es válida."
            );
        }


        return null;
    }


    /* ========================================================
       ESTADO DE CARGA
       ======================================================== */

    function setLoading(
        loading
    ) {

        state.submitting =
            Boolean(
                loading
            );


        if (
            !elements
        ) {

            return;
        }


        if (
            elements.submit
        ) {

            elements.submit.disabled =
                state.submitting;


            elements.submit.setAttribute(
                "aria-busy",
                String(
                    state.submitting
                )
            );


            elements.submit.innerHTML =

                state.submitting

                    ?

                    `
                        <i
                            class="fa-solid fa-spinner fa-spin"
                            aria-hidden="true"
                        ></i>

                        Verificando acceso…
                    `

                    :

                    `
                        <i
                            class="fa-solid fa-right-to-bracket"
                            aria-hidden="true"
                        ></i>

                        Ingresar al sistema
                    `;
        }


        if (
            elements.email
        ) {

            elements.email.disabled =
                state.submitting;
        }


        if (
            elements.password
        ) {

            elements.password.disabled =
                state.submitting;
        }


        if (
            elements.remember
        ) {

            elements.remember.disabled =
                state.submitting;
        }
    }


    /* ========================================================
       CREAR USUARIO COMPATIBLE
       ======================================================== */

    function createLegacyUser(
        user,
        profile
    ) {

        const metadata =
            user?.user_metadata ||
            {};


        const source =
            profile ||
            {};


        return {

            id:
                source.id ||
                user?.id ||
                null,

            correo:
                source.correo ||
                user?.email ||
                "",

            nombre:
                source.nombre ||
                metadata.nombre ||
                metadata.full_name ||
                user?.email ||
                "Usuario",

            rol:
                source.rol ||
                metadata.rol ||
                "Usuario"
        };
    }


    /* ========================================================
       CARGAR PERFIL INSTITUCIONAL
       ======================================================== */

    async function loadProfile(
        user
    ) {

        if (
            !user?.email
        ) {

            return null;
        }


        try {

            const result =
                await global.PUNTUALIXSCAN.data.select(

                    global.PUNTUALIXSCAN.TABLES.USUARIOS,

                    {

                        columns:
                            "*",

                        filters: {

                            correo:
                                user.email
                        },

                        maybeSingle:
                            true
                    }
                );


            return (
                result?.data ||
                null
            );

        } catch (
            error
        ) {

            global.PUNTUALIXSCAN.logger?.warn(

                "No se pudo cargar el perfil institucional.",

                error
            );


            /*
             * El login de Supabase sigue siendo
             * válido aunque el perfil complementario
             * no esté disponible.
             */

            return null;
        }
    }


    /* ========================================================
       GUARDAR SESIÓN COMPATIBLE
       ======================================================== */

    function persistLegacySession(
        user
    ) {

        try {

            global.localStorage.setItem(

                CONFIG.userKey,

                JSON.stringify(
                    user
                )
            );


            global.localStorage.setItem(

                CONFIG.rememberKey,

                String(
                    Boolean(
                        elements?.remember?.checked
                    )
                )
            );


        } catch (
            error
        ) {

            global.PUNTUALIXSCAN.logger?.warn(

                "No se pudo guardar la sesión local.",

                error
            );
        }
    }


    /* ========================================================
       LIMPIAR SESIÓN LOCAL
       ======================================================== */

    function clearLegacySession() {

        try {

            global.localStorage.removeItem(
                CONFIG.userKey
            );


            global.localStorage.removeItem(
                CONFIG.rememberKey
            );

        } catch (
            error
        ) {

            global.PUNTUALIXSCAN.logger?.warn(

                "No se pudo limpiar la sesión local.",

                error
            );
        }
    }


    /* ========================================================
       ERRORES AMIGABLES
       ======================================================== */

    function friendlyError(
        error
    ) {

        const code =
            String(
                error?.code ||
                ""
            ).toLowerCase();


        const message =
            String(
                error?.message ||
                ""
            ).toLowerCase();


        if (
            code ===
                "invalid_credentials" ||
            message.includes(
                "invalid login credentials"
            )
        ) {

            return (
                "El correo o la contraseña no son válidos."
            );
        }


        if (
            code ===
                "email_not_confirmed"
        ) {

            return (
                "Debes confirmar tu correo antes de ingresar."
            );
        }


        if (
            code ===
                "REQUEST_TIMEOUT"
        ) {

            return (
                "La conexión tardó demasiado. " +
                "Verifica tu conexión a Internet e inténtalo nuevamente."
            );
        }


        if (
            message.includes(
                "failed to fetch"
            )
        ) {

            return (
                "No fue posible conectar con el servidor. " +
                "Verifica tu conexión a Internet."
            );
        }


        if (
            message.includes(
                "network"
            )
        ) {

            return (
                "Se detectó un problema de conexión. " +
                "Inténtalo nuevamente."
            );
        }


        if (
            message.includes(
                "too many requests"
            )
        ) {

            return (
                "Se realizaron demasiados intentos. " +
                "Espera unos momentos antes de volver a intentarlo."
            );
        }


        if (
            message.includes(
                "rol seleccionado"
            )
        ) {

            return (
                "El correo o documento no pertenece al rol seleccionado."
            );
        }


        return (
            "No fue posible iniciar sesión. " +
            "Verifica tus credenciales e inténtalo nuevamente."
        );
    }


    /* ========================================================
       GUARDAR USUARIO AUTENTICADO
       ======================================================== */

    async function prepareAuthenticatedUser(
        user
    ) {

        if (
            !user
        ) {

            throw new Error(
                "Supabase no devolvió un usuario autenticado."
            );
        }


        const profile =
            await loadProfile(
                user
            );

        const legacyUser =
            createLegacyUser(
                user,
                profile
            );


        persistLegacySession(
            legacyUser
        );


        return {

            user,

            profile,

            legacyUser
        };
    }


    /* ========================================================
       REDIRECCIÓN CONTROLADA
       ======================================================== */

    function redirectToDashboard() {

        if (
            state.redirecting
        ) {

            return;
        }


        state.redirecting =
            true;


        global.location.replace(
            CONFIG.dashboard
        );
    }


    /* ========================================================
       RESTAURAR SESIÓN EXISTENTE
       ======================================================== */

    async function redirectAuthenticatedUser() {

        if (
            state.redirecting
        ) {

            return true;
        }


        try {

            const session =
                await global.PUNTUALIXSCAN.auth.session();


            if (
                !session?.user
            ) {

                return false;
            }


            await prepareAuthenticatedUser(
                session.user
            );


            redirectToDashboard();


            return true;

        } catch (
            error
        ) {

            clearLegacySession();


            global.PUNTUALIXSCAN.logger?.warn(

                "La sesión existente no pudo ser restaurada.",

                error
            );


            return false;
        }
    }


    /* ========================================================
       LOGIN LOCAL (USUARIOS REGISTRADOS)
       ======================================================== */

    function getRegisteredUsers() {

        try {

            return JSON.parse(
                global.localStorage.getItem(
                    "usuariosPuntualixscan"
                ) || "[]"
            );

        } catch (_) {

            return [];
        }
    }


    function getSelectedRole() {

        const value =
            document.getElementById(
                "tipoUsuario"
            )?.value || "estudiante";

        return String(value)
            .trim()
            .toLowerCase();
    }


    function tryLocalLogin(
        email,
        password
    ) {

        const usuarios =
            getRegisteredUsers();

        const usuarioLocal =
            usuarios.find(
                usuario => {

                    const correo =
                        String(
                            usuario?.correo || ""
                        )
                            .trim()
                            .toLowerCase();

                    const clave =
                        String(
                            usuario?.clave || ""
                        );

                    return (
                        correo === email &&
                        clave === password
                    );
                }
            );

        if (!usuarioLocal) {
            return null;
        }

        const sessionUser = {
            id: usuarioLocal.id || email,
            nombre: usuarioLocal.nombre || usuarioLocal.correo || "Usuario",
            correo: usuarioLocal.correo || email,
            email: usuarioLocal.correo || email,
            rol: usuarioLocal.tipo || usuarioLocal.rol || selectedRole,
            tipo: usuarioLocal.tipo || usuarioLocal.rol || selectedRole
        };

        global.localStorage.setItem(
            CONFIG.userKey,
            JSON.stringify(sessionUser)
        );

        global.localStorage.setItem(
            CONFIG.rememberKey,
            String(Boolean(elements?.remember?.checked))
        );

        return sessionUser;
    }


    /* ========================================================
       INICIAR SESIÓN
       ======================================================== */

    async function submitLogin(
        event
    ) {

        event.preventDefault();


        if (
            state.submitting ||
            state.redirecting
        ) {

            return;
        }


        const identifier =
            String(
                elements.email.value ||
                ""
            ).trim();


        const password =
            String(
                elements.password.value ||
                ""
            );


        let email = "";
        let validationMessage = "";

        try {

            email = await resolveLoginEmail(identifier);

            validationMessage =
                validateCredentials(
                    email,
                    password
                );

        } catch (error) {

            validationMessage =
                "No encontramos un usuario con ese correo o documento.";

        }


        if (
            validationMessage
        ) {

            await notify({

                icon:
                    "warning",

                title:
                    "Revisa tus datos",

                text:
                    validationMessage,

                confirmButtonText:
                    "Entendido",

                confirmButtonColor:
                    "#165dff"
            });


            if (
                email
            ) {

                elements.password.focus();

            } else {

                elements.email.focus();
            }


            return;
        }


        const localUser =
            tryLocalLogin(
                email,
                password
            );

        if (
            localUser
        ) {

            await notify({

                icon:
                    "success",

                title:
                    "Acceso concedido",

                text:
                    `Bienvenido ${localUser.nombre}.`,

                timer:
                    900,

                showConfirmButton:
                    false
            });

            redirectToDashboard();
            return;
        }


        setLoading(
            true
        );


        try {

            const result =
                await global.PUNTUALIXSCAN.auth.signIn({

                    email,

                    password
                });


            const user =
                result?.data?.user;


            if (
                !user
            ) {

                throw new Error(
                    "Supabase no devolvió un usuario autenticado."
                );
            }


            await prepareAuthenticatedUser(
                user
            );


            await notify({

                icon:
                    "success",

                title:
                    "Acceso concedido",

                text:
                    "Bienvenido a PUNTUALIXSCAN CONTROL.",

                timer:
                    900,

                showConfirmButton:
                    false
            });


            redirectToDashboard();


        } catch (
            error
        ) {

            clearLegacySession();


            await notify({

                icon:
                    "error",

                title:
                    "Acceso denegado",

                text:
                    friendlyError(
                        error
                    ),

                confirmButtonText:
                    "Intentar nuevamente",

                confirmButtonColor:
                    "#165dff"
            });


        } finally {

            /*
             * Si estamos redirigiendo,
             * no es necesario reactivar
             * los controles.
             */

            if (
                !state.redirecting
            ) {

                setLoading(
                    false
                );
            }
        }
    }


    /* ========================================================
       MOSTRAR / OCULTAR CONTRASEÑA
       ======================================================== */

    function togglePassword() {

        if (
            !elements?.password
        ) {

            return;
        }


        const isHidden =
            elements.password.type ===
            "password";


        elements.password.type =
            isHidden
                ? "text"
                : "password";


        if (
            elements.passwordIcon
        ) {

            elements.passwordIcon.className =

                isHidden

                    ? "fa-solid fa-eye-slash"

                    : "fa-solid fa-eye";
        }


        const button =
            elements.passwordIcon
                ?.closest(
                    "button"
                );


        if (
            button
        ) {

            const label =
                isHidden

                    ? "Ocultar contraseña"

                    : "Mostrar contraseña";


            button.setAttribute(
                "aria-label",
                label
            );


            button.setAttribute(
                "title",
                label
            );
        }
    }


    /* ========================================================
       RECUPERACIÓN DE CONTRASEÑA
       ======================================================== */

    async function recoverPassword() {

        const email =
            normalizeEmail(
                elements.email.value
            );


        if (
            !email
        ) {

            await notify({

                icon:
                    "info",

                title:
                    "Ingresa tu correo",

                text:
                    "Escribe tu correo institucional para continuar.",

                confirmButtonColor:
                    "#165dff"
            });


            elements.email.focus();


            return;
        }


        if (
            !global.PUNTUALIXSCAN.utils.isEmail(
                email
            )
        ) {

            await notify({

                icon:
                    "warning",

                title:
                    "Correo inválido",

                text:
                    "Verifica el formato de tu correo institucional.",

                confirmButtonColor:
                    "#165dff"
            });


            elements.email.focus();


            return;
        }


        const confirmation =
            await notify({

                icon:
                    "question",

                title:
                    "¿Restablecer contraseña?",

                text:
                    "Enviaremos un enlace seguro al correo indicado.",

                showCancelButton:
                    true,

                confirmButtonText:
                    "Enviar enlace",

                cancelButtonText:
                    "Cancelar",

                confirmButtonColor:
                    "#165dff"
            });


        if (
            !confirmation?.isConfirmed
        ) {

            return;
        }


        try {

            const redirectUrl =
                new URL(

                    CONFIG.login,

                    global.location.href

                ).href;


            const result =
                await global.PUNTUALIXSCAN.client.auth
                    .resetPasswordForEmail(

                        email,

                        {

                            redirectTo:
                                redirectUrl
                        }
                    );


            if (
                result?.error
            ) {

                throw result.error;
            }


            await notify({

                icon:
                    "success",

                title:
                    "Enlace enviado",

                text:
                    "Revisa tu correo institucional para continuar.",

                confirmButtonColor:
                    "#165dff"
            });


        } catch (
            error
        ) {

            global.PUNTUALIXSCAN.logger?.error(

                "Error enviando recuperación de contraseña.",

                error
            );


            await notify({

                icon:
                    "error",

                title:
                    "No fue posible enviar el enlace",

                text:
                    "Inténtalo nuevamente en unos minutos.",

                confirmButtonColor:
                    "#165dff"
            });
        }
    }


    /* ========================================================
       EVENTOS
       ======================================================== */

    function bindEvents() {

        elements.form.addEventListener(

            "submit",

            submitLogin
        );


        /*
         * Compatibilidad con el onclick existente
         * de mostrarPassword().
         */

        global.mostrarPassword =
            togglePassword;


        const recoverButton =
            document.getElementById(
                "recuperarClave"
            );


        if (
            recoverButton
        ) {

            recoverButton.addEventListener(

                "click",

                recoverPassword
            );
        }


        /*
         * Permite enviar con Enter.
         * El submit del formulario ya lo maneja.
         */


        elements.email.addEventListener(

            "input",

            () => {

                elements.email.value =
                    elements.email.value
                        .replace(
                            /\s/g,
                            ""
                        )
                        .toLowerCase();
            }
        );


        elements.password.addEventListener(

            "keydown",

            event => {

                if (
                    event.key ===
                    "Enter" &&
                    !state.submitting
                ) {

                    /*
                     * El formulario se encargará
                     * del envío.
                     */
                }
            }
        );
    }


    /* ========================================================
       INICIALIZACIÓN
       ======================================================== */

    async function initialize() {

        if (
            state.initialized
        ) {

            return;
        }


        state.initialized =
            true;


        try {

            if (
                !global.PUNTUALIXSCAN ||
                !global.PUNTUALIXSCAN.auth ||
                !global.PUNTUALIXSCAN.utils
            ) {

                throw new Error(

                    "La conexión segura no está disponible."
                );
            }


            elements =
                getElements();


            bindEvents();


            /*
             * Si ya hay una sesión válida,
             * entra directamente al dashboard.
             */

            await redirectAuthenticatedUser();


        } catch (
            error
        ) {

            state.initialized =
                false;


            global.PUNTUALIXSCAN?.logger?.error(

                "No fue posible inicializar el acceso.",

                error
            );


            await notify({

                icon:
                    "error",

                title:
                    "Error de inicio",

                text:
                    "No fue posible preparar el acceso seguro. " +
                    "Verifica la configuración del sistema.",

                confirmButtonColor:
                    "#165dff"
            });
        }
    }


    /* ========================================================
       API GLOBAL
       ======================================================== */

    global.PUNTUALIXSCAN =
        global.PUNTUALIXSCAN ||
        {};


    global.PUNTUALIXSCAN.login =
        Object.freeze({

            initialize,

            togglePassword,

            recoverPassword,

            getState:
                () => ({
                    initialized:
                        state.initialized,

                    submitting:
                        state.submitting,

                    redirecting:
                        state.redirecting
                })
        });


    /*
     * Mantener compatibilidad con:
     *
     * onclick="mostrarPassword()"
     */

    global.mostrarPassword =
        togglePassword;


    /* ========================================================
       ARRANQUE
       ======================================================== */

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(

            "DOMContentLoaded",

            initialize,

            {
                once:
                    true
            }
        );

    } else {

        initialize();
    }


})(window);