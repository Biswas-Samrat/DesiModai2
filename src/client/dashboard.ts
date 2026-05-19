import { connectRealtime, context, isRealtimeConnected } from "@devvit/web/client";
import {
  resolveDashboardChannel,
  type DashboardRefreshMessage,
} from "../shared/dashboardRealtime.js";

type DateRange = 1 | 3 | 7;

type DashboardData = {
  isMod: boolean;
  username?: string;
  toxicRemovals?: number;
  scamRemovals?: number;
  warnings?: number;
  escalations?: number;
  timeSaved?: number;
  refreshChannel?: string;
};

const app = document.querySelector<HTMLDivElement>("#app");
let selectedDays: DateRange = 1;
let dashboardVisible = false;
let refreshChannel: string | null = null;
let pollTimer: number | undefined;

const POLL_VISIBLE_MS = 3_000;
const POLL_HIDDEN_MS = 20_000;

function value(input: number | undefined): string {
  return String(input ?? 0);
}

function resolveClientChannel(data?: DashboardData): string | null {
  if (data?.refreshChannel) {
    return data.refreshChannel;
  }
  return resolveDashboardChannel(context.subredditId, context.subredditName);
}

function renderHidden(): void {
  if (!app) return;
  dashboardVisible = false;
  app.innerHTML = `<section class="empty"></section>`;
}

function renderError(): void {
  if (!app) return;
  dashboardVisible = false;
  app.innerHTML = `
    <section class="loading">
      <h1>Dashboard unavailable</h1>
      <p>Please try opening the dashboard again.</p>
    </section>
  `;
}

function setLiveBadge(connected: boolean): void {
  const live = app?.querySelector<HTMLElement>(".live");
  if (!live) return;
  live.textContent = connected ? "Live" : "Syncing";
  live.classList.toggle("live-connected", connected);
}

function renderDashboard(data: DashboardData): void {
  if (!app) return;

  dashboardVisible = true;

  app.innerHTML = `
    <header class="header">
      <div class="brand-mark">M</div>
      <h1 class="title">DesiMod AI Insights</h1>
      <div class="user">Logged in as: u/${data.username ?? "unknown"}</div>
      <div class="live" aria-live="polite">Syncing</div>
    </header>

    <section class="timeframe">
      <span class="label">TIMEFRAME</span>
      <div class="segments" role="group" aria-label="Dashboard timeframe">
        ${[1, 3, 7].map((days) => `
          <button class="segment ${selectedDays === days ? "active" : ""}" data-days="${days}">
            ${days === 1 ? "24h" : `${days}d`}
          </button>
        `).join("")}
      </div>
    </section>

    <section class="grid">
      <article class="stat">
        <div class="value toxic">${value(data.toxicRemovals)}</div>
        <div class="caption">TOXIC REMOVALS</div>
      </article>
      <article class="stat">
        <div class="value scam">${value(data.scamRemovals)}</div>
        <div class="caption">SCAM FLAGGED</div>
      </article>
      <article class="stat">
        <div class="value warnings">${value(data.warnings)}</div>
        <div class="caption">USER WARNINGS</div>
      </article>
      <article class="stat">
        <div class="value escalations">${value(data.escalations)}</div>
        <div class="caption">MODMAIL REPORTS</div>
      </article>
    </section>

    <section class="time-saved">
      <div class="time-value">~${value(data.timeSaved)} minutes</div>
      <div class="caption">Estimated moderator time saved</div>
    </section>

    <footer class="footer">AI-Powered Moderation for Desi Communities</footer>
  `;

  app.querySelectorAll<HTMLButtonElement>(".segment").forEach((button) => {
    button.addEventListener("click", () => {
      const nextDays = Number(button.dataset.days) as DateRange;
      selectedDays = nextDays === 3 || nextDays === 7 ? nextDays : 1;
      void loadDashboard();
    });
  });

  setLiveBadge(refreshChannel ? isRealtimeConnected(refreshChannel) : false);
}

async function loadDashboard(options?: { silent?: boolean }): Promise<void> {
  try {
    const response = await fetch(`/api/dashboard?days=${selectedDays}`);
    if (!response.ok) {
      if (!options?.silent) {
        renderError();
      }
      return;
    }

    const data = (await response.json()) as DashboardData;
    if (!data.isMod) {
      if (!options?.silent) {
        renderHidden();
      }
      return;
    }

    const nextChannel = resolveClientChannel(data);
    if (nextChannel && nextChannel !== refreshChannel) {
      refreshChannel = nextChannel;
      ensureRealtimeSubscription();
    }

    if (options?.silent && dashboardVisible) {
      updateDashboardValues(data);
      setLiveBadge(refreshChannel ? isRealtimeConnected(refreshChannel) : false);
      return;
    }

    renderDashboard(data);
  } catch {
    if (!options?.silent) {
      renderError();
    }
  }
}

function updateDashboardValues(data: DashboardData): void {
  if (!app) return;

  const toxic = app.querySelector(".value.toxic");
  const scam = app.querySelector(".value.scam");
  const warnings = app.querySelector(".value.warnings");
  const escalations = app.querySelector(".value.escalations");
  const timeSaved = app.querySelector(".time-value");

  if (toxic) toxic.textContent = value(data.toxicRemovals);
  if (scam) scam.textContent = value(data.scamRemovals);
  if (warnings) warnings.textContent = value(data.warnings);
  if (escalations) escalations.textContent = value(data.escalations);
  if (timeSaved) timeSaved.textContent = `~${value(data.timeSaved)} minutes`;
}

function ensureRealtimeSubscription(): void {
  if (!refreshChannel) return;

  connectRealtime<DashboardRefreshMessage>({
    channel: refreshChannel,
    onConnect() {
      setLiveBadge(true);
    },
    onDisconnect() {
      setLiveBadge(false);
    },
    onMessage(msg: DashboardRefreshMessage) {
      if (msg.type === "refresh") {
        void loadDashboard({ silent: true });
      }
    },
  });
}

function schedulePolling(): void {
  if (pollTimer !== undefined) {
    window.clearInterval(pollTimer);
  }

  const interval =
    document.visibilityState === "visible" ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;

  pollTimer = window.setInterval(() => {
    if (dashboardVisible) {
      void loadDashboard({ silent: true });
    }
  }, interval);
}

function startLiveUpdates(): void {
  refreshChannel = resolveClientChannel();
  if (refreshChannel) {
    ensureRealtimeSubscription();
  }

  schedulePolling();

  document.addEventListener("visibilitychange", () => {
    schedulePolling();
    if (document.visibilityState === "visible" && dashboardVisible) {
      void loadDashboard({ silent: true });
    }
  });
}

void loadDashboard();
startLiveUpdates();
