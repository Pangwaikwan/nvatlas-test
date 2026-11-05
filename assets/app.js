(() => {
  "use strict";

  const categoryColors = {
    action: "#0d6c68",
    quality: "#c95d42",
    result: "#d4a33b",
    other: "#4c6470",
  };
  const categoryOrder = ["action", "quality", "result", "other"];
  const pageSize = 25;
  const state = {
    data: null,
    lang: "en",
    query: "",
    category: "",
    variation: "",
    checked: "",
    term: "",
    sort: "id",
    page: 1,
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const t = (key) => window.translations[state.lang][key] || window.translations.en[key] || key;
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  }[char]));
  const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const formatNumber = (value) => new Intl.NumberFormat(state.lang === "zh" ? "zh-HK" : "en-GB").format(value);
  const categoryName = (key) => state.data.categories[key][state.lang === "zh" ? "name_zh" : "name_en"];

  function countTranslations(records) {
    const map = new Map();
    records.forEach((record) => {
      if (!map.has(record.key_term)) map.set(record.key_term, new Set());
      map.get(record.key_term).add(record.target_term);
    });
    return map;
  }

  function globalVariation() {
    return countTranslations(state.data.records);
  }

  function filteredRecords({ ignoreTerm = false } = {}) {
    const query = state.query.trim().toLocaleLowerCase();
    const variationMap = globalVariation();
    return state.data.records.filter((record) => {
      if (state.category && record.category !== state.category) return false;
      if (state.checked && String(record.human_checked) !== state.checked) return false;
      if (!ignoreTerm && state.term && record.key_term !== state.term && record.target_term !== state.term) return false;
      if (state.variation) {
        const isVaried = (variationMap.get(record.key_term)?.size || 0) > 1;
        if (state.variation === "varied" && !isVaried) return false;
        if (state.variation === "consistent" && isVaried) return false;
      }
      if (query) {
        const haystack = [record.id, record.source_text, record.target_text, record.key_term, record.target_term,
          categoryName(record.category), record.source].join(" ").toLocaleLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }

  function updateUrl() {
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.category) params.set("category", state.category);
    if (state.variation) params.set("variation", state.variation);
    if (state.checked) params.set("checked", state.checked);
    if (state.term) params.set("term", state.term);
    if (state.sort !== "id") params.set("sort", state.sort);
    if (state.page > 1) params.set("page", state.page);
    if (state.lang === "zh") params.set("lang", "zh");
    const url = `${location.pathname}${params.toString() ? `?${params}` : ""}${location.hash}`;
    history.replaceState(null, "", url);
  }

  function hydrateFromUrl() {
    const params = new URLSearchParams(location.search);
    state.query = params.get("q") || "";
    state.category = params.get("category") || "";
    state.variation = params.get("variation") || "";
    state.checked = params.get("checked") || "";
    state.term = params.get("term") || "";
    state.sort = params.get("sort") || "id";
    state.page = Math.max(1, Number(params.get("page")) || 1);
    state.lang = params.get("lang") === "zh" ? "zh" : "en";
    $("#search").value = state.query;
    $("#category").value = state.category;
    $("#variation").value = state.variation;
    $("#checked").value = state.checked;
    $("#sortBy").value = state.sort;
    $("#focusTerm").value = state.term;
  }

  function syncControls() {
    $("#search").value = state.query;
    $("#category").value = state.category;
    $("#variation").value = state.variation;
    $("#checked").value = state.checked;
    $("#sortBy").value = state.sort;
    $("#focusTerm").value = state.term;
  }

  function updateStaticText() {
    document.documentElement.lang = state.lang === "zh" ? "zh-Hant" : "en";
    document.title = state.lang === "zh" ? "NV Atlas｜名詞轉動詞" : "NV Atlas | Nominal to Verb";
    $$("[data-i18n]").forEach((element) => {
      const value = window.translations[state.lang][element.dataset.i18n];
      if (value) element.textContent = value;
    });
    const search = $("#search");
    search.placeholder = state.lang === "zh" ? "試試：attention、注意、permission…" : "Try: attention, 注意, permission…";
    $$(".language-toggle button").forEach((button) => {
      const active = button.dataset.lang === state.lang;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setLanguage(lang) {
    state.lang = lang;
    updateStaticText();
    renderCodebook();
    renderAll();
    updateUrl();
  }

  function renderAll() {
    const records = filteredRecords();
    renderSummary(records);
    renderFlow(records);
    renderNetwork(records);
    renderKwic(records);
    renderTable(records);
    renderSelection();
    syncControls();
    updateUrl();
  }

  function renderSummary(records) {
    const label = records.length === 1 ? t("record") : t("records");
    $("#resultCount").textContent = `${formatNumber(records.length)} ${label}`;
    const detail = [];
    if (state.category) detail.push(categoryName(state.category));
    if (state.query) detail.push(`“${state.query}”`);
    if (state.term) detail.push(state.term);
    $("#activeSearch").textContent = detail.join(" · ");
  }

  function renderSelection() {
    const selected = $("#selectionBar");
    selected.hidden = !state.term;
    $("#selectionLabel").textContent = state.term;
    const focus = $("#focusTerm");
    if (focus.value !== state.term) focus.value = state.term;
  }

  function categoryCounts(records) {
    return Object.fromEntries(categoryOrder.map((key) => [key, records.filter((record) => record.category === key).length]));
  }

  function renderFlow(records) {
    const svg = $("#flowChart");
    const container = svg.parentElement;
    const width = Math.max(container.clientWidth || 700, 300);
    const height = width < 550 ? 310 : 255;
    const minimum = Number($("#flowMinimum").value);
    $("#flowMinimumOut").textContent = minimum;
    const margin = { top: 32, right: 112, bottom: 16, left: 104 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const variation = globalVariation();
    const leftNodes = categoryOrder.map((key) => ({
      key,
      count: records.filter((record) => record.category === key).length,
      label: categoryName(key),
    })).filter((node) => node.count);
    const rightKeys = ["single", "varied"];
    const rightNodes = rightKeys.map((key) => ({
      key,
      count: records.filter((record) => {
        const variants = variation.get(record.key_term)?.size || 0;
        return key === "varied" ? variants > 1 : variants <= 1;
      }).length,
    })).filter((node) => node.count);
    const links = [];
    leftNodes.forEach((left) => {
      rightNodes.forEach((right) => {
        const value = records.filter((record) => {
          if (record.category !== left.key) return false;
          const variants = variation.get(record.key_term)?.size || 0;
          return right.key === "varied" ? variants > 1 : variants <= 1;
        }).length;
        if (value >= minimum && value > 0) links.push({ left: left.key, right: right.key, value });
      });
    });
    const total = Math.max(records.length, 1);
    const totalLeft = leftNodes.reduce((sum, node) => sum + node.count, 0) || 1;
    const totalRight = rightNodes.reduce((sum, node) => sum + node.count, 0) || 1;
    let y = margin.top;
    leftNodes.forEach((node) => {
      node.height = Math.max(18, (node.count / totalLeft) * innerHeight);
      node.y = y;
      y += node.height + 10;
    });
    y = margin.top;
    rightNodes.forEach((node) => {
      node.height = Math.max(24, (node.count / totalRight) * innerHeight);
      node.y = y;
      y += node.height + 10;
    });
    const leftOffsets = new Map(leftNodes.map((node) => [node.key, 0]));
    const rightOffsets = new Map(rightNodes.map((node) => [node.key, 0]));
    const curve = (x1, y1, x2, y2) => {
      const mid = (x1 + x2) / 2;
      return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
    };
    let markup = `<defs><linearGradient id="flowGradient" x1="0" x2="1"><stop offset="0" stop-color="#0d6c68" stop-opacity=".22"/><stop offset="1" stop-color="#c95d42" stop-opacity=".22"/></linearGradient></defs>`;
    if (!records.length) {
      svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="axis-label">${escapeHtml(t("noResults"))}</text>`;
      return;
    }
    links.forEach((link) => {
      const left = leftNodes.find((node) => node.key === link.left);
      const right = rightNodes.find((node) => node.key === link.right);
      if (!left || !right) return;
      const leftHeight = (link.value / left.count) * left.height;
      const rightHeight = (link.value / right.count) * right.height;
      const ly = left.y + leftOffsets.get(left.key) + leftHeight / 2;
      const ry = right.y + rightOffsets.get(right.key) + rightHeight / 2;
      leftOffsets.set(left.key, leftOffsets.get(left.key) + leftHeight);
      rightOffsets.set(right.key, rightOffsets.get(right.key) + rightHeight);
      const x1 = margin.left + 13;
      const x2 = width - margin.right - 13;
      markup += `<path class="flow-link" d="${curve(x1, ly, x2, ry)}" fill="none" stroke="url(#flowGradient)" stroke-width="${Math.max(2, (link.value / total) * 55)}" data-left="${link.left}" data-right="${link.right}"><title>${escapeHtml(categoryName(link.left))}: ${link.value} ${escapeHtml(t("records"))}</title></path>`;
    });
    leftNodes.forEach((node) => {
      const selected = state.category === node.key;
      markup += `<g class="flow-node ${selected ? "is-selected" : ""}" data-category="${node.key}" tabindex="0" role="button" aria-label="${escapeHtml(node.label)}: ${node.count}">
        <rect x="${margin.left - 3}" y="${node.y}" width="16" height="${node.height}" rx="4" fill="${categoryColors[node.key]}"></rect>
        <text class="flow-label" x="${margin.left - 12}" y="${node.y + Math.min(15, node.height / 2)}" text-anchor="end">${escapeHtml(node.label)}</text>
        <text class="flow-value" x="${margin.left - 12}" y="${node.y + Math.min(30, node.height / 2 + 13)}" text-anchor="end">${node.count} ${escapeHtml(t("records"))}</text>
      </g>`;
    });
    rightNodes.forEach((node) => {
      const selected = state.variation === (node.key === "varied" ? "varied" : "consistent");
      const color = node.key === "varied" ? "#c95d42" : "#0d6c68";
      const label = state.lang === "zh"
        ? (node.key === "varied" ? "多種譯法" : "單一譯法")
        : (node.key === "varied" ? "Varied renderings" : "Single rendering");
      const x = width - margin.right;
      markup += `<g class="flow-node ${selected ? "is-selected" : ""}" data-variation="${node.key === "varied" ? "varied" : "consistent"}" tabindex="0" role="button" aria-label="${escapeHtml(label)}: ${node.count}">
        <rect x="${x - 3}" y="${node.y}" width="16" height="${node.height}" rx="4" fill="${color}"></rect>
        <text class="flow-label" x="${x + 14}" y="${node.y + Math.min(17, node.height / 2)}">${escapeHtml(label)}</text>
        <text class="flow-value" x="${x + 14}" y="${node.y + Math.min(32, node.height / 2 + 14)}">${node.count} ${escapeHtml(t("records"))}</text>
      </g>`;
    });
    markup += `<text class="axis-title" x="${margin.left - 12}" y="14" text-anchor="end">${escapeHtml(state.lang === "zh" ? "構詞類別" : "MORPHOLOGICAL CATEGORY")}</text>`;
    markup += `<text class="axis-title" x="${width - margin.right + 14}" y="14">${escapeHtml(state.lang === "zh" ? "譯法模式" : "RENDERING PATTERN")}</text>`;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = markup;
    $$(".flow-node", svg).forEach((node) => {
      const activate = () => {
        if (node.dataset.category) {
          state.category = state.category === node.dataset.category ? "" : node.dataset.category;
        } else if (node.dataset.variation) {
          state.variation = state.variation === node.dataset.variation ? "" : node.dataset.variation;
        }
        state.page = 1;
        renderAll();
      };
      node.addEventListener("click", activate);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function renderNetwork(records) {
    const svg = $("#networkChart");
    const container = svg.parentElement;
    const width = Math.max(container.clientWidth || 550, 280);
    const height = width < 450 ? 350 : 405;
    const topLimit = Number($("#networkTop").value);
    const minimum = Number($("#networkMinimum").value);
    $("#networkTopOut").textContent = topLimit;
    $("#networkMinimumOut").textContent = minimum;
    const frequencies = new Map();
    const edges = new Map();
    records.forEach((record) => {
      frequencies.set(record.key_term, (frequencies.get(record.key_term) || 0) + 1);
      const edgeKey = `${record.key_term}\u0000${record.target_term}`;
      edges.set(edgeKey, (edges.get(edgeKey) || 0) + 1);
    });
    const terms = [...frequencies.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, topLimit);
    const placeholders = [];
    const englishNodes = terms.map(([term, count], index) => ({
      id: term, label: term, count, type: "english", x: 85, y: 0,
    }));
    const chineseSet = new Map();
    terms.forEach(([term]) => {
      [...edges.entries()].filter(([key, weight]) => key.startsWith(`${term}\u0000`) && weight >= minimum).forEach(([key, weight]) => {
        const target = key.split("\u0000")[1];
        chineseSet.set(target, (chineseSet.get(target) || 0) + weight);
      });
    });
    const chineseNodes = [...chineseSet.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([term, count]) => ({
      id: term, label: term, count, type: "chinese", x: width - 85, y: 0,
    }));
    const activeEdges = [];
    terms.forEach(([term]) => {
      chineseNodes.forEach((target) => {
        const weight = edges.get(`${term}\u0000${target.id}`) || 0;
        if (weight >= minimum) activeEdges.push({ source: term, target: target.id, weight });
      });
    });
    if (!records.length || !terms.length) {
      svg.innerHTML = `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="axis-label">${escapeHtml(t("noResults"))}</text>`;
      return;
    }
    const topPad = 26;
    const usable = height - topPad * 2;
    englishNodes.forEach((node, index) => {
      node.y = topPad + (usable * (index + 1)) / (englishNodes.length + 1);
    });
    chineseNodes.forEach((node, index) => {
      node.y = topPad + (usable * (index + 1)) / (chineseNodes.length + 1);
    });
    const maxEnglish = Math.max(...englishNodes.map((node) => node.count));
    const maxChinese = Math.max(...chineseNodes.map((node) => node.count));
    const maxEdge = Math.max(...activeEdges.map((edge) => edge.weight));
    const nodeById = new Map([...englishNodes, ...chineseNodes].map((node) => [`${node.type}:${node.id}`, node]));
    let markup = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8eaaa5"/></marker></defs>`;
    activeEdges.forEach((edge) => {
      const source = nodeById.get(`english:${edge.source}`);
      const target = nodeById.get(`chinese:${edge.target}`);
      if (!source || !target) return;
      const selected = state.term === edge.source || state.term === edge.target;
      const radius = 46;
      markup += `<path class="network-link ${selected ? "is-selected" : ""}" d="M ${source.x + 8} ${source.y} C ${source.x + radius} ${source.y}, ${target.x - radius} ${target.y}, ${target.x - 8} ${target.y}" stroke-width="${1 + (edge.weight / maxEdge) * 4}" marker-end="url(#arrow)" data-term="${escapeHtml(edge.source)}" data-target="${escapeHtml(edge.target)}"><title>${escapeHtml(edge.source)} → ${escapeHtml(edge.target)}: ${edge.weight}</title></path>`;
    });
    englishNodes.forEach((node) => {
      const radius = 7 + (node.count / maxEnglish) * 7;
      markup += `<g class="network-node ${state.term === node.id ? "is-selected" : ""}" data-term="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="${escapeHtml(node.id)}: ${node.count}">
        <circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="${categoryColors[records.find((record) => record.key_term === node.id)?.category] || "#0d6c68"}"></circle>
        <text x="${node.x + radius + 5}" y="${node.y + 3}">${escapeHtml(node.id)} <tspan fill="#71817f">${node.count}</tspan></text>
      </g>`;
    });
    chineseNodes.forEach((node) => {
      const radius = 6 + (node.count / maxChinese) * 6;
      markup += `<g class="network-node ${state.term === node.id ? "is-selected" : ""}" data-term="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="${escapeHtml(node.id)}: ${node.count}">
        <circle cx="${node.x}" cy="${node.y}" r="${radius}" fill="#c95d42"></circle>
        <text x="${node.x - radius - 5}" y="${node.y + 3}" text-anchor="end">${escapeHtml(node.id)} <tspan fill="#71817f">${node.count}</tspan></text>
      </g>`;
    });
    markup += `<text class="axis-title" x="12" y="12">${escapeHtml(state.lang === "zh" ? "英文名詞" : "ENGLISH NOMINAL")}</text>`;
    markup += `<text class="axis-title" x="${width - 12}" y="12" text-anchor="end">${escapeHtml(state.lang === "zh" ? "中文動詞" : "CHINESE VERB")}</text>`;
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.innerHTML = markup;
    $$(".network-node", svg).forEach((node) => {
      const activate = () => selectTerm(node.dataset.term);
      node.addEventListener("click", activate);
      node.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
    $$(".network-link", svg).forEach((link) => {
      link.addEventListener("click", () => selectTerm(link.dataset.term));
    });
  }

  function selectTerm(term) {
    state.term = state.term === term ? "" : term;
    state.page = 1;
    renderAll();
  }

  function highlight(text, term) {
    const safe = escapeHtml(text);
    if (!term) return safe;
    const pattern = new RegExp(`(${escapeRegex(escapeHtml(term))})`, "gi");
    return safe.replace(pattern, "<mark>$1</mark>");
  }

  function renderKwic(records) {
    const list = $("#kwicList");
    const focus = state.term;
    if (!focus) {
      list.innerHTML = `<div class="kwic-empty">${escapeHtml(t("selectTerm"))}</div>`;
      return;
    }
    const relevant = records.filter((record) => record.key_term === focus || record.target_term === focus).slice(0, 16);
    if (!relevant.length) {
      list.innerHTML = `<div class="kwic-empty">${escapeHtml(t("noResults"))}</div>`;
      return;
    }
    list.innerHTML = relevant.map((record) => `<div class="kwic-row" data-term="${escapeHtml(record.key_term)}" tabindex="0" role="button">
      <div class="kwic-source">${highlight(record.source_text, record.key_term)}</div>
      <div class="kwic-target">${highlight(record.target_text, record.target_term)}</div>
    </div>`).join("");
    $$(".kwic-row", list).forEach((row) => {
      const activate = () => selectTerm(row.dataset.term);
      row.addEventListener("click", activate);
      row.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      });
    });
  }

  function sortedRecords(records) {
    const copy = [...records];
    if (state.sort === "source") copy.sort((a, b) => a.source_text.localeCompare(b.source_text));
    else if (state.sort === "key_term") copy.sort((a, b) => a.key_term.localeCompare(b.key_term) || a.id - b.id);
    else if (state.sort === "target_term") copy.sort((a, b) => a.target_term.localeCompare(b.target_term) || a.id - b.id);
    else copy.sort((a, b) => a.id - b.id);
    return copy;
  }

  function renderTable(records) {
    const body = $("#dataTable tbody");
    const sorted = sortedRecords(records);
    const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
    if (state.page > pages) state.page = pages;
    const start = (state.page - 1) * pageSize;
    const visible = sorted.slice(start, start + pageSize);
    if (!visible.length) {
      body.innerHTML = `<tr><td colspan="7">${escapeHtml(t("noResults"))}</td></tr>`;
    } else {
      body.innerHTML = visible.map((record) => `<tr>
        <td>${record.id}</td>
        <td>${escapeHtml(record.source_text)}</td>
        <td>${escapeHtml(record.target_text)}</td>
        <td>${escapeHtml(record.key_term)}</td>
        <td>${escapeHtml(record.target_term)}</td>
        <td><span class="badge">${escapeHtml(categoryName(record.category))}</span></td>
        <td><span class="badge ${record.human_checked ? "" : "pending"}">${record.human_checked ? (state.lang === "zh" ? "是" : "Yes") : (state.lang === "zh" ? "未核對" : "No")}</span></td>
      </tr>`).join("");
    }
    $("#pageLabel").textContent = state.lang === "zh"
      ? `第 ${state.page} 頁，共 ${pages} 頁`
      : `Page ${state.page} of ${pages}`;
    const categorySelect = $("#category");
    const activeOption = categorySelect.options[categorySelect.selectedIndex];
    if (activeOption && state.category === "") activeOption.textContent = t("allCategoriesShort");
    $("#prevPage").disabled = state.page <= 1;
    $("#nextPage").disabled = state.page >= pages;
    const filteredLink = $("#downloadFiltered");
    filteredLink.href = makeFilteredCsvBlob(sorted);
    filteredLink.download = "nvatlas-filtered.csv";
  }

  function csvField(value) {
    const text = String(value ?? "");
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function makeFilteredCsvBlob(records) {
    const headers = ["id", "English", "Chinese", "English_Nominal", "Chinese_Verb", "source", "category", "human_checked"];
    const lines = [headers.join(","), ...records.map((record) => [
      record.id, record.source_text, record.target_text, record.key_term, record.target_term,
      record.source, categoryName(record.category), record.human_checked ? "yes" : "no",
    ].map(csvField).join(","))];
    return URL.createObjectURL(new Blob([`\ufeff${lines.join("\r\n")}\r\n`], { type: "text/csv;charset=utf-8" }));
  }

  function renderCodebook() {
    const host = $("#categoryCards");
    host.innerHTML = categoryOrder.map((key) => {
      const category = state.data.categories[key];
      const count = state.data.records.filter((record) => record.category === key).length;
      return `<article class="category-card">
        <div class="swatch"></div>
        <h3>${escapeHtml(category[state.lang === "zh" ? "name_zh" : "name_en"])}</h3>
        <p class="zh-name">${count} ${escapeHtml(t("records"))}</p>
        <p>${escapeHtml(category[state.lang === "zh" ? "definition_zh" : "definition_en"])}</p>
        <code>${escapeHtml(category[state.lang === "zh" ? "rule_zh" : "rule_en"])}</code>
      </article>`;
    }).join("");
  }

  function buildTermOptions() {
    const select = $("#focusTerm");
    const terms = [...new Set(state.data.records.map((record) => record.key_term))].sort();
    select.innerHTML = `<option value="">${escapeHtml(t("chooseTerm"))}</option>${terms.map((term) => `<option value="${escapeHtml(term)}">${escapeHtml(term)}</option>`).join("")}`;
    select.value = state.term;
  }

  function buildCategoryOptions() {
    const select = $("#category");
    select.innerHTML = `<option value="">${escapeHtml(t("allCategoriesShort"))}</option>${categoryOrder.map((key) => `<option value="${key}">${escapeHtml(categoryName(key))}</option>`).join("")}`;
    select.value = state.category;
  }

  function bindEvents() {
    let searchTimer;
    $("#search").addEventListener("input", (event) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = event.target.value;
        state.page = 1;
        renderAll();
      }, 160);
    });
    $("#category").addEventListener("change", (event) => {
      state.category = event.target.value;
      state.page = 1;
      renderAll();
    });
    $("#variation").addEventListener("change", (event) => {
      state.variation = event.target.value;
      state.page = 1;
      renderAll();
    });
    $("#checked").addEventListener("change", (event) => {
      state.checked = event.target.value;
      state.page = 1;
      renderAll();
    });
    $("#focusTerm").addEventListener("change", (event) => {
      state.term = event.target.value;
      state.page = 1;
      renderAll();
    });
    $("#sortBy").addEventListener("change", (event) => {
      state.sort = event.target.value;
      state.page = 1;
      renderAll();
    });
    $("#prevPage").addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      renderAll();
    });
    $("#nextPage").addEventListener("click", () => {
      state.page += 1;
      renderAll();
    });
    $("#clearSelection").addEventListener("click", () => {
      state.term = "";
      state.page = 1;
      renderAll();
    });
    $("#resetFilters").addEventListener("click", () => {
      state.query = "";
      state.category = "";
      state.variation = "";
      state.checked = "";
      state.term = "";
      state.page = 1;
      renderAll();
    });
    $("#flowMinimum").addEventListener("input", () => renderAll());
    $("#networkTop").addEventListener("input", () => renderAll());
    $("#networkMinimum").addEventListener("input", () => renderAll());
    $("#copyView").addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(location.href);
        $("#copyView").textContent = t("copied");
        setTimeout(() => { $("#copyView").textContent = t("copyLink"); }, 1800);
      } catch (_) {
        window.prompt("Copy this view URL:", location.href);
      }
    });
    $$(".language-toggle button").forEach((button) => {
      button.addEventListener("click", () => setLanguage(button.dataset.lang));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        event.preventDefault();
        $("#search").focus();
      }
    });
    window.addEventListener("resize", () => {
      clearTimeout(window.__networkResize);
      window.__networkResize = setTimeout(() => {
        const records = filteredRecords();
        renderFlow(records);
        renderNetwork(records);
      }, 120);
    });
  }

  async function init() {
    try {
      const response = await fetch("data/corpus.json");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.data = await response.json();
      hydrateFromUrl();
      updateStaticText();
      buildCategoryOptions();
      buildTermOptions();
      renderCodebook();
      bindEvents();
      renderAll();
    } catch (error) {
      document.body.innerHTML = `<main class="section"><h1>Corpus failed to load</h1><p>Run the site through a local web server rather than opening index.html directly.</p><pre>${escapeHtml(error.message)}</pre></main>`;
    }
  }

  init();
})();
