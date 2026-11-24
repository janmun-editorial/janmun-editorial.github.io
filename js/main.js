(() => {
  "use strict";

  document.querySelectorAll("template[data-janmun-view]").forEach(t => t.replaceWith(t.content));
  const startRoute = document.documentElement.dataset.startRoute || "home";
  const siteRoot = document.documentElement.dataset.siteRoot || "./";
  const routeHref = id => siteRoot + (id === "home" ? "" : id === "journal" ? "archive/" : id + "/") + (location.protocol === "file:" ? "index.html" : "") + (id === "journal" ? "?category=journal" : "");
  document.querySelectorAll("a[data-route-link]").forEach(link => { if (location.protocol === "file:") link.href = routeHref(link.dataset.routeLink); });

  // 01. Article catalogue and local preferences
  const articles = [
    { id: "about", n: "01", title: "설립의 말", sub: "문학의 바깥을 읽는 이유", type: "창립 문서", category: "founding", author: "잔문", archivedOn: "2026-11-24" },
    { id: "editorial", n: "02", title: "편집 철학", sub: "무엇을 남길 것인가.", type: "창립 문서", category: "founding", author: "잔문", archivedOn: "2026-11-24" },
    { id: "ethics", n: "03", title: "창작 윤리", sub: "완벽함이 아니라 정직함.", type: "창립 문서", category: "founding", author: "잔문", archivedOn: "2026-11-24" },
    { id: "members", n: "04", title: "잔문 동인", sub: "서로의 가장 이른 독자이자, 가장 오래 남는 독자로.", type: "창립 문서", category: "founding", author: "잔문", archivedOn: "2026-11-24" }
  ];
  const pages = ["home", ...articles.map(article => article.id), "books", "submission", "archive", "saved", "news"];

  const archiveCategories = {"all":"전체","founding":"창립 문서","journal":"문예지","author":"작가 기록","editing":"편집 기록","criticism":"문학 비평","publication":"출간 기록","community":"공동체 기록"};
  let archiveCategory = "all";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  function read(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem("janmun:" + key)) ?? fallback;
    } catch {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem("janmun:" + key, JSON.stringify(value));
    } catch {
      // Reading tools still work for this session when storage is unavailable.
    }
  }

  const validIds = new Set(articles.map(article => article.id));
  function readIds(key) {
    const value = read(key, []);
    return Array.isArray(value) ? [...new Set(value.filter(id => validIds.has(id)))] : [];
  }

  const state = {
    saved: readIds("saved"),
    finished: readIds("finished"),
    last: read("last", null),
    theme: read("theme", "light") === "dark" ? "dark" : "light",
    size: Number(read("size", 18)),
    focus: false,
    page: "home",
    route: null
  };
  state.size = Number.isFinite(state.size) ? Math.min(25, Math.max(15, state.size)) : 18;

  const nav = $(".nav");
  const mobile = $("#mobile");
  const dialog = $("#search-dialog");
  const toast = $("#toast");
  let toastTimer;

  function notify(message) {
    toast.textContent = message;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2600);
  }

  // 02. Appearance and page navigation
  function applyTheme() {
    const dark = state.theme === "dark";
    document.documentElement.dataset.theme = state.theme;
    $("#theme").setAttribute("aria-pressed", String(dark));
    $("#theme").title = dark ? "밝은 화면" : "어두운 화면";
    $("#theme").setAttribute("aria-label", dark ? "밝은 화면으로 전환" : "어두운 화면으로 전환");
    const themeMeta = $('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = dark ? "#20221f" : "#f5f2eb";
    write("theme", state.theme);
  }

  function applySize() {
    document.documentElement.style.setProperty("--reading", state.size + "px");
    write("size", state.size);
  }

  function closeNav() {
    nav.classList.remove("open");
    mobile.setAttribute("aria-expanded", "false");
    mobile.setAttribute("aria-label", "메뉴 열기");
  }

  function setFocus(on, restoreFocus = true) {
    state.focus = on;
    document.body.classList.toggle("focus-mode", on);
    if (on) {
      $("#focus-exit").focus({ preventScroll: true });
    } else if (restoreFocus && document.activeElement === $("#focus-exit")) {
      $(".view:not([hidden]) [data-focus]")?.focus({ preventScroll: true });
    }
    updateProgress();
  }

  function route() {
    const fragment = location.hash.slice(1);
    const legacy = pages.includes(fragment) || fragment === "journal" || fragment.startsWith("news/");
    const requested = legacy ? fragment : (startRoute === "archive" && new URLSearchParams(location.search).get("category") === "journal" ? "journal" : startRoute);
    if (legacy && location.protocol !== "file:") {
      const known = !requested.startsWith("news/") || notices.some(n => "news/" + n.id === requested);
      location.replace(routeHref(known ? requested : "news"));
      return;
    }
    const id = requested === "journal" ? "archive" : (requested.startsWith("news/") ? "news" : (pages.includes(requested) ? requested : "home"));
    if (requested === "journal") archiveCategory = "journal";
    else if (requested === "archive" && state.route !== "archive") archiveCategory = "all";
    const changed = state.route !== requested;
    state.route = requested;
    pendingSelection = null;
    setFocus(false, false);
    state.page = id;

    if (validIds.has(id)) {
      state.last = id;
      write("last", id);
    }

    $$(".view").forEach(view => { view.hidden = view.id !== "page-" + id; });
    $$(".nav a, .mobile-dock a").forEach(link => {
      const target = link.dataset.routeLink;
      const active = target === id && !(requested === "journal" && link.closest(".mobile-dock"));
      if (active || (requested === "journal" && target === "journal")) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    const title = $("#page-" + id + " h1")?.textContent.trim();
    document.title = id === "home"
      ? "잔문 殘文 — 독립 문학 편집실"
      : (title || "잔문") + " | 잔문 殘文";

    closeNav();
    if (dialog.open) dialog.close();
    if ($("#quote-dialog").open) $("#quote-dialog").close();
    updateReading();
    if (id === "archive" || id === "saved") renderLists();
    if (id === "news") renderNewsRoute(requested);
    if (changed) $("#main").focus({ preventScroll: true });
    if (fragment === "note" && validIds.has(id)) openNote(id);
    window.scrollTo({ top: 0, behavior: "instant" });
    updateProgress();
  }

  function updateProgress() {
    const available = document.documentElement.scrollHeight - window.innerHeight;
    const fraction = available > 0 ? Math.max(0, Math.min(1, window.scrollY / available)) : 0;
    $(".progress").style.width = fraction * 100 + "%";
  }

  // 03. Reading time, bookmarks and completed articles
  function articleBody(article) {
    return $("#page-" + article.id + " .prose")?.textContent || "";
  }

  function timeFor(article) {
    const length = articleBody(article).replace(/\s/g, "").length;
    return Math.max(1, Math.ceil(length / 350)) + "분 읽기 (예상)";
  }

  function updateReading() {
    articles.forEach(article => {
      const done = state.finished.includes(article.id);
      const time = timeFor(article);
      const meta = $("[data-entry-meta=" + article.id + "]");
      if (meta) meta.textContent = time + (done ? " · 읽음" : "");
      $("[data-reading-time=" + article.id + "]").textContent = time;
      $("[data-reading-status=" + article.id + "]").textContent = done ? "읽음" : "아직 읽지 않은 글";

      const button = $("[data-read=" + article.id + "]");
      button.textContent = done ? "✓ 읽음 · 취소" : "읽음 표시";
      button.setAttribute("aria-pressed", String(done));
    });

    const last = articles.find(article => article.id === state.last);
    $("#resume").hidden = !last;
    if (last) {
      $("#resume-link").href = routeHref(last.id);
      $("#resume-link").textContent = last.title + " →";
    }
  }

  function updateSaves() {
    $$("[data-save]").forEach(button => {
      const saved = state.saved.includes(button.dataset.save);
      button.textContent = saved ? "★ 저장됨" : "☆ 읽기 목록에 저장";
      button.setAttribute("aria-pressed", String(saved));
    });
    $("#save-count").textContent = state.saved.length;
  }

  function toggleSave(id) {
    if (!validIds.has(id)) return;
    const removing = state.saved.includes(id);
    state.saved = removing ? state.saved.filter(item => item !== id) : [...state.saved, id];
    write("saved", state.saved);
    renderLists();
    notify(removing ? "읽기 목록에서 삭제했어요." : "읽기 목록에 저장했어요.");
  }

  function toggleRead(id) {
    if (!validIds.has(id)) return;
    const removing = state.finished.includes(id);
    state.finished = removing ? state.finished.filter(item => item !== id) : [...state.finished, id];
    write("finished", state.finished);
    updateReading();
    renderLists();
    notify(removing ? "읽음 표시를 취소했어요." : "읽은 글로 기록했어요.");
  }

  // 04. Search and archive
  function matches(article, query) {
    const haystack = [article.title, article.sub, article.type, article.author, article.archivedOn, articleBody(article)].join(" ");
    return haystack.toLowerCase().includes(query.toLowerCase().trim());
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content !== undefined) node.textContent = content;
    return node;
  }

  function makeRow(article) {
    const row = element("div", "archive-row");
    const number = element("span", "eyebrow", article.n);
    const link = element("a");
    link.href = routeHref(article.id);
    link.append(
      element("span", "archive-record-meta", [article.type, article.author, article.archivedOn ? "등록 " + article.archivedOn : ""].filter(Boolean).join(" · ")),
      element("h3", "", article.title),
      element("p", "", article.sub + " · " + timeFor(article) +
        (state.finished.includes(article.id) ? " · 읽음" : ""))
    );
    const button = element("button", "outline");
    button.type = "button";
    button.dataset.save = article.id;
    row.append(number, link, button);
    return row;
  }

  function fillList(target, items, emptyText) {
    target.replaceChildren(...items.map(makeRow));
    if (!items.length) target.append(element("p", "empty", emptyText));
  }

  function initArchiveFilters() {
    const populate = (id, values) => {
      const select = $(id);
      values.forEach(value => {
        const option = element("option", "", value);
        option.value = value;
        select.append(option);
      });
    };
    populate("#archive-author", [...new Set(articles.map(a => a.author).filter(Boolean))].sort((a,b) => a.localeCompare(b,"ko")));
    populate("#archive-year", [...new Set(articles.map(a => a.archivedOn?.slice(0,4)).filter(Boolean))].sort().reverse());
  }

  function renderLists() {
    const query = $("#archive-query").value;
    const filter = $("#archive-filter").value;
    const author = $("#archive-author").value;
    const year = $("#archive-year").value;
    const sort = $("#archive-sort").value;
    const categoryItems = articles.filter(article => archiveCategory === "all" || article.category === archiveCategory);
    const list = categoryItems.filter(article => {
      if (!matches(article, query)) return false;
      if (author !== "all" && article.author !== author) return false;
      if (year !== "all" && article.archivedOn?.slice(0,4) !== year) return false;
      if (filter === "saved") return state.saved.includes(article.id);
      if (filter === "read") return state.finished.includes(article.id);
      if (filter === "unread") return !state.finished.includes(article.id);
      return true;
    });
    const byNumber = (a,b) => a.n.localeCompare(b.n, "ko", { numeric: true });
    const byDate = (a,b) => (a.archivedOn || "").localeCompare(b.archivedOn || "");
    list.sort(sort === "newest" ? (a,b) => byDate(b,a) || byNumber(a,b) : sort === "oldest" ? (a,b) => byDate(a,b) || byNumber(a,b) : byNumber);
    $$("[data-archive-category]").forEach(button => {
      const key = button.dataset.archiveCategory;
      const count = key === "all" ? articles.length : articles.filter(a => a.category === key).length;
      button.setAttribute("aria-pressed", String(key === archiveCategory));
      button.querySelector("[data-archive-category-count]").textContent = count ? String(count) : "준비 중";
    });
    $("#archive-count").textContent = archiveCategories[archiveCategory] + " · " + list.length + "편 / " + categoryItems.length + "편";
    const pending = archiveCategory !== "all" && categoryItems.length === 0;
    const empty = pending ? archiveCategories[archiveCategory] + " 기록은 아직 공개되지 않았습니다. 첫 기록을 준비하고 있습니다." : "조건에 맞는 기록이 없습니다.";
    fillList($("#archive-list"), list, empty);
    $("#archive-empty-actions").hidden = !pending;
    fillList($("#saved-list"), articles.filter(article => state.saved.includes(article.id)),
      "아직 저장한 글이 없습니다. 아카이브에서 읽고 싶은 글을 저장해 보세요.");
    renderLibrary();
  }

  function search() {
    const query = $("#search-query").value.trim();
    const target = $("#search-results");
    const results = articles.filter(article => matches(article, query));
    const noticeResults = notices.filter(n => [n.title, ...n.body, newsCategories[n.category]].join(" ").toLowerCase().includes(query.toLowerCase()));
    target.replaceChildren();

    for (const article of results) {
      const link = element("a", "", article.title + " — " + article.sub);
      link.href = routeHref(article.id);
      const body = articleBody(article).replace(/\s+/g, " ").trim();
      const matchIndex = query ? body.toLowerCase().indexOf(query.toLowerCase()) : 0;
      const start = Math.max(0, matchIndex - 20);
      const excerpt = (start ? "…" : "") + body.slice(start, start + 85)
        + (body.length > start + 85 ? "…" : "");
      link.append(element("small", "", excerpt));
      target.append(link);
    }
    for (const notice of noticeResults) {
      const link = element("a", "", "소식 · " + notice.title);
      link.href = routeHref("news/" + notice.id);
      link.append(element("small", "", notice.body[0].slice(0, 85) + (notice.body[0].length > 85 ? "…" : "")));
      target.append(link);
    }
    if (!results.length && !noticeResults.length) target.textContent = "검색 결과가 없습니다.";
  }

  function openSearch() {
    if (dialog.open) return;
    dialog.showModal();
    $("#search-query").focus();
    search();
  }

  async function share(id) {
    const url = new URL(routeHref(id), location.href);
    try {
      await navigator.clipboard.writeText(url.href);
      notify("링크를 복사했어요.");
    } catch {
      window.prompt("이 링크를 복사하세요.", url.href);
    }
  }

  // 05. Draft preparation — no network submission
  function downloadDraft(form) {
    const data = new FormData(form);
    const content = [
      "잔문 투고 준비용 초안 (미접수)",
      "필명: " + data.get("name"),
      "작품명: " + data.get("title"),
      "분야: " + data.get("genre"),
      "AI 활용 방식: " + data.get("ai"),
      "작품 소개: " + data.get("intro")
    ].join("\n\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = "janmun-submission-draft.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("준비용 초안을 내려받았습니다. 접수된 것은 아닙니다.");
  }

  // 06. Event bindings
  $("#theme").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
  });

  mobile.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    mobile.setAttribute("aria-expanded", String(open));
    mobile.setAttribute("aria-label", open ? "메뉴 닫기" : "메뉴 열기");
  });

  nav.addEventListener("click", event => {
    if (event.target.closest("a")) closeNav();
  });
  $("#search-open").addEventListener("click", openSearch);
  $("#search-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  $("#search-query").addEventListener("input", search);
  $("#search-results").addEventListener("click", event => {
    if (event.target.closest("a")) dialog.close();
  });
  $("#archive-query").addEventListener("input", renderLists);
  $("#archive-filter").addEventListener("change", renderLists);
  ["#archive-author", "#archive-year", "#archive-sort"].forEach(id => $(id).addEventListener("change", renderLists));
  document.querySelectorAll("[data-archive-category]").forEach(button => button.addEventListener("click", () => {
    archiveCategory = button.dataset.archiveCategory;
    $$(".nav a, .mobile-dock a").forEach(link => {
      const target = link.dataset.routeLink;
      const active = (target === "archive" && !(archiveCategory === "journal" && link.closest(".mobile-dock"))) || (target === "journal" && archiveCategory === "journal");
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    renderLists();
  }));
  $("#focus-exit").addEventListener("click", () => setFocus(false));
  $("#resume-clear").addEventListener("click", () => {
    state.last = null;
    write("last", null);
    updateReading();
  });

  $(".skip").addEventListener("click", event => {
    event.preventDefault();
    $("#main").focus();
    $("#main").scrollIntoView();
  });

  document.addEventListener("click", event => {
    if (!event.target.closest(".mast") && nav.classList.contains("open")) closeNav();
    const button = event.target.closest("button");
    if (!button) return;

    if (button.dataset.save) toggleSave(button.dataset.save);
    if (button.dataset.share) share(button.dataset.share);
    if (button.dataset.read) toggleRead(button.dataset.read);
    if (button.hasAttribute("data-focus")) setFocus(true);
    if (button.hasAttribute("data-print")) window.print();
    if (button.dataset.size) {
      state.size = Math.min(25, Math.max(15, state.size + Number(button.dataset.size)));
      applySize();
      notify("읽기 글자 크기 " + state.size + "px");
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      closeNav();
      if (state.focus && !dialog.open) setFocus(false);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      openSearch();
    }
  });

  // Submission FAQ category filters (all questions remain accessible without JS).
  const faqFilters = Array.from(document.querySelectorAll("#page-submission [data-faq-filter]"));
  const faqGroups = Array.from(document.querySelectorAll("#page-submission [data-faq-group]"));
  faqFilters.forEach(button => button.addEventListener("click", () => {
    const key = button.dataset.faqFilter;
    faqFilters.forEach(item => item.setAttribute("aria-pressed", String(item === button)));
    faqGroups.forEach(group => { group.hidden = key !== "all" && group.dataset.faqGroup !== key; });
  }));

  $("#draft-form").addEventListener("submit", event => {
    event.preventDefault();
    downloadDraft(event.currentTarget);
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", updateProgress, { passive: true });
  window.addEventListener("resize", updateProgress);

  // 07. Private reading records and portable text exports
  const storedQuotes = read("quotes", []);
  const quotes = Array.isArray(storedQuotes) ? storedQuotes.filter(q =>
    q && validIds.has(q.article) && typeof q.text === "string" && typeof q.id === "string") : [];
  const storedNotes = read("notes", {});
  const notes = Object.create(null);
  for (const article of articles) {
    if (typeof storedNotes?.[article.id] === "string" && storedNotes[article.id].trim()) {
      notes[article.id] = storedNotes[article.id];
    }
  }
  const quoteDialog = $("#quote-dialog");
  let pendingSelection = null;

  function libraryTab(name) {
    $$("[data-library-tab]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.libraryTab === name));
    });
    $$(".library-panel").forEach(panel => { panel.hidden = panel.id !== "library-" + name; });
  }

  function recordButton(label, key, value) {
    const button = element("button", "outline", label);
    button.type = "button";
    button.dataset[key] = value;
    return button;
  }

  function renderLibrary() {
    $("#finished-count").textContent = state.finished.length;
    $("#quote-count").textContent = quotes.length;
    $("#note-count").textContent = Object.keys(notes).length;

    const quoteList = $("#quote-list");
    quoteList.replaceChildren();
    for (const quote of [...quotes].reverse()) {
      const article = articles.find(a => a.id === quote.article);
      const item = element("div", "record-item");
      const meta = element("span", "eyebrow");
      const source = element("a", "", article.title);
      source.href = routeHref(article.id);
      meta.append(source);
      const actions = element("div", "actions");
      actions.append(recordButton("문장 복사", "quoteCopy", quote.id),
        recordButton("삭제", "quoteRemove", quote.id));
      item.append(meta, element("blockquote", "", quote.text), actions);
      quoteList.append(item);
    }
    if (!quotes.length) quoteList.append(element("p", "empty", "아직 수집한 문장이 없습니다. 글의 문장 수집 버튼으로 시작하세요."));

    const noteList = $("#note-list");
    noteList.replaceChildren();
    for (const article of articles) {
      if (!notes[article.id]) continue;
      const item = element("div", "record-item");
      const source = element("a", "eyebrow", article.title + " ↗");
      source.href = routeHref(article.id);
      const actions = element("div", "actions");
      actions.append(recordButton("메모 수정", "noteEdit", article.id),
        recordButton("삭제", "noteRemove", article.id));
      item.append(source, element("p", "record-text", notes[article.id]), actions);
      noteList.append(item);
    }
    if (!Object.keys(notes).length) noteList.append(element("p", "empty", "아직 독서 메모가 없습니다."));
    fillList($("#history-list"), articles.filter(a => state.finished.includes(a.id)), "읽음 표시한 글이 아직 없습니다.");
    updateSaves();
  }

  function addQuote(id, text) {
    text = text.trim();
    if (!text || !validIds.has(id)) return;
    if (quotes.some(q => q.article === id && q.text === text)) {
      notify("이미 수집한 문장입니다.");
      return;
    }
    quotes.push({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), article: id, text });
    write("quotes", quotes);
    renderLibrary();
    notify("나의 서재에 문장을 남겼어요.");
  }

  function selectedQuote() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.rangeCount || !validIds.has(state.page)) return null;
    const prose = $("#page-" + state.page + " .prose");
    const range = selection.getRangeAt(0);
    if (!prose.contains(range.startContainer) || !prose.contains(range.endContainer)) return null;
    const text = selection.toString().trim();
    return text ? { article: state.page, text } : null;
  }

  function openQuote(id) {
    const current = selectedQuote() || pendingSelection;
    pendingSelection = null;
    if (current?.article === id) {
      addQuote(id, current.text);
      return;
    }
    const options = $("#quote-options");
    options.replaceChildren();
    $$("#page-" + id + " .prose p").forEach(paragraph => {
      const button = element("button", "quote-option", paragraph.textContent.trim());
      button.type = "button";
      button.addEventListener("click", () => {
        addQuote(id, paragraph.textContent);
        quoteDialog.close();
      });
      options.append(button);
    });
    if (!quoteDialog.open) quoteDialog.showModal();
  }

  function openNote(id) {
    const editor = $("[data-note-editor=" + id + "]");
    const textarea = $("[data-note-text=" + id + "]");
    editor.hidden = false;
    textarea.value = notes[id] || "";
    textarea.focus();
  }

  function saveNote(id) {
    const value = $("[data-note-text=" + id + "]").value.trim();
    if (value) notes[id] = value;
    else delete notes[id];
    write("notes", notes);
    $("[data-note-editor=" + id + "]").hidden = true;
    renderLibrary();
    notify(value ? "독서 메모를 저장했어요." : "빈 메모는 저장하지 않았어요.");
  }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      notify("문장을 복사했어요.");
    } catch {
      window.prompt("문장을 복사하세요.", value);
    }
  }

  function exportLibrary() {
    const title = id => articles.find(a => a.id === id)?.title || id;
    const sections = [
      "잔문 — 나의 서재",
      "[보관한 글]\n" + state.saved.map(title).join("\n"),
      "[읽은 글]\n" + state.finished.map(title).join("\n"),
      "[수집한 문장]\n" + quotes.map(q => title(q.article) + "\n" + q.text).join("\n\n"),
      "[독서 메모]\n" + Object.keys(notes).map(id => title(id) + "\n" + notes[id]).join("\n\n")
    ];
    const url = URL.createObjectURL(new Blob([sections.join("\n\n")], { type: "text/plain;charset=utf-8" }));
    const link = element("a");
    link.href = url;
    link.download = "janmun-reading-library.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("서재 기록을 파일로 내려받았어요.");
  }

  $("#quote-close").addEventListener("click", () => quoteDialog.close());
  quoteDialog.addEventListener("click", event => { if (event.target === quoteDialog) quoteDialog.close(); });
  $("#library-export").addEventListener("click", exportLibrary);
  // Capture the live selection immediately before the collect button steals focus.
  document.addEventListener("pointerdown", event => {
    pendingSelection = event.target.closest("[data-collect]") ? selectedQuote() : null;
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Tab" || event.key === "Escape") pendingSelection = null;
  });
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button) return;
    const data = button.dataset;
    if (data.libraryTab) libraryTab(data.libraryTab);
    if (data.collect) openQuote(data.collect);
    if (data.noteOpen) openNote(data.noteOpen);
    if (data.noteClose) $("[data-note-editor=" + data.noteClose + "]").hidden = true;
    if (data.noteSave) saveNote(data.noteSave);
    if (data.noteEdit) {
      location.href = routeHref(data.noteEdit) + "#note";
    }
    if (data.noteRemove) {
      delete notes[data.noteRemove];
      write("notes", notes);
      renderLibrary();
      notify("메모를 삭제했어요.");
    }
    if (data.quoteCopy) {
      const quote = quotes.find(q => q.id === data.quoteCopy);
      if (quote) copyText(quote.text);
    }
    if (data.quoteRemove) {
      const index = quotes.findIndex(q => q.id === data.quoteRemove);
      if (index !== -1) {
        quotes.splice(index, 1);
        write("quotes", quotes);
        renderLibrary();
        notify("문장을 삭제했어요.");
      }
    }
  });

  // 08. Editorial quote rotation
  const frontQuotes = [
    { id: "editorial", text: "무엇을 남길 것인가." },
    { id: "about", text: "그렇게 만든 책이 누군가의 책장에 오래 남아 있기를 바란다." },
    { id: "ethics", text: "잔문이 창작자에게 바라는 것은 완벽함이 아니라 정직함이다." },
    { id: "members", text: "서로의 가장 이른 독자이자, 가장 오래 남는 독자로." }
  ];
  let frontQuoteIndex = 0;
  $("#next-quote").addEventListener("click", () => {
    frontQuoteIndex = (frontQuoteIndex + 1) % frontQuotes.length;
    const quote = frontQuotes[frontQuoteIndex];
    const article = articles.find(item => item.id === quote.id);
    $("#front-quote").textContent = quote.text;
    $("#front-quote-source").href = routeHref(article.id);
    $("#front-quote-source").textContent = article.title;
  });

  // Public notices: editable data in news-data.js; no backend required.
  const newsCategories = {"all":"전체","notice":"공지","members":"동인 모집","submission":"원고 모집","publication":"출간","events":"행사","operations":"운영"};
  const notices = Array.isArray(window.JANMUN_NEWS) ? window.JANMUN_NEWS : [];
  let newsCategory = "all", newsPage = 1;
  const newsPageSize = 10;
  function noticeLink(item, className) {
    const a = element("a", className, item.title);
    a.href = routeHref("news/" + item.id);
    return a;
  }
  function renderNews() {
    const query = $("#news-query").value.trim().toLowerCase();
    const status = $("#news-status").value;
    const matches = notices.filter(n => (newsCategory === "all" || n.category === newsCategory)
      && (status === "all" || n.status === status)
      && [n.title, ...n.body, newsCategories[n.category], n.status].join(" ").toLowerCase().includes(query))
      .sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    document.querySelectorAll("[data-news-category]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.newsCategory === newsCategory)));
    const pinned = matches.filter(n => n.pinned);
    const ordinary = matches.filter(n => !n.pinned);
    $("#news-pinned").replaceChildren(...pinned.map(n => {
      const box = element("div","notice-pin");
      box.append(element("span","eyebrow","중요 공지"),noticeLink(n,"notice-pin-title"),element("p","",n.body[0]),element("span","notice-date",n.date));
      return box;
    }));
    $("#news-pinned").hidden = !pinned.length;
    $("#news-count").textContent = "전체 " + matches.length + "건";
    const pages = Math.max(1,Math.ceil(ordinary.length/newsPageSize));
    newsPage = Math.max(1,Math.min(newsPage,pages));
    const list = $("#news-list");
    list.replaceChildren(...ordinary.slice((newsPage-1)*newsPageSize,newsPage*newsPageSize).map(n => {
      const row = element("div","notice-row");
      row.append(element("span","notice-category",newsCategories[n.category]),noticeLink(n,"notice-row-title"),element("span","notice-state",n.status),element("time","notice-date",n.date));
      row.lastElementChild.dateTime = n.date;
      return row;
    }));
    if (!matches.length) list.append(element("p","empty",query || status !== "all" ? "조건에 맞는 소식이 없습니다." : "아직 등록된 소식이 없습니다."));
    else if (!ordinary.length) list.append(element("p","notice-empty","추가 등록된 소식은 없습니다."));
    const pager = $("#news-pagination");
    pager.replaceChildren();
    pager.hidden = pages <= 1;
    for(let p=1;p<=pages;p++) {
      const button=element("button","outline",String(p));
      button.type="button";
      if(p===newsPage) button.setAttribute("aria-current","page");
      button.addEventListener("click",()=>{newsPage=p;renderNews();});
      pager.append(button);
    }
  }
  function renderNewsRoute(requested) {
    const item = requested.startsWith("news/") ? notices.find(n=>n.id===requested.slice(5)) : null;
    const detail = $("#news-detail"), board = $("#news-board");
    board.hidden = Boolean(item);
    detail.hidden = !item;
    if (!item) {
      if (requested.startsWith("news/")) {
        location.replace(routeHref("news"));
        return;
      }
      renderNews(); return;
    }
    detail.replaceChildren();
    const back = element("a","textlink","← 소식 목록"); back.href=routeHref("news");
    const header=element("header","notice-detail-head");
    header.append(element("span","eyebrow",newsCategories[item.category]+" · "+item.status),element("h2","",item.title),element("p","notice-date","게시 "+item.date+(item.updated?" · 수정 "+item.updated:"")));
    const body=element("div","notice-detail-copy");
    item.body.forEach(p=>body.append(element("p","",p)));
    const actions=element("div","actions");
    item.links.forEach(l=>{const link=element("a","outline",l.label+" →");link.href=routeHref(l.href.replace(/^#/, ""));actions.append(link);});
    const copy=element("button","outline","공지 링크 복사");copy.type="button";
    copy.addEventListener("click",async()=>{try{await navigator.clipboard.writeText(new URL(routeHref("news/" + item.id), location.href).href);notify("공지 링크를 복사했어요.");}catch{window.prompt("이 링크를 복사하세요.",new URL(routeHref("news/" + item.id), location.href).href);}});
    actions.append(copy);
    detail.append(back,header,body,actions);
    document.title=item.title+" | 잔문 殘文";
  }
  function initNews() {
    document.querySelectorAll("[data-news-category]").forEach(button=>button.addEventListener("click",()=>{newsCategory=button.dataset.newsCategory;newsPage=1;renderNews();}));
    $("#news-query").addEventListener("input",()=>{newsPage=1;renderNews();});
    $("#news-status").addEventListener("change",()=>{newsPage=1;renderNews();});
    renderNews();
  }

  // 09. Initialization
  applyTheme();
  applySize();
  initArchiveFilters();
  initNews();
  renderLists();
  route();
})();
