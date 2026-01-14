import * as vscode from "vscode";
import { ResourceType, StoredResource } from "../types";
import { Favorites } from "./favorites";
import { ViewItem } from "./view-item";
import workspace from "./workspace";

const MIME_TYPE = "application/vnd.code.tree.favorites";
const URI_LIST_MIME_TYPE = "text/uri-list";

export class FavoritesDragAndDropController implements vscode.TreeDragAndDropController<ViewItem> {
    // Accept both internal favorites reordering and external file drops from file explorer
    public dropMimeTypes: readonly string[] = [MIME_TYPE, URI_LIST_MIME_TYPE];
    public dragMimeTypes: readonly string[] = [MIME_TYPE];

    constructor(
        private favorites: Favorites,
        private onRefresh: () => void
    ) {}

    public handleDrag(
        source: readonly ViewItem[],
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): void | Thenable<void> {
        console.log('[Favorites DnD] handleDrag called with', source.length, 'items');
        console.log('[Favorites DnD] source items:', source.map(s => ({ id: s.id, label: s.label, contextValue: s.contextValue })));

        // Store the dragged items' IDs as JSON string
        const draggedIds = source
            .filter(item => item.id != null)
            .map(item => item.id);

        console.log('[Favorites DnD] draggedIds:', draggedIds);

        if (draggedIds.length > 0) {
            dataTransfer.set(MIME_TYPE, new vscode.DataTransferItem(JSON.stringify(draggedIds)));
            console.log('[Favorites DnD] set dataTransfer with MIME:', MIME_TYPE);
        }
    }

    public async handleDrop(
        target: ViewItem | undefined,
        dataTransfer: vscode.DataTransfer,
        token: vscode.CancellationToken
    ): Promise<void> {
        console.log('[Favorites DnD] handleDrop called');
        console.log('[Favorites DnD] target:', target ? { id: target.id, label: target.label, contextValue: target.contextValue } : 'undefined (root)');

        // Check for external file drops from file explorer first
        const uriListItem = dataTransfer.get(URI_LIST_MIME_TYPE);
        if (uriListItem) {
            console.log('[Favorites DnD] External file drop detected');
            await this.handleExternalDrop(target, uriListItem);
            return;
        }

        // Handle internal favorites reordering
        const transferItem = dataTransfer.get(MIME_TYPE);
        console.log('[Favorites DnD] transferItem:', transferItem ? 'found' : 'NOT FOUND');

        if (!transferItem) {
            console.log('[Favorites DnD] No transfer item, aborting');
            return;
        }

        // Parse the JSON string back to array
        let draggedIds: string[];
        try {
            const value = transferItem.value;
            console.log('[Favorites DnD] transferItem.value:', value, 'type:', typeof value);
            draggedIds = typeof value === 'string' ? JSON.parse(value) : value;
        } catch (e) {
            console.error('[Favorites DnD] Failed to parse dragged IDs:', e);
            return;
        }

        console.log('[Favorites DnD] draggedIds:', draggedIds);

        if (!draggedIds || draggedIds.length === 0) {
            console.log('[Favorites DnD] No dragged IDs, aborting');
            return;
        }

        // Get all stored resources
        const allResources = await this.favorites.get();

        // Determine target parent and position
        let targetParentId: string | null = null;
        let targetIndex = -1;

        if (target) {
            if (target.resourceType === ResourceType.Group) {
                // Dropped onto a group - move items into that group (at the end)
                targetParentId = target.id;
            } else {
                // Dropped onto an item - move to same parent, AFTER that item
                targetParentId = target.parentId || null;

                // Find the target item's position among siblings
                const siblings = allResources.filter(r =>
                    (r.parent_id || null) === targetParentId
                );
                // Sort siblings by current order to find correct position
                siblings.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
                targetIndex = siblings.findIndex(r => r.id === target.id);
                // Insert AFTER the target item
                if (targetIndex >= 0) {
                    targetIndex += 1;
                }
            }
        } else {
            // Dropped on root
            targetParentId = null;
        }

        // Process each dragged item
        for (const draggedId of draggedIds) {
            const itemIndex = allResources.findIndex(r => r.id === draggedId);
            if (itemIndex === -1) continue;

            const item = allResources[itemIndex];

            // Prevent dropping a group into itself or its descendants
            if (item.type === ResourceType.Group && targetParentId) {
                if (this.isDescendant(allResources, draggedId, targetParentId)) {
                    vscode.window.showWarningMessage("Cannot move a group into itself or its subgroups");
                    continue;
                }
            }

            // Update parent
            item.parent_id = targetParentId;
        }

        // Recalculate sort orders for the target parent's children
        console.log('[Favorites DnD] recalculating sort orders, targetParentId:', targetParentId, 'targetIndex:', targetIndex);
        await this.recalculateSortOrders(allResources, targetParentId, draggedIds, targetIndex);

        // Save and refresh
        console.log('[Favorites DnD] saving changes...');
        await this.favorites.save(allResources);
        console.log('[Favorites DnD] refreshing view...');
        this.onRefresh();
        console.log('[Favorites DnD] done!');
    }

    private isDescendant(
        allResources: StoredResource[],
        potentialAncestorId: string,
        targetId: string
    ): boolean {
        let currentId: string | null = targetId;

        while (currentId) {
            if (currentId === potentialAncestorId) {
                return true;
            }
            const current = allResources.find(r => r.id === currentId);
            currentId = current?.parent_id || null;
        }

        return false;
    }

    private async recalculateSortOrders(
        allResources: StoredResource[],
        parentId: string | null,
        movedIds: string[],
        targetIndex: number
    ): Promise<void> {
        // Get siblings (items with the same parent)
        const siblings = allResources.filter(r =>
            (r.parent_id || null) === parentId
        );

        // Separate moved items from others
        const movedItems = siblings.filter(r => movedIds.includes(r.id));
        const otherItems = siblings.filter(r => !movedIds.includes(r.id));

        // Sort other items by their current sortOrder or name
        otherItems.sort((a, b) => {
            if (a.sortOrder !== undefined && b.sortOrder !== undefined) {
                return a.sortOrder - b.sortOrder;
            }
            return (a.name || "").localeCompare(b.name || "");
        });

        // Insert moved items at the target position
        let insertIndex = targetIndex >= 0 ? targetIndex : otherItems.length;

        // Clamp to valid range
        insertIndex = Math.max(0, Math.min(insertIndex, otherItems.length));

        // Build final ordered list
        const orderedSiblings = [
            ...otherItems.slice(0, insertIndex),
            ...movedItems,
            ...otherItems.slice(insertIndex)
        ];

        // Assign sort orders
        orderedSiblings.forEach((item, index) => {
            item.sortOrder = index;
        });
    }

    /**
     * Handle dropping files/folders from VS Code's file explorer onto the favorites tree.
     * Files can be dropped onto a group (added to that group) or onto root (added to root level).
     */
    private async handleExternalDrop(
        target: ViewItem | undefined,
        uriListItem: vscode.DataTransferItem
    ): Promise<void> {
        // Determine target group ID
        let targetGroupId: string | null = null;

        if (target) {
            if (target.resourceType === ResourceType.Group) {
                // Dropped onto a group - add items to that group
                targetGroupId = target.id;
                console.log('[Favorites DnD] Dropping into group:', target.label);
            } else {
                // Dropped onto a file/folder - add to the same parent group
                targetGroupId = target.parentId || null;
                console.log('[Favorites DnD] Dropping alongside item, parent:', targetGroupId);
            }
        } else {
            // Dropped on root
            console.log('[Favorites DnD] Dropping onto root level');
        }

        // Get URIs from the data transfer
        let uris: vscode.Uri[] = [];

        try {
            // The value can be a string (URI list) or already parsed as file objects
            const value = uriListItem.value;
            console.log('[Favorites DnD] URI list value type:', typeof value);

            if (typeof value === 'string') {
                // Parse text/uri-list format (newline-separated URIs)
                const uriStrings = value.split(/\r?\n/).filter(s => s.trim() && !s.startsWith('#'));
                uris = uriStrings.map(s => vscode.Uri.parse(s));
            } else if (Array.isArray(value)) {
                // Already an array of URIs or file objects
                uris = value.map(v => {
                    if (v instanceof vscode.Uri) {
                        return v;
                    } else if (typeof v === 'object' && v.path) {
                        return vscode.Uri.file(v.path);
                    } else if (typeof v === 'string') {
                        return vscode.Uri.parse(v);
                    }
                    return null;
                }).filter(u => u !== null) as vscode.Uri[];
            } else if (value && typeof value === 'object') {
                // Try to get the asFile/asString methods if available
                const fileValue = await uriListItem.asFile?.();
                if (fileValue) {
                    uris = [vscode.Uri.file(fileValue.name)];
                } else {
                    const stringValue = await uriListItem.asString();
                    if (stringValue) {
                        const uriStrings = stringValue.split(/\r?\n/).filter(s => s.trim() && !s.startsWith('#'));
                        uris = uriStrings.map(s => vscode.Uri.parse(s));
                    }
                }
            }
        } catch (e) {
            console.error('[Favorites DnD] Error parsing URIs:', e);
            // Try asString as fallback
            try {
                const stringValue = await uriListItem.asString();
                if (stringValue) {
                    const uriStrings = stringValue.split(/\r?\n/).filter(s => s.trim() && !s.startsWith('#'));
                    uris = uriStrings.map(s => vscode.Uri.parse(s));
                }
            } catch (e2) {
                console.error('[Favorites DnD] Fallback parsing also failed:', e2);
            }
        }

        console.log('[Favorites DnD] Parsed', uris.length, 'URIs:', uris.map(u => u.fsPath));

        if (uris.length === 0) {
            console.log('[Favorites DnD] No valid URIs found');
            return;
        }

        // Add each file/folder to favorites
        let addedCount = 0;
        for (const uri of uris) {
            if (uri.scheme !== 'file') {
                console.log('[Favorites DnD] Skipping non-file URI:', uri.toString());
                continue;
            }

            const fsPath = uri.fsPath;
            console.log('[Favorites DnD] Adding path:', fsPath);

            try {
                // Check if the path is within a workspace folder
                const workspaceRoot = workspace.workspaceRoot(fsPath);

                if (workspaceRoot) {
                    // Path is within workspace - use addPathToGroup
                    await this.favorites.addPathToGroup(targetGroupId, fsPath);
                } else {
                    // External path - use addExternalPathToGroup
                    await this.favorites.addExternalPathToGroup(targetGroupId, fsPath);
                }
                addedCount++;
            } catch (e) {
                console.error('[Favorites DnD] Failed to add path:', fsPath, e);
            }
        }

        if (addedCount > 0) {
            console.log('[Favorites DnD] Added', addedCount, 'items to favorites');
            this.onRefresh();
        }
    }
}
