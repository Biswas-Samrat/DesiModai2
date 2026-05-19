import { connectRealtime, context } from "@devvit/web/client";
import {
  dashboardChannel,
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
};

const app = document.querySelector<HTMLDivElement>("#app");
let selectedDays: DateRange = 1;
let dashboardVisible = false;
const POLL_INTERVAL_MS = 12_000;

function value(input: number | undefined): string {
  return String(input ?? 0);
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

function renderDashboard(data: DashboardData): void {
  if (!app) return;

  dashboardVisible = true;

  app.innerHTML = `
    <header class="header">
      <div class="brand-mark">M</div>
      <h1 class="title">DesiMod AI Insights</h1>
      <div class="user">Logged in as: u/${data.username ?? "unknown"}</div>
      <div class="live" aria-live="polite">Live</div>
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

    if (options?.silent && dashboardVisible) {
      updateDashboardValues(data);
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

function startLiveUpdates(): void {
  if (context.subredditId) {
    connectRealtime<DashboardRefreshMessage>({
      channel: dashboardChannel(context.subredditId),
      onMessage(msg: DashboardRefreshMessage) {
        if (msg.type === "refresh") {
          void loadDashboard({ silent: true });
        }
      },
    });
  }

  window.setInterval(() => {
    if (dashboardVisible) {
      void loadDashboard({ silent: true });
    }
  }, POLL_INTERVAL_MS);
}

void loadDashboard();
startLiveUpdates();
