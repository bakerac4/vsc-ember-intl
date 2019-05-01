import { Range } from 'vscode-languageserver';

export interface TransUnit {
	id: string;
	value: string;
	sourceIndex: number;
	targetIndex: number;
	targetRange: Range;
	idRange: Range;
	range: Range;
}
