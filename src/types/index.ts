import { QuickPickItem } from "vscode";
import { DataProvider } from "../class/dataProvider";
import { ViewItem } from "../class/view-item";

export enum ResourceType {
    File = "File",
    Group = "Group",
    Directory = "Directory",
    URL = "URL",
}

export interface WorkspaceQuickPickItem extends QuickPickItem {
    index: number;
}
export interface RegistryQuickPickItem extends QuickPickItem {
    index: number;
    relativePath: string;
}

export interface WorkspaceConfiguration {
    useTrash: boolean;
    useWorkspace: number;
    useFilesExclude: boolean;
    storageFilePath: string;
    storageRegistry: string[];
    groupsFirst: boolean;
    sortDirection: "ASC" | "DESC";
    includeInDocumentBodyContextMenu: boolean;
    includeInEditorTabContextMenu: boolean;
}

export interface StoredResource {
    id?: string;
    name: string;
    type: ResourceType;
    parent_id?: string;
    label?: string;
    workspaceRoot: string;
    workspacePath: string;
    fsPath?: string;
    iconColor?: string;
    // NEW fields for URL favorites
    url?: string;
    urlAlias?: string;
    // NEW fields for color highlighting
    highlightColor?: string;
    highlightBadge?: string;
}

export interface FilesystemResource {
    path: string;
    type: ResourceType;
}

export interface GroupQuickPick extends QuickPickItem {
    id: string;
}

export interface TreeProviders {
    explorer: DataProvider;
    activity: DataProvider;
    refresh: () => void;
}

export interface ClipboardBuffer {
    item: ViewItem;
    operation: "copy" | "cut";
}

export interface HtmlColor {
    [key: string]: string;
}
