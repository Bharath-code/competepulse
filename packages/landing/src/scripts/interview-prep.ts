/**
 * Interview brief interactions: progress checkboxes (localStorage), drill reveal,
 * category filter, and sticky-nav active section highlighting.
 */

const STORAGE_KEY = "competepulse-interview-progress-v1";

function loadProgress(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function saveProgress(ids: Set<string>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

function initProgress(): void {
  const root = document.querySelector<HTMLElement>("[data-progress]");
  if (!root) return;

  const checked = loadProgress();
  const boxes = root.querySelectorAll<HTMLInputElement>("input[data-topic-id]");
  const meter = root.querySelector<HTMLElement>("[data-progress-meter]");
  const label = root.querySelector<HTMLElement>("[data-progress-label]");

  function render(): void {
    const total = boxes.length;
    let n = 0;
    for (const box of boxes) {
      const id = box.dataset.topicId;
      if (!id) continue;
      box.checked = checked.has(id);
      if (box.checked) n += 1;
    }
    const pct = total === 0 ? 0 : Math.round((n / total) * 100);
    if (meter) meter.style.width = `${pct}%`;
    if (label) label.textContent = `${n} / ${total} ready`;
  }

  for (const box of boxes) {
    box.addEventListener("change", () => {
      const id = box.dataset.topicId;
      if (!id) return;
      if (box.checked) checked.add(id);
      else checked.delete(id);
      saveProgress(checked);
      render();
    });
  }

  root.querySelector("[data-progress-reset]")?.addEventListener("click", () => {
    checked.clear();
    saveProgress(checked);
    render();
  });

  render();
}

function initDrills(): void {
  const board = document.querySelector<HTMLElement>("[data-drill-board]");
  if (!board) return;

  const cards = [...board.querySelectorAll<HTMLElement>("[data-drill-card]")];
  const filters = board.querySelectorAll<HTMLButtonElement>("[data-drill-filter]");

  function applyFilter(category: string): void {
    for (const card of cards) {
      const cat = card.dataset.category ?? "";
      const show = category === "all" || cat === category;
      card.hidden = !show;
    }
    for (const btn of filters) {
      const active = btn.dataset.drillFilter === category;
      btn.setAttribute("aria-pressed", active ? "true" : "false");
    }
  }

  for (const btn of filters) {
    btn.addEventListener("click", () => {
      applyFilter(btn.dataset.drillFilter ?? "all");
    });
  }

  for (const card of cards) {
    const answer = card.querySelector<HTMLElement>("[data-drill-answer]");
    const reveal = card.querySelector<HTMLButtonElement>("[data-drill-reveal]");
    const hide = card.querySelector<HTMLButtonElement>("[data-drill-hide]");
    if (!answer || !reveal) continue;

    reveal.addEventListener("click", () => {
      answer.hidden = false;
      reveal.hidden = true;
      if (hide) hide.hidden = false;
    });

    hide?.addEventListener("click", () => {
      answer.hidden = true;
      reveal.hidden = false;
      hide.hidden = true;
    });
  }

  applyFilter("all");
}

function initStackReveal(): void {
  for (const details of document.querySelectorAll<HTMLDetailsElement>("[data-stack-card]")) {
    details.addEventListener("toggle", () => {
      /* native details; kept for future analytics hooks */
    });
  }
}

function initNavSpy(): void {
  const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-interview-nav] a")];
  if (links.length === 0 || !("IntersectionObserver" in window)) return;

  const map = new Map<string, HTMLAnchorElement>();
  for (const link of links) {
    const id = link.getAttribute("href")?.replace(/^#/, "");
    if (id) map.set(id, link);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const id = entry.target.id;
        for (const link of links) link.removeAttribute("aria-current");
        map.get(id)?.setAttribute("aria-current", "true");
      }
    },
    { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
  );

  for (const id of map.keys()) {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  }
}

function initPitchPractice(): void {
  for (const btn of document.querySelectorAll<HTMLButtonElement>("[data-copy-pitch]")) {
    btn.addEventListener("click", async () => {
      const targetId = btn.dataset.copyPitch;
      const el = targetId ? document.getElementById(targetId) : null;
      if (!el) return;
      try {
        await navigator.clipboard.writeText(el.textContent?.trim() ?? "");
        const prev = btn.textContent;
        btn.textContent = "Copied";
        window.setTimeout(() => {
          btn.textContent = prev;
        }, 1200);
      } catch {
        btn.textContent = "Select & copy manually";
      }
    });
  }
}

initProgress();
initDrills();
initStackReveal();
initNavSpy();
initPitchPractice();
