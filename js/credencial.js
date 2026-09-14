/* =========================================================
   PUNTUALIXSCAN ENTERPRISE
   CREDENCIAL INSTITUCIONAL
   ========================================================= */

"use strict";


/* =========================================================
   ESTADO
========================================================= */

const state = {

    estudiante: null,

    inicializado: false,

    cargando: false

};


/* =========================================================
   FOTO DEFAULT
========================================================= */

const FOTO_DEFAULT =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="300"
             height="360"
             viewBox="0 0 300 360">

            <rect
                width="300"
                height="360"
                fill="#eaf1ff"
            />

            <circle
                cx="150"
                cy="125"
                r="65"
                fill="#123b85"
            />

            <path
                d="M55 325c9-75 48-111 95-111s86 36 95 111"
                fill="#123b85"
            />

        </svg>
    `);


/* =========================================================
   SELECTOR
========================================================= */

const $ =
    id => document.getElementById(id);


/* =========================================================
   CLIENTE
========================================================= */

function obtenerCliente() {


    if (
        window.EDUQR?.client
    ) {

        return window.EDUQR.client;

    }


    if (
        window.EDUQR?.db
    ) {

        return window.EDUQR.db;

    }


    if (
        window.supabaseClient
    ) {

        return window.supabaseClient;

    }


    if (
        window.db
    ) {

        return window.db;

    }


    throw new Error(
        "No se encontró el cliente de Supabase."
    );

}


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    iniciar
);


async function iniciar() {


    if (
        state.inicializado
    ) {

        return;

    }


    state.inicializado =
        true;


    configurarEventos();


    try {

        const permitido =
            await protegerPagina();


        if (
            permitido === false
        ) {

            return;

        }


        await cargarCredencial();


    } catch (error) {

        console.error(
            "Error iniciando credencial:",
            error
        );


        mostrarMensaje(
            "No fue posible iniciar la credencial."
        );

    }

}


/* =========================================================
   PROTEGER PÁGINA
========================================================= */

async function protegerPagina() {


    try {


        if (
            window.EDUQR &&
            typeof window.EDUQR.protegerPagina ===
                "function"
        ) {

            const resultado =
                await window.EDUQR.protegerPagina({

                    redirectTo:
                        "login.html"

                });


            return resultado !== false;

        }


        const client =
            obtenerCliente();


        const {
            data,
            error
        } =
            await client.auth.getSession();


        if (error) {

            throw error;

        }


        if (
            !data?.session
        ) {

            const usuario =
                localStorage.getItem(
                    "usuario"
                );


            if (!usuario) {

                window.location.replace(
                    "login.html"
                );


                return false;

            }

        }


        return true;


    } catch (error) {

        console.error(
            "Error verificando sesión:",
            error
        );


        return true;

    }

}


/* =========================================================
   EVENTOS
========================================================= */

function configurarEventos() {


    $("btnImprimir")
        ?.addEventListener(
            "click",
            imprimirCredencial
        );


    $("btnDescargarPDF")
        ?.addEventListener(
            "click",
            descargarPDF
        );


    $("btnVolver")
        ?.addEventListener(
            "click",
            volver
        );


    $("btnCerrarSesion")
        ?.addEventListener(
            "click",
            cerrarSesion
        );

}


/* =========================================================
   CARGAR CREDENCIAL
========================================================= */

async function cargarCredencial() {


    if (
        state.cargando
    ) {

        return;

    }


    state.cargando =
        true;


    mostrarCarga(
        true
    );


    try {


        const parametros =
            new URLSearchParams(
                window.location.search
            );


        const documento =
            String(
                parametros.get(
                    "documento"
                ) || ""
            ).trim();


        const guardado =
            obtenerEstudianteGuardado();


        /* ---------------------------------------------
           PRIMERA OPCIÓN:
           DOCUMENTO EN LA URL
        --------------------------------------------- */

        if (
            documento
        ) {


            const client =
                obtenerCliente();


            const {
                data,
                error
            } =
                await client

                    .from(
                        "estudiantes"
                    )

                    .select(
                        "*"
                    )

                    .eq(
                        "documento",
                        documento
                    )

                    .maybeSingle();


            if (error) {

                throw error;

            }


            state.estudiante =
                data || null;


        } else {


            /* -----------------------------------------
               SEGUNDA OPCIÓN:
               ESTUDIANTE GUARDADO
            ----------------------------------------- */

            state.estudiante =
                guardado;

        }


        if (
            !state.estudiante
        ) {


            mostrarMensaje(
                "Selecciona un estudiante para generar su credencial."
            );


            limpiarCredencial();


            return;

        }


        mostrarCredencial(
            state.estudiante
        );


    } catch (error) {


        console.error(
            "Error cargando credencial:",
            error
        );


        mostrarMensaje(
            obtenerMensajeError(
                error,
                "No fue posible cargar la credencial."
            )
        );


        limpiarCredencial();


        notificar(
            obtenerMensajeError(
                error,
                "Verifica la información del estudiante."
            ),
            "error"
        );


    } finally {


        state.cargando =
            false;


        mostrarCarga(
            false
        );

    }

}


/* =========================================================
   ESTUDIANTE GUARDADO
========================================================= */

function obtenerEstudianteGuardado() {


    try {


        const valor =
            localStorage.getItem(
                "estudianteCredencial"
            );


        if (
            !valor
        ) {

            return null;

        }


        return JSON.parse(
            valor
        );


    } catch (error) {


        console.warn(
            "No se pudo leer estudianteCredencial:",
            error
        );


        return null;

    }

}


/* =========================================================
   MOSTRAR CREDENCIAL
========================================================= */

function mostrarCredencial(
    estudiante
) {


    const foto =
        obtenerFotoSegura(
            estudiante.foto
        );


    const imagen =
        $("fotoEstudiante");


    if (imagen) {


        imagen.onerror =
            function () {

                this.onerror =
                    null;

                this.src =
                    FOTO_DEFAULT;

            };


        imagen.src =
            foto;

    }


    ponerTexto(
        "nombreEstudiante",
        estudiante.nombre ||
        "Estudiante"
    );


    ponerTexto(
        "documentoEstudiante",
        estudiante.documento ||
        "—"
    );


    ponerTexto(
        "cursoEstudiante",
        estudiante.curso ||
        "—"
    );


    const codigo =
        estudiante.codigoqr ||
        estudiante.documento ||
        "PUNTUALIXSCAN";


    ponerTexto(
        "codigoEstudiante",
        codigo
    );


    ponerTexto(
        "anoLectivo",
        String(
            new Date().getFullYear()
        )
    );


    ponerTexto(
        "estadoEstudiante",
        "Activo"
    );


    mostrarMensaje(
        "Credencial lista"
    );


    generarQR(
        codigo
    );

}


/* =========================================================
   FOTO SEGURA
========================================================= */

function obtenerFotoSegura(
    foto
) {


    const valor =
        String(
            foto || ""
        ).trim();


    if (
        !valor
    ) {

        return FOTO_DEFAULT;

    }


    return valor;

}


/* =========================================================
   QR
========================================================= */

function generarQR(
    contenido
) {


    const contenedor =
        $("qrCarnet");


    if (
        !contenedor
    ) {

        return;

    }


    contenedor.innerHTML =
        "";


    if (
        typeof QRCode ===
        "undefined"
    ) {


        contenedor.innerHTML = `

            <span
                style="
                    font-size:9px;
                    color:#718096;
                    text-align:center;
                "
            >

                QR no disponible

            </span>

        `;


        return;

    }


    try {


        new QRCode(
            contenedor,
            {

                text:
                    String(
                        contenido
                    ),

                width:
                    130,

                height:
                    130,

                colorDark:
                    "#102b5b",

                colorLight:
                    "#ffffff",

                correctLevel:
                    QRCode.CorrectLevel.H

            }
        );


    } catch (error) {


        console.error(
            "Error generando QR:",
            error
        );


        contenedor.textContent =
            "No se pudo generar el QR.";

    }

}


/* =========================================================
   IMPRIMIR
========================================================= */

function imprimirCredencial() {


    if (
        !state.estudiante
    ) {

        notificar(
            "Primero selecciona un estudiante.",
            "info"
        );


        return;

    }


    window.print();

}


/* =========================================================
   PDF
========================================================= */

function descargarPDF() {


    if (
        !state.estudiante
    ) {

        notificar(
            "Primero selecciona un estudiante.",
            "info"
        );


        return;

    }


    if (
        !window.jspdf?.jsPDF
    ) {

        notificar(
            "No se pudo cargar el generador de PDF.",
            "error"
        );


        return;

    }


    try {


        const {
            jsPDF
        } =
            window.jspdf;


        const estudiante =
            state.estudiante;


        const pdf =
            new jsPDF({

                orientation:
                    "landscape",

                unit:
                    "mm",

                format:
                    "a4"

            });


        /* ---------------------------------------------
           FONDO
        --------------------------------------------- */

        pdf.setFillColor(
            244,
            247,
            251
        );


        pdf.rect(
            0,
            0,
            297,
            210,
            "F"
        );


        /* ---------------------------------------------
           TARJETA
        --------------------------------------------- */

        pdf.setFillColor(
            255,
            255,
            255
        );


        pdf.roundedRect(
            28,
            42,
            241,
            126,
            8,
            8,
            "F"
        );


        /* ---------------------------------------------
           CABECERA
        --------------------------------------------- */

        pdf.setFillColor(
            18,
            59,
            133
        );


        pdf.roundedRect(
            28,
            42,
            241,
            35,
            8,
            8,
            "F"
        );


        pdf.rect(
            28,
            60,
            241,
            17,
            "F"
        );


        pdf.setTextColor(
            255,
            255,
            255
        );


        pdf.setFontSize(
            13
        );


        pdf.text(
            "Puntualixscan Enterprise",
            40,
            56
        );


        pdf.setFontSize(
            7
        );


        pdf.text(
            "Institución Educativa Maestro Arenas Betancur",
            40,
            67
        );


        /* ---------------------------------------------
           DATOS
        --------------------------------------------- */

        pdf.setTextColor(
            23,
            32,
            51
        );


        pdf.setFontSize(
            15
        );


        pdf.text(
            String(
                estudiante.nombre ||
                "Estudiante"
            ).slice(
                0,
                42
            ),
            43,
            94
        );


        pdf.setFontSize(
            8
        );


        pdf.setTextColor(
            113,
            128,
            150
        );


        pdf.text(
            "CREDENCIAL ESTUDIANTIL",
            43,
            102
        );


        pdf.setTextColor(
            23,
            32,
            51
        );


        pdf.setFontSize(
            8
        );


        pdf.text(
            `Documento: ${
                estudiante.documento ||
                "—"
            }`,
            43,
            116
        );


        pdf.text(
            `Curso: ${
                estudiante.curso ||
                "—"
            }`,
            43,
            126
        );


        pdf.text(
            `Año lectivo: ${
                new Date().getFullYear()
            }`,
            43,
            136
        );


        pdf.text(
            "Estado: Activo",
            43,
            146
        );


        /* ---------------------------------------------
           CÓDIGO
        --------------------------------------------- */

        pdf.setTextColor(
            113,
            128,
            150
        );


        pdf.setFontSize(
            6
        );


        pdf.text(
            "CÓDIGO DE IDENTIFICACIÓN",
            185,
            94
        );


        pdf.setTextColor(
            18,
            59,
            133
        );


        pdf.setFontSize(
            8
        );


        pdf.text(
            String(
                estudiante.codigoqr ||
                estudiante.documento ||
                "PUNTUALIXSCAN"
            ).slice(
                0,
                25
            ),
            185,
            102
        );


        pdf.setTextColor(
            113,
            128,
            150
        );


        pdf.setFontSize(
            6
        );


        pdf.text(
            "Código QR disponible en la credencial digital.",
            185,
            113
        );


        pdf.save(
            `credencial-${limpiarNombre(
                estudiante.documento ||
                "estudiante"
            )}.pdf`
        );


    } catch (error) {


        console.error(
            "Error generando PDF:",
            error
        );


        notificar(
            "No fue posible generar el PDF.",
            "error"
        );

    }

}


/* =========================================================
   VOLVER
========================================================= */

function volver() {


    if (
        window.history.length > 1
    ) {

        window.history.back();

        return;

    }


    window.location.assign(
        "estudiantes.html"
    );

}


/* =========================================================
   CERRAR SESIÓN
========================================================= */

async function cerrarSesion(
    evento
) {


    if (
        evento
    ) {

        evento.preventDefault();

    }


    let confirmado =
        true;


    if (
        window.Swal
    ) {


        const resultado =
            await Swal.fire({

                icon:
                    "question",

                title:
                    "Cerrar sesión",

                text:
                    "¿Deseas salir del sistema?",

                showCancelButton:
                    true,

                confirmButtonText:
                    "Salir",

                cancelButtonText:
                    "Cancelar",

                confirmButtonColor:
                    "#123b85"

            });


        confirmado =
            resultado.isConfirmed;

    }


    if (
        !confirmado
    ) {

        return;

    }


    try {


        const client =
            obtenerCliente();


        await client.auth.signOut();


    } catch (error) {


        console.warn(
            "Error cerrando sesión:",
            error
        );

    }


    localStorage.removeItem(
        "usuario"
    );


    localStorage.removeItem(
        "estudianteCredencial"
    );


    window.location.replace(
        "login.html"
    );

}


/* =========================================================
   LIMPIAR
========================================================= */

function limpiarCredencial() {


    ponerTexto(
        "nombreEstudiante",
        "Estudiante"
    );


    ponerTexto(
        "documentoEstudiante",
        "—"
    );


    ponerTexto(
        "cursoEstudiante",
        "—"
    );


    ponerTexto(
        "codigoEstudiante",
        "—"
    );


    ponerTexto(
        "estadoEstudiante",
        "Sin seleccionar"
    );


    const imagen =
        $("fotoEstudiante");


    if (imagen) {

        imagen.onerror =
            null;

        imagen.src =
            FOTO_DEFAULT;

    }


    const qr =
        $("qrCarnet");


    if (qr) {

        qr.innerHTML =
            "";

    }

}


/* =========================================================
   LOADER
========================================================= */

function mostrarCarga(
    mostrar
) {


    const loader =
        $("loader");


    if (!loader) {

        return;

    }


    loader.style.display =
        mostrar
            ? "flex"
            : "none";

}


/* =========================================================
   TEXTO
========================================================= */

function ponerTexto(
    id,
    valor
) {


    const elemento =
        $(id);


    if (
        elemento
    ) {

        elemento.textContent =
            valor;

    }

}


/* =========================================================
   MENSAJE
========================================================= */

function mostrarMensaje(
    mensaje
) {


    const elemento =
        $("mensajeCredencial");


    if (
        !elemento
    ) {

        return;

    }


    elemento.textContent =
        mensaje;

}


/* =========================================================
   LIMPIAR NOMBRE PDF
========================================================= */

function limpiarNombre(
    valor
) {


    return String(
        valor || "estudiante"
    )

        .normalize("NFD")

        .replace(
            /[\u0300-\u036f]/g,
            ""
        )

        .replace(
            /[^a-z0-9_-]/gi,
            "_"
        );

}


/* =========================================================
   ERROR
========================================================= */

function obtenerMensajeError(
    error,
    predeterminado
) {


    if (!error) {

        return predeterminado;

    }


    const mensaje =
        String(

            error.message ||

            error.details ||

            error.hint ||

            predeterminado

        );


    if (
        /row-level security/i.test(
            mensaje
        )
    ) {

        return (
            "Supabase bloqueó la consulta " +
            "por las políticas de seguridad."
        );

    }


    if (
        /failed to fetch/i.test(
            mensaje
        )
    ) {

        return (
            "No fue posible conectar con el servidor."
        );

    }


    return mensaje;

}


/* =========================================================
   NOTIFICACIÓN
========================================================= */

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
                "Credencial",

            text:
                texto,

            confirmButtonColor:
                "#123b85"

        });


        return;

    }


    console.log(
        texto
    );

}


/* =========================================================
   API GLOBAL
========================================================= */

window.PuntualixscanCredencial = {

    actualizar:
        cargarCredencial,

    imprimir:
        imprimirCredencial,

    descargarPDF,

    volver

};