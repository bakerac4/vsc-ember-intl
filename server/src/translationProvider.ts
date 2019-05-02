import { Position, TextDocument, DiagnosticSeverity, Diagnostic, Connection, TextDocuments, Range, WorkspaceEdit, RegistrationRequest, TextEdit, TextDocumentEdit, TextDocumentIdentifier, VersionedTextDocumentIdentifier, DocumentColorRequest } from 'vscode-languageserver';
import { Project } from './project.model';

import matcher = require('matcher');
import normalize = require('normalize-path');
import { TranslationParser } from './translationParser';
import { IdRange, GenerateTranslation, GenerateTranslationCommand, RemoveTranslation } from './models/IdRange';
import { Translation } from './models/Translation';
import { HoverBuilder } from './hoverBuilder';
import { HoverInfo } from './models/HoverInfo';
import { readFileSync } from 'fs';
import { uriToFilePath, FileSystem } from 'vscode-languageserver/lib/files';
import { TransUnitBuilder } from './TransUnitBuilder';
import * as JsonLanguageService from 'vscode-json-languageservice';
import { relative } from 'path';

export class TranslationProvider {
	private projects: Project[] = [];
	private translations: Translation[] = [];
	private words = {};

	constructor(private connection: Connection, private documents: TextDocuments) { }

	public assignProjects(projects: Project[]): any {
		this.projects = projects;
		this.assignProjectToTranslation();
	}

	public onTranslationLoaded(): void {
		this.assignProjectToTranslation();
		this.validateHtmlDocuments();
	}

	public onHtmlFilesFound(urls: { fsPath: string, path: string }[]): void {
		urls.forEach(url => {
			const buffer = readFileSync(url.fsPath);
			const content = buffer.toString();
			const doc = TextDocument.create(url.path, 'hbs', 1, content);
			const wrap = this.getDocument(doc);
			this.doValidate(wrap, false);
		});
	}

	public onRemoveTranslations(translationToRemove: string): void {
		let documentEdits = this.translations.map(t => {
			const units = t.units.filter(u => u.id === translationToRemove);
			if (units.length === 0) { return; }
			const jsonDoc = t.document;
			const tDoc = this.getDocument(t.documentUri);
			const edits = units.map(u => {
				const node = this.findValForHover(jsonDoc.root.properties, u.id.split('.'));
				const start = tDoc.document.positionAt(node.parent.offset + t.characterOffset);
				//+ 1 to account for comma at end
				const end = tDoc.document.positionAt(node.parent.offset + node.parent.length + t.characterOffset + 1);
				return TextEdit.replace({
					start,
					end 
				}, '');
			});
			return TextDocumentEdit.create(VersionedTextDocumentIdentifier.create(t.documentUri, null), edits);
		}).filter(value => !!value);

		documentEdits = documentEdits.concat(Object.keys(this.words).map(url => {
			const idRanges: IdRange[] = this.words[url];
			const units = idRanges.filter(r => r.id === translationToRemove);
			if (units.length === 0) { return; }

			const fileUrl = this.getDocumentUrl(url) || url;
			const edits = units.map(u => TextEdit.replace(u.range, ''));
			return TextDocumentEdit.create(VersionedTextDocumentIdentifier.create(fileUrl, null), edits);
		}).filter(value => !!value));

		if (documentEdits.length === 0) { return; }

		const workspaceEdit = <WorkspaceEdit>{
			documentChanges: documentEdits
		};
		this.connection.workspace.applyEdit(workspaceEdit);
	}

	findKeyInJsonDoc(key, properties) {
		return properties.find(item => {
			return item.value === key;
		});
	}

	findValForGenerate(properties, path) {
		const key = path.shift();
		const node = properties.find(item => item.keyNode.value === key);

		if (node && node.valueNode && node.valueNode.properties && node.valueNode.properties.length) {
			let value = this.findValForGenerate(node.valueNode.properties, path);
			if (value) {
				return value;
			} else {
				return node;
			}
		} else {
			return;
		}
	}

	findValForHover(properties, path) {
		const key = path.shift();
		const node = properties.find(item => item.keyNode.value === key);

		if (node && node.valueNode && node.valueNode.properties && node.valueNode.properties.length) {
			let value = this.findValForHover(node.valueNode.properties, path);
			if (value) {
				return value;
			} else {
				return node;
			}
		} else if (node && node.valueNode) {
			return node.valueNode;
		} else {
			return;
		}
	}

	async generateTranslation(command) {
		const trans = this.translations.find(t => t.uri === command.uri);
		if (trans) {
			const documentUri = trans.documentUri;
			const tDoc = this.getDocument(trans.documentUri);
			const jsonDoc: any = trans.document;
			
						
			// let ls = JsonLanguageService.getLanguageService({ clientCapabilities: JsonLanguageService.ClientCapabilities.LATEST });
			// const doc = this.getDocument(documentUri);
			// const jsonDoc: any = ls.parseJSONDocument(doc.document);
			const keyArray = command.word.split('.');
			const value = command.source;
			const key = keyArray[keyArray.length - 1];
			
			const node = this.findValForGenerate(jsonDoc.root.properties, keyArray);
			const start = tDoc.document.positionAt(node.valueNode.children[0].offset + trans.characterOffset);
			const end = tDoc.document.positionAt(node.valueNode.children[0].offset + trans.characterOffset);
			// let position = Position.create(0, 0);
			// const list = await ls.doComplete(doc.document, position, jsonDoc);
			// const object = JSON.parse(doc.document.getText());
			

			let workspaceEdit = {
				documentChanges:
					[{
						uri: documentUri,
						textDocument: {
							version: null,
							uri: documentUri
						},
						edits: [
							{
								newText: TransUnitBuilder.createTransUnit(key, value || ""),
								range: {
									start,
									end
								}
							}
						]
					}]
			};
			this.connection.workspace.applyEdit(workspaceEdit);
		}
	}

	public onGenerateTranslations(args: GenerateTranslationCommand[]): void {
		args.forEach(command => {
			this.generateTranslation(command);
		});
	}

	public processFile(textDocument: TextDocument): void {
		if (this.isTranslationFile(textDocument)) {
			this.processTranslationFile(this.getDocument(textDocument));
		} else if (this.isHtmlFile(textDocument)) {
			this.processHtmlFile(textDocument);
		}
	}

	public calculateHover(url: string, position: number): any {
		const doc = this.getDocument(url);
		console.log(`Doc: ${doc}`);
		if (doc) {
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.start
						&& position <= w.end;
				});
				if (expectedWord) {
					const trans = this.getSupportedTranslations(doc.url);
					if (trans.length > 0) {
						const values = trans.map(t => {
							const tDoc = this.getDocument(t.documentUri);
							const jsonDoc: any = t.document;
							const findTrans = t.units.find(u => u.id === expectedWord.id);
							const node = this.findValForHover(jsonDoc.root.properties, expectedWord.id.split('.'));
							const start = tDoc.document.positionAt(node.offset + 1 + t.characterOffset);
							const end = tDoc.document.positionAt(node.offset + t.characterOffset + node.length - 1);
							return <HoverInfo>{
								label: t.name,
								translation: (findTrans && findTrans.value) || '`no translation`',
								goToCommandArgs: {
									uri: t.uri,
									range: {
										start,
										end 
									}
								}
							};
						});
						return HoverBuilder.createPopup(
							expectedWord.range,
							expectedWord.id,
							values);
					}
				}
			}
		}
		return null;
	}

	public calculateLocations(url: string, position: number): any {
		const doc = this.getDocument(url);
		if (doc) {
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.start
						&& position <= w.end;
				});
				if (expectedWord) {
					const trans = this.getSupportedTranslations(doc.url);
					if (trans.length > 0) {
						const locations = trans.map(t => {
							const findTrans = t.units.find(u => u.id === expectedWord.id);
							if (findTrans) {
								return {
									uri: t.uri,
									range: findTrans.targetRange
								};
							}
						});
						return locations;
					}
				}
			}
		}
		return null;
	}

	public calculateReferences(url: string, position: number): any {
		const doc = this.getDocument(url);
		if (doc) {
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.idStart
						&& position <= w.end;
				});
				if (expectedWord) {
					let refs = <any>[];
					Object.keys(this.words).forEach(key => {
						const fileWords = this.words[key];
						refs = refs.concat(fileWords.filter(word => {
							if (word.id == expectedWord.id) {
								word.url = key;
								return true;
							}
							return false;
						}));
					});

					if (refs.length > 0) {
						return refs.map(ref => <any>{
							url: ref.url,
							range: ref.idRange
						});
					}
				}
			}
		}
		return null;
	}

	public calculateCodeActions(url: string, position: number): any {
		const doc = this.getDocument(url);
		if (doc) {
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.start
						&& position <= w.end;
				});
				if (expectedWord) {
					const trans = this.getSupportedTranslations(doc.url);
					if (trans.length > 0) {
						let source: string = '';
						let values = trans.map(t => {
							const findTrans = t.units.find(u => u.id === expectedWord.id);
							if (findTrans && findTrans.value) {
								source = findTrans.value;
							}
							if (!findTrans) {
								return <GenerateTranslation>{
									title: `Generate translation unit for ${t.name}`,
									name: 'rettoua.generate_translation',
									commandArgs: [<GenerateTranslationCommand>{
										word: expectedWord.id,
										uri: t.uri
									}]
								};
							}
						});
						values = values.filter(v => !!v).map(value => {
							value.commandArgs[0].source = source;
							return value;
						});
						let commands = [];
						if (values.length > 1) {
							const generateAllCommand = <GenerateTranslation>{
								title: 'Generate translations for all...',
								name: 'rettoua.generate_translation',
								commandArgs: [...values.map(v => v.commandArgs[0])]
							};
							commands.push(generateAllCommand);
						}
						commands = commands.concat(...values);
						{
							const removeCommand = <RemoveTranslation>{
								title: `Remove translations and references for '${expectedWord.id}'`,
								name: 'rettoua.remove_translations',
								commandArgs: expectedWord.id
							};
							commands.push(removeCommand);
						}
						return commands;
					}
				}
			}
		}
		return null;
	}

	public isRenameAllowed(url: string, position: number): boolean {
		const doc = this.getDocument(url);
		if (doc) {
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.idStart
						&& position <= w.end;
				});
				return !!expectedWord;
			}
		}
		return false;
	}

	public calculateRenaming(url: string, position: number, newName: string): any[] | string {
		const doc = this.getDocument(url);
		if (doc) {
			const name = newName.toLocaleLowerCase();
			const translations = this.getSupportedTranslations(doc.url);
			const isNewNameExist = !!translations.find(trans =>
				!!trans.units.find(unit => unit.id.toLocaleLowerCase() === name)
			);
			if (isNewNameExist) {
				return `Rename cannot be applied. Name ${newName} already defined in translation file.`;
			}
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.idStart
						&& position <= w.end;
				});
				if (expectedWord) {
					let toRename = [];
					Object.keys(this.words).forEach(url => {
						const words: any[] = this.words[url].filter(w => {
							return w.id === expectedWord.id;
						}).map((w: IdRange) => <any>{
							url: url,
							range: w.idRange
						});
						if (words.length > 0) {
							toRename = toRename.concat(words);
						}
					});
					this.translations.forEach(trans => {
						trans.units.forEach(unit => {
							if (unit.id === expectedWord.id) {
								toRename.push({
									url: trans.uri,
									range: unit.idRange
								});
							}
						});
					});
					return toRename;
				}
			}
		}
		return null;
	}

	public getCompletionItems(url: string, position: number): any[] {
		const doc = this. getDocument(url);
		if (doc) {
			const activeWords = <IdRange[]>this.words[doc.url];
			if (activeWords && activeWords.length > 0) {
				const expectedWord = activeWords.find(w => {
					return position >= w.idStart
						&& position <= w.end;
				});
				if (expectedWord) {
					const translations = this.getSupportedTranslations(doc.url);
					if (translations.length === 0) {
						return [];
					}
					let completionItems: string[] = [];
					translations.forEach(trans => {
						const words: string[] = trans.units
							.filter(unit => unit.id.toLocaleLowerCase().indexOf(expectedWord.id.toLocaleLowerCase()) >= 0)
							.map(unit => unit.id);
						completionItems = completionItems.concat(words);
					});
					const alphabeticalSort = (a: string, b: string): number => {
						if (a > b) { return 1; }
						if (a < b) { return -1; }
						return 0;
					};
					const uniqueness = (value, index, self): boolean => {
						return self.indexOf(value) === index;
					};
					completionItems = completionItems
						.filter(uniqueness)
						.sort(alphabeticalSort);
					return completionItems;
				}
			}
		}
		return null;
	}

	private processHtmlFile(textDocument: TextDocument): void {
		if (!this.projects || Object.keys(this.translations).length === 0) {
			return;
		}
		const wrap = this.getDocument(textDocument);
		this.doValidate(wrap);
	}

	private validateHtmlDocuments(): void {
		this.documents.all().forEach(textDocument => {
			if (this.isHtmlFile(textDocument)) {
				this.processHtmlFile(textDocument);
			}
		});
	}

	private isTranslationFile(textDocument: TextDocument): boolean {
		return (textDocument.languageId === 'json' &&
			textDocument.uri.endsWith('.json')) || (textDocument.languageId === 'javascript' &&
			textDocument.uri.endsWith('.js'));
	}

	private isHtmlFile(textDocument: TextDocument): boolean {
		return textDocument.languageId === 'handlebars';
	}

	private doValidate(wrap: DocumentWrapper, withDiagnistics: boolean = true): void {

		let text = wrap.document.getText();
		let pattern = /[{{|(]t ["|'](.+?)["|'][)|}}]/g;
		let m: RegExpExecArray | null;

		const trans = this.getSupportedTranslations(wrap.url);
		if (trans.length === 0) { return; }

		this.words[wrap.url] = [];

		let diagnostics: Diagnostic[] = [];
		while (m = pattern.exec(text)) {
			const group = m[1];
			const value = <IdRange>{
				start: m.index,
				end: m.index + m[0].length,
				id: group,
				idStart: m.index + m[0].indexOf(group),
				range: {
					start: wrap.document.positionAt(m.index),
					end: wrap.document.positionAt(m.index + m[0].length)
				},
				idRange: {
					start: wrap.document.positionAt(m.index + m[0].indexOf(group)),
					end: wrap.document.positionAt(m.index + m[0].length - 1)
				}
			};
			this.words[wrap.url].push(value);

			if (!withDiagnistics) { continue; }

			const missingTranslations = trans.filter(t => {
				const unit = t.units.find(u => u.id === group);
				return !unit;
			});

			if (missingTranslations.length === 0) {
				continue;
			}

			let diagnostic: Diagnostic = {
				severity: DiagnosticSeverity.Warning,
				range: {
					start: wrap.document.positionAt(m.index),
					end: wrap.document.positionAt(m.index + m[0].length)
				},
				message: `Missed translation in project`
			};

			diagnostics.push(diagnostic);
		}

		if (withDiagnistics) {
			this.connection.sendDiagnostics({ uri: wrap.document.uri, diagnostics });
		}
	}

	private processTranslationFile(wrap: DocumentWrapper): void {
		const existTrans = this.translations.find(t => t.uri === wrap.url);
		const parser = new TranslationParser();
		const { units, jsonDoc, lineOffset, characterOffset } = parser.getTransUnits(wrap);
		const indexOfClosingBodyTags = wrap.document.getText().indexOf('</body>');
		const insertPosition = wrap.document.positionAt(indexOfClosingBodyTags);
		if (!existTrans) {
			const proj = this.getProjectForTranslation(wrap.url);
			const uri = wrap.url.split('/');
			let name = uri[uri.length - 1].split('.')[0];
			if (wrap.document.languageId === 'javascript') {
				name = uri[uri.length - 2];
			}
			
			const trans = <Translation>{
				uri: wrap.url,
				documentUri: wrap.document.uri,
				units: units,
				project: proj,
				insertPosition: insertPosition,
				name,
				document: jsonDoc,
				lineOffset,
				characterOffset
			};
			this.translations.push(trans);
		}
		else {
			existTrans.units = units;
			existTrans.insertPosition = insertPosition;
		}
		this.validateHtmlDocuments();
	}

	private getProjectForTranslation(uri: string): Project {
		if (!this.projects) {
			return null;
		}
		const proj = this.projects.find(p => {
			if (uri.indexOf(p.translation.i18nFile) >= 0) {
				return true;
			}
		});
		return proj;
	}

	private assignProjectToTranslation(): void {
		if (this.translations.length === 0 || this.projects.length === 0) {
			return;
		}
		this.translations.forEach(trans => {
			const proj = this.getProjectForTranslation(trans.uri);
			trans.project = proj;
		});
	}

	private getSupportedTranslations(url: string): Translation[] {
		const projects = this.projects.filter(p => this.isFileBelongsProject(p, url));
		let trans = [];
		if (projects.length === 0) {
			return trans;
		}
		this.translations.forEach(translation => {
			trans.push(translation);
		});
		return trans;
	}

	private isFileBelongsProject(project: Project, uri: string): boolean {
		return true;
	}

	private getDocument(doc: TextDocument | string): DocumentWrapper {
		let document: TextDocument;
		if (typeof doc === 'string') {
			document = this.documents.get(doc);
		} else {
			document = doc;
		}
		try {
			if (document) {
				let url: string = normalize(uriToFilePath(document.uri) || document.uri);
				if (url.startsWith('/')) {
					url = url.slice(1, url.length);
				}
				return {
					document: document,
					url: url
				};
			}
		}
		catch (ex) {
			debugger;
		}
		return null;
	}

	private getDocumentUrl(url: string): string {
		const document = this.documents.all().find(document => {
			const documentUrl = normalize(uriToFilePath(document.uri));
			return documentUrl === url;
		});
		return document && document.uri;
	}
}

export interface DocumentWrapper {
	document: TextDocument;
	url: string;
}