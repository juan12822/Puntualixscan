"use strict";

(function iniciarPerfil() {
    const FOTO_PERFIL_PREDETERMINADA =
        "data:image/svg+xml;charset=UTF-8," +
        encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" rx="50" fill="#eaf1ff"/><circle cx="50" cy="36" r="19" fill="#123b85"/><path d="M18 88c3-23 16-34 32-34s29 11 32 34" fill="#123b85"/></svg>');
    const claveUsuario = "usuario";
    const usuarioInicial = leerUsuarioLocal();
    let client = null;
    let avatarActual = leerAvatarLocal();
    let avatarDeCuenta = Boolean(
        avatarActual &&
        (usuarioInicial?.avatar_origen === "cuenta" || avatarActual.startsWith("data:image/"))
    );

    function validarAvatar(url) {
        if (typeof url !== "string") return false;
        if (/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(url)) {
            return true;
        }
        try {
            return ["http:", "https:"].includes(new URL(url).protocol);
        } catch {
            return false;
        }
    }

    function leerUsuarioLocal() {
        try {
            return JSON.parse(localStorage.getItem(claveUsuario) || "null");
        } catch (error) {
            console.warn("No se pudo recuperar el perfil local:", error);
            return null;
        }
    }

    function leerAvatarLocal() {
        const usuario = leerUsuarioLocal();
        return validarAvatar(usuario?.avatar_url) ? usuario.avatar_url : "";
    }

    function guardarAvatarLocal(url, origen) {
        try {
            const usuario = leerUsuarioLocal();
            if (!usuario) return;
            usuario.avatar_url = url;
            usuario.avatar_origen = url ? origen : "";
            localStorage.setItem(claveUsuario, JSON.stringify(usuario));
        } catch (error) {
            console.warn("No se pudo conservar la foto de perfil localmente:", error);
        }
    }

    /*
     * La foto de perfil NO se guarda en user_metadata: Supabase copia ese
     * metadato dentro del token de sesión y una imagen en base64 lo vuelve tan
     * grande (decenas de miles de caracteres) que Storage rechaza las
     * peticiones con "400 Bad Request". Se conserva solo en este navegador,
     * separada por usuario, y sobrevive al cierre de sesión.
     */
    const PREFIJO_AVATAR_LOCAL = "puntualixscan.avatar.";

    function leerAvatarPersistente() {
        try {
            const id = leerUsuarioLocal()?.id;
            if (!id) return "";
            const url = localStorage.getItem(PREFIJO_AVATAR_LOCAL + id) || "";
            return validarAvatar(url) ? url : "";
        } catch (error) {
            return "";
        }
    }

    function guardarAvatarPersistente(url) {
        try {
            const id = leerUsuarioLocal()?.id;
            if (!id) return;
            if (url) {
                localStorage.setItem(PREFIJO_AVATAR_LOCAL + id, url);
            } else {
                localStorage.removeItem(PREFIJO_AVATAR_LOCAL + id);
            }
        } catch (error) {
            console.warn("No se pudo conservar la foto de perfil en este navegador:", error);
        }
    }

    async function limpiarAvatarDeMetadata() {
        if (!client) return;
        try {
            const { error } = await client.auth.updateUser({ data: { avatar_url: null } });
            if (error) throw error;
            await client.auth.refreshSession();
        } catch (error) {
            console.warn("No se pudo quitar la foto antigua del token de sesión:", error);
        }
    }

    function aplicarAvatarAImagen(imagen, url) {
        if (!imagen || imagen.getAttribute("src") === url) return;

        if (!imagen.hasAttribute("data-profile-fallback")) {
            imagen.dataset.profileFallback =
                imagen.getAttribute("src") || FOTO_PERFIL_PREDETERMINADA;
            imagen.addEventListener("error", () => {
                const failedUrl = imagen.dataset.profileAvatar;
                if (!failedUrl || imagen.getAttribute("src") !== failedUrl) return;

                imagen.removeAttribute("data-profile-avatar");
                imagen.setAttribute(
                    "src",
                    imagen.dataset.profileFallback || FOTO_PERFIL_PREDETERMINADA
                );
                if (avatarActual === failedUrl) {
                    avatarActual = "";
                    avatarDeCuenta = false;
                    guardarAvatarLocal("", "");
                }
            });
        }

        imagen.dataset.profileAvatar = url;
        imagen.setAttribute("src", url);
    }

    function aplicarAvatar(url) {
        if (!validarAvatar(url)) return;
        avatarActual = url;
        document.querySelectorAll(".usuario > img").forEach(imagen => {
            aplicarAvatarAImagen(imagen, url);
        });
        const vistaPrevia = document.getElementById("vistaPreviaFotoPerfil");
        if (vistaPrevia && vistaPrevia.getAttribute("src") !== url) {
            vistaPrevia.setAttribute("src", url);
        }
    }

    function actualizarAvatar(url, origen) {
        if (!validarAvatar(url)) return false;
        if (origen === "perfil-estudiante" && avatarDeCuenta) return false;

        if (origen === "cuenta") {
            avatarDeCuenta = true;
        }
        aplicarAvatar(url);
        guardarAvatarLocal(url, origen);
        return true;
    }

    function sincronizarAvatarCuenta(url) {
        const remota = validarAvatar(url) && !/^data:/i.test(url) ? url : "";
        const elegido = remota || leerAvatarPersistente() || (validarAvatar(url) ? url : "");
        if (elegido) {
            avatarDeCuenta = true;
            aplicarAvatar(elegido);
            guardarAvatarLocal(elegido, "cuenta");
            if (!remota) guardarAvatarPersistente(elegido);
            return;
        }

        avatarActual = "";
        avatarDeCuenta = false;
        document.querySelectorAll(".usuario > img").forEach(imagen => {
            imagen.removeAttribute("data-profile-avatar");
            imagen.setAttribute(
                "src",
                imagen.dataset.profileFallback ||
                    imagen.getAttribute("src") ||
                    FOTO_PERFIL_PREDETERMINADA
            );
        });
        const vistaPrevia = document.getElementById("vistaPreviaFotoPerfil");
        if (vistaPrevia) {
            vistaPrevia.setAttribute("src", FOTO_PERFIL_PREDETERMINADA);
        }
        guardarAvatarLocal("", "");
    }

    function comprimirImagen(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(reader.error || new Error("No se pudo leer la imagen."));
            reader.onload = () => {
                const image = new Image();
                image.onerror = () => reject(new Error("El archivo seleccionado no es una imagen válida."));
                image.onload = () => {
                    const maxDimension = 192;
                    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.max(1, Math.round(image.width * scale));
                    canvas.height = Math.max(1, Math.round(image.height * scale));
                    const context = canvas.getContext("2d");
                    if (!context) {
                        reject(new Error("El navegador no pudo procesar la imagen."));
                        return;
                    }
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    resolve(canvas.toDataURL("image/jpeg", 0.75));
                };
                image.src = String(reader.result);
            };
            reader.readAsDataURL(file);
        });
    }

    async function guardarFoto() {
        const estado = document.getElementById("estadoFotoPerfil");
        const guardar = document.getElementById("btnGuardarFotoPerfil");
        const archivo = document.getElementById("archivoFotoPerfil");
        const fotoPendiente = document.getElementById("vistaPreviaFotoPerfil")?.dataset.pendingAvatar;
        if (!fotoPendiente) return;
        if (!client) {
            estado.textContent = "No se pudo conectar con el servicio de autenticación.";
            return;
        }

        guardar.disabled = true;
        estado.textContent = "Guardando foto...";
        try {
            const { data: userData, error: userError } = await client.auth.getUser();
            if (userError) throw userError;
            if (!userData?.user) {
                throw new Error("Inicia sesión nuevamente para guardar tu foto.");
            }

            actualizarAvatar(fotoPendiente, "cuenta");
            guardarAvatarPersistente(fotoPendiente);
            if (typeof userData.user.user_metadata?.avatar_url === "string" &&
                /^data:/i.test(userData.user.user_metadata.avatar_url)) {
                await limpiarAvatarDeMetadata();
            }
            document.getElementById("vistaPreviaFotoPerfil").removeAttribute("data-pending-avatar");
            archivo.value = "";
            estado.textContent = "Foto de perfil actualizada en este dispositivo.";
        } catch (error) {
            console.error("No se pudo guardar la foto de perfil:", error);
            estado.textContent = error.message || "No se pudo guardar la foto de perfil.";
        } finally {
            guardar.disabled = !document.getElementById("vistaPreviaFotoPerfil")?.dataset.pendingAvatar;
        }
    }

    async function cargarAvatarDeCuenta() {
        if (!client) return;
        try {
            const { data: sessionData, error: sessionError } = await client.auth.getSession();
            if (sessionError) throw sessionError;
            if (!sessionData?.session) return;

            const { data, error } = await client.auth.getUser();
            if (error) throw error;
            const avatar = data?.user?.user_metadata?.avatar_url;
            if (typeof avatar === "string" && /^data:/i.test(avatar)) {
                if (!leerAvatarPersistente() && validarAvatar(avatar)) {
                    guardarAvatarPersistente(avatar);
                }
                const conservada = leerAvatarPersistente();
                if (conservada) actualizarAvatar(conservada, "cuenta");
                await limpiarAvatarDeMetadata();
                return;
            }
            if (validarAvatar(avatar)) {
                actualizarAvatar(avatar, "cuenta");
            } else {
                const conservada = leerAvatarPersistente();
                if (conservada) actualizarAvatar(conservada, "cuenta");
            }
        } catch (error) {
            console.warn("No se pudo comprobar la foto de perfil en la cuenta:", error);
        }
    }

    function configurarFormularioPerfil() {
        const archivo = document.getElementById("archivoFotoPerfil");
        const elegir = document.getElementById("btnElegirFotoPerfil");
        const guardar = document.getElementById("btnGuardarFotoPerfil");
        const vistaPrevia = document.getElementById("vistaPreviaFotoPerfil");
        const estado = document.getElementById("estadoFotoPerfil");

        if (vistaPrevia && !vistaPrevia.getAttribute("src")) {
            vistaPrevia.setAttribute("src", FOTO_PERFIL_PREDETERMINADA);
        }
        elegir?.addEventListener("click", () => archivo?.click());
        archivo?.addEventListener("change", async () => {
            const file = archivo.files?.[0];
            if (!file) return;

            if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
                guardar.disabled = true;
                estado.textContent = "Selecciona una imagen JPG, PNG o WebP.";
                archivo.value = "";
                return;
            }
            if (file.size > 5 * 1024 * 1024) {
                guardar.disabled = true;
                estado.textContent = "La imagen no puede superar los 5 MB.";
                archivo.value = "";
                return;
            }

            estado.textContent = "Preparando imagen...";
            try {
                const imagen = await comprimirImagen(file);
                vistaPrevia.dataset.pendingAvatar = imagen;
                vistaPrevia.setAttribute("src", imagen);
                guardar.disabled = false;
                estado.textContent = "Vista previa lista. Guarda para aplicar la foto.";
            } catch (error) {
                console.error("No se pudo preparar la foto de perfil:", error);
                estado.textContent = error.message || "No se pudo preparar la foto.";
            }
        });
        guardar?.addEventListener("click", guardarFoto);
    }

    function iniciarDOM() {
        configurarFormularioPerfil();
        client = window.PUNTUALIXSCAN?.client || null;
        cargarAvatarDeCuenta();
    }

    window.PUNTUALIXSCAN = window.PUNTUALIXSCAN || {};
    window.PUNTUALIXSCAN.perfil = {
        actualizarDesdePerfilEstudiante: url => actualizarAvatar(url, "perfil-estudiante"),
        sincronizarAvatarCuenta
    };

    if (avatarActual) {
        document.querySelectorAll(".usuario > img").forEach(imagen => {
            aplicarAvatarAImagen(imagen, avatarActual);
        });
    }

    const observerInicial = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(nodo => {
                if (nodo.nodeType !== Node.ELEMENT_NODE) return;
                if (nodo.matches(".usuario > img") && avatarActual) {
                    aplicarAvatarAImagen(nodo, avatarActual);
                }
                nodo.querySelectorAll(".usuario > img").forEach(imagen => {
                    if (avatarActual) aplicarAvatarAImagen(imagen, avatarActual);
                });
            });
        });
    });
    observerInicial.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciarDOM, { once: true });
    } else {
        iniciarDOM();
    }
})();