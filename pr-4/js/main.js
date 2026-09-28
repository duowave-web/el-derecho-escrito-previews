/* ==========================================================================
   El Derecho Escrito — JS mínimo.
   El contenido está escrito directamente en el HTML (mejor para SEO). Este
   script solo enriquece lo que ya existe: filtra el listado, arma el índice
   lateral y pinta el progreso de lectura. Sin JavaScript la página se lee
   entera igual; lo único que no aparece es el índice, que es navegación.

   Cada bloque comprueba sus propios elementos, así que una misma copia del
   archivo sirve para todas las páginas.
   ========================================================================== */

(function () {
  "use strict";

  // Año dinámico en el pie
  const anio = document.getElementById("anio");
  if (anio) anio.textContent = new Date().getFullYear();

  buscadorDeArticulos();
  buscadorDeCabecera();
  lineaDeCabecera();
  barraDeProgreso();
  fondoDePortada();
  copiarEnlace();
  articulosRelacionados();

  /* ---------------------------------------------------- Buscador ------- */

  /* El listado ya no tiene campo propio: el buscador vive en la cabecera y
     envía aquí por GET. Esta función es el otro extremo de ese formulario, así
     que aunque no haya nada que escribir en esta página, sigue haciendo falta:
     sin ella la lupa de la cabecera manda a una página que no le escucha. */

  function buscadorDeArticulos() {
    const contenedor = document.getElementById("entradas");
    if (!contenedor) return;

    /* Se excluye la tarjeta de espera: no es un artículo, así que ni se filtra
       ni la cuenta el contador. Se ve siempre, y lo único que hace más abajo es
       sumar uno a data-visibles. */

    const POR_PAGINA = 9;

    const proxima = contenedor.querySelector(".tarjeta--proxima");
    const contador = document.getElementById("contador");
    const aviso = document.getElementById("filtro-aviso");
    const navPaginas = document.getElementById("paginacion");

    /* El orden lo manda la fecha del <time>, no el orden del marcado, para que
       un despiste al publicar no cambie la portada del listado.

       Pero el marcado TAMBIÉN tiene que estar en orden, y no es redundante: sin
       JavaScript no hay quien reordene nada, así que ahí se ve tal cual está
       escrito. El sort protege el caso normal; la convención protege el
       respaldo. Está anotado en CLAUDE.md.

       Se reordena el DOM y no solo el array: así el orden visual, el de
       tabulación y el de lectura de un lector de pantalla siguen coincidiendo.

       La tarjeta de espera no tiene <time>, así que queda fuera y se vuelve a
       poner al final. */

    const entradas = Array.prototype.slice
      .call(contenedor.querySelectorAll(".tarjeta:not(.tarjeta--proxima)"))
      .sort(function (a, b) {
        const fa = a.querySelector("time");
        const fb = b.querySelector("time");
        return (fb ? fb.getAttribute("datetime") : "").localeCompare(
          fa ? fa.getAttribute("datetime") : ""
        );
      });

    entradas.forEach(function (el) {
      contenedor.appendChild(el);
    });
    if (proxima) contenedor.appendChild(proxima);

    // Índice de texto precalculado
    const indice = entradas.map(function (el) {
      return normalizar(el.textContent);
    });

    /* Cuenta el total que pasa los filtros, no lo que cabe en la página: quien
       lee «12 resultados» quiere saber cuántos hay, y cuántos ve a la vez se lo
       dice la paginación de abajo.

       QUÉ DECIDE LA PALABRA es si hay algún filtro puesto, NO si el número
       coincide con el total. Antes se comparaba el número, y con tres ejes
       combinables eso miente cada vez que un filtro deja pasar a todos: con dos
       etiquetas que entre las dos cubran el archivo entero, el contador decía
       «4 artículos publicados» y se leía como si no hubiera filtro ninguno.

       Ahora «publicados» queda reservado a la lista sin tocar, que es la única
       situación en la que ese número describe el archivo. En cuanto hay
       búsqueda, categoría o etiquetas, lo que se cuenta son resultados —los
       haya todos, algunos o ninguno.

       Es además el único sitio donde vive el estado vacío: no hay ningún
       párrafo debajo que lo repita, así que si algún día se quiere un vacío más
       cálido se cambia esta cadena y no se añade un elemento nuevo. */

    function actualizarContador(n) {
      if (!contador) return;

      const hayFiltro =
        Boolean(consultaActiva.trim()) ||
        categoriaActiva !== "todos" ||
        etiquetasActivas.length > 0;

      contador.textContent = hayFiltro
        ? n + (n === 1 ? " resultado" : " resultados")
        : n + (n === 1 ? " artículo publicado" : " artículos publicados");
    }

    /* Tres criterios que se acumulan, no se pisan: la búsqueda llega por ?q=
       desde la cabecera, la categoría por los botones o por ?categoria=, y la
       página por ?pagina=. Estado guardado aquí, en un sitio, para que el
       recuento no dependa de quién movió qué el último.

       El orden de las operaciones importa: primero se filtra, después se
       pagina. Así «Fundamento, página 2» es la página 2 DE LOS DE FUNDAMENTO.
       Al revés no querría decir nada. */

    let consultaActiva = "";
    let categoriaActiva = "todos";
    let etiquetasActivas = [];
    let paginaActiva = 1;

    /* Las etiquetas de una tarjeta, en clave. El atributo guarda el TEXTO
       VISIBLE —«Garantías»— porque de ahí sale también el nombre de la casilla y
       el de la píldora, y los acentos no se pueden reconstruir a partir de una
       clave. Para comparar se normaliza aquí, que es lo mismo que hace el bloque
       de relacionados. */

    function etiquetasDe(el) {
      return (el.getAttribute("data-etiquetas") || "")
        .split(",")
        .map(function (t) {
          return normalizar(t.trim());
        })
        .filter(Boolean);
    }

    function aplicar() {
      const q = normalizar(consultaActiva.trim());

      const coincidentes = entradas.filter(function (el, i) {
        const porTexto = !q || indice[i].indexOf(q) !== -1;
        const porCategoria =
          categoriaActiva === "todos" ||
          el.getAttribute("data-categoria") === categoriaActiva;

        /* Y entre criterios, O dentro de las etiquetas: pasa el artículo que
           tenga ALGUNA de las marcadas, no todas.

           Es la convención de filtros por facetas, y aquí hay además una razón
           de escala: con Y, marcar dos etiquetas que no coincidan en ningún
           artículo daría cero al instante —con cuatro entradas es lo normal— y
           el control parecería roto. Con O, marcar más amplía, que es lo que se
           espera de un grupo de casillas. */

        const suyas = etiquetasDe(el);
        const porEtiquetas =
          !etiquetasActivas.length ||
          etiquetasActivas.some(function (t) {
            return suyas.indexOf(t) !== -1;
          });

        return porTexto && porCategoria && porEtiquetas;
      });

      /* Una página que no existe no da una lista vacía: se ajusta a la última
         que sí existe. Y como entonces la URL estaría mintiendo, se corrige.
         Nunca un callejón sin salida. */

      const totalPaginas = Math.max(1, Math.ceil(coincidentes.length / POR_PAGINA));
      if (paginaActiva > totalPaginas) {
        paginaActiva = totalPaginas;
        sincronizarURL();
      }

      const desde = (paginaActiva - 1) * POR_PAGINA;
      const enPagina = coincidentes.slice(desde, desde + POR_PAGINA);

      entradas.forEach(function (el) {
        el.hidden = true;
      });
      enPagina.forEach(function (el) {
        el.hidden = false;
      });

      /* Aquí se mostraba y se escondía un mensaje de «no hay ningún artículo».
         No queda nada que hacer con el vacío: lo dice actualizarContador(), más
         abajo, que ya se llama en todas las pasadas y no solo cuando el número
         es cero. Un solo sitio, y además el que lleva aria-live. */

      /* La tarjeta de espera ya no se esconde nunca. Dejó de ser una respuesta
         —que era lo que la ataba a un caso concreto— para ser lo que cierra la
         rejilla, y eso vale igual con filtro, con búsqueda y en cualquier
         página.

         Va en TODAS las páginas y no solo en la primera. Se sostuvo un tiempo
         que la primera era su sitio porque ahí está lo más reciente y
         «próximamente» apunta hacia delante, mientras que el final de la lista
         es lo más antiguo. Ese argumento vale mientras la tarjeta sea una pieza
         del contenido, y deja de valer en cuanto es mobiliario: restringir las
         páginas reintroduciría justo el tipo de condición que este cambio
         quita, y una tarjeta que aparece y desaparece según dónde estés no
         puede explicar por qué.

         Sigue sin ser un resultado: no lleva data-categoria, no entra en
         entradas[] y por tanto el contador no la ve. Lo único que suma es la
         cuenta de lo que hay a la vista, que es cosa del centrado. */

      let visiblesEnRejilla = enPagina.length;

      if (proxima) {
        proxima.hidden = false;
        visiblesEnRejilla++;
      }

      /* Cuántas tarjetas se ven de verdad, para que el centrado de la rejilla
         pueda contarlas. El CSS lo resuelve con :has(> :nth-child(2)), que
         cuenta hijos del DOM y no sabe nada de cuáles están ocultos: al filtrar
         una categoría vacía seguía creyendo que había dos y dejaba la tarjeta
         de espera descolocada en la columna izquierda.

         Sin JavaScript el atributo no existe, pero tampoco hace falta: allí se
         ven todas, así que contar hijos y contar visibles da lo mismo y el
         :has() acierta solo. */

      contenedor.setAttribute("data-visibles", String(visiblesEnRejilla));

      actualizarContador(coincidentes.length);
      montarPaginacion(totalPaginas);
    }

    /* Aquí hubo un filtrar(consulta) que envolvía a aplicar(). Tenía sentido
       cuando la consulta entraba por un campo con evento «input»; desde que
       solo llega por ?q= al cargar, se asigna la variable y se llama a aplicar()
       una vez, al final, con los dos criterios ya puestos. */

    /* El aviso se monta nodo a nodo y con textContent, nunca con innerHTML.
       La consulta sale de la URL, o sea que la controla quien construye el
       enlace: concatenarla en HTML sería una inyección de manual. */

    function mostrarAviso(consulta) {
      if (!aviso) return;
      aviso.textContent = "";

      aviso.appendChild(document.createTextNode("Resultados para "));

      const caja = document.createElement("span");
      caja.className = "filtro-aviso__busqueda";

      /* SIN COMILLAS ANGULARES. Las llevó, y el motivo de quitarlas es que la
         caja ya hace lo que ellas hacían: delimitar dónde empieza y acaba lo
         que escribió el visitante. Con filete alrededor, las « » son un segundo
         delimitador dentro del primero.

         El resto del listado tampoco las usa —el contador dice «N resultados»
         a secas y no queda ningún mensaje de vacío—, así que dejarlas aquí era
         la única excepción. */

      const cita = document.createElement("span");
      cita.className = "filtro-aviso__termino";
      cita.textContent = consulta;
      caja.appendChild(cita);

      /* Antes era un <a> a location.pathname, o sea que además de la búsqueda
         se llevaba por delante la categoría y las etiquetas: navegaba al
         listado desnudo. Ahora borra SOLO su eje, igual que «Borrar etiquetas»
         hace con el suyo, y por eso tiene que ser un <button>: no hay ninguna
         dirección a la que ir, hay un estado que cambiar aquí mismo.

         El nombre accesible nombra la consulta. Un «Quitar» a secas, en una
         página donde también se quitan etiquetas, no diría cuál de los filtros
         se está retirando. Va por aria-label y no por texto visible porque lo
         que se ve es un aspa, y el texto es lo que la traduce.

         Aquí tampoco llevan comillas, por coherencia con lo que se ve. Y no se
         pierde nada al oírlo: los lectores de pantalla no suelen vocalizar las
         « », así que esto ya sonaba «Quitar la búsqueda aula» antes de
         quitarlas del código. */

      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.className = "filtro-aviso__quitar";
      quitar.setAttribute("aria-label", "Quitar la búsqueda " + consulta);

      const aspa = document.createElement("span");
      aspa.className = "boton__aspa";
      aspa.setAttribute("aria-hidden", "true");
      quitar.appendChild(aspa);

      quitar.addEventListener("click", function () {
        consultaActiva = "";
        /* Igual que al cambiar de categoría o de etiqueta: la página 4 de un
           conjunto no tiene por qué existir en el siguiente. */
        paginaActiva = 1;
        aviso.hidden = true;
        aviso.textContent = "";
        /* replaceState, como los otros dos ejes. El <a> anterior NAVEGABA, así
           que empujaba entrada al historial y este control se comportaba
           distinto de los demás sin ningún motivo. */
        sincronizarURL();
        aplicar();
      });

      caja.appendChild(quitar);
      aviso.appendChild(caja);

      aviso.hidden = false;
    }

    /* La URL refleja siempre el filtro puesto, para que se pueda copiar de la
       barra de direcciones. Va con replaceState y no con pushState: con tres
       categorías, pushState llenaría el historial de pasos que nadie quiere
       deshacer y obligaría a escuchar popstate para reaplicarlos. Con
       replaceState el botón atrás sale de la página, que es lo esperable.

       Se edita el juego de parámetros existente en vez de reescribir la cadena,
       así ?q= sobrevive si estaba puesto. */

    function parametrosActuales() {
      const p = new URLSearchParams(window.location.search);
      /* La búsqueda no se tocaba aquí: se arrastraba tal cual venía en la URL,
         porque hasta ahora no había forma de quitarla sin recargar. Desde que
         la × del aviso la borra en vivo, este es el sitio donde el parámetro
         tiene que dejar de existir — si no, seguiría en la dirección después de
         haberla quitado de la pantalla. */
      if (!consultaActiva.trim()) p.delete("q");
      else p.set("q", consultaActiva);
      if (categoriaActiva === "todos") p.delete("categoria");
      else p.set("categoria", categoriaActiva);
      /* En clave y no con el texto visible, para no llenar la dirección de
         %C3%ADas. Se normalizan al leerlas, así que el viaje de ida y vuelta
         es estable. */
      if (!etiquetasActivas.length) p.delete("etiquetas");
      else p.set("etiquetas", etiquetasActivas.join(","));
      // La página 1 no se escribe: es el estado por defecto y ensucia la URL
      if (paginaActiva <= 1) p.delete("pagina");
      else p.set("pagina", String(paginaActiva));
      return p;
    }

    /* El try/catch no es precaución de manual: replaceState lanza en contextos
       donde no se puede cambiar la dirección —un documento srcdoc, por ejemplo,
       cuyo origen es about:srcdoc—. Sin él, la excepción sube por el manejador
       del botón y se lleva por delante la llamada a aplicar() que viene
       después: el filtro se marcaba como pulsado y no filtraba nada.

       Se descubrió probando, y es justo la clase de fallo que no daría la cara
       en producción pero deja el control mudo si alguna vez se da. Reflejar la
       URL es un lujo; filtrar es la función. */

    function sincronizarURL() {
      if (!window.history || !window.history.replaceState) return;
      const cadena = parametrosActuales().toString();
      try {
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (cadena ? "?" + cadena : "")
        );
      } catch (e) {
        /* Si no se puede reescribir la URL, el filtro sigue funcionando: lo
           único que se pierde es que la dirección quede copiable. */
      }
    }

    /* La navegación la construye el JS y el <nav> vacío está en el HTML. Los
       números dependen de cuántos artículos pasen el filtro, así que no se
       pueden escribir a mano; la etiqueta accesible sí es contenido y va en el
       marcado.

       Sin JavaScript no aparece, y es lo correcto: unos números escritos en el
       HTML serían enlaces que recargan para enseñar exactamente lo mismo, ya
       que sin JS se ven todos los artículos de una vez.

       Son <a href> de verdad y NO se interceptan. Pediste que cada página fuera
       indexable, y para eso Google necesita un href real; de paso permite abrir
       en pestaña nueva y copiar la dirección. Recargan, y ahí hay una
       diferencia de fondo con los filtros: un filtro afina lo que ves, una
       página cambia dónde estás.

       Cada enlace arrastra los parámetros activos, así que paginar dentro de un
       filtro no lo pierde.

       Sin puntos suspensivos: con nueve por página harían falta más de 45
       artículos para que la fila moleste. A partir de unas 8 páginas conviene
       revisarlo. */

    function montarPaginacion(total) {
      if (!navPaginas) return;

      navPaginas.textContent = "";

      if (total <= 1) {
        navPaginas.hidden = true;
        return;
      }

      const lista = document.createElement("ol");
      lista.className = "paginacion__lista";

      for (let n = 1; n <= total; n++) {
        const li = document.createElement("li");
        const a = document.createElement("a");

        const p = parametrosActuales();
        if (n <= 1) p.delete("pagina");
        else p.set("pagina", String(n));
        const cadena = p.toString();
        a.href = window.location.pathname + (cadena ? "?" + cadena : "");

        a.className = "paginacion__numero";
        a.textContent = String(n);

        if (n === paginaActiva) {
          a.setAttribute("aria-current", "page");
        } else {
          /* El número solo no dice nada cuando un lector de pantalla enumera
             los enlaces. El prefijo oculto lo pone en contexto y deja el texto
             visible dentro del nombre, que es lo que necesita el control por
             voz. */
          const pre = document.createElement("span");
          pre.className = "oculto";
          pre.textContent = "Página ";
          a.insertBefore(pre, a.firstChild);
        }

        li.appendChild(a);
        lista.appendChild(li);
      }

      navPaginas.appendChild(lista);
      navPaginas.hidden = false;
    }

    /* Los filtros salen del HTML con hidden y es aquí donde se les quita: sin
       JavaScript no habría nada que los hiciera funcionar, y un control muerto
       es peor que ninguno. Sin JS la lista se ve entera, que es lo correcto.

       NINGUNO SE DESHABILITA. Los vacíos lo estuvieron, con el argumento de que
       dejar pulsar para no obtener nada es deshonesto. Se retira, y con ello la
       excepción que los revivía cuando la URL pedía esa categoría: hacían falta
       dos reglas para sostener un estado que la interfaz representaba a medias.

       El argumento se cae porque una categoría vacía SÍ dice algo: el contador
       marca cero y sale la tarjeta de espera. Deja de ser un callejón para
       convertirse en una respuesta. Un botón que lleva a una respuesta no tiene
       por qué estar apagado.

       Se va también el recuento de categorías con artículos, que solo servía
       para eso. */

    function montarFiltros(pedida) {
      const barra = document.getElementById("filtros");
      if (!barra) return;

      const botones = Array.prototype.slice.call(
        barra.querySelectorAll("[data-filtro]")
      );
      const claves = botones.map(function (b) {
        return b.getAttribute("data-filtro");
      });

      // Solo se acepta si es una de las claves reales: la URL la escribe quien
      // quiera, y un valor inventado dejaría la lista vacía sin explicación.
      const valida = pedida && claves.indexOf(pedida) !== -1 ? pedida : null;

      function marcar(clave) {
        botones.forEach(function (b) {
          b.setAttribute(
            "aria-pressed",
            String(b.getAttribute("data-filtro") === clave)
          );
        });
      }

      botones.forEach(function (b) {
        const clave = b.getAttribute("data-filtro");

        b.addEventListener("click", function () {
          categoriaActiva = clave;
          /* Vuelta a la primera página al cambiar de filtro. Sin esto te
             quedarías en una página que puede no existir en el conjunto nuevo:
             la 3 de «todos» no tiene por qué existir en «Fundamento». */
          paginaActiva = 1;
          marcar(clave);
          sincronizarURL();
          aplicar();
        });
      });

      if (valida && valida !== "todos") {
        categoriaActiva = valida;
        marcar(valida);
      }

      barra.hidden = false;
    }

    /* Tres entradas por URL que se acumulan, no se pisan: ?q= viene del
       buscador de la cabecera, ?categoria= de las etiquetas de las tarjetas y
       de la ficha del artículo, y ?pagina= de la navegación de abajo.

       La categoría se normaliza antes de compararla, así «Fundamento» y
       «fundamento» entran igual.

       La página se sanea aquí y se ajusta en aplicar(): un valor de texto, cero
       o negativo caen en la 1; uno demasiado alto se recorta a la última que
       exista, porque cuántas hay depende del filtro y aún no está aplicado. */

    const parametros = new URLSearchParams(window.location.search);
    const consulta = parametros.get("q");
    const categoria = parametros.get("categoria");
    const pagina = parseInt(parametros.get("pagina"), 10);

    paginaActiva = Number.isFinite(pagina) && pagina > 1 ? pagina : 1;

    montarFiltros(categoria ? normalizar(categoria.trim()) : null);
    montarEtiquetas(parametros.get("etiquetas"));

    if (consulta && consulta.trim()) {
      mostrarAviso(consulta.trim());
      consultaActiva = consulta;
    }

    aplicar();

    /* ------------------------------------------------ Etiquetas -------- */

    /* Segundo eje de filtrado, independiente de la categoría. La lista de
       etiquetas NO está escrita en ninguna parte: se recoge de las tarjetas, así
       que sale del contenido y no puede quedarse desfasada.

       Se guarda la clave para comparar y el texto visible para enseñar, con la
       primera grafía que aparezca. Si dos artículos escriben la misma etiqueta
       distinto —«Garantías» y «garantias»— cuentan como una sola. */

    function montarEtiquetas(pedidas) {
      const caja = document.querySelector(".menu-etiquetas");
      const boton = document.getElementById("abrir-etiquetas");
      const panel = document.getElementById("panel-etiquetas");
      const seleccion = document.getElementById("seleccion");
      const lista = document.getElementById("seleccion-lista");
      const borrar = document.getElementById("borrar-etiquetas");
      if (!caja || !boton || !panel || !seleccion || !lista || !borrar) return;

      const vistas = Object.create(null);
      entradas.forEach(function (el) {
        (el.getAttribute("data-etiquetas") || "").split(",").forEach(function (t) {
          const texto = t.trim();
          const clave = normalizar(texto);
          if (clave && !vistas[clave]) vistas[clave] = texto;
        });
      });

      const claves = Object.keys(vistas).sort(function (a, b) {
        return vistas[a].localeCompare(vistas[b], "es");
      });

      /* Sin etiquetas en ningún artículo el control no tiene nada que ofrecer, y
         un desplegable vacío es peor que ninguno. Se queda fuera. */

      if (!claves.length) {
        caja.hidden = true;
        return;
      }

      // Solo se aceptan las que existen: la URL la escribe quien quiera.
      etiquetasActivas = (pedidas || "")
        .split(",")
        .map(function (t) {
          return normalizar(t.trim());
        })
        .filter(function (t) {
          return t && claves.indexOf(t) !== -1;
        })
        .filter(function (t, i, a) {
          return a.indexOf(t) === i;
        });

      const casillas = Object.create(null);

      /* LA FILA ENTERA ES EL <label>, con la casilla dentro. Con un <div> por
         fuera y el <label> solo alrededor del texto, pulsar el nombre ya
         funcionaba —eso es nativo y no hacía falta tocarlo— pero el hueco a la
         derecha no: medido, 93 px de los 202 de la fila, casi la mitad, caían en
         el <div> y no hacían nada.

         Envolviendo se soluciona sin JavaScript y de paso entra también el
         padding de la fila. Se conserva el for= aunque la casilla vaya dentro:
         es redundante para el navegador, pero la asociación queda explícita. */

      claves.forEach(function (clave) {
        const id = "et-" + clave;
        const fila = document.createElement("label");
        fila.className = "panel-etiquetas__fila";
        fila.setAttribute("for", id);

        const casilla = document.createElement("input");
        casilla.type = "checkbox";
        casilla.id = id;
        casilla.value = clave;
        casilla.checked = etiquetasActivas.indexOf(clave) !== -1;

        const texto = document.createElement("span");
        texto.textContent = vistas[clave];

        casilla.addEventListener("change", function () {
          alternar(clave, casilla.checked);
        });

        casillas[clave] = casilla;
        fila.appendChild(casilla);
        fila.appendChild(texto);
        panel.appendChild(fila);
      });

      function alternar(clave, activa) {
        const i = etiquetasActivas.indexOf(clave);
        if (activa && i === -1) etiquetasActivas.push(clave);
        else if (!activa && i !== -1) etiquetasActivas.splice(i, 1);
        if (casillas[clave]) casillas[clave].checked = activa;
        /* Igual que al cambiar de categoría: la página 3 de un conjunto no
           tiene por qué existir en el siguiente. */
        paginaActiva = 1;
        pintarSeleccion();
        sincronizarURL();
        aplicar();
      }

      /* Las píldoras se reconstruyen enteras en cada cambio. Son dos o tres
         nodos; cualquier cosa más lista abriría la puerta a que lo que se ve y
         lo que se filtra se desincronicen. */

      function pintarSeleccion() {
        lista.textContent = "";

        etiquetasActivas.forEach(function (clave) {
          const li = document.createElement("li");
          const pildora = document.createElement("button");
          pildora.type = "button";
          pildora.className = "etiqueta etiqueta--filtro";
          /* El nombre accesible dice lo que hace el botón, no lo que pone
             dentro: quien lo oiga en una lista de controles necesita saber que
             al pulsarlo se quita, no que se aplica. */
          pildora.setAttribute("aria-label", "Quitar etiqueta " + vistas[clave]);
          pildora.appendChild(document.createTextNode("#" + vistas[clave]));

          const aspa = document.createElement("span");
          aspa.className = "etiqueta__aspa";
          aspa.setAttribute("aria-hidden", "true");
          pildora.appendChild(aspa);

          pildora.addEventListener("click", function () {
            alternar(clave, false);
          });

          li.appendChild(pildora);
          lista.appendChild(li);
        });

        /* Se oculta el ENVOLTORIO, que es quien lleva el margen. En display:none
           no genera caja ni aporta al gap, así que la distancia entre los
           filtros y el contador es la misma con selección y sin ella. */
        seleccion.hidden = etiquetasActivas.length === 0;
      }

      /* El desplegable. No es un role="menu" a propósito: eso obligaría a
         navegación por flechas y activación única, y esto es un grupo de
         opciones múltiples. Con casillas de verdad, el teclado ya funciona. */

      function abrir(si) {
        boton.setAttribute("aria-expanded", String(si));
        panel.hidden = !si;
      }

      boton.addEventListener("click", function () {
        abrir(boton.getAttribute("aria-expanded") !== "true");
      });

      /* EL FOCO NO DEBE SALIR DEL BOTÓN AL PULSAR DENTRO DEL PANEL, y sin esto
         el desplegable no funcionaba con ratón salvo dando justo en la casilla.

         Al abrirlo, el foco se queda en el botón. Un mousedown sobre algo NO
         focusable —el nombre de la etiqueta, que es un <span>, o el hueco de la
         fila— hace que el foco caiga a <body>, así que focusout se dispara con
         relatedTarget null, el manejador de más abajo lo lee como «se ha ido
         fuera» y cierra el panel ENTRE el mousedown y el mouseup. El click no
         llega a completarse sobre un elemento que ya está en display:none, el
         <label> no se activa y la casilla no cambia.

         Dar en el cuadradito sí funcionaba, y esa asimetría era la pista: el
         <input> es focusable, así que ahí relatedTarget es el propio input, que
         está dentro de la caja, y el panel sobrevive.

         preventDefault en mousedown impide el desplazamiento del foco pero NO
         la activación del <label>, que ocurre en el click. Se prefiere a
         relajar el focusout porque así se conserva el cierre al tabular hacia
         la barra del navegador, donde relatedTarget también viene null.

         Va en el panel y no en el botón: el botón sí debe poder recibir el
         foco al pulsarlo.

         Y SOLO PARA EL BOTÓN IZQUIERDO. Sin la guarda, el preventDefault
         alcanzaría también al central, que en Windows abre el autoscroll:
         quedaría bloqueado dentro del panel y en ningún otro sitio de la
         página, que es la clase de incoherencia que nadie relaciona luego con
         un desplegable de etiquetas. El foco solo lo mueve el izquierdo, así
         que es el único que hay que frenar. */

      panel.addEventListener("mousedown", function (e) {
        if (e.button !== 0) return;
        e.preventDefault();
      });

      /* Escape cierra Y DEVUELVE EL FOCO al botón. Sin lo segundo el foco se
         quedaría en un panel que ya no existe y saltaría al principio del
         documento en la siguiente tabulación. */

      caja.addEventListener("keydown", function (e) {
        if (e.key !== "Escape" && e.key !== "Esc") return;
        if (boton.getAttribute("aria-expanded") !== "true") return;
        abrir(false);
        boton.focus();
      });

      /* Salir con el tabulador cierra. Se mira relatedTarget, o sea a dónde va
         el foco: si sigue dentro de la caja no hay que hacer nada. */

      caja.addEventListener("focusout", function (e) {
        if (!e.relatedTarget || !caja.contains(e.relatedTarget)) abrir(false);
      });

      document.addEventListener("click", function (e) {
        if (!caja.contains(e.target)) abrir(false);
      });

      /* Borra SOLO las etiquetas, no la categoría ni la búsqueda. El nombre del
         botón es el argumento: si borrara todo tendría que llamarse «Borrar
         filtros», y entonces no pintaría nada dentro de un bloque que solo
         existe cuando hay etiquetas marcadas. */

      borrar.addEventListener("click", function () {
        etiquetasActivas = [];
        claves.forEach(function (c) {
          if (casillas[c]) casillas[c].checked = false;
        });
        paginaActiva = 1;
        pintarSeleccion();
        sincronizarURL();
        aplicar();
      });

      pintarSeleccion();
      caja.hidden = false;
    }
  }

  /* ------------------------------------------ Buscador de cabecera ----- */

  /* En el HTML la lupa es un enlace al listado, para que sin JavaScript siga
     llevando a algún sitio útil. Aquí se sustituye por un <button> de verdad:
     un enlace que despliega algo no es un enlace, y aria-expanded sobre un
     enlace es semánticamente pobre. */

  function buscadorDeCabecera() {
    const form = document.querySelector(".busca");
    if (!form) return;

    const campo = form.querySelector(".busca__campo");
    const lupa = form.querySelector(".busca__lupa");
    if (!campo || !lupa) return;

    // Se guarda antes de sustituir el elemento: es el destino al que sigue
    // llevando la lupa en pantallas estrechas.
    const urlListado = lupa.getAttribute("href");

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = lupa.className;
    boton.setAttribute("aria-label", lupa.getAttribute("aria-label"));
    boton.setAttribute("aria-expanded", "false");
    boton.setAttribute("aria-controls", campo.id);
    boton.innerHTML = lupa.innerHTML;
    lupa.replaceWith(boton);

    // ⚠️ Debe coincidir con el corte que oculta .busca__campo en el CSS. Por
    // debajo de ese ancho el campo no cabe junto a la marca, así que la lupa
    // vuelve a comportarse como el enlace que era en el HTML.
    //
    // Subió a 944 al cambiar «Sobre mí» por «Acerca de» en el menú: son
    // 11,6 px más de navegación, y con el campo desplegado la marca se partía
    // en dos líneas. Está medido y razonado junto a la regla del CSS.
    //
    // Si se cambia aquí, hay que cambiarlo allí: con los dos desincronizados la
    // lupa intenta desplegar un campo que el CSS ya ha ocultado.
    function estrecha() {
      return window.matchMedia("(max-width: 959px)").matches;
    }

    function abierta() {
      return form.classList.contains("busca--abierta");
    }

    function abrir() {
      form.classList.add("busca--abierta");
      boton.setAttribute("aria-expanded", "true");
      // Fuerza el recálculo de estilo antes de enfocar: el campo venía con
      // visibility: hidden y focus() no surte efecto sobre algo aún invisible.
      void campo.offsetWidth;
      campo.focus();
    }

    function cerrar(devolverFoco) {
      form.classList.remove("busca--abierta");
      boton.setAttribute("aria-expanded", "false");
      if (devolverFoco) boton.focus();
    }

    boton.addEventListener("click", function () {
      // Por debajo de 600px la cabecera ya va en dos filas y el campo está
      // oculto: la lupa se comporta como el enlace que era.
      if (estrecha()) {
        window.location.href = urlListado;
        return;
      }
      if (abierta()) cerrar(true);
      else abrir();
    });

    // En el formulario y no en el campo, para que Escape también funcione
    // con el foco puesto en la lupa.
    form.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && abierta()) {
        e.preventDefault();
        cerrar(true);
      }
    });

    // Clic fuera. Sin devolver el foco: quien ha pulsado en otro sitio no
    // espera que el foco salte a la lupa.
    document.addEventListener("click", function (e) {
      if (!abierta()) return;
      if (form.contains(e.target)) return;
      cerrar(false);
    });

    // Enviar en vacío llevaría a articulos/?q= sin filtrar nada; mejor ir al
    // listado limpio.
    form.addEventListener("submit", function (e) {
      if (!campo.value.trim()) {
        e.preventDefault();
        window.location.href = urlListado;
      }
    });
  }

  /* -------------------------------------- Línea de la cabecera --------- */

  /* Solo actúa en el inicio, que es la única página con franja de portada. En
     el resto la línea es estática y viene del CSS.

     Se observa la franja con el borde superior de la zona de observación
     recortado justo el alto de la cabecera. Así el disparo cae exactamente
     cuando la franja deja de estar por debajo de la cabecera, y no cuando ha
     salido entera de pantalla.

     Ese alto se MIDE, no se escribe: la cabecera pasa de 73px a 104px al
     plegarse en dos filas por debajo de 748px, y un número fijo aquí se
     desincronizaría igual que se desincronizaría un umbral de scroll con el
     alto de la franja. Por eso se rehace el observador si el alto cambia. */

  function lineaDeCabecera() {
    const cabecera = document.querySelector(".cabecera");
    const franja = document.querySelector(".portada--video");
    if (!cabecera || !franja || !("IntersectionObserver" in window)) return;

    let observador = null;
    let altoMontado = -1;

    function montar() {
      const alto = Math.ceil(cabecera.getBoundingClientRect().height);
      if (alto === altoMontado) return;
      altoMontado = alto;

      if (observador) observador.disconnect();
      observador = new IntersectionObserver(
        function (entradas) {
          cabecera.classList.toggle("cabecera--con-linea", !entradas[0].isIntersecting);
        },
        { rootMargin: "-" + alto + "px 0px 0px 0px", threshold: 0 }
      );
      observador.observe(franja);
    }

    montar();
    window.addEventListener("resize", montar);
  }

  /* ------------------------------------------- Índice del artículo ----- */

  /* Aquí vivía indiceDelArticulo(), que armaba el índice del lateral leyendo
     los <h2> del cuerpo y les ponía un id al vuelo si no lo traían.

     Se retira entera, con sus dos ayudantes —crearId() e idLibre()—, que no
     los usaba nadie más. El índice se escribe ahora a mano en el HTML de cada
     artículo, y con él los id de los <h2>.

     El cambio es a propósito y va contra lo que parece: generarlo era menos
     trabajo, pero el índice no existía sin JavaScript, y la regla del proyecto
     es que el contenido va en el HTML. Está razonado en CLAUDE.md y en el
     comentario de .indice en el CSS.

     Si alguna vez se vuelve a generar, hay que recordar que los <h2> deben
     conservar los id que ya tengan: puede haber enlaces apuntando desde fuera
     y no se pueden reescribir. */

  /* -------------------------------------------- Progreso de lectura ---- */

  function barraDeProgreso() {
    const barra = document.querySelector(".progreso__barra");
    const cuerpo = document.querySelector(".articulo__cuerpo");
    if (!barra || !cuerpo) return;

    const banda = barra.closest(".progreso");
    const cifra = document.querySelector(".progreso__cifra");

    let pendiente = false;
    let ultimoEntero = -1;

    // La lectura arranca en la cabecera del artículo, no en el primer párrafo:
    // así la barra ya avanza mientras se pasa el titular y la foto. Y termina
    // al acabar el texto, no al final de la página: lo que viene después
    // —referencias, continúa leyendo, pie— ya no es el artículo.
    const arranque = document.querySelector(".articulo__principal") || cuerpo;

    function actualizar() {
      pendiente = false;

      const desde = arranque.getBoundingClientRect().top + window.scrollY;
      const hasta = cuerpo.getBoundingClientRect().bottom + window.scrollY;
      const recorrido = hasta - desde - window.innerHeight;

      // Si el artículo cabe entero en pantalla no hay nada que recorrer.
      const avance =
        recorrido > 0
          ? (window.scrollY - desde) / recorrido
          : window.scrollY >= desde
            ? 1
            : 0;
      const fraccion = Math.min(1, Math.max(0, avance));

      // SIN redondear, y esto es lo que hace que la barra avance de forma
      // continua. Redondeando a entero solo existían 100 posiciones: en una
      // banda de 1440px eso son saltos de 14px cada 22px de scroll, que es
      // exactamente lo que se veía escalonado. Con dos decimales el paso baja
      // a 0.14px, por debajo del pixel.
      //
      // Una sola escritura: --avance gobierna a la vez el ancho del relleno y
      // el corte del degradado que colorea el rótulo. Escribir el ancho por un
      // lado y el corte por otro es lo que abriría la puerta a que se separen.
      if (banda) banda.style.setProperty("--avance", (fraccion * 100).toFixed(2) + "%");

      // La cifra y el aria sí van en enteros, y solo se tocan cuando el entero
      // cambia. Reescribirlos en cada fotograma repetiría el mismo texto 60
      // veces por segundo y haría que los lectores de pantalla anunciaran sin
      // parar un valor que no ha cambiado.
      const entero = Math.round(fraccion * 100);
      if (entero !== ultimoEntero) {
        ultimoEntero = entero;
        if (cifra) cifra.textContent = entero + "%";
        if (banda) banda.setAttribute("aria-valuenow", String(entero));
      }
    }

    // Un solo repintado por fotograma por muchos eventos de scroll que lleguen.
    // Sin esto, un scroll rápido puede disparar varios eventos entre dos
    // fotogramas y se recalcula geometría que nunca llega a pintarse.
    function pedirActualizacion() {
      if (pendiente) return;
      pendiente = true;
      requestAnimationFrame(actualizar);
    }

    actualizar();
    window.addEventListener("scroll", pedirActualizacion, { passive: true });
    window.addEventListener("resize", pedirActualizacion);
  }

  /* ------------------------------------------- Fondo de la portada ----- */

  /* El <video> llega sin src a propósito. Ponerlo aquí es lo único que evita
     de verdad la descarga: ni display:none ni preload="none" la impiden,
     porque autoplay fuerza la carga igualmente. Si no se cumplen las
     condiciones, el elemento se queda mostrando su poster y no pesa nada. */

  function fondoDePortada() {
    const video = document.querySelector(".portada__video");
    if (!video || !video.dataset.src) return;

    // Dos motivos para no gastar el 1,1 MB: pantalla estrecha —el plano es
    // apaisado y en vertical se recorta a una banda que pierde la composición—
    // o petición explícita de menos movimiento.
    const estrecha = window.matchMedia("(max-width: 700px)").matches;
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (estrecha || quieto) return;

    // Imprescindible, y como propiedad además de como atributo: sin esto los
    // navegadores bloquean la reproducción automática.
    video.muted = true;
    video.src = video.dataset.src;

    const intento = video.play();

    // Si el navegador bloquea el autoplay de todos modos, no hay nada que
    // rescatar: se deja el vídeo parado en su primer fotograma, que es
    // exactamente la misma imagen que el poster. Sin el catch, la promesa
    // rechazada saldría por consola como error no capturado.
    if (intento && typeof intento.catch === "function") {
      intento.catch(function () {
        video.removeAttribute("autoplay");
      });
    }
  }

  /* -------------------------------------------------- Copiar enlace ---- */

  /* El botón no está en el HTML: lo crea este bloque. Sin JavaScript no puede
     funcionar, y un botón que no hace nada es peor que no tenerlo. Los otros
     tres de la fila son <a> de verdad y funcionan sin esto.

     También se comprueba la API antes de pintarlo: navigator.clipboard no
     existe fuera de contextos seguros, así que en http:// el botón no llega a
     aparecer en vez de aparecer y fallar al pulsarlo. */

  function copiarEnlace() {
    const lista = document.querySelector(".compartir__lista");
    if (!lista || !navigator.clipboard) return;

    const canonica = document.querySelector('link[rel="canonical"]');
    const url = canonica ? canonica.href : location.href;

    const li = document.createElement("li");
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "compartir__enlace compartir__enlace--copiar";

    const icono = document.createElement("span");
    icono.className = "compartir__icono compartir__icono--enlace";
    icono.setAttribute("aria-hidden", "true");

    const texto = document.createElement("span");
    texto.textContent = "Copiar enlace";

    boton.append(icono, texto);
    li.appendChild(boton);
    lista.appendChild(li);

    /* El aviso se anuncia por aria-live y no cambiando el nombre del botón:
       así el lector de pantalla dice que se ha copiado sin que el control
       pase a llamarse otra cosa a media interacción. */

    const aviso = document.createElement("span");
    aviso.className = "oculto";
    aviso.setAttribute("role", "status");
    lista.parentNode.appendChild(aviso);

    let temporizador;

    boton.addEventListener("click", function () {
      navigator.clipboard.writeText(url).then(
        function () {
          texto.textContent = "Enlace copiado";
          aviso.textContent = "Enlace copiado al portapapeles";
          clearTimeout(temporizador);
          temporizador = setTimeout(function () {
            texto.textContent = "Copiar enlace";
            aviso.textContent = "";
          }, 2400);
        },
        function () {
          aviso.textContent = "No se ha podido copiar el enlace";
        }
      );
    });
  }

  /* ------------------------------------------------------ Utilidades --- */

  /* ------------------------------------------ Continúa leyendo --------- */

  /* Construye el bloque de relacionados del final del artículo leyendo el
     LISTADO por fetch. No hay articulos.json ni tarjetas escritas a mano, y las
     tres opciones se compararon por su modo de fallo, no por cuántos sitios
     tocan:

     · A mano — los artículos viejos nunca enlazan a los nuevos, porque para eso
       habría que volver a editarlos. Es la única de las tres que empeora sola
       con el tiempo.
     · articulos.json — un archivo más que sincronizar, y si se olvida el índice
       y el sitio discrepan sin que nada avise.
     · El listado — ya hay que mantenerlo al publicar, y si se olvida el fallo es
       inmediato y ruidoso: el artículo no aparece en articulos/.

     O sea que esto no añade un punto de mantenimiento: reutiliza uno que ya
     existía y cuyo despiste ya se nota. Lo único nuevo es data-etiquetas.

     Consecuencia que conviene tener presente: articulos/index.html deja de ser
     solo una página y pasa a ser una DEPENDENCIA de todos los artículos. Si
     alguien le cambia la estructura de las tarjetas, esto se entera. */

  function articulosRelacionados() {
    const seccion = document.getElementById("continua");
    const rejilla = document.getElementById("relacionados");
    if (!seccion || !rejilla) return;

    /* DOS, y se probó a tres antes de decidirlo. En la columna de 720 px del
       artículo, a tres las tarjetas salen a 221,3 px y a dos a 346.

       Lo que descartó las tres NO fue que se rompiera: no desborda nada, la
       palabra más larga mide 122,4 px y cabe. Fue la imagen, que baja de
       346×231 a 221×148 — menos de la mitad de superficie— y a ese tamaño la
       balanza deja de leerse. En un sistema donde la imagen acompaña al texto,
       acompañar así es casi no estar. El titular, de paso, pasa de 2 líneas a
       3 o 4 y descuadra las fechas entre tarjetas.

       Si alguna vez se vuelve a tres, hay que quitarle .tarjetas--par al <div>
       del bloque para que herede las tres columnas de .tarjetas. */

    const CUANTOS = 2;

    /* Las etiquetas del artículo actual NO se duplican en ningún sitio: se leen
       de sus propias píldoras del lateral, que ya están en el DOM. El atributo
       data-etiquetas solo hace falta en el listado, o sea para los OTROS. */

    const propias = new Set(
      Array.prototype.map
        .call(document.querySelectorAll(".etiqueta--tag"), function (el) {
          return normalizar(el.textContent.replace(/^#/, "").trim());
        })
        .filter(Boolean)
    );

    fetch(new URL("../", window.location.href).href)
      .then(function (r) {
        if (!r.ok) throw new Error("listado no disponible");
        return r.text();
      })
      .then(function (html) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        /* Fuera la tarjeta de «Próximamente», que no es un artículo, y fuera
           este mismo artículo. La comparación es por pathname resuelto y no por
           el href literal, porque en el listado es relativo a otra carpeta. */

        const aqui = normalizarRuta(window.location.pathname);

        const candidatos = Array.prototype.filter
          .call(
            doc.querySelectorAll(".tarjeta:not(.tarjeta--proxima)"),
            function (art) {
              const a = art.querySelector(".entrada__titulo a");
              if (!a) return false;
              const destino = new URL(a.getAttribute("href"), new URL("../", window.location.href));
              return normalizarRuta(destino.pathname) !== aqui;
            }
          )
          .map(function (art) {
            const etiquetas = (art.getAttribute("data-etiquetas") || "")
              .split(",")
              .map(function (t) {
                return normalizar(t.trim());
              })
              .filter(Boolean);

            const time = art.querySelector("time");

            return {
              nodo: art,
              fecha: time ? time.getAttribute("datetime") || "" : "",
              afinidad: etiquetas.filter(function (t) {
                return propias.has(t);
              }).length
            };
          });

        /* Un solo criterio para las dos cosas que pediste. Los que comparten
           etiquetas van primero, y el «rellenar con los más recientes» no es un
           caso aparte: es este mismo orden aplicado a los que puntúan cero. */

        candidatos.sort(function (a, b) {
          return b.afinidad - a.afinidad || b.fecha.localeCompare(a.fecha);
        });

        const elegidos = candidatos.slice(0, CUANTOS);
        if (!elegidos.length) return;

        elegidos.forEach(function (c) {
          rejilla.appendChild(adaptarTarjeta(c.nodo));
        });
        seccion.hidden = false;
      })
      .catch(function () {
        /* Si el listado no se puede leer, la sección se queda como estaba: sin
           enseñar. Un bloque de navegación vacío o a medias sería peor que no
           tenerlo, y debajo sigue estando .volver, que lleva al mismo sitio. */
      });
  }

  /* Quita la barra final y el index.html para que dos formas de escribir la
     misma dirección se comparen iguales. */

  function normalizarRuta(ruta) {
    return ruta.replace(/index\.html$/, "").replace(/\/+$/, "");
  }

  /* Pasa una tarjeta del listado a lo que necesita este bloque. Se clona y se
     retoca; no se construye de cero, para que cualquier cambio futuro en la
     tarjeta del listado llegue aquí solo. */

  function adaptarTarjeta(original) {
    const t = original.cloneNode(true);
    const base = new URL("../", window.location.href);

    /* El listado escribe sus rutas relativas a articulos/, y aquí estamos un
       nivel más abajo. Se reescriben absolutas resolviéndolas contra esa base:
       así da igual la profundidad de la carpeta del artículo. */

    Array.prototype.forEach.call(t.querySelectorAll("[href]"), function (a) {
      a.setAttribute("href", new URL(a.getAttribute("href"), base).pathname);
    });
    Array.prototype.forEach.call(t.querySelectorAll("[src]"), function (i) {
      i.setAttribute("src", new URL(i.getAttribute("src"), base).pathname);
    });

    /* El titular baja de h2 a h3. En el listado cuelga del h1 de la página;
       aquí cuelga del h2 «Continúa leyendo», así que un h2 saltaría el nivel.
       Se cambia la etiqueta conservando el contenido y la clase. */

    const titulo = t.querySelector(".entrada__titulo");
    if (titulo) {
      const h3 = document.createElement("h3");
      h3.className = titulo.className;
      h3.innerHTML = titulo.innerHTML;
      titulo.replaceWith(h3);
    }

    /* Sin extracto y sin caja: son 346 px de ancho y lo que hace falta aquí es
       reconocer el artículo, no resumirlo. */

    const extracto = t.querySelector(".entrada__extracto");
    if (extracto) extracto.remove();
    t.classList.remove("tarjeta--caja");
    t.removeAttribute("data-categoria");
    t.removeAttribute("data-etiquetas");

    return t;
  }

  function normalizar(texto) {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, ""); // ignora acentos
  }

})();
