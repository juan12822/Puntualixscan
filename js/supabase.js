/*
 * ============================================================
 * EDUQR CONTROL
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

(function bootstrapEduQR(global) {

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
            "eduaccess.enterprise.auth",

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
            "EDUQR CONTROL",

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
        global.EDUQR &&
        typeof global.EDUQR === "object"

            ? global.EDUQR

            : {};


    /* ========================================================
       ERROR PERSONALIZADO
       ======================================================== */

    class EduQRError extends Error {

        constructor(
            message,
            options = {}
        ) {

            super(
                message ||
                "Ha ocurrido un error."
            );


            this.name =
                "EduQRError";


            this.code =
                options.code ||
                "EDUQR_ERROR";


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
                    "[EDUQR]",
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
                "[EDUQR]",
                message,
                context || ""
            );
        },


        warn(
            message,
            context
        ) {

            console.warn(
                "[EDUQR]",
                message,
                context || ""
            );
        },


        error(
            message,
            error
        ) {

            console.error(
                "[EDUQR]",
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

            throw new EduQRError(
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
                            "eduqr-control"
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

        storage.remove(
            "usuario"
        );


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

                                        new EduQRError(

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
            error instanceof EduQRError
        ) {

            return error;
        }


        const message =
            error?.message ||
            fallbackMessage ||
            "No se pudo completar la operación.";


        return new EduQRError(

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
        filters
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


        let query =
            client.from(
                table.trim()
            );


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
                    options.filters
                )
                    .select(

                        options.columns ||
                        "*",

                        {

                            count:
                                options.count ||
                                undefined,

                            head:
                                Boolean(
                                    options.head
                                )
                        }
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


        isEmail
    });


    /* ========================================================
       PROTEGER PÁGINA
       ======================================================== */

    async function protegerPagina(
        options = {}
    ) {

        let session =
            null;


        try {

            session =
                await auth.session();

        } catch (error) {

            logger.warn(

                "No fue posible comprobar " +
                "la sesión de Supabase.",

                error
            );
        }


        /*
         * Compatibilidad con el sistema
         * actual de login.
         */

        const legacyUser =
            safeJsonParse(

                storage.get(
                    "usuario"
                ),

                null
            );


        /*
         * Si existe una sesión real de
         * Supabase, permitimos el acceso.
         */

        if (
            session
        ) {

            return true;
        }


        /*
         * Mantenemos compatibilidad
         * con tu sistema actual.
         */

        if (
            legacyUser
        ) {

            return true;
        }


        /*
         * Si no hay autenticación,
         * redirigir solamente una vez.
         */

        if (
            options.redirect !==
            false
        ) {

            global.location.replace(

                options.redirectTo ||
                CONFIG.loginUrl
            );
        }


        return false;
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
                    EduQRError,


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
                    limpiarCache
            }
        );


    /* ========================================================
       VARIABLES COMPATIBLES
       ======================================================== */

    global.EDUQR =
        namespace;


    global.supabaseClient =
        client;


    global.db =
        client;


})(window);