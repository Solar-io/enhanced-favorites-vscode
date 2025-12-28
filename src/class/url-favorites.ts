import * as vscode from 'vscode';
import { StoredResource, ResourceType } from '../types';
import { Favorites } from './favorites';

export class UrlFavorites {
    constructor(private favorites: Favorites) {}

    public isValidUrl(urlString: string): boolean {
        try {
            const url = new URL(urlString);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }

    public async addUrl(
        url: string,
        alias?: string,
        parentId?: string
    ): Promise<StoredResource | null> {
        if (!this.isValidUrl(url)) {
            vscode.window.showErrorMessage('Invalid URL. Must be http:// or https://');
            return null;
        }

        const resource: StoredResource = {
            id: this.generateId(),
            name: alias || this.extractHostname(url),
            type: ResourceType.URL,
            url: url,
            urlAlias: alias,
            parent_id: parentId || undefined,
            workspaceRoot: '',
            workspacePath: ''
        };

        await this.favorites.addResource(resource);
        return resource;
    }

    public async openUrl(url: string): Promise<void> {
        try {
            const uri = vscode.Uri.parse(url);
            await vscode.env.openExternal(uri);
        } catch (e) {
            vscode.window.showErrorMessage(`Failed to open URL: ${e}`);
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 18);
    }

    private extractHostname(url: string): string {
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }
}
