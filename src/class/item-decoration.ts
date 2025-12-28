import * as vscode from 'vscode';
import { Favorites } from './favorites';
import { StoredResource } from '../types';

export const FAVORITES_SCHEME = 'favorites';

export class FavoritesDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    private decorations: Map<string, { color?: string; badge?: string }> = new Map();

    constructor(private favorites: Favorites) {
        this.favorites.stateList.subscribe(resources => {
            this.updateDecorations(resources);
        });
    }

    private updateDecorations(resources: StoredResource[]): void {
        this.decorations.clear();

        for (const resource of resources) {
            if (resource.id && (resource.highlightColor || resource.highlightBadge)) {
                this.decorations.set(resource.id, {
                    color: resource.highlightColor,
                    badge: resource.highlightBadge
                });
            }
        }

        this._onDidChangeFileDecorations.fire(undefined);
    }

    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (uri.scheme !== FAVORITES_SCHEME) {
            return undefined;
        }

        const resourceId = uri.path.substring(1);
        const decoration = this.decorations.get(resourceId);

        if (!decoration) {
            return undefined;
        }

        const result: vscode.FileDecoration = {};

        if (decoration.color) {
            result.color = this.getThemeColor(decoration.color);
        }

        if (decoration.badge) {
            result.badge = decoration.badge.substring(0, 2);
        }

        return result;
    }

    private getThemeColor(color: string): vscode.ThemeColor {
        const themeColorMap: Record<string, string> = {
            'red': 'charts.red',
            'orange': 'charts.orange',
            'yellow': 'charts.yellow',
            'green': 'charts.green',
            'blue': 'charts.blue',
            'purple': 'charts.purple',
            'modified': 'gitDecoration.modifiedResourceForeground',
            'added': 'gitDecoration.addedResourceForeground',
            'deleted': 'gitDecoration.deletedResourceForeground',
        };

        const themeColorId = themeColorMap[color.toLowerCase()] || color;
        return new vscode.ThemeColor(themeColorId);
    }

    public static createUri(resourceId: string): vscode.Uri {
        return vscode.Uri.parse(`${FAVORITES_SCHEME}:///${resourceId}`);
    }

    public refresh(): void {
        this._onDidChangeFileDecorations.fire(undefined);
    }
}
