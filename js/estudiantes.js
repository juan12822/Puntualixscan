"use strict";

/* ============================================================
   PUNTUALIXSCAN
   MÓDULO PROFESIONAL DE ESTUDIANTES
   ============================================================ */


/* ============================================================
   CONFIGURACIÓN
   ============================================================ */

const CONFIG_ESTUDIANTES = {
    tabla: "estudiantes",
    bucket: "estudiantes",
    carpetaFotos: "fotos",
    registrosPorPagina: 10,
    login: "login.html",
    credencial: "credencial.html"
};


/* ============================================================
   IMAGEN PREDETERMINADA
   No depende de imagenes/usuario.png
   ============================================================ */

const FOTO_DEFAULT =
    "data:image/svg+xml;charset=UTF-8," +
    encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg"
             width="200"
             height="200"
             viewBox="0 0 200 200">

            <rect
                width="200"
                height="200"
                fill="#e8eef5"
            />

            <circle
                cx="100"
                cy="72"
                r="38"
                fill="#8aa0b5"
            />

            <path
                d="M35 180c8-42 33-63 65-63s57 21 65 63"
                fill="#8aa0b5"
            />

        </svg>
    `);


/* ============================================================
   ESTADO
   ============================================================ */

const estadoEstudiantes = {

    estudiantes: [],

    filtrados: [],

    pagina: 1,

    seleccionado: null,

    fotoNueva: null,

    fotoAnterior: null,

    modoEdicion: false,

    cargando: false,

    inicializado: false,

    qr: null

};


/* ============================================================
   DOM
   ============================================================ */

const $ = (id) =>
    document.getElementById(id);


const elementos = {

    formulario: $("formEstudiante"),

    nombre: $("nombre"),

    documento: $("documento"),

    grado: $("grado"),

    grupo: $("grupo"),

    correo: $("correo"),

    telefono: $("telefono"),

    foto: $("foto"),

    previewFoto: $("previewFoto"),

    btnRegistrar: $("btnRegistrar"),

    btnLimpiar: $("btnLimpiar"),

    btnQuitarFoto: $("btnQuitarFoto"),

    btnCredencial: $("btnCredencial"),

    btnActualizar: $("btnActualizar"),

    buscar: $("buscar"),

    filtroCurso: $("filtroCurso"),

    tabla: $("tablaEstudiantes"),

    totalEstudiantes: $("totalEstudiantes"),

    totalCredenciales: $("totalCredenciales"),

    totalQR: $("totalQR"),

    totalFotos: $("totalFotos"),

    btnAnterior: $("btnAnterior"),

    btnSiguiente: $("btnSiguiente"),

    inicioPagina: $("inicioPagina"),

    finPagina: $("finPagina"),

    totalPagina: $("totalPagina"),

    modalQR: $("modalQR"),

    btnCerrarModal: $("btnCerrarModal"),

    fotoQR: $("fotoQR"),

    nombreQR: $("nombreQR"),

    cursoQR: $("cursoQR"),

    documentoQR: $("documentoQR"),

    codigoUnicoQR: $("codigoUnicoQR"),

    codigoQR: $("codigoQR"),

    btnDescargarQR: $("btnDescargarQR"),

    btnImprimirQR: $("btnImprimirQR"),

    btnCerrarSesion: $("btnCerrarSesion")

};


/* ============================================================
   CLIENTE SUPABASE
   ============================================================ */

function obtenerCliente() {

    if (window.PUNTUALIXSCAN?.client) {

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
   INICIO
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    iniciarEstudiantes
);


async function iniciarEstudiantes() {

    if (estadoEstudiantes.inicializado) {

        return;

    }

    estadoEstudiantes.inicializado = true;

    try {

        configurarEventos();

        prepararImagenInicial();

        const permitido =
            await protegerPagina();

        if (!permitido) {

            return;

        }

        await cargarEstudiantes();

    } catch (error) {

        console.error(
            "Error iniciando estudiantes:",
            error
        );

        mostrarError(
            obtenerMensajeError(
                error,
                "No se pudo iniciar el módulo de estudiantes."
            )
        );

    }

}


/* ============================================================
   PROTECCIÓN
   ============================================================ */

async function protegerPagina() {

    try {

        if (window.PUNTUALIXSCAN?.protegerPagina) {

            return Boolean(
                await window.PUNTUALIXSCAN.protegerPagina({

                    redirectTo:
                        CONFIG_ESTUDIANTES.login

                })
            );

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
                localStorage.getItem(
                    "usuario"
                );


            if (!usuario) {

                window.location.replace(
                    CONFIG_ESTUDIANTES.login
                );

                return false;

            }

        }


        return true;

    } catch (error) {

        console.error(
            "Error de autenticación:",
            error
        );

        throw error;

    }

}


/* ============================================================
   EVENTOS
   ============================================================ */

function configurarEventos() {


    elementos.btnRegistrar?.addEventListener(
        "click",
        manejarGuardar
    );


    elementos.formulario?.addEventListener(
        "submit",
        manejarGuardar
    );


    elementos.btnLimpiar?.addEventListener(
        "click",
        () => limpiarFormulario(true)
    );


    elementos.btnQuitarFoto?.addEventListener(
        "click",
        quitarFoto
    );


    elementos.btnActualizar?.addEventListener(
        "click",
        cargarEstudiantes
    );


    elementos.foto?.addEventListener(
        "change",
        manejarSeleccionFoto
    );


    elementos.buscar?.addEventListener(
        "input",
        aplicarFiltros
    );


    elementos.filtroCurso?.addEventListener(
        "change",
        aplicarFiltros
    );


    elementos.btnAnterior?.addEventListener(
        "click",
        paginaAnterior
    );


    elementos.btnSiguiente?.addEventListener(
        "click",
        paginaSiguiente
    );


    elementos.btnCerrarModal?.addEventListener(
        "click",
        cerrarModalQR
    );


    elementos.modalQR?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                elementos.modalQR
            ) {

                cerrarModalQR();

            }

        }
    );


    elementos.btnDescargarQR?.addEventListener(
        "click",
        descargarQR
    );


    elementos.btnImprimirQR?.addEventListener(
        "click",
        imprimirQR
    );


    elementos.btnCredencial?.addEventListener(
        "click",
        abrirCredencial
    );


    elementos.btnCerrarSesion?.addEventListener(
        "click",
        cerrarSesion
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                cerrarModalQR();

            }

        }
    );

}


/* ============================================================
   GUARDAR
   ============================================================ */

async function manejarGuardar(event) {

    event?.preventDefault();


    if (
        estadoEstudiantes.modoEdicion
    ) {

        await actualizarEstudiante();

    } else {

        await registrarEstudiante();

    }

}


/* ============================================================
   CARGAR ESTUDIANTES
   ============================================================ */

async function cargarEstudiantes() {

    if (
        estadoEstudiantes.cargando
    ) {

        return;

    }


    estadoEstudiantes.cargando = true;


    try {

        mostrarCargaTabla();


        const client =
            obtenerCliente();


        const {
            data,
            error
        } =
            await client
                .from(
                    CONFIG_ESTUDIANTES.tabla
                )
                .select("*")
                .order(
                    "nombre",
                    {
                        ascending: true
                    }
                );


        if (error) {

            throw error;

        }


        estadoEstudiantes.estudiantes =
            Array.isArray(data)
                ? data
                : [];


        estadoEstudiantes.pagina = 1;


        cargarCursos();


        aplicarFiltros(false);


        actualizarEstadisticas();


    } catch (error) {

        console.error(
            "Error cargando estudiantes:",
            error
        );


        estadoEstudiantes.estudiantes =
            [];

        estadoEstudiantes.filtrados =
            [];


        actualizarEstadisticas();


        renderizarTablaVacia(
            "No se pudieron cargar los estudiantes."
        );


        mostrarError(
            obtenerMensajeError(
                error,
                "No se pudieron cargar los estudiantes."
            )
        );


    } finally {

        estadoEstudiantes.cargando =
            false;

    }

}


/* ============================================================
   CURSOS
   ============================================================ */

function cargarCursos() {

    if (!elementos.filtroCurso) {

        return;

    }


    const cursoActual =
        elementos.filtroCurso.value;


    const cursos =
        [
            ...new Set(
                estadoEstudiantes.estudiantes
                    .map(
                        estudiante =>
                            String(
                                estudiante.curso || ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ]
        .sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "es",
                    {
                        numeric: true
                    }
                )
        );


    elementos.filtroCurso.innerHTML = `

        <option value="">
            Todos los cursos
        </option>

        ${cursos
            .map(
                curso =>
                    `<option value="${escaparAtributo(curso)}">
                        ${escaparHTML(curso)}
                    </option>`
            )
            .join("")
        }

    `;


    if (
        cursos.includes(cursoActual)
    ) {

        elementos.filtroCurso.value =
            cursoActual;

    }

}


/* ============================================================
   FILTROS
   ============================================================ */

function aplicarFiltros(
    reiniciar = true
) {

    const texto =
        normalizar(
            elementos.buscar?.value || ""
        );


    const curso =
        String(
            elementos.filtroCurso?.value || ""
        ).trim();


    estadoEstudiantes.filtrados =
        estadoEstudiantes.estudiantes.filter(
            estudiante => {


                const nombre =
                    normalizar(
                        estudiante.nombre
                    );


                const documento =
                    normalizar(
                        estudiante.documento
                    );


                const cursoEstudiante =
                    String(
                        estudiante.curso || ""
                    ).trim();


                const coincideTexto =
                    !texto ||
                    nombre.includes(texto) ||
                    documento.includes(texto);


                const coincideCurso =
                    !curso ||
                    cursoEstudiante === curso;


                return (
                    coincideTexto &&
                    coincideCurso
                );

            }
        );


    if (reiniciar) {

        estadoEstudiantes.pagina =
            1;

    }


    renderizarTabla();

}


/* ============================================================
   TABLA
   ============================================================ */

function renderizarTabla() {

    if (!elementos.tabla) {

        return;

    }


    const total =
        estadoEstudiantes.filtrados.length;


    if (!total) {

        renderizarTablaVacia(
            "No hay estudiantes para mostrar."
        );

        actualizarPaginacion(0);

        return;

    }


    const paginas =
        Math.max(
            1,
            Math.ceil(
                total /
                CONFIG_ESTUDIANTES.registrosPorPagina
            )
        );


    estadoEstudiantes.pagina =
        Math.min(
            Math.max(
                estadoEstudiantes.pagina,
                1
            ),
            paginas
        );


    const inicio =
        (
            estadoEstudiantes.pagina -
            1
        ) *
        CONFIG_ESTUDIANTES.registrosPorPagina;


    const pagina =
        estadoEstudiantes.filtrados.slice(
            inicio,
            inicio +
            CONFIG_ESTUDIANTES.registrosPorPagina
        );


    elementos.tabla.innerHTML =
        pagina
            .map(
                crearFilaEstudiante
            )
            .join("");


    actualizarPaginacion(
        total
    );

}


/* ============================================================
   FILA
   ============================================================ */

function crearFilaEstudiante(
    estudiante
) {

    const id =
        escaparAtributo(
            estudiante.id
        );


    const nombre =
        escaparHTML(
            estudiante.nombre ||
            "Sin nombre"
        );


    const documento =
        escaparHTML(
            estudiante.documento ||
            "Sin documento"
        );


    const curso =
        escaparHTML(
            estudiante.curso ||
            "Sin curso"
        );


    const correo =
        escaparHTML(
            estudiante.correo ||
            ""
        );


    const telefono =
        escaparHTML(
            estudiante.telefono ||
            ""
        );


    const foto =
        obtenerFoto(
            estudiante.foto
        );


    let contacto = "—";


    if (
        correo &&
        telefono
    ) {

        contacto =
            `${correo}<br>${telefono}`;

    } else if (correo) {

        contacto =
            correo;

    } else if (telefono) {

        contacto =
            telefono;

    }


    return `

        <tr>

            <td>

                <img
                    class="foto-tabla"
                    src="${escaparAtributo(foto)}"
                    alt="Foto de ${escaparAtributo(nombre)}"
                    width="42"
                    height="42"
                    loading="lazy"
                    onerror="
                        this.onerror=null;
                        this.src='${FOTO_DEFAULT}';
                    "
                >

            </td>


            <td>

                <div class="nombre-tabla">

                    ${nombre}

                </div>

            </td>


            <td>

                <span class="documento-tabla">

                    ${documento}

                </span>

            </td>


            <td>

                <span class="curso-badge">

                    ${curso}

                </span>

            </td>


            <td>

                ${contacto}

            </td>


            <td>

                <div class="acciones-tabla">


                    <button
                        type="button"
                        class="accion-tabla"
                        title="Ver código QR"
                        onclick="verQRPorId('${id}')"
                    >

                        <i
                            class="fa-solid fa-qrcode"
                        ></i>

                    </button>


                    <button
                        type="button"
                        class="accion-tabla"
                        title="Editar estudiante"
                        onclick="editarEstudiante('${id}')"
                    >

                        <i
                            class="fa-solid fa-pen"
                        ></i>

                    </button>


                    <button
                        type="button"
                        class="accion-tabla eliminar"
                        title="Eliminar estudiante"
                        onclick="eliminarEstudiante('${id}')"
                    >

                        <i
                            class="fa-solid fa-trash"
                        ></i>

                    </button>


                </div>

            </td>

        </tr>

    `;

}


/* ============================================================
   TABLA VACÍA
   ============================================================ */

function renderizarTablaVacia(
    mensaje
) {

    if (!elementos.tabla) {

        return;

    }


    elementos.tabla.innerHTML = `

        <tr>

            <td colspan="6">

                <div class="tabla-vacia">

                    <i
                        class="fa-solid fa-user-slash"
                    ></i>

                    ${escaparHTML(mensaje)}

                </div>

            </td>

        </tr>

    `;

}


/* ============================================================
   PAGINACIÓN
   ============================================================ */

function actualizarPaginacion(
    total
) {

    const cantidad =
        CONFIG_ESTUDIANTES.registrosPorPagina;


    const paginas =
        Math.max(
            1,
            Math.ceil(
                total / cantidad
            )
        );


    estadoEstudiantes.pagina =
        Math.min(
            Math.max(
                estadoEstudiantes.pagina,
                1
            ),
            paginas
        );


    const inicio =
        total === 0
            ? 0
            :
            (
                (
                    estadoEstudiantes.pagina -
                    1
                ) *
                cantidad
            ) + 1;


    const fin =
        total === 0
            ? 0
            :
            Math.min(
                estadoEstudiantes.pagina *
                cantidad,
                total
            );


    if (
        elementos.inicioPagina
    ) {

        elementos.inicioPagina.textContent =
            inicio;

    }


    if (
        elementos.finPagina
    ) {

        elementos.finPagina.textContent =
            fin;

    }


    if (
        elementos.totalPagina
    ) {

        elementos.totalPagina.textContent =
            total;

    }


    if (
        elementos.btnAnterior
    ) {

        elementos.btnAnterior.disabled =
            estadoEstudiantes.pagina <= 1;

    }


    if (
        elementos.btnSiguiente
    ) {

        elementos.btnSiguiente.disabled =
            estadoEstudiantes.pagina >= paginas;

    }

}


function paginaAnterior() {

    if (
        estadoEstudiantes.pagina <= 1
    ) {

        return;

    }


    estadoEstudiantes.pagina--;


    renderizarTabla();

}


function paginaSiguiente() {

    const paginas =
        Math.max(
            1,
            Math.ceil(
                estadoEstudiantes.filtrados.length /
                CONFIG_ESTUDIANTES.registrosPorPagina
            )
        );


    if (
        estadoEstudiantes.pagina >= paginas
    ) {

        return;

    }


    estadoEstudiantes.pagina++;


    renderizarTabla();

}


/* ============================================================
   ESTADÍSTICAS
   ============================================================ */

function actualizarEstadisticas() {

    const estudiantes =
        estadoEstudiantes.estudiantes;


    const total =
        estudiantes.length;


    const credenciales =
        estudiantes.filter(
            estudiante =>
                Boolean(
                    estudiante.id
                )
        ).length;


    const qr =
        estudiantes.filter(
            estudiante =>
                Boolean(
                    String(
                        estudiante.codigoqr ||
                        ""
                    ).trim()
                )
        ).length;


    const fotos =
        estudiantes.filter(
            estudiante =>
                Boolean(
                    String(
                        estudiante.foto ||
                        ""
                    ).trim()
                )
        ).length;


    actualizarTexto(
        elementos.totalEstudiantes,
        total
    );


    actualizarTexto(
        elementos.totalCredenciales,
        credenciales
    );


    actualizarTexto(
        elementos.totalQR,
        qr
    );


    actualizarTexto(
        elementos.totalFotos,
        fotos
    );

}


/* ============================================================
   REGISTRAR
   ============================================================ */

async function registrarEstudiante() {

    if (
        elementos.btnRegistrar?.disabled
    ) {

        return;

    }


    try {

        const datos =
            obtenerDatosFormulario();


        validarDatos(
            datos
        );


        cambiarEstadoBoton(
            elementos.btnRegistrar,
            true,
            "Guardando..."
        );


        const client =
            obtenerCliente();


        const existente =
            await buscarPorDocumento(
                datos.documento
            );


        if (existente) {

            throw new Error(
                "Ya existe un estudiante registrado con ese documento."
            );

        }


        const codigoqr =
            generarCodigoQR();


        let fotoURL =
            null;


        let fotoPath =
            null;


        if (
            estadoEstudiantes.fotoNueva
        ) {

            const subida =
                await subirFotografia(
                    estadoEstudiantes.fotoNueva,
                    datos.documento
                );


            fotoURL =
                subida.publicUrl;


            fotoPath =
                subida.path;

        }


        const registro = {

            nombre:
                datos.nombre,

            documento:
                datos.documento,

            curso:
                datos.curso,

            correo:
                datos.correo ||
                null,

            telefono:
                datos.telefono ||
                null,

            foto:
                fotoURL,

            codigoqr:
                codigoqr

        };


        const {
            data,
            error
        } =
            await client
                .from(
                    CONFIG_ESTUDIANTES.tabla
                )
                .insert(
                    registro
                )
                .select("*")
                .single();


        if (error) {

            if (fotoPath) {

                await eliminarFotografia(
                    fotoPath
                );

            }

            throw error;

        }


        estadoEstudiantes.seleccionado =
            data;


        await cargarEstudiantes();


        mostrarQR(
            data
        );


        limpiarFormulario(
            false
        );


        mostrarExito(
            "El estudiante fue registrado correctamente."
        );


    } catch (error) {

        console.error(
            "Error registrando:",
            error
        );


        mostrarError(
            obtenerMensajeError(
                error,
                "No se pudo registrar el estudiante."
            )
        );


    } finally {

        cambiarEstadoBoton(
            elementos.btnRegistrar,
            false,
            estadoEstudiantes.modoEdicion
                ? "Actualizar estudiante"
                : "Guardar estudiante"
        );

    }

}


/* ============================================================
   DATOS
   ============================================================ */

function obtenerDatosFormulario() {

    return {

        nombre:
            String(
                elementos.nombre?.value ||
                ""
            ).trim(),

        documento:
            String(
                elementos.documento?.value ||
                ""
            ).trim(),

        grado:
            String(
                elementos.grado?.value ||
                ""
            ).trim(),

        grupo:
            String(
                elementos.grupo?.value ||
                ""
            ).trim(),

        curso:
            [
                elementos.grado?.value,
                elementos.grupo?.value
            ]
                .filter(Boolean)
                .join("-"),

        correo:
            String(
                elementos.correo?.value ||
                ""
            ).trim(),

        telefono:
            String(
                elementos.telefono?.value ||
                ""
            ).trim()

    };

}


/* ============================================================
   VALIDACIÓN
   ============================================================ */

function validarDatos(
    datos
) {

    if (!datos.nombre) {

        throw new Error(
            "El nombre completo es obligatorio."
        );

    }


    if (!datos.documento) {

        throw new Error(
            "El documento es obligatorio."
        );

    }


    if (!datos.grado || !datos.grupo) {

        throw new Error(
            "Selecciona el grado y el grupo del estudiante."
        );

    }


    if (
        datos.nombre.length < 3
    ) {

        throw new Error(
            "El nombre debe tener al menos 3 caracteres."
        );

    }


    if (
        datos.documento.length < 3
    ) {

        throw new Error(
            "El documento no parece válido."
        );

    }


    if (
        datos.correo &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/
            .test(
                datos.correo
            )
    ) {

        throw new Error(
            "El correo electrónico no es válido."
        );

    }

}


/* ============================================================
   BUSCAR DOCUMENTO
   ============================================================ */

async function buscarPorDocumento(
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
                CONFIG_ESTUDIANTES.tabla
            )
            .select("*")
            .eq(
                "documento",
                documento
            )
            .maybeSingle();


    if (error) {

        throw error;

    }


    return data;

}


/* ============================================================
   FOTO
   ============================================================ */

function manejarSeleccionFoto(
    event
) {

    const archivo =
        event.target.files?.[0];


    if (!archivo) {

        return;

    }


    const tipos =
        [
            "image/jpeg",
            "image/png",
            "image/webp"
        ];


    const maximo =
        5 * 1024 * 1024;


    if (
        !tipos.includes(
            archivo.type
        )
    ) {

        mostrarAdvertencia(
            "La fotografía debe ser JPG, PNG o WEBP."
        );


        elementos.foto.value =
            "";


        return;

    }


    if (
        archivo.size > maximo
    ) {

        mostrarAdvertencia(
            "La fotografía no puede superar los 5 MB."
        );


        elementos.foto.value =
            "";


        return;

    }


    estadoEstudiantes.fotoNueva =
        archivo;


    const reader =
        new FileReader();


    reader.onload =
        eventReader => {

            if (
                !elementos.previewFoto
            ) {

                return;

            }


            elementos.previewFoto.onerror =
                null;


            elementos.previewFoto.src =
                eventReader.target.result;

        };


    reader.readAsDataURL(
        archivo
    );

}


function quitarFoto() {

    estadoEstudiantes.fotoNueva =
        null;


    estadoEstudiantes.fotoAnterior =
        null;


    if (
        elementos.foto
    ) {

        elementos.foto.value =
            "";

    }


    if (
        elementos.previewFoto
    ) {

        elementos.previewFoto.onerror =
            null;

        elementos.previewFoto.src =
            FOTO_DEFAULT;

    }

}


/* ============================================================
   SUBIR FOTO
   ============================================================ */

async function subirFotografia(
    archivo,
    documento
) {

    const client =
        obtenerCliente();


    const extension =
        obtenerExtension(
            archivo.name,
            archivo.type
        );


    const nombreSeguro =
        limpiarNombreArchivo(
            documento
        );


    const nombre =
        `${nombreSeguro}_${Date.now()}_${generarFragmento(8)}.${extension}`;


    const path =
        `${CONFIG_ESTUDIANTES.carpetaFotos}/${nombre}`;


    const {
        error
    } =
        await client
            .storage
            .from(
                CONFIG_ESTUDIANTES.bucket
            )
            .upload(
                path,
                archivo,
                {
                    cacheControl: "3600",
                    upsert: false,
                    contentType:
                        archivo.type
                }
            );


    if (error) {

        throw new Error(
            `No se pudo subir la fotografía: ${error.message}`
        );

    }


    const {
        data
    } =
        client
            .storage
            .from(
                CONFIG_ESTUDIANTES.bucket
            )
            .getPublicUrl(
                path
            );


    if (
        !data?.publicUrl
    ) {

        throw new Error(
            "No se pudo obtener la URL de la fotografía."
        );

    }


    return {

        path,

        publicUrl:
            data.publicUrl

    };

}


/* ============================================================
   ELIMINAR FOTO STORAGE
   ============================================================ */

async function eliminarFotografia(
    path
) {

    if (!path) {

        return;

    }


    try {

        const client =
            obtenerCliente();


        await client
            .storage
            .from(
                CONFIG_ESTUDIANTES.bucket
            )
            .remove(
                [path]
            );

    } catch (error) {

        console.warn(
            "No se pudo eliminar la fotografía:",
            error
        );

    }

}


/* ============================================================
   EDITAR
   ============================================================ */

function editarEstudiante(
    id
) {

    const estudiante =
        encontrarEstudiante(
            id
        );


    if (!estudiante) {

        mostrarError(
            "No se encontró el estudiante."
        );

        return;

    }


    estadoEstudiantes.seleccionado =
        estudiante;


    estadoEstudiantes.modoEdicion =
        true;


    estadoEstudiantes.fotoNueva =
        null;


    estadoEstudiantes.fotoAnterior =
        estudiante.foto ||
        null;


    elementos.nombre.value =
        estudiante.nombre ||
        "";


    elementos.documento.value =
        estudiante.documento ||
        "";


    const curso = String(
        estudiante.curso ||
        ""
    ).split("-");

    elementos.grado.value =
        curso[0] ||
        "";

    elementos.grupo.value =
        curso[1] ||
        "";


    elementos.correo.value =
        estudiante.correo ||
        "";


    elementos.telefono.value =
        estudiante.telefono ||
        "";


    elementos.foto.value =
        "";


    prepararImagen(
        elementos.previewFoto,
        estudiante.foto
    );


    if (
        elementos.btnRegistrar
    ) {

        elementos.btnRegistrar.innerHTML = `

            <i
                class="fa-solid fa-save"
            ></i>

            Actualizar estudiante

        `;

    }


    mostrarFormulario();

}


/* ============================================================
   ACTUALIZAR
   ============================================================ */

async function actualizarEstudiante() {

    const estudiante =
        estadoEstudiantes.seleccionado;


    if (!estudiante) {

        mostrarError(
            "No hay ningún estudiante seleccionado."
        );

        return;

    }


    try {

        const datos =
            obtenerDatosFormulario();


        validarDatos(
            datos
        );


        cambiarEstadoBoton(
            elementos.btnRegistrar,
            true,
            "Actualizando..."
        );


        const client =
            obtenerCliente();


        let fotoURL =
            estudiante.foto ||
            null;


        let fotoNuevaPath =
            null;


        if (
            estadoEstudiantes.fotoNueva
        ) {

            const subida =
                await subirFotografia(
                    estadoEstudiantes.fotoNueva,
                    datos.documento
                );


            fotoURL =
                subida.publicUrl;


            fotoNuevaPath =
                subida.path;

        }


        const cambios = {

            nombre:
                datos.nombre,

            documento:
                datos.documento,

            curso:
                datos.curso,

            correo:
                datos.correo ||
                null,

            telefono:
                datos.telefono ||
                null,

            foto:
                fotoURL

        };


        const {
            data,
            error
        } =
            await client
                .from(
                    CONFIG_ESTUDIANTES.tabla
                )
                .update(
                    cambios
                )
                .eq(
                    "id",
                    estudiante.id
                )
                .select("*")
                .single();


        if (error) {

            if (fotoNuevaPath) {

                await eliminarFotografia(
                    fotoNuevaPath
                );

            }

            throw error;

        }


        const fotoAnteriorPath =
            obtenerPathFotografia(
                estudiante.foto
            );


        if (
            fotoAnteriorPath &&
            fotoAnteriorPath !==
            fotoNuevaPath
        ) {

            await eliminarFotografia(
                fotoAnteriorPath
            );

        }


        estadoEstudiantes.seleccionado =
            data;


        estadoEstudiantes.modoEdicion =
            false;


        await cargarEstudiantes();


        limpiarFormulario(
            false
        );


        mostrarExito(
            "El estudiante fue actualizado correctamente."
        );


    } catch (error) {

        console.error(
            "Error actualizando:",
            error
        );


        mostrarError(
            obtenerMensajeError(
                error,
                "No se pudo actualizar el estudiante."
            )
        );


    } finally {

        cambiarEstadoBoton(
            elementos.btnRegistrar,
            false,
            "Guardar estudiante"
        );

    }

}


/* ============================================================
   ELIMINAR
   ============================================================ */

async function eliminarEstudiante(
    id
) {

    const estudiante =
        encontrarEstudiante(
            id
        );


    if (!estudiante) {

        mostrarError(
            "No se encontró el estudiante."
        );

        return;

    }


    let confirmado =
        false;


    if (
        typeof Swal !==
        "undefined"
    ) {

        const resultado =
            await Swal.fire({

                title:
                    "¿Eliminar estudiante?",

                html:
                    `
                        Se eliminará el registro de
                        <strong>
                            ${escaparHTML(estudiante.nombre)}
                        </strong>.
                    `,

                icon:
                    "warning",

                showCancelButton:
                    true,

                confirmButtonText:
                    "Sí, eliminar",

                cancelButtonText:
                    "Cancelar",

                confirmButtonColor:
                    "#d95757"

            });


        confirmado =
            resultado.isConfirmed;

    } else {

        confirmado =
            window.confirm(
                `¿Eliminar a ${estudiante.nombre}?`
            );

    }


    if (!confirmado) {

        return;

    }


    try {

        if (
            typeof Swal !==
            "undefined"
        ) {

            Swal.fire({

                title:
                    "Eliminando...",

                allowOutsideClick:
                    false,

                didOpen:
                    () =>
                        Swal.showLoading()

            });

        }


        const client =
            obtenerCliente();


        const {
            error
        } =
            await client
                .from(
                    CONFIG_ESTUDIANTES.tabla
                )
                .delete()
                .eq(
                    "id",
                    estudiante.id
                );


        if (error) {

            throw error;

        }


        const path =
            obtenerPathFotografia(
                estudiante.foto
            );


        if (path) {

            await eliminarFotografia(
                path
            );

        }


        await cargarEstudiantes();


        Swal?.close?.();


        mostrarExito(
            "El estudiante fue eliminado correctamente."
        );


    } catch (error) {

        Swal?.close?.();


        console.error(
            "Error eliminando:",
            error
        );


        mostrarError(
            obtenerMensajeError(
                error,
                "No se pudo eliminar el estudiante."
            )
        );

    }

}


/* ============================================================
   QR
   ============================================================ */

function generarCodigoQR() {

    return (
        `PUNTUALIXSCAN-${Date.now()}-` +
        generarFragmento(8)
    );

}


function generarFragmento(
    longitud = 6
) {

    const caracteres =
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";


    let resultado = "";


    for (
        let i = 0;
        i < longitud;
        i++
    ) {

        resultado +=
            caracteres.charAt(
                Math.floor(
                    Math.random() *
                    caracteres.length
                )
            );

    }


    return resultado;

}


/* ============================================================
   MOSTRAR QR
   ============================================================ */

function mostrarQR(
    estudiante
) {

    if (!estudiante) {

        return;

    }


    estadoEstudiantes.seleccionado =
        estudiante;


    actualizarTexto(
        elementos.nombreQR,
        estudiante.nombre ||
        ""
    );


    actualizarTexto(
        elementos.cursoQR,
        estudiante.curso ||
        ""
    );


    actualizarTexto(
        elementos.documentoQR,
        estudiante.documento ||
        ""
    );

    actualizarTexto(
        elementos.codigoUnicoQR,
        estudiante.codigoqr ||
        estudiante.documento ||
        estudiante.id ||
        ""
    );


    prepararImagen(
        elementos.fotoQR,
        estudiante.foto
    );


    if (
        elementos.codigoQR
    ) {

        elementos.codigoQR.innerHTML =
            "";


        if (
            typeof QRCode ===
            "undefined"
        ) {

            elementos.codigoQR.innerHTML = `

                <p>
                    No se pudo cargar el generador QR.
                </p>

            `;

        } else {

            const texto =
                estudiante.codigoqr ||
                estudiante.documento ||
                estudiante.id;


            estadoEstudiantes.qr =
                new QRCode(
                    elementos.codigoQR,
                    {

                        text:
                            String(texto),

                        width:
                            200,

                        height:
                            200,

                        correctLevel:
                            QRCode.CorrectLevel.H

                    }
                );

        }

    }


    elementos.modalQR?.classList.remove(
        "oculto"
    );

}


/* ============================================================
   VER QR
   ============================================================ */

function verQRPorId(
    id
) {

    const estudiante =
        encontrarEstudiante(
            id
        );


    if (!estudiante) {

        mostrarError(
            "No se encontró el estudiante."
        );

        return;

    }


    mostrarQR(
        estudiante
    );

}


/* ============================================================
   CERRAR QR
   ============================================================ */

function cerrarModalQR() {

    elementos.modalQR?.classList.add(
        "oculto"
    );


    if (
        elementos.codigoQR
    ) {

        elementos.codigoQR.innerHTML =
            "";

    }


    estadoEstudiantes.qr =
        null;

}


/* ============================================================
   DESCARGAR QR
   ============================================================ */

function descargarQR() {

    const estudiante =
        estadoEstudiantes.seleccionado;


    if (
        !estudiante ||
        !elementos.codigoQR
    ) {

        mostrarAdvertencia(
            "Selecciona primero un estudiante."
        );

        return;

    }


    const canvas =
        elementos.codigoQR.querySelector(
            "canvas"
        );


    const imagen =
        elementos.codigoQR.querySelector(
            "img"
        );


    let url = "";


    if (canvas) {

        url =
            canvas.toDataURL(
                "image/png"
            );

    } else if (imagen) {

        url =
            imagen.src;

    }


    if (!url) {

        mostrarError(
            "No se pudo preparar el QR."
        );

        return;

    }


    const enlace =
        document.createElement(
            "a"
        );


    enlace.href =
        url;


    enlace.download =
        `QR_${limpiarNombreArchivo(
            estudiante.nombre
        )}.png`;


    document.body.appendChild(
        enlace
    );


    enlace.click();


    enlace.remove();

}


/* ============================================================
   IMPRIMIR QR
   ============================================================ */

function imprimirQR() {

    const estudiante =
        estadoEstudiantes.seleccionado;


    if (
        !estudiante ||
        !elementos.codigoQR
    ) {

        mostrarAdvertencia(
            "Selecciona primero un estudiante."
        );

        return;

    }


    const canvas =
        elementos.codigoQR.querySelector(
            "canvas"
        );


    const imagen =
        elementos.codigoQR.querySelector(
            "img"
        );


    let src = "";


    if (canvas) {

        src =
            canvas.toDataURL(
                "image/png"
            );

    } else if (imagen) {

        src =
            imagen.src;

    }


    if (!src) {

        mostrarError(
            "No se pudo preparar el QR para imprimir."
        );

        return;

    }


    const ventana =
        window.open(
            "",
            "_blank",
            "width=700,height=800"
        );


    if (!ventana) {

        mostrarAdvertencia(
            "El navegador bloqueó la ventana de impresión."
        );

        return;

    }


    ventana.document.write(`

        <!DOCTYPE html>

        <html lang="es">

        <head>

            <meta charset="UTF-8">

            <title>
                QR - ${escaparHTML(
                    estudiante.nombre
                )}
            </title>

            <style>

                body {

                    font-family:
                        Arial,
                        sans-serif;

                    text-align:
                        center;

                    padding:
                        40px;

                }

                h1 {

                    color:
                        #123b85;

                }

                img {

                    width:
                        280px;

                    height:
                        280px;

                    object-fit:
                        contain;

                }

            </style>

        </head>

        <body>

            <h1>
                Puntualixscan
            </h1>

            <h2>
                ${escaparHTML(
                    estudiante.nombre
                )}
            </h2>

            <p>
                Documento:
                ${escaparHTML(
                    estudiante.documento
                )}
            </p>

            <p>
                Curso:
                ${escaparHTML(
                    estudiante.curso
                )}
            </p>

            <img
                src="${escaparAtributo(src)}"
                alt="Código QR"
            >

            <script>

                window.onload =
                    function() {

                        window.print();

                    };

            <\/script>

        </body>

        </html>

    `);


    ventana.document.close();

}


/* ============================================================
   CREDENCIAL
   ============================================================ */

function abrirCredencial() {

    const estudiante =
        estadoEstudiantes.seleccionado;


    if (!estudiante) {

        mostrarAdvertencia(
            "Selecciona primero un estudiante."
        );

        return;

    }


    try {

        localStorage.setItem(
            "estudianteCredencial",
            JSON.stringify(
                estudiante
            )
        );

    } catch (error) {

        console.warn(
            "No se pudo guardar la credencial:",
            error
        );

    }


    window.location.href =
        CONFIG_ESTUDIANTES.credencial;

}


/* ============================================================
   LIMPIAR FORMULARIO
   ============================================================ */

function limpiarFormulario(
    mostrarMensaje = true
) {

    elementos.formulario?.reset();


    estadoEstudiantes.fotoNueva =
        null;


    estadoEstudiantes.fotoAnterior =
        null;


    estadoEstudiantes.seleccionado =
        null;


    estadoEstudiantes.modoEdicion =
        false;


    if (
        elementos.previewFoto
    ) {

        elementos.previewFoto.onerror =
            null;

        elementos.previewFoto.src =
            FOTO_DEFAULT;

    }


    if (
        elementos.btnRegistrar
    ) {

        elementos.btnRegistrar.disabled =
            false;


        elementos.btnRegistrar.innerHTML = `

            <i
                class="fa-solid fa-user-plus"
            ></i>

            Guardar estudiante

        `;

    }


    if (mostrarMensaje) {

        mostrarExito(
            "Formulario limpiado correctamente."
        );

    }

}


/* ============================================================
   MOSTRAR FORMULARIO
   ============================================================ */

function mostrarFormulario() {

    elementos.formulario?.scrollIntoView({

        behavior:
            "smooth",

        block:
            "start"

    });

}


/* ============================================================
   ESTADÍSTICAS / HELPERS
   ============================================================ */

function encontrarEstudiante(
    id
) {

    return estadoEstudiantes.estudiantes.find(
        estudiante =>
            String(
                estudiante.id
            ) ===
            String(id)
    );

}


function actualizarTexto(
    elemento,
    valor
) {

    if (elemento) {

        elemento.textContent =
            String(
                valor ?? ""
            );

    }

}


/* ============================================================
   IMÁGENES SEGURAS
   ============================================================ */

function obtenerFoto(
    url
) {

    if (
        !url ||
        !String(url).trim() ||
        url ===
        "imagenes/usuario.png"
    ) {

        return FOTO_DEFAULT;

    }


    return String(
        url
    ).trim();

}


function prepararImagen(
    imagen,
    src
) {

    if (!imagen) {

        return;

    }


    imagen.onerror =
        () => {

            imagen.onerror =
                null;

            imagen.src =
                FOTO_DEFAULT;

        };


    imagen.src =
        obtenerFoto(src);

}


function prepararImagenInicial() {

    prepararImagen(
        elementos.previewFoto,
        null
    );


    prepararImagen(
        elementos.fotoQR,
        null
    );

}


/* ============================================================
   EXTENSIÓN
   ============================================================ */

function obtenerExtension(
    nombre,
    tipo
) {

    const extension =
        String(
            nombre || ""
        )
            .split(".")
            .pop()
            .toLowerCase();


    if (
        [
            "jpg",
            "jpeg",
            "png",
            "webp"
        ].includes(extension)
    ) {

        return extension ===
            "jpeg"
            ? "jpg"
            : extension;

    }


    if (
        tipo ===
        "image/png"
    ) {

        return "png";

    }


    if (
        tipo ===
        "image/webp"
    ) {

        return "webp";

    }


    return "jpg";

}


/* ============================================================
   PATH STORAGE
   ============================================================ */

function obtenerPathFotografia(
    url
) {

    if (!url) {

        return null;

    }


    const valor =
        String(url);


    const marcador =
        `/storage/v1/object/public/${CONFIG_ESTUDIANTES.bucket}/`;


    const posicion =
        valor.indexOf(
            marcador
        );


    if (
        posicion === -1
    ) {

        return null;

    }


    return decodeURIComponent(
        valor.substring(
            posicion +
            marcador.length
        )
    );

}


/* ============================================================
   NOMBRE DE ARCHIVO
   ============================================================ */

function limpiarNombreArchivo(
    valor
) {

    return normalizar(
        valor
    )
        .replace(
            /[^a-z0-9_-]/g,
            "_"
        )
        .replace(
            /_+/g,
            "_"
        )
        .replace(
            /^_+|_+$/g,
            ""
        )
        .substring(
            0,
            80
        ) ||
        "estudiante";

}


/* ============================================================
   NORMALIZAR
   ============================================================ */

function normalizar(
    valor
) {

    return String(
        valor ?? ""
    )
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        );

}


/* ============================================================
   ESCAPAR HTML
   ============================================================ */

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


function escaparAtributo(
    valor
) {

    return escaparHTML(
        valor
    );

}


/* ============================================================
   CARGA VISUAL
   ============================================================ */

function mostrarCargaTabla() {

    if (!elementos.tabla) {

        return;

    }


    elementos.tabla.innerHTML = `

        <tr>

            <td colspan="6">

                <div class="tabla-vacia">

                    <i
                        class="fa-solid fa-spinner fa-spin"
                    ></i>

                    Cargando estudiantes...

                </div>

            </td>

        </tr>

    `;

}


/* ============================================================
   BOTONES
   ============================================================ */

function cambiarEstadoBoton(
    boton,
    cargando,
    texto
) {

    if (!boton) {

        return;

    }


    if (cargando) {

        boton.disabled =
            true;


        boton.dataset.textoOriginal =
            boton.innerHTML;


        boton.innerHTML = `

            <i
                class="fa-solid fa-spinner fa-spin"
            ></i>

            ${texto}

        `;

    } else {

        boton.disabled =
            false;


        boton.innerHTML =
            texto;

    }

}


/* ============================================================
   MENSAJES
   ============================================================ */

function mostrarExito(
    mensaje
) {

    if (
        typeof Swal !==
        "undefined"
    ) {

        Swal.fire({

            icon:
                "success",

            title:
                "Operación exitosa",

            text:
                mensaje,

            confirmButtonText:
                "Aceptar",

            confirmButtonColor:
                "#123b85"

        });

        return;

    }


    window.alert(
        mensaje
    );

}


function mostrarAdvertencia(
    mensaje
) {

    if (
        typeof Swal !==
        "undefined"
    ) {

        Swal.fire({

            icon:
                "warning",

            title:
                "Atención",

            text:
                mensaje,

            confirmButtonText:
                "Aceptar",

            confirmButtonColor:
                "#123b85"

        });

        return;

    }


    window.alert(
        mensaje
    );

}


function mostrarError(
    mensaje
) {

    if (
        typeof Swal !==
        "undefined"
    ) {

        Swal.fire({

            icon:
                "error",

            title:
                "No se pudo completar",

            text:
                mensaje,

            confirmButtonText:
                "Aceptar",

            confirmButtonColor:
                "#123b85"

        });

        return;

    }


    window.alert(
        mensaje
    );

}


/* ============================================================
   MENSAJES SUPABASE
   ============================================================ */

function obtenerMensajeError(
    error,
    fallback
) {

    if (!error) {

        return fallback;

    }


    const texto =
        String(
            error.message ||
            error.error_description ||
            error.details ||
            fallback
        );


    if (
        /row-level security/i
            .test(texto)
    ) {

        return (
            "Supabase bloqueó esta operación por una política de seguridad (RLS)."
        );

    }


    if (
        /bucket/i.test(texto) &&
        /not found/i.test(texto)
    ) {

        return (
            `No se encontró el bucket "${CONFIG_ESTUDIANTES.bucket}".`
        );

    }


    if (
        /permission|unauthorized|forbidden/i
            .test(texto)
    ) {

        return (
            "Supabase no permite realizar esta operación. Revisa las políticas de seguridad."
        );

    }


    return texto;

}


/* ============================================================
   SESIÓN
   ============================================================ */

async function cerrarSesion(
    event
) {

    event?.preventDefault();


    try {

        if (
            window.PUNTUALIXSCAN?.auth?.logout
        ) {

            await window.PUNTUALIXSCAN.auth.logout({

                redirectTo:
                    CONFIG_ESTUDIANTES.login

            });

            return;

        }


        const client =
            obtenerCliente();


        await client.auth.signOut();


        localStorage.removeItem(
            "usuario"
        );


        window.location.replace(
            CONFIG_ESTUDIANTES.login
        );

    } catch (error) {

        console.error(
            "Error cerrando sesión:",
            error
        );


        localStorage.removeItem(
            "usuario"
        );


        window.location.replace(
            CONFIG_ESTUDIANTES.login
        );

    }

}


/* ============================================================
   FUNCIONES GLOBALES
   Compatibilidad con HTML
   ============================================================ */

window.verQRPorId =
    verQRPorId;

window.editarEstudiante =
    editarEstudiante;

window.eliminarEstudiante =
    eliminarEstudiante;

window.cerrarModalQR =
    cerrarModalQR;

window.descargarQR =
    descargarQR;

window.imprimirQR =
    imprimirQR;

window.registrarEstudiante =
    registrarEstudiante;

window.actualizarEstudiante =
    actualizarEstudiante;

window.limpiarFormulario =
    limpiarFormulario;

window.quitarFoto =
    quitarFoto;

window.mostrarQR =
    mostrarQR;


/* ============================================================
   API DEL MÓDULO
   ============================================================ */

window.estudiantesApp = {

    cargar:
        cargarEstudiantes,

    registrar:
        registrarEstudiante,

    actualizar:
        actualizarEstudiante,

    editar:
        editarEstudiante,

    eliminar:
        eliminarEstudiante,

    verQR:
        verQRPorId,

    cerrarQR:
        cerrarModalQR,

    limpiar:
        limpiarFormulario

};