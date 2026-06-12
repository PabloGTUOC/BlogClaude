# Graph Report - .  (2026-06-11)

## Corpus Check
- Corpus is ~30,792 words - fits in a single context window. You may not need a graph.

## Summary
- 259 nodes · 274 edges · 48 communities (39 shown, 9 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Feed Admin API|Feed Admin API]]
- [[_COMMUNITY_App Architecture & Zones|App Architecture & Zones]]
- [[_COMMUNITY_API Dependencies|API Dependencies]]
- [[_COMMUNITY_Digital Content API|Digital Content API]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_DB Migrations & Server|DB Migrations & Server]]
- [[_COMMUNITY_Auth & Notifications|Auth & Notifications]]
- [[_COMMUNITY_Design System & Visual Identity|Design System & Visual Identity]]
- [[_COMMUNITY_UI Component Library|UI Component Library]]
- [[_COMMUNITY_Vue Router & App Entry|Vue Router & App Entry]]
- [[_COMMUNITY_Photos API|Photos API]]
- [[_COMMUNITY_Gallery Detail Components|Gallery Detail Components]]
- [[_COMMUNITY_File Upload Middleware|File Upload Middleware]]
- [[_COMMUNITY_Firebase Client Config|Firebase Client Config]]
- [[_COMMUNITY_Deploy Script|Deploy Script]]
- [[_COMMUNITY_API Client|API Client]]
- [[_COMMUNITY_Admin Store|Admin Store]]
- [[_COMMUNITY_Analog Store|Analog Store]]
- [[_COMMUNITY_Auth Store|Auth Store]]
- [[_COMMUNITY_Digital Store|Digital Store]]
- [[_COMMUNITY_Photos Store|Photos Store]]

## God Nodes (most connected - your core abstractions)
1. `Enderthoughts Design System` - 11 edges
2. `Enderthoughts Application Spec` - 11 edges
3. `Component Library` - 7 edges
4. `verifyJWT()` - 6 edges
5. `processUpload()` - 6 edges
6. `Component Demos (Live HTML)` - 6 edges
7. `requireAdmin()` - 5 edges
8. `Docker Compose Services` - 5 edges
9. `scripts` - 4 edges
10. `Image Upload Pipeline` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Upload Drop Zone Component` --semantically_similar_to--> `Image Upload Pipeline`  [INFERRED] [semantically similar]
  DESIGN.MD → README.md
- `Frontend HTML Entry Point` --semantically_similar_to--> `CSS Custom Properties Implementation`  [INFERRED] [semantically similar]
  frontend/index.html → enderthoughts-styleguide.html
- `Component Demos (Live HTML)` --implements--> `Top Navigation Bar Component`  [INFERRED]
  enderthoughts-styleguide.html → DESIGN.MD
- `Component Demos (Live HTML)` --implements--> `Photo Card Component`  [INFERRED]
  enderthoughts-styleguide.html → DESIGN.MD
- `Component Demos (Live HTML)` --implements--> `Lightbox Photo Detail Component`  [INFERRED]
  enderthoughts-styleguide.html → DESIGN.MD

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Authentication Flow: Firebase + JWT + Role-Based Routing** — readme_md_firebase_auth, readme_md_roles_access, setup_md_firebase_setup, setup_md_first_admin [INFERRED 0.85]
- **Docker Infrastructure: DB + API + Frontend Services** — docker_compose_db_service, docker_compose_api_service, docker_compose_frontend_service, setup_md_docker_deploy [EXTRACTED 1.00]
- **Design System: Spec + Styleguide + Frontend Tokens** — design_md_enderthoughts_design_system, styleguide_html_design_reference, styleguide_html_css_tokens, index_html_frontend_entry [INFERRED 0.85]

## Communities (48 total, 9 thin omitted)

### Community 0 - "Feed Admin API"
Cohesion: 0.07
Nodes (28): db, express, fs, path, router, { verifyJWT, requireAdmin }, db, express (+20 more)

### Community 1 - "App Architecture & Zones"
Cohesion: 0.11
Nodes (24): API Backend Service, MySQL Database Service, Frontend Service, Docker Compose Services, Admin Panel Zone, Analog Zone, Database Schema, Digital Zone (+16 more)

### Community 2 - "API Dependencies"
Cohesion: 0.09
Nodes (22): dependencies, cors, dotenv, exifr, express, firebase-admin, jsonwebtoken, multer (+14 more)

### Community 3 - "Digital Content API"
Cohesion: 0.12
Nodes (18): db, express, fs, { importGooglePhoto }, path, { processUpload }, router, upload (+10 more)

### Community 4 - "Frontend Dependencies"
Cohesion: 0.10
Nodes (19): dependencies, axios, firebase, pinia, vue, vue-router, devDependencies, autoprefixer (+11 more)

### Community 5 - "DB Migrations & Server"
Cohesion: 0.11
Nodes (18): db, fs, path, runMigrations(), adminFeedRoutes, adminTagsRoutes, adminUsersRoutes, analogRoutes (+10 more)

### Community 6 - "Auth & Notifications"
Cohesion: 0.13
Nodes (13): db, express, jwt, { JWT_SECRET }, router, { sendAdminNotification }, { verifyIdToken }, admin (+5 more)

### Community 7 - "Design System & Visual Identity"
Cohesion: 0.18
Nodes (15): Color Token System, CRT Power-On Boot Animation, CSS Architecture, Enderthoughts Design System, Retro-Brutalist 80s Design Philosophy, Scanline Overlay Effect, Typography System, Design Prohibitions (+7 more)

### Community 8 - "UI Component Library"
Cohesion: 0.52
Nodes (7): Component Library, Lightbox Photo Detail Component, Top Navigation Bar Component, Photo Card Component, Status Bar Component, Upload Drop Zone Component, Component Demos (Live HTML)

### Community 9 - "Vue Router & App Entry"
Cohesion: 0.29
Nodes (4): router, routes, app, pinia

### Community 10 - "Photos API"
Cohesion: 0.29
Nodes (5): db, express, jwt, { JWT_SECRET }, router

### Community 12 - "File Upload Middleware"
Cohesion: 0.40
Nodes (3): multer, storage, upload

## Knowledge Gaps
- **127 isolated node(s):** `name`, `version`, `description`, `main`, `start` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Enderthoughts Application Spec` connect `App Architecture & Zones` to `Design System & Visual Identity`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Enderthoughts Design System` connect `Design System & Visual Identity` to `UI Component Library`, `App Architecture & Zones`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _129 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Feed Admin API` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._
- **Should `App Architecture & Zones` be split into smaller, more focused modules?**
  _Cohesion score 0.10869565217391304 - nodes in this community are weakly interconnected._
- **Should `API Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `Digital Content API` be split into smaller, more focused modules?**
  _Cohesion score 0.11688311688311688 - nodes in this community are weakly interconnected._