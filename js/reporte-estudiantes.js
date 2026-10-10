"use strict";

(function iniciarReporteEstudiantes() {
    const state = {
        students: [],
        attendance: [],
        charts: {},
        loading: false,
        resultados: null,
        puedeVerDetalle: false,
        fechaInicio: "",
        fechaFin: "",
        mostrarTodasTardanzas: false,
        mostrarTodasFaltas: false
    };

    const $ = id => document.getElementById(id);
    const PAGE_SIZE = 1000;

    document.addEventListener("DOMContentLoaded", () => {
        $("btnVistaAsistencia")?.addEventListener("click", () => cambiarVista("attendance"));
        $("btnVistaEstudiantes")?.addEventListener("click", () => cambiarVista("students"));
        $("periodoReporteEstudiantes")?.addEventListener("change", cargarReporteEstudiantes);
        $("btnActualizarEstudiantes")?.addEventListener("click", cargarReporteEstudiantes);
        $("btnExportarEstudiantes")?.addEventListener("click", exportarReporteEstudiantes);
        $("btnVerTodasTardanzas")?.addEventListener("click", () => alternarListado("tardanzas"));
        $("btnVerTodasFaltas")?.addEventListener("click", () => alternarListado("faltas"));
        $("cerrarDialogoEstudiantesGrafica")?.addEventListener("click", cerrarDetalleGrafica);
        $("btnCerrarDetalleEstudiantesGrafica")?.addEventListener("click", cerrarDetalleGrafica);
        $("dialogoEstudiantesGrafica")?.addEventListener("click", evento => {
            if (evento.target === $("dialogoEstudiantesGrafica")) {
                cerrarDetalleGrafica();
            }
        });
        if (obtenerRolLocal() === "estudiante") {
            $("btnVistaEstudiantes")?.remove();
            return;
        }
        cargarReporteEstudiantes();
    });

    function obtenerRolLocal() {
        try {
            const usuario = JSON.parse(localStorage.getItem("usuario") || "null");
            return String(usuario?.rol || usuario?.tipo || "").trim().toLowerCase();
        } catch (error) {
            console.warn("No se pudo determinar el rol para el reporte de estudiantes:", error);
            return "";
        }
    }

    function cambiarVista(vista) {
        document.querySelectorAll("[data-report-view]").forEach(elemento => {
            const activa = elemento.dataset.reportView === vista;
            elemento.classList.toggle("report-view-hidden", !activa);
        });

        $("btnVistaAsistencia")?.setAttribute(
            "aria-selected",
            String(vista === "attendance")
        );
        $("btnVistaEstudiantes")?.setAttribute(
            "aria-selected",
            String(vista === "students")
        );

        if (vista === "students") {
            ajustarGraficasVisibles();
        }
    }

    function ajustarGraficasVisibles() {
        const ajustar = () => {
            Object.values(state.charts).forEach(grafica => {
                grafica?.resize();
                grafica?.update("none");
            });
        };

        if (typeof window.requestAnimationFrame === "function") {
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(ajustar);
            });
        } else {
            ajustar();
        }
    }

    async function cargarReporteEstudiantes() {
        if (state.loading) {
            return;
        }

        state.loading = true;
        const boton = $("btnActualizarEstudiantes");
        const selectorPeriodo = $("periodoReporteEstudiantes");
        if (boton) {
            boton.disabled = true;
        }
        if (selectorPeriodo) {
            selectorPeriodo.disabled = true;
        }

        mostrarEstado("Cargando reporte...");

        try {
            const client = window.PUNTUALIXSCAN?.client || window.PUNTUALIXSCAN?.db;
            if (!client) {
                throw new Error("No se encontró el cliente de Supabase.");
            }

            try {
                state.puedeVerDetalle = await verificarAccesoDetalle(client);
            } catch (error) {
                state.puedeVerDetalle = false;
                console.error("No se pudo verificar el rol del usuario para el detalle de gráficas:", error);
                mostrarAviso("No se pudo verificar el permiso del usuario. El detalle de estudiantes no estará disponible.");
            }

            const periodo = Number($("periodoReporteEstudiantes")?.value || 365);
            const fechaFin = fechaLocal(new Date());
            const fechaInicioDate = new Date();
            fechaInicioDate.setDate(fechaInicioDate.getDate() - (periodo - 1));
            const fechaInicio = fechaLocal(fechaInicioDate);

            const [estudiantes, asistencias] = await Promise.all([
                obtenerEstudiantes(client),
                obtenerAsistencias(client, fechaInicio, fechaFin)
            ]);

            state.students = estudiantes.filter(estudiante => estudiante.activo !== false);
            state.attendance = asistencias;
            state.fechaInicio = fechaInicio;
            state.fechaFin = fechaFin;
            renderizarReporte(fechaInicio, fechaFin);
        } catch (error) {
            console.error("Error cargando el reporte de estudiantes:", error);
            state.resultados = null;
            limpiarGraficas();
            [
                "totalEstudiantesReporte",
                "estudiantesTardeReporte",
                "diasTardeReporte",
                "faltasEstimadasReporte"
            ].forEach(id => ponerTexto(id, 0));
            mostrarEstado("No fue posible cargar la información. Intenta actualizar el reporte.");
            mostrarError(error);
        } finally {
            state.loading = false;
            if (boton) {
                boton.disabled = false;
            }
            if (selectorPeriodo) {
                selectorPeriodo.disabled = false;
            }
        }
    }

    async function verificarAccesoDetalle(client) {
        const rolLocal = obtenerRolLocal();
        if (rolLocal) {
            return ["administrador", "profesor"].includes(rolLocal);
        }

        let usuario = null;
        if (typeof window.PUNTUALIXSCAN?.auth?.user === "function") {
            usuario = await window.PUNTUALIXSCAN.auth.user();
        } else if (typeof client.auth?.getUser === "function") {
            const { data, error } = await client.auth.getUser();
            if (error) {
                throw error;
            }
            usuario = data?.user || null;
        }

        const rolMetadata = normalizar(
            usuario?.user_metadata?.rol ||
            usuario?.user_metadata?.tipo ||
            ""
        );
        if (["administrador", "profesor"].includes(rolMetadata)) {
            return true;
        }

        if (!usuario?.id) {
            return false;
        }

        const { data, error } = await client
            .from("usuarios")
            .select("rol")
            .eq("id", usuario.id)
            .maybeSingle();

        if (error) {
            throw error;
        }

        return ["administrador", "profesor"].includes(normalizar(data?.rol));
    }

    async function obtenerEstudiantes(client) {
        const estudiantes = [];

        for (let inicio = 0; ; inicio += PAGE_SIZE) {
            const { data, error } = await client
                .from("estudiantes")
                .select("id,nombre,documento,curso,activo")
                .order("nombre", { ascending: true })
                .range(inicio, inicio + PAGE_SIZE - 1);

            if (error) {
                throw error;
            }

            const pagina = Array.isArray(data) ? data : [];
            estudiantes.push(...pagina);

            if (pagina.length < PAGE_SIZE) {
                return estudiantes;
            }
        }
    }

    async function obtenerAsistencias(client, fechaInicio, fechaFin) {
        const registros = [];

        for (let inicio = 0; ; inicio += PAGE_SIZE) {
            const { data, error } = await client
                .from("asistencia")
                .select("estudiante_id,documento,curso,estado,fecha,fecha_hora")
                .gte("fecha", fechaInicio)
                .lte("fecha", fechaFin)
                .order("fecha", { ascending: true })
                .range(inicio, inicio + PAGE_SIZE - 1);

            if (error) {
                throw error;
            }

            const pagina = Array.isArray(data) ? data : [];
            registros.push(...pagina);

            if (pagina.length < PAGE_SIZE) {
                return registros;
            }
        }
    }

    function renderizarReporte(fechaInicio, fechaFin) {
        const estudiantes = state.students.map(estudiante => ({
            ...estudiante,
            clave: claveEstudiante(estudiante),
            curso: String(estudiante.curso || "").trim() || "Sin grado / curso",
            grado: obtenerEtiquetaGrado(estudiante.curso),
            llegadasTarde: 0,
            diasTarde: new Set(),
            diasAsistencia: new Set(),
            faltasEstimadas: 0
        }));
        const porClave = new Map(
            estudiantes.map(estudiante => [estudiante.clave, estudiante])
        );
        const diasOperativos = new Set();

        state.attendance.forEach(registro => {
            const fecha = obtenerFecha(registro);
            if (!fecha || fecha < fechaInicio || fecha > fechaFin) {
                return;
            }

            diasOperativos.add(fecha);
            const estudiante = porClave.get(claveRegistro(registro));
            if (!estudiante) {
                return;
            }

            estudiante.diasAsistencia.add(fecha);
            if (normalizar(registro.estado) === "tarde") {
                estudiante.llegadasTarde += 1;
                estudiante.diasTarde.add(fecha);
            }
        });

        estudiantes.forEach(estudiante => {
            estudiante.diasTarde = estudiante.diasTarde.size;
            estudiante.diasAsistencia = estudiante.diasAsistencia.size;
            estudiante.faltasEstimadas = Math.max(
                0,
                diasOperativos.size - estudiante.diasAsistencia
            );
        });

        const porTardanzas = [...estudiantes].sort(
            (a, b) =>
                b.diasTarde - a.diasTarde ||
                b.llegadasTarde - a.llegadasTarde ||
                compararNombres(a, b)
        );
        const porFaltas = [...estudiantes].sort(
            (a, b) =>
                b.faltasEstimadas - a.faltasEstimadas ||
                compararNombres(a, b)
        );
        const tardanzasTotal = estudiantes.reduce(
            (total, estudiante) => total + estudiante.diasTarde,
            0
        );
        const faltasTotal = estudiantes.reduce(
            (total, estudiante) => total + estudiante.faltasEstimadas,
            0
        );
        state.resultados = {
            estudiantes,
            diasOperativos: diasOperativos.size,
            porTardanzas: porTardanzas.filter(estudiante => estudiante.diasTarde > 0),
            porFaltas: porFaltas.filter(estudiante => estudiante.faltasEstimadas > 0)
        };

        ponerTexto("totalEstudiantesReporte", estudiantes.length);
        ponerTexto(
            "estudiantesTardeReporte",
            estudiantes.filter(estudiante => estudiante.diasTarde > 0).length
        );
        ponerTexto("diasTardeReporte", tardanzasTotal);
        ponerTexto("faltasEstimadasReporte", faltasTotal);
        renderizarTablasRanking();
        renderizarGraficas(estudiantes);
    }

    function alternarListado(tipo) {
        if (!state.resultados) {
            return;
        }

        if (tipo === "tardanzas") {
            state.mostrarTodasTardanzas = !state.mostrarTodasTardanzas;
        } else {
            state.mostrarTodasFaltas = !state.mostrarTodasFaltas;
        }

        renderizarTablasRanking();
    }

    function renderizarTablasRanking() {
        if (!state.resultados) {
            return;
        }

        renderizarTabla(
            "tablaEstudiantesTarde",
            "btnVerTodasTardanzas",
            state.resultados.porTardanzas,
            "tardanzas",
            state.mostrarTodasTardanzas
        );
        renderizarTabla(
            "tablaEstudiantesFaltas",
            "btnVerTodasFaltas",
            state.resultados.porFaltas,
            "faltas",
            state.mostrarTodasFaltas
        );
    }

    function renderizarTabla(id, botonId, estudiantes, tipo, mostrarTodos) {
        const tbody = $(id);
        if (!tbody) {
            return;
        }

        const boton = $(botonId);
        if (boton) {
            boton.disabled = estudiantes.length <= 10;
            boton.textContent = mostrarTodos ? "Ver Top 10" : `Ver todos (${estudiantes.length})`;
            boton.setAttribute("aria-expanded", String(mostrarTodos));
        }

        tbody.replaceChildren();
        const visibles = mostrarTodos ? estudiantes : estudiantes.slice(0, 10);
        if (!visibles.length) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");
            celda.colSpan = 4;
            celda.className = "student-report-empty";
            celda.textContent = "No hay datos para este periodo.";
            fila.appendChild(celda);
            tbody.appendChild(fila);
            return;
        }

        visibles.forEach(estudiante => {
            const fila = document.createElement("tr");
            const nombre = document.createElement("td");
            nombre.className = "report-name";
            nombre.textContent = estudiante.nombre || "Sin nombre";
            fila.appendChild(nombre);

            const curso = document.createElement("td");
            curso.textContent = estudiante.curso;
            fila.appendChild(curso);

            const indicador = document.createElement("td");
            indicador.className = "student-report-count";
            indicador.textContent = tipo === "tardanzas"
                ? `${estudiante.diasTarde} día(s)`
                : String(estudiante.faltasEstimadas);
            fila.appendChild(indicador);

            const detalle = document.createElement("td");
            detalle.textContent = tipo === "tardanzas"
                ? String(estudiante.llegadasTarde)
                : String(estudiante.diasAsistencia);
            fila.appendChild(detalle);
            tbody.appendChild(fila);
        });
    }

    function renderizarGraficas(estudiantes) {
        const tardanzasPorGrado = new Map();
        const faltasPorGrado = new Map();

        estudiantes.forEach(estudiante => {
            const tardanzas = tardanzasPorGrado.get(estudiante.grado) || {
                total: 0,
                estudiantes: []
            };
            tardanzas.total += estudiante.diasTarde;
            if (estudiante.diasTarde > 0) {
                tardanzas.estudiantes.push(estudiante);
            }
            tardanzasPorGrado.set(estudiante.grado, tardanzas);

            const faltas = faltasPorGrado.get(estudiante.grado) || {
                total: 0,
                estudiantes: []
            };
            faltas.total += estudiante.faltasEstimadas;
            if (estudiante.faltasEstimadas > 0) {
                faltas.estudiantes.push(estudiante);
            }
            faltasPorGrado.set(estudiante.grado, faltas);
        });

        crearGrafica("graficaTardanzasGrado", tardanzasPorGrado, "#d99118", "tardanzas");
        crearGrafica("graficaFaltasGrado", faltasPorGrado, "#7157c9", "faltas");
    }

    function crearGrafica(id, valores, color, tipo) {
        const canvas = $(id);
        if (!canvas || typeof Chart === "undefined") {
            return;
        }

        state.charts[id]?.destroy();
        const entries = [...valores.entries()].sort(
            (a, b) => b[1].total - a[1].total || a[0].localeCompare(b[0], "es")
        );
        const esGraficaTardanzas = tipo === "tardanzas";
        const unidad = esGraficaTardanzas
            ? "Jornadas con llegada tarde"
            : "faltas estimadas (estudiante-días)";
        const ayuda = $(
            esGraficaTardanzas
                ? "ayudaGraficaTardanzas"
                : "ayudaGraficaFaltas"
        );
        if (ayuda) {
            ayuda.textContent = state.puedeVerDetalle
                ? "Haz clic en una barra para consultar los estudiantes afectados de ese grado."
                : "Las barras muestran el total por grado; el detalle de estudiantes está disponible para administradores y profesores.";
        }

        canvas.style.cursor = state.puedeVerDetalle ? "pointer" : "default";
        state.charts[id] = new Chart(canvas, {
            type: "bar",
            data: {
                labels: entries.map(([grado]) => grado),
                datasets: [{
                    label: unidad,
                    data: entries.map(([, metricas]) => metricas.total),
                    backgroundColor: color,
                    borderRadius: 7,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: contexto => {
                                const metricas = entries[contexto.dataIndex]?.[1];
                                const total = Number(contexto.parsed.y || 0);
                                const cantidad = esGraficaTardanzas
                                    ? `${total} ${total === 1 ? "jornada" : "jornadas"} con llegada tarde`
                                    : `${total} ${total === 1 ? "falta estimada" : "faltas estimadas"} (estudiante-días)`;
                                return [
                                    cantidad,
                                    `${metricas?.estudiantes.length || 0} estudiantes afectados`,
                                    ...(state.puedeVerDetalle
                                        ? ["Haz clic para ver el detalle"]
                                        : [])
                                ];
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { precision: 0 },
                        grid: { color: "#eef2f8" },
                        title: {
                            display: true,
                            text: esGraficaTardanzas
                                ? unidad
                                : "Faltas estimadas (estudiante-días)",
                            color: "#526177",
                            font: { size: 10, weight: "bold" }
                        }
                    },
                    x: {
                        grid: { display: false },
                        title: {
                            display: true,
                            text: "Grado escolar",
                            color: "#526177",
                            font: { size: 10, weight: "bold" }
                        }
                    }
                },
                onClick: (_evento, elementosActivos) => {
                    if (!state.puedeVerDetalle || !elementosActivos.length) {
                        return;
                    }

                    const indice = elementosActivos[0].index;
                    const [grado, metricas] = entries[indice] || [];
                    if (grado && metricas) {
                        mostrarDetalleGrafica(tipo, grado, metricas);
                    }
                }
            },
            plugins: [{
                id: "puntualixscanEtiquetasGrafica",
                afterDatasetsDraw(grafica) {
                    const contexto = grafica.ctx;
                    const meta = grafica.getDatasetMeta(0);
                    contexto.save();
                    contexto.fillStyle = "#526177";
                    contexto.font = "700 11px Inter, sans-serif";
                    contexto.textAlign = "center";
                    contexto.textBaseline = "bottom";
                    meta.data.forEach((barra, indice) => {
                        const valor = grafica.data.datasets[0].data[indice];
                        if (Number(valor) > 0) {
                            contexto.fillText(
                                String(valor),
                                barra.x,
                                barra.y - 6
                            );
                        }
                    });
                    contexto.restore();
                }
            }]
        });
    }

    function mostrarDetalleGrafica(tipo, grado, metricas) {
        const detalle = [...metricas.estudiantes].sort((a, b) =>
            (tipo === "tardanzas"
                ? b.diasTarde - a.diasTarde
                : b.faltasEstimadas - a.faltasEstimadas) ||
            compararNombres(a, b)
        );
        const periodo = `${formatearFecha(state.fechaInicio)} al ${formatearFecha(state.fechaFin)}`;
        ponerTexto("tituloEstudiantesGrafica", `${grado}: estudiantes afectados`);
        ponerTexto("periodoEstudiantesGrafica", `Periodo analizado: ${periodo}`);
        ponerTexto(
            "resumenEstudiantesGrafica",
            tipo === "tardanzas"
                ? `${detalle.length} estudiantes registraron ${metricas.total} jornadas con llegada tarde en este grado.`
                : `${detalle.length} estudiantes suman ${metricas.total} faltas estimadas (estudiante-días) en este grado.`
        );

        const encabezado = $("encabezadoEstudiantesGrafica");
        const cuerpo = $("tablaDetalleEstudiantesGrafica");
        if (!encabezado || !cuerpo) {
            return;
        }

        const titulos = tipo === "tardanzas"
            ? ["Estudiante", "Documento", "Grado / curso", "Jornadas tarde", "Registros tarde"]
            : ["Estudiante", "Documento", "Grado / curso", "Faltas estimadas", "Días con asistencia"];
        const filaEncabezado = document.createElement("tr");
        titulos.forEach(titulo => {
            const celda = document.createElement("th");
            celda.textContent = titulo;
            filaEncabezado.appendChild(celda);
        });
        encabezado.replaceChildren(filaEncabezado);
        cuerpo.replaceChildren();

        detalle.forEach(estudiante => {
            const fila = document.createElement("tr");
            const valores = [
                estudiante.nombre || "Sin nombre",
                estudiante.documento || "—",
                estudiante.curso,
                tipo === "tardanzas"
                    ? String(estudiante.diasTarde)
                    : String(estudiante.faltasEstimadas),
                tipo === "tardanzas"
                    ? String(estudiante.llegadasTarde)
                    : String(estudiante.diasAsistencia)
            ];
            valores.forEach((valor, indice) => {
                const celda = document.createElement("td");
                celda.textContent = valor;
                if (indice === 0) {
                    celda.className = "report-name";
                } else if (indice === 3) {
                    celda.className = "student-report-count";
                }
                fila.appendChild(celda);
            });
            cuerpo.appendChild(fila);
        });

        if (!detalle.length) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");
            celda.colSpan = 5;
            celda.className = "student-report-empty";
            celda.textContent = "No hay estudiantes afectados en este grado durante el periodo seleccionado.";
            fila.appendChild(celda);
            cuerpo.appendChild(fila);
        }

        const dialogo = $("dialogoEstudiantesGrafica");
        if (dialogo?.showModal) {
            dialogo.showModal();
        }
    }

    function cerrarDetalleGrafica() {
        const dialogo = $("dialogoEstudiantesGrafica");
        if (dialogo?.open) {
            dialogo.close();
        }
    }

    function formatearFecha(fecha) {
        if (!fecha) {
            return "—";
        }

        return new Intl.DateTimeFormat("es-CO", {
            day: "numeric",
            month: "short",
            year: "numeric",
            timeZone: "UTC"
        }).format(new Date(`${fecha}T00:00:00Z`));
    }

    function obtenerEtiquetaGrado(curso) {
        const valor = String(curso || "").trim();
        const coincidencia = valor.match(/^\s*(?:grado\s*)?(\d{1,2})(?:\D|$)/i);
        return coincidencia
            ? `Grado ${coincidencia[1]}`
            : "Sin grado";
    }

    function exportarReporteEstudiantes() {
        if (!state.resultados?.estudiantes?.length) {
            mostrarAviso("No hay información para exportar.");
            return;
        }
        if (typeof XLSX === "undefined") {
            mostrarError(new Error("No se pudo cargar el generador de Excel."));
            return;
        }

        const filas = [...state.resultados.estudiantes]
            .sort((a, b) =>
                b.diasTarde - a.diasTarde ||
                b.faltasEstimadas - a.faltasEstimadas ||
                compararNombres(a, b)
            )
            .map(estudiante => ({
                Estudiante: estudiante.nombre || "Sin nombre",
                Documento: estudiante.documento || "",
                "Grado / curso": estudiante.curso,
                "Días con tardanza": estudiante.diasTarde,
                "Registros tarde": estudiante.llegadasTarde,
                "Faltas estimadas": estudiante.faltasEstimadas,
                "Días con asistencia": estudiante.diasAsistencia
            }));
        const hoja = XLSX.utils.json_to_sheet(filas);
        hoja["!cols"] = [
            { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 18 }, { wch: 18 }, { wch: 20 }
        ];
        const libro = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(libro, hoja, "Reporte estudiantes");
        XLSX.writeFile(libro, "Reporte_Estudiantes_Puntualixscan.xlsx");
    }

    function mostrarEstado(mensaje) {
        ["btnVerTodasTardanzas", "btnVerTodasFaltas"].forEach(id => {
            const boton = $(id);
            if (boton) {
                boton.disabled = true;
            }
        });

        ["tablaEstudiantesTarde", "tablaEstudiantesFaltas"].forEach(id => {
            const tbody = $(id);
            if (!tbody) {
                return;
            }
            const fila = document.createElement("tr");
            const celda = document.createElement("td");
            celda.colSpan = 4;
            celda.className = "student-report-empty";
            celda.textContent = mensaje;
            fila.appendChild(celda);
            tbody.replaceChildren(fila);
        });
    }

    function limpiarGraficas() {
        Object.values(state.charts).forEach(chart => chart?.destroy());
        state.charts = {};
    }

    function mostrarError(error) {
        if (window.Swal?.fire) {
            window.Swal.fire({
                icon: "error",
                title: "No se pudo cargar el reporte",
                text: error.message || "Ocurrió un error al cargar la información."
            });
        } else {
            window.alert(error.message || "Ocurrió un error al cargar la información.");
        }
    }

    function mostrarAviso(mensaje) {
        if (window.Swal?.fire) {
            window.Swal.fire({ icon: "info", text: mensaje });
        } else {
            window.alert(mensaje);
        }
    }

    function obtenerFecha(registro) {
        const fecha = String(registro.fecha || registro.fecha_hora || "");
        return /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : "";
    }

    function fechaLocal(fecha) {
        const año = fecha.getFullYear();
        const mes = String(fecha.getMonth() + 1).padStart(2, "0");
        const dia = String(fecha.getDate()).padStart(2, "0");
        return `${año}-${mes}-${dia}`;
    }

    function claveEstudiante(estudiante) {
        return estudiante.id != null && estudiante.id !== ""
            ? `id:${estudiante.id}`
            : `documento:${String(estudiante.documento || "").trim()}`;
    }

    function claveRegistro(registro) {
        return registro.estudiante_id != null && registro.estudiante_id !== ""
            ? `id:${registro.estudiante_id}`
            : `documento:${String(registro.documento || "").trim()}`;
    }

    function normalizar(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim()
            .toLowerCase();
    }

    function compararNombres(a, b) {
        return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
    }

    function ponerTexto(id, valor) {
        const elemento = $(id);
        if (elemento) {
            elemento.textContent = String(valor);
        }
    }
})();
