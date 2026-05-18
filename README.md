# DesiMod AI

**Advanced AI Moderation System for Reddit Communities**

DesiMod AI is a production-grade Reddit moderation tool built for South Asian communities. It is designed to detect toxicity, scams, and spam in multilingual and mixed-language content including English, Bangla, Hindi, and Romanized variations (Hinglish/Banglish).

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
* **Strike 3**

  * Post/comment removal
  * ModMail escalation sent to moderators for manual review
  * No auto-ban (fully Reddit policy compliant)

### 📊 Moderator Dashboard

* Accessible directly from the subreddit interface
* Located under the **“…” menu next to Mod Tools**
* Mods can click:

  * **Open DesiMod Dashboard**
* Opens a real-time moderation analytics dashboard

Dashboard includes:

* Recent AI moderation actions
* Scam/toxicity detection logs
* User strike tracking
* Escalation cases
* System performance stats

### 🔐 Moderator-Only Access

* Dashboard is visible only to subreddit moderators
* Uses server-side permission checks (`getModerators`, `getCurrentUser`)
* Prevents unauthorized access to moderation data

### 📩 Automated Escalation System

* Generates structured ModMail reports at Strike 3
* Includes:

  * Violation type
  * AI reasoning
  * Confidence score
  * Direct content permalink

---

## Tech Stack

* **Devvit SDK** – Native Reddit app integration
* **Google Gemini 3.1 Flash Lite** – AI moderation engine
* **Redis** – Strike tracking, caching, and analytics storage
* **TypeScript** – Type-safe backend architecture

---

## Moderation Philosophy

DesiMod AI follows a balanced moderation approach:

* ⚖️ Reduce moderator workload through automation
* 🧑‍⚖️ Keep humans in control for final escalation
* 🌍 Support multilingual and regional content patterns
* 🚫 Prevent scams and abuse without over-censorship

---

## Security & Compliance

* Moderator-only dashboard access enforcement
* No auto-bans — only escalation-based moderation
* Minimal data storage (only moderation metadata)
* Designed to comply with Reddit Devvit safety guidelines

---

## Project Goal

To provide a **smart, multilingual AI moderation system** that helps Reddit communities in India, Bangladesh, and other multilingual regions manage spam, scams, and toxic behavior efficiently.

---

*Built for Reddit moderators, by focusing on real community challenges.*
