import { workspace, Uri } from 'vscode';
export interface Project {
    root: Uri;
    label: string;
    exclude: string[];
    translation: ProjectTranslation;
}

export interface ProjectTranslation {
    i18nLocale: string;
    i18nFormat: string;
    i18nFile: string;
}