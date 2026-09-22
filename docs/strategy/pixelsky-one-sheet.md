# PixelSky One-Sheet

## Pinned Product Decision

**Next product step: search correctness.**

Do not add new storage, agents, or integrations until PixelSky reliably returns the right asset for known queries such as `food`, `travel`, `hotel`, and `portrait`.

## Why PixelSky Exists When Cloudinary Already Exists

Cloudinary remains the system of record. It owns the originals, uploads, transformations, CDN delivery, folders, tags, and media operations.

PixelSky should not compete with Cloudinary as another DAM. It is the **agent-ready control layer** over a company’s existing Cloudinary library.

Cloudinary answers: “Where are the files, and how do we transform and deliver them?”

PixelSky answers: “Which asset can this person or agent use for this specific job, under this workspace’s rules, and how should it be delivered?”

That distinction matters when a team needs:

- A shared, workspace-scoped library instead of raw Cloudinary credentials in every tool.
- Natural-language retrieval with reliable business metadata: campaign, product, region, rights, photographer, status, and expiry.
- Clear explanation of why an image matched a request.
- A record of what an agent searched for, selected, delivered, or included in a pack.
- A controlled handoff: approved assets, defined variants, and delivery links rather than unrestricted library access.

For a single person who only needs to search manually, Cloudinary alone is enough. PixelSky becomes useful when images must work across people, agents, Figma, ChatGPT, campaigns, and repeatable workflows.

## Three PixelSky Versions

### 1. PixelSky Web App

**For:** marketing teams, creative teams, asset owners, and admins.

The web app is the operational home for the workspace.

- Connects the Cloudinary library.
- Lets people search, upload, inspect, and organize assets.
- Manages workspace settings, metadata, approvals, packs, delivery variants, and audit history.
- Lets an asset owner decide what is ready for agent use.

The web app is where humans establish trust and rules.

### 2. PixelSky for Figma

**For:** designers working inside a Figma file.

The Figma plugin is the fast visual retrieval surface.

- Searches the connected workspace’s Cloudinary assets.
- Shows large previews with a small number of useful tags.
- Places an asset directly into a selected Figma shape or new canvas object.
- Downloads a delivery file when needed outside Figma.

The Figma version should feel like a fast, clean asset picker, not a DAM administration product.

### 3. PixelSky for Agents: MCP / ChatGPT

**For:** ChatGPT, Claude, Codex, and workflow agents that need images as part of their work.

The MCP/API is the agent-facing interface. It provides structured results instead of exposing Cloudinary credentials or requiring an agent to understand Cloudinary’s API.

- Searches a workspace-scoped library.
- Returns structured asset references, previews, metadata, and delivery information.
- Can create curated asset-pack drafts for a campaign or task.
- Can enforce human approval before delivery where a workspace requires it.
- Records agent activity for review and audit.

In ChatGPT, PixelSky can show a visual gallery directly in the conversation. In other MCP clients, the same search remains useful as structured data.

## The Agent-Specific Opportunity

AgentMail did not replace email. Linear did not replace software work. They made their underlying systems dependable and usable by agents.

PixelSky’s equivalent is:

> Give an agent a safe, explainable, workspace-scoped way to find and use the correct brand asset without giving it unrestricted Cloudinary access.

An agent should be able to ask PixelSky:

- “Find three approved hero images for a summer campaign.”
- “Give me the square social and email-header variants of the selected image.”
- “Prepare a visual asset pack for this launch.”
- “Use only assets cleared for paid social in the US.”

The agent should receive an answer with the asset identity, preview, match reason, rights status, and safe delivery variant. It should not receive an organization’s Cloudinary API secret.

## What Makes This Worth Building

PixelSky is not valuable because it stores photos differently. It is valuable if it makes brand assets **reliable inputs to agent workflows**.

The defensible product is:

- Cloudinary-native: no forced migration or duplicate asset library.
- Human-governed: permissions and approvals remain with the team.
- Agent-readable: structured, scoped, explainable results.
- Multi-surface: one trusted asset layer for the web app, Figma, ChatGPT, and future workflow agents.

## Immediate Priority

Fix search correctness before expanding scope:

1. Exact tags and structured metadata must rank first.
2. Every result must explain why it matched.
3. AI descriptions and embeddings must be re-indexed from real image content.
4. Add a small acceptance test set for the most important queries.
