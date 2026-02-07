# Marktoflow Visual Workflow Designer - User Guide

A web-based visual workflow editor for creating, editing, and managing automation workflows using an intuitive drag-and-drop interface with AI-powered assistance.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Working with Workflows](#working-with-workflows)
4. [Using the Canvas](#using-the-canvas)
5. [Editing Steps](#editing-steps)
6. [AI Prompt Interface](#ai-prompt-interface)
7. [Command Palette & Search](#command-palette--search)
8. [Execution and Debugging](#execution-and-debugging)
9. [Version Control & History](#version-control--history)
10. [Collaboration](#collaboration)
11. [Template Gallery & Onboarding](#template-gallery--onboarding)
12. [Enterprise Governance](#enterprise-governance)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Themes and Customization](#themes-and-customization)
15. [Accessibility](#accessibility)
16. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Starting the GUI Server

```bash
# Start the GUI server
marktoflow gui

# With options
marktoflow gui --port 3000        # Custom port (default: 5173)
marktoflow gui --open             # Open browser automatically
marktoflow gui --workflow ./path  # Open specific workflow
```

### System Requirements

- Node.js 18 or higher
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Screen resolution: 1280x720 minimum (1920x1080 recommended)

### First Launch

1. Run `marktoflow gui` in your terminal
2. Open `http://localhost:5173` in your browser
3. The GUI will automatically discover workflows in your project directory

---

## Interface Overview

The GUI consists of five main areas, plus overlay features accessible via keyboard shortcuts:

```
+------------------+------------------------+------------------+
|                  |                        |                  |
|    Sidebar       |        Canvas          |   Properties     |
|   (Workflows     |    (Visual Editor)     |     Panel        |
|    & Tools)      |                        |                  |
|                  |                        |                  |
+------------------+------------------------+------------------+
|                     AI Prompt Input                          |
+--------------------------------------------------------------+
```

**Overlay features:** Command Palette (`Cmd/Ctrl + K`), Quick Workflow Switcher (`Cmd/Ctrl + P`), Template Gallery, and Onboarding Tour.

### 1. Left Sidebar

- **Workflows Tab**: List of all workflows in your project
- **Tools Tab**: Draggable tools palette (Slack, GitHub, Jira, etc.)
- **Search**: Filter workflows or tools by name
- **New Workflow**: Create a new workflow

### 2. Canvas (Center)

- Visual representation of your workflow as a node graph
- Pan, zoom, and navigate the workflow
- Select, move, and connect nodes
- Mini-map for navigation in large workflows

### 3. Properties Panel (Right)

- **Properties Tab**: View/edit selected step or workflow properties
- **Variables Tab**: See all variables in scope
- **History Tab**: Execution history with logs and results
- **Versions Tab**: Version snapshots, comparison, and restore

### 4. Toolbar

Located above the canvas:
- **Add Step**: Add a new step to the workflow
- **Execute**: Run the workflow
- **Save**: Save changes to disk
- **Undo/Redo**: Revert or restore changes
- **Layout**: Auto-arrange nodes

### 5. AI Prompt Input (Bottom)

- Natural language input for AI-assisted editing
- Prompt history for quick access to previous commands

---

## Working with Workflows

### Creating a New Workflow

1. Click **"New Workflow"** in the sidebar
2. Enter a name for your workflow
3. The workflow will be created and opened in the canvas

### Opening an Existing Workflow

1. Click on a workflow in the sidebar list
2. The workflow loads in the canvas
3. Sub-workflows can be accessed via breadcrumb navigation

### Saving Workflows

- **Auto-save**: Changes are saved automatically
- **Manual save**: Press `Cmd/Ctrl + S` or click the Save button
- **Status indicator**: Shows connection status (Connected/Disconnected)

### Workflow Structure

A workflow consists of:

```yaml
metadata:
  name: My Workflow
  description: What this workflow does
  version: 1.0.0

inputs:
  repo:
    type: string
    description: Repository name

tools:
  github:
    sdk: '@octokit/rest'
    auth:
      token: '${GITHUB_TOKEN}'

steps:
  - id: get-pr
    name: Get Pull Request
    action: github.pulls.get
    inputs:
      owner: "{{ inputs.repo.split('/')[0] }}"
      repo: "{{ inputs.repo.split('/')[1] }}"
    output_variable: pr_details
```

---

## Using the Canvas

### Navigation

| Action | Mouse/Trackpad | Keyboard |
|--------|---------------|----------|
| Pan | Click and drag on empty space | Arrow keys |
| Zoom | Scroll wheel / Pinch | `Cmd/Ctrl + +/-` |
| Fit to view | Double-click empty space | `Cmd/Ctrl + 0` |
| Mini-map | Click and drag on mini-map | - |

### Selecting Nodes

- **Single select**: Click on a node
- **Multi-select**: Hold `Shift` and click, or drag a selection box
- **Select all**: `Cmd/Ctrl + A`
- **Deselect**: Click on empty canvas or press `Escape`

### Moving Nodes

- Click and drag selected nodes
- Hold `Shift` for axis-locked movement
- Nodes snap to grid automatically

### Connecting Nodes

1. Hover over a node's output handle (right side)
2. Click and drag to another node's input handle (left side)
3. Release to create the connection

### Node Types

#### Standard Nodes

| Node | Icon | Description |
|------|------|-------------|
| **Step** | Service icon | A single action (API call, data transform) |
| **Sub-workflow** | Folder | Reference to another workflow |
| **Trigger** | Clock/Webhook | Workflow entry point |
| **Output** | Terminal | Workflow output |

#### Annotation & Organization Nodes

| Node | Icon | Description |
|------|------|-------------|
| **Sticky Note** | Note | Freeform annotation with 6 color options, resizable, supports markdown |
| **Group** | Box | Container node to visually group steps, collapsible with label editing and lock indicator |

#### Control Flow Nodes

| Node | Icon | Color | Description |
|------|------|-------|-------------|
| **If/Else** | GitBranch | Purple | Conditional branching with then/else paths |
| **Switch** | GitFork | Purple/Magenta | Multi-branch routing based on expression |
| **For-Each** | Repeat | Pink/Red | Iterate over array with loop metadata |
| **While** | RotateCw | Orange | Repeat steps until condition becomes false |
| **Parallel** | Layers | Blue/Cyan | Execute multiple branches concurrently |
| **Try/Catch** | Shield | Yellow/Orange | Error handling with fallback steps |
| **Transform** | ArrowRight/Filter/Minimize2 | Teal/Cyan | Map/Filter/Reduce operations |

**Control Flow Features:**
- Visual progress indicators during execution
- Active branch highlighting with ring borders
- Iteration counters and progress bars
- Error state visualization
- Nested step support

**Enhanced Visual Feedback:**
- **Skipped Branches** - Grayed-out branches with "SKIP" badges on If/Else and Switch nodes
- **Early Exit Indicators** - Warning panels when loops exit via break or error
- **Progress Bar Colors** - Orange for early exits, pink/orange for normal progress
- **Rate Limiting Warnings** - Yellow alerts when parallel execution hits max concurrent limit
- **Failed Branch Tracking** - Red highlighting for failed parallel branches
- **Max Iterations Alerts** - Warning when While loops reach iteration limit
- **Execution State Badges** - Contextual icons (LogOut, AlertTriangle) showing exit reasons

### Sticky Notes

Sticky notes let you add annotations anywhere on the canvas:

1. Right-click on empty canvas and select **Add Sticky Note**, or use the Command Palette
2. Type your note content (supports markdown formatting)
3. Choose from 6 color options (yellow, blue, green, pink, purple, orange)
4. Resize by dragging the edges

### Groups

Group nodes let you organize related steps into collapsible containers:

1. Select multiple nodes, then right-click and choose **Group Selection**
2. The group appears as a labeled container around the selected nodes
3. Click the group label to edit it
4. Click the collapse button to collapse/expand the group
5. Lock a group to prevent accidental edits (lock indicator shown when active)

### Alignment Tools

When multiple nodes are selected, alignment tools appear in the toolbar:

- **Align**: Left, Center, Right, Top, Middle, Bottom
- **Distribute**: Horizontal (equal spacing), Vertical (equal spacing)

These tools help create clean, organized layouts for complex workflows.

### Data Preview & Inline Editing

- **Data Preview Badge**: After execution, step nodes display a small badge showing a summary of the last input/output data
- **Node Tooltip**: Hover over any step node to see a Radix tooltip with status, duration, and error information
- **Inline Editor**: Click directly on editable fields (step name, expression, etc.) to edit them in-place without opening the full editor

### Context Menus

**Right-click on a node:**
- Edit Step - Open the step editor
- View YAML - See the raw YAML
- Duplicate - Create a copy
- Delete - Remove the step
- Add Step Before/After - Insert a new step

**Right-click on canvas:**
- Add Step - Create a new step
- Paste - Paste copied nodes
- Auto Layout - Reorganize the graph
- Zoom to Fit - Fit all nodes in view

---

## Editing Steps

### Step Editor Modal

Double-click a step or right-click and select "Edit Step" to open the editor.

**Tabs:**

1. **Properties**
   - Step ID (unique identifier)
   - Display name
   - Action (service.method)

2. **Inputs**
   - Dynamic form based on action
   - Template variable support: `{{ variable_name }}`
   - JSON mode for complex inputs

3. **Output**
   - Output variable name
   - Variable preview after execution

4. **Error Handling**
   - Error action: Stop / Continue / Retry
   - Max retries (for retry action)
   - Retry delay

5. **Conditions**
   - When to run this step
   - Expression builder
   - Example: `{{ previous_step.success === true }}`

6. **YAML**
   - Direct YAML editing
   - Syntax highlighting
   - Validation on save

### Template Variables

Use `{{ expression }}` syntax to reference variables:

```yaml
# Access workflow inputs
channel: "{{ inputs.slack_channel }}"

# Access previous step output
message: "PR #{{ pr_details.number }} is ready"

# JavaScript expressions
status: "{{ pr.draft ? 'Draft' : 'Ready' }}"
```

### Adding Steps via Drag and Drop

1. Open the **Tools** tab in the sidebar
2. Drag a tool (e.g., Slack) onto the canvas
3. A new step is created with default configuration
4. Edit the step to customize inputs

---

## AI Prompt Interface

The AI assistant helps you modify workflows using natural language.

### Using the Prompt

1. Click the prompt input at the bottom of the screen
2. Type your request in natural language
3. Press `Enter` or click Send
4. Review the proposed changes
5. Click **Accept** or **Reject**

### Example Prompts

**Adding steps:**
```
Add a Slack notification step after the GitHub step
```

**Modifying inputs:**
```
Change the Slack channel from #general to #engineering
```

**Error handling:**
```
Add retry logic with 3 attempts to all steps
```

**Conditions:**
```
Only run the deploy step if the environment is production
```

**Sub-workflows:**
```
Convert steps 2-4 into a sub-workflow called validation
```

### Prompt History

- Press `Up/Down` arrows to navigate history
- Click the history icon to see recent prompts
- Click a previous prompt to re-run it

### Timeline View

The Execution Overlay now includes a **Timeline** tab that displays a waterfall chart of step durations. This provides a visual breakdown of how long each step took, making it easy to identify bottlenecks in your workflow execution.

### AI Providers

The GUI supports multiple AI backends:

| Provider | Configuration |
|----------|--------------|
| **Claude** | Set `ANTHROPIC_API_KEY` environment variable |
| **GitHub Copilot** | Authenticate with `copilot auth` |
| **Ollama** | Run Ollama locally on port 11434 |
| **Demo Mode** | No configuration needed (limited functionality) |

The system auto-detects available providers on startup.

---

## Command Palette & Search

### Command Palette (Cmd/Ctrl + K)

The Command Palette provides instant access to actions, workflows, nodes, and settings through fuzzy search.

1. Press `Cmd/Ctrl + K` to open the Command Palette
2. Start typing to search across all available commands
3. Use arrow keys to navigate results, press `Enter` to execute
4. Press `Escape` to dismiss

**Search categories:**
- **Actions**: Execute workflow, save, undo/redo, toggle theme, etc.
- **Workflows**: Jump to any workflow in your project
- **Nodes**: Find and select any node on the current canvas
- **Settings**: Quick access to configuration options

The palette uses fuzzy matching (powered by fuse.js), so you can type partial or approximate terms to find what you need.

### Quick Workflow Switcher (Cmd/Ctrl + P)

Press `Cmd/Ctrl + P` to open the Quick Workflow Switcher for fast navigation between workflows:

- Shows your recently opened workflows at the top
- Type to fuzzy search across all workflows
- Press `Enter` to open the selected workflow

---

## Execution and Debugging

### Running a Workflow

1. Click the **Execute** button in the toolbar (or press `Cmd/Ctrl + Enter`)
2. The workflow starts executing
3. Watch step status update in real-time
4. View logs in the Execution panel

### Step Status Indicators

| Status | Color | Description |
|--------|-------|-------------|
| Pending | Gray | Not yet started |
| Running | Yellow (animated) | Currently executing |
| Completed | Green | Finished successfully |
| Failed | Red | Error occurred |
| Skipped | Gray (muted) | Condition not met, step skipped |

### Control Flow Execution Visualization

Control flow nodes provide rich visual feedback during execution:

**If/Else Nodes:**
- **Active branch** highlighted with colored background and ring border
- **Skipped branch** shown in gray with "SKIP" badge
- Then branch: Green highlight when active
- Else branch: Red highlight when active

**Switch Nodes:**
- **Active case** highlighted in purple with ring border
- **Skipped cases** shown with strikethrough text and "SKIPPED" badge
- Default case highlighted in gray when active
- Smart handle positioning prevents overlap with many cases

**For-Each Loops:**
- **Progress bar** shows current iteration (e.g., "5 / 10")
- **Early exit panel** appears if loop exits via break or error
- Progress bar turns **orange** when early exit occurs
- "(stopped)" indicator in progress text
- Access to `loop.index`, `loop.first`, `loop.last` variables

**While Loops:**
- **Iteration counter** with max iterations limit
- **Progress bar** showing current vs max iterations
- **Early exit warnings** for:
  - Break statement: "Loop exited early (break)"
  - Max iterations: "Max iterations reached"
  - Error: "Loop stopped on error"
- Progress bar color indicates exit type

**Parallel Execution:**
- **Branch status badges** show individual branch states:
  - Gray: Pending
  - Blue (pulsing): Running
  - Green: Completed
  - Red: Failed
- **Rate limiting warning** appears when max concurrent limit is hit
- **Failed branches** highlighted in red
- Max concurrent value highlighted in yellow when limit active

**Try/Catch Blocks:**
- **Active branch indicator** shows try/catch/finally execution
- **Error occurred panel** displays when exception is caught
- Finally block always highlighted when executing

### Execution Controls

- **Pause**: Pause execution at next step
- **Resume**: Continue paused execution
- **Stop**: Cancel the workflow

### Debug Mode

Enable step-through debugging:

1. Press `F9` to toggle debug mode
2. Click on steps to set breakpoints (red dot)
3. Execute the workflow
4. Execution pauses at breakpoints
5. Use debug controls:
   - `F10` - Step Over
   - `F11` - Step Into
   - `Shift + F11` - Step Out
   - `F5` - Continue

### Variable Inspector

While debugging:
- View current variable values
- Add watch expressions
- See the call stack for sub-workflows

### Execution History

The History tab shows:
- Past execution runs
- Duration and status
- Step-by-step breakdown
- Error messages and stack traces

---

## Version Control & History

The GUI includes built-in version control for workflows, allowing you to track changes over time without requiring Git.

### Creating Snapshots

Workflow versions are created automatically when you save, or you can create a named snapshot manually:

1. Open the **Versions** tab in the Properties Panel
2. Click **Create Snapshot** to save the current state
3. Add an optional description for the snapshot

### Comparing Versions

1. In the Versions tab, select two versions to compare
2. A side-by-side diff view shows what changed between them
3. Added, removed, and modified steps are highlighted

### Restoring a Version

1. Click **Restore** on any previous version
2. This creates a new version with the restored content (non-destructive)
3. Your current state is preserved as a version before the restore

Version data is stored in-memory by the VersionService. See the [API Reference](./GUI_API_REFERENCE.md#version-control-api) for programmatic access.

---

## Collaboration

Collaboration features enable teams to work on workflows together with awareness of each other's activity.

### Workflow Locking

When you begin editing a workflow, a lock is automatically acquired to prevent conflicts:

- Locks are displayed with the editor's name
- Locks auto-release after 5 minutes of inactivity
- You can manually release a lock when you are done editing
- If a workflow is locked by someone else, you will see a read-only indicator

### Node Comments

Add comments to individual nodes for discussion and review:

1. Right-click a node and select **Add Comment**
2. Type your comment and submit
3. Reply to existing comments to create a thread
4. Mark comments as **Resolved** when addressed
5. Resolved comments are collapsed but still visible

### Activity Feed

The activity feed shows a chronological log of who changed what:

- Step additions, modifications, and deletions
- Version snapshots
- Comment activity
- Lock acquisitions and releases

### Presence

When multiple users have the GUI open, you will see:

- Avatars of connected users in the toolbar
- Real-time cursor/selection indicators on the canvas
- Join and leave notifications via WebSocket presence events

---

## Template Gallery & Onboarding

### Template Gallery

The Template Gallery provides pre-built workflows to help you get started quickly:

1. Click **Templates** in the sidebar or use the Command Palette
2. Browse templates by category or search by keyword
3. Templates are seeded from the `examples/` directory
4. Click a template to preview it, then click **Use Template** to create a new workflow from it

### Onboarding Tour

First-time users are guided through a 6-step interactive tour (powered by react-joyride):

1. **Welcome** - Introduction to the workflow designer
2. **Sidebar** - Navigating workflows and tools
3. **Canvas** - Using the visual editor
4. **Properties Panel** - Editing step details
5. **AI Prompt** - Using AI-assisted editing
6. **Execution** - Running your workflow

You can restart the tour at any time from the Help menu or Command Palette.

---

## Enterprise Governance

Enterprise governance features provide role-based access control, environment management, and audit capabilities for team deployments.

### RBAC Roles

Four built-in roles control access to GUI features:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access, manage roles/environments/secrets, view audit trail |
| **Editor** | Create/edit/delete workflows, execute workflows |
| **Viewer** | Read-only access to workflows and execution history |
| **Operator** | Execute workflows, view logs, no editing |

### Environment Management

Manage deployment environments (dev, staging, prod) from the Admin panel:

- Configure environment-specific variables
- Promote workflows between environments
- Set execution policies per environment

### Secrets Management

Store and manage sensitive values (API keys, tokens) securely:

- Values are masked in the UI
- Secrets are referenced by name in workflows
- Admin-only access to create/update/delete secrets

### Audit Trail

The audit trail provides a searchable log of all administrative actions:

- Role changes
- Environment modifications
- Secret access and changes
- Workflow deployments

Access the audit trail from the Admin panel. See the [API Reference](./GUI_API_REFERENCE.md#admin--governance-api) for programmatic access.

---

## Keyboard Shortcuts

### General

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + S` | Save workflow |
| `Cmd/Ctrl + Z` | Undo |
| `Cmd/Ctrl + Shift + Z` | Redo |
| `Cmd/Ctrl + Enter` | Execute workflow |
| `Cmd/Ctrl + K` | Open Command Palette |
| `Cmd/Ctrl + P` | Quick Workflow Switcher |
| `Cmd/Ctrl + Shift + T` | Toggle theme |
| `?` | Show keyboard shortcuts |

### Canvas

| Shortcut | Action |
|----------|--------|
| `N` | Add new step |
| `Delete` / `Backspace` | Delete selected |
| `Cmd/Ctrl + C` | Copy selected |
| `Cmd/Ctrl + V` | Paste |
| `Cmd/Ctrl + A` | Select all |
| `Escape` | Deselect all |
| `Cmd/Ctrl + D` | Duplicate selected |

### Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + Left` | Go to parent workflow |
| `Cmd/Ctrl + Up` | Go to root workflow |

### Debug

| Shortcut | Action |
|----------|--------|
| `F9` | Toggle debug mode |
| `F10` | Step over |
| `F11` | Step into |
| `Shift + F11` | Step out |
| `F5` | Continue execution |

---

## Themes and Customization

### Theme Toggle

Click the theme button in the top-right corner to switch between:
- **Dark Mode** (default) - Easy on the eyes
- **Light Mode** - Better in bright environments

### Responsive Design

The GUI adapts to different screen sizes:

- **Desktop** (1024px+): Full layout with all panels
- **Tablet** (768-1023px): Collapsible properties panel
- **Mobile** (<768px): Overlay sidebar and panels

### Panel Management

- Click the `X` to collapse panels
- Click the expand arrow to restore
- Panels remember their state

---

## Accessibility

The GUI targets WCAG 2.1 AA compliance with the following features:

- **Skip Navigation**: A SkipNav component allows keyboard users to jump directly to the main content area, bypassing repetitive navigation
- **ARIA Live Regions**: A LiveRegion component announces dynamic changes (step status updates, execution progress, errors) to screen readers
- **Development Auditing**: In development mode, `@axe-core/react` runs automated accessibility checks and reports violations in the browser console
- **Keyboard Navigation**: All interactive elements are reachable and operable via keyboard (see [Keyboard Shortcuts](#keyboard-shortcuts))
- **Focus Management**: Focus is managed correctly when modals, dialogs, and the Command Palette open and close

---

## Troubleshooting

### Connection Issues

**"Disconnected" status:**
1. Check if the server is running
2. Refresh the page
3. Check for firewall issues

**WebSocket errors:**
- Ensure port 5173 is not blocked
- Try a different browser

### AI Not Working

**No AI response:**
1. Check your API key is set correctly
2. Verify internet connection
3. Check the provider status in the console

**Switch providers:**
- Use the `/api/ai/providers` endpoint to check available providers
- Set a different provider via the API

### Workflow Not Saving

1. Check file permissions
2. Ensure the workflow directory exists
3. Look for validation errors in the console

### Canvas Performance

For large workflows (50+ nodes):
1. Close the mini-map
2. Disable animations in settings
3. Use the auto-layout to organize nodes

### Getting Help

- Check the [GitHub Issues](https://github.com/marktoflow/marktoflow/issues)
- Join the community Discord
- Read the [API Documentation](./GUI_API_REFERENCE.md)

---

## Next Steps

- [API Reference](./GUI_API_REFERENCE.md) - REST API documentation
- [Developer Guide](./GUI_DEVELOPER_GUIDE.md) - Extending the GUI
- [Examples](../examples/) - Sample workflows to learn from
