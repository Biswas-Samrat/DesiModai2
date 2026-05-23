# DesiMode AI

**Advanced AI Moderation System for Reddit Communities**

DesiMode AI is a production-grade Reddit moderation tool built for South Asian communities. It is designed to detect toxicity, scams, and spam in multilingual and mixed-language content including English, Bangla, Hindi, and Romanized variations (Hinglish/Banglish).

It helps moderators automatically handle harmful content while maintaining transparency, control, and escalation workflows.

---

## Core Features

### 🧠 AI-Powered Moderation

* Detects **toxicity, harassment, spam, and scam content**
* Supports **English, Bangla, Hindi, Hinglish, and Banglish**
* Uses contextual understanding for slang, leetspeak, and transliteration

### 🤖 Gemini AI Engine

* Powered by **Gemini 3.1 Flash Lite**
* Provides reasoning-based classification (safe / toxic / scam)
* Generates confidence scores and human-readable explanations

### ⚡ Automated 3-Strike System

* **Strike 1–2**
  * Post/comment removal
  * Warning DM sent to user
  * ModNote logged
  * Violation recorded in Redis history (type, reason, link, timestamp)
* **Strike 3**
  * Post/comment removal
  * **Detailed ModMail** sent to moderators for manual review
  * No auto-ban (fully Reddit policy compliant)

### 📊 Moderator Dashboard

* Accessible from the subreddit **mod menu** → **Open DesiMod Dashboard**
* Built with **Devvit Web** (webview custom post — not deprecated Blocks)
* **Near real-time updates** via Devvit Realtime + lightweight polling (no socket.io)
* Stats: toxic removals, scam flags, warnings, modmail escalations, estimated time saved

### 🔐 Moderator-Only Access

* Dashboard visible only to subreddit moderators
* Server-side checks (`getModerators`, `getCurrentUser`)
* Dashboard post is mod-removed from the public feed when possible

### 📩 Automated Escalation System (Strike 3 ModMail)

When a user reaches **3 strikes**, moderators receive a structured ModMail that includes:

| Section | What mods see |
| --- | --- |
| **User summary** | Username, subreddit, total strike count |
| **Current violation** | Type (toxicity vs scam), post/comment, AI reason, confidence %, permalink |
| **Violation history** | Table of **all recorded strikes** with type, content kind, confidence, UTC time, and links |
| **Summary counts** | How many toxicity vs scam events appear in history |

Example subject line:

`3-Strike: u/username — Scam / spam (3 strikes)`

> **Note:** Violation history is stored from the time this feature is deployed. Earlier strikes before an upgrade may not appear in the history table until new violations are logged.

---

## Tech Stack

* **Devvit Web** – Custom post webview + server triggers (Reddit-approved path; not Blocks)
* **Google Gemini 3.1 Flash Lite** – AI moderation engine
* **Redis** – Strikes, violation history, analytics, dedupe locks
* **Devvit Realtime** – Push dashboard refresh when stats change
* **TypeScript** – Type-safe backend architecture

---

## Moderation Philosophy

DesiMode AI follows a balanced moderation approach:

* ⚖️ Reduce moderator workload through automation
* 🧑‍⚖️ Keep humans in control for final escalation
* 🌍 Support multilingual and regional content patterns
* 🚫 Prevent scams and abuse without over-censorship

---

## Security & Compliance

* Moderator-only dashboard access enforcement
* No auto-bans — only escalation-based moderation
* Minimal data storage (moderation metadata only: violation type, reason, links, timestamps — no full post bodies in history)
* **Devvit Web** architecture (compatible with Reddit app review after Blocks deprecation)
* Designed to comply with Reddit Devvit safety guidelines

---



## Project Goal

To provide a **smart, multilingual AI moderation system** that helps Reddit communities in India, Bangladesh, and other multilingual regions manage spam, scams, and toxic behavior efficiently — with **clear context for moderators** when escalation is required.

---

*Built for Reddit moderators, by focusing on real community challenges.*
