// ============================================================
// PUNTUALIXSCAN ENTERPRISE
// DASHBOARD PROFESIONAL
// VERSION CORREGIDA
// ============================================================

"use strict";

(function () {

    // ========================================================
    // VARIABLES
    // ========================================================

    const db =
        window.EDUQR?.client ||
        window.supabaseClient ||
        window.db;

    const charts = {};

    let refreshTimer = null;
    let clockTimer = null;

    let actualizando = false;
    let inicializado = false;

    const $ = id =>
        document.getElementById(id);


    // ========================================================
    // VALIDAR SUPABASE
    // ========================================================

    if (!db) {

        console.error(
            "Puntualixscan: no se encontró el cliente de Supabase."
        );

        return;
    }


    // ========================================================
    // UTILIDADES
    // ========================================================

    function escapeHTML(valor) {

        if (
            valor === null ||
            valor === undefined
        ) {
            return "";
        }

        if (
            window.EDUQR?.utils?.escape
        ) {

            return window.EDUQR.utils.escape(
                valor
            );
        }

        return String(valor)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    function normalizar(valor) {

        return String(valor || "")
            .trim()
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }


    function texto(id, valor) {

        const elemento =
            $(id);

        if (elemento) {
            elemento.textContent =
                valor ?? "";
        }
    }


    // ========================================================
    // FECHA HOY
    // ========================================================

    function fechaHoy() {

        if (
            window.EDUQR?.utils?.fechaHoy
        ) {

            return window.EDUQR.utils.fechaHoy();
        }

        return new Intl.DateTimeFormat(
            "en-CA",
            {
                timeZone:
                    "America/Bogota",

                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }
        ).format(
            new Date()
        );
    }


    // ========================================================
    // HORA ACTUAL
    // ========================================================

    function horaActual() {

        if (
            window.EDUQR?.utils?.horaActual
        ) {

            return window.EDUQR.utils.horaActual();
        }

        return new Intl.DateTimeFormat(
            "es-CO",
            {
                timeZone:
                    "America/Bogota",

                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",

                hour12: false
            }
        ).format(
            new Date()
        );
    }


    // ========================================================
    // FECHA COMPLETA
    // ========================================================

    function fechaCompleta() {

        if (
            window.EDUQR?.utils?.fechaCompleta
        ) {

            return window.EDUQR.utils.fechaCompleta();
        }

        return new Intl.DateTimeFormat(
            "es-CO",
            {
                timeZone:
                    "America/Bogota",

                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        ).format(
            new Date()
        );
    }


    // ========================================================
    // MOSTRAR ERROR
    // ========================================================

    async function mostrarError(
        mensaje
    ) {

        console.error(
            "Dashboard:",
            mensaje
        );

        if (
            window.Swal
        ) {

            await Swal.fire({

                icon: "error",

                title:
                    "No se pudo actualizar",

                text:
                    mensaje ||
                    "Verifica la conexión con Supabase.",

                confirmButtonText:
                    "Aceptar"
            });

        } else {

            alert(
                mensaje ||
                "No se pudo actualizar el Dashboard."
            );
        }
    }


    // ========================================================
    // PROTEGER PÁGINA
    // ========================================================

    async function verificarSesion() {

        const usuario =
            (() => {

                try {

                    return JSON.parse(
                        localStorage.getItem(
                            "usuario"
                        ) || "null"
                    );

                } catch (_) {

                    return null;
                }

            })();

        if (
            !usuario &&
            !window.EDUQR
                ?.auth
        ) {

            window.location.href =
                "login.html";

            return false;
        }

        if (
            window.EDUQR
                ?.protegerPagina
        ) {

            try {

                const permitido =
                    await window.EDUQR.protegerPagina(
                        {
                            redirect: true
                        }
                    );

                if (
                    permitido === false
                ) {

                    return false;
                }

            } catch (error) {

                console.warn(
                    "No se pudo validar sesión:",
                    error
                );
            }
        }

        const nombre =
            usuario?.nombre ||
            usuario?.correo ||
            usuario?.email ||
            "Usuario";

        const rol =
            usuario?.rol ||
            "Usuario";

        texto(
            "nombreUsuario",
            nombre
        );

        texto(
            "rolUsuario",
            rol
        );

        return true;
    }


    // ========================================================
    // CARGAR ESTUDIANTES
    // ========================================================

    async function cargarTotalEstudiantes() {

        const {
            count,
            error
        } = await db
            .from("estudiantes")
            .select(
                "id",
                {
                    count: "exact",
                    head: true
                }
            );

        if (error) {
            throw error;
        }

        return count || 0;
    }


    // ========================================================
    // CARGAR ASISTENCIAS DE HOY
    // ========================================================

    async function cargarAsistenciasHoy() {

        const hoy =
            fechaHoy();

        const {
            data,
            error
        } = await db
            .from("asistencia")
            .select(`
                id,
                estudiante_id,
                nombre,
                documento,
                curso,
                fecha,
                hora,
                fecha_hora,
                estado,
                ingreso
            `)
            .eq(
                "fecha",
                hoy
            )
            .order(
                "hora",
                {
                    ascending: true
                });

        if (error) {
            throw error;
        }

        return data || [];
    }


    // ========================================================
    // NORMALIZAR ASISTENCIA
    // ========================================================

    function normalizarAsistencia(
        registro
    ) {

        return {

            ...registro,

            estado:
                normalizar(
                    registro.estado
                ) === "tarde"
                    ? "Tarde"
                    : "A Tiempo",

            ingreso:
                normalizar(
                    registro.ingreso
                ) === "media tecnica"
                    ? "Media Técnica"
                    : "Colegio"
        };
    }


    // ========================================================
    // CALCULAR ESTADÍSTICAS
    // ========================================================

    function calcularMetricas(
        registros
    ) {

        const filas =
            registros.map(
                normalizarAsistencia
            );

        const total =
            filas.length;

        const aTiempo =
            filas.filter(
                registro =>
                    registro.estado ===
                    "A Tiempo"
            ).length;

        const tardes =
            filas.filter(
                registro =>
                    registro.estado ===
                    "Tarde"
            ).length;

        const colegio =
            filas.filter(
                registro =>
                    registro.ingreso ===
                    "Colegio"
            ).length;

        const media =
            filas.filter(
                registro =>
                    registro.ingreso ===
                    "Media Técnica"
            ).length;

        return {

            total,

            aTiempo,

            tardes,

            colegio,

            media
        };
    }


    // ========================================================
    // ACTUALIZAR TARJETAS
    // ========================================================

    function actualizarTarjetas(
        totalEstudiantes,
        metricas
    ) {

        texto(
            "totalEstudiantes",
            totalEstudiantes
        );

        texto(
            "totalAsistencias",
            metricas.total
        );

        texto(
            "totalATiempo",
            metricas.aTiempo
        );

        texto(
            "totalTardes",
            metricas.tardes
        );

        texto(
            "totalColegio",
            metricas.colegio
        );

        texto(
            "totalMedia",
            metricas.media
        );

        // Indicadores inferiores

        texto(
            "hoy",
            metricas.total
        );

        texto(
            "presentes",
            metricas.aTiempo
        );

        texto(
            "tarde",
            metricas.tardes
        );

        texto(
            "ausentes",
            Math.max(
                totalEstudiantes -
                metricas.total,
                0
            )
        );


        // ====================================================
        // PORCENTAJES
        // ====================================================

        const porcentajeAsistencia =
            totalEstudiantes > 0

                ? Math.round(
                    (
                        metricas.total /
                        totalEstudiantes
                    ) * 100
                )

                : 0;

        const porcentajePuntualidad =
            metricas.total > 0

                ? Math.round(
                    (
                        metricas.aTiempo /
                        metricas.total
                    ) * 100
                )

                : 0;

        const porcentajeMedia =
            metricas.total > 0

                ? Math.round(
                    (
                        metricas.media /
                        metricas.total
                    ) * 100
                )

                : 0;


        texto(
            "porcentajeAsistencia",
            `${porcentajeAsistencia}%`
        );

        texto(
            "porcentajePuntualidad",
            `${porcentajePuntualidad}%`
        );

        texto(
            "porcentajeMedia",
            `${porcentajeMedia}%`
        );


        const barraAsistencia =
            $("barraAsistencia");

        const barraPuntualidad =
            $("barraPuntualidad");

        const barraMedia =
            $("barraMedia");


        if (barraAsistencia) {

            barraAsistencia.style.width =
                `${porcentajeAsistencia}%`;
        }

        if (barraPuntualidad) {

            barraPuntualidad.style.width =
                `${porcentajePuntualidad}%`;
        }

        if (barraMedia) {

            barraMedia.style.width =
                `${porcentajeMedia}%`;
        }
    }


    // ========================================================
    // CREAR GRÁFICA
    // ========================================================

    function crearGrafica(
        id,
        tipo,
        etiquetas,
        valores,
        colores,
        opciones = {}
    ) {

        const canvas =
            $(id);

        if (!canvas) {
            return;
        }

        if (
            typeof Chart ===
            "undefined"
        ) {

            console.error(
                "Chart.js no está cargado."
            );

            return;
        }

        if (charts[id]) {

            try {
                charts[id].destroy();
            } catch (_) {}
        }

        charts[id] =
            new Chart(
                canvas,
                {

                    type: tipo,

                    data: {

                        labels:
                            etiquetas,

                        datasets: [

                            {

                                data:
                                    valores,

                                backgroundColor:
                                    colores,

                                borderColor:
                                    colores,

                                borderWidth:
                                    tipo ===
                                    "line"
                                        ? 3
                                        : 0,

                                borderRadius:
                                    tipo ===
                                    "bar"
                                        ? 8
                                        : 0,

                                tension:
                                    .35,

                                fill:
                                    tipo ===
                                    "line"
                            }
                        ]
                    },

                    options: {

                        responsive:
                            true,

                        maintainAspectRatio:
                            false,

                        animation:
                            false,

                        plugins: {

                            legend: {

                                position:
                                    "bottom"
                            }
                        },

                        scales:
                            tipo ===
                            "line" ||
                            tipo ===
                            "bar"

                                ? {

                                    y: {

                                        beginAtZero:
                                            true,

                                        ticks: {

                                            precision:
                                                0
                                        }
                                    }
                                }

                                : undefined,

                        ...opciones
                    }
                }
            );
    }


    // ========================================================
    // CARGAR GRÁFICAS
    // ========================================================

    function actualizarGraficas(
        registros
    ) {

        const filas =
            registros.map(
                normalizarAsistencia
            );


        // ====================================================
        // 1. ASISTENCIA
        // ====================================================

        const aTiempo =
            filas.filter(
                registro =>
                    registro.estado ===
                    "A Tiempo"
            ).length;

        const tarde =
            filas.filter(
                registro =>
                    registro.estado ===
                    "Tarde"
            ).length;


        crearGrafica(

            "graficaAsistencia",

            "doughnut",

            [
                "A tiempo",
                "Tarde"
            ],

            [
                aTiempo,
                tarde
            ],

            [
                "#159570",
                "#d95757"
            ],

            {
                cutout:
                    "68%"
            }
        );


        // ====================================================
        // 2. INGRESOS
        // ====================================================

        const colegio =
            filas.filter(
                registro =>
                    registro.ingreso ===
                    "Colegio"
            ).length;

        const media =
            filas.filter(
                registro =>
                    registro.ingreso ===
                    "Media Técnica"
            ).length;


        crearGrafica(

            "graficaIngreso",

            "pie",

            [
                "Colegio",
                "Media Técnica"
            ],

            [
                colegio,
                media
            ],

            [
                "#2563eb",
                "#7157c9"
            ]
        );


        // ====================================================
        // 3. HORAS
        // ====================================================

        const horas = [
            "05",
            "06",
            "07",
            "08",
            "09",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17"
        ];

        const cantidadHoras =
            horas.map(
                hora => {

                    return filas.filter(
                        registro => {

                            const valor =
                                String(
                                    registro.hora ||
                                    ""
                                );

                            return valor
                                .substring(
                                    0,
                                    2
                                ) === hora;
                        }
                    ).length;
                }
            );


        crearGrafica(

            "graficaHoras",

            "line",

            horas.map(
                hora =>
                    `${hora}:00`
            ),

            cantidadHoras,

            "#2563eb",

            {

                plugins: {

                    legend: {
                        display: false
                    }
                },

                scales: {

                    y: {

                        beginAtZero:
                            true,

                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        );


        // ====================================================
        // 4. CURSOS
        // ====================================================

        const cursos = {};

        filas.forEach(
            registro => {

                const curso =
                    String(
                        registro.curso ||
                        "Sin curso"
                    ).trim();

                cursos[curso] =
                    (
                        cursos[curso] ||
                        0
                    ) + 1;
            }
        );


        const nombresCursos =
            Object.keys(cursos)
                .sort(
                    (a, b) =>
                        a.localeCompare(
                            b,
                            "es"
                        )
                );

        const valoresCursos =
            nombresCursos.map(
                curso =>
                    cursos[curso]
            );


        crearGrafica(

            "graficaCursos",

            "bar",

            nombresCursos,

            valoresCursos,

            "#08a6bb",

            {

                plugins: {

                    legend: {
                        display: false
                    }
                },

                scales: {

                    y: {

                        beginAtZero:
                            true,

                        ticks: {
                            precision: 0
                        }
                    }
                }
            }
        );
    }


    // ========================================================
    // FOTO SEGURA
    // ========================================================

    const FOTO_DEFAULT =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent(`
            <svg xmlns="http://www.w3.org/2000/svg"
                 width="100"
                 height="100"
                 viewBox="0 0 100 100">

                <rect
                    width="100"
                    height="100"
                    fill="#eaf1ff"/>

                <circle
                    cx="50"
                    cy="35"
                    r="18"
                    fill="#123b85"/>

                <path
                    d="M18 92
                       C22 66 35 53 50 53
                       C65 53 78 66 82 92
                       Z"
                    fill="#123b85"/>
            </svg>
        `);


    // ========================================================
    // TABLA DE ACTIVIDAD
    // ========================================================

    async function cargarTabla() {

        const body =
            $("contenidoTabla");

        if (!body) {
            return;
        }

        body.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="loading-tabla">
                        <i class="fa-solid fa-spinner fa-spin"></i>
                        Cargando asistencias...
                    </div>
                </td>
            </tr>
        `;


        const {
            data,
            error
        } = await db
            .from("asistencia")
            .select(`
                *,
                estudiantes(
                    id,
                    nombre,
                    documento,
                    curso,
                    foto
                )
            `)
            .order(
                "fecha_hora",
                {
                    ascending: false
                }
            )
            .limit(30);


        if (error) {
            throw error;
        }


        if (
            !data ||
            data.length === 0
        ) {

            body.innerHTML = `
                <tr>
                    <td colspan="9">
                        <div class="tabla-vacia">
                            <i class="fa-solid fa-clipboard-check"></i>
                            <span>
                                No hay asistencias registradas.
                            </span>
                        </div>
                    </td>
                </tr>
            `;

            return;
        }


        body.innerHTML =
            data.map(
                registro => {

                    const estudiante =
                        registro.estudiantes ||
                        {};

                    const estado =
                        normalizar(
                            registro.estado
                        ) === "tarde"
                            ? "Tarde"
                            : "A Tiempo";


                    const ingreso =
                        normalizar(
                            registro.ingreso
                        ) ===
                        "media tecnica"

                            ? "Media Técnica"

                            : "Colegio";


                    const colorEstado =
                        estado ===
                        "Tarde"

                            ? "#d95757"

                            : "#159570";


                    return `

                        <tr>

                            <td>

                                <img
                                    src="${escapeHTML(
                                        estudiante.foto ||
                                        FOTO_DEFAULT
                                    )}"
                                    alt=""
                                    class="foto-tabla"
                                    width="42"
                                    height="42"
                                    style="
                                        width:42px;
                                        height:42px;
                                        object-fit:cover;
                                        border-radius:10px;
                                    "
                                    onerror="
                                        this.onerror=null;
                                        this.src='${FOTO_DEFAULT}';
                                    "
                                >

                            </td>


                            <td>

                                <strong>
                                    ${escapeHTML(
                                        estudiante.nombre ||
                                        registro.nombre ||
                                        "-"
                                    )}
                                </strong>

                            </td>


                            <td>

                                ${escapeHTML(
                                    estudiante.documento ||
                                    registro.documento ||
                                    "-"
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    estudiante.curso ||
                                    registro.curso ||
                                    "-"
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    registro.fecha ||
                                    "-"
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    registro.hora ||
                                    "-"
                                )}

                            </td>


                            <td>

                                <strong
                                    style="
                                        color:${colorEstado};
                                    "
                                >
                                    ${escapeHTML(
                                        estado
                                    )}
                                </strong>

                            </td>


                            <td>

                                ${escapeHTML(
                                    ingreso
                                )}

                            </td>


                            <td>

                                <button
                                    type="button"
                                    class="btn btn-light"
                                    data-detail="${escapeHTML(
                                        registro.id
                                    )}"
                                    title="Ver detalle"
                                >

                                    <i
                                        class="fa-solid fa-eye"
                                    ></i>

                                </button>

                            </td>

                        </tr>
                    `;
                }
            ).join("");


        body
            .querySelectorAll(
                "[data-detail]"
            )
            .forEach(
                boton => {

                    boton.addEventListener(
                        "click",
                        () => {

                            abrirDetalle(
                                boton.dataset.detail
                            );
                        }
                    );
                }
            );
    }


    // ========================================================
    // MODAL DETALLE
    // ========================================================

    async function abrirDetalle(
        id
    ) {

        if (!id) {
            return;
        }

        try {

            const {
                data,
                error
            } = await db
                .from("asistencia")
                .select(`
                    *,
                    estudiantes(
                        nombre,
                        documento,
                        curso,
                        foto
                    )
                `)
                .eq(
                    "id",
                    id
                )
                .single();


            if (error) {
                throw error;
            }


            const estudiante =
                data.estudiantes ||
                {};


            const foto =
                $("detalleFoto");


            if (foto) {

                foto.onerror =
                    function () {

                        this.onerror =
                            null;

                        this.src =
                            FOTO_DEFAULT;
                    };

                foto.src =
                    estudiante.foto ||
                    FOTO_DEFAULT;
            }


            texto(
                "detalleNombre",
                estudiante.nombre ||
                data.nombre ||
                "-"
            );

            texto(
                "detalleDocumento",
                estudiante.documento ||
                data.documento ||
                "-"
            );

            texto(
                "detalleCurso",
                estudiante.curso ||
                data.curso ||
                "-"
            );

            texto(
                "detalleFecha",
                data.fecha ||
                "-"
            );

            texto(
                "detalleHora",
                data.hora ||
                "-"
            );

            texto(
                "detalleEstado",
                normalizar(
                    data.estado
                ) === "tarde"
                    ? "Tarde"
                    : "A Tiempo"
            );

            texto(
                "detalleIngreso",
                normalizar(
                    data.ingreso
                ) === "media tecnica"
                    ? "Media Técnica"
                    : "Colegio"
            );


            const modal =
                $("modalDetalle");

            if (modal) {

                modal.classList.remove(
                    "oculto"
                );
            }

        } catch (error) {

            console.error(
                "Error detalle:",
                error
            );

            await mostrarError(
                "No fue posible cargar el detalle de la asistencia."
            );
        }
    }


    // ========================================================
    // CERRAR MODAL
    // ========================================================

    function cerrarModal() {

        const modal =
            $("modalDetalle");

        if (modal) {

            modal.classList.add(
                "oculto"
            );
        }
    }


    // ========================================================
    // ACTUALIZAR TODO
    // ========================================================

    async function actualizarDashboard(
        mostrarLoader = true
    ) {

        if (actualizando) {
            return;
        }

        actualizando = true;


        const loader =
            $("loaderSistema");


        if (
            mostrarLoader &&
            loader
        ) {

            loader.classList.remove(
                "oculto"
            );
        }


        try {

            const [
                totalEstudiantes,
                registrosHoy
            ] = await Promise.all([

                cargarTotalEstudiantes(),

                cargarAsistenciasHoy()
            ]);


            const metricas =
                calcularMetricas(
                    registrosHoy
                );


            // Tarjetas

            actualizarTarjetas(
                totalEstudiantes,
                metricas
            );


            // Gráficas

            actualizarGraficas(
                registrosHoy
            );


            // Tabla

            await cargarTabla();


            // Sincronización

            texto(
                "ultimaSincronizacion",
                `Actualizado ${horaActual()}`
            );


            // Estado sistema

            texto(
                "estadoServidor",
                "Conectado"
            );

            texto(
                "estadoBD",
                "Supabase"
            );

            texto(
                "estadoStorage",
                "Activo"
            );


        } catch (error) {

            console.error(
                "Error actualizando Dashboard:",
                error
            );

            await mostrarError(
                error.message ||
                "No fue posible cargar los datos del Dashboard."
            );

        } finally {

            actualizando = false;

            if (
                loader
            ) {

                loader.classList.add(
                    "oculto"
                );
            }
        }
    }


    // ========================================================
    // RELOJ
    // ========================================================

    function iniciarReloj() {

        const actualizar =
            () => {

                texto(
                    "reloj",
                    horaActual()
                );

                texto(
                    "fechaActual",
                    fechaCompleta()
                );
            };


        actualizar();

        if (clockTimer) {
            clearInterval(
                clockTimer
            );
        }

        clockTimer =
            setInterval(
                actualizar,
                1000
            );
    }


    // ========================================================
    // ACTUALIZACIÓN AUTOMÁTICA
    // ========================================================

    function iniciarActualizacionAutomatica() {

        if (refreshTimer) {

            clearInterval(
                refreshTimer
            );
        }

        refreshTimer =
            setInterval(
                () => {

                    if (
                        document.visibilityState ===
                        "visible"
                    ) {

                        actualizarDashboard(
                            false
                        );
                    }

                },
                60000
            );
    }


    // ========================================================
    // CERRAR SESIÓN
    // ========================================================

    async function cerrarSesion() {

        try {

            if (
                window.EDUQR
                    ?.auth
                    ?.logout
            ) {

                await window.EDUQR.auth.logout();

                return;
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
        }
    }


    // ========================================================
    // EVENTOS
    // ========================================================

    function conectarEventos() {

        const btnActualizar =
            $("btnActualizar");

        if (btnActualizar) {

            btnActualizar.addEventListener(
                "click",
                () => {

                    actualizarDashboard(
                        true
                    );
                }
            );
        }


        const btnActualizarTabla =
            $("btnActualizarTabla");

        if (btnActualizarTabla) {

            btnActualizarTabla.addEventListener(
                "click",
                () => {

                    cargarTabla()
                        .catch(
                            error => {

                                console.error(
                                    error
                                );
                            }
                        );
                }
            );
        }


        const cerrar =
            $("cerrarModal");

        if (cerrar) {

            cerrar.addEventListener(
                "click",
                cerrarModal
            );
        }


        const modal =
            $("modalDetalle");

        if (modal) {

            modal.addEventListener(
                "click",
                event => {

                    if (
                        event.target ===
                        modal
                    ) {

                        cerrarModal();
                    }
                }
            );
        }


        const btnCerrarSesion =
            $("btnCerrarSesion");

        if (btnCerrarSesion) {

            btnCerrarSesion.addEventListener(
                "click",
                event => {

                    event.preventDefault();

                    cerrarSesion();
                }
            );
        }
    }


    // ========================================================
    // INICIALIZAR
    // ========================================================

    async function iniciar() {

        if (inicializado) {
            return;
        }

        inicializado = true;


        const sesion =
            await verificarSesion();

        if (!sesion) {
            return;
        }


        conectarEventos();

        iniciarReloj();

        iniciarActualizacionAutomatica();

        await actualizarDashboard(
            true
        );
    }


    // ========================================================
    // LIMPIEZA
    // ========================================================

    window.addEventListener(
        "beforeunload",
        () => {

            if (refreshTimer) {

                clearInterval(
                    refreshTimer
                );
            }

            if (clockTimer) {

                clearInterval(
                    clockTimer
                );
            }


            Object.values(
                charts
            ).forEach(
                grafica => {

                    try {
                        grafica.destroy();
                    } catch (_) {}
                }
            );
        }
    );


    // ========================================================
    // INICIO
    // ========================================================

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            iniciar,
            {
                once: true
            }
        );

    } else {

        iniciar();
    }


    // ========================================================
    // COMPATIBILIDAD
    // ========================================================

    window.actualizarDashboard =
        actualizarDashboard;

    window.cargarTabla =
        cargarTabla;

    window.abrirDetalle =
        abrirDetalle;

    window.cerrarModal =
        cerrarModal;

})();