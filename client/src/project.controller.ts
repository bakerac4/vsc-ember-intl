import { Project, ProjectTranslation } from './project.model';
import { readJsonSync } from 'fs-extra';
import { workspace, Uri } from 'vscode';

export class ProjectController {

	static getProjects(uri: Uri): Project[] {
		const controller = new ProjectController();
		return controller.identifyProjects(uri);
	}

	identifyProjects(uri: Uri): Project[] {
		let projects: Project[] = [];
		try {
			projects.push({
				root: uri,
				label: 'project',
				exclude: [],
				translation: this.extractTranslationFile()
			});
		}
		catch  { }
		return projects;
	}

	private extractRootPath(ngConfig: any): string {
		return ngConfig.root || ngConfig.sourceRoot;
	}

	// private extractExcluded(configPath: string): string[] {
	// 	if (!!configPath) {
	// 		const appSettings = readJsonSync(`${workspace.rootPath}\\${configPath}`);
	// 		return appSettings.exclude || [];
	// 	}
	// 	return [];
	// }

	private extractTranslationFile(): ProjectTranslation {
		let translation: ProjectTranslation = null;
		translation = {
			i18nFile: 'en-us.json',
			i18nFormat:'json',
			i18nLocale: 'en-us'
		};
		return translation;
	}

	private extractAppConfigPath(ngConfig: any): string {
		return ngConfig.architect.build ? ngConfig.architect.build.options.tsConfig : undefined;
	}
}