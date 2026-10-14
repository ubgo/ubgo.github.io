// Entry point bundled by Hugo's js.Build. Each module checks for its own markup and
// does nothing on pages that don't have it, so one small bundle serves every page.
import "./base.js" // theme toggle, copy buttons, library index filter
import "./hero.js" // home: live core + adapters diagram
import "./map.js" // /map/: interactive library graph
import "./explainers/index.js" // /explainers/*: step-through diagrams
import "./codetabs.js" // library pages: code example tabs
import "./picker.js" // /picker/: which package do I need
import "./palette.js" // Ctrl/Cmd+K command palette (every page)
import "./brand.js" // /brand/: click-to-copy swatches
import "./volt.js" // /volt/: release terminal replay
import "./stackbuilder.js" // home: build almost any app
