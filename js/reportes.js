/* =========================================================
   EDUACCESS ENTERPRISE
   REPORTES DE ASISTENCIA
   ========================================================= */

"use strict";


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const PAGE_SIZE = 10;


/* =========================================================
   FOTO PREDETERMINADA
========================================================= */

const FOTO_DEFAULT =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="80"
             height="80"
             viewBox="0 0 80 80">

            <rect
                width="80"
                height="80"
                fill="#e8eef5"
            />

            <circle
                cx="40"
                cy="29"
                r="15"
                fill="#8aa0b5"
            />

            <path
                d="M14 72c3-17 13-26 26-26s23 9 26 26"
                fill="#8aa0b5"
            />

        </svg>
    `);


/* =========================================================
   ESTADO
========================================================= */

const state = {

    registros: [],

    pagina: 1,

    charts: {},

    inicializado: false,

    cargando: false

};


/* =========================================================
   SELECTOR
========================================================= */

const $ = (id) =>
    document.getElementById(id);


/* =========================================================
   CLIENTE SUPABASE
========================================================= */

function obtenerCliente() {

    if (window.EDUQR?.client) {

        return window.EDUQR.client;

    }


    if (window.EDUQR?.db) {

        return window.EDUQR.db;

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


/* =========================================================
   INICIO
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    iniciarReportes
);


async function iniciarReportes() {

    if (state.inicializado) {

        return;

    }


    state.inicializado = true;


    try {

        configurarEventos();


        await protegerPagina();


        await cargarReportes();


    } catch (error) {

        console.error(
            "Error iniciando reportes:",
            error
        );


        notificarError(
            "No se pudo iniciar el módulo de reportes."
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
            typeof window.EDUQR.protegerPagina === "function"
        ) {

            const permitido =
                await window.EDUQR.protegerPagina({
                    redirectTo: "login.html"
                });


            if (
                permitido === false
            ) {

                return false;

            }


            return true;

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


        if (!data?.session) {

            const usuario =
                localStorage.getItem("usuario");


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


        throw error;

    }

}


/* =========================================================
   EVENTOS
========================================================= */

function configurarEventos() {


    $("btnActualizar")?.addEventListener(
        "click",
        cargarReportes
    );


    $("buscar")?.addEventListener(
        "input",
        aplicarFiltros
    );


    $("filtroCurso")?.addEventListener(
        "change",
        aplicarFiltros
    );


    $("filtroFecha")?.addEventListener(
        "change",
        aplicarFiltros
    );


    $("filtroEstado")?.addEventListener(
        "change",
        aplicarFiltros
    );


    $("filtroIngreso")?.addEventListener(
        "change",
        aplicarFiltros
    );


    $("btnAnterior")?.addEventListener(
        "click",
        () => cambiarPagina(-1)
    );


    $("btnSiguiente")?.addEventListener(
        "click",
        () => cambiarPagina(1)
    );


    $("btnExportarExcel")?.addEventListener(
        "click",
        exportarExcel
    );


    $("btnExportarPDF")?.addEventListener(
        "click",
        exportarPDF
    );


    $("btnImprimir")?.addEventListener(
        "click",
        () => window.print()
    );


    $("btnCerrarSesion")?.addEventListener(
        "click",
        cerrarSesion
    );

}


/* =========================================================
   CARGAR REPORTES
========================================================= */

async function cargarReportes() {


    if (state.cargando) {

        return;

    }


    state.cargando = true;


    const btnActualizar =
        $("btnActualizar");


    try {

        mostrarEstadoTabla(
            "Cargando reportes..."
        );


        if (btnActualizar) {

            btnActualizar.disabled =
                true;

        }


        const client =
            obtenerCliente();


        const {
            data,
            error
        } =

            await client

                .from("asistencia")

                .select(
                    "*, estudiantes(foto)"
                )

                .order(
                    "fecha_hora",
                    {
                        ascending:false
                    }
                );


        if (error) {

            throw error;

        }


        state.registros =
            Array.isArray(data)
                ? data.map(normalizarRegistro)
                : [];


        actualizarCursos();


        state.pagina =
            1;


        renderizar();


    } catch (error) {

        console.error(
            "Error cargando reportes:",
            error
        );


        state.registros = [];

        state.pagina = 1;


        destruirGraficas();


        actualizarTarjetas([]);


        mostrarTabla([]);


        notificarError(
            obtenerMensajeError(
                error,
                "No fue posible cargar los reportes."
            )
        );


    } finally {

        state.cargando = false;


        if (btnActualizar) {

            btnActualizar.disabled =
                false;

        }

    }

}


/* =========================================================
   NORMALIZAR REGISTRO
========================================================= */

function normalizarRegistro(registro) {

    return {

        id:
            registro.id,

        nombre:
            registro.nombre ||
            registro.estudiantes?.nombre ||
            "",

        documento:
            registro.documento ||
            registro.estudiantes?.documento ||
            "",

        curso:
            registro.curso ||
            registro.estudiantes?.curso ||
            "",

        foto:
            registro.foto ||
            registro.estudiantes?.foto ||
            "",

        estado:
            registro.estado ||
            "",

        ingreso:
            registro.ingreso ||
            "",

        fecha:
            registro.fecha ||
            obtenerFechaDesdeFechaHora(
                registro.fecha_hora
            ),

        hora:
            registro.hora ||
            obtenerHoraDesdeFechaHora(
                registro.fecha_hora
            ),

        fecha_hora:
            registro.fecha_hora ||
            ""

    };

}


/* =========================================================
   FILTROS
========================================================= */

function aplicarFiltros() {

    state.pagina = 1;

    renderizar();

}


/* =========================================================
   OBTENER FILTRADOS
========================================================= */

function obtenerFiltrados() {


    const texto =
        normalizar(
            $("buscar")?.value || ""
        );


    const curso =
        $("filtroCurso")?.value || "";


    const fecha =
        $("filtroFecha")?.value || "";


    const estado =
        normalizar(
            $("filtroEstado")?.value || ""
        );


    const ingreso =
        normalizar(
            $("filtroIngreso")?.value || ""
        );


    return state.registros.filter(
        registro => {


            const nombre =
                normalizar(
                    registro.nombre
                );


            const documento =
                normalizar(
                    registro.documento
                );


            const coincideTexto =

                !texto ||

                nombre.includes(texto) ||

                documento.includes(texto);


            const coincideCurso =

                !curso ||

                String(
                    registro.curso || ""
                ) === curso;


            const coincideFecha =

                !fecha ||

                obtenerFecha(
                    registro
                ) === fecha;


            const coincideEstado =

                !estado ||

                normalizar(
                    registro.estado
                ) === estado;


            const coincideIngreso =

                !ingreso ||

                normalizar(
                    registro.ingreso
                ) === ingreso;


            return (

                coincideTexto &&

                coincideCurso &&

                coincideFecha &&

                coincideEstado &&

                coincideIngreso

            );

        }
    );

}


/* =========================================================
   RENDER
========================================================= */

function renderizar() {


    const registros =
        obtenerFiltrados();


    actualizarTarjetas(
        registros
    );


    actualizarGraficas(
        registros
    );


    mostrarTabla(
        registros
    );

}


/* =========================================================
   CURSOS
========================================================= */

function actualizarCursos() {


    const select =
        $("filtroCurso");


    if (!select) {

        return;

    }


    const seleccionado =
        select.value;


    const cursos = [

        ...new Set(

            state.registros

                .map(
                    registro =>
                        String(
                            registro.curso || ""
                        ).trim()
                )

                .filter(Boolean)

        )

    ].sort(
        (a,b) =>
            a.localeCompare(
                b,
                "es"
            )
    );


    select.innerHTML =
        "";


    select.add(
        new Option(
            "Todos los cursos",
            ""
        )
    );


    cursos.forEach(
        curso => {

            select.add(
                new Option(
                    curso,
                    curso
                )
            );

        }
    );


    if (
        cursos.includes(
            seleccionado
        )
    ) {

        select.value =
            seleccionado;

    }

}


/* =========================================================
   TARJETAS
========================================================= */

function actualizarTarjetas(
    registros
) {


    ponerTexto(
        "totalAsistencias",
        registros.length
    );


    ponerTexto(
        "totalATiempo",
        contar(
            registros,
            registro =>
                normalizar(
                    registro.estado
                ) ===
                "a tiempo"
        )
    );


    ponerTexto(
        "totalTarde",
        contar(
            registros,
            registro =>
                normalizar(
                    registro.estado
                ) ===
                "tarde"
        )
    );


    ponerTexto(
        "totalColegio",
        contar(
            registros,
            registro =>
                normalizar(
                    registro.ingreso
                ) ===
                "colegio"
        )
    );


    ponerTexto(
        "totalMedia",
        contar(
            registros,
            registro =>
                normalizar(
                    registro.ingreso
                ) ===
                "media tecnica"
        )
    );

}


/* =========================================================
   TABLA
========================================================= */

function mostrarTabla(
    registros
) {


    const tbody =
        $("tablaReportes");


    if (!tbody) {

        return;

    }


    const total =
        registros.length;


    const totalPaginas =
        Math.max(
            1,
            Math.ceil(
                total /
                PAGE_SIZE
            )
        );


    state.pagina =
        Math.min(
            Math.max(
                state.pagina,
                1
            ),
            totalPaginas
        );


    const inicio =
        (
            state.pagina - 1
        ) *
        PAGE_SIZE;


    const pagina =
        registros.slice(
            inicio,
            inicio + PAGE_SIZE
        );


    tbody.innerHTML =
        "";


    if (!pagina.length) {

        mostrarEstadoTabla(
            "No hay registros para los filtros seleccionados."
        );

    } else {

        const fragment =
            document.createDocumentFragment();


        pagina.forEach(
            registro => {

                fragment.appendChild(
                    crearFila(
                        registro
                    )
                );

            }
        );


        tbody.appendChild(
            fragment
        );

    }


    ponerTexto(
        "inicioPagina",
        total
            ? inicio + 1
            : 0
    );


    ponerTexto(
        "finPagina",
        inicio +
        pagina.length
    );


    ponerTexto(
        "totalPagina",
        total
    );


    const anterior =
        $("btnAnterior");


    const siguiente =
        $("btnSiguiente");


    if (anterior) {

        anterior.disabled =
            state.pagina <= 1;

    }


    if (siguiente) {

        siguiente.disabled =
            state.pagina >=
            totalPaginas;

    }

}


/* =========================================================
   CREAR FILA
========================================================= */

function crearFila(
    registro
) {


    const fila =
        document.createElement(
            "tr"
        );


    /* FOTO */

    const celdaFoto =
        document.createElement(
            "td"
        );


    const imagen =
        document.createElement(
            "img"
        );


    imagen.className =
        "report-photo";


    imagen.width =
        42;


    imagen.height =
        42;


    imagen.alt =
        "Foto del estudiante";


    imagen.onerror =
        function () {

            this.onerror =
                null;

            this.src =
                FOTO_DEFAULT;

        };


    imagen.src =
        registro.foto ||
        FOTO_DEFAULT;


    celdaFoto.appendChild(
        imagen
    );


    fila.appendChild(
        celdaFoto
    );


    /* NOMBRE */

    const nombre =
        document.createElement(
            "td"
        );


    nombre.innerHTML =
        `<span class="report-name">${
            escaparHTML(
                registro.nombre ||
                "Sin nombre"
            )
        }</span>`;


    fila.appendChild(
        nombre
    );


    /* DOCUMENTO */

    const documento =
        document.createElement(
            "td"
        );


    documento.textContent =
        registro.documento ||
        "—";


    fila.appendChild(
        documento
    );


    /* CURSO */

    const curso =
        document.createElement(
            "td"
        );


    curso.textContent =
        registro.curso ||
        "—";


    fila.appendChild(
        curso
    );


    /* FECHA */

    const fecha =
        document.createElement(
            "td"
        );


    fecha.textContent =
        obtenerFechaFormateada(
            registro
        );


    fila.appendChild(
        fecha
    );


    /* HORA */

    const hora =
        document.createElement(
            "td"
        );


    hora.textContent =
        obtenerHora(
            registro
        );


    fila.appendChild(
        hora
    );


    /* ESTADO */

    const estadoCelda =
        document.createElement(
            "td"
        );


    const estadoBadge =
        document.createElement(
            "span"
        );


    const estado =
        registro.estado ||
        "—";


    estadoBadge.className =

        normalizar(
            estado
        ) ===
        "a tiempo"

            ? "report-badge success"

            : "report-badge warning";


    estadoBadge.textContent =
        estado;


    estadoCelda.appendChild(
        estadoBadge
    );


    fila.appendChild(
        estadoCelda
    );


    /* INGRESO */

    const ingresoCelda =
        document.createElement(
            "td"
        );


    const ingresoBadge =
        document.createElement(
            "span"
        );


    ingresoBadge.className =
        "report-badge blue";


    ingresoBadge.textContent =
        registro.ingreso ||
        "—";


    ingresoCelda.appendChild(
        ingresoBadge
    );


    fila.appendChild(
        ingresoCelda
    );


    return fila;

}


/* =========================================================
   PAGINACIÓN
========================================================= */

function cambiarPagina(
    delta
) {


    const total =
        obtenerFiltrados().length;


    const totalPaginas =
        Math.max(
            1,
            Math.ceil(
                total /
                PAGE_SIZE
            )
        );


    const nuevaPagina =
        state.pagina +
        delta;


    if (
        nuevaPagina < 1 ||
        nuevaPagina > totalPaginas
    ) {

        return;

    }


    state.pagina =
        nuevaPagina;


    mostrarTabla(
        obtenerFiltrados()
    );

}


/* =========================================================
   GRÁFICAS
========================================================= */

function actualizarGraficas(
    registros
) {


    const porCurso =
        agrupar(
            registros,
            registro =>
                registro.curso ||
                "Sin curso"
        );


    crearGrafica(

        "graficaCursos",

        "bar",

        Object.keys(
            porCurso
        ),

        Object.values(
            porCurso
        ),

        "#185cff",

        "Asistencias"

    );


    crearGrafica(

        "graficaEstado",

        "doughnut",

        [
            "A tiempo",
            "Tarde"
        ],

        [

            contar(
                registros,
                registro =>
                    normalizar(
                        registro.estado
                    ) ===
                    "a tiempo"
            ),

            contar(
                registros,
                registro =>
                    normalizar(
                        registro.estado
                    ) ===
                    "tarde"
            )

        ],

        [
            "#159570",
            "#d99118"
        ],

        "Registros"

    );


    crearGrafica(

        "graficaIngreso",

        "doughnut",

        [
            "Colegio",
            "Media Técnica"
        ],

        [

            contar(
                registros,
                registro =>
                    normalizar(
                        registro.ingreso
                    ) ===
                    "colegio"
            ),

            contar(
                registros,
                registro =>
                    normalizar(
                        registro.ingreso
                    ) ===
                    "media tecnica"
            )

        ],

        [
            "#185cff",
            "#7157c9"
        ],

        "Registros"

    );

}


/* =========================================================
   CREAR GRÁFICA
========================================================= */

function crearGrafica(

    id,

    tipo,

    etiquetas,

    datos,

    color,

    etiqueta

) {


    if (
        typeof Chart ===
        "undefined"
    ) {

        return;

    }


    const canvas =
        $(id);


    if (!canvas) {

        return;

    }


    if (
        state.charts[id]
    ) {

        state.charts[id].destroy();

        state.charts[id] =
            null;

    }


    state.charts[id] =
        new Chart(
            canvas,
            {

                type: tipo,


                data: {

                    labels:
                        etiquetas,

                    datasets: [

                        {

                            label:
                                etiqueta,

                            data:
                                datos,

                            backgroundColor:
                                color,

                            borderWidth:
                                0,

                            borderRadius:
                                tipo ===
                                "bar"
                                    ? 7
                                    : 0

                        }

                    ]

                },


                options: {

                    responsive:true,

                    maintainAspectRatio:false,

                    animation:false,


                    plugins: {

                        legend: {

                            display:
                                tipo !==
                                "bar",

                            position:
                                "bottom"

                        }

                    },


                    scales:

                        tipo === "bar"

                            ? {

                                y: {

                                    beginAtZero:true,

                                    ticks: {

                                        precision:0

                                    },

                                    grid: {

                                        color:
                                            "#eef2f8"

                                    }

                                },


                                x: {

                                    grid: {

                                        display:false

                                    }

                                }

                            }

                            : {}

                }

            }
        );

}


/* =========================================================
   DESTRUIR GRÁFICAS
========================================================= */

function destruirGraficas() {


    Object.keys(
        state.charts
    ).forEach(
        id => {

            if (
                state.charts[id]
            ) {

                state.charts[id].destroy();

                state.charts[id] =
                    null;

            }

        }
    );

}


/* =========================================================
   EXPORTAR EXCEL
========================================================= */

function exportarExcel() {


    const registros =
        obtenerFiltrados();


    if (
        !registros.length
    ) {

        notificarAviso(
            "No hay registros para exportar."
        );

        return;

    }


    if (
        typeof XLSX ===
        "undefined"
    ) {

        notificarError(
            "No se pudo cargar el generador de Excel."
        );

        return;

    }


    const datos =
        registros.map(
            registro => ({

                Nombre:
                    registro.nombre,

                Documento:
                    registro.documento,

                Curso:
                    registro.curso,

                Fecha:
                    obtenerFechaFormateada(
                        registro
                    ),

                Hora:
                    obtenerHora(
                        registro
                    ),

                Estado:
                    registro.estado,

                Ingreso:
                    registro.ingreso

            })
        );


    const hoja =
        XLSX.utils.json_to_sheet(
            datos
        );


    hoja["!cols"] = [

        { wch:28 },

        { wch:16 },

        { wch:15 },

        { wch:14 },

        { wch:12 },

        { wch:14 },

        { wch:18 }

    ];


    const libro =
        XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Asistencias"
    );


    XLSX.writeFile(
        libro,
        "Reporte_Asistencia_EduAccess.xlsx"
    );

}


/* =========================================================
   EXPORTAR PDF
========================================================= */

function exportarPDF() {


    const registros =
        obtenerFiltrados();


    if (
        !registros.length
    ) {

        notificarAviso(
            "No hay registros para exportar."
        );

        return;

    }


    if (
        !window.jspdf?.jsPDF
    ) {

        notificarError(
            "No se pudo cargar el generador PDF."
        );

        return;

    }


    const {
        jsPDF
    } =
        window.jspdf;


    const pdf =
        new jsPDF({

            orientation:
                "landscape",

            unit:
                "mm",

            format:
                "a4"

        });


    pdf.setFontSize(18);


    pdf.text(
        "EduAccess Enterprise",
        14,
        15
    );


    pdf.setFontSize(11);


    pdf.text(
        "Reporte institucional de asistencia",
        14,
        22
    );


    pdf.setFontSize(8);


    pdf.text(
        `Generado: ${new Date().toLocaleString("es-CO")}`,
        14,
        28
    );


    const filas =
        registros.map(
            registro => [

                registro.nombre ||
                    "—",

                registro.documento ||
                    "—",

                registro.curso ||
                    "—",

                obtenerFechaFormateada(
                    registro
                ),

                obtenerHora(
                    registro
                ),

                registro.estado ||
                    "—",

                registro.ingreso ||
                    "—"

            ]
        );


    if (
        typeof pdf.autoTable ===
        "function"
    ) {

        pdf.autoTable({

            startY:34,

            head:[

                [
                    "Nombre",
                    "Documento",
                    "Curso",
                    "Fecha",
                    "Hora",
                    "Estado",
                    "Ingreso"
                ]

            ],

            body:filas,

            styles: {

                fontSize:7,

                cellPadding:3

            },

            headStyles: {

                fillColor:[
                    18,
                    59,
                    133
                ]

            },

            alternateRowStyles: {

                fillColor:[
                    248,
                    250,
                    252
                ]

            }

        });

    } else {

        let y = 38;


        filas.forEach(
            fila => {

                pdf.text(
                    fila.join(" | "),
                    10,
                    y
                );

                y += 6;


                if (
                    y > 190
                ) {

                    pdf.addPage();

                    y = 15;

                }

            }
        );

    }


    pdf.save(
        "Reporte_Asistencia_EduAccess.pdf"
    );

}


/* =========================================================
   CERRAR SESIÓN
========================================================= */

async function cerrarSesion(
    evento
) {


    if (evento) {

        evento.preventDefault();

    }


    const confirmar =
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
                "Cancelar"

        });


    if (
        !confirmar.isConfirmed
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


    window.location.replace(
        "login.html"
    );

}


/* =========================================================
   FECHA
========================================================= */

function obtenerFecha(
    registro
) {

    return (

        registro.fecha ||

        String(
            registro.fecha_hora ||
            ""
        ).slice(
            0,
            10
        )

    );

}


/* =========================================================
   HORA
========================================================= */

function obtenerHora(
    registro
) {


    if (
        registro.hora
    ) {

        return registro.hora;

    }


    return obtenerHoraDesdeFechaHora(
        registro.fecha_hora
    );

}


/* =========================================================
   FECHA DESDE FECHA_HORA
========================================================= */

function obtenerFechaDesdeFechaHora(
    fechaHora
) {

    if (!fechaHora) {

        return "";

    }


    return String(
        fechaHora
    ).slice(
        0,
        10
    );

}


/* =========================================================
   HORA DESDE FECHA_HORA
========================================================= */

function obtenerHoraDesdeFechaHora(
    fechaHora
) {


    if (!fechaHora) {

        return "—";

    }


    try {

        return new Date(
            fechaHora
        ).toLocaleTimeString(
            "es-CO",
            {

                hour:
                    "2-digit",

                minute:
                    "2-digit"

            }
        );

    } catch (_) {

        return "—";

    }

}


/* =========================================================
   FECHA FORMATEADA
========================================================= */

function obtenerFechaFormateada(
    registro
) {


    const fecha =
        obtenerFecha(
            registro
        );


    if (!fecha) {

        return "—";

    }


    try {

        return new Date(
            `${fecha}T00:00:00`
        ).toLocaleDateString(
            "es-CO"
        );

    } catch (_) {

        return fecha;

    }

}


/* =========================================================
   NORMALIZAR
========================================================= */

function normalizar(
    valor
) {

    return String(
        valor || ""
    )

        .normalize("NFD")

        .replace(
            /[\u0300-\u036f]/g,
            ""
        )

        .trim()

        .toLowerCase();

}


/* =========================================================
   CONTAR
========================================================= */

function contar(
    lista,
    condicion
) {

    return lista.filter(
        condicion
    ).length;

}


/* =========================================================
   AGRUPAR
========================================================= */

function agrupar(
    lista,
    clave
) {


    return lista.reduce(

        (
            resultado,
            item
        ) => {

            const llave =
                clave(item);


            resultado[llave] =
                (
                    resultado[llave] ||
                    0
                ) + 1;


            return resultado;

        },

        {}

    );

}


/* =========================================================
   PONER TEXTO
========================================================= */

function ponerTexto(
    id,
    valor
) {


    const elemento =
        $(id);


    if (elemento) {

        elemento.textContent =
            valor;

    }

}


/* =========================================================
   ESTADO DE TABLA
========================================================= */

function mostrarEstadoTabla(
    mensaje
) {


    const tabla =
        $("tablaReportes");


    if (!tabla) {

        return;

    }


    tabla.innerHTML = `

        <tr>

            <td
                colspan="8"
                class="report-empty"
            >

                <i class="fa-solid fa-chart-column"></i>

                ${escaparHTML(mensaje)}

            </td>

        </tr>

    `;

}


/* =========================================================
   ESCAPAR HTML
========================================================= */

function escaparHTML(
    valor
) {

    return String(
        valor ?? ""
    )

        .replace(
            /&/g,
            "&amp;"
        )

        .replace(
            /</g,
            "&lt;"
        )

        .replace(
            />/g,
            "&gt;"
        )

        .replace(
            /"/g,
            "&quot;"
        )

        .replace(
            /'/g,
            "&#039;"
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
            "por las políticas de seguridad RLS."
        );

    }


    return mensaje;

}


/* =========================================================
   NOTIFICAR ERROR
========================================================= */

function notificarError(
    mensaje
) {


    if (window.Swal) {

        Swal.fire({

            icon:
                "error",

            title:
                "No se pudo completar",

            text:
                mensaje,

            confirmButtonColor:
                "#123b85"

        });


        return;

    }


    console.error(
        mensaje
    );

}


/* =========================================================
   NOTIFICAR AVISO
========================================================= */

function notificarAviso(
    mensaje
) {


    if (window.Swal) {

        Swal.fire({

            icon:
                "info",

            title:
                "Sin datos",

            text:
                mensaje,

            confirmButtonColor:
                "#123b85"

        });


        return;

    }


    console.info(
        mensaje
    );

}


/* =========================================================
   API GLOBAL
========================================================= */

window.EduAccessReportes = {

    actualizar:
        cargarReportes,

    filtrar:
        aplicarFiltros,

    exportarExcel,

    exportarPDF

};