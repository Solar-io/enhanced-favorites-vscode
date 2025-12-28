import * as vscode from "vscode";
import { ResourceType, StoredResource } from "../types";
import { Favorites } from "./favorites";
import { ViewItem } from "./view-item";

const MIME_TYPE = "application/vnd.code.tree.favorites";

export class FavoritesDragAndDropController implements vscode.TreeDragAndDropController<ViewItem> {
    public dropMimeTypes: readonly string[] = [MIME_TYPE];
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
}
