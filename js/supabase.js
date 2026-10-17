/*
 * ============================================================
 * PUNTUALIXSCAN CONTROL
 * Núcleo de Supabase y seguridad de la aplicación
 * ============================================================
 *
 * Compatible con:
 * - Supabase JS v2
 * - Login
 * - Dashboard
 * - Estudiantes
 * - Scanner
 * - Reportes
 * - Credenciales
 *
 * Tablas actuales:
 * - usuarios
 * - estudiantes
 * - asistencia
 *
 * IMPORTANTE:
 * Este archivo NO realiza recargas automáticas.
 * Este archivo NO cambia de página por eventos de sesión.
 * Los módulos deciden cuándo redirigir.
 * ============================================================
 */

(function bootstrapPuntualixscan(global) {

    "use strict";


    /* ========================================================
       CONFIGURACIÓN
       ======================================================== */

    const CONFIG = Object.freeze({

        /*
         * CONSERVA AQUÍ EXACTAMENTE
         * la URL que ya tienes actualmente.
         */
        url: "https://dejuztyypfxtejfjfmlp.supabase.co",

        /*
         * CONSERVA AQUÍ EXACTAMENTE
         * tu anonKey actual.
         *
         * NO la reemplaces por una service_role key.
         */
        anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlanV6dHl5cGZ4dGVqZmpmbWxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NTU2MTksImV4cCI6MjEwMTUzMTYxOX0.l_dcWMPBWj1OfZK5_SefNX5MUztewJRYUZjPuKhFQn4",

        schema: "public",

        storageKey:
            "puntualixscan.enterprise.auth",

        locale:
            "es-CO",

        timezone:
            "America/Bogota",

        loginUrl:
            "login.html",

        requestTimeoutMs:
            30000,

        cacheTtlMs:
            60000,

        appName:
            "PUNTUALIXSCAN CONTROL",

        appVersion:
            "2.0.0"
    });


    /* ========================================================
       TABLAS
       ======================================================== */

    const TABLES = Object.freeze({

        USUARIOS:
            "usuarios",

        ESTUDIANTES:
            "estudiantes",

        ASISTENCIA:
            "asistencia"
    });


    /* ========================================================
       VALORES DEL SISTEMA
       ======================================================== */

    const ESTADOS = Object.freeze({

        ATIEMPO:
            "A Tiempo",

        TARDE:
            "Tarde"
    });


    const INGRESOS = Object.freeze({

        COLEGIO:
            "Colegio",

        MEDIA:
            "Media Técnica"
    });


    /* ========================================================
       NAMESPACE EXISTENTE
       ======================================================== */

    const existing =
        global.PUNTUALIXSCAN &&
        typeof global.PUNTUALIXSCAN === "object"

            ? global.PUNTUALIXSCAN

            : {};


    /* ========================================================
       ERROR PERSONALIZADO
       ======================================================== */

    class PuntualixscanError extends Error {

        constructor(
            message,
            options = {}
        ) {

            super(
                message ||
                "Ha ocurrido un error."
            );


            this.name =
                "PuntualixscanError";


            this.code =
                options.code ||
                "PUNTUALIXSCAN_ERROR";


            this.cause =
                options.cause ||
                null;


            this.details =
                options.details ||
                null;


            this.status =
                options.status ||
                null;
        }
    }


    /* ========================================================
       LOGGER
       ======================================================== */

    const logger = Object.freeze({

        debug(
            message,
            context
        ) {

            if (
                global.location &&
                (
                    global.location.hostname ===
                        "localhost" ||

                    global.location.hostname ===
                        "127.0.0.1"
                )
            ) {

                console.debug(
                    "[PUNTUALIXSCAN]",
                    message,
                    context || ""
                );
            }
        },


        info(
            message,
            context
        ) {

            console.info(
                "[PUNTUALIXSCAN]",
                message,
                context || ""
            );
        },


        warn(
            message,
            context
        ) {

            console.warn(
                "[PUNTUALIXSCAN]",
                message,
                context || ""
            );
        },


        error(
            message,
            error
        ) {

            console.error(
                "[PUNTUALIXSCAN]",
                message,
                error instanceof Error
                    ? error.message
                    : error || ""
            );
        }
    });


    /* ========================================================
       ASSERT
       ======================================================== */

    function assert(
        condition,
        message,
        options = {}
    ) {

        if (!condition) {

            throw new PuntualixscanError(
                message,
                options
            );
        }
    }


    /* ========================================================
       OBJETO PLANO
       ======================================================== */

    function isPlainObject(
        value
    ) {

        return (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
        );
    }


    /* ========================================================
       JSON SEGURO
       ======================================================== */

    function safeJsonParse(
        value,
        fallback = null
    ) {

        if (
            typeof value !== "string" ||
            !value.trim()
        ) {

            return fallback;
        }


        try {

            return JSON.parse(
                value
            );

        } catch (_) {

            return fallback;
        }
    }


    /* ========================================================
       LOCAL STORAGE SEGURO
       ======================================================== */

    const storage = Object.freeze({

        get(
            key
        ) {

            try {

                return global.localStorage
                    ? global.localStorage.getItem(
                        key
                    )
                    : null;

            } catch (_) {

                return null;
            }
        },


        set(
            key,
            value
        ) {

            try {

                if (
                    global.localStorage
                ) {

                    global.localStorage.setItem(
                        key,
                        value
                    );
                }

                return true;

            } catch (_) {

                return false;
            }
        },


        remove(
            key
        ) {

            try {

                if (
                    global.localStorage
                ) {

                    global.localStorage.removeItem(
                        key
                    );
                }

                return true;

            } catch (_) {

                return false;
            }
        }
    });


    /* ========================================================
       CACHE EN MEMORIA
       ======================================================== */

    function createCache() {

        const entries =
            new Map();


        return {

            get(
                key
            ) {

                const entry =
                    entries.get(
                        key
                    );


                if (
                    !entry
                ) {

                    return null;
                }


                if (
                    entry.expiresAt <=
                    Date.now()
                ) {

                    entries.delete(
                        key
                    );

                    return null;
                }


                return entry.value;
            },


            set(
                key,
                value,
                ttl
            ) {

                entries.set(
                    key,
                    {

                        value,

                        expiresAt:
                            Date.now() +
                            (
                                Number.isFinite(
                                    ttl
                                )
                                    ? ttl
                                    : CONFIG.cacheTtlMs
                            )
                    }
                );


                return value;
            },


            delete(
                key
            ) {

                entries.delete(
                    key
                );
            },


            clear() {

                entries.clear();
            }
        };
    }


    const cache =
        createCache();


    /* ========================================================
       VALIDAR LIBRERÍA SUPABASE
       ======================================================== */

    assert(

        global.supabase &&
        typeof global.supabase.createClient ===
            "function",

        "No se encontró Supabase JS v2. " +
        "Carga la librería antes de supabase.js.",

        {
            code:
                "SUPABASE_LIBRARY_MISSING"
        }
    );


    /* ========================================================
       CREAR CLIENTE
       ======================================================== */

    function createClient() {

        if (
            existing.client &&
            typeof existing.client.from ===
                "function"
        ) {

            return existing.client;
        }


        return global.supabase.createClient(

            CONFIG.url,

            CONFIG.anonKey,

            {

                db: {

                    schema:
                        CONFIG.schema
                },


                auth: {

                    autoRefreshToken:
                        true,

                    persistSession:
                        true,

                    detectSessionInUrl:
                        true,

                    storageKey:
                        CONFIG.storageKey,

                    flowType:
                        "pkce"
                },


                global: {

                    headers: {

                        "X-Client-Info":
                            "puntualixscan-control"
                    }
                }
            }
        );
    }


    const client =
        createClient();


    /* ========================================================
       LIMPIAR SESIÓN LOCAL
       ======================================================== */

    function clearApplicationSession() {

        try {
            storage.remove(
                "usuario"
            );
        } catch (_) {
            localStorage.removeItem(
                "usuario"
            );
        }


        try {
            localStorage.removeItem(
                "usuariosPuntualixscan"
            );
        } catch (_) {
            // Nada que limpiar.
        }


        cache.clear();
    }


    /* ========================================================
       TIMEOUT
       ======================================================== */

    async function withTimeout(
        operation,
        timeoutMs
    ) {

        const timeout =
            Number.isFinite(
                timeoutMs
            )
                ? timeoutMs
                : CONFIG.requestTimeoutMs;


        let timer = null;


        try {

            return await Promise.race([

                Promise.resolve()
                    .then(
                        operation
                    ),


                new Promise(
                    (_, reject) => {

                        timer =
                            global.setTimeout(
                                () => {

                                    reject(

                                        new PuntualixscanError(

                                            "La operación tardó " +
                                            "demasiado tiempo.",

                                            {
                                                code:
                                                    "REQUEST_TIMEOUT"
                                            }
                                        )
                                    );

                                },

                                timeout
                            );
                    }
                )
            ]);

        } finally {

            if (
                timer !== null
            ) {

                global.clearTimeout(
                    timer
                );
            }
        }
    }


    /* ========================================================
       NORMALIZAR ERRORES
       ======================================================== */

    function normalizeError(
        error,
        fallbackMessage
    ) {

        if (
            error instanceof PuntualixscanError
        ) {

            return error;
        }


        const message =
            error?.message ||
            fallbackMessage ||
            "No se pudo completar la operación.";


        return new PuntualixscanError(

            message,

            {

                code:
                    error?.code ||
                    "SUPABASE_ERROR",

                cause:
                    error ||
                    null,

                details:
                    error?.details ||
                    error?.hint ||
                    null,

                status:
                    error?.status ||
                    null
            }
        );
    }


    /* ========================================================
       EJECUTAR OPERACIÓN
       ======================================================== */

    async function request(
        operation,
        fallbackMessage
    ) {

        try {

            const result =
                await withTimeout(
                    operation
                );


            if (
                result &&
                result.error
            ) {

                throw normalizeError(

                    result.error,

                    fallbackMessage
                );
            }


            return result;

        } catch (error) {

            const normalized =
                normalizeError(
                    error,
                    fallbackMessage
                );


            logger.error(
                normalized.message,
                normalized.cause ||
                    normalized
            );


            throw normalized;
        }
    }


    /* ========================================================
       AUTENTICACIÓN
       ======================================================== */

    const auth = Object.freeze({

        async session() {

            const result =
                await request(

                    () =>
                        client.auth.getSession(),

                    "No fue posible recuperar la sesión."
                );


            return (
                result?.data?.session ||
                null
            );
        },


        async user() {

            const result =
                await request(

                    () =>
                        client.auth.getUser(),

                    "No fue posible recuperar el usuario."
                );


            return (
                result?.data?.user ||
                null
            );
        },


        async signIn(
            credentials
        ) {

            assert(

                isPlainObject(
                    credentials
                ),

                "Las credenciales son obligatorias.",

                {
                    code:
                        "INVALID_CREDENTIALS"
                }
            );


            const email =
                String(
                    credentials.email ||
                    ""
                ).trim();


            const password =
                String(
                    credentials.password ||
                    ""
                );


            assert(

                email,

                "El correo electrónico es obligatorio.",

                {
                    code:
                        "INVALID_EMAIL"
                }
            );


            assert(

                isEmail(
                    email
                ),

                "El correo electrónico no es válido.",

                {
                    code:
                        "INVALID_EMAIL"
                }
            );


            assert(

                password,

                "La contraseña es obligatoria.",

                {
                    code:
                        "INVALID_PASSWORD"
                }
            );


            return request(

                () =>
                    client.auth.signInWithPassword({

                        email,

                        password
                    }),

                "No fue posible iniciar sesión."
            );
        },


        async signOut(
            options = {}
        ) {

            const scope =
                options.scope ||
                "local";


            const result =
                await request(

                    () =>
                        client.auth.signOut({
                            scope
                        }),

                    "No fue posible cerrar sesión."
                );


            clearApplicationSession();


            return result;
        },


        async logout(
            options = {}
        ) {

            await this.signOut(
                options
            );


            if (
                options.redirect !==
                false
            ) {

                global.location.replace(

                    options.redirectTo ||
                    CONFIG.loginUrl
                );
            }
        },


        onAuthStateChange(
            callback
        ) {

            assert(

                typeof callback ===
                    "function",

                "El callback de autenticación debe ser una función.",

                {
                    code:
                        "INVALID_CALLBACK"
                }
            );


            return client.auth.onAuthStateChange(

                (
                    event,
                    session
                ) => {

                    if (
                        event ===
                        "SIGNED_OUT"
                    ) {

                        clearApplicationSession();
                    }


                    callback(
                        event,
                        session
                    );
                }
            );
        }
    });


    /* ========================================================
       CONSTRUIR CONSULTA
       ======================================================== */

    function buildQuery(
        table,
        filters,
        columns = "*",
        selectOptions = {},
        shouldSelect = false
    ) {

        assert(

            typeof table ===
                "string" &&
            table.trim(),

            "La tabla es obligatoria.",

            {
                code:
                    "INVALID_TABLE"
            }
        );


        let query = client.from(table.trim());

        if (shouldSelect) {
            query = query.select(columns, selectOptions);
        }


        if (
            !filters ||
            !isPlainObject(
                filters
            )
        ) {

            return query;
        }


        Object.entries(
            filters
        ).forEach(
            (
                [
                    column,
                    value
                ]
            ) => {

                if (
                    value ===
                    undefined
                ) {

                    return;
                }


                if (
                    value ===
                    null
                ) {

                    query =
                        query.is(
                            column,
                            null
                        );

                } else {

                    query =
                        query.eq(
                            column,
                            value
                        );
                }
            }
        );


        return query;
    }


    /* ========================================================
       DATOS
       ======================================================== */

    const data = Object.freeze({

        async select(
            table,
            options = {}
        ) {

            let query =
                buildQuery(
                    table,
                    options.filters,
                    options.columns || "*",
                    {
                        count:
                            options.count ||
                            undefined,

                        head:
                            Boolean(
                                options.head
                            )
                    },
                    true
                );


            if (
                options.order
            ) {

                query =
                    query.order(

                        options.order.column,

                        {

                            ascending:
                                options.order
                                    .ascending !==
                                false,

                            nullsFirst:
                                Boolean(
                                    options.order
                                        .nullsFirst
                                )
                        }
                    );
            }


            if (
                Number.isInteger(
                    options.limit
                ) &&
                options.limit > 0
            ) {

                query =
                    query.limit(
                        options.limit
                    );
            }


            if (
                Number.isInteger(
                    options.offset
                ) &&
                options.offset >= 0
            ) {

                const limit =
                    Number.isInteger(
                        options.limit
                    ) &&
                    options.limit > 0

                        ? options.limit

                        : 100;


                query =
                    query.range(

                        options.offset,

                        options.offset +
                        limit -
                        1
                    );
            }


            if (
                options.single
            ) {

                query =
                    query.single();

            } else if (
                options.maybeSingle
            ) {

                query =
                    query.maybeSingle();
            }


            return request(

                () =>
                    query,

                "No fue posible consultar los datos."
            );
        },


        async insert(
            table,
            values,
            options = {}
        ) {

            assert(

                isPlainObject(
                    values
                ) ||
                Array.isArray(
                    values
                ),

                "Los datos a guardar son obligatorios.",

                {
                    code:
                        "INVALID_PAYLOAD"
                }
            );


            let query =
                client
                    .from(
                        table
                    )
                    .insert(
                        values,
                        {
                            defaultToNull:
                                options.defaultToNull !==
                                false
                        }
                    );


            if (
                options.returning !==
                false
            ) {

                query =
                    query.select(
                        options.columns ||
                        "*"
                    );
            }


            if (
                options.single
            ) {

                query =
                    query.single();
            }


            return request(

                () =>
                    query,

                "No fue posible guardar los datos."
            );
        },


        async update(
            table,
            values,
            filters,
            options = {}
        ) {

            assert(

                isPlainObject(
                    values
                ) &&
                Object.keys(
                    values
                ).length > 0,

                "Los datos a actualizar son obligatorios.",

                {
                    code:
                        "INVALID_PAYLOAD"
                }
            );


            assert(

                isPlainObject(
                    filters
                ) &&
                Object.keys(
                    filters
                ).length > 0,

                "La actualización requiere al menos un filtro.",

                {
                    code:
                        "UNSAFE_UPDATE"
                }
            );


            let query =
                buildQuery(
                    table,
                    filters
                )
                    .update(
                        values
                    );


            if (
                options.returning !==
                false
            ) {

                query =
                    query.select(
                        options.columns ||
                        "*"
                    );
            }


            if (
                options.single
            ) {

                query =
                    query.single();
            }


            return request(

                () =>
                    query,

                "No fue posible actualizar los datos."
            );
        },


        async remove(
            table,
            filters,
            options = {}
        ) {

            assert(

                isPlainObject(
                    filters
                ) &&
                Object.keys(
                    filters
                ).length > 0,

                "La eliminación requiere al menos un filtro.",

                {
                    code:
                        "UNSAFE_DELETE"
                }
            );


            let query =
                buildQuery(
                    table,
                    filters
                )
                    .delete();


            if (
                options.returning !==
                false
            ) {

                query =
                    query.select(
                        options.columns ||
                        "*"
                    );
            }


            return request(

                () =>
                    query,

                "No fue posible eliminar los datos."
            );
        },


        async page(
            table,
            options = {}
        ) {

            const page =
                Math.max(

                    1,

                    Number.parseInt(
                        options.page,
                        10
                    ) || 1
                );


            const pageSize =
                Math.min(

                    500,

                    Math.max(

                        1,

                        Number.parseInt(
                            options.pageSize,
                            10
                        ) || 50
                    )
                );


            const result =
                await this.select(

                    table,

                    {

                        columns:
                            options.columns ||
                            "*",

                        filters:
                            options.filters,

                        order:
                            options.order,

                        limit:
                            pageSize,

                        offset:
                            (
                                page -
                                1
                            ) *
                            pageSize,

                        count:
                            "exact"
                    }
                );


            const total =
                result.count ||
                0;


            return {

                data:
                    result.data ||
                    [],

                count:
                    total,

                page,

                pageSize,

                totalPages:
                    Math.ceil(
                        total /
                        pageSize
                    )
            };
        },


        invalidateCache(
            key
        ) {

            if (
                key
            ) {

                cache.delete(
                    key
                );

            } else {

                cache.clear();
            }
        }
    });


    /* ========================================================
       UTILIDADES
       ======================================================== */

    function getDate(
        value
    ) {

        const date =
            value
                ? new Date(
                    value
                )
                : new Date();


        assert(

            !Number.isNaN(
                date.getTime()
            ),

            "La fecha no es válida.",

            {
                code:
                    "INVALID_DATE"
            }
        );


        return date;
    }


    function isEmail(
        value
    ) {

        return (

            typeof value ===
                "string" &&

            /^[^\s@]+@[^\s@]+\.[^\s@]+$/
                .test(
                    value.trim()
                )
        );
    }

    function compararCursos(
        primerCurso,
        segundoCurso
    ) {

        const analizarCurso = valor => {
            const texto = String(valor || "").trim();
            const coincidencia = texto.match(/^(preescolar|\d{1,2})(?:-(\d+))?$/i);

            if (!coincidencia) {
                return null;
            }

            return {
                grado: coincidencia[1].toLowerCase() === "preescolar"
                    ? 0
                    : Number(coincidencia[1]),
                grupo: Number(coincidencia[2] || 0)
            };
        };

        const primero = analizarCurso(primerCurso);
        const segundo = analizarCurso(segundoCurso);

        if (primero && segundo) {
            return primero.grado - segundo.grado ||
                primero.grupo - segundo.grupo;
        }

        return String(primerCurso || "").localeCompare(
            String(segundoCurso || ""),
            CONFIG.locale,
            { numeric: true, sensitivity: "base" }
        );
    }


    const utils = Object.freeze({

        fechaHoy(
            date
        ) {

            return new Intl.DateTimeFormat(

                "en-CA",

                {

                    timeZone:
                        CONFIG.timezone,

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit"
                }

            ).format(
                getDate(
                    date
                )
            );
        },


        horaActual(
            date
        ) {

            return new Intl.DateTimeFormat(

                CONFIG.locale,

                {

                    timeZone:
                        CONFIG.timezone,

                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit",

                    hour12:
                        false
                }

            ).format(
                getDate(
                    date
                )
            );
        },


        fechaCompleta(
            date
        ) {

            return new Intl.DateTimeFormat(

                CONFIG.locale,

                {

                    timeZone:
                        CONFIG.timezone,

                    weekday:
                        "long",

                    year:
                        "numeric",

                    month:
                        "long",

                    day:
                        "numeric"
                }

            ).format(
                getDate(
                    date
                )
            );
        },


        uuid() {

            if (
                global.crypto &&
                typeof global.crypto.randomUUID ===
                    "function"
            ) {

                return global.crypto.randomUUID();
            }


            return (

                "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"

            ).replace(

                /[xy]/g,

                character => {

                    const random =
                        Math.floor(
                            Math.random() *
                            16
                        );


                    const value =
                        character === "x"

                            ? random

                            : (
                                random &
                                0x3
                            ) |
                            0x8;


                    return value.toString(
                        16
                    );
                }
            );
        },


        escape(
            value
        ) {

            if (
                value ===
                    null ||
                value ===
                    undefined
            ) {

                return "";
            }


            return String(
                value
            ).replace(

                /[&<>"']/g,

                character => (

                    {

                        "&":
                            "&amp;",

                        "<":
                            "&lt;",

                        ">":
                            "&gt;",

                        '"':
                            "&quot;",

                        "'":
                            "&#039;"
                    }[
                        character
                    ]
                )
            );
        },


        parseJson:
            safeJsonParse,


        isEmail,

        compararCursos
    });


    /* ========================================================
       PERMISOS POR ROL
       ======================================================== */

    let usuarioVerificado = null;
    let verificacionUsuario = null;


    function normalizarRol(
        value
    ) {

        const rol = String(
            value || ""
        )
            .trim()
            .toLowerCase();

        return rol === "admin"
            ? "administrador"
            : rol;
    }


    function paginaActual() {

        const href =
            global.location?.href || "";

        return String(
            href
                .split("?")[0]
                .split("#")[0]
                .split("/").pop() || ""
        ).toLowerCase();
    }


    function obtenerUsuarioActual() {
        return usuarioVerificado?.usuario || null;
    }


    function rolUsuarioActual() {
        return usuarioVerificado?.rol || "";
    }


    function paginasPermitidasPorRol(
        rol
    ) {

        const paginasAdministrativas = [
            "dashboard.html",
            "estudiantes.html",
            "scanner.html",
            "reportes.html",
            "credencial.html",
            "configuracion.html"
        ];

        if (rol === "estudiante") {
            return [
                "reportes.html"
            ];
        }

        if (rol === "profesor") {
            return paginasAdministrativas;
        }

        if (rol === "administrador") {
            return paginasAdministrativas;
        }

        if (rol === "portero") {
            return [
                "scanner.html",
                "configuracion.html"
            ];
        }

        return [];
    }


    function tienePermisoParaPagina(
        pagina,
        rol
    ) {

        const nombrePagina =
            String(
                pagina || ""
            )
                .toLowerCase();

        if (!nombrePagina) {
            return true;
        }

        return paginasPermitidasPorRol(
            rol
        ).includes(
            nombrePagina
        );
    }


    function actualizarSidebarUsuario() {

        const usuario =
            obtenerUsuarioActual();

        if (!usuario) {
            return;
        }

        const nombre =
            usuario.nombre ||
            usuario.correo ||
            usuario.email ||
            "Usuario";

        const rol =
            normalizarRol(
                usuario.rol ||
                    usuario.tipo ||
                    "Usuario"
                );

        const nombreFormateado =
            String(nombre).trim();

        const rolFormateado =
            rol
                ? rol.charAt(0).toUpperCase() + rol.slice(1)
                : "Usuario";

        const candidatosNombre = [
            document.getElementById("nombreUsuario"),
            document.getElementById("usuarioNombre"),
            document.querySelector(".usuario h4")
        ];

        const candidatosRol = [
            document.getElementById("rolUsuario"),
            document.getElementById("usuarioRol"),
            document.querySelector(".usuario p")
        ];

        for (const elemento of candidatosNombre) {
            if (elemento) {
                elemento.textContent =
                    nombreFormateado;
            }
        }

        for (const elemento of candidatosRol) {
            if (elemento) {
                elemento.textContent =
                    rolFormateado;
            }
        }

    }


    function aplicarPermisosDeVista() {
        const paginasProtegidas = new Set([
            "dashboard.html",
            "estudiantes.html",
            "scanner.html",
            "reportes.html",
            "credencial.html",
            "configuracion.html"
        ]);

        if (!paginasProtegidas.has(paginaActual())) {
            return;
        }

        protegerPagina().catch(error => {
            logger.error(
                "No se pudieron aplicar los permisos de navegación.",
                error
            );
            global.location.replace(CONFIG.loginUrl);
        });
    }


    /* ========================================================
       PROTEGER PÁGINA
       ======================================================== */

    async function obtenerUsuarioAutorizado() {
        if (verificacionUsuario) {
            return verificacionUsuario;
        }

        verificacionUsuario = (async () => {
            const session = await auth.session();
            if (!session?.user?.id) {
                return null;
            }

            const authUser = await auth.user();
            if (
                !authUser?.id ||
                authUser.id !== session.user.id
            ) {
                return null;
            }

            let resultado = await client
                .from(TABLES.USUARIOS)
                .select("id, nombre, correo, documento, rol, estado")
                .eq("id", authUser.id)
                .maybeSingle();

            if (resultado.error) {
                throw resultado.error;
            }

            if (!resultado.data && authUser.email) {
                resultado = await client
                    .from(TABLES.USUARIOS)
                    .select("id, nombre, correo, documento, rol, estado")
                    .eq("correo", authUser.email)
                    .maybeSingle();
            }

            if (resultado.error) {
                throw resultado.error;
            }

            const perfil = resultado.data;
            const rol = normalizarRol(perfil?.rol);
            if (
                !perfil ||
                String(perfil.estado || "").trim().toLowerCase() !== "aprobado" ||
                !rol
            ) {
                return null;
            }

            const usuario = {
                id: authUser.id,
                nombre: perfil.nombre || authUser.email || "Usuario",
                correo: perfil.correo || authUser.email || "",
                email: authUser.email || perfil.correo || "",
                documento: perfil.documento || "",
                rol,
                tipo: rol,
                avatar_url: authUser.user_metadata?.avatar_url || ""
            };

            usuarioVerificado = {
                usuario,
                rol
            };

            try {
                storage.set("usuario", JSON.stringify(usuario));
            } catch (error) {
                logger.warn(
                    "No se pudo actualizar el perfil local después de verificarlo.",
                    error
                );
            }
            global.PUNTUALIXSCAN?.perfil?.sincronizarAvatarCuenta?.(
                usuario.avatar_url
            );

            return usuarioVerificado;
        })();

        try {
            return await verificacionUsuario;
        } catch (error) {
            verificacionUsuario = null;
            usuarioVerificado = null;
            throw error;
        }
    }


    function aplicarMenuPorRol(rol) {
        const permisos = new Set(paginasPermitidasPorRol(rol));
        document.querySelectorAll(".nav-link").forEach(link => {
            if (link.classList.contains("logout")) {
                link.hidden = false;
                return;
            }

            const destino = String(link.getAttribute("href") || "")
                .split("?")[0]
                .split("#")[0]
                .split("/")
                .pop()
                .toLowerCase();
            const permitido = permisos.has(destino);
            link.hidden = !permitido;

            const etiqueta = link.querySelector("span");
            if (etiqueta && rol === "portero" && destino === "configuracion.html") {
                etiqueta.textContent = "Mi perfil";
            } else if (etiqueta && rol === "estudiante" && destino === "reportes.html") {
                etiqueta.textContent = "Mi perfil, asistencia y QR";
            }
        });

        if (rol === "estudiante") {
            [
                "btnVistaEstudiantes",
                "vistaEstudiantes",
                "dialogoEstudiantesGrafica",
                "dialogoTodasFaltas"
            ].forEach(id => document.getElementById(id)?.remove());
        }

        if (rol === "portero" && paginaActual() === "configuracion.html") {
            const cuenta = document.getElementById("panelCuentaAdministrativa");
            document.querySelectorAll(".config-panel").forEach(panel => {
                panel.hidden = panel !== cuenta;
            });
            document.querySelectorAll(".config-column").forEach(columna => {
                columna.hidden = !cuenta || !columna.contains(cuenta);
            });

            const titulo = document.querySelector(".config-header h1");
            if (titulo) {
                titulo.textContent = "Mi perfil";
            }
            const descripcion = document.querySelector(".config-header p");
            if (descripcion) {
                descripcion.textContent = "Actualiza la foto de perfil de tu cuenta.";
            }
            const tituloCuenta = cuenta?.querySelector(".config-panel-title h2");
            if (tituloCuenta) {
                tituloCuenta.textContent = "Mi perfil";
            }
            const avisoCuenta = cuenta?.querySelector(".config-alert span");
            if (avisoCuenta) {
                avisoCuenta.textContent = "Tu perfil está protegido por el sistema de autenticación institucional.";
            }
        }
    }


    async function protegerPagina(options = {}) {
        const redirigir = options.redirect !== false;
        const pagina = paginaActual();

        try {
            const identidad = await obtenerUsuarioAutorizado();
            if (!identidad) {
                if (redirigir) {
                    global.location.replace(options.redirectTo || CONFIG.loginUrl);
                }
                return false;
            }

            const { usuario, rol } = identidad;
            const permitido = tienePermisoParaPagina(pagina, rol);
            if (permitido) {
                actualizarSidebarUsuario();
                aplicarMenuPorRol(rol);
                document.documentElement.dataset.permissionsReady = "true";
                if (pagina === "configuracion.html") {
                    document.documentElement.dataset.configRole = rol;
                }
                return true;
            }

            if (redirigir) {
                global.location.replace(
                    rol === "portero"
                        ? "scanner.html"
                        : rol === "estudiante"
                            ? "reportes.html"
                            : rol === "administrador" || rol === "profesor"
                                ? "dashboard.html"
                                : options.redirectTo || CONFIG.loginUrl
                );
            }
            return false;
        } catch (error) {
            logger.error(
                "No se pudo verificar la identidad y los permisos de la cuenta.",
                error
            );
            if (redirigir) {
                global.location.replace(options.redirectTo || CONFIG.loginUrl);
            }
            return false;
        }
    }


    /* ========================================================
       OBTENER USUARIO ACTUAL
       ======================================================== */

    async function obtenerUsuario() {

        try {

            return await auth.user();

        } catch (error) {

            logger.warn(

                "No fue posible obtener el usuario actual.",

                error
            );


            return null;
        }
    }


    /* ========================================================
       LIMPIAR CACHE
       ======================================================== */

    function limpiarCache() {

        cache.clear();
    }


    /* ========================================================
       INFORMACIÓN DE LA APLICACIÓN
       ======================================================== */

    const APP = Object.freeze({

        name:
            CONFIG.appName,

        version:
            CONFIG.appVersion,

        locale:
            CONFIG.locale,

        timezone:
            CONFIG.timezone
    });


    /* ========================================================
       EXPONER API GLOBAL
       ======================================================== */

    const namespace =
        Object.assign(

            existing,

            {

                version:
                    CONFIG.appVersion,

                app:
                    APP,

                config:

                    Object.freeze({

                        url:
                            CONFIG.url,

                        schema:
                            CONFIG.schema,

                        locale:
                            CONFIG.locale,

                        timezone:
                            CONFIG.timezone,

                        loginUrl:
                            CONFIG.loginUrl,

                        requestTimeoutMs:
                            CONFIG.requestTimeoutMs
                    }),


                client:
                    client,


                db:
                    client,


                TABLES:
                    TABLES,


                ESTADOS:
                    ESTADOS,


                INGRESOS:
                    INGRESOS,


                Error:
                    PuntualixscanError,


                logger:
                    logger,


                cache:
                    cache,


                storage:
                    storage,


                auth:
                    auth,


                data:
                    data,


                utils:
                    utils,


                request:
                    request,


                protegerPagina:
                    protegerPagina,


                obtenerUsuario:
                    obtenerUsuario,


                limpiarCache:
                    limpiarCache,

                permisos:
                    Object.freeze({
                        normalizarRol,
                        obtenerUsuarioActual,
                        rolUsuarioActual,
                        paginaActual,
                        tienePermisoParaPagina,
                        paginasPermitidasPorRol,
                        aplicarPermisosDeVista
                    })
            }
        );


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            aplicarPermisosDeVista
        );

    } else {

        aplicarPermisosDeVista();
    }


    /* ========================================================
       VARIABLES COMPATIBLES
       ======================================================== */

    global.PUNTUALIXSCAN =
        namespace;

    client.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
            usuarioVerificado = null;
            verificacionUsuario = null;
            delete document.documentElement.dataset.permissionsReady;
            if (paginaActual() && paginaActual() !== "login.html") {
                global.location.replace(CONFIG.loginUrl);
            }
            return;
        }

        if (
            event === "SIGNED_IN" &&
            usuarioVerificado?.usuario?.id &&
            usuarioVerificado.usuario.id !== session?.user?.id
        ) {
            usuarioVerificado = null;
            verificacionUsuario = null;
            delete document.documentElement.dataset.permissionsReady;
            global.setTimeout(aplicarPermisosDeVista, 0);
        }
    });

    global.addEventListener("pageshow", event => {
        if (!event.persisted) {
            return;
        }

        usuarioVerificado = null;
        verificacionUsuario = null;
        delete document.documentElement.dataset.permissionsReady;
        aplicarPermisosDeVista();
    });


    global.supabaseClient =
        client;


    global.db =
        client;

    iniciarSeguimientoPresenciaProfesores();


    function iniciarSeguimientoPresenciaProfesores() {

        const paginasInstitucionales = new Set([
            "dashboard.html",
            "estudiantes.html",
            "scanner.html",
            "reportes.html",
            "credencial.html",
            "configuracion.html"
        ]);
        const pagina = String(
            global.location.pathname.split("/").pop() || ""
        ).toLowerCase();

        if (!paginasInstitucionales.has(pagina)) {
            return;
        }

        let temporizador = null;
        let registrando = false;

        async function registrarActividad() {

            if (
                registrando ||
                document.visibilityState === "hidden"
            ) {
                return;
            }

            registrando = true;

            try {
                const resultadoUsuario =
                    await client.auth.getUser();

                if (resultadoUsuario.error) {
                    throw resultadoUsuario.error;
                }

                const usuario = resultadoUsuario.data?.user;
                if (!usuario?.id) {
                    return;
                }

                const resultadoPerfil = await client
                    .from("usuarios")
                    .select("rol, estado")
                    .eq("id", usuario.id)
                    .maybeSingle();

                if (resultadoPerfil.error) {
                    throw resultadoPerfil.error;
                }

                if (
                    resultadoPerfil.data?.rol !== "profesor" ||
                    resultadoPerfil.data?.estado !== "aprobado"
                ) {
                    return;
                }

                const resultadoPresencia = await client.rpc(
                    "registrar_presencia_profesor",
                    { pagina_actual: pagina }
                );

                if (resultadoPresencia.error) {
                    throw resultadoPresencia.error;
                }

            } catch (error) {
                logger.warn(
                    "No se pudo actualizar la actividad del profesor.",
                    error
                );
            } finally {
                registrando = false;
            }
        }

        function iniciarTemporizador() {
            if (temporizador !== null) {
                return;
            }

            registrarActividad();
            temporizador = global.setInterval(
                registrarActividad,
                60000
            );
        }

        function detenerTemporizador() {
            if (temporizador === null) {
                return;
            }

            global.clearInterval(temporizador);
            temporizador = null;
        }

        document.addEventListener(
            "visibilitychange",
            () => {
                if (document.visibilityState === "hidden") {
                    detenerTemporizador();
                    return;
                }

                iniciarTemporizador();
            }
        );

        if (typeof client.auth.onAuthStateChange === "function") {
            client.auth.onAuthStateChange(event => {
                global.setTimeout(() => {
                    if (event === "SIGNED_OUT") {
                        detenerTemporizador();
                    } else {
                        iniciarTemporizador();
                    }
                }, 0);
            });
        }

        iniciarTemporizador();
    }


})(window);
