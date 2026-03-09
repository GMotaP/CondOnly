(function () {
  const locationsContainer = document.getElementById("locations");
  const updateTimeElement = document.getElementById("last-update");
  const scaleRoot = document.getElementById("scale-root");

  // Guardas: se algum elemento não existir, loga e aborta
  if (!locationsContainer || !updateTimeElement || !scaleRoot) {
    console.error("[INCHARGE] Elementos base não encontrados.", {
      hasLocations: !!locationsContainer,
      hasUpdate: !!updateTimeElement,
      hasScale: !!scaleRoot,
    });
    return;
  }

  /* =========================
     SETORES (3 colunas)
     ========================= */
  const setores = [
    { name: "Torre A", keys: ["inc373", "inc372"] },
    { name: "Torre B", keys: ["inc370","inc371"] },
  ];

  /* =========================
     Helpers
     ========================= */
  function isOnlineValue(online) {
    return online === 1 || online === true || online === "1";
  }

  function getStatusClass(status, online) {
  const s = String(status || "").trim().toLowerCase();

  // Falhas explícitas da API (prioridade máxima)
  if (s === "faulted" || s === "unavailable" || s === "error") {
    return "is-offline";
  }

  // Offline físico/lógico
  if (!isOnlineValue(online)) {
    return "is-offline";
  }

  // Estados normais
  switch (s) {
    case "available":
      return "is-available";
    case "preparing":
      return "is-preparing";
    case "finishing":
      return "is-finishing";
    case "charging":
      return "is-charging";
    default:
      return "is-available";
  }
}
  /**
   * Link de pagamento:
   * Mantido no padrão pay.incharge.app (igual ao seu último site).
   * Se algum desses PCs precisar ir para pay4charge.com, me diga que eu ajusto.
   */
  function getPaymentLink(key, plug) {
    const upper = String(key || "").toUpperCase();
    return `https://incharge.app/now/${upper}/${plug}`;
  }

  function atualizarHorario() {
    const agora = new Date();
    const hora = agora.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const data = agora.toLocaleDateString("pt-BR");
    updateTimeElement.textContent = `Última atualização: ${data} às ${hora}`;
  }

  /* Escala automática para caber no viewport */
  function fitToViewport() {
    scaleRoot.style.transform = "scale(1)";
    const margin = 8;

    const rect = scaleRoot.getBoundingClientRect();
    const neededH = rect.height;
    const neededW = rect.width;

    const availableH = window.innerHeight - margin;
    const availableW = window.innerWidth - margin;

    let scale = Math.min(1, availableH / neededH, availableW / neededW);
    if (scale < 0.6) scale = 0.6;

    scaleRoot.style.transform = `scale(${scale})`;
  }

  /* =========================
     Renderização (3 colunas)
     ========================= */
  function renderSetores(data) {
    locationsContainer.innerHTML = "";

    setores.forEach((setor) => {
      const col = document.createElement("div");
      col.className = "city-column";

      const h2 = document.createElement("h2");
      h2.textContent = setor.name;
      col.appendChild(h2);

      setor.keys.forEach((key) => {
        const t = document.createElement("h3");
        t.className = "titleCidade";
        t.textContent = String(key).toUpperCase();
        col.appendChild(t);

        const container = document.createElement("div");
        container.className = "containerInfo";

        const chargers = Array.isArray(data[key]) ? data[key] : [];

        if (chargers.length === 0) {
          const p = document.createElement("p");
          p.className = "loading";
          p.textContent = "Carregando dados...";
          container.appendChild(p);
        } else {
          chargers.forEach((ch) => {
            const linkA = document.createElement("a");
            linkA.href = getPaymentLink(key, ch.plug);
            linkA.target = "_blank";
            linkA.rel = "noopener noreferrer";

            const item = document.createElement("div");
            item.className = "chargerInfo " + getStatusClass(ch.status, ch.online);
            item.textContent = `Plug ${ch.plug}`;

            if (!isOnlineValue(ch.online)) item.style.opacity = "0.6";

            linkA.appendChild(item);
            container.appendChild(linkA);
          });
        }

        col.appendChild(container);
      });

      locationsContainer.appendChild(col);
    });
  }

  /* =========================
     Fetch de dados
     ========================= */
  let isFetching = false;

  async function getAllData() {
    if (isFetching) return;
    isFetching = true;

    try {
      // Lista completa de keys (todos os setores)
      const allKeys = setores.flatMap((s) => s.keys);

      const urls = allKeys.map((key) => ({
        key,
        url: `https://api.incharge.app/api/v2/now/${key}`,
      }));

      const responses = await Promise.all(
        urls.map(async (item) => {
          try {
            const res = await fetch(item.url, { cache: "no-store" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);

            const data = await res.json();

            // Esperamos um array; se vier objeto, tenta pegar uma chave comum
            const parsed = Array.isArray(data)
              ? data
              : Array.isArray(data?.chargers)
              ? data.chargers
              : [];

            return { key: item.key, data: parsed };
          } catch (err) {
            console.error("[INCHARGE] Falha ao buscar", item.key, err);
            return { key: item.key, data: [] };
          }
        })
      );

      // Monta o objeto globalData com o retorno por key
      const globalData = {};
      responses.forEach((r) => {
        globalData[r.key] = r.data;
      });

      // Renderiza 3 colunas
      renderSetores(globalData);

      // Atualiza horário e escala
      atualizarHorario();
      fitToViewport();
    } catch (e) {
      console.error("[INCHARGE] Erro inesperado em getAllData()", e);
      locationsContainer.innerHTML = `<div class="loading">Não foi possível carregar os dados agora.</div>`;
    } finally {
      isFetching = false;
    }
  }

  // Init
  getAllData();
  setInterval(getAllData, 30000);
  window.addEventListener("resize", fitToViewport);
})();
