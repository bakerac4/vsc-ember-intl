import * as JsonLanguageService from 'vscode-json-languageservice';
import { TextDocument } from 'vscode-languageserver';

import { DocumentWrapper } from './translationProvider';

export class TranslationParser {
	private splitUnitsRegex = /<trans-unit(.|\s|\n)*?<\/trans-unit>/gm;
	private idRegex = /id=["|'](.+?)["|']/m;
	private sourceRegex = /<source>((.|\s|\n)*?)<\/source>/m;
	private targetRegex = /<target>((.|\s|\n)*?)<\/target>/m;

	public getTransUnits(document: DocumentWrapper): any {
		try {
			// let unitBlocks = this.getTransUnitsBlocks(document);
			// let units = this.processUnitBlocks(document, unitBlocks);
			let doc = document.document;
			let text = doc.getText();
			let lineOffset = 0;
			let characterOffset = 0;
			if (document.document.languageId === 'javascript') {
				lineOffset = 0;
				characterOffset = 15;
				text = document.document.getText({
					start: { line: lineOffset, character: characterOffset },
					end: { line: document.document.lineCount - 2, character: 1 }
				});
				doc = TextDocument.create('', 'json', 1, text);
			}
			// const translations = this.flattenJSON(JSON.parse(text));
			const translations = this.generateTranslations(document, text);
			const ls = JsonLanguageService.getLanguageService({ clientCapabilities: JsonLanguageService.ClientCapabilities.LATEST });
			const jsonDoc: any = ls.parseJSONDocument(doc);
			return { units: translations, jsonDoc, lineOffset, characterOffset, textDocument: document };
		}
		catch (ex) {
			console.log(ex.message);
		}
		return [];
	}

	private generateTranslations(document, text) {
		const parsed = JSON.parse(text);
		const json = this.flattenJSON(parsed);
		return Object.keys(json).map(key => {
			return {
				id: key,
				// idRange: {
				// 	start: document.positionAt(translation.index + id.index + id[0].indexOf(id[1])),
				// 	end: document.positionAt(translation.index + id.index + id[0].indexOf(id[1]) + id[1].length)
				// },
				value: json[key] || '`<no translation>`',
				// sourceIndex: source && source.index,
				// targetIndex: target && target.index,
				// targetRange: targetRange,
				// range: {
				// 	start: document.positionAt(value.index),
				// 	end: document.positionAt(value.index + text.length)
				// }
			};
		});
	}

	private flattenJSON(data) {
		var result = {};
		function recurse (cur, prop) {
			if (Object(cur) !== cur) {
				result[prop] = cur;
			} else if (Array.isArray(cur)) {
				for(var i=0, l=cur.length; i<l; i++)
					recurse(cur[i], prop + "[" + i + "]");
				if (l == 0)
					result[prop] = [];
			} else {
				var isEmpty = true;
				for (var p in cur) {
					isEmpty = false;
					recurse(cur[p], prop ? prop+"."+p : p);
				}
				if (isEmpty && prop)
					result[prop] = {};
			}
		}
		recurse(data, "");
		return result;
	}

	private getTransUnitsBlocks(wrap: DocumentWrapper): RegExpExecArray[] {
		let units = [];
		let m: RegExpExecArray | null;
		const text = wrap.document.getText();
		while (m = this.splitUnitsRegex.exec(text)) {
			units.push(m);
		}
		return units;
	}

	// private processUnitBlocks(wrap: DocumentWrapper, blocks: RegExpExecArray[]): TransUnit[] {
	// 	let units: TransUnit[] = [];
	// 	blocks.forEach(value => {
	// 		const text = value[0];
	// 		const id = this.idRegex.exec(text);
	// 		if (!id) {
	// 			return;
	// 		}
	// 		const source = this.sourceRegex.exec(text);
	// 		const target = this.targetRegex.exec(text);
	// 		let targetRange = null;
	// 		if (target) {
	// 			const diff = (target[0].length - target[1].length) / 2;
	// 			targetRange = <Range>{
	// 				start: wrap.document.positionAt(value.index + target.index + diff),
	// 				end: wrap.document.positionAt(value.index + target.index + target[1].length + diff)
	// 			};
	// 		}
	// 		units.push(<TransUnit>{
	// 			id: id[1],
	// 			idRange: {
	// 				start: wrap.document.positionAt(value.index + id.index + id[0].indexOf(id[1])),
	// 				end: wrap.document.positionAt(value.index + id.index + id[0].indexOf(id[1]) + id[1].length)
	// 			},
	// 			source: source && source[1],
	// 			target: (target && target[1]) || '`<no translation>`',
	// 			sourceIndex: source && source.index,
	// 			targetIndex: target && target.index,
	// 			targetRange: targetRange,
	// 			range: {
	// 				start: wrap.document.positionAt(value.index),
	// 				end: wrap.document.positionAt(value.index + text.length)
	// 			}
	// 		});
	// 	});
	// 	return units;
	// }
}
