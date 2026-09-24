/* ============================================================
   PUNTUALIXSCAN ENTERPRISE
   SCANNER QR - CONTROL DE ASISTENCIA
   VERSION PROFESIONAL ESTABLE
   ============================================================ */

"use strict";

/* ============================================================
   ESTADO DEL MODULO
   ============================================================ */

let estudianteActual = null;
let ingresoSeleccionado = "";
let estadoSeleccionado = "";

let camaraActiva = false;
let procesandoQR = false;
let registrando = false;

let html5QrCode = null;
let eventosRegistrados = false;


/* ============================================================
   ELEMENTOS DEL HTML
   ============================================================ */

const $ = (id) => document.getElementById(id);

const reader = $("reader");

const btnIniciar = $("btnIniciar");
const btnDetener = $("btnDetener");
const btnRegistrar = $("btnRegistrar");
const codigoManual = $("codigoManual");
const btnBuscarCodigo = $("btnBuscarCodigo");

const estudianteDiv = $("estudiante");
const opcionesDiv = $("opciones");

const fotoEstudiante = $("fotoEstudiante");
const nombreEstudiante = $("nombreEstudiante");
const documentoEstudiante = $("documentoEstudiante");
const cursoEstudiante = $("cursoEstudiante");

const mensajeEstado = $("mensajeEstado");

const btnColegio = $("btnColegio");
const btnMedia = $("btnMedia");

const btnTiempo = $("btnTiempo");
const btnTarde = $("btnTarde");

const btnCerrarSesion = $("btnCerrarSesion");


/* ============================================================
   FOTO DE RESPALDO
   ============================================================ */

const FOTO_DEFAULT =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="120"
             height="120"
             viewBox="0 0 120 120">

            <rect
                width="120"
                height="120"
                rx="20"
                fill="#eaf1ff"
            />

            <circle
                cx="60"
                cy="42"
                r="22"
                fill="#123b85"
            />

            <path
                d="M25 105
                   C28 79 43 67 60 67
                   C77 67 92 79 95 105
                   Z"
                fill="#123b85"
            />

        </svg>
    `);


/* ============================================================
   SUPABASE
   ============================================================ */

function obtenerCliente() {

    if (window.PUNTUALIXSCAN && window.PUNTUALIXSCAN.client) {
        return window.PUNTUALIXSCAN.client;
    }

    if (window.supabaseClient) {
        return window.supabaseClient;
    }

    if (window.db) {
        return window.db;
    }

    throw new Error(
        "No se encontró el cliente de Supabase."
    );
}


/* ============================================================
   SWEETALERT SEGURO
   ============================================================ */

async function alerta(config) {

    if (
        typeof Swal !== "undefined" &&
        typeof Swal.fire === "function"
    ) {
        return Swal.fire(config);
    }

    alert(
        config.text ||
        config.title ||
        "Operación realizada."
    );
}


/* ============================================================
   MENSAJES
   ============================================================ */

function mostrarMensaje(texto) {

    if (mensajeEstado) {
        mensajeEstado.textContent = texto;
    }
}


/* ============================================================
   ESCAPE HTML
   ============================================================ */

function escapeHTML(valor) {

    if (
        valor === null ||
        valor === undefined
    ) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* ============================================================
   NORMALIZAR TEXTO
   ============================================================ */

function normalizar(valor) {

    return String(valor || "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}


/* ============================================================
   NORMALIZAR ESTADO
   ============================================================ */

function normalizarEstado(valor) {

    const texto = normalizar(valor);

    if (
        texto === "a tiempo" ||
        texto === "atiempo" ||
        texto === "a_tiempo"
    ) {
        return "A tiempo";
    }

    if (
        texto === "tarde"
    ) {
        return "Tarde";
    }

    return "";
}


/* ============================================================
   NORMALIZAR INGRESO
   ============================================================ */

function normalizarIngreso(valor) {

    const texto = normalizar(valor);

    if (texto === "colegio") {
        return "Colegio";
    }

    if (
        texto === "media tecnica" ||
        texto === "media"
    ) {
        return "Media Técnica";
    }

    return "";
}


/* ============================================================
   FOTO SEGURA
   ============================================================ */

function colocarFoto(elemento, url) {

    if (!elemento) {
        return;
    }

    elemento.onerror = function () {

        this.onerror = null;
        this.src = FOTO_DEFAULT;
    };

    const foto =
        url &&
        String(url).trim() !== ""
            ? String(url).trim()
            : FOTO_DEFAULT;

    elemento.src = foto;
}


/* ============================================================
   FECHA DE COLOMBIA
   ============================================================ */

function obtenerFechaColombia() {

    const ahora = new Date();

    const partes =
        new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone: "America/Bogota",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).formatToParts(ahora);

    const año =
        partes.find(
            parte => parte.type === "year"
        )?.value;

    const mes =
        partes.find(
            parte => parte.type === "month"
        )?.value;

    const dia =
        partes.find(
            parte => parte.type === "day"
        )?.value;

    return `${año}-${mes}-${dia}`;
}


/* ============================================================
   HORA DE COLOMBIA
   ============================================================ */

function obtenerHoraColombia() {

    return new Intl.DateTimeFormat(
        "es-CO",
        {
            timeZone: "America/Bogota",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
        }
    ).format(new Date());
}


/* ============================================================
   INICIAR CAMARA
   ============================================================ */

async function iniciarCamara() {

    if (camaraActiva) {
        return;
    }

    if (
        typeof Html5Qrcode ===
        "undefined"
    ) {

        mostrarMensaje(
            "❌ No se pudo cargar el lector QR."
        );

        await alerta({
            icon: "error",
            title: "Lector QR no disponible",
            text:
                "La biblioteca Html5Qrcode no está cargada."
        });

        return;
    }

    try {

        mostrarMensaje(
            "📷 Iniciando cámara..."
        );

        const cameras =
            await Html5Qrcode.getCameras();

        if (
            !cameras ||
            cameras.length === 0
        ) {

            await alerta({
                icon: "error",
                title: "Cámara no encontrada",
                text:
                    "No se encontró ninguna cámara disponible."
            });

            return;
        }

        if (!html5QrCode) {

            html5QrCode =
                new Html5Qrcode("reader");
        }

        if (reader) {
            reader.style.display = "block";
        }

        const cameraId =
            cameras[0].id;

        await html5QrCode.start(

            cameraId,

            {
                fps: 10,

                qrbox: {
                    width: 250,
                    height: 250
                },

                aspectRatio: 1
            },

            async (decodedText) => {

                if (procesandoQR) {
                    return;
                }

                procesandoQR = true;

                try {

                    await buscarEstudiante(
                        decodedText
                    );

                } catch (error) {

                    console.error(
                        "Error procesando QR:",
                        error
                    );

                } finally {

                    procesandoQR = false;
                }
            },

            () => {
                // Errores normales de lectura QR.
            }
        );

        camaraActiva = true;

        if (btnIniciar) {
            btnIniciar.disabled = true;
        }

        if (btnDetener) {
            btnDetener.disabled = false;
        }

        mostrarMensaje(
            "📷 Cámara activa. Escanea el código QR."
        );

    } catch (error) {

        console.error(
            "Error iniciando cámara:",
            error
        );

        camaraActiva = false;

        if (btnIniciar) {
            btnIniciar.disabled = false;
        }

        if (btnDetener) {
            btnDetener.disabled = true;
        }

        await alerta({
            icon: "error",
            title: "No se pudo iniciar la cámara",
            text:
                error?.message ||
                "Verifica los permisos de la cámara."
        });
    }
}


/* ============================================================
   DETENER CAMARA
   ============================================================ */

async function detenerCamara() {

    if (!html5QrCode) {

        camaraActiva = false;

        if (reader) {
            reader.style.display = "none";
        }

        return;
    }

    try {

        if (camaraActiva) {

            await html5QrCode.stop();
        }

    } catch (error) {

        console.warn(
            "Aviso al detener cámara:",
            error
        );

    } finally {

        camaraActiva = false;

        if (reader) {
            reader.style.display = "none";
        }

        if (btnIniciar) {
            btnIniciar.disabled = false;
        }

        if (btnDetener) {
            btnDetener.disabled = true;
        }
    }
}


/* ============================================================
   BUSCAR ESTUDIANTE
   ============================================================ */

async function buscarEstudiante(codigoQR) {

    try {

        await detenerCamara();

        mostrarMensaje(
            "🔎 Buscando estudiante..."
        );

        const client =
            obtenerCliente();

        const codigo =
            String(codigoQR || "")
                .trim();

        if (!codigo) {

            throw new Error(
                "El código QR está vacío."
            );
        }

        /*
           El QR de tu sistema utiliza
           el valor almacenado en codigoqr.
        */

        const resultado =
            await client
                .from("estudiantes")
                .select("*")
                .eq("codigoqr", codigo)
                .limit(1);

        const data =
            resultado.data?.[0];

        const error =
            resultado.error;

        if (error) {

            console.error(
                "Error buscando estudiante:",
                error
            );

            throw error;
        }

        if (!data) {

            estudianteActual = null;

            if (estudianteDiv) {
                estudianteDiv.style.display =
                    "none";
            }

            if (opcionesDiv) {
                opcionesDiv.style.display =
                    "none";
            }

            await alerta({
                icon: "error",
                title: "QR no registrado",
                text:
                    "El código QR no pertenece a ningún estudiante."
            });

            mostrarMensaje(
                "❌ QR no encontrado."
            );

            return;
        }

        /*
           Verificación opcional de estudiante activo.
        */

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "activo"
            ) &&
            data.activo === false
        ) {

            await alerta({
                icon: "warning",
                title: "Estudiante inactivo",
                text:
                    "Este estudiante no está habilitado para registrar asistencia."
            });

            return;
        }

        if (
            Object.prototype.hasOwnProperty.call(
                data,
                "estado"
            )
        ) {

            const estadoBD =
                normalizar(data.estado);

            if (
                estadoBD === "inactivo" ||
                estadoBD === "inactiva"
            ) {

                await alerta({
                    icon: "warning",
                    title: "Estudiante inactivo",
                    text:
                        "Este estudiante no está habilitado para registrar asistencia."
                });

                return;
            }
        }

        estudianteActual = data;

        /*
           Mostrar información.
        */

        if (nombreEstudiante) {

            nombreEstudiante.textContent =
                data.nombre ||
                "Sin nombre";
        }

        if (documentoEstudiante) {

            documentoEstudiante.textContent =
                data.documento ||
                "Sin documento";
        }

        if (cursoEstudiante) {

            cursoEstudiante.textContent =
                data.curso ||
                "Sin curso";
        }

        colocarFoto(
            fotoEstudiante,
            data.foto
        );

        /*
           Reiniciar selección.
        */

        ingresoSeleccionado = "";
        estadoSeleccionado = "";

        quitarSeleccionIngreso();
        quitarSeleccionEstado();

        if (estudianteDiv) {
            estudianteDiv.style.display =
                "block";
        }

        if (opcionesDiv) {
            opcionesDiv.style.display =
                "block";
        }

        mostrarMensaje(
            "✅ Estudiante encontrado. Selecciona el ingreso y el estado."
        );

        await alerta({
            icon: "success",
            title: "Estudiante encontrado",
            html: `
                <strong>
                    ${escapeHTML(
                        data.nombre || ""
                    )}
                </strong>
                <br>
                Curso:
                ${escapeHTML(
                    data.curso || ""
                )}
            `,
            confirmButtonText: "Continuar",
            confirmButtonColor: "#123b85"
        });

    } catch (error) {

        console.error(
            "Error buscando estudiante:",
            error
        );

        await alerta({
            icon: "error",
            title: "Error al buscar",
            text:
                error?.message ||
                "No se pudo consultar el estudiante."
        });
    }
}


async function buscarEstudianteManual() {

    const codigo = String(
        codigoManual?.value ||
        ""
    ).trim();

    if (!codigo) {

        await alerta({
            icon: "warning",
            title: "Código requerido",
            text: "Escribe el código único del estudiante."
        });

        codigoManual?.focus();
        return;

    }

    await buscarEstudiante(codigo);

}


/* ============================================================
   SELECCIONAR INGRESO
   ============================================================ */

function seleccionarIngreso(valor) {

    const ingreso =
        normalizarIngreso(valor);

    if (!ingreso) {
        return;
    }

    ingresoSeleccionado =
        ingreso;

    quitarSeleccionIngreso();

    if (
        ingreso === "Colegio" &&
        btnColegio
    ) {

        btnColegio.classList.add(
            "opcion-activa"
        );

        btnColegio.classList.add(
            "activo"
        );
    }

    if (
        ingreso === "Media Técnica" &&
        btnMedia
    ) {

        btnMedia.classList.add(
            "opcion-activa"
        );

        btnMedia.classList.add(
            "activo"
        );
    }

    actualizarMensajeSeleccion();
}


/* ============================================================
   SELECCIONAR ESTADO
   ============================================================ */

function seleccionarEstado(valor) {

    /*
       ESTA FUNCIÓN ES LA CLAVE.

       NO calcula la hora.
       NO consulta la hora.
       NO cambia A tiempo por Tarde.
       NO modifica el valor seleccionado.

       El usuario decide el estado.
    */

    const estado =
        normalizarEstado(valor);

    if (!estado) {
        return;
    }

    estadoSeleccionado =
        estado;

    quitarSeleccionEstado();

    if (
        estado === "A tiempo" &&
        btnTiempo
    ) {

        btnTiempo.classList.add(
            "opcion-activa"
        );

        btnTiempo.classList.add(
            "activo"
        );

        btnTiempo.setAttribute(
            "aria-pressed",
            "true"
        );
    }

    if (
        estado === "Tarde" &&
        btnTarde
    ) {

        btnTarde.classList.add(
            "opcion-activa"
        );

        btnTarde.classList.add(
            "activo"
        );

        btnTarde.setAttribute(
            "aria-pressed",
            "true"
        );
    }

    actualizarMensajeSeleccion();
}


/* ============================================================
   QUITAR SELECCION DE INGRESO
   ============================================================ */

function quitarSeleccionIngreso() {

    if (btnColegio) {

        btnColegio.classList.remove(
            "opcion-activa"
        );

        btnColegio.classList.remove(
            "activo"
        );

        btnColegio.setAttribute(
            "aria-pressed",
            "false"
        );
    }

    if (btnMedia) {

        btnMedia.classList.remove(
            "opcion-activa"
        );

        btnMedia.classList.remove(
            "activo"
        );

        btnMedia.setAttribute(
            "aria-pressed",
            "false"
        );
    }
}


/* ============================================================
   QUITAR SELECCION DE ESTADO
   ============================================================ */

function quitarSeleccionEstado() {

    if (btnTiempo) {

        btnTiempo.classList.remove(
            "opcion-activa"
        );

        btnTiempo.classList.remove(
            "activo"
        );

        btnTiempo.setAttribute(
            "aria-pressed",
            "false"
        );
    }

    if (btnTarde) {

        btnTarde.classList.remove(
            "opcion-activa"
        );

        btnTarde.classList.remove(
            "activo"
        );

        btnTarde.setAttribute(
            "aria-pressed",
            "false"
        );
    }
}


/* ============================================================
   MENSAJE DE SELECCION
   ============================================================ */

function actualizarMensajeSeleccion() {

    if (
        ingresoSeleccionado &&
        estadoSeleccionado
    ) {

        mostrarMensaje(
            `📋 ${ingresoSeleccionado} · ${estadoSeleccionado}. Listo para registrar.`
        );

        return;
    }

    if (ingresoSeleccionado) {

        mostrarMensaje(
            `🏫 ${ingresoSeleccionado} seleccionado. Ahora selecciona el estado.`
        );

        return;
    }

    if (estadoSeleccionado) {

        mostrarMensaje(
            `📋 ${estadoSeleccionado} seleccionado. Ahora selecciona el tipo de ingreso.`
        );

        return;
    }

    mostrarMensaje(
        "Selecciona el tipo de ingreso y el estado."
    );
}


/* ============================================================
   VERIFICAR DUPLICADO
   ============================================================ */

/*
   Regla:

   Colegio:
   máximo 1 registro por estudiante por día.

   Media Técnica:
   máximo 1 registro por estudiante por día.

   Colegio + Media Técnica:
   permitido el mismo día.

*/

async function verificarDuplicado(
    client,
    estudianteId,
    ingreso,
    fecha
) {

    const resultado =
        await client
            .from("asistencia")
            .select(
                "id, estudiante_id, ingreso, estado, fecha, hora"
            )
            .eq(
                "estudiante_id",
                estudianteId
            )
            .eq(
                "ingreso",
                ingreso
            )
            .eq(
                "fecha",
                fecha
            )
            .limit(1);

    if (resultado.error) {

        console.error(
            "Error verificando duplicado:",
            resultado.error
        );

        throw resultado.error;
    }

    return (
        Array.isArray(resultado.data) &&
        resultado.data.length > 0
    );
}


/* ============================================================
   REGISTRAR ASISTENCIA
   ============================================================ */

async function enviarCorreoAcudiente(estudiante, fecha, hora) {

    const correoAcudiente = String(
        estudiante?.correo_acudiente ||
        estudiante?.acudiente_correo ||
        ""
    ).trim();

    if (!correoAcudiente) {

        console.info(
            "No hay correo del acudiente para enviar notificación."
        );

        return;
    }

    const client = obtenerCliente();

    if (!client?.functions) {

        console.warn(
            "El cliente de Supabase no expone funciones Edge. No se envió correo."
        );

        return;
    }

    try {

        const respuesta = await client.functions.invoke(
            "enviar-correo-acudiente",
            {
                body: {
                    estudiante: estudiante?.nombre || "Estudiante",
                    documento: estudiante?.documento || "",
                    curso: estudiante?.curso || "",
                    correoAcudiente,
                    fecha,
                    hora,
                    ingreso: ingresoSeleccionado || "",
                    estado: estadoSeleccionado || "Tarde"
                }
            }
        );

        if (respuesta?.error) {

            throw respuesta.error;
        }

        console.info(
            "Correo del acudiente enviado correctamente.",
            respuesta?.data
        );

    } catch (error) {

        console.error(
            "No se pudo enviar el correo al acudiente:",
            error
        );

    }
}


async function registrarAsistencia() {

    if (registrando) {
        return;
    }

    /*
       VALIDACIÓN ESTUDIANTE
    */

    if (!estudianteActual) {

        await alerta({
            icon: "warning",
            title: "Primero escanea un estudiante",
            text:
                "Debes escanear un código QR antes de registrar."
        });

        return;
    }

    /*
       VALIDACIÓN INGRESO
    */

    if (
        ingresoSeleccionado !== "Colegio" &&
        ingresoSeleccionado !== "Media Técnica"
    ) {

        await alerta({
            icon: "warning",
            title: "Selecciona el tipo de ingreso",
            text:
                "Selecciona Colegio o Media Técnica."
        });

        return;
    }

    /*
       VALIDACIÓN ESTADO
    */

    if (
        estadoSeleccionado !== "A tiempo" &&
        estadoSeleccionado !== "Tarde"
    ) {

        await alerta({
            icon: "warning",
            title: "Selecciona el estado",
            text:
                "Selecciona A tiempo o Tarde."
        });

        return;
    }

    /*
       BLOQUEAR BOTÓN
    */

    registrando = true;

    if (btnRegistrar) {
        btnRegistrar.disabled = true;
    }

    try {

        mostrarMensaje(
            "⏳ Verificando registro..."
        );

        const client =
            obtenerCliente();

        /*
           FECHA Y HORA COLOMBIA
        */

        const fecha =
            obtenerFechaColombia();

        const hora =
            obtenerHoraColombia();

        /*
           VERIFICAR DUPLICADO

           IMPORTANTE:
           Se comprueba por:

           estudiante
           +
           ingreso
           +
           fecha

           NO por estado.

           Así se permite cambiar el estado
           solamente si todavía no existe registro.
        */

        const duplicado =
            await verificarDuplicado(
                client,
                estudianteActual.id,
                ingresoSeleccionado,
                fecha
            );

        if (duplicado) {

            await alerta({
                icon: "info",
                title: "Ingreso ya registrado",
                html: `
                    <strong>
                        ${escapeHTML(
                            estudianteActual.nombre ||
                            ""
                        )}
                    </strong>

                    <br><br>

                    Este estudiante ya tiene registrado
                    el ingreso de

                    <strong>
                        ${escapeHTML(
                            ingresoSeleccionado
                        )}
                    </strong>

                    para el día de hoy.
                `,
                confirmButtonText: "Entendido",
                confirmButtonColor: "#123b85"
            });

            return;
        }

        /*
           REGISTRO FINAL

           estadoSeleccionado se guarda
           EXACTAMENTE como fue seleccionado.
        */

        const registro = {

            estudiante_id:
                estudianteActual.id,

            nombre:
                estudianteActual.nombre ||
                "",

            documento:
                estudianteActual.documento ||
                "",

            curso:
                estudianteActual.curso ||
                "",

            ingreso:
                ingresoSeleccionado,

            estado:
                estadoSeleccionado,

            fecha:
                fecha,

            hora:
                hora,

            fecha_hora:
                new Date().toISOString()
        };

        console.log(
            "===================================="
        );

        console.log(
            "REGISTRO QUE SE ENVIARÁ:"
        );

        console.table(
            registro
        );

        console.log(
            "===================================="
        );

        /*
           INSERTAR EN SUPABASE
        */

        const resultado =
            await client
                .from("asistencia")
                .insert([
                    registro
                ])
                .select()
                .single();

        const data =
            resultado.data;

        const error =
            resultado.error;

        if (error) {

            console.error(
                "Error insertando asistencia:",
                error
            );

            /*
               Error de restricción UNIQUE.
            */

            if (
                error.code === "23505"
            ) {

                await alerta({
                    icon: "info",
                    title: "Registro duplicado",
                    text:
                        "Este estudiante ya tiene registrado ese ingreso para hoy."
                });

                return;
            }

            throw error;
        }

        /*
           VERIFICACIÓN CRÍTICA

           Confirmamos que Supabase
           guardó el estado correcto.
        */

        if (
            data &&
            data.estado &&
            normalizarEstado(data.estado) !==
            estadoSeleccionado
        ) {

            console.error(
                "Supabase modificó el estado.",
                {
                    enviado:
                        estadoSeleccionado,

                    guardado:
                        data.estado
                }
            );

            await alerta({
                icon: "error",
                title: "El estado fue modificado",
                text:
                    `El sistema envió "${estadoSeleccionado}", pero la base de datos guardó "${data.estado}". Revisa las reglas, valores predeterminados o triggers de la tabla asistencia.`
            });

            return;
        }

        if (
            estadoSeleccionado === "Tarde"
        ) {

            await enviarCorreoAcudiente(
                estudianteActual,
                fecha,
                hora
            );

        }

        /*
           ÉXITO
        */

        await alerta({

            icon: "success",

            title:
                "Asistencia registrada",

            html: `
                <div style="text-align:left">

                    <strong>
                        ${escapeHTML(
                            estudianteActual.nombre
                        )}
                    </strong>

                    <br>

                    Curso:
                    ${escapeHTML(
                        estudianteActual.curso
                    )}

                    <br><br>

                    Ingreso:
                    <strong>
                        ${escapeHTML(
                            ingresoSeleccionado
                        )}
                    </strong>

                    <br>

                    Estado:
                    <strong>
                        ${escapeHTML(
                            estadoSeleccionado
                        )}
                    </strong>

                    <br>

                    Fecha:
                    <strong>
                        ${escapeHTML(
                            fecha
                        )}
                    </strong>

                    <br>

                    Hora:
                    <strong>
                        ${escapeHTML(
                            hora
                        )}
                    </strong>

                </div>
            `,

            confirmButtonText:
                "Aceptar",

            confirmButtonColor:
                "#123b85"
        });

        /*
           LIMPIAR Y PREPARAR
           PARA EL SIGUIENTE ESTUDIANTE.
        */

        await limpiarScanner();

    } catch (error) {

        console.error(
            "Error registrando asistencia:",
            error
        );

        let mensaje =
            error?.message ||
            "Ocurrió un error al guardar la asistencia.";

        /*
           Mensajes más amigables
        */

        if (
            error?.code === "23505"
        ) {

            mensaje =
                "Este estudiante ya tiene registrado ese ingreso para hoy.";
        }

        if (
            error?.code === "42501"
        ) {

            mensaje =
                "Supabase bloqueó el registro por las políticas de seguridad RLS.";
        }

        await alerta({

            icon: "error",

            title:
                "No se pudo registrar",

            text:
                mensaje
        });

    } finally {

        registrando = false;

        if (btnRegistrar) {
            btnRegistrar.disabled = false;
        }
    }
}


/* ============================================================
   LIMPIAR SCANNER
   ============================================================ */

async function limpiarScanner() {

    estudianteActual = null;

    ingresoSeleccionado = "";
    estadoSeleccionado = "";

    quitarSeleccionIngreso();
    quitarSeleccionEstado();

    if (estudianteDiv) {
        estudianteDiv.style.display =
            "none";
    }

    if (opcionesDiv) {
        opcionesDiv.style.display =
            "none";
    }

    colocarFoto(
        fotoEstudiante,
        ""
    );

    if (nombreEstudiante) {
        nombreEstudiante.textContent =
            "";
    }

    if (documentoEstudiante) {
        documentoEstudiante.textContent =
            "";
    }

    if (cursoEstudiante) {
        cursoEstudiante.textContent =
            "";
    }

    mostrarMensaje(
        "📷 Preparando cámara..."
    );

    /*
       Reiniciar cámara.
    */

    try {

        await iniciarCamara();

    } catch (error) {

        console.warn(
            "No se pudo reiniciar automáticamente la cámara:",
            error
        );

        mostrarMensaje(
            "📷 Presiona «Iniciar cámara» para continuar."
        );
    }
}


/* ============================================================
   CERRAR SESION
   ============================================================ */

async function cerrarSesion() {

    try {

        const client =
            obtenerCliente();

        if (
            client.auth &&
            typeof client.auth.signOut ===
            "function"
        ) {

            await client.auth.signOut();
        }

        localStorage.removeItem(
            "usuario"
        );

        window.location.href =
            "login.html";

    } catch (error) {

        console.error(
            "Error cerrando sesión:",
            error
        );

        await alerta({
            icon: "error",
            title: "Error",
            text:
                "No se pudo cerrar la sesión."
        });
    }
}


/* ============================================================
   EVENTOS
   ============================================================ */

function registrarEventos() {

    if (eventosRegistrados) {
        return;
    }

    eventosRegistrados = true;

    /*
       INICIAR CÁMARA
    */

    if (btnIniciar) {

        btnIniciar.addEventListener(
            "click",
            iniciarCamara
        );
    }

    /*
       DETENER CÁMARA
    */

    if (btnDetener) {

        btnDetener.addEventListener(
            "click",
            detenerCamara
        );
    }

    if (btnBuscarCodigo) {

        btnBuscarCodigo.addEventListener(
            "click",
            buscarEstudianteManual
        );
    }

    if (codigoManual) {

        codigoManual.addEventListener(
            "keydown",
            (event) => {

                if (event.key === "Enter") {

                    event.preventDefault();
                    buscarEstudianteManual();
                }
            }
        );
    }

    /*
       REGISTRAR ASISTENCIA
    */

    if (btnRegistrar) {

        btnRegistrar.addEventListener(
            "click",
            registrarAsistencia
        );
    }

    /*
       COLEGIO
    */

    if (btnColegio) {

        btnColegio.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                seleccionarIngreso(
                    "Colegio"
                );
            }
        );
    }

    /*
       MEDIA TECNICA
    */

    if (btnMedia) {

        btnMedia.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                seleccionarIngreso(
                    "Media Técnica"
                );
            }
        );
    }

    /*
       A TIEMPO

       MUY IMPORTANTE:
       El botón manda directamente
       "A tiempo".
    */

    if (btnTiempo) {

        btnTiempo.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                seleccionarEstado(
                    "A tiempo"
                );
            }
        );
    }

    /*
       TARDE
    */

    if (btnTarde) {

        btnTarde.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                seleccionarEstado(
                    "Tarde"
                );
            }
        );
    }

    /*
       CERRAR SESIÓN
    */

    if (btnCerrarSesion) {

        btnCerrarSesion.addEventListener(
            "click",
            function (event) {

                event.preventDefault();

                cerrarSesion();
            }
        );
    }
}


/* ============================================================
   COMPATIBILIDAD CON HTML
   ============================================================ */

window.seleccionarIngreso =
    seleccionarIngreso;

window.seleccionarEstado =
    seleccionarEstado;

window.iniciarCamara =
    iniciarCamara;

window.detenerCamara =
    detenerCamara;

window.registrarAsistencia =
    registrarAsistencia;

window.limpiarScanner =
    limpiarScanner;

window.cerrarSesion =
    cerrarSesion;


/* ============================================================
   INICIALIZACION
   ============================================================ */

function inicializarScanner() {

    registrarEventos();

    if (btnDetener) {
        btnDetener.disabled = true;
    }

    if (btnRegistrar) {
        btnRegistrar.disabled = false;
    }

    if (estudianteDiv) {
        estudianteDiv.style.display =
            "none";
    }

    if (opcionesDiv) {
        opcionesDiv.style.display =
            "none";
    }

    colocarFoto(
        fotoEstudiante,
        ""
    );

    mostrarMensaje(
        "📷 Presiona «Iniciar cámara» para comenzar."
    );

    console.log(
        "PUNTUALIXSCAN SCANNER: módulo iniciado correctamente."
    );
}


/* ============================================================
   DOM READY
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        inicializarScanner,
        {
            once: true
        }
    );

} else {

    inicializarScanner();
}