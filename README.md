# DesiMod AI 2 (Devvit + Gemini + Redis)

**Advanced AI Moderation for South Asian Communities.**

DesiMod AI 2 is a professional-grade moderation tool designed to handle the linguistic complexities of Indian and Bangladeshi subreddits. It specializes in detecting toxicity and scams in English, Bangla, Hindi, and their Romanized counterparts (Hinglish/Banglish).

## Core Capabilities

- **Contextual Multilingualism**: Specialized detection for English, Bangla, Hindi, Banglish, and Hinglish using Few-Shot Chain-of-Thought reasoning.
- **Secure Mod Dashboard**: A private, real-time analytics hub visible ONLY to your moderation team via server-side authorization.
- **3-Strike Policy Engine**: Automates warnings and escalation reports to handle difficult users consistently.
- **High-Visibility Highlights**: The dashboard is programmatically pinned to the subreddit highlights upon creation.
- **Automated Evidence Reports**: ModMail escalations include direct links to evidence with AI-generated confidence scores and reasoning.

## Tech Stack

- **Devvit SDK**: Native Reddit integration.
- **Google Gemini 1.5 Flash**: SOTA linguistic analysis.
- **Redis**: Fast persistence for strikes, deduplication, and analytics.
- **TypeScript**: Type-safe architectural foundation.

## Moderation Policy

1. **Auto-Removal**: Confidence >= 0.92 (Strict threshold for automated actions).
2. **Human-in-the-Loop Triage**: Confidence >= 0.70 (or 0.60 for Implicit Toxicity) results in a report to the modqueue.
3. **3-Strike Escalation**:
   - **Strikes 1-2**: Content removal + DM warning + ModNote.
   - **Strike 3**: Content removal + ModMail report to human moderators (No auto-ban).

## Setup & Deployment

1. **Install**: `npm install`
2. **Configure**: Set `gemini_api_key` in the app settings on Reddit.
3. **Deploy**: `devvit deploy`
4. **Dashboard**: Use the Subreddit Menu item "Create DesiMod Dashboard" to initialize your analytics hub.

## Security & Compliance

- **Authorization**: Dashboard access is restricted to moderators via `getCurrentUser` and `getModerators` runtime checks.
- **Feedback Loops**: The app ignores posts from moderators and its own service account.
- **Data Minimization**: Adheres to the Responsible Builder Policy by only storing necessary metadata for moderation actions.

---
*Built for the Reddit mod community.*

