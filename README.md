# Enhanced Favorites

A VS Code extension to manage workspace favorites with enhanced features including URL bookmarks, color highlighting, and improved Remote Development support.

**Forked from [vscode-favorites](https://github.com/kdcro101/vscode-favorites) by kdcro101**

## Features

### Core Features (from original)
- Add files and directories to workspace favorites
- Create groups and subgroups (unlimited nesting)
- Browse favorites using keyboard only via `Favorites: Browse` palette command
- Add external resources (files or directories outside workspace)
- Basic file system operations (copy/cut/paste, create, delete, rename, duplicate)
- Favorite items can have aliases (different labels)
- Group icons can have custom colors
- Multiple storage sets per workspace
- `files.exclude` support

### New Features in v3.0.0

#### Remote Development Fix
- **Copy Path now works correctly in Remote SSH, WSL, and Codespaces**
- Uses VS Code's native clipboard API instead of system clipboard
- Paths are copied to your local clipboard, not the remote machine's clipboard

#### URL Favorites
- Add URL bookmarks to your favorites tree
- URLs open in your default browser when clicked
- Add URLs via context menu: "Add URL to favorites"
- Add URLs directly from clipboard: "Add URL from clipboard"
- URLs display with a globe icon for easy identification

#### Color Highlighting
- Set highlight colors on any favorite item (not just groups)
- Choose from: red, orange, yellow, green, blue, purple
- Add optional 2-character badges to favorites
- Colors appear as text decoration in the tree view

## Installation

Open Visual Studio Code, press `Ctrl+P` and type:

```
ext install solario.enhanced-favorites
```

## Usage

### Adding to favorites
Right-click item in File explorer, an open file tab, or the background of an open editor and select `Add to favorites`.

### Adding to favorites group or subgroup
Right-click item and select `Add to favorites group`, then select group from list.

### Adding URL favorites
Right-click in Favorites view and select `Add URL to favorites`, or use `Add URL from clipboard` to add a URL currently in your clipboard.

### Setting highlight colors
Right-click any favorite and select `Set highlight color`, then choose a color from the list.

### Setting badges
Right-click any favorite and select `Set badge`, then enter a 2-character badge.

### Copy path (Remote-friendly)
Right-click any file/folder and select `Copy path` - this works correctly even in Remote SSH, WSL, or Codespaces.

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `favorites.useWorkspace` | Index of workspace to use as root | `0` |
| `favorites.useFilesExclude` | Use `files.exclude` setting | `true` |
| `favorites.storageFilePath` | Storage file path relative to workspace | `.favorites.json` |
| `favorites.storageRegistry` | List of alternative storage file paths | `[]` |
| `favorites.groupsFirst` | List groups before files/directories | `true` |
| `favorites.sortDirection` | Sort direction (`ASC` or `DESC`) | `ASC` |
| `favorites.useTrash` | Use system trash for deletions | `false` |
| `favorites.includeInDocumentBodyContextMenu` | Show in editor context menu | `false` |
| `favorites.includeInEditorTabContextMenu` | Show in editor tab context menu | `true` |

## Multiple Sets

You can have multiple sets of favorites per workspace. Add `favorites.storageRegistry` to your workspace settings:

```json
"favorites.storageRegistry": [
    "favorites/system.json",
    "favorites/classes.json",
    "favorites/services.json"
]
```

Switch between sets using the status bar or the `Favorites: Select alternative storage from registry` command.

## Migrating from vscode-favorites

This extension is fully compatible with existing `.favorites.json` files from the original vscode-favorites extension. Your favorites will work without any changes.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[GPL v3 License](LICENSE)
