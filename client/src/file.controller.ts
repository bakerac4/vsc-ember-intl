import { workspace, Uri, RelativePattern, languages } from 'vscode';
import { ProjectController } from './project.controller';
import { Project } from './project.model';

export class FileController {

	constructor() { }

	public processAngularFile(callback: (projects: Project[]) => void): void {
		workspace.findFiles('package.json', '{node_modules,dist,tmp,app}', 1).then(res => {
			if (res.length > 0) {
				const projects = ProjectController.getProjects(res[0]);
				callback(projects);
			}
		});
	}

	public processHtmlFiles(projects: Project[], callback: (urls: Uri[]) => void): void {
		let workspaceFolder = workspace.workspaceFolders[0].uri.path;
		projects.forEach(project => {
			const url = `${workspaceFolder}/${project.root}`;
			workspace.findFiles(new RelativePattern(url, '**/*.hbs'), 'node_modules').then(res => {
				const urls = res.map(r => <any>{
					path: r.path,
					fsPath: r.fsPath
				});
				callback(urls);
			});
		});
	}

	public processTranslations(callback: () => void): void {
		workspace.findFiles('translations/*.json', '{node_modules,dist,tmp,app}')
			.then(
				files => {
					this.processTranslationFiles(files, callback);
				},
				r => console.log(`cannot find files: ${r.message}`)
		);
		workspace.findFiles('app/locales/**/translations.js', '{node_modules,dist,tmp,app/pods,app/styles,app/validations}')
			.then(
				files => {
					this.processTranslationFiles(files, callback);
				},
				r => console.log(`cannot find files: ${r.message}`)
			);
	}

	private processTranslationFiles(files: Uri[], callback: () => void): void {
		let filesLoaded = 0;
		const filesToLoad = files.length;
		files.forEach(uri => {
			workspace.openTextDocument(uri)
				.then(_ => {
					if (++filesLoaded === filesToLoad) {
						callback();
					}
				});
		});
	}
}
