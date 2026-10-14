// Explainers: each module registers a step-through diagram under its data-explainer
// key (the explainer's content file name); start() mounts whatever the page holds and
// does nothing on pages without explainer markup.
import { start } from "./stepper.js"
import "./cache-single-flight.js"
import "./cache-freshness.js"
import "./shutdown-phases.js"
import "./lock-fencing.js"
import "./logger-fingers-crossed.js"
import "./sqlb-typed-columns.js"
import "./auth-pipeline.js"

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start)
else start()
