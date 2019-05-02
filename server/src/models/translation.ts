import { Project } from '../project.model';
import { TransUnit } from "./TransUnit";
import { Position, TextDocument } from 'vscode-languageserver';
export interface Translation {
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
