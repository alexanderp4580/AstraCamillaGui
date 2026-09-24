/**
 * VizLayoutManager: Responsive collapse/expand logic for viz-options groups
 * 
 * Manages the layout of visualization option groups in a horizontal strip,
 * automatically collapsing/expanding groups based on available space and user interaction.
 * 
 * Features:
 * - Responsive layout that adapts to viewport width
 * - User-driven expansion via stub clicks
 * - Priority-based auto-expansion when space permits
 * - Smooth scrolling to focused groups
 * - Overflow affordances (edge fade indicators)
 */

export interface VizGroup {
  id: string;
  priority: number;
  expandedWidth: number;
  el: HTMLElement;
}

export interface VizLayoutManagerOptions {
  stubWidth?: number;
}

export class VizLayoutManager {
  private host: HTMLElement;
  private viewport: HTMLElement;
  private strip: HTMLElement;
  private groups: VizGroup[];
  private S: number; // stub width
  private N: number; // number of groups
  private capExpandedCount: number;
  private maxWi: number;
  private MIN_SCROLL_WIDTH: number;
  private userChosen: Set<string>;
  private lastUser: string | null;
  private ro: ResizeObserver;
  private _frozenId: string | null = null;
  private _t: number | null = null;

  constructor(
    hostEl: HTMLElement,
    viewportEl: HTMLElement,
    stripEl: HTMLElement,
    groups: VizGroup[],
    opts: VizLayoutManagerOptions = {}
  ) {
    this.host = hostEl;
    this.viewport = viewportEl;
    this.strip = stripEl;
    this.groups = groups;

    this.S = opts.stubWidth ?? 44;
    this.N = groups.length;
    this.capExpandedCount = this.N; // Allow all groups expanded when space permits

    this.maxWi = Math.max(...groups.map(g => g.expandedWidth));
    this.MIN_SCROLL_WIDTH = (this.N - 1) * this.S + this.maxWi;

    this.userChosen = new Set();
    this.lastUser = null;

    this.strip.style.minWidth = this.MIN_SCROLL_WIDTH + 'px';

    this.ro = new ResizeObserver(() => this.scheduleLayout());
    this.ro.observe(this.host);

    // Wire up stub click handlers
    for (const g of this.groups) {
      const stub = g.el.querySelector('.groupStub') as HTMLElement;
      if (stub) {
        stub.addEventListener('click', () => this.toggleChoice(g.id));
        stub.addEventListener('keydown', (e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.toggleChoice(g.id);
          }
        });
      }
    }

    this.viewport.addEventListener('scroll', () => this.updateOverflowAffordances());
    this.layout(true);
    this.updateOverflowAffordances();
  }

  scheduleLayout() {
    if (this._t !== null) clearTimeout(this._t);
    this._t = window.setTimeout(() => {
      this.layout(false);
      this.updateOverflowAffordances();
    }, 30);
  }

  availableWidth() {
    return this.host.clientWidth;
  }

  constrained() {
    return this.availableWidth() < this.MIN_SCROLL_WIDTH;
  }

  groupById(id: string): VizGroup | null {
    return this.groups.find(g => g.id === id) ?? null;
  }

  sortedByPriorityAsc(list: VizGroup[]): VizGroup[] {
    return [...list].sort((a, b) => a.priority - b.priority);
  }

  resetVisual() {
    for (const g of this.groups) {
      g.el.classList.remove('expanded', 'chosen');
    }
  }

  markChosen() {
    for (const g of this.groups) {
      if (this.userChosen.has(g.id)) g.el.classList.add('chosen');
    }
  }

  totalWidthForExpandedSet(E: Set<string>): number {
    let total = this.N * this.S;
    for (const id of E) {
      const g = this.groupById(id);
      if (g) total += (g.expandedWidth - this.S);
    }
    return total;
  }

  defaultExpandedSetResponsive(): Set<string> {
    const E = new Set<string>();
    const budget = this.availableWidth() - this.N * this.S;
    let used = 0;
    for (const g of this.sortedByPriorityAsc(this.groups)) {
      if (E.size >= this.capExpandedCount) break;
      const extra = g.expandedWidth - this.S;
      if (used + extra <= budget) {
        E.add(g.id);
        used += extra;
      }
    }
    if (E.size === 0) E.add(this.sortedByPriorityAsc(this.groups)[0].id);
    return E;
  }

  evictUntilFits(E: Set<string>, protectId: string | null = null) {
    while (E.size > this.capExpandedCount) {
      const v = this.pickEvictionCandidate(E, protectId);
      if (!v) break;
      E.delete(v.id);
      this.userChosen.delete(v.id);
      if (this.lastUser === v.id) this.lastUser = null;
    }
    while (this.totalWidthForExpandedSet(E) > this.availableWidth()) {
      const v = this.pickEvictionCandidate(E, protectId);
      if (!v) break;
      E.delete(v.id);
      this.userChosen.delete(v.id);
      if (this.lastUser === v.id) this.lastUser = null;
    }
  }

  pickEvictionCandidate(E: Set<string>, protectId: string | null): VizGroup | null {
    const candidates = [...E]
      .map(id => this.groupById(id))
      .filter((g): g is VizGroup => g !== null)
      .filter(g => g.id !== protectId);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates[0];
  }

  toggleChoice(id: string) {
    const already = this.userChosen.has(id);
    if (already) {
      this.userChosen.delete(id);
      if (this.lastUser === id) this.lastUser = null;
    } else {
      this.userChosen.add(id);
      this.lastUser = id;
    }
    this.layout(false);
    const target = this.groupById(this.lastUser ?? id);
    if (target) requestAnimationFrame(() => this.scrollGroupIntoView(target.el));
  }

  expandedIdConstrained(): string {
    if (this.lastUser) return this.lastUser;
    return this.sortedByPriorityAsc(this.groups)[0].id;
  }

  layout(first: boolean) {
    const isCon = this.constrained();
    this.viewport.classList.toggle('constrained', isCon);
    this.resetVisual();
    this.markChosen();

    if (isCon) {
      const id = this.expandedIdConstrained();
      const g = this.groupById(id) ?? this.sortedByPriorityAsc(this.groups)[0];
      g.el.classList.add('expanded');
      this._frozenId = g.id;
      // Always re-check on every layout pass (not just the first time this id
      // is frozen) — the container can settle to its final width across
      // several resize events, and a stale scroll position from an earlier,
      // not-yet-final width otherwise never gets corrected.
      requestAnimationFrame(() => this.scrollGroupIntoView(g.el));
      // .groupContainer.expanded animates width over 0.18s (see CSS). A
      // correction computed mid-transition reads a partial offsetWidth, so
      // this immediate call can land slightly wrong. A second pass once the
      // transition has settled catches that — cheap and idempotent, since
      // scrollGroupIntoView no-ops if the group is already fully in view.
      window.setTimeout(() => this.scrollGroupIntoView(g.el), 200);
      return;
    }

    let E = this.defaultExpandedSetResponsive();
    const orderedChosen: VizGroup[] = [];
    if (this.lastUser) {
      const lu = this.groupById(this.lastUser);
      if (lu) orderedChosen.push(lu);
    }
    for (const g of this.sortedByPriorityAsc([...this.userChosen].map(id => this.groupById(id)).filter((g): g is VizGroup => g !== null))) {
      if (!orderedChosen.find(x => x.id === g.id)) orderedChosen.push(g);
    }
    for (const cg of orderedChosen) {
      E.add(cg.id);
      this.evictUntilFits(E, this.lastUser ?? cg.id);
    }
    for (const g of this.sortedByPriorityAsc(this.groups)) {
      if (E.size >= this.capExpandedCount) break;
      if (E.has(g.id)) continue;
      const t = new Set(E);
      t.add(g.id);
      if (this.totalWidthForExpandedSet(t) <= this.availableWidth()) E = t;
    }
    if (E.size === 0) E.add(this.sortedByPriorityAsc(this.groups)[0].id);
    for (const id of E) {
      const g = this.groupById(id);
      if (g) g.el.classList.add('expanded');
    }
  }

  scrollGroupIntoView(groupEl: HTMLElement) {
    if (!this.viewport.classList.contains('constrained')) return;
    const vp = this.viewport;
    // Absolute target computed from offsetLeft/offsetWidth (stable layout
    // geometry), not getBoundingClientRect (reflects the current, possibly
    // mid-animation scroll position). This call can run several times back
    // to back while the container's width is still settling — an
    // incremental "nudge from current scrollLeft" approach compounds into
    // the wrong resting position when a new correction lands before the
    // previous smooth-scroll finishes; an absolute target is idempotent.
    const margin = 16;
    const elLeft = groupEl.offsetLeft;
    const elRight = elLeft + groupEl.offsetWidth;
    const maxScroll = Math.max(0, vp.scrollWidth - vp.clientWidth);
    let target: number;
    if (elLeft - margin < vp.scrollLeft) {
      target = elLeft - margin;
    } else if (elRight + margin > vp.scrollLeft + vp.clientWidth) {
      target = elRight + margin - vp.clientWidth;
    } else {
      return; // already fully visible with margin
    }
    target = Math.max(0, Math.min(target, maxScroll));
    vp.scrollTo({ left: target, behavior: 'smooth' });
  }

  updateOverflowAffordances() {
    const vp = this.viewport;
    const hasOverflow = vp.classList.contains('constrained') && (vp.scrollWidth > vp.clientWidth + 1);
    if (!hasOverflow) {
      vp.classList.remove('hasLeftOverflow', 'hasRightOverflow');
      return;
    }
    vp.classList.toggle('hasLeftOverflow', vp.scrollLeft > 2);
    vp.classList.toggle('hasRightOverflow', vp.scrollLeft < (vp.scrollWidth - vp.clientWidth - 2));
  }

  destroy() {
    this.ro.disconnect();
  }
}
