# Project description: what I built, why, my role, and what happened

Use the **full version** for resumes, portfolios, or internal use. Use the **IP-safe version** for public sites, Substack, or before patent filing.

---

## Full version (resume / portfolio / internal)

**What I built**  
I designed and built PinHigh, a golf technology product that simulates how different skill levels (from scratch to high handicaps and pro-level profiles) play a real course shot-by-shot. The system uses detailed course data (tees, fairways, greens, hazards, trees) and produces round-level stats—fairways hit, GIR, putts, up-and-downs—plus shot routes per hole. I added a weekly report pipeline that runs many simulations per profile, aggregates those stats and shot patterns, and generates PDF reports with map imagery showing average, best, and worst shot paths per hole. The product includes a course editor, calibration for the simulation engine, daily and weekly summary/email scripts, and a mobile-ready app (React, Capacitor) with map-based course visualization.

**Why I built it**  
I wanted to close the gap between the data that *could* exist about how different players actually play a course and what golfers and course operators get today. The goal was to turn that into something usable: see how a hole plays for different skill levels, compare scenarios, and support better decisions for players and facilities—without requiring users to be data experts.

**My specific role**  
Solo founder and builder. I was responsible for product direction, system design, and implementation end-to-end: course data model and editor, simulation logic and calibration, reporting and PDF generation with map integration, automation scripts, and the app front-end and tooling.

**What happened as a result**  
The system runs weekly reports on schedule, producing per-profile PDFs with stats and hole maps. I use the outputs to track simulation behavior and product progress. I’m preparing for a patent discussion and starting to write in public (e.g. Substack) about the build.

---

## IP-safe version (public / pre-patent)

**What I built**  
I built a product at the intersection of golf and data: tools that help people see how play unfolds across different skill levels and courses, and that turn that information into reports and visuals they can use. The system produces regular summaries and reports that support decision-making for players and for people who run or operate courses.

**Why I built it**  
I saw a gap between the kind of information that could exist about how golfers of different levels actually play and what players and operators have access to. I built toward closing that gap—so people can see patterns, compare scenarios, and make better choices without needing to be analysts or pros.

**My specific role**  
Solo founder and builder. I led product direction, design, and implementation: from the data and logic that power the product to the reports, automation, and the experience users see.

**What happened as a result**  
The product now runs on a schedule and delivers the reports and outputs I designed it for. I use those to iterate and to communicate progress. I’m taking next steps on IP protection and on sharing the journey in public (e.g. Substack).

---

## AI/ML example (for APM program applications)

**Prompt:** *Please give an example of how you've utilized artificial intelligence or machine learning in any project, academic work, or job.*

**Example response:**

In my current product, I use AI to power a simulated golfer that plays a full round shot-by-shot. The system models players at different skill levels—from high handicaps to tour-level—and makes decisions on each shot: club selection, target choice, and shot outcome. Shot outcomes are probabilistic (dispersion and direction error vary by skill), and the model is calibrated against real-world performance benchmarks—fairways hit, greens in regulation, putts per round—so that simulated rounds match expected stats for each handicap tier.

My role was end-to-end: I defined what “realistic” meant for the product (which stats to align to, which skill tiers to support), designed the calibration process so the simulation could be tuned without code changes, and built the pipeline that runs hundreds of simulated rounds and turns the results into reports and visuals. The AI doesn’t just run in the background—it’s the core of the product. Users see its output in the form of shot patterns on course maps and aggregate stats by profile, which helps them compare how a hole or course plays for different types of players.

The main lesson was balancing fidelity with usability: the model had to be good enough to be credible (hence calibration to benchmarks) but also interpretable and fast enough to support weekly batch runs and clear reporting. I treated the calibration step as a product decision—what we optimize for and how we validate it—not just an engineering task.

---

## Why you should hire me as an APM

You should hire me as an APM because I’ve already been operating at the intersection of product, data, and cross-functional execution—and I’ve proven I can own a product end-to-end from zero to something users can use.

**I ship product-like outcomes at scale.** At Expedia as a Technical Program Manager, I don’t just run programs; I define and deliver product-shaped work. I designed and implemented an internal AI “headcount analyst” agent in Glean with multi-branch reasoning so Product & Tech leaders get accurate, self-serve answers to position and headcount questions—reducing manual processing from a week to about an hour. I drove cross-functional data governance with Finance, HR, Engineering, and Product, and built executive-ready reporting and role-based dashboards that gave VPs and the C-suite consistent, trusted metrics. The result wasn’t just efficiency; it was better decisions—resource allocation accuracy improved by 10%, and stakeholders were aligned on priorities and trade-offs. That’s product thinking: understanding what leaders need, designing the solution, and measuring impact.

**I’ve built and shipped a full product on my own.** Outside of my day job, I conceived, designed, and built PinHigh—a golf product that simulates how different skill levels play a real course shot-by-shot. I own the entire stack: product direction, course data and editor, an AI-driven simulation engine calibrated to real-world performance benchmarks, and a reporting pipeline that produces PDFs with map-based shot patterns. I didn’t just spec it; I implemented it and got it running on a schedule. That experience taught me how to define “good enough” for users (e.g. what “realistic” means for a simulated golfer), how to treat calibration and validation as product decisions, and how to turn technical output into something people can actually use—reports and visuals, not raw data. An APM role is about owning the *what* and *why* while working with engineering on the *how*. I’ve already done both; I’m ready to focus on the former in a formal product role.

**I combine rigor with empathy.** My background spans technical execution (SQL, Python, dashboards, data quality, AI agents) and stakeholder alignment (C-suite readouts, UAT cadences, training and onboarding that cut onboarding time by 40% at LiveRamp). I’ve worked with Data Science and Engineering to reduce downtime and improve reporting accuracy, and with customers and internal teams to resolve discrepancies and improve platform stability. I’m comfortable in the details—I’ve done QA, ETL design, and schema governance—but I’m oriented toward outcomes: what problem we’re solving, for whom, and how we know we’re succeeding.

**I’m ready to step into the APM seat.** I’ve been close to product as a TPM and in product operations; I’ve built a product from scratch on the side; and I’ve used AI and data to drive decisions both internally (Expedia) and in my own build (PinHigh). I’m looking for a role where I can own the product roadmap, prioritize with data and user insight, and work alongside engineering and design to ship things that matter. I’d bring that mix of execution, product instinct, and cross-functional experience to your APM program from day one.
