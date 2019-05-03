import { Position, TextDocument } from 'vscode-languageserver';

import { Project } from '../project.model';
import { TransUnit } from './TransUnit';

export interface Translation {
	textDocument: TextDocument;
	lineOffset: number;
	characterOffset: number;
	document: any;
	uri: string;
	documentUri: string;
	units: TransUnit[];
	project: Project;
	insertPosition: Position;
	name: string;
}
