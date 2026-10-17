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

    estudiantes: [],

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
        window.PUNTUALIXSCAN?.client
    ) {

        return window.PUNTUALIXSCAN.client;

    }


    if (
        window.PUNTUALIXSCAN?.db
    ) {

        return window.PUNTUALIXSCAN.db;

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
    const proteger = window.PUNTUALIXSCAN?.protegerPagina;
    if (typeof proteger !== "function") {
        console.error(
            "No está disponible la verificación de permisos para Credenciales."
        );
        window.location.replace("login.html");
        return false;
    }

    return Boolean(await proteger({ redirectTo: "login.html" }));

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


    $("seleccionarEstudianteCredencial")
        ?.addEventListener(
            "change",
            seleccionarEstudiante
        );

    $("buscarEstudianteCredencial")
        ?.addEventListener(
            "input",
            filtrarEstudiantesCredencial
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


        const client =
            obtenerCliente();


        const {
            data: estudiantes,
            error: errorEstudiantes
        } = await client
            .from("estudiantes")
            .select("*")
            .order(
                "nombre",
                {
                    ascending: true
                }
            );


        if (errorEstudiantes) {

            throw errorEstudiantes;

        }


        state.estudiantes =
            Array.isArray(estudiantes)
                ? estudiantes
                : [];


        cargarSelectorEstudiantes();


        /* ---------------------------------------------
           PRIMERA OPCIÓN:
           DOCUMENTO EN LA URL
        --------------------------------------------- */

        if (
            documento
        ) {


            state.estudiante =
                state.estudiantes.find(
                    estudiante =>
                        String(estudiante.documento) === documento
                ) || null;


        } else {


            /* -----------------------------------------
               SEGUNDA OPCIÓN:
               ESTUDIANTE GUARDADO
            ----------------------------------------- */

            state.estudiante =
                guardado
                    ? state.estudiantes.find(
                        estudiante =>
                            String(estudiante.id) === String(guardado.id) ||
                            String(estudiante.documento) === String(guardado.documento)
                    ) || null
                    : null;

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


        const selector =
            $("seleccionarEstudianteCredencial");

        if (selector) {
            selector.value =
                String(state.estudiante.id || "");
        }


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


function cargarSelectorEstudiantes() {

    const selector =
        $("seleccionarEstudianteCredencial");

    if (!selector) {
        return;
    }

    renderizarOpcionesEstudiantes(state.estudiantes);

    selector.disabled =
        state.estudiantes.length === 0;

    if (state.estudiantes.length === 0) {
        const mensaje =
            $("resultadoBusquedaCredencial");

        if (mensaje) {
            mensaje.textContent =
                "No hay estudiantes disponibles.";
        }
    }

}


function filtrarEstudiantesCredencial() {

    const busqueda =
        normalizarTexto(
            $("buscarEstudianteCredencial")?.value || ""
        );

    const estudiantes =
        !busqueda
            ? state.estudiantes
            : state.estudiantes.filter(estudiante => {
                const nombre =
                    normalizarTexto(estudiante.nombre);

                const documento =
                    normalizarTexto(estudiante.documento);

                return (
                    nombre.includes(busqueda) ||
                    documento.includes(busqueda)
                );
            });

    renderizarOpcionesEstudiantes(estudiantes);

    const mensaje =
        $("resultadoBusquedaCredencial");

    if (mensaje) {
        mensaje.textContent =
            estudiantes.length
                ? `${estudiantes.length} estudiante(s) encontrado(s). Selecciona uno de la lista.`
                : "No se encontraron estudiantes con ese nombre o documento.";
    }

}


function renderizarOpcionesEstudiantes(estudiantes) {

    const selector =
        $("seleccionarEstudianteCredencial");

    if (!selector) {
        return;
    }

    selector.replaceChildren();

    const opcionInicial =
        document.createElement("option");

    opcionInicial.value = "";
    opcionInicial.textContent = "Selecciona un estudiante...";
    selector.append(opcionInicial);

    estudiantes.forEach(estudiante => {
        const opcion =
            document.createElement("option");

        opcion.value =
            String(estudiante.id || "");

        opcion.textContent =
            `${estudiante.nombre || "Sin nombre"} · ${estudiante.documento || "Sin documento"} · ${estudiante.curso || "Sin curso"}`;

        selector.append(opcion);
    });

    selector.disabled =
        estudiantes.length === 0;

    if (estudiantes.length === 0) {
        opcionInicial.textContent =
            state.estudiantes.length
                ? "No hay coincidencias"
                : "No hay estudiantes disponibles";
    }

}


function seleccionarEstudiante(event) {

    const id =
        String(event.target.value || "");

    const estudiante =
        state.estudiantes.find(
            item => String(item.id) === id
        );

    if (!estudiante) {
        state.estudiante = null;
        limpiarCredencial();
        mostrarMensaje("Selecciona un estudiante para generar su credencial.");
        return;
    }

    state.estudiante = estudiante;

    localStorage.setItem(
        "estudianteCredencial",
        JSON.stringify(estudiante)
    );

    const busqueda =
        $("buscarEstudianteCredencial");

    if (busqueda) {
        busqueda.value = "";
    }

    renderizarOpcionesEstudiantes(state.estudiantes);

    const selector =
        $("seleccionarEstudianteCredencial");

    if (selector) {
        selector.value = String(estudiante.id || "");
    }

    const mensaje =
        $("resultadoBusquedaCredencial");

    if (mensaje) {
        mensaje.textContent =
            `${state.estudiantes.length} estudiante(s) disponible(s).`;
    }

    mostrarCredencial(estudiante);

}


function normalizarTexto(valor) {

    return String(valor || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLocaleLowerCase("es");

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
            !valor ||
            ["imagenes/usuario.png", "imagenes/usuario.svg"].includes(valor)
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

async function descargarPDF() {
    if (!state.estudiante) {
        notificar("Primero selecciona un estudiante.", "info");
        return;
    }

    if (!window.jspdf?.jsPDF) {
        notificar("No se pudo cargar el generador de PDF.", "error");
        return;
    }

    try {
        const estudiante = state.estudiante;
        const codigo =
            estudiante.codigoqr ||
            estudiante.documento ||
            "PUNTUALIXSCAN";
        const imagenQR = obtenerImagenQRParaPDF();

        const [fotoResult, logoResult] = await Promise.allSettled([
            cargarImagenParaPDF(obtenerFotoSegura(estudiante.foto), 420, 500, true),
            cargarImagenParaPDF("imagenes/logo.png", 180, 180, false)
        ]);

        let foto = FOTO_DEFAULT;
        if (fotoResult.status === "fulfilled") {
            foto = fotoResult.value;
        } else {
            console.warn("No se pudo cargar la foto del estudiante para el PDF; se usará el avatar predeterminado.", fotoResult.reason);
            foto = await cargarImagenParaPDF(FOTO_DEFAULT, 420, 500, true);
        }

        const logo = logoResult.status === "fulfilled"
            ? logoResult.value
            : null;
        if (!logo) {
            console.warn("No se pudo cargar el logo institucional para el PDF.", logoResult.reason);
        }

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4"
        });

        const pageWidth = 297;
        const pageHeight = 210;
        const card = { x: 20, y: 24, width: 257, height: 162 };

        pdf.setFillColor(241, 246, 253);
        pdf.rect(0, 0, pageWidth, pageHeight, "F");

        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(card.x, card.y, card.width, card.height, 7, 7, "F");
        pdf.setDrawColor(220, 230, 243);
        pdf.setLineWidth(0.6);
        pdf.roundedRect(card.x, card.y, card.width, card.height, 7, 7, "S");

        pdf.setFillColor(18, 59, 133);
        pdf.roundedRect(card.x, card.y, card.width, 39, 7, 7, "F");
        pdf.rect(card.x, card.y + 22, card.width, 17, "F");
        pdf.setFillColor(121, 237, 199);
        pdf.roundedRect(card.x, card.y + 37, card.width, 2, 1, 1, "F");

        if (logo) {
            pdf.setFillColor(255, 255, 255);
            pdf.roundedRect(30, 30, 35, 35, 5, 5, "F");
            pdf.addImage(logo, "JPEG", 32, 32, 31, 31, undefined, "FAST");
        }

        pdf.setTextColor(255, 255, 255);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text("INSTITUCIÓN EDUCATIVA", 70, 35);
        pdf.setFontSize(14);
        pdf.text("Maestro Arenas Betancur", 70, 43);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(222, 234, 255);
        pdf.text("Puntualixscan · Control de asistencia", 70, 51);

        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(225, 33, 39, 12, 6, 6, "F");
        pdf.setTextColor(18, 59, 133);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6.5);
        pdf.text("CREDENCIAL ESTUDIANTIL", 244.5, 40.5, { align: "center" });

        pdf.setFillColor(236, 243, 252);
        pdf.roundedRect(31, 70, 49, 66, 4, 4, "F");
        pdf.addImage(foto, "JPEG", 33, 72, 45, 62, undefined, "FAST");

        const nombre = String(estudiante.nombre || "Estudiante").trim();
        pdf.setTextColor(18, 59, 133);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.text("NOMBRE DEL ESTUDIANTE", 90, 77);

        pdf.setTextColor(23, 32, 51);
        pdf.setFontSize(17);
        const nombreLineas = pdf.splitTextToSize(nombre, 112).slice(0, 2);
        pdf.text(nombreLineas, 90, 86, { lineHeightFactor: 1.12 });

        const filaDatosY = nombreLineas.length > 1 ? 105 : 100;
        const tarjetas = [
            { x: 90, width: 49, label: "GRADO / CURSO", value: estudiante.curso || "Sin asignar" },
            { x: 144, width: 43, label: "AÑO LECTIVO", value: String(new Date().getFullYear()) },
            { x: 192, width: 25, label: "ESTADO", value: "Activo" }
        ];

        tarjetas.forEach((tarjeta, index) => {
            const background = index === 2 ? [233, 248, 242] : [246, 249, 253];
            pdf.setFillColor(...background);
            pdf.roundedRect(tarjeta.x, filaDatosY, tarjeta.width, 25, 3, 3, "F");
            pdf.setTextColor(113, 128, 150);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(5.5);
            pdf.text(tarjeta.label, tarjeta.x + 3, filaDatosY + 7);
            pdf.setTextColor(index === 2 ? 21 : 23, index === 2 ? 149 : 32, index === 2 ? 112 : 51);
            pdf.setFontSize(8);
            pdf.setFont("helvetica", "bold");
            const valueLines = pdf.splitTextToSize(String(tarjeta.value), tarjeta.width - 6).slice(0, 2);
            pdf.text(valueLines, tarjeta.x + 3, filaDatosY + 16, { lineHeightFactor: 1.1 });
        });

        pdf.setDrawColor(220, 230, 243);
        pdf.setLineWidth(0.4);
        pdf.line(31, 145, 266, 145);
        pdf.setTextColor(113, 128, 150);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6);
        pdf.text("DOCUMENTO DE IDENTIDAD", 33, 154);
        pdf.setTextColor(18, 59, 133);
        pdf.setFontSize(10);
        pdf.text(String(estudiante.documento || "No registrado"), 33, 164);

        pdf.setTextColor(113, 128, 150);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.text("Código de identificación", 112, 154);
        pdf.setTextColor(18, 59, 133);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8);
        pdf.text(pdf.splitTextToSize(String(codigo), 72).slice(0, 1), 112, 164);

        pdf.setFillColor(255, 255, 255);
        pdf.roundedRect(223, 69, 42, 61, 4, 4, "F");
        pdf.setDrawColor(220, 230, 243);
        pdf.roundedRect(223, 69, 42, 61, 4, 4, "S");
        pdf.addImage(imagenQR, "PNG", 226, 72, 36, 36, undefined, "NONE");
        pdf.setTextColor(18, 59, 133);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(6);
        pdf.text("ESCANEA PARA IDENTIFICAR", 244, 116, { align: "center" });
        pdf.setTextColor(113, 128, 150);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(5.5);
        pdf.text("Credencial digital del estudiante", 244, 123, { align: "center" });

        pdf.setTextColor(113, 128, 150);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(6);
        pdf.text("Institución Educativa Maestro Arenas Betancur", 148.5, 178, { align: "center" });

        pdf.save(`credencial-${limpiarNombre(estudiante.documento || "estudiante")}.pdf`);
    } catch (error) {
        console.error("Error generando PDF:", error);
        notificar(
            error?.message || "No fue posible generar el PDF. Verifica la foto y el código QR e inténtalo nuevamente.",
            "error"
        );
    }
}


function obtenerImagenQRParaPDF() {
    const contenedor = $("qrCarnet");
    const canvas = contenedor?.querySelector("canvas");
    if (canvas) {
        return canvas.toDataURL("image/png");
    }

    const imagen = contenedor?.querySelector("img");
    if (imagen?.complete && imagen.naturalWidth > 0) {
        return imagen.src;
    }

    throw new Error("No se pudo generar el código QR de la credencial.");
}


function cargarImagenParaPDF(src, ancho, alto, recortar) {
    return new Promise((resolve, reject) => {
        const imagen = new Image();
        if (!String(src).startsWith("data:")) {
            imagen.crossOrigin = "anonymous";
        }

        imagen.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = ancho;
                canvas.height = alto;
                const contexto = canvas.getContext("2d");
                if (!contexto) {
                    throw new Error("El navegador no pudo preparar una imagen para el PDF.");
                }

                contexto.fillStyle = "#ffffff";
                contexto.fillRect(0, 0, ancho, alto);
                if (recortar) {
                    const escala = Math.max(ancho / imagen.width, alto / imagen.height);
                    const origenAncho = ancho / escala;
                    const origenAlto = alto / escala;
                    const origenX = (imagen.width - origenAncho) / 2;
                    const origenY = (imagen.height - origenAlto) / 2;
                    contexto.drawImage(imagen, origenX, origenY, origenAncho, origenAlto, 0, 0, ancho, alto);
                } else {
                    const escala = Math.min(ancho / imagen.width, alto / imagen.height);
                    const destinoAncho = imagen.width * escala;
                    const destinoAlto = imagen.height * escala;
                    contexto.drawImage(imagen, (ancho - destinoAncho) / 2, (alto - destinoAlto) / 2, destinoAncho, destinoAlto);
                }
                resolve(canvas.toDataURL("image/jpeg", 0.92));
            } catch (error) {
                reject(error);
            }
        };
        imagen.onerror = () => reject(new Error("No se pudo cargar una de las imágenes de la credencial."));
        imagen.src = src;
    });
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